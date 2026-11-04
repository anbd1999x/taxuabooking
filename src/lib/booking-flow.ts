import type { BookingStatus, PaymentStatus } from "@prisma/client";

/**
 * Quy tắc thao tác đơn theo VAI TRÒ (thuần, không I/O — dễ kiểm thử).
 *
 * Mô hình sàn trung gian (quyết định D-002, docs/ai-team/DECISIONS.md):
 *   Mới → Đang liên hệ → Đã xác nhận → Đã cọc (giữ phòng) → Đã thanh toán → Hoàn thành
 *   (biểu diễn bằng 2 trục: BookingStatus × PaymentStatus; KHÔNG thêm enum).
 *
 * - SÀN (ADMIN): toàn quyền. Sở hữu Mới/Đang liên hệ/Đã xác nhận và việc GHI NHẬN CỌC.
 * - CHỦ DỊCH VỤ (PROVIDER): ở Mới/Đang liên hệ KHÔNG thao tác được. Chỉ mở khóa sau khi
 *   đơn đã CONFIRMED và đã có cọc (DEPOSITED): được ghi nhận "đã thu đủ" (→PAID),
 *   đánh dấu đã giữ phòng, rồi "hoàn thành" (→COMPLETED). KHÔNG tự xác nhận, KHÔNG hủy.
 * - CTV: không thao tác trạng thái/thanh toán.
 */

export type BookingRole = "ADMIN" | "PROVIDER" | "CTV";

/** Chủ dịch vụ đã được mở khóa thao tác trên đơn chưa (đã xác nhận + đã có cọc). */
export function providerUnlocked(status: BookingStatus, payment: PaymentStatus): boolean {
  return status === "CONFIRMED" && payment !== "UNPAID";
}

/**
 * Chủ dịch vụ có được chuyển TRẠNG THÁI sang `to` không.
 * Chỉ được HOÀN THÀNH đơn đã xác nhận & đã thu đủ. Không xác nhận, không hủy/khôi phục.
 */
export function providerCanSetStatus(
  from: BookingStatus,
  to: BookingStatus,
  payment: PaymentStatus,
): boolean {
  if (from === "CONFIRMED" && to === "COMPLETED") return payment === "PAID";
  return false;
}

/**
 * Chủ dịch vụ có được GHI NHẬN THU TIỀN không.
 * Chỉ sau khi đơn đã xác nhận & đã có cọc (sàn thu cọc trước) — tức là thu nốt phần còn lại.
 * Không được tự ghi nhận khoản cọc đầu tiên (status chưa mở khóa).
 */
export function providerCanPay(status: BookingStatus, payment: PaymentStatus): boolean {
  return providerUnlocked(status, payment);
}

/** Chủ dịch vụ có được bật/tắt cờ "đã giữ chỗ" (heldRoom/heldBus) không. */
export function providerCanToggleHeld(status: BookingStatus, payment: PaymentStatus): boolean {
  return providerUnlocked(status, payment);
}

/**
 * Cổng chung cho SERVER ACTION: với một đơn ở (status, payment), vai trò `role`
 * có được thực hiện thao tác `intent` (kèm `toStatus` khi intent là "status") không.
 * ADMIN: luôn được. CTV: không. PROVIDER: theo các quy tắc trên.
 */
export function canRoleAct(
  role: BookingRole,
  status: BookingStatus,
  payment: PaymentStatus,
  intent: "status" | "pay" | "held",
  toStatus?: BookingStatus,
): boolean {
  if (role === "ADMIN") return true;
  if (role !== "PROVIDER") return false;
  if (intent === "status") return !!toStatus && providerCanSetStatus(status, toStatus, payment);
  if (intent === "pay") return providerCanPay(status, payment);
  if (intent === "held") return providerCanToggleHeld(status, payment);
  return false;
}
