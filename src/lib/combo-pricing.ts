import { isRentalTime, rentalChargeDaysBySpan } from "./rental-days";
import { identityT, type TFunc } from "./i18n/config";
/**
 * Tính tiền xe cabin trong COMBO — thuần tuý (không import server) để dùng chung ở
 * server (combo.ts: tìm + đặt) lẫn client (ComboResults: giá thẻ + mặc định chỗ nằm),
 * bảo đảm giá khách thấy trên danh sách = giá khi bấm đặt.
 *
 * Mô hình (giống trang /xe-cabin): tính THEO NGƯỜI. Vé khứ hồi `fare` = giá MỖI KHÁCH
 * nằm ghép (cabin đôi; đi lẻ thì nhà xe xếp ghép cùng khách khác). Nằm riêng (cabin đơn,
 * bao trọn buồng) = 2 × fare/người. Chỗ trên xe tính theo SỐ KHÁCH ở kho vé thường của
 * chuyến (`seatsAvailable`) — KHÔNG dùng kho "cabin đôi" của trang /xe-cabin.
 */

/**
 * Cách xếp MẶC ĐỊNH (theo NGƯỜI): cả đoàn nằm ghép (rẻ nhất). nDouble = số khách nằm ghép,
 * nSingle = số khách nằm riêng; nDouble + nSingle = people. null = xe không đủ chỗ.
 */
export function cabinAllocation(
  people: number,
  seatsAvail: number,
): { nSingle: number; nDouble: number } | null {
  if (people <= 0 || seatsAvail < people) return null;
  return { nSingle: 0, nDouble: people };
}

/**
 * Tiền xe cabin (dùng chung trang /xe-cabin + combo): `fare` = giá chặng MỖI KHÁCH
 * (khứ hồi hoặc 1 chiều theo hành trình). Mọi buồng là cabin đôi, giá buồng = 2 × fare:
 * - nằm chung (2 người/buồng) → mỗi người trả fare;
 * - nằm riêng (1 người/buồng) → người đó trả 2 × fare.
 */
export function cabinBoothTotal(fare: number, shared: number, solo: number): number {
  return 2 * fare * (Math.max(0, shared) + Math.max(0, solo));
}

/**
 * Tiền vé cabin trang /xe-cabin — tính THEO NGƯỜI:
 * - nằm ghép: mỗi người 1 vé (`fare`); đi lẻ thì nhà xe xếp ghép với khách khác;
 * - nằm riêng (bao trọn buồng): mỗi người 2 × fare.
 */
export function cabinSeatTotal(fare: number, sharedPeople: number, soloPeople: number): number {
  return fare * Math.max(0, sharedPeople) + 2 * fare * Math.max(0, soloPeople);
}

/** Số khách của cách xếp buồng: nằm chung 2 người/buồng + nằm riêng 1 người/buồng. */
export function cabinPeople(shared: number, solo: number): number {
  return 2 * Math.max(0, shared) + Math.max(0, solo);
}

/** Tiền xe MỖI KHÁCH theo cách xếp mặc định. null = xe không đủ chỗ cho đoàn. */
export function busCostPerPerson(
  bus: { farePerPerson: number; seatsAvailable: number },
  people: number,
): number | null {
  const a = cabinAllocation(people, bus.seatsAvailable);
  if (!a) return null;
  return Math.round(cabinSeatTotal(bus.farePerPerson, a.nDouble, a.nSingle) / people);
}

/** Tỉ lệ cọc combo: cọc = 50% tiền xe + 50% tiền phòng (mỗi bên nhận 50% phần của mình). */
export const COMBO_DEPOSIT_RATE = 0.5;

/** Tuỳ chọn THÊM XE MÁY khi đặt combo (mặc định không chọn): các loại xe cho khách chọn + giá thuê mỗi xe mỗi ngày. */
export const COMBO_MOTORBIKES = [
  { key: "wave", name: "Honda Wave", perDay: 170_000 },
  { key: "pg1", name: "Honda PG1", perDay: 270_000 },
] as const;
export type ComboBikeKey = (typeof COMBO_MOTORBIKES)[number]["key"];
export const COMBO_BIKE_KEYS = COMBO_MOTORBIKES.map((b) => b.key) as [ComboBikeKey, ...ComboBikeKey[]];
/** Loại xe theo khoá; khoá lạ / đơn từ client cũ (không gửi loại) ⇒ Honda Wave. */
export function comboMotorbike(key?: string | null): (typeof COMBO_MOTORBIKES)[number] {
  return COMBO_MOTORBIKES.find((b) => b.key === key) ?? COMBO_MOTORBIKES[0];
}
/**
 * Số ngày thuê xe máy trong combo. Khách chọn NGÀY nhận xe + NGÀY trả xe trong khoảng lưu trú
 * [check-in, check-out] ⇒ `gap` = số ngày lịch giữa hai ngày đó (0 = trả trong ngày nhận); không truyền
 * (đơn từ client cũ) ⇒ nhận ngày check-in, trả ngày check-out (gap = số đêm).
 * Có giờ nhận + giờ trả ⇒ quy đổi theo mốc 24 giờ như thuê xe lẻ (1 / 1,5 / 2…, xem rental-days.ts);
 * không có giờ ⇒ bằng số ngày lịch (tối thiểu 1). Tối thiểu 1 ngày.
 */
export function comboMotorbikeDays(nights: number, pickup?: string | null, ret?: string | null, gap?: number | null): number {
  const g = gap != null && Number.isFinite(gap) ? Math.max(0, Math.floor(gap)) : Math.max(1, Math.floor(nights) || 0);
  if (isRentalTime(pickup) && isRentalTime(ret)) return rentalChargeDaysBySpan(g, pickup, ret) ?? Math.max(1, g);
  return Math.max(1, g);
}
/** Giờ trả có hợp lệ không (trả trong ngày nhận thì giờ trả phải sau giờ nhận). */
export function comboMotorbikeValid(gap: number, pickup?: string | null, ret?: string | null): boolean {
  if (gap < 0) return false;
  if (gap > 0 || !isRentalTime(pickup) || !isRentalTime(ret)) return true;
  return rentalChargeDaysBySpan(0, pickup, ret) != null;
}
/** Tiền thuê xe máy kèm combo = số xe × số ngày × giá/ngày của loại xe đã chọn. Dịch vụ TÍNH RIÊNG: không cộng vào
 *  bill combo, khách thanh toán khi giao xe (chỉ ghi chú trong đơn). */
export function comboMotorbikeCost(bikes: number, nights: number, key?: string | null, pickup?: string | null, ret?: string | null, gap?: number | null): number {
  return Math.round(Math.max(0, Math.floor(bikes) || 0) * comboMotorbikeDays(nights, pickup, ret, gap) * comboMotorbike(key).perDay);
}

/** Xe máy thuê kèm của một đơn combo (dịch vụ tính riêng) — dùng chung cho trang tra cứu, email, tin nhắn. */
export interface ComboBikeFacts {
  name: string; // "Honda Wave"
  count: number;
  days: number; // số ngày tính tiền (1 / 1,5 / 2…)
  perDay: number | null;
  /** "06:00 12/12/2026" (đơn rất cũ: chỉ giờ, hoặc null). */
  pickup: string | null;
  ret: string | null;
  amount: number | null; // giá tham khảo
}
const BIKE_LABEL_RE = /thuê xe máy (?:([^:·]+): )?(\d+) xe × ([\d,]+) ngày(?: \(nhận ([^,)]+), trả ([^)]+)\))?(?: × [\d.]+đ)? = ([\d.]+)đ/;
/**
 * Đọc xe máy thuê kèm của đơn combo: ưu tiên các cột có cấu trúc (`bikeCount`…), đơn cũ chưa có cột thì
 * tách từ `selectionLabel` ("… thuê xe máy Honda Wave: 1 xe × 1,5 ngày (nhận …, trả …) × 170.000đ = 255.000đ …").
 * Không có xe kèm ⇒ null.
 */
export function comboBikeFacts(b: {
  category: string;
  selectionLabel?: string | null;
  nights?: number | null;
  bikeCount?: number | null;
  bikeType?: string | null;
  bikeFrom?: Date | null;
  bikeTo?: Date | null;
  bikePickup?: string | null;
  bikeReturn?: string | null;
  bikeAmount?: unknown;
}): ComboBikeFacts | null {
  if (b.category !== "COMBO") return null;
  const dmyOf = (d: Date) => {
    const k = d.toISOString().slice(0, 10);
    return `${k.slice(8, 10)}/${k.slice(5, 7)}/${k.slice(0, 4)}`;
  };
  if ((b.bikeCount ?? 0) > 0 && b.bikeFrom && b.bikeTo) {
    const bike = comboMotorbike(b.bikeType);
    const gap = Math.round((b.bikeTo.getTime() - b.bikeFrom.getTime()) / 86_400_000);
    const amount = b.bikeAmount == null ? NaN : Number(b.bikeAmount);
    return {
      name: bike.name,
      count: b.bikeCount!,
      days: comboMotorbikeDays(b.nights ?? 1, b.bikePickup, b.bikeReturn, gap),
      perDay: bike.perDay,
      pickup: `${b.bikePickup ? `${b.bikePickup} ` : ""}${dmyOf(b.bikeFrom)}`,
      ret: `${b.bikeReturn ? `${b.bikeReturn} ` : ""}${dmyOf(b.bikeTo)}`,
      amount: Number.isFinite(amount) ? amount : null,
    };
  }
  const m = BIKE_LABEL_RE.exec(b.selectionLabel ?? "");
  if (!m) return null;
  const name = m[1]?.trim() || COMBO_MOTORBIKES[0].name;
  const count = Number(m[2]);
  const days = Number(m[3].replace(",", "."));
  const amount = Number(m[6].replace(/\./g, ""));
  return {
    name,
    count,
    days,
    perDay: COMBO_MOTORBIKES.find((x) => x.name === name)?.perDay ?? (count > 0 && days > 0 ? Math.round(amount / (count * days)) : null),
    pickup: m[4]?.trim() || null,
    ret: m[5]?.trim() || null,
    amount: Number.isFinite(amount) ? amount : null,
  };
}

/**
 * Tiền ĐÃ THU quy về MỘT BÊN của đơn combo (nhà xe: tiền vé, homestay: tiền phòng):
 * - khách đã thanh toán đủ ⇒ bên đó nhận đủ phần của mình;
 * - đã cọc (trạng thái Đã cọc hoặc có ghi nhận tiền) ⇒ 50% phần tiền của bên đó;
 * - chưa thu ⇒ 0.
 * `cap` (tuỳ chọn): không vượt quá số này (vd tiền thực nhận sau chiết khấu).
 */
export function comboSideCollected(
  paymentStatus: string,
  amountCollected: number | null | undefined,
  sideAmount: number,
  cap?: number,
): number {
  const v =
    paymentStatus === "PAID"
      ? sideAmount
      : paymentStatus === "DEPOSITED" || (amountCollected ?? 0) > 0
        ? Math.round(sideAmount * COMBO_DEPOSIT_RATE)
        : 0;
  return cap == null ? v : Math.min(v, cap);
}

/* ===================== Cách nằm của một ĐƠN (hiển thị) ===================== */

export interface CabinBerths {
  /** Số khách nằm ghép — cabin đôi, 1 vé/người. */
  shared: number;
  /** Số khách nằm riêng — cabin đơn bao buồng, 2 vé/người. */
  solo: number;
}

/**
 * Cách nằm xe cabin của đơn: ưu tiên cột `cabinShared`/`cabinSolo`; đơn cũ chưa có cột thì
 * đọc từ nhãn đã lưu ("1 khách nằm ghép (cabin đôi) + 1 khách nằm riêng …"). null = không rõ.
 */
export function bookingCabinBerths(b: {
  cabinShared?: number | null;
  cabinSolo?: number | null;
  selectionLabel?: string | null;
}): CabinBerths | null {
  if (b.cabinShared != null || b.cabinSolo != null) {
    const shared = Math.max(0, b.cabinShared ?? 0);
    const solo = Math.max(0, b.cabinSolo ?? 0);
    return shared + solo > 0 ? { shared, solo } : null;
  }
  const lbl = b.selectionLabel ?? "";
  const sh = lbl.match(/(\d+) khách nằm ghép/);
  const so = lbl.match(/(\d+) khách nằm riêng/);
  if (!sh && !so) return null;
  return { shared: sh ? Number(sh[1]) : 0, solo: so ? Number(so[1]) : 0 };
}

/** Nhãn ngắn: "1 cabin đôi (nằm ghép) + 1 cabin đơn (nằm riêng)". */
export function cabinBerthsLabel(c: CabinBerths, t: TFunc = identityT): string {
  return [
    c.shared ? t("{0} khách cabin đôi (nằm ghép)", [c.shared]) : null,
    c.solo ? t("{0} khách cabin đơn (nằm riêng)", [c.solo]) : null,
  ]
    .filter(Boolean)
    .join(" + ");
}

/**
 * Chi tiết từng loại vé kèm tiền khi biết TỔNG tiền vé của đơn (giá/vé = tổng ÷ số vé quy đổi,
 * nằm riêng = 2 vé/người). VD: "Cabin đôi · nằm ghép: 1 khách × 450.000đ = 450.000đ".
 */
export function cabinBerthLines(c: CabinBerths, busTotal: number | null | undefined): string[] {
  const units = c.shared + 2 * c.solo;
  const fare = busTotal && units > 0 ? Math.round(busTotal / units) : null;
  const vnd = (n: number) => `${n.toLocaleString("vi-VN")}đ`;
  const out: string[] = [];
  if (c.shared)
    out.push(
      `Cabin đôi · nằm ghép: ${c.shared} khách` + (fare ? ` × ${vnd(fare)} = ${vnd(fare * c.shared)}` : ""),
    );
  if (c.solo)
    out.push(
      `Cabin đơn · nằm riêng (bao buồng): ${c.solo} khách` +
        (fare ? ` × 2 × ${vnd(fare)} = ${vnd(2 * fare * c.solo)}` : ""),
    );
  return out;
}
