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
