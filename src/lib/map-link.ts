/**
 * Lấy toạ độ (vĩ độ, kinh độ) của một địa điểm từ link Google Maps — kể cả link rút gọn
 * (maps.app.goo.gl, share.google, goo.gl/maps). Chạy phía server khi admin lưu địa điểm.
 *
 * Cách làm: đi theo chuyển hướng tới URL cuối rồi
 *  1) đọc toạ độ ngay trên URL nếu có (…!3d21.26!4d104.53…, ?q=21.2,104.5, @21.2,104.5);
 *  2) không có (link chia sẻ từ điện thoại chỉ mang TÊN địa điểm) ⇒ lấy tên trong tham số q rồi hỏi
 *     trang nhúng của Google Maps để ra toạ độ của tên đó.
 * Không lấy được ⇒ null (admin nhập tay toạ độ trong form).
 */

export interface LatLng {
  lat: number;
  lng: number;
}

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

/** Chỉ nhận toạ độ quanh vùng Tây Bắc (Tà Xùa và lân cận) — tránh bắt nhầm số khác / địa điểm trùng tên ở tỉnh khác. */
function valid(lat: number, lng: number): LatLng | null {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat > 20.3 && lat < 22.6 && lng > 103.3 && lng < 105.6
    ? { lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6 }
    : null;
}

/** "21.2652, 104.5386" (admin dán từ Google Maps) → toạ độ; sai định dạng / ngoài vùng ⇒ null. */
export function parseLatLng(text: string | null | undefined): LatLng | null {
  const m = (text ?? "").trim().match(/^\(?\s*(-?\d{1,2}(?:[.,]\d+)?)\s*[,;\s]\s*(-?\d{2,3}(?:[.,]\d+)?)\s*\)?$/);
  return m ? valid(parseFloat(m[1].replace(",", ".")), parseFloat(m[2].replace(",", "."))) : null;
}

/** Dò toạ độ trên một URL đã giải mã. Ưu tiên toạ độ CỦA ĐỊA ĐIỂM (!3d…!4d…) hơn tâm khung nhìn (@…). */
export function latLngFromUrl(url: string): LatLng | null {
  const pats: RegExp[] = [
    /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,
    /[?&](?:q|query|ll|destination|daddr|center)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/i,
    /\/(?:place|search|dir)\/(-?\d+\.\d+),\s*(-?\d+\.\d+)/,
    /@(-?\d+\.\d+),(-?\d+\.\d+)/,
  ];
  for (const re of pats) {
    const m = url.match(re);
    const hit = m ? valid(parseFloat(m[1]), parseFloat(m[2])) : null;
    if (hit) return hit;
  }
  return null;
}

async function get(url: string): Promise<Response | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12_000);
  try {
    return await fetch(url, { redirect: "follow", signal: ctrl.signal, headers: { "User-Agent": UA, "Accept-Language": "vi,en;q=0.8" }, cache: "no-store" });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Toạ độ của một TÊN địa điểm, theo trang nhúng của Google Maps (dữ liệu trang chứa [vĩ độ×1e7, kinh độ×1e7]). */
export async function geocodeByName(name: string): Promise<LatLng | null> {
  const q = name.trim();
  if (!q) return null;
  const res = await get(`https://maps.google.com/maps?q=${encodeURIComponent(q)}&hl=vi&output=embed`);
  if (!res || !res.ok) return null;
  const html = (await res.text()).slice(0, 400_000);
  for (const m of html.matchAll(/\[(\d{9}),(\d{10})\]/g)) {
    const hit = valid(Number(m[1]) / 1e7, Number(m[2]) / 1e7);
    if (hit) return hit;
  }
  return null;
}

function safeDecode(s: string): string {
  try { return decodeURIComponent(s.replace(/\+/g, " ")); } catch { return s; }
}

export async function resolveMapLatLng(url: string | null | undefined): Promise<LatLng | null> {
  const raw = (url ?? "").trim();
  if (!/^https?:\/\//i.test(raw)) return null;
  const quick = latLngFromUrl(safeDecode(raw));
  if (quick) return quick;
  const res = await get(raw);
  if (!res) return null;
  const finalUrl = res.url;
  const fromUrl = latLngFromUrl(safeDecode(finalUrl));
  if (fromUrl) return fromUrl;
  // Link chỉ mang tên địa điểm: /maps/place/<tên>/…, hoặc ?q=<tên> (maps.google.com, google.com/search).
  let name = "";
  try {
    const u = new URL(finalUrl);
    name = u.searchParams.get("q") ?? "";
    if (!name) { const m = u.pathname.match(/\/maps\/place\/([^/]+)/); if (m) name = safeDecode(m[1]); }
  } catch { /* URL lạ → bỏ qua */ }
  return name ? geocodeByName(name) : null;
}
