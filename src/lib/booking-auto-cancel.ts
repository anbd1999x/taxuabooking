import type { BookingRequest, Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { adjustInventory, assignRoomsForBooking } from "./inventory";
import { AUTO_CANCEL_HOURS_KEY, hoursLabel, parseAutoCancelHours } from "./auto-cancel-config";

/**
 * TỰ HUỶ ĐƠN CHƯA THANH TOÁN.
 *
 * Chỉ đụng tới đơn còn ở "Mới" / "Đang liên hệ" VÀ chưa ghi nhận khoản thu nào (UNPAID). Đơn đã xác
 * nhận, đã cọc hoặc đã thanh toán KHÔNG bao giờ bị tự huỷ.
 *  1) Quá hạn: sau N giờ kể từ lúc tạo mà chưa ghi nhận thanh toán/cọc — N do admin thiết lập ở
 *     /admin/bookings (mặc định 6; 0 = tắt quy tắc này).
 *  2) Hết phòng theo lịch đồng bộ: sau khi đồng bộ sheet/API, phòng khách chọn đã bị chủ nhà ghi
 *     "đã đặt"/"đóng" ở một đêm trong kỳ ở (xem cancelBookingsBlockedBySheet).
 * Đơn tạo trước AUTO_CANCEL_FROM (lúc bật tính năng) không bị ảnh hưởng — tránh huỷ hàng loạt đơn cũ.
 */
/** Số giờ tự huỷ do admin thiết lập ở /admin/bookings (đọc thẳng DB, không qua cache). 0 = tắt. */
export async function getAutoCancelHours(): Promise<number> {
  const row = await prisma.siteSetting.findUnique({ where: { key: AUTO_CANCEL_HOURS_KEY } });
  return parseAutoCancelHours(row?.value);
}
export const AUTO_CANCEL_FROM = new Date("2026-11-11T17:00:00.000Z"); // 00:00 ngày 12/11/2026 giờ VN (đơn đặt từ hôm bật tính năng)
const AUTO_CANCEL_LOCK_KEY = 772_641_902; // khoá advisory riêng (khác khoá nhắc lịch)
const BY = "Hệ thống";

const PENDING = { status: { in: ["NEW", "CONTACTING"] as ("NEW" | "CONTACTING")[] }, paymentStatus: "UNPAID" as const };
const AUTO_TITLE = "Tự động huỷ đơn";
// Đơn đã từng bị tự huỷ mà quản trị viên MỞ LẠI ⇒ không bao giờ tự huỷ lần nữa (người đã quyết định giữ đơn).
// Trước đây đơn mở lại bị huỷ tiếp ở lượt quét/đồng bộ kế (vì điều kiện huỷ vẫn còn đúng).
const NEVER_AUTO_CANCELLED = { logs: { none: { title: AUTO_TITLE } } };

/** Huỷ một đơn (trả tồn nếu lỡ đã giữ) + ghi nhật ký. Trả false nếu đơn vừa đổi trạng thái/đã thu tiền. */
async function cancelOne(tx: Prisma.TransactionClient, id: string, reason: string): Promise<boolean> {
  const b: BookingRequest | null = await tx.bookingRequest.findUnique({ where: { id } });
  if (!b || (b.status !== "NEW" && b.status !== "CONTACTING") || b.paymentStatus !== "UNPAID") return false;
  if (b.inventoryApplied) {
    if (b.roomTypeId) await assignRoomsForBooking(tx, b, false);
    if (b.cabinTripId || b.rentalVehicleId) await adjustInventory(tx, b, +1);
  }
  // Cập nhật CÓ ĐIỀU KIỆN: admin vừa ghi nhận cọc / đổi trạng thái đúng lúc này thì không huỷ đè lên.
  const upd = await tx.bookingRequest.updateMany({
    where: { id, ...PENDING },
    data: { status: "CANCELLED", cancelReason: reason, inventoryApplied: false, needsConfirmation: false },
  });
  if (upd.count !== 1) throw new Error("AUTO_CANCEL_SKIPPED"); // rollback cả phần trả tồn (nếu có)
  await tx.bookingLog.create({ data: { bookingId: id, kind: "STATUS", title: AUTO_TITLE, body: `Lý do: ${reason}`, by: BY } });
  return true;
}

/** Huỷ trong 1 transaction; đơn vừa đổi trạng thái / lỗi một đơn không làm hỏng cả lượt. */
async function tryCancel(id: string, reason: string): Promise<boolean> {
  try {
    return await prisma.$transaction((tx) => cancelOne(tx, id, reason));
  } catch (err) {
    if (!(err instanceof Error && err.message === "AUTO_CANCEL_SKIPPED")) console.error("[auto-cancel] không huỷ được đơn", id, err);
    return false;
  }
}

/** Quy tắc 1: đơn chờ quá số giờ đã thiết lập mà chưa ghi nhận thanh toán. Trả về mã các đơn đã huỷ. */
export async function cancelExpiredUnpaidBookings(now = new Date()): Promise<string[]> {
  const hours = await getAutoCancelHours();
  if (hours <= 0) return []; // admin tắt tự huỷ theo thời gian
  const deadline = new Date(now.getTime() - hours * 3_600_000);
  if (deadline <= AUTO_CANCEL_FROM) return [];
  const due = await prisma.bookingRequest.findMany({
    where: { ...PENDING, ...NEVER_AUTO_CANCELLED, createdAt: { gte: AUTO_CANCEL_FROM, lte: deadline } },
    select: { id: true, code: true },
    orderBy: { createdAt: "asc" },
    take: 100,
  });
  const done: string[] = [];
  for (const b of due) {
    const ok = await tryCancel(b.id, `Quá ${hoursLabel(hours)} giờ chưa xác nhận thanh toán`);
    if (ok) done.push(b.code);
  }
  return done;
}

/** Như trên nhưng có khoá — nhiều bản app chạy song song chỉ một bản xử lý. null = bản khác đang chạy. */
export async function cancelExpiredUnpaidBookingsLocked(now = new Date()): Promise<string[] | null> {
  const locked = await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ locked: boolean }[]>`SELECT pg_try_advisory_xact_lock(${AUTO_CANCEL_LOCK_KEY}) AS locked`;
    if (!rows[0]?.locked) return null;
    return cancelExpiredUnpaidBookings(now);
  }, { timeout: 120_000, maxWait: 10_000 });
  return locked;
}

/**
 * Quy tắc 2: gọi SAU KHI đồng bộ lịch (sheet/API) của một homestay. Đơn homestay/combo đang chờ, chưa
 * thanh toán, mà một phòng khách chọn đã bị LỊCH ĐỒNG BỘ ghi "đã đặt"/"đóng" ở một đêm trong kỳ ở
 * ⇒ huỷ đơn (phòng đã bán cho khách khác qua kênh của chủ nhà). `syncTag` = note của bản ghi do đồng
 * bộ tạo — khoá tay của admin hay đơn web khác không kích hoạt quy tắc này. Chỉ tính khoá XUẤT HIỆN SAU
 * khi đơn được tạo: phòng đã kín sẵn từ trước (vd admin nhập hộ đơn mà chủ nhà đã ghi sheet) không bị huỷ.
 * Bỏ qua đơn đã đánh dấu "nhà cung cấp đã giữ phòng" (ô sheet khi đó chính là của đơn này).
 */
export async function cancelBookingsBlockedBySheet(serviceId: string, syncTag: string): Promise<string[]> {
  const today = new Date(new Date().toISOString().slice(0, 10));
  const pending = await prisma.bookingRequest.findMany({
    where: {
      ...PENDING,
      ...NEVER_AUTO_CANCELLED,
      heldRoom: false,
      createdAt: { gte: AUTO_CANCEL_FROM },
      useDate: { gte: today },
      category: { in: ["HOMESTAY", "BUNGALOW", "COMBO"] },
    },
    select: { id: true, code: true, createdAt: true, useDate: true, endDate: true, roomId: true, roomIds: true },
  });
  if (pending.length === 0) return [];
  // chỉ xét phòng thuộc homestay vừa đồng bộ (đơn combo có serviceId là combo/nhà xe, phòng ở homestay)
  const rooms = await prisma.room.findMany({ where: { roomType: { serviceId } }, select: { id: true, name: true } });
  const nameOf = new Map(rooms.map((r) => [r.id, r.name]));
  const done: string[] = [];
  for (const b of pending) {
    const ids = [...new Set([...(b.roomIds ?? []), ...(b.roomId ? [b.roomId] : [])])].filter((id) => nameOf.has(id));
    if (ids.length === 0) continue;
    const lastNight = b.endDate && b.endDate > b.useDate ? new Date(b.endDate.getTime() - 86_400_000) : b.useDate;
    const hit = await prisma.roomDayStatus.findFirst({
      where: { roomId: { in: ids }, date: { gte: b.useDate, lte: lastNight }, status: { in: ["BOOKED", "CLOSED"] }, note: syncTag, bookingId: null, createdAt: { gt: b.createdAt } },
      select: { roomId: true, date: true },
      orderBy: { date: "asc" },
    });
    if (!hit) continue;
    const d = hit.date.toISOString().slice(0, 10).split("-").reverse().join("/");
    const ok = await tryCancel(b.id, `Phòng "${nameOf.get(hit.roomId)}" đã có khách đặt đêm ${d} (theo lịch đồng bộ của chủ nhà)`);
    if (ok) done.push(b.code);
  }
  return done;
}
