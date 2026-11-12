/**
 * Cấu hình "tự huỷ đơn chưa thanh toán" — module thuần (dùng được ở cả server lẫn client).
 * Số giờ lưu trong SiteSetting (key AUTO_CANCEL_HOURS_KEY), sửa ở trang /admin/bookings.
 */
export const AUTO_CANCEL_HOURS_KEY = "autoCancelHours";
export const DEFAULT_AUTO_CANCEL_HOURS = 6;
export const MAX_AUTO_CANCEL_HOURS = 168; // 7 ngày

/** Giá trị lưu → số giờ hợp lệ. 0 = TẮT tự huỷ theo thời gian. Thiếu/sai ⇒ mặc định 6 giờ. */
export function parseAutoCancelHours(raw: string | null | undefined): number {
  if (raw == null || raw.trim() === "") return DEFAULT_AUTO_CANCEL_HOURS;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return DEFAULT_AUTO_CANCEL_HOURS;
  return Math.min(MAX_AUTO_CANCEL_HOURS, Math.round(n * 2) / 2); // cho phép nửa giờ (vd 1,5)
}

/** "6" / "1,5" — số giờ dạng chữ tiếng Việt. */
export function hoursLabel(hours: number): string {
  return String(hours).replace(".", ",");
}
