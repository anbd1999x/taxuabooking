import "server-only";
import type { Prisma, AvailabilityStatus } from "@prisma/client";
import { prisma } from "./prisma";
import { addDays, today } from "./dates";

function statusFromCount(available: number): AvailabilityStatus {
  if (available <= 0) return "SOLD_OUT";
  if (available <= 2) return "LIMITED";
  return "AVAILABLE";
}

type Client = Prisma.TransactionClient | typeof prisma;

/**
 * Tính lại RoomAvailability (mô hình số lượng dùng cho web khách + luồng đặt)
 * từ trạng thái từng phòng riêng. "Trống" = còn bán; Đã đặt/Chờ/Đóng = không bán.
 */
export async function syncRoomTypeAvailability(
  roomTypeId: string,
  date: Date,
  client: Client = prisma,
): Promise<void> {
  const total = await client.room.count({ where: { roomTypeId } });
  const occupied = await client.roomDayStatus.count({
    where: { date, status: { not: "AVAILABLE" }, room: { roomTypeId } },
  });
  const available = Math.max(0, total - occupied);
  await client.roomAvailability.upsert({
    where: { roomTypeId_date: { roomTypeId, date } },
    create: { roomTypeId, date, availableRooms: available, status: statusFromCount(available) },
    update: { availableRooms: available, status: statusFromCount(available) },
  });
}

/** Tính lại số phòng trống cho một khoảng ngày (dùng khi thêm/xoá phòng riêng). */
export async function resyncRoomTypeWindow(
  roomTypeId: string,
  days = 90,
  client: Client = prisma,
): Promise<void> {
  const start = today();
  for (let i = 0; i < days; i++) {
    await syncRoomTypeAvailability(roomTypeId, addDays(start, i), client);
  }
}
