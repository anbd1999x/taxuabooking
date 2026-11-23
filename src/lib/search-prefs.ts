/**
 * NHỚ NGÀY & SỐ KHÁCH khách đã tìm (cookie `tx_search` = "from|to|people") để sang trang khác
 * (xe cabin, homestay, combo, thuê xe máy, trang chi tiết…) tự điền sẵn.
 *  - Ghi: `SearchPrefsSaver` (layout trang khách) mỗi khi URL có ?from=&to= / ?people= / ?pax= / ?adults=,
 *    và các form đặt chọn ngày ngay trong trang (gọi `saveSearchPrefs`).
 *  - Đọc: server (`search-prefs-server.ts` → `withSearchPrefs`) điền vào searchParams khi URL CHƯA có
 *    ngày / số khách ⇒ kết quả, giá và ô nhập khớp ngay; trang chủ đọc ở client (`readSearchPrefs`).
 * File thuần (dùng được ở cả client lẫn server).
 */

export const SEARCH_COOKIE = "tx_search";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 ngày

export interface SearchPrefs {
  from?: string;
  to?: string;
  people?: number;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Hôm nay theo giờ Việt Nam (yyyy-mm-dd). */
export function vnTodayKey(): string {
  return new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);
}

/** Đọc + kiểm tra: ngày đã qua thì bỏ (cả cặp), ngày về phải sau ngày đi, số khách 1–30. */
export function parsePrefs(raw: string | null | undefined, todayKey = vnTodayKey()): SearchPrefs {
  if (!raw) return {};
  const [f, t, p] = decodeURIComponent(raw).split("|");
  const out: SearchPrefs = {};
  if (f && DATE_RE.test(f) && f >= todayKey) {
    out.from = f;
    if (t && DATE_RE.test(t) && t > f) out.to = t;
  }
  const n = Math.floor(Number(p));
  if (Number.isFinite(n) && n >= 1 && n <= 30) out.people = n;
  return out;
}

export function serializePrefs(p: SearchPrefs): string {
  return encodeURIComponent(`${p.from ?? ""}|${p.to ?? ""}|${p.people ?? ""}`);
}

/** Client: đọc cookie. */
export function readSearchPrefs(): SearchPrefs {
  if (typeof document === "undefined") return {};
  const m = document.cookie.match(new RegExp(`(?:^|; )${SEARCH_COOKIE}=([^;]*)`));
  return parsePrefs(m?.[1]);
}

/**
 * Client: gộp vào cookie. Đổi ngày đi mà không gửi ngày về ⇒ bỏ ngày về cũ nếu không còn hợp lệ.
 * Bỏ qua giá trị rỗng / sai định dạng (giữ giá trị đã lưu).
 */
export function saveSearchPrefs(next: SearchPrefs) {
  if (typeof document === "undefined") return;
  const cur = readSearchPrefs();
  const merged: SearchPrefs = { ...cur };
  if (next.from && DATE_RE.test(next.from)) {
    merged.from = next.from;
    if (!next.to && merged.to && merged.to <= next.from) delete merged.to;
  }
  if (next.to && DATE_RE.test(next.to)) merged.to = next.to;
  if (next.people && next.people >= 1 && next.people <= 30) merged.people = Math.floor(next.people);
  const clean = parsePrefs(serializePrefs(merged));
  if (clean.from === cur.from && clean.to === cur.to && clean.people === cur.people) return;
  document.cookie = `${SEARCH_COOKIE}=${serializePrefs(clean)}; path=/; max-age=${MAX_AGE}; samesite=lax`;
}

type SP = Record<string, string | string[] | undefined>;

/**
 * Điền ngày / số khách đã nhớ vào searchParams khi URL CHƯA có:
 *  - ngày: chỉ khi URL không có cả `from` lẫn `to` (khách tự chọn ngày trên URL thì giữ nguyên);
 *  - số khách: vào tham số `peopleKey` của trang (combo/homestay = "people", xe cabin = "pax",
 *    chi tiết homestay = "adults"); null = trang không dùng số khách (VD thuê xe máy: số XE).
 */
export function applySearchPrefs(sp: SP, prefs: SearchPrefs, peopleKey: string | null): SP {
  const out: SP = { ...sp };
  if (!sp.from && !sp.to && prefs.from) {
    out.from = prefs.from;
    if (prefs.to) out.to = prefs.to;
  }
  if (peopleKey && !sp[peopleKey] && prefs.people) out[peopleKey] = String(prefs.people);
  return out;
}

/** Client: URL hiện tại có ?from= / ?to= (khách vừa bấm tìm) — phân biệt với ngày lấy từ trí nhớ. */
export function urlHasDates(): boolean {
  if (typeof window === "undefined") return false;
  const q = new URLSearchParams(window.location.search);
  return Boolean(q.get("from") || q.get("to"));
}
