import type { TransportPointDTO, TransportPricing } from "@/lib/transport-legs";
import { formatPrice } from "@/lib/format";

/**
 * Phần tính THUẦN cho các bảng dữ liệu dựng phía server (trang danh mục, /llms.txt, /llms-full.txt):
 * gom giá chặng xe ôm / taxi của mọi bác tài thành một dòng mỗi chặng. Mọi con số đến từ DB, không ước tính.
 */
export type Range = [min: number, max: number];

export interface FareLeg {
  /** Hai đầu chặng (chặng dùng cho cả hai hướng), sắp theo thứ tự điểm của admin. */
  a: string;
  b: string;
  /** Số bác tài / xe có khai giá chặng này. */
  drivers: number;
  /** Xe ôm: giá 1 chiều khi chở 1 khách · Taxi: giá 1 chiều cả xe. */
  one: Range | null;
  /** Xe ôm: giá 1 chiều khi một xe chở 2 khách. */
  two: Range | null;
  /** Taxi: các loại xe (tên bác tài khai, vd "Toyota Fortuner") đang nhận chặng này; chưa khai loại xe thì không có trong danh sách. */
  vehicles: string[];
}

const pos = (n: number | null | undefined): n is number => n != null && n > 0;
const widen = (r: Range | null | undefined, v: number): Range => (r ? [Math.min(r[0], v), Math.max(r[1], v)] : [v, v]);

/** Ngày hôm nay theo giờ Việt Nam, dạng dd/mm/yyyy. */
export function vnToday(): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric" })
      .formatToParts(new Date())
      .map((x) => [x.type, x.value]),
  );
  return `${p.day}/${p.month}/${p.year}`;
}

/** "350.000đ" hoặc "300.000đ – 350.000đ"; không có giá ⇒ "—" (ô trống của bảng). */
export function rangeText(r: Range | null | undefined): string {
  if (!r) return "—";
  return r[0] === r[1] ? formatPrice(r[0]) : `${formatPrice(r[0])} – ${formatPrice(r[1])}`;
}

/** Khoảng [thấp nhất, cao nhất] của một dãy giá (bỏ ô trống / 0); không có giá nào ⇒ null. */
export function rangeOf(values: (number | null | undefined)[]): Range | null {
  const ps = values.filter(pos);
  return ps.length ? [Math.min(...ps), Math.max(...ps)] : null;
}

/**
 * Gom chặng của mọi bác tài. Bỏ chặng có điểm đã ẩn (không còn tên hiển thị) và chặng chưa khai giá.
 * Sắp: nhiều bác tài nhận trước, rồi theo thứ tự điểm.
 */
export function buildFareLegs(routes: { pricing: TransportPricing; vehicleType?: string | null }[], points: TransportPointDTO[]): FareLeg[] {
  const idx = new Map(points.map((p, i) => [p.id, i]));
  const map = new Map<string, FareLeg & { ia: number; ib: number; seen: Set<number> }>();
  routes.forEach((r, ri) => {
    for (const l of r.pricing.legs) {
      const i1 = idx.get(l.fromId);
      const i2 = idx.get(l.toId);
      if (i1 == null || i2 == null || i1 === i2) continue;
      if (!pos(l.oneWay) && !pos(l.twoPax)) continue;
      const [ia, ib] = i1 < i2 ? [i1, i2] : [i2, i1];
      const key = `${ia}|${ib}`;
      let leg = map.get(key);
      if (!leg) map.set(key, (leg = { a: points[ia].name, b: points[ib].name, drivers: 0, one: null, two: null, vehicles: [], ia, ib, seen: new Set() }));
      leg.seen.add(ri);
      if (pos(l.oneWay)) {
        leg.one = widen(leg.one, l.oneWay);
        const v = r.pricing.bike ? "" : (r.vehicleType ?? "").replace(/\s+/g, " ").trim();
        if (v && !leg.vehicles.includes(v)) leg.vehicles.push(v);
      }
      if (r.pricing.bike && pos(l.twoPax)) leg.two = widen(leg.two, l.twoPax);
    }
  });
  return [...map.values()]
    .sort((x, y) => y.seen.size - x.seen.size || x.ia - y.ia || x.ib - y.ib)
    .map((l): FareLeg => ({ a: l.a, b: l.b, drivers: l.seen.size, one: l.one, two: l.two, vehicles: l.vehicles }));
}

/** Khoảng giá của các chặng có một đầu khớp tên (vd /sống lưng/i) — cho câu trả lời FAQ. */
export function legsMatching(legs: FareLeg[], re: RegExp): { one: Range | null; two: Range | null } {
  const hit = legs.filter((l) => re.test(l.a) || re.test(l.b));
  return {
    one: rangeOf(hit.flatMap((l) => (l.one ? [l.one[0], l.one[1]] : []))),
    two: rangeOf(hit.flatMap((l) => (l.two ? [l.two[0], l.two[1]] : []))),
  };
}
