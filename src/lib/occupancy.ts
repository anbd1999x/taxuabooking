/**
 * Người lớn / trẻ em theo tuổi (homestay + combo).
 * Quy tắc: trẻ DƯỚI `freeUnderAge` = miễn phí, KHÔNG tính vào số người; trẻ từ
 * `freeUnderAge` trở lên tính như 1 người (vào sức chứa + phụ thu nếu vượt chuẩn).
 * Thuần tuý (không import server) để dùng chung ở server lẫn client.
 */

export const DEFAULT_CHILD_FREE_UNDER = 6;

/** Số trẻ TÍNH PHÍ (>= ngưỡng miễn phí). */
export function payingChildren(childrenAges: number[], freeUnderAge: number): number {
  return childrenAges.filter((a) => Number.isFinite(a) && a >= freeUnderAge).length;
}

/** Số người TÍNH PHÍ (vào sức chứa) = người lớn + trẻ >= ngưỡng. */
export function billableOccupants(adults: number, childrenAges: number[], freeUnderAge: number): number {
  return Math.max(0, Math.floor(adults || 0)) + payingChildren(childrenAges, freeUnderAge);
}

/**
 * Phụ thu người thêm cho CẢ KỲ: (occupants − capacity) × fee × nights.
 * extraGuests kẹp trong [0, maxCapacity − capacity]; overCapacity = vượt cả maxCapacity.
 */
export function extraPersonCost(
  occupants: number,
  capacity: number,
  maxCapacity: number | null | undefined,
  extraFeePerNight: number | null | undefined,
  nights: number,
): { extraGuests: number; cost: number; overCapacity: boolean; max: number } {
  const max = Math.max(capacity, maxCapacity ?? capacity);
  const overCapacity = occupants > max;
  const extraGuests = Math.max(0, Math.min(occupants, max) - capacity);
  const cost = extraGuests > 0 && extraFeePerNight ? extraGuests * extraFeePerNight * Math.max(1, nights) : 0;
  return { extraGuests, cost, overCapacity, max };
}

/** Nhãn hiển thị: "2 người lớn · 1 trẻ em (5, 8 tuổi)". */
export function partyLabel(adults: number, childrenAges: number[]): string {
  const parts = [`${Math.max(0, adults)} người lớn`];
  if (childrenAges.length) parts.push(`${childrenAges.length} trẻ em (${childrenAges.join(", ")} tuổi)`);
  return parts.join(" · ");
}
