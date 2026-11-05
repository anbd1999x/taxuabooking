/**
 * Tính tiền xe cabin trong COMBO — thuần tuý (không import server) để dùng chung ở
 * server (combo.ts: tìm + đặt) lẫn client (ComboResults: giá thẻ + mặc định chỗ nằm),
 * bảo đảm giá khách thấy trên danh sách = giá khi bấm đặt.
 *
 * Mô hình: vé khứ hồi `fare` là giá MỖI KHÁCH khi nằm ghép (2 người/buồng). Mỗi buồng
 * (ghép 2 người hoặc 1 người nằm riêng) = 2 × fare → nằm riêng = 2 × fare/người.
 * Chỗ trên xe tính theo SỐ KHÁCH ở kho vé thường của chuyến (`seatsAvailable`) — KHÔNG
 * dùng kho "cabin đôi" của trang /xe-cabin (đó là sản phẩm khác, giá riêng; nhiều
 * chuyến không khai kho này nên trước đây bị xếp nhầm toàn buồng riêng → giá ×2).
 */

/**
 * Cách xếp MẶC ĐỊNH: ghép đôi tối đa, người lẻ nằm riêng. null = xe không đủ chỗ.
 */
export function cabinAllocation(
  people: number,
  seatsAvail: number,
): { nSingle: number; nDouble: number } | null {
  if (people <= 0 || seatsAvail < people) return null;
  const nDouble = Math.floor(people / 2);
  return { nSingle: people - nDouble * 2, nDouble };
}

/** Tiền xe MỖI KHÁCH theo cách xếp mặc định. null = xe không đủ chỗ cho đoàn. */
export function busCostPerPerson(
  bus: { farePerPerson: number; seatsAvailable: number },
  people: number,
): number | null {
  const a = cabinAllocation(people, bus.seatsAvailable);
  if (!a) return null;
  return Math.round((2 * bus.farePerPerson * (a.nSingle + a.nDouble)) / people);
}
