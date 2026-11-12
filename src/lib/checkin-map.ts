/**
 * Bố cục bản đồ check-in (/ban-do) theo TOẠ ĐỘ THẬT (vĩ độ/kinh độ lấy từ link Google Maps của từng
 * điểm — xem src/lib/map-link.ts). Bản đồ hoạt hình 3D chiếu các điểm lên mặt phẳng 100×100:
 * hướng (đông/tây/nam/bắc so với trung tâm) giữ đúng; khoảng cách được NÉN (luỹ thừa 0,6) để cụm điểm
 * gần trung tâm không dính vào nhau khi có điểm ở xa 15–20 km. Vị trí chính xác xem ở tab Vệ tinh.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

/** Mốc 0: trung tâm xã Tà Xùa (UBND xã) và cửa ngõ Bắc Yên — toạ độ theo Google Maps. */
export const MAP_CENTER: LatLng = { lat: 21.275413, lng: 104.434299 };
export const MAP_GATE: LatLng = { lat: 21.247864, lng: 104.442468 }; // bến xe Bắc Yên

const YS = 0.8; // mặt bản đồ tỉ lệ 1.25 ⇒ 1 đơn vị dọc (%) = 0.8 đơn vị ngang
const POWER = 0.6; // nén khoảng cách: r → r^0.6
// Vùng đặt điểm trên mặt phẳng (%, chừa lề cho nhãn đứng)
const BOX = { x0: 12, x1: 88, y0: 18, y1: 90 };

/** Khoảng cách đường chim bay (km). */
export function distanceKm(a: LatLng, b: LatLng): number {
  const dx = (b.lng - a.lng) * Math.cos((a.lat * Math.PI) / 180) * 111.32;
  const dy = (b.lat - a.lat) * 110.57;
  return Math.hypot(dx, dy);
}

/**
 * Chiếu danh sách điểm (có toạ độ) lên mặt phẳng bản đồ. Trả về id → [x%, y%].
 * Luôn tính cả tâm (MAP_CENTER) để phép co giãn ổn định dù ít điểm.
 */
export function projectSpots(points: { id: string; lat: number; lng: number }[]): Map<string, [number, number]> {
  const out = new Map<string, [number, number]>();
  if (points.length === 0) return out;
  const raw = points.map((p) => {
    const dx = (p.lng - MAP_CENTER.lng) * Math.cos((MAP_CENTER.lat * Math.PI) / 180) * 111.32; // km về phía đông
    const dy = (p.lat - MAP_CENTER.lat) * 110.57; // km về phía bắc
    const r = Math.hypot(dx, dy);
    const k = r > 0 ? Math.pow(r, POWER) / r : 0;
    return { id: p.id, x: dx * k, y: -dy * k }; // y hướng xuống (bắc ở trên)
  });
  const xs = [0, ...raw.map((p) => p.x)], ys = [0, ...raw.map((p) => p.y)];
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const w = BOX.x1 - BOX.x0, h = (BOX.y1 - BOX.y0) * YS; // cùng đơn vị ngang
  const s = Math.min(w / Math.max(0.001, maxX - minX), h / Math.max(0.001, maxY - minY));
  const offX = BOX.x0 + (w - (maxX - minX) * s) / 2, offY = BOX.y0 * YS + (h - (maxY - minY) * s) / 2;
  for (const p of raw) {
    out.set(p.id, [Math.round((offX + (p.x - minX) * s) * 10) / 10, Math.round(((offY + (p.y - minY) * s) / YS) * 10) / 10]);
  }
  return out;
}
