/**
 * ĐỊNH DẠNG NGÀY CHUẨN CỦA TOÀN HỆ THỐNG: dd/mm/yyyy (vd 05/12/2026).
 * File thuần (không server-only, không phụ thuộc Prisma) — dùng được ở cả server lẫn client.
 * Nhận key "yyyy-mm-dd" hoặc Date của cột @db.Date (đọc theo UTC như src/lib/dates.ts).
 * Chỉ ô lịch/lưới theo ngày (chỉ đủ chỗ cho số ngày) mới được hiện rút gọn.
 */
export const WD_SHORT = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"] as const;

function keyOf(v: string | Date): string {
  return typeof v === "string" ? v.slice(0, 10) : v.toISOString().slice(0, 10);
}

/** "2026-12-05" | Date → "05/12/2026". Chuỗi không phải ngày → trả nguyên. */
export function dmy(v: string | Date | null | undefined): string {
  if (!v) return "";
  const k = keyOf(v);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) return String(v);
  return `${k.slice(8, 10)}/${k.slice(5, 7)}/${k.slice(0, 4)}`;
}

/** Thứ viết tắt của ngày: "T7", "CN". */
export function wdShort(v: string | Date): string {
  const k = keyOf(v);
  const d = new Date(Date.UTC(+k.slice(0, 4), +k.slice(5, 7) - 1, +k.slice(8, 10)));
  return WD_SHORT[d.getUTCDay()] ?? "";
}

/** Kèm thứ: "T7, 05/12/2026". */
export function wdDmy(v: string | Date | null | undefined): string {
  if (!v) return "";
  const k = keyOf(v);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) return String(v);
  return `${wdShort(k)}, ${dmy(k)}`;
}

const VN_DT = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Ho_Chi_Minh",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** Mốc thời gian (createdAt…) theo giờ Việt Nam: "14:05 05/12/2026". */
export function vnDateTime(v: Date | string): string {
  const parts = Object.fromEntries(VN_DT.formatToParts(typeof v === "string" ? new Date(v) : v).map((p) => [p.type, p.value]));
  return `${parts.hour}:${parts.minute} ${parts.day}/${parts.month}/${parts.year}`;
}
