import "server-only";
import { unstable_cache } from "next/cache";
import type { LatLng } from "@/lib/checkin-map";

/** Một điểm trên bản đồ: [vĩ độ, kinh độ]. */
export type Pt = [number, number];

const round = (v: number) => Math.round(v * 1e5) / 1e5;

/** Làm tròn 5 số lẻ (~1 m). Giữ nguyên mọi đỉnh của đường: chiều đi và chiều về trùng khít nhau khi vẽ. */
const tidy = (pts: Pt[]): Pt[] => pts.map(([a, b]) => [round(a), round(b)] as Pt).filter((p, i, arr) => i === 0 || p[0] !== arr[i - 1][0] || p[1] !== arr[i - 1][1]);

/**
 * Đường XE CHẠY THẬT qua lần lượt các điểm (dữ liệu đường OpenStreetMap, máy chủ định tuyến OSRM công cộng).
 * Trả về hình dạng từng chặng. Kết quả lưu đệm 30 ngày theo đúng chuỗi toạ độ ⇒ chỉ gọi ra ngoài khi
 * admin đổi lịch trình / toạ độ điểm. Gọi lỗi thì KHÔNG lưu đệm (lần sau thử lại).
 */
const fetchLegs = unstable_cache(
  async (key: string): Promise<Pt[][]> => {
    const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${key}?overview=false&steps=true&geometries=geojson`, {
      signal: AbortSignal.timeout(7000),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`OSRM ${res.status}`);
    const j = (await res.json()) as { code: string; routes?: { legs: { steps: { geometry: { coordinates: [number, number][] } }[] }[] }[] };
    if (j.code !== "Ok" || !j.routes?.[0]) throw new Error(`OSRM ${j.code}`);
    return j.routes[0].legs.map((leg) => tidy(leg.steps.flatMap((s) => s.geometry.coordinates.map(([lng, lat]) => [lat, lng] as Pt))));
  },
  ["road-path-v2"],
  { revalidate: 60 * 60 * 24 * 30 },
);

/**
 * Cung đường nối các điểm theo thứ tự, bám đường xe thật. Điểm nằm ngoài đường (hồ, mỏm đá…) được nối
 * thẳng từ chỗ gần đường nhất. Không lấy được đường (mất mạng, máy chủ bận) ⇒ nối thẳng các điểm.
 */
export async function roadPath(points: LatLng[]): Promise<Pt[]> {
  const pts = points.filter((p, i) => i === 0 || p.lat !== points[i - 1].lat || p.lng !== points[i - 1].lng);
  if (pts.length < 2) return pts.map((p) => [p.lat, p.lng]);
  let legs: Pt[][];
  try {
    legs = await fetchLegs(pts.map((p) => `${p.lng.toFixed(5)},${p.lat.toFixed(5)}`).join(";"));
  } catch {
    legs = pts.slice(1).map(() => []);
  }
  const out: Pt[] = [];
  const push = (p: Pt) => { const q = out[out.length - 1]; if (!q || q[0] !== p[0] || q[1] !== p[1]) out.push(p); };
  pts.forEach((p, i) => {
    push([round(p.lat), round(p.lng)]);
    for (const q of legs[i] ?? []) push(q);
  });
  return out;
}
