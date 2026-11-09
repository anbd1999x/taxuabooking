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

/**
 * Phụ thu khi đặt NHIỀU phòng cùng homestay trong 1 đơn: đoàn chia vào các phòng, sức chứa
 * chuẩn = tổng `capacity`, tối đa = tổng `maxCapacity` (thiếu = capacity). Khách vượt chuẩn
 * tính phụ thu theo mức chung của homestay. 1 phòng ⇒ trùng `extraPersonCost`.
 */
export function multiRoomExtraCost(
  occupants: number,
  rooms: { capacity: number; maxCapacity: number | null | undefined }[],
  extraFeePerNight: number | null | undefined,
  nights: number,
): { extraGuests: number; cost: number; overCapacity: boolean; capacity: number; max: number } {
  const capacity = rooms.reduce((n, r) => n + r.capacity, 0);
  const max = rooms.reduce((n, r) => n + Math.max(r.capacity, r.maxCapacity ?? r.capacity), 0);
  const overCapacity = occupants > max;
  const extraGuests = Math.max(0, Math.min(occupants, max) - capacity);
  const cost = extraGuests > 0 && extraFeePerNight ? extraGuests * extraFeePerNight * Math.max(1, nights) : 0;
  return { extraGuests, cost, overCapacity, capacity, max };
}

/**
 * Số KHÁCH của một đơn để hiển thị. Đơn homestay: `quantity` = số PHÒNG, số khách nằm ở
 * adults + trẻ em; các loại khác (combo/cabin...) `quantity` đã là số khách/số lượng.
 */
export function bookingPax(b: {
  category: string;
  quantity: number;
  adults: number | null;
  childrenAges?: number[] | null;
}): number {
  if ((b.category === "HOMESTAY" || b.category === "BUNGALOW") && b.adults != null) {
    return b.adults + (b.childrenAges?.length ?? 0);
  }
  return b.quantity;
}

/** Nhãn hiển thị: "2 người lớn · 1 trẻ em (5, 8 tuổi)". */
export function partyLabel(adults: number, childrenAges: number[]): string {
  const parts = [`${Math.max(0, adults)} người lớn`];
  if (childrenAges.length) parts.push(`${childrenAges.length} trẻ em (${childrenAges.join(", ")} tuổi)`);
  return parts.join(" · ");
}
