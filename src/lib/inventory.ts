import "server-only";
import type { BookingRequest, Prisma, AvailabilityStatus } from "@prisma/client";
import { enumerateNights, enumerateDays, addDays, toDateKey } from "./dates";
import { syncRoomTypeAvailability } from "./room-availability";

type Tx = Prisma.TransactionClient;

/** Tình trạng suy ra từ số lượng còn lại (dùng cho cabin sau khi trừ/cộng). */
function statusFromCount(count: number): AvailabilityStatus {
  if (count <= 0) return "SOLD_OUT";
  if (count <= 5) return "LIMITED";
  return "AVAILABLE";
}

/**
 * Điều chỉnh tồn kho theo một yêu cầu đặt.
 * direction = -1: trừ (khi xác nhận giữ chỗ). direction = +1: cộng lại (khi huỷ/mở lại).
 * Chỉ tác động lên các ngày ĐÃ có dữ liệu tồn (bỏ qua ngày chưa cập nhật).
 *
 * LƯU Ý: số còn trống là giá trị quản trị viên tự đặt theo ngày (có thể lớn hơn
 * totalUnits/totalRooms/seatsTotal), nên KHÔNG kẹp theo tổng — chỉ không cho âm.
 * Việc trừ rồi cộng lại luôn đối xứng nên không bị vượt quá giá trị ban đầu.
 */
export async function adjustInventory(
  tx: Tx,
  booking: BookingRequest,
  direction: 1 | -1,
): Promise<void> {
  const delta = direction * booking.quantity;

  // ----- Xe cabin: theo chuyến (đi + về, pool đơn + đôi) -----
  if (booking.cabinTripId) {
    // Số vé đơn/đôi mỗi chiều; đơn hàng cũ không có → trừ toàn bộ vào pool đơn.
    const nSingle = booking.seatsSingle ?? booking.quantity;
    const nDouble = booking.seatsDouble ?? 0;
    const tripIds = [booking.cabinTripId, booking.cabinReturnTripId].filter(
      (x): x is string => Boolean(x),
    );
    for (const tripId of tripIds) {
      const trip = await tx.cabinTrip.findUnique({ where: { id: tripId } });
      if (!trip) continue;
      // Lịch cabin LUÔN CÒN CHỖ: số ghế chỉ để thống kê "đã đặt" — không chặn xác nhận và
      // không tự đổi trạng thái (SOLD_OUT = admin đánh dấu HẾT VÉ, chỉ admin bật/tắt).
      // Cho phép âm (đặt vượt tổng chỗ khai báo) để trừ/cộng luôn đối xứng khi huỷ.
      await tx.cabinTrip.update({
        where: { id: trip.id },
        data: {
          seatsAvailable: trip.seatsAvailable + direction * nSingle,
          seatsDoubleAvailable: trip.seatsDoubleAvailable + direction * nDouble,
        },
      });
    }
    return;
  }

  // ----- Xe máy: theo từng ngày thuê -----
  if (booking.rentalVehicleId) {
    const end = booking.endDate ?? booking.useDate;
    const days = enumerateDays(booking.useDate, end);
    for (const date of days) {
      const row = await tx.rentalAvailability.findUnique({
        where: { rentalVehicleId_date: { rentalVehicleId: booking.rentalVehicleId, date } },
      });
      if (!row) continue; // ngày chưa cập nhật -> bỏ qua
      // Trừ xe: phải đủ xe thật — kẹp âm thầm sẽ làm lệch tồn khi huỷ (cộng lại dư).
      if (direction === -1 && row.availableUnits < booking.quantity) {
        throw new Error(`Ngày ${toDateKey(date)} chỉ còn ${row.availableUnits} xe — không đủ ${booking.quantity} xe để xác nhận.`);
      }
      const next = Math.max(0, row.availableUnits + delta);
      await tx.rentalAvailability.update({
        where: { id: row.id },
        data: { availableUnits: next, status: statusFromCount(next) },
      });
    }
    return;
  }

  // ----- Homestay / Bungalow: theo từng đêm -----
  if (booking.roomTypeId) {
    const checkout = booking.endDate ?? addDays(booking.useDate, 1);
    const nights = enumerateNights(booking.useDate, checkout);
    for (const date of nights) {
      const row = await tx.roomAvailability.findUnique({
        where: { roomTypeId_date: { roomTypeId: booking.roomTypeId, date } },
      });
      if (!row) continue;
      if (direction === -1 && row.availableRooms < booking.quantity) {
        throw new Error(`Đêm ${toDateKey(date)} chỉ còn ${row.availableRooms} phòng — không đủ ${booking.quantity} phòng để xác nhận.`);
      }
      const next = Math.max(0, row.availableRooms + delta);
      await tx.roomAvailability.update({
        where: { id: row.id },
        data: { availableRooms: next, status: statusFromCount(next) },
      });
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
export async function assignRoomsForBooking(
  tx: Prisma.TransactionClient,
  booking: BookingRequest,
  hold: boolean,
): Promise<void> {
  if (!booking.roomTypeId) return;
  const roomTypeId = booking.roomTypeId;

  if (!hold) {
    // Trả phòng: xoá các ô gắn với đơn này, rồi tính lại số trống.
    const rows = await tx.roomDayStatus.findMany({ where: { bookingId: booking.id } });
    if (rows.length === 0) return;
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
  const assigned: string[] = [];
  for (const room of rooms) {
    if (assigned.length >= need) break;
    const conflict = await tx.roomDayStatus.count({
      where: { roomId: room.id, date: { in: nights }, status: { not: "AVAILABLE" } },
    });
    if (conflict === 0) assigned.push(room.id);
  }
  // Không đủ phòng trống → báo lỗi để rollback, tránh "xác nhận" mà không giữ phòng nào.
  if (assigned.length < need) {
    throw new Error(
      pinnedIds
        ? `Phòng khách chọn đã kín trong khoảng ngày này (giữ được ${assigned.length}/${need} phòng) — kiểm tra lịch phòng trước khi xác nhận.`
        : `Chỉ còn ${assigned.length}/${need} phòng trống trong khoảng ngày này — không thể giữ chỗ.`,
    );
  }

  for (const roomId of assigned) {
    for (const date of nights) {
      await tx.roomDayStatus.upsert({
        where: { roomId_date: { roomId, date } },
        create: { roomId, date, status: "BOOKED", bookingId: booking.id },
        update: { status: "BOOKED", bookingId: booking.id },
      });
    }
  }
  // Đơn ghép có thể gồm phòng của nhiều hạng → tính lại tồn cho từng hạng liên quan.
  const typeIds = new Set<string>([roomTypeId, ...rooms.map((r) => r.roomTypeId)]);
  for (const tid of typeIds) {
    for (const date of nights) await syncRoomTypeAvailability(tid, date, tx);
  }
}
