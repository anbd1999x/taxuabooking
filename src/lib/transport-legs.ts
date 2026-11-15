/**
 * Giá TAXI / XE ÔM theo CHẶNG (file thuần, dùng chung server + client).
 *
 * - Điểm đón / điểm đến lấy từ danh sách ĐIỂM CỐ ĐỊNH (TransportPoint, admin quản lý ở /admin/transport-points).
 * - Mỗi bác tài (dịch vụ) khai:
 *     · giá CHẠY NGUYÊN NGÀY (TransportInfo.fixedPrice; xe ôm thêm giá khi chở 2 người: dayPriceTwo);
 *     · giá 1 CHIỀU cho từng chặng giữa 2 điểm (TransportRoute.priceOneWay; xe ôm thêm priceTwo khi chở 2 người).
 *   Chặng dùng cho cả hai hướng (A → B = B → A).
 * - Xe ôm (xe máy): mỗi tài xế chở tối đa `capacity` người (1 hoặc 2). Khách chọn số người + số tài xế;
 *   người được dồn 2/xe trước: (người − tài xế) xe chở 2, còn lại chở 1 ⇒ tổng = n2 × giá-2-người + n1 × giá-1-người.
 * - Taxi (ô tô): giá tính theo XE; mỗi xe chở tối đa `capacity` khách ⇒ tổng = số xe × giá.
 * - Chặng / mức giá bác tài chưa khai, hoặc "Điểm khác" ngoài danh sách ⇒ không có giá, khách nhắn tin hỏi giá.
 */
export type TransportMode = "LEG" | "DAY";
export const OTHER_POINT = "__other__";

export interface TransportPointDTO {
  id: string;
  name: string;
}

export interface TransportLegDTO {
  id: string;
  fromId: string;
  toId: string;
  /** Xe ôm: giá chở 1 người · Taxi: giá cả xe. */
  oneWay: number | null;
  /** Xe ôm: giá khi một tài xế chở 2 người (null = chưa báo). Taxi: không dùng. */
  twoPax: number | null;
  note: string | null;
}

/** Thông tin giá của một bác tài. */
export interface TransportPricing {
  bike: boolean; // true = xe ôm (xe máy), false = taxi
  capacity: number; // xe ôm: 1 | 2 người / tài xế · taxi: số khách / xe
  dayPrice: number | null; // nguyên ngày: xe ôm chở 1 người · taxi cả xe
  dayPriceTwo: number | null; // nguyên ngày khi xe ôm chở 2 người
  legs: TransportLegDTO[];
}

/** Chặng giữa 2 điểm (không phân biệt hướng); null nếu bác tài không khai. */
export function findLeg(legs: TransportLegDTO[], fromId: string, toId: string): TransportLegDTO | null {
  if (!fromId || !toId || fromId === OTHER_POINT || toId === OTHER_POINT) return null;
  return legs.find((l) => (l.fromId === fromId && l.toId === toId) || (l.fromId === toId && l.toId === fromId)) ?? null;
}

const pos = (n: number | null | undefined) => (n != null && n > 0 ? n : null);

/** Sức chở hiệu lực: xe ôm 1 hoặc 2 (mặc định 2), taxi ≥ 1 (mặc định 4). */
export function effectiveCapacity(bike: boolean, capacity: number | null | undefined): number {
  if (bike) return capacity === 1 ? 1 : 2;
  return capacity && capacity > 0 ? capacity : 4;
}

/** Số tài xế / xe tối thiểu cho `people` khách. */
export function minDrivers(bike: boolean, capacity: number | null | undefined, people: number): number {
  return Math.max(1, Math.ceil(Math.max(1, people) / effectiveCapacity(bike, capacity)));
}

export interface TransportQuote {
  total: number | null; // null = chưa có giá (nhắn tin báo giá)
  error: string | null; // cấu hình số người / tài xế không hợp lệ
  twos: number; // xe ôm: số tài xế chở 2 người
  ones: number; // xe ôm: số tài xế chở 1 người
  leg: TransportLegDTO | null;
}

/** Báo giá cho một lựa chọn (chặng 1 chiều hoặc nguyên ngày) với số người + số tài xế / xe. */
export function quoteTransport(
  p: TransportPricing,
  q: { mode: TransportMode; fromId?: string | null; toId?: string | null; people: number; drivers: number },
): TransportQuote {
  const people = Math.max(1, Math.floor(q.people) || 1);
  const drivers = Math.max(1, Math.floor(q.drivers) || 1);
  const cap = effectiveCapacity(p.bike, p.capacity);
  const leg = q.mode === "LEG" ? findLeg(p.legs, q.fromId ?? "", q.toId ?? "") : null;
  const empty = { total: null, twos: 0, ones: 0, leg };
  if (people > drivers * cap) {
    const need = Math.ceil(people / cap);
    return { ...empty, error: p.bike ? `Mỗi xe máy chở tối đa ${cap} người — ${people} người cần ít nhất ${need} tài xế.` : `Mỗi xe chở tối đa ${cap} khách — ${people} khách cần ít nhất ${need} xe.` };
  }
  if (p.bike && drivers > people) return { ...empty, error: "Số tài xế không được nhiều hơn số người." };

  if (p.bike) {
    const twos = cap === 2 ? Math.max(0, people - drivers) : 0;
    const ones = drivers - twos;
    const p1 = pos(q.mode === "DAY" ? p.dayPrice : leg?.oneWay);
    const p2 = pos(q.mode === "DAY" ? p.dayPriceTwo : leg?.twoPax);
    const missing = (ones > 0 && p1 == null) || (twos > 0 && p2 == null);
    return { total: missing ? null : ones * (p1 ?? 0) + twos * (p2 ?? 0), error: null, twos, ones, leg };
  }
  const price = pos(q.mode === "DAY" ? p.dayPrice : leg?.oneWay);
  return { total: price == null ? null : price * drivers, error: null, twos: 0, ones: drivers, leg };
}

/** Giá "từ" thấp nhất của một bác tài (để hiện trên thẻ khi khách chưa chọn chặng). */
export function lowestPrice(p: TransportPricing): number | null {
  const all = [p.dayPrice, ...p.legs.map((l) => l.oneWay)].map(pos).filter((x): x is number => x != null);
  return all.length ? Math.min(...all) : null;
}
