/**
 * Tiện ích ngày "chỉ ngày" (date-only) khớp với cột @db.Date của Postgres.
 * Luôn dùng UTC midnight để tránh lệch ngày do múi giờ.
 */

/** "2026-01-15" -> Date tại 00:00 UTC. */
export function parseDateOnly(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** Date -> "2026-01-15" (theo UTC). */
export function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Hôm nay tại 00:00 UTC. */
export function today(): Date {
  return parseDateOnly(toDateKey(new Date()));
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

/** Số đêm giữa 2 ngày (checkout - checkin). */
export function nightsBetween(checkIn: Date, checkOut: Date): number {
  const ms = checkOut.getTime() - checkIn.getTime();
  return Math.round(ms / 86_400_000);
}

/**
 * Liệt kê các ĐÊM của kỳ lưu trú: [checkIn, checkOut).
 * VD nhận 15, trả 17 -> các đêm 15, 16.
 */
export function enumerateNights(checkIn: Date, checkOut: Date): Date[] {
  const nights: Date[] = [];
  let cur = new Date(checkIn);
  while (cur.getTime() < checkOut.getTime()) {
    nights.push(new Date(cur));
    cur = addDays(cur, 1);
  }
  return nights;
}

/** Liệt kê mọi ngày trong [start, end] (bao gồm cả 2 đầu). */
export function enumerateDays(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  let cur = new Date(start);
  while (cur.getTime() <= end.getTime()) {
    days.push(new Date(cur));
    cur = addDays(cur, 1);
  }
  return days;
}

/** Cuối tuần = thứ 7 (6) hoặc chủ nhật (0). */
export function isWeekend(date: Date): boolean {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

/** Kiểm tra chuỗi "yyyy-mm-dd" hợp lệ. */
export function isValidDateKey(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = parseDateOnly(s);
  return !Number.isNaN(d.getTime()) && toDateKey(d) === s;
}
