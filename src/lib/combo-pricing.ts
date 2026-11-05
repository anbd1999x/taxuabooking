/**
 * Tính tiền xe cabin trong COMBO — thuần tuý (không import server) để dùng chung ở
 * server (combo.ts: tìm + đặt) lẫn client (ComboResults: giá thẻ + mặc định chỗ nằm),
 * bảo đảm giá khách thấy trên danh sách = giá khi bấm đặt.
 *
 * Mô hình: mỗi BUỒNG (đơn hoặc đôi) = 2 × vé khứ hồi. Buồng đôi 2 người nằm ghép
 * (= 1 vé/người), buồng đơn 1 người nằm riêng (= 2 vé/người).
 */

/**
 * Xếp buồng cho đoàn `people` người theo số buồng còn: ưu tiên buồng ĐÔI trong giới
 * hạn còn trống, người lẻ / thiếu buồng đôi nằm buồng ĐƠN. null = xe không đủ chỗ.
 */
export function cabinAllocation(
  people: number,
  singleAvail: number,
  doubleAvail: number,
): { nSingle: number; nDouble: number } | null {
  const dbl = Math.max(0, doubleAvail);
  const sgl = Math.max(0, singleAvail);
  let nDouble = Math.min(Math.floor(people / 2), dbl);
  let nSingle = people - nDouble * 2;
  // Thiếu buồng đơn cho người lẻ → cho người lẻ nằm 1 buồng đôi (giá buồng như nhau).
  while (nSingle > sgl && nDouble < dbl) {
    nDouble++;
    nSingle = Math.max(0, people - nDouble * 2);
  }
  return nSingle <= sgl ? { nSingle, nDouble } : null;
}

/** Tiền xe MỖI KHÁCH theo cách xếp mặc định. null = xe không đủ chỗ cho đoàn. */
export function busCostPerPerson(
  bus: { farePerPerson: number; seatsAvailable: number; doubleAvailable: number },
  people: number,
): number | null {
  if (people <= 0) return null;
  const a = cabinAllocation(people, bus.seatsAvailable, bus.doubleAvailable);
  if (!a) return null;
  return Math.round((2 * bus.farePerPerson * (a.nSingle + a.nDouble)) / people);
}
