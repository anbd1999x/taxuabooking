import { NextResponse } from "next/server";
import type { AvailabilityStatus, CabinDirection } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { parseDateOnly, addDays, toDateKey, isValidDateKey } from "@/lib/dates";
import { ensureTripOnDate } from "@/lib/cabin-trips";
import { adjustInventory, assignRoomsForBooking } from "@/lib/inventory";
import { generateBookingCode } from "@/lib/utils";
import { resolveCommission } from "@/lib/commission";

export const dynamic = "force-dynamic";

// Lịch cabin LUÔN MỞ BÁN (xem src/lib/cabin-trips.ts): ngày chưa có chuyến = đang bán.
// SOLD_OUT = admin đánh dấu HẾT VÉ ⇒ ngày đó bị loại khỏi tìm kiếm cabin & combo.
// Số chỗ chỉ để thống kê, không quyết định trạng thái.
function statusForOpen(open: boolean): AvailabilityStatus {
  return open ? "AVAILABLE" : "SOLD_OUT";
}
const MAX_BULK_DAYS = 400;

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
  // ADMIN toàn quyền; PROVIDER chỉ thao tác nhà xe của chính mình.
  if (session.role !== "ADMIN" && session.role !== "PROVIDER") {
    return NextResponse.json({ error: "Không có quyền." }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
  }
  const op = String(body.op ?? "");

  /** PROVIDER chỉ được thao tác dịch vụ mình sở hữu. */
  async function assertOwn(serviceId: string | null | undefined): Promise<boolean> {
    if (session!.role === "ADMIN") return true;
    if (!serviceId) return false;
    const svc = await prisma.service.findUnique({ where: { id: serviceId }, select: { ownerId: true } });
    return !!svc && svc.ownerId === session!.sub;
  }

  try {
    if (op === "saveTrip") {
      const serviceId = String(body.serviceId);
      const date = String(body.date);
      const direction = (body.direction === "RETURN" ? "RETURN" : "OUTBOUND") as CabinDirection;
      const service = await prisma.service.findFirst({ where: { id: serviceId, category: "CABIN" } });
      if (!service) return NextResponse.json({ error: "Nhà xe không tồn tại." }, { status: 404 });
      if (!(await assertOwn(serviceId))) return NextResponse.json({ error: "Nhà xe không thuộc quyền của bạn." }, { status: 403 });
      const dateObj = parseDateOnly(date);

      let trip = await prisma.cabinTrip.findFirst({ where: { serviceId, departureDate: dateObj, direction } });

      // Ngày chưa có chuyến (đang bán mặc định) ⇒ tạo chuyến thật từ mẫu để lưu chỉnh sửa
      // (đánh dấu hết vé / đổi giá / tổng chỗ). Giá trị gửi lên áp ở bước cập nhật bên dưới.
      if (!trip) {
        trip = await ensureTripOnDate(serviceId, direction, date);
        if (!trip) return NextResponse.json({ error: "Không tạo được chuyến cho ngày này." }, { status: 400 });
      }

      // Cập nhật chuyến đã có. "Đã đặt" = tổng − còn trống (theo tồn kho thực).
      const booked = Math.max(0, trip.seatsTotal - trip.seatsAvailable);
      const total = body.seatsTotal != null ? Math.max(0, Math.floor(Number(body.seatsTotal))) : trip.seatsTotal;
      if (total < booked) {
        return NextResponse.json({ error: `Không thể nhỏ hơn số vé đã đặt (${booked}).` }, { status: 400 });
      }
      const free = Math.max(0, total - booked);
      const price = body.price != null ? Math.max(0, Math.floor(Number(body.price))) : Number(trip.price);
      const open = body.open != null ? Boolean(body.open) : trip.status !== "SOLD_OUT";
      await prisma.cabinTrip.update({
        where: { id: trip.id },
        data: {
          price,
          seatsTotal: total,
          seatsAvailable: free,
          status: statusForOpen(open),
        },
      });
      return NextResponse.json({ ok: true, tripId: trip.id });
    }

    if (op === "addTicket") {
      const serviceId = String(body.serviceId);
      const date = String(body.date);
      const direction = (body.direction === "RETURN" ? "RETURN" : "OUTBOUND") as CabinDirection;
      const name = String(body.name ?? "").trim();
      const phone = String(body.phone ?? "").replace(/\s/g, "");
      const seats = Math.max(1, Math.floor(Number(body.seats) || 1));
      const source = body.source === "ctv" ? "ctv" : "phone";
      const ctvId = source === "ctv" && body.ctvId ? String(body.ctvId) : null;
      if (name.length < 2) return NextResponse.json({ error: "Nhập tên khách." }, { status: 400 });
      if (!/^0\d{9}$/.test(phone)) return NextResponse.json({ error: "Số điện thoại 10 số, bắt đầu bằng 0." }, { status: 400 });

      if (!(await assertOwn(serviceId))) return NextResponse.json({ error: "Nhà xe không thuộc quyền của bạn." }, { status: 403 });
      // Lịch luôn mở bán: ngày chưa có chuyến ⇒ tạo từ mẫu; không giới hạn theo số ghế.
      const trip = await ensureTripOnDate(serviceId, direction, date);
      if (!trip) return NextResponse.json({ error: "Nhà xe không hợp lệ." }, { status: 400 });

      let code = generateBookingCode();
      for (let i = 0; i < 5; i++) {
        if (!(await prisma.bookingRequest.findUnique({ where: { code } }))) break;
        code = generateBookingCode();
      }
      await prisma.$transaction(async (tx) => {
        const booking = await tx.bookingRequest.create({
          data: {
            code,
            category: "CABIN",
            serviceId,
            serviceTitle: trip.operatorName,
            customerName: name,
            phone,
            useDate: trip.departureDate,
            quantity: seats,
            seatsSingle: seats,
            seatsDouble: 0,
            cabinTripId: trip.id,
            selectionLabel: `${direction === "RETURN" ? "Chiều về" : "Chiều đi"} ${trip.departureTime} · ${seats} vé`,
            referencePrice: Number(trip.price) * seats,
            needsConfirmation: false,
            status: "CONFIRMED",
            ctvId,
            commissionAmount: await resolveCommission(serviceId, ctvId),
          },
        });
        await adjustInventory(tx, { ...booking }, -1);
        await tx.bookingRequest.update({ where: { id: booking.id }, data: { inventoryApplied: true } });
      });
      return NextResponse.json({ ok: true, code });
    }

    // Đánh dấu HẾT VÉ (hoặc mở bán lại) cho một khoảng ngày, theo chiều đi / về / cả hai.
    if (op === "bulkClose") {
      const serviceId = String(body.serviceId);
      const fromKey = String(body.from ?? "");
      const toKey = String(body.to ?? "") || fromKey;
      const closed = body.closed !== false;
      const dirs: CabinDirection[] =
        body.direction === "OUTBOUND" ? ["OUTBOUND"] : body.direction === "RETURN" ? ["RETURN"] : ["OUTBOUND", "RETURN"];
      if (!isValidDateKey(fromKey) || !isValidDateKey(toKey) || toKey < fromKey) {
        return NextResponse.json({ error: "Khoảng ngày không hợp lệ." }, { status: 400 });
      }
      const service = await prisma.service.findFirst({ where: { id: serviceId, category: "CABIN" }, select: { id: true } });
      if (!service) return NextResponse.json({ error: "Nhà xe không tồn tại." }, { status: 404 });
      if (!(await assertOwn(serviceId))) return NextResponse.json({ error: "Nhà xe không thuộc quyền của bạn." }, { status: 403 });
      const keys: string[] = [];
      for (let d = parseDateOnly(fromKey); toDateKey(d) <= toKey; d = addDays(d, 1)) {
        keys.push(toDateKey(d));
        if (keys.length > MAX_BULK_DAYS) {
          return NextResponse.json({ error: `Tối đa ${MAX_BULK_DAYS} ngày mỗi lần.` }, { status: 400 });
        }
      }
      let changed = 0;
      for (const key of keys) {
        for (const direction of dirs) {
          if (closed) {
            const trip = await ensureTripOnDate(serviceId, direction, key);
            if (trip && trip.status !== "SOLD_OUT") {
              await prisma.cabinTrip.update({ where: { id: trip.id }, data: { status: "SOLD_OUT" } });
              changed++;
            }
          } else {
            // Mở bán lại: chỉ cần gỡ đánh dấu ở chuyến đã có (ngày không có chuyến vốn đang bán).
            const r = await prisma.cabinTrip.updateMany({
              where: { serviceId, direction, departureDate: parseDateOnly(key), status: "SOLD_OUT" },
              data: { status: "AVAILABLE" },
            });
            changed += r.count;
          }
        }
      }
      return NextResponse.json({ ok: true, changed });
    }

    if (op === "confirm" || op === "cancel") {
      const bookingId = String(body.bookingId);
      const target = await prisma.bookingRequest.findUnique({ where: { id: bookingId }, select: { serviceId: true } });
      if (!target) return NextResponse.json({ error: "Không tìm thấy vé." }, { status: 404 });
      if (!(await assertOwn(target.serviceId))) return NextResponse.json({ error: "Vé không thuộc dịch vụ của bạn." }, { status: 403 });
      await prisma.$transaction(async (tx) => {
        const booking = await tx.bookingRequest.findUnique({ where: { id: bookingId } });
        if (!booking) throw new Error("Không tìm thấy vé.");
        if (op === "confirm") {
          if (!booking.inventoryApplied) {
            // Đơn COMBO có cả phòng homestay → giữ phòng cùng lúc với trừ ghế.
            if (booking.roomTypeId) await assignRoomsForBooking(tx, booking, true);
            await adjustInventory(tx, booking, -1);
          }
          await tx.bookingRequest.update({ where: { id: bookingId }, data: { status: "CONFIRMED", inventoryApplied: true } });
        } else {
          if (booking.inventoryApplied) {
            if (booking.roomTypeId) await assignRoomsForBooking(tx, booking, false);
            await adjustInventory(tx, booking, +1);
          }
          await tx.bookingRequest.update({ where: { id: bookingId }, data: { status: "CANCELLED", inventoryApplied: false } });
        }
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Thao tác không hợp lệ." }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Có lỗi xảy ra." }, { status: 400 });
  }
}
