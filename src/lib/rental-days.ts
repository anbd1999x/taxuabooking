/**
 * Số NGÀY TÍNH TIỀN khi thuê xe máy theo GIỜ NHẬN / GIỜ TRẢ (file thuần, dùng được ở client).
 *
 * Quy tắc (mốc 24 giờ kể từ giờ nhận xe):
 *  - Trả trong vòng 24 giờ                    ⇒ 1 ngày (tối thiểu).
 *  - Lố thêm tới 6 giờ sau mỗi mốc 24 giờ     ⇒ + 0,5 ngày.
 *  - Lố hơn 6 giờ                              ⇒ + 1 ngày.
 * Ví dụ nhận 06:00: trả 06:00 hôm sau = 1 ngày; trả 07:00–12:00 hôm sau = 1,5 ngày; trả 13:00 trở đi = 2 ngày.
 *
 * Không có giờ (đơn cũ, đơn admin tạo hộ) ⇒ cách tính cũ: đếm cả ngày nhận lẫn ngày trả.
 */

/** Các mốc giờ cho khách chọn (05:00 → 22:00, cách nhau 1 giờ). */
export const RENTAL_HOURS: string[] = Array.from({ length: 18 }, (_, i) => `${String(i + 5).padStart(2, "0")}:00`);
export const RENTAL_DEFAULT_HOUR = "06:00";

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
export function isRentalTime(v: unknown): v is string {
  return typeof v === "string" && TIME_RE.test(v);
}

function minutesOf(t: string): number {
  const m = TIME_RE.exec(t)!;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** Số ngày lịch giữa 2 khoá yyyy-mm-dd (to − from). */
function dayDiff(fromKey: string, toKey: string): number {
  return Math.round((Date.parse(`${toKey}T00:00:00Z`) - Date.parse(`${fromKey}T00:00:00Z`)) / 86_400_000);
}

/**
 * Số ngày tính tiền. `toKey` trống = trả trong ngày nhận.
 * Trả về `null` khi giờ trả không sau giờ nhận (cùng ngày mà giờ trả ≤ giờ nhận) — dữ liệu không hợp lệ.
 */
export function rentalChargeDays(
  fromKey: string,
  toKey: string | null | undefined,
  pickupTime?: string | null,
  returnTime?: string | null,
): number | null {
  const diff = toKey ? dayDiff(fromKey, toKey) : 0;
  if (diff < 0) return null;
  if (!isRentalTime(pickupTime) || !isRentalTime(returnTime)) return diff + 1; // cách cũ: tính cả ngày nhận & ngày trả
  return rentalChargeDaysBySpan(diff, pickupTime, returnTime);
}

/**
 * Như trên nhưng nhận thẳng SỐ NGÀY LỊCH giữa ngày nhận và ngày trả (0 = trả trong ngày) — dùng cho xe máy
 * thuê kèm combo (nhận ngày check-in, trả ngày check-out). `null` khi giờ trả không sau giờ nhận.
 */
export function rentalChargeDaysBySpan(dayGap: number, pickupTime: string, returnTime: string): number | null {
  const minutes = dayGap * 1440 + minutesOf(returnTime) - minutesOf(pickupTime);
  if (minutes <= 0) return null;
  if (minutes <= 1440) return 1;
  const full = Math.floor(minutes / 1440);
  const rem = minutes - full * 1440;
  return full + (rem === 0 ? 0 : rem <= 360 ? 0.5 : 1);
}

/** "1 ngày", "1,5 ngày", "2 ngày". */
export function rentalDaysLabel(days: number): string {
  return `${Number.isInteger(days) ? days : String(days).replace(".", ",")} ngày`;
}

/** Số ngày thuê của một đơn: ưu tiên `rentalDays` (đơn có giờ nhận/trả), không có thì `nights` (đơn cũ). */
export function bookingRentalDays(b: { rentalDays?: unknown; nights: number | null }): number {
  const d = b.rentalDays == null ? NaN : Number(b.rentalDays);
  return Number.isFinite(d) && d > 0 ? d : (b.nights ?? 1);
}

/**
 * TIỀN GỐC (giá gạch) của một đơn thuê xe máy = giá gốc/ngày cấu hình ở admin (Service.originalPrice) × số xe ×
 * số ngày tính tiền. `null` khi không phải đơn xe máy, chưa cấu hình giá gốc, hoặc giá gốc không cao hơn tiền bán.
 */
export function rentalOriginalTotal(
  b: { category: string; quantity: number; nights: number | null; rentalDays?: unknown; referencePrice: unknown },
  originalPerDay: unknown,
): number | null {
  if (b.category !== "MOTORBIKE") return null;
  const per = originalPerDay == null ? NaN : Number(originalPerDay);
  if (!Number.isFinite(per) || per <= 0) return null;
  const total = Math.round(per * Math.max(1, b.quantity) * bookingRentalDays(b));
  const gross = b.referencePrice == null ? 0 : Number(b.referencePrice);
  return total > gross ? total : null;
}
