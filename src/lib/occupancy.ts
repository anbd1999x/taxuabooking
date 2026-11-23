import { bookingRentalDays, rentalDaysLabel } from "./rental-days";
import { identityT, type TFunc } from "./i18n/config";
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
 * Phụ thu người thêm ở form TẠO ĐƠN HỘ KHÁCH (admin): mỗi khách vượt TỔNG sức chứa chuẩn của
 * các phòng đã chọn × mức phụ thu/người/đêm của homestay × số đêm. Admin không bị chặn theo
 * sức chứa tối đa (khác đặt web) nên tính cho MỌI khách vượt chuẩn.
 */
export function adminExtraCost(
  occupants: number,
  capacities: number[],
  extraFeePerNight: number | null | undefined,
  nights: number,
): { extraGuests: number; cost: number } {
  if (!capacities.length) return { extraGuests: 0, cost: 0 };
  const extraGuests = Math.max(0, occupants - capacities.reduce((n, c) => n + c, 0));
  const cost = extraGuests > 0 && extraFeePerNight ? extraGuests * extraFeePerNight * Math.max(1, nights) : 0;
  return { extraGuests, cost };
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

/** Dịch vụ THUÊ theo ngày (xe máy): `nights` = số NGÀY thuê, `quantity` = số XE — không phải đêm / người. */
export function isRentalCategory(category: string): boolean {
  return category === "MOTORBIKE";
}

/** "2 đêm" (lưu trú) hoặc "2 ngày thuê" (xe máy); null khi đơn không có thời lượng. */
export function durationLabel(b: { category: string; nights: number | null; rentalDays?: unknown }, t: TFunc = identityT): string | null {
  if (!b.nights) return null;
  return isRentalCategory(b.category) ? t("{0} thuê", [rentalDaysLabel(bookingRentalDays(b), t)]) : t("{0} đêm", [b.nights]);
}

/** "3 xe" (thuê xe máy) hoặc "4 người". */
export function bookingCountLabel(b: Parameters<typeof bookingPax>[0], t: TFunc = identityT): string {
  return isRentalCategory(b.category) ? t("{0} xe", [b.quantity]) : t("{0} người", [bookingPax(b)]);
}

/** Nhãn hiển thị: "2 người lớn · 1 trẻ em (5, 8 tuổi)". */
export function partyLabel(adults: number, childrenAges: number[], t: TFunc = identityT): string {
  const parts = [t("{0} người lớn", [Math.max(0, adults)])];
  if (childrenAges.length) parts.push(t("{0} trẻ em ({1} tuổi)", [childrenAges.length, childrenAges.join(", ")]));
  return parts.join(" · ");
}

/**
 * Phòng CỘNG ĐỒNG (dorm / tập thể / giường tầng): giá phòng trong hệ thống là GIÁ MỖI NGƯỜI (bán theo giường),
 * không phải giá cả phòng. Nhận diện theo tên hạng / tên phòng. Dùng chung cho combo lẫn đặt homestay.
 */
export function isCommunalRoom(typeName: string, roomName = ""): boolean {
  const n = `${typeName} ${roomName}`.toLowerCase();
  return /cộng đồng|cong dong|dorm|tập thể|tap the|giường tầng|giuong tang|phòng chung|phong chung/.test(n);
}

export interface StayQuoteRoom {
  /** Tổng giá cả kỳ của phòng (phòng cộng đồng: giá MỖI NGƯỜI cả kỳ). null = không công khai giá. */
  price: number | null;
  capacity: number;
  maxCapacity?: number | null;
  communal?: boolean;
}

/**
 * TIỀN PHÒNG của một đơn homestay (1 hay nhiều phòng) — MỘT NGUỒN cho server (`createBooking`) và giao diện
 * (`HomestayBooking`). Phòng thường: giá cả phòng + phụ thu khách vượt sức chứa chuẩn (như `multiRoomExtraCost`).
 * Phòng cộng đồng: giá × SỐ KHÁCH nằm ở phòng đó, không phụ thu ở ghép (nhận tới sức chứa tối đa).
 * Chia khách khi đơn có cả hai loại: lấp phòng thường tới sức chứa chuẩn trước, số còn lại xuống giường cộng đồng
 * (rẻ nhất trước, mỗi phòng cộng đồng đã chọn tính ít nhất 1 khách); còn dư nữa mới là khách ở ghép phòng thường.
 */
export function stayRoomsQuote(
  occupants: number,
  rooms: StayQuoteRoom[],
  extraFeePerNight: number | null | undefined,
  nights: number,
): {
  /** Tổng tiền phòng (chưa gồm phụ thu); null khi có phòng không công khai giá. */
  roomsTotal: number | null;
  extraGuests: number;
  cost: number;
  overCapacity: boolean;
  capacity: number;
  max: number;
  /** Số khách tính tiền theo giường ở từng phòng (cùng thứ tự `rooms`; phòng thường = 0). */
  beds: number[];
  dormGuests: number;
} {
  const maxOf = (r: StayQuoteRoom) => Math.max(r.capacity, r.maxCapacity ?? r.capacity);
  const priv = rooms.filter((r) => !r.communal);
  const privStd = priv.reduce((n, r) => n + r.capacity, 0);
  const privMax = priv.reduce((n, r) => n + maxOf(r), 0);
  const dormIdx = rooms.map((r, i) => (r.communal ? i : -1)).filter((i) => i >= 0);
  const dormMax = dormIdx.reduce((n, i) => n + maxOf(rooms[i]), 0);
  const max = privMax + dormMax;
  const capacity = privStd + dormMax;
  const occ = Math.max(0, Math.floor(occupants || 0));
  const overCapacity = occ > max;
  const placed = Math.min(occ, max);

  const beds = rooms.map(() => 0);
  let dormGuests = 0;
  if (dormIdx.length) {
    dormGuests = Math.min(dormMax, Math.max(dormIdx.length, placed - privStd));
    // Mỗi phòng cộng đồng 1 khách trước, phần còn lại dồn vào phòng rẻ nhất.
    for (const i of dormIdx) beds[i] = 1;
    let left = dormGuests - dormIdx.length;
    for (const i of [...dormIdx].sort((a, b) => (rooms[a].price ?? 0) - (rooms[b].price ?? 0))) {
      const take = Math.min(left, maxOf(rooms[i]) - 1);
      beds[i] += take;
      left -= take;
    }
  }
  const extraGuests = Math.max(0, Math.min(placed - dormGuests, privMax) - privStd);
  const cost = extraGuests > 0 && extraFeePerNight ? extraGuests * extraFeePerNight * Math.max(1, nights) : 0;
  const roomsTotal = rooms.every((r) => r.price != null)
    ? rooms.reduce((n, r, i) => n + (r.communal ? (r.price ?? 0) * beds[i] : (r.price ?? 0)), 0)
    : null;
  return { roomsTotal, extraGuests, cost, overCapacity, capacity, max, beds, dormGuests };
}
