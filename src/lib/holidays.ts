/**
 * LỊCH NGÀY LỄ — file thuần (dùng được ở client).
 *
 * Admin khai ở /admin/popup → SiteSetting `holidays` (JSON `Holiday[]`). Một ĐÊM lưu trú (khoá yyyy-mm-dd
 * = ngày nhận phòng của đêm đó) rơi vào khoảng [from, to] ⇒ phòng có `Room.holidayPrice` tính giá lễ
 * cho đêm đó (xem `priceForDay` trong availability.ts). `yearly` = lặp lại mỗi năm (chỉ so ngày/tháng —
 * dùng cho lễ dương lịch 1/1, 30/4, 2/9; lễ âm lịch như Tết, Giỗ Tổ đổi ngày mỗi năm ⇒ khai riêng từng năm).
 */
export interface Holiday {
  name: string;
  /** yyyy-mm-dd (gồm cả ngày này). */
  from: string;
  /** yyyy-mm-dd (gồm cả ngày này), ≥ from. */
  to: string;
  yearly: boolean;
}

export const HOLIDAYS_KEY = "holidays";

const KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Chuẩn hoá danh sách (bỏ dòng hỏng, đảo from/to nếu ngược, sắp theo ngày bắt đầu). */
export function normalizeHolidays(input: unknown): Holiday[] {
  if (!Array.isArray(input)) return [];
  const out: Holiday[] = [];
  for (const x of input) {
    if (!x || typeof x !== "object") continue;
    const o = x as Record<string, unknown>;
    let from = String(o.from ?? "").trim();
    let to = String(o.to ?? "").trim() || from;
    if (!KEY_RE.test(from) || !KEY_RE.test(to)) continue;
    const yearly = o.yearly === true;
    // Lặp hằng năm: khoảng có thể vắt qua năm mới (vd 31/12 → 01/01) ⇒ giữ nguyên thứ tự ngày/tháng.
    if (!yearly && to < from) [from, to] = [to, from];
    out.push({ name: String(o.name ?? "").trim().slice(0, 80) || "Ngày lễ", from, to, yearly });
  }
  return out.sort((a, b) => (a.yearly === b.yearly ? a.from.localeCompare(b.from) : a.yearly ? -1 : 1));
}

export function parseHolidays(raw: string | null | undefined): Holiday[] {
  if (!raw) return [];
  try {
    return normalizeHolidays(JSON.parse(raw));
  } catch {
    return [];
  }
}

function matches(h: Holiday, key: string): boolean {
  if (!h.yearly) return key >= h.from && key <= h.to;
  const md = key.slice(5);
  const a = h.from.slice(5);
  const b = h.to.slice(5);
  return a <= b ? md >= a && md <= b : md >= a || md <= b; // vắt qua năm mới
}

/** Ngày lễ (nếu có) chứa ngày `key` (yyyy-mm-dd). */
export function holidayOf(list: readonly Holiday[] | null | undefined, key: string): Holiday | null {
  if (!list?.length) return null;
  for (const h of list) if (matches(h, key)) return h;
  return null;
}

export function isHolidayKey(list: readonly Holiday[] | null | undefined, key: string): boolean {
  return holidayOf(list, key) != null;
}

/** Mọi ngày lễ trong khoảng [fromKey, toKey] (gồm 2 đầu) — gửi xuống client để tô lịch / tính giá. */
export function holidayKeysBetween(list: readonly Holiday[] | null | undefined, fromKey: string, toKey: string): string[] {
  if (!list?.length || !KEY_RE.test(fromKey) || !KEY_RE.test(toKey) || toKey < fromKey) return [];
  const out: string[] = [];
  const end = Date.parse(`${toKey}T00:00:00Z`);
  for (let t = Date.parse(`${fromKey}T00:00:00Z`), i = 0; t <= end && i < 800; t += 86400000, i++) {
    const k = new Date(t).toISOString().slice(0, 10);
    if (isHolidayKey(list, k)) out.push(k);
  }
  return out;
}
