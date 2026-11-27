import "server-only";
import { prisma } from "./prisma";
import { MAP_CENTER } from "./checkin-map";

/**
 * QUÃNG ĐƯỜNG XE CHẠY THẬT từ homestay tới các điểm xung quanh (popup "Xung quanh có gì?").
 * Dùng dịch vụ dẫn đường miễn phí trên dữ liệu OpenStreetMap:
 *  - Valhalla (máy chủ công cộng FOSSGIS, chế độ XE MÁY — thời gian sát đường núi hơn),
 *  - dự phòng OSRM (máy chủ demo, chế độ ô tô).
 * Kết quả lưu ở bảng RoadDistance (khoá home × điểm, kèm chữ ký toạ độ): mỗi cặp chỉ gọi dịch vụ ngoài MỘT lần,
 * đổi toạ độ home / điểm thì tự tính lại. Lỗi mạng ⇒ bỏ qua (giao diện quay về ước tính).
 */

export interface Pt {
  id: string;
  lat: number;
  lng: number;
}
export interface Road {
  km: number;
  min: number;
}

const UA = "taxuabooking-nearby/1.0 (+https://taxuabooking.com)";
const VALHALLA = "https://valhalla1.openstreetmap.de";
const OSRM = "https://router.project-osrm.org";
const sigOf = (a: Pt, b: Pt) => `${a.lat},${a.lng}>${b.lat},${b.lng}`;

async function getJson(url: string, init?: RequestInit): Promise<unknown | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12_000);
  try {
    const r = await fetch(url, { ...init, signal: ctrl.signal, headers: { "User-Agent": UA, "content-type": "application/json", ...(init?.headers ?? {}) }, cache: "no-store" });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Ma trận 1 → nhiều điểm. Trả về theo thứ tự `to` (null = không tính được). */
async function matrix(from: Pt, to: Pt[]): Promise<{ rows: (Road | null)[]; source: string }> {
  // Valhalla xe máy
  const v = (await getJson(`${VALHALLA}/sources_to_targets`, {
    method: "POST",
    body: JSON.stringify({ sources: [{ lat: from.lat, lon: from.lng }], targets: to.map((p) => ({ lat: p.lat, lon: p.lng })), costing: "motorcycle", units: "kilometers" }),
  })) as { sources_to_targets?: { distance: number | null; time: number | null }[][] } | null;
  const vr = v?.sources_to_targets?.[0];
  if (vr && vr.length === to.length) {
    return { rows: vr.map((c) => (c.distance != null && c.time != null ? { km: c.distance, min: Math.max(1, Math.round(c.time / 60)) } : null)), source: "valhalla" };
  }
  // OSRM (ô tô) — dự phòng
  const coords = [from, ...to].map((p) => `${p.lng},${p.lat}`).join(";");
  const o = (await getJson(`${OSRM}/table/v1/driving/${coords}?sources=0&annotations=distance,duration`)) as { code?: string; distances?: (number | null)[][]; durations?: (number | null)[][] } | null;
  if (o?.code === "Ok" && o.distances && o.durations) {
    return {
      rows: to.map((_, i) => {
        const d = o.distances![0][i + 1];
        const t = o.durations![0][i + 1];
        // OSRM tính tốc độ ô tô đường bằng ⇒ nhân 1,5 cho xe máy đường núi.
        return d != null && t != null ? { km: Math.round(d) / 1000, min: Math.max(1, Math.round((t / 60) * 1.5)) } : null;
      }),
      source: "osrm",
    };
  }
  return { rows: to.map(() => null), source: "" };
}

/** Quãng đường xe chạy từ `home` tới từng điểm (đọc cache, thiếu thì gọi dịch vụ). */
export async function roadDistances(home: Pt, places: Pt[]): Promise<Record<string, Road>> {
  const out: Record<string, Road> = {};
  if (!places.length) return out;
  const cached = await prisma.roadDistance.findMany({ where: { serviceId: home.id, placeId: { in: places.map((p) => p.id) } } });
  const byId = new Map(cached.map((c) => [c.placeId, c]));
  const missing: Pt[] = [];
  for (const p of places) {
    const c = byId.get(p.id);
    if (c && c.sig === sigOf(home, p)) out[p.id] = { km: c.km, min: c.minutes };
    else missing.push(p);
  }
  // Máy chủ công cộng: chia mẻ 40 điểm / lần.
  for (let i = 0; i < missing.length; i += 40) {
    const chunk = missing.slice(i, i + 40);
    const { rows, source } = await matrix(home, chunk);
    if (!source) break; // dịch vụ đang lỗi ⇒ để lần sau
    // Ghi cả mẻ trong MỘT transaction (một kết nối DB) — không bắn hàng chục lệnh song song làm cạn kết nối.
    const ops = chunk.flatMap((p, j) => {
      const r = rows[j];
      if (!r) return [];
      out[p.id] = r;
      const data = { sig: sigOf(home, p), km: r.km, minutes: r.min, source, shape: null };
      return [prisma.roadDistance.upsert({ where: { serviceId_placeId: { serviceId: home.id, placeId: p.id } }, create: { serviceId: home.id, placeId: p.id, ...data }, update: data })];
    });
    if (ops.length) await prisma.$transaction(ops);
  }
  return out;
}

/** Giải mã polyline (Valhalla dùng độ chính xác 6). */
function decodePolyline(str: string, precision = 6): [number, number][] {
  const f = 10 ** precision;
  const pts: [number, number][] = [];
  let i = 0, lat = 0, lng = 0;
  while (i < str.length) {
    for (const k of [0, 1]) {
      let shift = 0, result = 0, b: number;
      do {
        b = str.charCodeAt(i++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const d = result & 1 ? ~(result >> 1) : result >> 1;
      if (k === 0) lat += d;
      else lng += d;
    }
    pts.push([lat / f, lng / f]);
  }
  return pts;
}

/** Đường đi (danh sách toạ độ) từ home tới một điểm — để vẽ trên bản đồ theo đúng cung đường. */
export async function roadRoute(home: Pt, place: Pt): Promise<(Road & { path: [number, number][] }) | null> {
  const sig = sigOf(home, place);
  const c = await prisma.roadDistance.findUnique({ where: { serviceId_placeId: { serviceId: home.id, placeId: place.id } } });
  if (c && c.sig === sig && c.shape) {
    try {
      return { km: c.km, min: c.minutes, path: JSON.parse(c.shape) };
    } catch {
      /* hỏng ⇒ tính lại */
    }
  }
  let res: (Road & { path: [number, number][] }) | null = null;
  let source = "valhalla";
  const v = (await getJson(`${VALHALLA}/route`, {
    method: "POST",
    body: JSON.stringify({ locations: [{ lat: home.lat, lon: home.lng }, { lat: place.lat, lon: place.lng }], costing: "motorcycle", units: "kilometers", directions_type: "none" }),
  })) as { trip?: { summary?: { length: number; time: number }; legs?: { shape: string }[] } } | null;
  if (v?.trip?.summary && v.trip.legs?.[0]?.shape) {
    res = { km: v.trip.summary.length, min: Math.max(1, Math.round(v.trip.summary.time / 60)), path: decodePolyline(v.trip.legs[0].shape, 6) };
  } else {
    source = "osrm";
    const o = (await getJson(`${OSRM}/route/v1/driving/${home.lng},${home.lat};${place.lng},${place.lat}?overview=full&geometries=geojson`)) as {
      code?: string;
      routes?: { distance: number; duration: number; geometry: { coordinates: [number, number][] } }[];
    } | null;
    const r = o?.code === "Ok" ? o.routes?.[0] : undefined;
    if (r) res = { km: Math.round(r.distance) / 1000, min: Math.max(1, Math.round((r.duration / 60) * 1.5)), path: r.geometry.coordinates.map(([x, y]) => [y, x]) };
  }
  if (!res) return null;
  // Rút gọn còn ≤ 600 điểm trước khi lưu.
  const step = Math.ceil(res.path.length / 600);
  const path = step > 1 ? res.path.filter((_, i) => i % step === 0 || i === res!.path.length - 1) : res.path;
  const data = { sig, km: res.km, minutes: res.min, source, shape: JSON.stringify(path.map(([a, b]) => [Math.round(a * 1e5) / 1e5, Math.round(b * 1e5) / 1e5])) };
  await prisma.roadDistance.upsert({ where: { serviceId_placeId: { serviceId: home.id, placeId: place.id } }, create: { serviceId: home.id, placeId: place.id, ...data }, update: data });
  return { km: res.km, min: res.min, path };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let warming = false;

/**
 * TÍNH SẴN quãng đường cho popup "Xung quanh có gì?" để khách mở lần đầu vẫn nhanh (chỉ đọc DB):
 *  1) ma trận quãng đường của MỌI homestay đang hiện tới mọi điểm đến (1 lần gọi / home, chỉ cặp còn thiếu / đổi toạ độ);
 *  2) tối đa `routes` đường đi chi tiết (để vẽ) còn thiếu — gọi cách nhau ~1,1 giây (tôn trọng máy chủ công cộng).
 * Chạy định kỳ trong instrumentation (production) và bằng script `scripts/warm-road-cache.ts`.
 */
export async function warmRoadCache(opts: { routes?: number; log?: (s: string) => void } = {}): Promise<{ matrices: number; routes: number }> {
  if (warming) return { matrices: 0, routes: 0 };
  warming = true;
  try {
    const { nearbyTargets } = await import("./nearby");
    const homes = await prisma.service.findMany({
      where: { published: true, category: { in: ["HOMESTAY", "BUNGALOW"] }, lat: { not: null }, lng: { not: null } },
      select: { id: true, lat: true, lng: true },
    });
    const targets = await nearbyTargets();
    let matrices = 0;
    for (const h of homes) {
      const home = { id: h.id, lat: h.lat!, lng: h.lng! };
      const tg = targets.filter((t) => t.id !== h.id);
      const have = await prisma.roadDistance.count({ where: { serviceId: h.id, placeId: { in: tg.map((t) => t.id) } } });
      if (have >= tg.length) {
        // đủ số dòng — vẫn có thể lệch chữ ký (đổi toạ độ); roadDistances tự bỏ qua dòng đúng.
        const fresh = await roadDistances(home, tg);
        if (Object.keys(fresh).length >= tg.length) continue;
      } else await roadDistances(home, tg);
      matrices++;
      await sleep(1100);
    }
    let routes = 0;
    const limit = opts.routes ?? 0;
    if (limit > 0) {
      const hMap = new Map(homes.map((h) => [h.id, { id: h.id, lat: h.lat!, lng: h.lng! }]));
      const tMap = new Map(targets.map((t) => [t.id, t]));
      const rows = await prisma.roadDistance.findMany({ where: { shape: null }, select: { serviceId: true, placeId: true }, orderBy: { km: "asc" }, take: limit * 3 });
      for (const r of rows) {
        if (routes >= limit) break;
        const a = hMap.get(r.serviceId);
        const b = tMap.get(r.placeId);
        if (!a || !b) continue;
        const ok = await roadRoute(a, b).catch(() => null);
        if (ok) routes++;
        await sleep(1100);
      }
    }
    matrices += await warmCheckinRoads(opts.log).catch(() => 0);
    opts.log?.(`[road-cache] ma trận ${matrices} home · đường đi ${routes}`);
    return { matrices, routes };
  } finally {
    warming = false;
  }
}

/**
 * CHỈ ĐỌC cache (không gọi dịch vụ ngoài): quãng đường đã tính từ `from` tới các điểm `to`, bỏ dòng lệch toạ độ.
 * Dùng khi dựng trang: trang không chờ máy chủ dẫn đường công cộng.
 */
export async function cachedRoads(from: Pt, to: Pt[]): Promise<Record<string, Road>> {
  const out: Record<string, Road> = {};
  if (!to.length) return out;
  const rows = await prisma.roadDistance.findMany({ where: { serviceId: from.id, placeId: { in: to.map((p) => p.id) } }, select: { placeId: true, sig: true, km: true, minutes: true } });
  const byId = new Map(to.map((p) => [p.id, p]));
  for (const r of rows) {
    const p = byId.get(r.placeId);
    if (p && r.sig === sigOf(from, p)) out[r.placeId] = { km: r.km, min: r.minutes };
  }
  return out;
}

/** Mốc "trung tâm Tà Xùa" trong bảng RoadDistance (cột serviceId): gốc tính "cách trung tâm bao xa" của trang điểm đến. */
export const CENTER_ROAD_ID = "center:ta-xua";
export const centerPt = (): Pt => ({ id: CENTER_ROAD_ID, ...MAP_CENTER });

/**
 * Trang điểm tham quan (/diem-den/<slug>): quãng đường xe chạy từ TRUNG TÂM và giữa các điểm check-in với nhau
 * (cột serviceId = CENTER_ROAD_ID hoặc id Place). Chỉ gọi dịch vụ ngoài cho cặp còn thiếu / đổi toạ độ.
 * Chạy cuối `warmRoadCache` (30 phút/lần) và bằng script `scripts/warm-road-cache.ts`.
 */
export async function warmCheckinRoads(log?: (s: string) => void): Promise<number> {
  const spots = (
    await prisma.place.findMany({ where: { published: true, kind: "CHECKIN", lat: { not: null }, lng: { not: null } }, select: { id: true, lat: true, lng: true } })
  ).map((p) => ({ id: p.id, lat: p.lat!, lng: p.lng! }));
  let calls = 0;
  for (const from of [centerPt(), ...spots]) {
    const to = spots.filter((s) => s.id !== from.id);
    const have = await cachedRoads(from, to);
    if (Object.keys(have).length >= to.length) continue;
    await roadDistances(from, to);
    calls++;
    await sleep(1100);
  }
  log?.(`[road-cache] điểm check-in: ${calls} ma trận mới`);
  return calls;
}
