import type { AvailabilityStatus } from "@prisma/client";
import { isWeekend, toDateKey } from "./dates";
import { toNumber } from "./format";

/** Mức độ ưu tiên khi gộp trạng thái nhiều ngày (số lớn = nghiêm trọng hơn). */
const SEVERITY: Record<AvailabilityStatus, number> = {
  AVAILABLE: 0,
  LIMITED: 1,
  PENDING_CONFIRM: 2,
  NOT_UPDATED: 3,
  SOLD_OUT: 4,
};

export interface NightAvailabilityInput {
  status: AvailabilityStatus;
  availableUnits: number;
  /** Giá cho đêm/ngày này (đã tính override hoặc weekday/weekend). */
  price: number | null;
}

export interface RoomPricing {
  weekdayPrice: number;
  weekendPrice: number;
  holidayPrice: number | null;
  /**
   * Giá riêng theo thứ trong tuần, lập chỉ mục theo getUTCDay():
   * [CN, T2, T3, T4, T5, T6, T7]. Phần tử null = dùng weekday/weekend.
   */
  daysOfWeek?: (number | null)[];
}

export interface AvailabilityRecord {
  status: AvailabilityStatus;
  availableUnits: number;
  priceOverride: number | null;
}

export interface StayAvailabilityResult {
  /** Tình trạng tổng hợp của cả kỳ. */
  status: AvailabilityStatus;
  /** Có thể đặt (đủ số lượng mọi đêm, đã cập nhật). */
  bookable: boolean;
  /** Số đơn vị (phòng/xe) ít nhất còn trống trong kỳ. */
  minAvailableUnits: number;
  /** Tổng giá cho 1 đơn vị trong cả kỳ (null nếu thiếu dữ liệu giá). */
  totalPricePerUnit: number | null;
  /** Số đêm/ngày. */
  count: number;
  /** Có đêm nào chưa được cập nhật dữ liệu không. */
  hasMissingData: boolean;
}

/** Các cột giá của một hạng phòng (chấp nhận Decimal | number | null). */
type RoomTypePriceFields = {
  weekdayPrice: unknown;
  weekendPrice: unknown;
  holidayPrice: unknown;
  priceMon: unknown;
  priceTue: unknown;
  priceWed: unknown;
  priceThu: unknown;
  priceFri: unknown;
  priceSat: unknown;
  priceSun: unknown;
};

/**
 * Dựng `RoomPricing` từ một bản ghi RoomType (gồm giá theo thứ T2–CN).
 * Dùng chung cho tính giá ở trang khách lẫn luồng đặt.
 */
export function roomTypePricing(r: RoomTypePriceFields): RoomPricing {
  return {
    weekdayPrice: toNumber(r.weekdayPrice as never)!,
    weekendPrice: toNumber(r.weekendPrice as never)!,
    holidayPrice: toNumber(r.holidayPrice as never),
    // Lập chỉ mục theo getUTCDay(): 0=CN, 1=T2, ... 6=T7.
    daysOfWeek: [
      toNumber(r.priceSun as never),
      toNumber(r.priceMon as never),
      toNumber(r.priceTue as never),
      toNumber(r.priceWed as never),
      toNumber(r.priceThu as never),
      toNumber(r.priceFri as never),
      toNumber(r.priceSat as never),
    ],
  };
}

/** Các cột giá của một phòng con. */
type RoomPriceFields = {
  listPrice: unknown;
  salePrice: unknown;
  priceMon: unknown;
  priceTue: unknown;
  priceWed: unknown;
  priceThu: unknown;
  priceFri: unknown;
  priceSat: unknown;
  priceSun: unknown;
};

/**
 * Dựng `RoomPricing` cho một phòng con. Giá hiệu lực = giá chiết khấu (nếu có),
 * ngược lại giá thường; giá theo thứ (nếu nhập) ghi đè từng ngày.
 */
export function roomPricing(r: RoomPriceFields): RoomPricing {
  const list = toNumber(r.listPrice as never) ?? 0;
  const saleRaw = toNumber(r.salePrice as never);
  const sale = saleRaw != null && saleRaw > 0 ? saleRaw : null; // 0 = không giảm
  const base = sale ?? list;
  return {
    weekdayPrice: base,
    weekendPrice: base,
    holidayPrice: null,
    daysOfWeek: [
      toNumber(r.priceSun as never),
      toNumber(r.priceMon as never),
      toNumber(r.priceTue as never),
      toNumber(r.priceWed as never),
      toNumber(r.priceThu as never),
      toNumber(r.priceFri as never),
      toNumber(r.priceSat as never),
    ],
  };
}

/** Các cột chiết khấu CTV của một phòng con (mức cơ bản + theo thứ). */
export type RoomCommissionFields = {
  commission: unknown;
  commissionMon: unknown;
  commissionTue: unknown;
  commissionWed: unknown;
  commissionThu: unknown;
  commissionFri: unknown;
  commissionSat: unknown;
  commissionSun: unknown;
};

/**
 * Tổng chiết khấu cho một phòng qua các đêm lưu trú.
 * Mỗi đêm = chiết-khấu-theo-thứ (nếu nhập) ?? mức cơ bản của phòng (nếu nhập)
 *           ?? chiết khấu mặc định cả homestay (`homeFallback`, nếu có) ?? 0.
 * daysOfWeek index theo getUTCDay(): 0=CN..6=T7.
 */
export function roomCommissionForNights(
  r: RoomCommissionFields,
  nights: Date[],
  homeFallback?: number | null,
): number {
  const base = toNumber(r.commission as never); // null nếu phòng không khai mức cơ bản
  const home = homeFallback ?? null;
  const dow = [
    toNumber(r.commissionSun as never),
    toNumber(r.commissionMon as never),
    toNumber(r.commissionTue as never),
    toNumber(r.commissionWed as never),
    toNumber(r.commissionThu as never),
    toNumber(r.commissionFri as never),
    toNumber(r.commissionSat as never),
  ];
  let total = 0;
  for (const d of nights) total += dow[d.getUTCDay()] ?? base ?? home ?? 0;
  return total;
}

/** Nhãn hiển thị cho phòng KHÔNG công khai giá — khách nhắn tin (IB) để hỏi giá. */
export const PRICE_ON_REQUEST_LABEL = "IB để biết giá";

/**
 * Phòng "giá liên hệ / IB": admin không đặt giá công khai.
 * = giá thường (listPrice) & giá chiết khấu (salePrice) & MỌI giá theo thứ đều ≤ 0.
 * Phòng kiểu này vẫn hiện trong tìm kiếm nhưng hiển thị "IB để biết giá" thay vì 0đ.
 */
export function isRoomPriceOnRequest(r: RoomPriceFields): boolean {
  const list = toNumber(r.listPrice as never) ?? 0;
  const sale = toNumber(r.salePrice as never) ?? 0;
  if (list > 0 || sale > 0) return false;
  const days = [r.priceMon, r.priceTue, r.priceWed, r.priceThu, r.priceFri, r.priceSat, r.priceSun];
  return !days.some((d) => (toNumber(d as never) ?? 0) > 0);
}

/** Giá niêm yết (giá thường) để hiển thị gạch ngang; null nếu không có chiết khấu. */
export function roomListPrice(r: { listPrice: unknown; salePrice: unknown }): number | null {
  const list = toNumber(r.listPrice as never);
  const sale = toNumber(r.salePrice as never);
  if (list == null || sale == null || sale <= 0) return null; // 0 = không giảm
  return sale < list ? list : null;
}

/** Các cột giá gạch (niêm yết) theo thứ của một phòng con. */
export type RoomListPriceFields = {
  listPrice: unknown;
  salePrice: unknown;
  listPriceMon: unknown;
  listPriceTue: unknown;
  listPriceWed: unknown;
  listPriceThu: unknown;
  listPriceFri: unknown;
  listPriceSat: unknown;
  listPriceSun: unknown;
};

/** Giá gạch theo thứ, index theo getUTCDay(): [CN,T2,T3,T4,T5,T6,T7]; null = chưa đặt. */
export function roomListDaysOfWeek(r: RoomListPriceFields): (number | null)[] {
  const pos = (v: unknown) => {
    const n = toNumber(v as never);
    return n != null && n > 0 ? n : null; // 0/âm = không gạch
  };
  return [
    pos(r.listPriceSun),
    pos(r.listPriceMon),
    pos(r.listPriceTue),
    pos(r.listPriceWed),
    pos(r.listPriceThu),
    pos(r.listPriceFri),
    pos(r.listPriceSat),
  ];
}

/**
 * Giá gạch (niêm yết) cho MỘT đêm: giá-gạch-theo-thứ (nếu nhập) ?? giá niêm yết
 * chung (listPrice khi đang giảm). Chỉ trả về khi CAO HƠN giá bán đêm đó, ngược
 * lại null (không gạch).
 */
export function strikeForDay(date: Date, r: RoomListPriceFields, effective: number): number | null {
  const perDay = roomListDaysOfWeek(r)[date.getUTCDay()];
  const candidate = perDay ?? roomListPrice(r);
  return candidate != null && candidate > effective ? candidate : null;
}

/**
 * Tổng giá bán + tổng giá gạch cho một kỳ (nhiều đêm) của một phòng — dùng cho
 * thẻ tìm kiếm / combo. strikeTotal = null nếu cả kỳ không có đêm nào giảm.
 * Đêm không giảm được tính bằng chính giá bán vào cả hai tổng (để tổng gạch vẫn
 * đúng khi chỉ vài đêm giảm).
 */
export function stayStrike(
  nights: Date[],
  r: RoomPriceFields & RoomListPriceFields,
): { total: number; strikeTotal: number | null } {
  const pricing = roomPricing(r);
  let total = 0;
  let strikeSum = 0;
  let anyStrike = false;
  for (const d of nights) {
    const eff = priceForDay(d, pricing, null);
    total += eff;
    const st = strikeForDay(d, r, eff);
    strikeSum += st ?? eff;
    if (st != null) anyStrike = true;
  }
  return { total, strikeTotal: anyStrike && strikeSum > total ? strikeSum : null };
}

/**
 * Tính giá một đêm/ngày dựa trên override hoặc bảng giá weekday/weekend/holiday.
 */
export function priceForDay(
  date: Date,
  pricing: RoomPricing,
  override: number | null,
): number {
  if (override != null) return override;
  // Giá theo thứ (nếu được thiết lập) có ưu tiên hơn weekday/weekend.
  const perDay = pricing.daysOfWeek?.[date.getUTCDay()];
  if (perDay != null) return perDay;
  if (isWeekend(date)) return pricing.weekendPrice;
  return pricing.weekdayPrice;
}

/**
 * Gộp tình trạng + giá cho một kỳ (lưu trú nhiều đêm hoặc thuê xe nhiều ngày).
 *
 * Quy tắc quan trọng:
 * - Nếu BẤT KỲ ngày nào thiếu dữ liệu -> coi là NOT_UPDATED, không bookable.
 * - Nếu bất kỳ ngày nào SOLD_OUT hoặc số lượng trống < yêu cầu -> SOLD_OUT.
 * - Chỉ AVAILABLE khi mọi ngày đều đủ chỗ.
 */
export function aggregateStay(params: {
  days: Date[];
  requestedUnits: number;
  pricing: RoomPricing;
  /** Map dateKey -> bản ghi tình trạng (thiếu = chưa cập nhật). */
  records: Map<string, AvailabilityRecord>;
}): StayAvailabilityResult {
  const { days, requestedUnits, pricing, records } = params;

  let worstSeverity = 0;
  let minAvailableUnits = Number.POSITIVE_INFINITY;
  let total = 0;
  let hasMissingData = false;
  let priceComplete = true;

  for (const day of days) {
    const rec = records.get(toDateKey(day));

    if (!rec || rec.status === "NOT_UPDATED") {
      hasMissingData = true;
      worstSeverity = Math.max(worstSeverity, SEVERITY.NOT_UPDATED);
      minAvailableUnits = 0;
      priceComplete = false;
      continue;
    }

    // Giá của ngày. ≤ 0 = ngày "không công khai giá" (IB) → giá cả kỳ coi như chưa đủ.
    const price = priceForDay(day, pricing, rec.priceOverride);
    if (price == null || price <= 0) priceComplete = false;
    else total += price;

    minAvailableUnits = Math.min(minAvailableUnits, rec.availableUnits);

    let sev = SEVERITY[rec.status];
    // Không đủ số lượng yêu cầu -> coi như hết chỗ cho kỳ này.
    if (rec.availableUnits < requestedUnits) {
      sev = Math.max(sev, SEVERITY.SOLD_OUT);
    } else if (rec.status === "AVAILABLE" && rec.availableUnits <= 2) {
      // còn rất ít -> cảnh báo
      sev = Math.max(sev, SEVERITY.LIMITED);
    }
    worstSeverity = Math.max(worstSeverity, sev);
  }

  if (minAvailableUnits === Number.POSITIVE_INFINITY) minAvailableUnits = 0;

  const status = (Object.keys(SEVERITY) as AvailabilityStatus[]).find(
    (k) => SEVERITY[k] === worstSeverity,
  )!;

  const bookable =
    !hasMissingData &&
    status !== "SOLD_OUT" &&
    status !== "NOT_UPDATED" &&
    status !== "PENDING_CONFIRM" &&
    minAvailableUnits >= requestedUnits;

  return {
    status,
    bookable,
    minAvailableUnits,
    totalPricePerUnit: priceComplete && days.length > 0 ? total : null,
    count: days.length,
    hasMissingData,
  };
}
