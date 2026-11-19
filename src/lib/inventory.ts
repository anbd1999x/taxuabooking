import { dmy } from "@/lib/date-format";
import "server-only";
import type { BookingRequest, Prisma, AvailabilityStatus } from "@prisma/client";
import { enumerateNights, enumerateDays, addDays, toDateKey } from "./dates";
import { syncRoomTypeAvailability } from "./room-availability";
import { fleetWebServices } from "./fleet";

type Tx = Prisma.TransactionClient;

/** Tình trạng suy ra từ số lượng còn lại (dùng cho cabin sau khi trừ/cộng). */
function statusFromCount(count: number): AvailabilityStatus {
  if (count <= 0) return "SOLD_OUT";
  if (count <= 5) return "LIMITED";
  return "AVAILABLE";
}

/** Khoá advisory `home:<serviceId>` (cùng khoá với stay.ts → lockHome) cho các homestay chứa các phòng; sắp theo id. */
async function lockHomesOfRooms(tx: Tx, roomIds: string[], extraServiceIds: string[] = []): Promise<void> {
  const ids = [...new Set(roomIds)];
  const sids = new Set(extraServiceIds);
  if (ids.length) {
    for (const r of await tx.room.findMany({ where: { id: { in: ids } }, select: { roomType: { select: { serviceId: true } } } })) {
      sids.add(r.roomType.serviceId);
    }
  }
  for (const sid of [...sids].sort()) {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${"home:" + sid}))::text AS ok`;
  }
}

/**
 * Tuần tự hoá MỌI lần đổi trạng thái / áp-trả tồn của CÙNG một đơn, gọi đầu transaction trước khi đọc
 * `inventoryApplied` (hai lần xác nhận song song cùng đọc false ⇒ trừ tồn 2 lần — BK-3).
 * Thứ tự khoá CỐ ĐỊNH để không chờ vòng với Quản lý phòng (lockHome → UPDATE dòng đơn) và đội xe
 * (lockFleet → FOR UPDATE dòng đơn):
 *   1. advisory `booking:<id>` — chỉ các luồng đơn lấy, stay/fleet không bao giờ lấy;
 *   2. advisory `home:<id>` của mọi homestay đơn đang/ sẽ chiếm (phòng hiện tại + `extraRoomIds` + lượt ở cũ);
 *   3. cuối cùng mới khoá dòng đơn FOR UPDATE.
 * Dòng đơn luôn là khoá lấy SAU CÙNG ⇒ không ai giữ dòng đơn mà đi chờ home/fleet do luồng đơn giữ.
 * `extraRoomIds`: phòng MỚI khi sửa đơn đổi phòng (khoá trước cả homestay mới).
 */
export async function lockBooking(tx: Tx, id: string, extraRoomIds: string[] = []): Promise<void> {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${"booking:" + id}))::text AS ok`;
  const b = await tx.bookingRequest.findUnique({ where: { id }, select: { roomId: true, roomIds: true, roomTypeId: true } });
  const stays = await tx.roomStay.findMany({ where: { bookingId: id }, select: { serviceId: true } });
  const roomIds = [...(b?.roomIds ?? []), ...(b?.roomId ? [b.roomId] : []), ...extraRoomIds];
  const sids = stays.map((s) => s.serviceId);
  // Đơn theo hạng (không chỉ định phòng): khoá homestay của hạng.
  if (b?.roomTypeId && roomIds.length === 0) {
    const t = await tx.roomType.findUnique({ where: { id: b.roomTypeId }, select: { serviceId: true } });
    if (t) sids.push(t.serviceId);
  }
  // Ô lịch còn gắn đơn (ghi đè force / phòng đã đổi) cũng phải nằm trong khoá home trước khi xoá.
  const cellRooms = await tx.roomDayStatus.findMany({ where: { bookingId: id }, select: { roomId: true }, distinct: ["roomId"] });
  await lockHomesOfRooms(tx, [...roomIds, ...cellRooms.map((c) => c.roomId)], sids);
  await tx.$queryRaw`SELECT id FROM "BookingRequest" WHERE id = ${id} FOR UPDATE`;
}

/**
 * Điều chỉnh tồn kho theo một yêu cầu đặt.
 * direction = -1: trừ (khi xác nhận giữ chỗ). direction = +1: cộng lại (khi huỷ/mở lại).
 * Chỉ tác động lên các ngày ĐÃ có dữ liệu tồn (bỏ qua ngày chưa cập nhật).
 *
 * LƯU Ý: số còn trống là giá trị quản trị viên tự đặt theo ngày (có thể lớn hơn
 * totalUnits/totalRooms/seatsTotal), nên KHÔNG kẹp theo tổng — chỉ không cho âm.
 * Việc trừ rồi cộng lại luôn đối xứng nên không bị vượt quá giá trị ban đầu.
 * Mọi cộng/trừ là increment/decrement NGUYÊN TỬ (không đọc-rồi-ghi) để hai đơn xác nhận
 * song song không ghi đè số của nhau; trừ xe/phòng có điều kiện "đủ tồn" ngay trong câu UPDATE.
 */
export async function adjustInventory(
  tx: Tx,
  booking: BookingRequest,
  direction: 1 | -1,
): Promise<void> {
  const qty = booking.quantity;

  // ----- Xe cabin: theo chuyến (đi + về, pool đơn + đôi) -----
  if (booking.cabinTripId) {
    // Số vé đơn/đôi mỗi chiều; đơn hàng cũ không có → trừ toàn bộ vào pool đơn.
    const nSingle = booking.seatsSingle ?? booking.quantity;
    const nDouble = booking.seatsDouble ?? 0;
    const tripIds = [booking.cabinTripId, booking.cabinReturnTripId].filter(
      (x): x is string => Boolean(x),
    );
    for (const tripId of tripIds) {
      // Lịch cabin LUÔN CÒN CHỖ: số ghế chỉ để thống kê "đã đặt" — không chặn xác nhận và
      // không tự đổi trạng thái (SOLD_OUT = admin đánh dấu HẾT VÉ, chỉ admin bật/tắt).
      // Cho phép âm (đặt vượt tổng chỗ khai báo) để trừ/cộng luôn đối xứng khi huỷ.
      // updateMany: chuyến đã bị xoá ⇒ count 0, bỏ qua như trước.
      await tx.cabinTrip.updateMany({
        where: { id: tripId },
        data: {
          seatsAvailable: { increment: direction * nSingle },
          seatsDoubleAvailable: { increment: direction * nDouble },
        },
      });
    }
    return;
  }

  // ----- Xe máy: theo từng ngày thuê -----
  if (booking.rentalVehicleId) {
    // Nhà xe dùng ĐỘI XE THẬT (quản lý xe) ⇒ tồn tính theo xe rảnh, không trừ lịch tồn nhập tay nữa.
    if (booking.serviceId && (await fleetWebServices([booking.serviceId], tx)).length > 0) return;
    const rentalVehicleId = booking.rentalVehicleId;
    const end = booking.endDate ?? booking.useDate;
    const days = enumerateDays(booking.useDate, end);
    for (const date of days) {
      const key = { rentalVehicleId_date: { rentalVehicleId, date } };
      // Trừ xe: phải đủ xe thật — kẹp âm thầm sẽ làm lệch tồn khi huỷ (cộng lại dư).
      const res = await tx.rentalAvailability.updateMany({
        where: { rentalVehicleId, date, ...(direction === -1 ? { availableUnits: { gte: qty } } : {}) },
        data: { availableUnits: direction === -1 ? { decrement: qty } : { increment: qty } },
      });
      if (res.count === 0) {
        const row = await tx.rentalAvailability.findUnique({ where: key });
        if (!row) continue; // ngày chưa cập nhật -> bỏ qua
        throw new Error(`Ngày ${dmy(date)} chỉ còn ${row.availableUnits} xe — không đủ ${qty} xe để xác nhận.`);
      }
      // Dòng đã bị khoá bởi UPDATE trên ⇒ đọc lại số mới để suy tình trạng là nhất quán.
      const row = await tx.rentalAvailability.findUnique({ where: key });
      if (row) await tx.rentalAvailability.update({ where: { id: row.id }, data: { status: statusFromCount(row.availableUnits) } });
    }
    return;
  }

  // ----- Homestay / Bungalow: theo từng đêm -----
  if (booking.roomTypeId) {
    const roomTypeId = booking.roomTypeId;
    const checkout = booking.endDate ?? addDays(booking.useDate, 1);
    const nights = enumerateNights(booking.useDate, checkout);
    for (const date of nights) {
      const key = { roomTypeId_date: { roomTypeId, date } };
      const res = await tx.roomAvailability.updateMany({
        where: { roomTypeId, date, ...(direction === -1 ? { availableRooms: { gte: qty } } : {}) },
        data: { availableRooms: direction === -1 ? { decrement: qty } : { increment: qty } },
      });
      if (res.count === 0) {
        const row = await tx.roomAvailability.findUnique({ where: key });
        if (!row) continue;
        throw new Error(`Đêm ${dmy(date)} chỉ còn ${row.availableRooms} phòng — không đủ ${qty} phòng để xác nhận.`);
      }
      const row = await tx.roomAvailability.findUnique({ where: key });
      if (row) await tx.roomAvailability.update({ where: { id: row.id }, data: { status: statusFromCount(row.availableRooms) } });
    }
  }
}

/** Trạng thái "giữ chỗ" (đang chiếm tồn kho). */
export function statusHoldsInventory(status: string): boolean {
  return status === "CONFIRMED" || status === "COMPLETED";
}

/**
 * Gán / trả phòng riêng cho một đơn homestay (mô hình lưới từng phòng).
 * hold = true: tự chọn phòng trống và đánh dấu "Đã đặt" theo đơn.
 * hold = false: trả lại các phòng đã gán cho đơn này.
 */
/**
 * Phòng của đơn đang bị khoá (đơn khác / sheet / khoá tay) trong khoảng ngày cần giữ.
 * `message` mô tả tình trạng hiện tại để giao diện hỏi admin có GHI ĐÈ không.
 */
export class RoomConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RoomConflictError";
  }
}

const ROOM_STATUS_VI: Record<string, string> = { BOOKED: "Đã đặt", PENDING: "Chờ xác nhận", CLOSED: "Đóng" };

/** Mô tả các ô đang khoá: "Phòng Mây: 14/11 Đã đặt (đơn TX-ABC · Lan), 15/11 Đóng (khoá tay/sheet)". */
async function describeRoomConflicts(
  tx: Prisma.TransactionClient,
  rooms: { id: string; name: string }[],
  nights: Date[],
  ownBookingId: string,
): Promise<string> {
  const cells = await tx.roomDayStatus.findMany({
    where: {
      roomId: { in: rooms.map((r) => r.id) },
      date: { in: nights },
      status: { not: "AVAILABLE" },
      // NOT {bookingId} sinh SQL loại luôn ô bookingId NULL (khoá tay / sheet / lượt ở) ⇒ phải tách OR.
      OR: [{ bookingId: null }, { bookingId: { not: ownBookingId } }],
    },
    orderBy: [{ roomId: "asc" }, { date: "asc" }],
  });
  const holderIds = [...new Set(cells.map((c) => c.bookingId).filter((x): x is string => !!x))];
  const holders = new Map(
    (holderIds.length
      ? await tx.bookingRequest.findMany({ where: { id: { in: holderIds } }, select: { id: true, code: true, customerName: true } })
      : []
    ).map((h) => [h.id, `đơn ${h.code} · ${h.customerName}`]),
  );
  const nameOf = new Map(rooms.map((r) => [r.id, r.name]));
  const byRoom = new Map<string, string[]>();
  for (const c of cells) {
    const k = toDateKey(c.date);
    const who = c.bookingId ? (holders.get(c.bookingId) ?? "đơn khác") : c.note ? `nguồn ${c.note}` : "khoá tay";
    const list = byRoom.get(c.roomId) ?? [];
    list.push(`${dmy(k)} ${ROOM_STATUS_VI[c.status] ?? c.status} (${who})`);
    byRoom.set(c.roomId, list);
  }
  return [...byRoom.entries()]
    .map(([rid, l]) => `• ${nameOf.get(rid) ?? "Phòng"}: ${l.slice(0, 6).join(", ")}${l.length > 6 ? ` … (+${l.length - 6} đêm)` : ""}`)
    .join("\n");
}

export async function assignRoomsForBooking(
  tx: Prisma.TransactionClient,
  booking: BookingRequest,
  hold: boolean,
  /** force = admin đã đồng ý GHI ĐÈ lên các ô đang khoá (đơn khác / sheet / khoá tay). */
  opts: { force?: boolean } = {},
): Promise<void> {
  if (!booking.roomTypeId) return;
  const roomTypeId = booking.roomTypeId;

  if (!hold) {
    // Trả phòng: xoá các ô gắn với đơn này, rồi tính lại số trống.
    const rows = await tx.roomDayStatus.findMany({ where: { bookingId: booking.id } });
    if (rows.length === 0) return;
    // Khoá home TRƯỚC khi xoá ô (như nhánh giữ chỗ): không giữ khoá dòng ô rồi mới chờ lockHome.
    await lockHomesOfRooms(tx, rows.map((r) => r.roomId));
    await tx.roomDayStatus.deleteMany({ where: { bookingId: booking.id } });
    const uniqueDates = Array.from(
      new Map(rows.map((r) => [toDateKey(r.date), r.date])).values(),
    );
    // Đơn ghép nhiều phòng có thể trải trên NHIỀU hạng phòng → tính lại từng hạng.
    const releasedRooms = await tx.room.findMany({
      where: { id: { in: [...new Set(rows.map((r) => r.roomId))] } },
      select: { roomTypeId: true },
    });
    const typeIds = new Set<string>([roomTypeId, ...releasedRooms.map((r) => r.roomTypeId)]);
    for (const tid of typeIds) {
      for (const date of uniqueDates) await syncRoomTypeAvailability(tid, date, tx);
    }
    return;
  }

  // Giữ chỗ: chọn phòng trống cho tất cả các đêm.
  const checkout = booking.endDate ?? addDays(booking.useDate, 1);
  const nights = enumerateNights(booking.useDate, checkout);
  if (nights.length === 0) return;

  // Đơn chỉ định phòng cụ thể (1 phòng qua roomId, hoặc NHIỀU phòng qua roomIds
  // — combo ghép phòng) → gán đúng các phòng đó; ngược lại chọn phòng trống theo hạng.
  const pinnedIds = booking.roomIds.length > 0 ? booking.roomIds : booking.roomId ? [booking.roomId] : null;
  const rooms = pinnedIds
    ? await tx.room.findMany({ where: { id: { in: pinnedIds } } })
    : await tx.room.findMany({ where: { roomTypeId }, orderBy: { sortOrder: "asc" } });
  const need = pinnedIds ? pinnedIds.length : booking.quantity;
  // Khoá cùng khoá `home:<serviceId>` của Quản lý phòng (stay.ts → lockHome) để sàn chốt đơn
  // không chen đúng lúc chủ tạo lượt ở (cả hai cùng thấy trống rồi ghi đè ô của nhau).
  // Sắp xếp theo id để nhiều homestay luôn khoá cùng thứ tự, tránh deadlock.
  await lockHomesOfRooms(tx, rooms.map((r) => r.id));
  const assigned: string[] = [];
  for (const room of rooms) {
    if (assigned.length >= need) break;
    // Ô do CHÍNH đơn này giữ sẵn (chủ nhà đã "xác nhận còn phòng" ở Quản lý phòng trước khi sàn chốt) không tính là trùng.
    const conflict = await tx.roomDayStatus.count({
      where: {
        roomId: room.id,
        date: { in: nights },
        status: { not: "AVAILABLE" },
        OR: [{ bookingId: null }, { bookingId: { not: booking.id } }],
      },
    });
    if (conflict === 0) assigned.push(room.id);
  }
  // Không đủ phòng trống → báo lỗi để rollback, tránh "xác nhận" mà không giữ phòng nào.
  // Admin đồng ý ghi đè (force) ⇒ lấy luôn các phòng đang khoá cho đủ số (theo thứ tự phòng).
  if (assigned.length < need) {
    const blocked = rooms.filter((r) => !assigned.includes(r.id)).slice(0, need - assigned.length);
    if (opts.force && assigned.length + blocked.length >= need) {
      assigned.push(...blocked.map((r) => r.id));
    } else {
      const detail = await describeRoomConflicts(tx, pinnedIds ? rooms : blocked, nights, booking.id);
      throw new RoomConflictError(
        (pinnedIds
          ? `Phòng khách chọn đã kín trong khoảng ngày này (giữ được ${assigned.length}/${need} phòng) — kiểm tra lịch phòng trước khi xác nhận.`
          : `Chỉ còn ${assigned.length}/${need} phòng trống trong khoảng ngày này — không thể giữ chỗ.`) +
          (detail ? `\n\nTình trạng hiện tại:\n${detail}` : ""),
      );
    }
  }

  for (const roomId of assigned) {
    for (const date of nights) {
      await tx.roomDayStatus.upsert({
        where: { roomId_date: { roomId, date } },
        create: { roomId, date, status: "BOOKED", bookingId: booking.id },
        // Ghi đè (force) ô của Quản lý phòng / sheet ⇒ ô thuộc hẳn về đơn: bỏ stayId + note, để huỷ lượt ở / mở lại phòng không xoá mất đêm của đơn.
        update: { status: "BOOKED", bookingId: booking.id, stayId: null, note: null },
      });
    }
  }
  // Đơn ghép có thể gồm phòng của nhiều hạng → tính lại tồn cho từng hạng liên quan.
  const typeIds = new Set<string>([roomTypeId, ...rooms.map((r) => r.roomTypeId)]);
  for (const tid of typeIds) {
    for (const date of nights) await syncRoomTypeAvailability(tid, date, tx);
  }
}
