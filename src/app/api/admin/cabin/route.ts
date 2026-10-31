import { NextResponse } from "next/server";
import type { AvailabilityStatus, CabinDirection } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { parseDateOnly } from "@/lib/dates";
import { adjustInventory, assignRoomsForBooking } from "@/lib/inventory";
import { generateBookingCode } from "@/lib/utils";

export const dynamic = "force-dynamic";

const DEFAULT_TIME: Record<CabinDirection, string> = { OUTBOUND: "21:00", RETURN: "12:00" };

// "Tạm dừng" = SOLD_OUT khi VẪN còn chỗ (seatsAvailable > 0) → phân biệt với
// chuyến đang bán mà hết chỗ (SOLD_OUT + seatsAvailable 0, do adjustInventory).
function statusForOpen(open: boolean, free: number): AvailabilityStatus {
  if (!open) return "SOLD_OUT"; // tạm dừng (giữ nguyên seatsAvailable > 0)
  if (free <= 0) return "SOLD_OUT";
  if (free <= 3) return "LIMITED";
  return "AVAILABLE";
}

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

      // Tạo mới (mở bán) nếu chưa có.
      if (!trip) {
        if (body.open === false) return NextResponse.json({ ok: true });
        const ref = await prisma.cabinTrip.findFirst({
          where: { serviceId, direction },
          orderBy: { departureDate: "desc" },
        });
        const total = Number(body.seatsTotal) > 0 ? Math.floor(Number(body.seatsTotal)) : ref?.seatsTotal || 22;
        const price = Number(body.price) > 0 ? Math.floor(Number(body.price)) : ref ? Number(ref.price) : 0;
        trip = await prisma.cabinTrip.create({
          data: {
            serviceId,
            operatorName: ref?.operatorName ?? service.title,
            route: ref?.route ?? service.area ?? "Hà Nội → Tà Xùa",
            direction,
            departureDate: dateObj,
            departureTime: ref?.departureTime ?? DEFAULT_TIME[direction],
            pickupPoint: ref?.pickupPoint ?? "",
            dropoffPoint: ref?.dropoffPoint ?? "",
            price,
            seatsTotal: total,
            seatsAvailable: total,
            status: "AVAILABLE",
          },
        });
        return NextResponse.json({ ok: true, tripId: trip.id });
      }

      // Cập nhật chuyến đã có. "Đã đặt" = tổng − còn trống (theo tồn kho thực).
      const booked = Math.max(0, trip.seatsTotal - trip.seatsAvailable);
      const total = body.seatsTotal != null ? Math.max(0, Math.floor(Number(body.seatsTotal))) : trip.seatsTotal;
      if (total < booked) {
        return NextResponse.json({ error: `Không thể nhỏ hơn số vé đã đặt (${booked}).` }, { status: 400 });
      }
      const free = Math.max(0, total - booked);
      const price = body.price != null ? Math.max(0, Math.floor(Number(body.price))) : Number(trip.price);
      const open = body.open != null ? Boolean(body.open) : !(trip.status === "SOLD_OUT" && trip.seatsAvailable + trip.seatsDoubleAvailable > 0);
      await prisma.cabinTrip.update({
        where: { id: trip.id },
        data: {
          price,
          seatsTotal: total,
          seatsAvailable: free,
          // Tình trạng tính theo TỔNG chỗ còn của cả 2 pool (đơn + đôi) — hết đơn
          // nhưng còn cabin đôi thì vẫn đang bán.
          status: statusForOpen(open, free + trip.seatsDoubleAvailable),
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
      const trip = await prisma.cabinTrip.findFirst({ where: { serviceId, departureDate: parseDateOnly(date), direction } });
      if (!trip) return NextResponse.json({ error: "Chuyến chưa mở bán." }, { status: 400 });
      const free = trip.seatsAvailable;
      if (seats > free) return NextResponse.json({ error: `Chỉ còn ${Math.max(0, free)} chỗ trống.` }, { status: 400 });

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
          },
        });
        await adjustInventory(tx, { ...booking }, -1);
        await tx.bookingRequest.update({ where: { id: booking.id }, data: { inventoryApplied: true } });
      });
      return NextResponse.json({ ok: true, code });
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
