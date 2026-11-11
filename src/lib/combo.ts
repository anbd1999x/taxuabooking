import "server-only";
import { prisma } from "./prisma";
import { parseDateOnly, toDateKey, addDays, enumerateNights, today } from "./dates";
import { toNumber } from "./format";
import { roomPricing, priceForDay, stayStrike, roomCommissionForNights } from "./availability";
import { generateBookingCode } from "./utils";
import { checkWeekendPolicy } from "./weekend-policy";
import { payingChildren, partyLabel, DEFAULT_CHILD_FREE_UNDER } from "./occupancy";
import type { ComboBookingInput } from "./validation";
import { cabinAllocation, busCostPerPerson, cabinSeatTotal } from "./combo-pricing";
import { busCommissionFor } from "./provider-commission";
import { ensureServiceSheetFresh } from "./sheet-sync";
import { tripsOnDate, peekTrip, materializeTrip, OPEN_SEATS, type TripView } from "./cabin-trips";
export { cabinAllocation, busCostPerPerson } from "./combo-pricing";

/** Giảm giá cố định cho mỗi combo (mỗi khách). */
export const COMBO_DISCOUNT = 25000;

/** File video không dùng được làm ảnh thẻ (next/image sẽ lỗi). */
const VIDEO_URL_RE = /\.(mp4|webm|mov|m4v|ogg)(\?|$)/i;
const firstImageUrl = (items: { url: string }[]): string | null =>
  items.find((i) => !VIDEO_URL_RE.test(i.url))?.url ?? null;

export interface ComboFilters {
  bathtub: boolean;
  cloudView: boolean;
  breakfast: boolean;
  airCon: boolean;
  heating: boolean;
  easyRoad: boolean;
  pool: boolean;
}

export const EMPTY_FILTERS: ComboFilters = {
  bathtub: false,
  cloudView: false,
  breakfast: false,
  airCon: false,
  heating: false,
  easyRoad: false,
  pool: false,
};

/** Loại phòng cho combo. */
export type ComboRoomKind = "all" | "single" | "double" | "dorm";

/**
 * Phòng CỘNG ĐỒNG (dorm): giá phòng trong app là GIÁ MỖI NGƯỜI (giường ghép),
 * nên combo/khách = giá phòng + vé khứ hồi — KHÔNG chia theo đoàn, KHÔNG trừ
 * giảm giá combo. Nhận diện theo tên hạng/phòng (khác với bộ lọc "Phòng tập
 * thể" vốn gồm cả phòng gia đình đông người).
 */
export function isCommunalRoom(typeName: string, roomName = ""): boolean {
  const n = `${typeName} ${roomName}`.toLowerCase();
  return /cộng đồng|cong dong|dorm|tập thể|tap the|giường tầng|giuong tang|phòng chung|phong chung/.test(n);
}

/** Giá combo cho MỖI KHÁCH theo loại phòng (dorm: không chia, không giảm). */
export function comboPricePerPerson(roomCost: number, communal: boolean, people: number, fare: number): number {
  return communal
    ? roomCost + fare
    : Math.round(roomCost / people) + fare - COMBO_DISCOUNT;
}

/** Phân loại phòng theo tên hạng + sức chứa. */
function roomKindOf(capacity: number, typeName: string): Exclude<ComboRoomKind, "all"> {
  const n = typeName.toLowerCase();
  if (/dorm|tập thể|tap the|giường tầng|giuong tang|phòng chung|phong chung/.test(n) || capacity >= 4) return "dorm";
  if (capacity <= 1) return "single";
  return "double";
}

export interface ComboBusOption {
  serviceId: string;
  slug: string;
  title: string;
  area: string | null;
  cover: string | null;
  outboundTripId: string;
  returnTripId: string;
  outboundTime: string;
  returnTime: string;
  /**
   * Giá vé khứ hồi cho 1 người (cabin đơn). Chọn điểm xuất phát thì lấy theo
   * bảng giá chặng (`CabinPriceRow`); không chọn thì dùng giá chuyến (đi + về).
   */
  farePerPerson: number;
  /** Điểm đón đã áp vào giá vé (null = giá chuyến mặc định). */
  fareOrigin: string | null;
  /** Số chỗ đơn còn ít nhất giữa 2 chiều. */
  seatsAvailable: number;
  /** Dữ liệu XEM NHANH trong trang combo (không rời phễu đặt). */
  images: string[];
  outboundStops: ComboRouteStop[];
  returnStops: ComboRouteStop[];
}

export interface ComboRouteStop {
  time: string;
  place: string;
  tag: string | null;
}

/** So khớp tên điểm đón (bỏ thừa khoảng trắng, không phân biệt hoa thường). */
function normPlace(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

export interface FareRow {
  pickupPoint: string;
  /** Điểm đến của dòng giá (dòng "Chiều về" thường là Tà Xùa → tỉnh của khách). */
  destination?: string | null;
  ticketType: "ROUND_TRIP" | "OUTBOUND" | "RETURN";
  price: Parameters<typeof toNumber>[0];
}

/** Dòng giá thuộc về điểm xuất phát `origin` của khách không (xét cả 2 kiểu nhập chiều về). */
function rowMatchesOrigin(r: FareRow, o: string): boolean {
  if (normPlace(r.pickupPoint) === o) return true;
  // Dòng "Chiều về" có thể nhập là "Tà Xùa → <tỉnh>" — khi đó tỉnh của khách nằm ở destination.
  return r.ticketType === "RETURN" && !!r.destination && normPlace(r.destination) === o;
}

/** Bảng giá chặng có khai điểm đón này không (dòng bất kỳ). */
export function hasOriginFare(rows: FareRow[], origin: string): boolean {
  const o = normPlace(origin);
  return rows.some((r) => rowMatchesOrigin(r, o));
}

/**
 * Giá vé MỘT CHIỀU cho 1 người theo điểm đón, từ bảng giá chặng.
 * Trả null nếu bảng không khai dòng đúng chiều cho chặng này.
 */
export function legFareFor(rows: FareRow[], origin: string, dir: "OUTBOUND" | "RETURN"): number | null {
  const o = normPlace(origin);
  const row = rows.find((r) => r.ticketType === dir && rowMatchesOrigin(r, o));
  const p = row ? toNumber(row.price) : null;
  return p && p > 0 ? p : null;
}

/**
 * Giá vé KHỨ HỒI cho 1 người theo điểm đón, từ bảng giá chặng (`CabinPriceRow`):
 * ưu tiên dòng "Khứ hồi"; không có thì cộng dòng "Chiều đi" + "Chiều về".
 * Trả null nếu bảng giá không khai chặng này.
 */
export function roundTripFareFor(rows: FareRow[], origin: string): number | null {
  const o = normPlace(origin);
  const round = rows.find((r) => r.ticketType === "ROUND_TRIP" && normPlace(r.pickupPoint) === o);
  if (round) {
    const p = toNumber(round.price);
    if (p && p > 0) return p;
  }
  const out = legFareFor(rows, origin, "OUTBOUND");
  const ret = legFareFor(rows, origin, "RETURN");
  if (out != null && ret != null) return out + ret;
  return null;
}

const COMBO_DEFAULT_ORIGIN = "Hà Nội";

/**
 * Giá vé KHỨ HỒI/khách cho combo — cùng quy tắc với trang /xe-cabin (`getCabinOperators`):
 * - nhà xe có bảng giá chặng (riêng, thiếu thì chung): theo bảng, điểm đón = `origin`
 *   (không chọn → "Hà Nội"); chọn điểm mà bảng không khai → null (nhà xe không đón ở đây);
 *   không chọn điểm mà bảng thiếu dòng Hà Nội → lùi về giá chuyến.
 * - chưa có bảng giá: giá chuyến đi + về.
 * Chuyến ẢO của nhà xe chưa từng có chuyến thật mang giá 0 → chỉ còn bảng giá để tính.
 */
export function comboRoundTripFare(rows: FareRow[], origin: string | null, tripFare: number): number | null {
  if (rows.length > 0) {
    if (origin) return roundTripFareFor(rows, origin);
    return roundTripFareFor(rows, COMBO_DEFAULT_ORIGIN) ?? (tripFare > 0 ? tripFare : null);
  }
  return tripFare > 0 ? tripFare : null;
}

/**
 * Danh sách ĐIỂM XUẤT PHÁT cho ô tìm combo: các điểm đón đã khai trong bảng
 * giá chặng (của nhà xe cabin đang đăng + bảng giá chung), theo thứ tự khai báo.
 */
export async function getComboOrigins(): Promise<string[]> {
  const rows = await prisma.cabinPriceRow.findMany({
    where: { OR: [{ serviceId: null }, { service: { category: "CABIN", published: true } }] },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { pickupPoint: true, destination: true, ticketType: true },
  });
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of rows) {
    // Điểm xuất phát CỦA KHÁCH: dòng "Chiều về" có thể nhập "Tà Xùa → <tỉnh>"
    // (tỉnh nằm ở destination). "Tà Xùa" không bao giờ là điểm xuất phát.
    const candidates = r.ticketType === "RETURN" ? [r.destination, r.pickupPoint] : [r.pickupPoint];
    for (const place of candidates) {
      const key = normPlace(place ?? "");
      if (!key || key === "tà xùa" || seen.has(key)) continue;
      seen.add(key);
      out.push(place!.trim());
    }
  }
  return out;
}

export interface ComboRoomFeatures {
  hasBathtub: boolean;
  cloudView: boolean;
  breakfast: boolean;
  airCon: boolean;
  heating: boolean;
}

export interface ComboRoomOption {
  serviceId: string;
  slug: string;
  title: string; // tên homestay
  area: string | null;
  distanceKm: number | null; // cách trung tâm Tà Xùa (km)
  cover: string | null;
  featured: boolean; // Nổi bật → ưu tiên lên đầu kết quả combo
  priorityOrder: number; // thứ tự ưu tiên trong nhóm Nổi bật (số lớn hơn lên trước)
  /** Trẻ DƯỚI tuổi này miễn phí (không tính sức chứa/giá) — cấu hình theo từng home. */
  childFreeUnderAge: number;
  roomTypeId: string;
  roomId: string;
  roomName: string;
  typeName: string; // tên hạng phòng (để hiện thẻ gộp các phòng giống nhau)
  capacity: number;
  /** Sức chứa TỐI ĐA khi nhận thêm khách kèm phụ thu (≥ capacity; bằng nhau = không nhận thêm). */
  maxCapacity: number;
  /** Phụ thu CẢ KỲ cho mỗi khách vượt chuẩn (extraPersonFee × số đêm). */
  extraFeeStay: number;
  /** Tổng tiền phòng cho cả kỳ lưu trú (1 phòng). */
  roomCost: number;
  /** Tổng GIÁ GẠCH (niêm yết) cả kỳ cho 1 phòng; null = không giảm. */
  roomCostOld: number | null;
  features: ComboRoomFeatures;
  easyRoad: boolean;
  pool: boolean;
  kind: Exclude<ComboRoomKind, "all">;
  /** Phòng cộng đồng: roomCost là giá MỖI NGƯỜI, không chia theo đoàn. */
  communal: boolean;
  /** Admin tick "không giảm 25k khi đặt combo" cho phòng này. */
  noComboDiscount: boolean;
  /** Dữ liệu XEM NHANH trong trang combo: ảnh (không video), mô tả, tiện ích phòng. */
  images: string[];
  description: string | null;
  amenityList: string[];
}

/** Một nhóm phòng GIỐNG NHAU (cùng hạng + giá + sức chứa) trong một phương án ghép. */
export interface ComboPlanGroup {
  room: ComboRoomOption; // phòng đại diện (ảnh/mô tả/tiện ích để xem nhanh)
  roomIds: string[]; // các phòng cụ thể sẽ giữ khi đặt (mặc định: đầu nhóm)
  count: number;
  /** Tiền 1 phòng cả kỳ (phòng cộng đồng: giá 1 NGƯỜI cả kỳ). */
  unitCost: number;
  /**
   * MỌI phòng giống nhau còn trống trong nhóm — để hiện "còn N phòng", cho khách
   * chọn đúng căn VÀ xem đúng ảnh/mô tả của căn đang chọn. `roomName` là tên gọn
   * (bỏ tiền tố hạng); `room` giữ đầy đủ ảnh/mô tả/sức chứa của chính căn đó.
   */
  options: { roomId: string; roomName: string; room: ComboRoomOption }[];
}

/**
 * Phương án ghép phòng cho CẢ ĐOÀN trong một homestay, ví dụ 10 người →
 * "5× Phòng đơn" hoặc "4× Phòng đôi + 2× Phòng đơn" hoặc "10 giường cộng đồng".
 */
export interface ComboStayPlan {
  id: string; // serviceId + danh sách roomIds
  label: string; // "4× Phòng đôi + 1× Phòng đơn"
  groups: ComboPlanGroup[];
  roomIds: string[];
  roomCount: number;
  capacity: number; // tổng sức chứa của các phòng trong phương án
  /** TỔNG tiền phòng cả kỳ cho cả đoàn (cộng đồng: đã nhân số người). */
  roomCost: number;
  /** TỔNG giá gạch (niêm yết) cả kỳ cả đoàn; null = không giảm. */
  roomCostOld: number | null;
  /** Toàn giường cộng đồng (giá theo người → không trừ giảm giá combo). */
  communal: boolean;
  /**
   * KHÔNG trừ giảm giá combo (−25k/khách): giường cộng đồng, hoặc phương án có ít nhất
   * một phòng admin tick "không giảm 25k khi đặt combo".
   */
  noDiscount: boolean;
  /** Số khách Ở GHÉP vượt sức chứa chuẩn (phòng đôi 2 người nhận tối đa 3...). 0 = không. */
  extraGuests: number;
  /** Tổng phụ thu cả kỳ cho số khách ở ghép (ĐÃ gộp vào roomCost). */
  extraCost: number;
  /** Điểm view/tiện ích 0..1: tỉ lệ chỗ ngủ được hưởng từng tiện ích, có trọng số. */
  amenityScore: number;
}

/**
 * Giá combo mỗi khách của một PHƯƠNG ÁN (tiền phòng là TỔNG cả đoàn).
 * `busPerPerson` = tiền xe MỖI KHÁCH theo cách xếp mặc định (busCostPerPerson: cả đoàn nằm ghép
 * = 1 vé khứ hồi/người; khách chọn nằm riêng khi đặt thì người đó ×2).
 */
export function planPricePerPerson(totalRoomCost: number, noDiscount: boolean, people: number, busPerPerson: number): number {
  return Math.max(0, Math.round(totalRoomCost / people) + busPerPerson - (noDiscount ? 0 : COMBO_DISCOUNT));
}

/** Một homestay cùng các phương án ghép phòng khả dụng (cho thẻ combo v3). */
export interface ComboHomeOption {
  serviceId: string;
  slug: string;
  title: string;
  area: string | null;
  distanceKm: number | null; // cách trung tâm Tà Xùa (km)
  cover: string | null;
  featured: boolean; // Nổi bật → ưu tiên lên đầu kết quả combo
  priorityOrder: number; // thứ tự ưu tiên trong nhóm Nổi bật (số lớn hơn lên trước)
  amenities: string[]; // nhãn tiện ích để hiển thị
  /** Trẻ DƯỚI tuổi này miễn phí ở home này. */
  childFreeUnderAge: number;
  /** Số khách TÍNH PHÍ ở home này = người lớn + trẻ ≥ ngưỡng (quyết định ghép phòng + chia giá). */
  billable: number;
  /** Số trẻ MIỄN PHÍ ở home này (dưới ngưỡng) — đi/ngủ cùng, không tính tiền. */
  freeChildren: number;
  rooms: ComboRoomOption[]; // mọi phòng trống khớp tiêu chí (tham khảo)
  /** Phương án ghép phòng đủ chỗ cho cả đoàn, rẻ nhất trước: 3 kiểu ghép + các phương án phủ nốt căn trống còn lại. */
  plans: ComboStayPlan[];
  bestPricePerPerson: number; // giá rẻ nhất đạt được (xe rẻ nhất + phương án rẻ nhất)
}

export interface ComboSearchResult {
  fromKey: string; // ngày đi (đêm lên xe chiều đi)
  toKey: string; // ngày về (xe chạy chiều về) = check-out
  checkIn: string;
  checkOut: string;
  nights: number;
  /** TỔNG số khách (người lớn + mọi trẻ, kể cả trẻ miễn phí) — để hiển thị tóm tắt. */
  people: number;
  /** Người lớn. */
  adults: number;
  /** Tuổi từng trẻ (số tính phí/miễn phí xét theo ngưỡng của từng home). */
  childrenAges: number[];
  /** Điểm xuất phát khách đã chọn (null = không chọn → giá chuyến mặc định). */
  origin: string | null;
  budget: number | null;
  /** Khoảng giá đã chọn ở dropdown ("Dưới 900k" → priceMax; "Trên 2tr" → priceMin). */
  priceMax: number | null;
  priceMin: number | null;
  busCount: number;
  roomCount: number;
  /** Tổng số phương án ghép phòng trên toàn bộ homestay. */
  planCount: number;
  buses: ComboBusOption[];
  homes: ComboHomeOption[];
}


// ---- Thuật toán ghép phòng cho cả đoàn ----

/** Giới hạn để kết quả còn thực tế: tối đa 10 phòng/phương án. */
const MAX_PLAN_ROOMS = 10;
/** 3 kiểu ghép khác nhau/homestay — CỘNG thêm các phương án cần để mọi căn trống đều hiện ra. */
const MAX_PLANS_PER_HOME = 3;

/** Trọng số điểm view/tiện ích của phương án (view mây nặng nhất). */
const AMENITY_WEIGHTS: [keyof ComboRoomFeatures, number][] = [
  ["cloudView", 2],
  ["hasBathtub", 1],
  ["breakfast", 1],
  ["airCon", 0.5],
  ["heating", 0.5],
];

function makePlan(
  serviceId: string,
  groups: ComboPlanGroup[],
  roomCost: number,
  capacity: number,
  communal: boolean,
  extraGuests = 0,
  extraCost = 0,
  roomCostOld: number | null = null,
): ComboStayPlan {
  const roomIds = groups.flatMap((g) => g.roomIds);
  // Điểm tiện ích = tỉ lệ CHỖ NGỦ được hưởng từng tiện ích, có trọng số
  // (+ hồ bơi/đường dễ đi ở cấp homestay).
  let wsum = 0;
  let score = 0;
  for (const [f, w] of AMENITY_WEIGHTS) {
    wsum += w;
    const capWith = groups.reduce((n, g) => n + (g.room.features[f] ? g.count * g.room.capacity : 0), 0);
    score += w * Math.min(1, capacity > 0 ? capWith / capacity : 0);
  }
  wsum += 1;
  score += (groups[0]?.room.pool ? 0.5 : 0) + (groups[0]?.room.easyRoad ? 0.5 : 0);
  // Nhãn gộp theo TÊN hạng phòng (cùng hạng nhưng khác giá vẫn hiện 1 mục).
  const byName = new Map<string, number>();
  for (const g of groups) byName.set(g.room.typeName, (byName.get(g.room.typeName) ?? 0) + g.count);
  const roomTotal = groups.reduce((n, g) => n + g.count, 0);
  const label = communal
    ? `${roomTotal > 1 ? `${roomTotal} phòng ` : ""}giường cộng đồng`
    : [...byName].map(([n, c]) => `${c}× ${n}`).join(" + ") +
      (extraGuests > 0 ? ` (+${extraGuests} khách ở ghép)` : "");
  return {
    // Phân biệt phương án chuẩn và phương án ở ghép trên CÙNG tập phòng.
    id: `${serviceId}:${[...roomIds].sort().join(",")}${extraGuests > 0 ? `:+${extraGuests}` : ""}`,
    label,
    groups,
    roomIds,
    roomCount: roomIds.length,
    capacity,
    roomCost,
    roomCostOld: roomCostOld != null && roomCostOld > roomCost ? roomCostOld : null,
    communal,
    noDiscount: communal || groups.some((g) => g.room.noComboDiscount),
    extraGuests,
    extraCost,
    amenityScore: wsum > 0 ? score / wsum : 0,
  };
}

/**
 * Sinh các phương án ghép phòng ĐỦ CHỖ cho cả đoàn trong 1 homestay.
 *
 * Phòng thường: gộp phòng giống nhau thành nhóm rồi duyệt tổ hợp số phòng mỗi
 * nhóm (DFS, chặn nhánh) — chỉ giữ phương án TỐI THIỂU (bỏ bớt bất kỳ phòng nào
 * là thiếu chỗ), xếp theo tổng tiền rẻ nhất, lấy 3 kiểu ghép khác nhau + các phương án phủ nốt mọi căn trống.
 * Phòng cộng đồng (giá mỗi người): xếp đủ người vào các phòng dorm rẻ nhất.
 */
export function buildStayPlans(rooms: ComboRoomOption[], people: number): ComboStayPlan[] {
  if (rooms.length === 0) return [];
  const serviceId = rooms[0].serviceId;
  const plans: ComboStayPlan[] = [];
  const normal = rooms.filter((r) => !r.communal);
  const dorm = rooms.filter((r) => r.communal);

  // Tên phòng gọn (bỏ tiền tố tên hạng) để hiện danh sách "còn N phòng".
  const plainName = (r: ComboRoomOption) =>
    r.roomName.startsWith(`${r.typeName} · `) ? r.roomName.slice(r.typeName.length + 3) : r.roomName;

  // --- Phòng thường: nhóm phòng giống nhau (cùng hạng + giá + sức chứa + phụ thu) ---
  interface G { rep: ComboRoomOption; ids: string[]; names: string[]; rooms: ComboRoomOption[]; cap: number; capMax: number; extraStay: number; cost: number; costOld: number }
  const gm = new Map<string, G>();
  for (const r of normal) {
    // Tách nhóm theo cờ "không giảm combo" để khách đổi căn trong nhóm không làm lệch giá.
    const k = `${r.roomTypeId}|${r.roomCost}|${r.capacity}|${r.maxCapacity}|${r.extraFeeStay}|${r.noComboDiscount ? 1 : 0}`;
    const g = gm.get(k);
    if (g) { g.ids.push(r.roomId); g.names.push(plainName(r)); g.rooms.push(r); }
    // costOld = giá gạch 1 phòng cả kỳ (null → dùng giá bán, để tổng gạch vẫn đúng).
    else gm.set(k, { rep: r, ids: [r.roomId], names: [plainName(r)], rooms: [r], cap: r.capacity, capMax: r.maxCapacity, extraStay: r.extraFeeStay, cost: r.roomCost, costOld: r.roomCostOld ?? r.roomCost });
  }
  // Nhóm rẻ nhất TÍNH TRÊN MỖI CHỖ đứng trước để DFS tìm phương án tốt sớm.
  const groups = [...gm.values()].sort((a, b) => a.cost / a.cap - b.cost / b.cap);

  // Duyệt tổ hợp số phòng mỗi nhóm cho tới khi đủ chỗ (sức chứa tính bằng capOf):
  // chỉ giữ phương án TỐI THIỂU (bỏ 1 phòng bất kỳ là thiếu chỗ).
  interface Found { counts: number[]; cost: number; costOld: number; capStd: number; used: number }
  const maxRooms = Math.min(MAX_PLAN_ROOMS, people);
  const enumerate = (capOf: (g: G) => number): Found[] => {
    const counts = new Array<number>(groups.length).fill(0);
    const found: Found[] = [];
    (function dfs(i: number, cost: number, costOld: number, cap: number, capStd: number, used: number) {
      if (cap >= people) {
        for (let j = 0; j < groups.length; j++) {
          if (counts[j] > 0 && cap - capOf(groups[j]) >= people) return; // thừa phòng
        }
        found.push({ counts: [...counts], cost, costOld, capStd, used });
        return;
      }
      if (i >= groups.length || used >= maxRooms || found.length > 400) return;
      const g = groups[i];
      const maxK = Math.min(g.ids.length, Math.ceil((people - cap) / capOf(g)), maxRooms - used);
      for (let k = maxK; k >= 0; k--) {
        counts[i] = k;
        dfs(i + 1, cost + k * g.cost, costOld + k * g.costOld, cap + k * capOf(g), capStd + k * g.cap, used + k);
      }
      counts[i] = 0;
    })(0, 0, 0, 0, 0, 0);
    return found;
  };

  // Lượt 1: sức chứa CHUẨN (không phụ thu). Lượt 2: cho phép Ở GHÉP tới sức chứa
  // tối đa (phòng đôi 2 người nhận 3...) — cộng phụ thu vào giá, xếp khách ghép
  // vào phòng có phụ thu rẻ nhất. Giữ cả 2 loại để khách tự chọn tiết kiệm/thoải mái.
  const variants: { f: Found; extraGuests: number; extraCost: number }[] =
    enumerate((g) => g.cap).map((f) => ({ f, extraGuests: 0, extraCost: 0 }));
  if (groups.some((g) => g.capMax > g.cap)) {
    for (const f of enumerate((g) => g.capMax)) {
      const extraGuests = people - f.capStd;
      if (extraGuests <= 0) continue; // không cần ở ghép → trùng lượt 1
      const slots = groups
        .map((g, j) => ({ fee: g.extraStay, cap: f.counts[j] * (g.capMax - g.cap) }))
        .filter((s) => s.cap > 0)
        .sort((a, b) => a.fee - b.fee);
      let rem = extraGuests;
      let extraCost = 0;
      for (const sl of slots) {
        const take = Math.min(rem, sl.cap);
        extraCost += take * sl.fee;
        rem -= take;
        if (rem === 0) break;
      }
      if (rem > 0) continue;
      // Phụ thu ở ghép không giảm → cộng vào cả giá bán lẫn giá gạch.
      variants.push({ f: { ...f, cost: f.cost + extraCost, costOld: f.costOld + extraCost }, extraGuests, extraCost });
    }
  }

  variants.sort((a, b) => a.f.cost - b.f.cost || a.f.used - b.f.used);
  const seenLabel = new Set<string>();
  // COMBO PHẢI HIỆN HẾT PHÒNG TRỐNG: ngoài 3 phương án khác kiểu ghép rẻ nhất, giữ thêm mọi
  // phương án (rẻ trước) đưa vào ít nhất một căn CHƯA xuất hiện ở phương án nào — vd hạng có
  // các căn khác giá (căn 6-8 giá 750k, căn 2-4 giá 800k, căn 5 giá 900k). Trước đây chỉ giữ
  // bản rẻ nhất của mỗi kiểu ghép nên những căn còn trống nhưng giá cao hơn không bao giờ hiện.
  const covered = new Set<string>();
  let basePlans = 0;
  for (const { f, extraGuests, extraCost } of variants) {
    const isNewLabelSlot = basePlans < MAX_PLANS_PER_HOME;
    const addsRoom = groups.some((g, j) => f.counts[j] > 0 && g.ids.some((id) => !covered.has(id)));
    if (!isNewLabelSlot && !addsRoom) continue;
    const pgs: ComboPlanGroup[] = [];
    for (let j = 0; j < groups.length; j++) {
      if (f.counts[j] === 0) continue;
      const g = groups[j];
      pgs.push({
        room: g.rep,
        roomIds: g.ids.slice(0, f.counts[j]),
        count: f.counts[j],
        unitCost: g.cost,
        options: g.ids.map((id, x) => ({ roomId: id, roomName: g.names[x], room: g.rooms[x] })),
      });
    }
    const plan = makePlan(serviceId, pgs, f.cost, f.capStd + extraGuests, false, extraGuests, extraCost, f.costOld);
    const newLabel = !seenLabel.has(plan.label);
    // Giữ khi: kiểu ghép mới (trong hạn mức 3), HOẶC có căn chưa hiện ở phương án nào.
    if (!(newLabel && isNewLabelSlot) && !addsRoom) continue;
    if (newLabel) { seenLabel.add(plan.label); basePlans++; }
    for (const g of pgs) for (const o of g.options) covered.add(o.roomId);
    plans.push(plan);
  }

  // --- Giường cộng đồng: xếp đủ người vào các phòng dorm rẻ nhất ---
  if (dorm.length > 0) {
    const sorted = [...dorm].sort((a, b) => a.roomCost - b.roomCost);
    const dormCovered = new Set<string>();
    const dormPlan = (order: ComboRoomOption[]) => {
      const pgm = new Map<string, ComboPlanGroup>();
      let remaining = people;
      let total = 0;
      let totalOld = 0;
      let cap = 0;
      for (const r of order) {
        if (remaining <= 0) break;
        const take = Math.min(remaining, r.capacity);
        total += r.roomCost * take; // giá dorm = giá MỖI NGƯỜI
        totalOld += (r.roomCostOld ?? r.roomCost) * take;
        cap += r.capacity;
        remaining -= take;
        dormCovered.add(r.roomId);
        const k = `${r.roomTypeId}|${r.roomCost}`;
        const g = pgm.get(k);
        if (g) { g.roomIds.push(r.roomId); g.count += 1; g.options.push({ roomId: r.roomId, roomName: plainName(r), room: r }); }
        else pgm.set(k, { room: r, roomIds: [r.roomId], count: 1, unitCost: r.roomCost, options: [{ roomId: r.roomId, roomName: plainName(r), room: r }] });
      }
      if (remaining <= 0) plans.push(makePlan(serviceId, [...pgm.values()], total, cap, true, 0, 0, totalOld));
      return remaining <= 0;
    };
    // Phương án rẻ nhất trước; rồi mỗi phòng dorm CHƯA hiện (giá cao hơn) được 1 phương án
    // bắt đầu từ chính phòng đó — để combo hiện hết phòng cộng đồng còn trống.
    if (dormPlan(sorted)) {
      for (const r of sorted) {
        if (!dormCovered.has(r.roomId)) dormPlan([r, ...sorted.filter((x) => x.roomId !== r.roomId)]);
      }
    }
  }

  plans.sort((a, b) => a.roomCost - b.roomCost || a.roomCount - b.roomCount);
  return plans;
}

/**
 * Tìm combo (xe cabin khứ hồi + phòng homestay) khớp nhất với giá mong muốn.
 *
 * Ngày: ngày đi = đêm lên xe (chiều đi) → check-in = ngày đi + 1; ngày về = ngày
 * xe chạy chiều về = ngày check-out. Số đêm = check-out − check-in.
 *
 * Giá combo / khách = (tiền phòng cả kỳ ÷ số người) + vé khứ hồi 1 người − 25k.
 * Riêng PHÒNG CỘNG ĐỒNG (giá phòng = giá mỗi người): combo / khách = giá phòng
 * cộng đồng + vé khứ hồi (không chia theo đoàn, không trừ 25k).
 * Kết quả sắp xếp theo mức gần giá mong muốn nhất (không nhập giá → rẻ trước).
 */
export async function findComboMatches(input: {
  fromKey: string;
  toKey: string;
  /** Người lớn (nếu không truyền adults thì dùng people làm số người lớn — link cũ). */
  people: number;
  adults?: number | null;
  /** Tuổi từng trẻ; trẻ dưới ngưỡng miễn phí của mỗi home không tính phí/sức chứa. */
  childrenAges?: number[] | null;
  /** Điểm xuất phát (điểm đón) — giá vé lấy theo bảng giá chặng của nhà xe. */
  origin?: string | null;
  budget: number | null;
  /** Mức giá trần/sàn mỗi khách từ dropdown (null = không lọc). */
  priceMax?: number | null;
  priceMin?: number | null;
  filters: ComboFilters;
  roomKind?: ComboRoomKind;
  limit?: number;
}): Promise<ComboSearchResult | null> {
  const { fromKey, toKey, filters } = input;
  const origin = input.origin?.trim() || null;
  const roomKind = input.roomKind ?? "all";
  // Người lớn + trẻ em. Số khách TÍNH PHÍ (billable) xét RIÊNG theo ngưỡng miễn phí của từng home.
  const adults = Math.max(1, Math.floor(input.adults ?? input.people) || 1);
  const childrenAges = (input.childrenAges ?? []).filter((a) => Number.isFinite(a) && a >= 0);
  const totalPeople = adults + childrenAges.length;
  // Số tính phí tối thiểu (mọi trẻ đều miễn phí) để lọc sơ bộ danh sách xe — từng thẻ lọc tiếp theo home.
  const minBillable = adults;
  const priceMax = input.priceMax && input.priceMax > 0 ? input.priceMax : null;
  const priceMin = input.priceMin && input.priceMin > 0 ? input.priceMin : null;
  // Chọn khoảng giá → neo sắp xếp vào mép khoảng (ưu tiên combo sát mức đã chọn).
  const budget = input.budget && input.budget > 0 ? input.budget : priceMax ?? priceMin;
  const inRange = (p: number) => (priceMax == null || p <= priceMax) && (priceMin == null || p >= priceMin);

  const from = parseDateOnly(fromKey); // ngày đi (chiều đi)
  const to = parseDateOnly(toKey); // ngày về (chiều về) = check-out
  const checkIn = addDays(from, 1);
  const checkOut = to;
  const nights = enumerateNights(checkIn, checkOut);
  if (nights.length < 1) return null; // ngày về phải sau check-in ít nhất 1 đêm
  // Ngày đi đã qua / kỳ quá dài: không ghép (đặt cũng bị từ chối) — tránh hiện phương án không đặt được.
  if (from < today() || nights.length > 60) return null;

  const base: Omit<ComboSearchResult, "busCount" | "roomCount" | "planCount" | "buses" | "homes"> = {
    fromKey,
    toKey,
    checkIn: toDateKey(checkIn),
    checkOut: toDateKey(checkOut),
    nights: nights.length,
    people: totalPeople,
    adults,
    childrenAges,
    origin,
    budget,
    priceMax,
    priceMin,
  };

  const [allBuses, rooms] = await Promise.all([
    findBuses(from, to, origin),
    findRooms(nights, filters, roomKind),
  ]);
  // Lọc sơ bộ: xe còn đủ chỗ cho ít nhất số người lớn (từng thẻ lọc tiếp theo số tính phí của home).
  const buses = allBuses.filter((b) => cabinAllocation(minBillable, b.seatsAvailable) != null);

  // Gom phòng theo homestay rồi SINH PHƯƠNG ÁN GHÉP PHÒNG đủ chỗ cho cả đoàn
  // (10 người → "5× Phòng đơn" / "4× Phòng đôi + 2× Phòng đơn" / dorm...).
  // Tiền xe/khách RẺ NHẤT cho đoàn `n` người, theo cách xếp buồng thực tế của từng xe
  // (đoàn lẻ có người nằm buồng riêng = 2×vé) — khớp đúng giá khi bấm đặt.
  const cheapestBusFor = (n: number) => {
    const costs = buses.map((b) => busCostPerPerson(b, n)).filter((c): c is number => c != null);
    return costs.length ? Math.min(...costs) : 0;
  };
  const FEAT: [keyof ComboRoomFeatures, string][] = [
    ["cloudView", "⛅ View mây"],
    ["hasBathtub", "🛁 Bồn tắm"],
    ["breakfast", "🍳 Ăn sáng"],
    ["airCon", "❄️ Điều hòa"],
    ["heating", "🔥 Đêm sưởi"],
  ];
  const homeMap = new Map<string, ComboHomeOption>();
  for (const r of rooms) {
    let h = homeMap.get(r.serviceId);
    if (!h) {
      // Số tính phí của home = người lớn + trẻ TỪ ngưỡng miễn phí của chính home đó.
      const billable = adults + payingChildren(childrenAges, r.childFreeUnderAge);
      h = { serviceId: r.serviceId, slug: r.slug, title: r.title, area: r.area, distanceKm: r.distanceKm, cover: r.cover, featured: r.featured, priorityOrder: r.priorityOrder, amenities: [], childFreeUnderAge: r.childFreeUnderAge, billable, freeChildren: childrenAges.length - payingChildren(childrenAges, r.childFreeUnderAge), rooms: [], plans: [], bestPricePerPerson: 0 };
      homeMap.set(r.serviceId, h);
    }
    h.rooms.push(r);
  }
  const homes: ComboHomeOption[] = [];
  for (const h of homeMap.values()) {
    // Ghép phòng + chia giá theo SỐ TÍNH PHÍ của home (trẻ miễn phí ở cùng, không chiếm chỗ tính phí).
    let plans = buildStayPlans(h.rooms, h.billable);
    const cheapestBus = cheapestBusFor(h.billable);
    // Lọc khoảng giá theo phương án rẻ nhất có thể (xe rẻ nhất): ngoài khoảng → ẩn.
    if ((priceMax != null || priceMin != null) && buses.length > 0) {
      plans = plans.filter((p) => inRange(planPricePerPerson(p.roomCost, p.noDiscount, h.billable, cheapestBus)));
    }
    if (plans.length === 0) continue;
    const amen = new Set<string>();
    for (const r of h.rooms) {
      for (const [k, label] of FEAT) if (r.features[k]) amen.add(label);
      if (r.pool) amen.add("🏊 Hồ bơi");
      if (r.easyRoad) amen.add("🛣️ Đường dễ đi");
    }
    h.amenities = [...amen];
    h.plans = plans;
    h.bestPricePerPerson = Math.min(...plans.map((p) => planPricePerPerson(p.roomCost, p.noDiscount, h.billable, cheapestBus)));
    homes.push(h);
  }
  // Ưu tiên: homestay Nổi bật (+ thứ tự ưu tiên) lên đầu, rồi mới tới giá (gần ngân sách).
  const prRank = (h: ComboHomeOption) => (h.featured ? (h.priorityOrder || 0) + 1 : 0);
  homes.sort((a, b) => {
    const pr = prRank(b) - prRank(a);
    if (pr !== 0) return pr;
    const da = budget != null ? Math.abs(a.bestPricePerPerson - budget) : a.bestPricePerPerson;
    const db = budget != null ? Math.abs(b.bestPricePerPerson - budget) : b.bestPricePerPerson;
    return da - db;
  });

  return {
    ...base,
    busCount: buses.length,
    roomCount: homes.reduce((n, h) => n + h.rooms.length, 0),
    planCount: homes.reduce((n, h) => n + h.plans.length, 0),
    buses,
    homes,
  };
}

async function findBuses(from: Date, to: Date, origin: string | null): Promise<ComboBusOption[]> {
  const [services, generalRows] = await Promise.all([
    prisma.service.findMany({
      where: { category: "CABIN", published: true, contactOnly: false },
      orderBy: [{ featured: "desc" }, { title: "asc" }],
      include: {
        images: { orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }], take: 6 },
        cabinRoutes: { include: { stops: { orderBy: { sortOrder: "asc" } } } },
        cabinPriceRows: true,
      },
    }),
    // Bảng giá chung (serviceId=null) dùng cho nhà xe chưa có bảng giá riêng.
    prisma.cabinPriceRow.findMany({ where: { serviceId: null } }),
  ]);

  // Lịch cabin luôn mở bán: chuyến thật hoặc chuyến ảo mỗi ngày; ngày HẾT VÉ ⇒ loại nhà xe.
  const ids = services.map((s) => s.id);
  const [outMap, retMap] = await Promise.all([
    tripsOnDate(ids, "OUTBOUND", from),
    tripsOnDate(ids, "RETURN", to),
  ]);
  const out: ComboBusOption[] = [];
  for (const s of services) {
    const outbound: TripView | undefined = outMap.get(s.id);
    const ret: TripView | undefined = retMap.get(s.id);
    if (!outbound || !ret || outbound.closed || ret.closed) continue;
    // Giá theo bảng giá chặng (riêng của nhà xe, thiếu thì bảng chung), chưa có bảng → giá chuyến.
    const rows = s.cabinPriceRows.length ? s.cabinPriceRows : generalRows;
    const fare = comboRoundTripFare(rows, origin, outbound.price + ret.price);
    if (fare == null || fare <= 0) continue; // không đón ở điểm này / chưa có giá
    const fareOrigin: string | null = origin && rows.length > 0 ? origin : null;
    const stopsOf = (dir: "OUTBOUND" | "RETURN") =>
      (s.cabinRoutes.find((r) => r.direction === dir)?.stops ?? []).map((st) => ({
        time: st.time,
        place: st.place,
        tag: st.tag,
      }));
    out.push({
      serviceId: s.id,
      slug: s.slug,
      title: s.title,
      area: s.area,
      cover: s.images[0]?.url ?? null,
      outboundTripId: outbound.id,
      returnTripId: ret.id,
      outboundTime: outbound.departureTime,
      returnTime: ret.departureTime,
      farePerPerson: fare,
      fareOrigin,
      seatsAvailable: Math.min(outbound.seatsAvailable, ret.seatsAvailable),
      images: s.images.map((i) => i.url).filter((u) => !VIDEO_URL_RE.test(u)),
      outboundStops: stopsOf("OUTBOUND"),
      returnStops: stopsOf("RETURN"),
    });
  }
  return out;
}

async function findRooms(
  nights: Date[],
  filters: ComboFilters,
  roomKind: ComboRoomKind,
): Promise<ComboRoomOption[]> {
  const services = await prisma.service.findMany({
    where: {
      category: "HOMESTAY",
      published: true,
      contactOnly: false, // không quản lý lịch trên web → không ghép combo
      ...(filters.easyRoad ? { easyRoad: true } : {}),
      ...(filters.pool ? { pool: true } : {}),
    },
    include: {
      images: { orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }], take: 1 },
      roomTypes: {
        where: {
          // Tiện ích ở cấp hạng phòng.
          ...(filters.bathtub ? { hasBathtub: true } : {}),
          ...(filters.cloudView ? { cloudView: true } : {}),
          ...(filters.breakfast ? { breakfast: true } : {}),
          ...(filters.airCon ? { airCon: true } : {}),
          ...(filters.heating ? { heating: true } : {}),
        },
        // Giá & sức chứa ở cấp phòng con (kèm ảnh riêng của phòng để hiện thẻ theo phòng).
        // KHÔNG lọc sức chứa ở đây: đoàn đông được GHÉP NHIỀU PHÒNG (buildStayPlans).
        include: {
          rooms: {
            include: { images: { orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }], take: 12 } },
          },
        },
      },
    },
  });

  // Tất cả phòng con khớp tiêu chí.
  const allRooms = services
    // Kỳ vi phạm chính sách bán cuối tuần của home (vd chỉ đêm T7) → không ghép combo
    // (trước đây vẫn hiện kết quả rồi mới báo lỗi khi gửi đơn).
    .filter((s) => checkWeekendPolicy(s.weekendPolicy, nights) == null)
    .flatMap((s) =>
    s.roomTypes.flatMap((rt) =>
      rt.rooms.map((room) => ({ s, rt, room })),
    ),
  );
  if (allRooms.length === 0) return [];

  const roomIds = allRooms.map((x) => x.room.id);
  const statuses = await prisma.roomDayStatus.findMany({
    where: { roomId: { in: roomIds }, date: { in: nights } },
  });
  const occupied = new Map<string, Set<string>>();
  for (const st of statuses) {
    if (st.status === "AVAILABLE") continue;
    let set = occupied.get(st.roomId);
    if (!set) occupied.set(st.roomId, (set = new Set()));
    set.add(toDateKey(st.date));
  }

  const out: ComboRoomOption[] = [];
  for (const { s, rt, room } of allRooms) {
    const occ = occupied.get(room.id);
    const free = !occ || nights.every((d) => !occ.has(toDateKey(d)));
    if (!free) continue;
    const kind = roomKindOf(room.capacity, rt.name);
    if (roomKind !== "all" && kind !== roomKind) continue;
    // Đêm nào giá ≤ 0 (IB / chưa nhập giá) → không ghép combo (trước đây đêm đó bị tính 0đ).
    const pr = roomPricing(room);
    if (nights.some((d) => priceForDay(d, pr, null) <= 0)) continue;
    const { total: roomCost, strikeTotal: roomCostOld } = stayStrike(nights, room);
    if (roomCost <= 0) continue;
    out.push({
      serviceId: s.id,
      slug: s.slug,
      title: s.title,
      area: s.area,
      distanceKm: s.distanceKm ?? null,
      cover: firstImageUrl(room.images) ?? (rt.imageUrl && !VIDEO_URL_RE.test(rt.imageUrl) ? rt.imageUrl : null) ?? s.images[0]?.url ?? null,
      featured: s.featured,
      priorityOrder: s.priorityOrder,
      childFreeUnderAge: s.childFreeUnderAge ?? DEFAULT_CHILD_FREE_UNDER,
      roomTypeId: rt.id,
      roomId: room.id,
      roomName: `${rt.name} · ${room.name}`,
      typeName: rt.name,
      capacity: room.capacity,
      maxCapacity: Math.max(room.capacity, room.maxCapacity ?? room.capacity),
      extraFeeStay: (toNumber(s.extraPersonFee) ?? 0) * nights.length,
      roomCost,
      roomCostOld,
      features: {
        hasBathtub: rt.hasBathtub,
        cloudView: rt.cloudView,
        breakfast: rt.breakfast,
        airCon: rt.airCon,
        heating: rt.heating,
      },
      easyRoad: s.easyRoad,
      pool: s.pool,
      kind,
      communal: isCommunalRoom(rt.name, room.name),
      noComboDiscount: room.noComboDiscount,
      images: room.images.map((i) => i.url).filter((u) => !VIDEO_URL_RE.test(u)).slice(0, 8),
      description: room.description,
      amenityList: (room.amenities ?? "").split(",").map((a) => a.trim()).filter(Boolean),
    });
  }
  return out;
}

export interface CreateComboBookingResult {
  code: string;
  needsConfirmation: boolean;
}

/**
 * Tạo yêu cầu ĐẶT COMBO (xe cabin khứ hồi + phòng homestay).
 * Giá được TÍNH LẠI phía server. Combo luôn cần admin xác nhận thủ công.
 */
export async function createComboBooking(
  input: ComboBookingInput,
  ctvId?: string | null,
): Promise<CreateComboBookingResult> {
  // Người lớn + tuổi từng trẻ. Số khách TÍNH PHÍ tính lại theo ngưỡng miễn phí của CHÍNH home này.
  const adults = Math.max(1, Math.floor(input.adults ?? input.people) || 1);
  const childrenAges = (input.childrenAges ?? []).filter((a) => Number.isFinite(a) && a >= 0);
  const from = parseDateOnly(input.fromKey); // ngày đi
  const to = parseDateOnly(input.toKey); // ngày về = check-out
  const checkIn = addDays(from, 1);
  const nights = enumerateNights(checkIn, to);
  if (nights.length < 1) throw new Error("Ngày về phải sau ngày nhận phòng ít nhất 1 đêm.");
  // Cùng quy tắc đơn homestay/cabin: không nhận ngày đã qua, kỳ tối đa 60 đêm.
  if (from < today()) throw new Error("Ngày đi đã qua — vui lòng chọn ngày khác.");
  if (nights.length > 60) throw new Error("Kỳ đặt tối đa 60 đêm.");

  // Phương án có thể GHÉP NHIỀU PHÒNG (roomIds); client cũ chỉ gửi roomId đơn.
  const roomIds = [...new Set(input.roomIds?.length ? input.roomIds : input.roomId ? [input.roomId] : [])];
  if (roomIds.length === 0) throw new Error("Thiếu phòng.");
  const roomList = await prisma.room.findMany({
    where: { id: { in: roomIds } },
    include: { roomType: { include: { service: true } } },
  });
  const svc = roomList[0]?.roomType.service;
  if (
    roomList.length !== roomIds.length || !svc || svc.category !== "HOMESTAY" || !svc.published ||
    svc.contactOnly || roomList.some((r) => r.roomType.serviceId !== svc.id)
  ) {
    throw new Error("Phòng homestay không hợp lệ.");
  }
  // Làm tươi lịch phòng từ sheet/API ngay tại server (không phụ thuộc trình duyệt gọi trước).
  await ensureServiceSheetFresh(svc.id).catch(() => {});
  // Số khách TÍNH PHÍ ở home này (trẻ dưới ngưỡng miễn phí ở cùng, không tính). `people` dùng
  // cho mọi phép tính chỗ/giá bên dưới; trẻ miễn phí chỉ hiện trong nhãn.
  const freeUnder = svc.childFreeUnderAge ?? DEFAULT_CHILD_FREE_UNDER;
  const paidKids = payingChildren(childrenAges, freeUnder);
  const freeKids = childrenAges.length - paidKids;
  const people = adults + paidKids;
  const policyNote = checkWeekendPolicy(svc.weekendPolicy, nights);
  if (policyNote) throw new Error(policyNote);
  // Chuyến có thể là chuyến ẢO (lịch luôn mở bán): kiểm tra bằng peekTrip trước, hợp lệ
  // mới tạo chuyến thật để gắn vào đơn.
  const outView = await peekTrip(input.outboundTripId);
  const retView = await peekTrip(input.returnTripId);
  if (!outView || outView.direction !== "OUTBOUND") throw new Error("Chuyến đi không hợp lệ.");
  if (!retView || retView.direction !== "RETURN") throw new Error("Chuyến về không hợp lệ.");
  // Chuyến phải đúng ngày đã chọn, cùng một nhà xe đang đăng, và không rơi vào ngày hết vé.
  if (toDateKey(outView.departureDate) !== input.fromKey || toDateKey(retView.departureDate) !== input.toKey) {
    throw new Error("Chuyến xe không khớp ngày đi/về đã chọn — vui lòng tìm lại.");
  }
  if (outView.serviceId !== retView.serviceId) throw new Error("Chuyến đi và chuyến về phải cùng một nhà xe.");
  const busService = await prisma.service.findFirst({
    where: { id: outView.serviceId, category: "CABIN", published: true, contactOnly: false },
    select: { id: true },
  });
  if (!busService) throw new Error("Nhà xe không còn nhận đặt.");
  if (outView.closed || retView.closed) {
    throw new Error("Nhà xe đã hết vé ngày này — vui lòng chọn nhà xe hoặc ngày khác.");
  }
  const outbound = await materializeTrip(input.outboundTripId);
  const ret = await materializeTrip(input.returnTripId);
  if (!outbound || !ret) throw new Error("Chuyến xe không hợp lệ — vui lòng tìm lại.");

  // Tính tiền TỪNG phòng trong phương án phía server.
  const costs = roomList.map((r) => {
    const pricing = roomPricing(r);
    let c = 0;
    for (const d of nights) {
      const p = priceForDay(d, pricing, null);
      // Đêm giá ≤ 0 (IB/chưa nhập) → không tự tính được (trước đây cộng 0đ cho đêm đó).
      if (p <= 0) throw new Error(`Phòng ${r.name} chưa có giá đêm ${toDateKey(d)} — vui lòng liên hệ để báo giá.`);
      c += p;
    }
    return c;
  });
  const communalFlags = roomList.map((r) => isCommunalRoom(r.roomType.name, r.name));
  const communal = communalFlags.every(Boolean);
  if (!communal && communalFlags.some(Boolean)) {
    throw new Error("Không ghép phòng thường với giường cộng đồng trong cùng một combo.");
  }
  const capacityStd = roomList.reduce((n, r) => n + r.capacity, 0);
  // Phòng thường được Ở GHÉP tới sức chứa tối đa (maxCapacity) kèm phụ thu.
  const capacityMax = communal
    ? capacityStd
    : roomList.reduce((n, r) => n + Math.max(r.capacity, r.maxCapacity ?? r.capacity), 0);
  if (capacityMax < people) {
    throw new Error(`Các phòng đã chọn chỉ đủ ${capacityMax} chỗ cho ${people} khách.`);
  }
  // TỔNG tiền phòng cả đoàn: dorm tính theo NGƯỜI (xếp vào giường rẻ trước),
  // phòng thường cộng tiền từng phòng + phụ thu khách ở ghép (phòng phụ thu rẻ trước).
  let roomCost = 0;
  let extraGuests = 0;
  let extraCost = 0;
  if (communal) {
    let remaining = people;
    for (const r of roomList
      .map((room, i) => ({ cap: room.capacity, cost: costs[i] }))
      .sort((a, b) => a.cost - b.cost)) {
      const take = Math.min(remaining, r.cap);
      roomCost += r.cost * take;
      remaining -= take;
    }
  } else {
    roomCost = costs.reduce((a, b) => a + b, 0);
    if (people > capacityStd) {
      extraGuests = people - capacityStd;
      let rem = extraGuests;
      for (const sl of roomList
        .map((r) => ({
          slots: Math.max(0, (r.maxCapacity ?? r.capacity) - r.capacity),
          fee: (toNumber(svc.extraPersonFee) ?? 0) * nights.length, // phụ thu CHUNG của homestay
        }))
        .filter((s) => s.slots > 0)
        .sort((a, b) => a.fee - b.fee)) {
        const take = Math.min(rem, sl.slots);
        extraCost += take * sl.fee;
        rem -= take;
        if (rem === 0) break;
      }
      roomCost += extraCost;
    }
  }
  // Giá vé khứ hồi: chọn điểm xuất phát thì TÍNH LẠI theo bảng giá chặng
  // (bảng riêng của nhà xe, thiếu thì bảng chung) — khớp với giá đã hiện ở trang tìm combo.
  const origin = input.origin?.trim() || null;
  const allRows = await prisma.cabinPriceRow.findMany({
    where: { OR: [{ serviceId: outbound.serviceId }, { serviceId: null }] },
  });
  const own = allRows.filter((r) => r.serviceId === outbound.serviceId);
  const rows = own.length ? own : allRows.filter((r) => r.serviceId === null);
  const fare = comboRoundTripFare(rows, origin, (toNumber(outbound.price) ?? 0) + (toNumber(ret.price) ?? 0));
  if (fare == null || fare <= 0) {
    throw new Error(origin ? "Nhà xe chưa khai báo giá vé cho điểm đón này." : "Nhà xe chưa có giá vé.");
  }
  // Chỗ nằm xe cabin — tính THEO NGƯỜI (giống /xe-cabin): nằm ghép (cabin đôi) = fare/người
  // (đi lẻ nhà xe xếp ghép cùng khách khác); nằm riêng (cabin đơn, bao buồng) = 2×fare/người.
  // cabinDouble/cabinSingle = SỐ KHÁCH mỗi cách nằm, tổng phải = số khách; lệch (client cũ) → cả đoàn ghép.
  // Chỗ trên xe = SỐ KHÁCH, trừ ở kho vé thường của cả 2 chiều (KHÔNG dùng kho "cabin đôi"
  // của trang /xe-cabin — nhiều chuyến không khai kho đó). Ghép/riêng chỉ ảnh hưởng GIÁ.
  // Lịch cabin luôn còn chỗ (ngày hết vé đã chặn ở trên) — không giới hạn theo số ghế.
  const seatsAvail = Math.max(people, OPEN_SEATS);
  let nDouble = input.cabinDouble ?? 0;
  let nSingle = input.cabinSingle ?? 0;
  if (nSingle + nDouble !== people) ({ nSingle, nDouble } = cabinAllocation(people, seatsAvail)!);
  const roomShare = Math.round(roomCost / people);
  const busAmount = cabinSeatTotal(fare, nDouble, nSingle);
  // Không giảm combo: giường cộng đồng hoặc có phòng tick "không giảm 25k khi đặt combo".
  const noDiscount = communal || roomList.some((r) => r.noComboDiscount);
  const total = Math.max(0, roomShare * people + busAmount - (noDiscount ? 0 : COMBO_DISCOUNT * people));
  // Tách tiền từng bên: bill về homestay = tiền phòng, bill về nhà xe = tiền vé.
  // (referencePrice = TỔNG khách trả, đã trừ giảm giá combo cho phòng thường.)
  const roomAmount = roomCost; // đã là tổng tiền phòng cả đoàn
  // Chiết khấu từng căn (snapshot) = tổng chiết khấu các phòng × đêm, fallback mức homestay.
  const comboRoomCommission = roomList.reduce(
    (n, r) => n + roomCommissionForNights(r, nights, toNumber(svc.roomCommission)),
    0,
  );

  // Nhãn phòng: gộp theo hạng — "2× Phòng đôi (P201, P202) + 1× Phòng đơn (P105)".
  const byType = new Map<string, { typeName: string; names: string[] }>();
  for (const r of roomList) {
    const g = byType.get(r.roomTypeId);
    if (g) g.names.push(r.name);
    else byType.set(r.roomTypeId, { typeName: r.roomType.name, names: [r.name] });
  }
  const roomsLabel =
    [...byType.values()]
      .map((t) => `${t.names.length}× ${t.typeName} (${t.names.join(", ")})`)
      .join(" + ") + (extraGuests > 0 ? `, +${extraGuests} khách ở ghép (phụ thu ${extraCost.toLocaleString("vi-VN")}đ)` : "");

  const busSvc = await prisma.service.findUnique({ where: { id: outbound.serviceId }, select: { title: true, busCommission: true } });
  const selectionLabel =
    `Combo: xe ${outbound.operatorName || busSvc?.title || "cabin"} (đi ${toDateKey(outbound.departureDate)} ${outbound.departureTime}, ` +
    `về ${toDateKey(ret.departureDate)} ${ret.departureTime}${origin ? `, đón tại ${origin}` : ""}) + ${svc.title} · ${roomsLabel}, ` +
    `${nights.length} đêm (${toDateKey(checkIn)}→${toDateKey(to)}) · ${partyLabel(adults, childrenAges)}` +
    (freeKids > 0 ? ` (${freeKids} trẻ miễn phí, ở cùng)` : "") +
    ` · xe nằm: ${[nDouble ? `${nDouble} khách nằm ghép (cabin đôi)` : null, nSingle ? `${nSingle} khách nằm riêng (cabin đơn)` : null].filter(Boolean).join(" + ")}`;

  let code = generateBookingCode();
  for (let i = 0; i < 5; i++) {
    const exists = await prisma.bookingRequest.findUnique({ where: { code } });
    if (!exists) break;
    code = generateBookingCode();
  }

  await prisma.bookingRequest.create({
    data: {
      code,
      category: "COMBO",
      serviceId: svc.id,
      serviceTitle: `Combo Tà Xùa: ${busSvc?.title ?? "xe cabin"} + ${svc.title}`,
      customerName: input.customerName,
      phone: input.phone,
      // Ghi điểm đón vào ghi chú ("Đón: …") như đơn cabin/đơn tạo hộ để trang chi tiết đơn
      // và tin nhắn xác nhận hiện đúng điểm đón khách chọn, không rơi về điểm mặc định của chuyến.
      note: [input.note?.trim() || null, origin ? `Đón: ${origin}` : null].filter(Boolean).join(" · ") || null,
      // useDate = NGÀY NHẬN PHÒNG (đi xe đêm hôm trước) để giữ phòng đúng các đêm
      // [check-in, check-out). Ngày xe chạy nằm trong selectionLabel + cabinTripId.
      useDate: checkIn,
      endDate: to,
      nights: nights.length,
      quantity: people,
      adults,
      childrenAges,
      roomTypeId: roomList[0].roomTypeId,
      roomId: roomList[0].id,
      roomIds: roomList.map((r) => r.id),
      cabinTripId: outbound.id,
      cabinReturnTripId: ret.id,
      // Giữ chỗ khi xác nhận: trừ ĐÚNG số khách ở kho vé thường (2 chiều). Cách nằm
      // ghép/riêng đã ghi trong selectionLabel cho nhà xe.
      seatsSingle: people,
      seatsDouble: 0,
      cabinShared: nDouble,
      cabinSolo: nSingle,
      selectionLabel,
      referencePrice: total,
      roomAmount,
      busAmount,
      needsConfirmation: true,
      ctvId: ctvId ?? null,
      commissionAmount: ctvId ? comboRoomCommission : 0,
      roomCommission: comboRoomCommission,
      busCommission: busCommissionFor(busSvc?.busCommission, people, 2),
    },
  });

  return { code, needsConfirmation: true };
}

/** Parse danh sách filter từ query (?f=bathtub,cloudView,...). */
export function parseComboFilters(raw: string | undefined | null): ComboFilters {
  const set = new Set((raw ?? "").split(",").map((x) => x.trim()).filter(Boolean));
  return {
    bathtub: set.has("bathtub"),
    cloudView: set.has("cloudView"),
    breakfast: set.has("breakfast"),
    airCon: set.has("airCon"),
    heating: set.has("heating"),
    easyRoad: set.has("easyRoad"),
    pool: set.has("pool"),
  };
}
