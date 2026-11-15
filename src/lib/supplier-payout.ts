import { toNumber } from "./format";
import { parseSurcharges } from "./surcharges";

/**
 * Tiền SÀN phải thanh toán cho nhà cung cấp trong một đơn, tách theo bên:
 *  - "room": homestay / dịch vụ chính của đơn (homestay, xe máy, taxi, xe ôm; combo = phần tiền phòng)
 *  - "bus" : nhà xe (đơn cabin = cả đơn; combo = phần tiền vé)
 * Phải trả = tiền bán ra của bên đó − chiết khấu bên đó để lại cho sàn (HỆ THỐNG TỰ TÍNH), TRỪ KHI
 * admin đã SỬA TAY số phải trả (`payableRoomOverride` / `payableBusOverride`) — khi đó số sửa tay là
 * số dùng ở mọi nơi (chi tiết đơn, trang chủ dịch vụ, báo cáo thanh toán); chiết khấu hiệu lực =
 * bán ra − số sửa tay.
 *
 * AI THU TIỀN KHÁCH (`collector`, admin chọn ở từng đơn — mặc định "PLATFORM" = sàn thu):
 *  - Sàn thu: sàn chuyển cho chủ dịch vụ phần "phải trả".
 *  - Chủ dịch vụ thu ("PROVIDER"): chủ dịch vụ giữ tiền khách, phải chuyển lại sàn phần chiết khấu.
 * TIỀN CHỦ DỊCH VỤ THU THÊM (vd khách trả xe quá giờ): chủ dịch vụ tự nhập, lưu thành một khoản phụ thu
 * id `PROVIDER_EXTRA_ID` (đã cộng vào giá đơn) và cũng chịu chiết khấu CÙNG TỈ LỆ với đơn gốc.
 * Số chủ dịch vụ ĐANG GIỮ của khách (`held`) được bù trừ vào số sàn còn phải chuyển; giữ nhiều hơn phần
 * của mình ⇒ `providerOwes` = số chủ dịch vụ phải chuyển lại sàn.
 * Chỉ áp cho đơn KHÔNG phải combo (combo do sàn điều phối & thu).
 *
 * File thuần (không server-only) để dùng chung cho trang chi tiết, action và thống kê.
 */
export type PayoutSide = "room" | "bus";
export type Collector = "PLATFORM" | "PROVIDER";

export const PROVIDER_EXTRA_ID = "provider-extra";
export const PROVIDER_EXTRA_LABEL = "Chủ dịch vụ thu thêm";

export interface SidePayout {
  side: PayoutSide;
  gross: number; // tiền bán ra phần của bên này (đã gồm tiền chủ dịch vụ thu thêm)
  discount: number; // chiết khấu cho sàn (hiệu lực; có thể âm nếu sửa tay cao hơn giá bán)
  payable: number; // phần của nhà cung cấp trong đơn (sửa tay nếu có, không thì gross − chiết khấu)
  paid: number; // sàn đã thanh toán
  remaining: number; // sàn còn phải chuyển (đã bù trừ số chủ dịch vụ đang giữ của khách)
  autoPayable: number; // số hệ thống tự tính (gross − chiết khấu gốc)
  overridden: boolean; // admin đã sửa tay số phải trả
  collector: Collector; // ai thu tiền khách của đơn này
  extra: number; // tiền chủ dịch vụ thu thêm của khách (đã nằm trong gross)
  held: number; // tiền khách mà chủ dịch vụ đang giữ (chủ thu: toàn bộ đã thu; sàn thu: chỉ phần thu thêm)
  providerOwes: number; // chủ dịch vụ phải chuyển lại sàn (khi đang giữ nhiều hơn phần của mình)
}

type PayoutBooking = {
  category: string;
  referencePrice: unknown;
  roomAmount: unknown;
  busAmount: unknown;
  cabinTripId: string | null;
  paidToRoom: unknown;
  paidToBus: unknown;
  payableRoomOverride?: unknown;
  payableBusOverride?: unknown;
  surcharges?: unknown;
  collector?: string | null;
  amountCollected?: unknown;
};

/** Tiền chủ dịch vụ đã nhập là thu thêm của khách (0 nếu không có / đơn combo). */
export function providerExtraOf(b: { category: string; surcharges?: unknown }): number {
  if (b.category === "COMBO") return 0;
  const x = parseSurcharges(b.surcharges).find((s) => s.id === PROVIDER_EXTRA_ID);
  return x && x.amount > 0 ? x.amount : 0;
}

export function collectorOf(b: { category: string; collector?: string | null }): Collector {
  return b.category !== "COMBO" && b.collector === "PROVIDER" ? "PROVIDER" : "PLATFORM";
}

/**
 * Chiết khấu của phần THU THÊM = thu thêm × (chiết khấu gốc ÷ tiền bán gốc) — cùng tỉ lệ với đơn.
 * `baseDiscount` = chiết khấu gốc của bên chính (chưa gồm phần thu thêm).
 */
export function extraCommission(b: PayoutBooking, baseDiscount: number): number {
  const extra = providerExtraOf(b);
  if (extra <= 0 || baseDiscount <= 0) return 0;
  const baseGross = (toNumber(b.referencePrice as never) ?? 0) - extra;
  return baseGross > 0 ? Math.round((extra * baseDiscount) / baseGross) : 0;
}

/** Bên chính của đơn không phải combo (bên nhận tiền thu thêm / bên có thể tự thu tiền khách). */
function mainSide(b: PayoutBooking): PayoutSide | null {
  if (b.category === "COMBO") return null;
  return b.category === "CABIN" ? "bus" : "room";
}

/** Tiền bán ra phần của từng bên trong đơn (null = đơn không có bên đó). */
function sideGross(b: PayoutBooking): { room: number | null; bus: number | null } {
  const price = toNumber(b.referencePrice as never) ?? 0;
  if (b.category === "COMBO") {
    return {
      room: toNumber(b.roomAmount as never) ?? 0,
      bus: b.cabinTripId || b.busAmount != null ? toNumber(b.busAmount as never) ?? 0 : null,
    };
  }
  if (b.category === "CABIN") return { room: null, bus: price };
  return { room: price, bus: null };
}

/**
 * Chiết khấu HIỆU LỰC từng bên: chiết khấu gốc + chiết khấu phần thu thêm; admin sửa tay số phải trả
 * ⇒ bán ra − số sửa tay. Dùng ở những nơi tự trừ chiết khấu (tiền thực nhận của chủ dịch vụ, thống kê)
 * để khớp với `supplierPayouts`.
 */
export function effectiveDiscounts(b: PayoutBooking, roomDiscount: number, busDiscount: number): { room: number; bus: number } {
  const g = sideGross(b);
  const ro = toNumber(b.payableRoomOverride as never);
  const bo = toNumber(b.payableBusOverride as never);
  const main = mainSide(b);
  const room = roomDiscount + (main === "room" ? extraCommission(b, roomDiscount) : 0);
  const bus = busDiscount + (main === "bus" ? extraCommission(b, busDiscount) : 0);
  return {
    room: ro != null && g.room != null ? g.room - ro : room,
    bus: bo != null && g.bus != null ? g.bus - bo : bus,
  };
}

export function supplierPayouts(b: PayoutBooking, roomDiscount: number, busDiscount: number): SidePayout[] {
  const g = sideGross(b);
  const main = mainSide(b);
  const collector = collectorOf(b);
  const extraAll = providerExtraOf(b);
  const mk = (side: PayoutSide, gross: number, baseDiscount: number, paidRaw: unknown, overrideRaw: unknown): SidePayout => {
    const isMain = side === main;
    const extra = isMain ? extraAll : 0;
    const discount0 = baseDiscount + (isMain ? extraCommission(b, baseDiscount) : 0);
    const autoPayable = Math.max(0, gross - discount0);
    const override = toNumber(overrideRaw as never);
    const payable = override != null ? Math.max(0, override) : autoPayable;
    const paid = toNumber(paidRaw as never) ?? 0;
    // Tiền khách mà chủ dịch vụ đang giữ: tự thu ⇒ toàn bộ số đã thu; sàn thu ⇒ chỉ phần thu thêm.
    const selfCollect = isMain && collector === "PROVIDER";
    const held = !isMain ? 0 : collector === "PROVIDER" ? Math.max(0, toNumber(b.amountCollected as never) ?? 0) : extra;
    return {
      side,
      gross,
      discount: override != null ? gross - payable : discount0,
      payable,
      paid,
      // Chủ dịch vụ tự thu: sàn không chuyển gì; chủ dịch vụ nợ sàn đúng phần chiết khấu của đơn (kể cả khi
      // khách mới cọc một phần — phần còn lại họ sẽ tự thu nốt). Sàn thu: bù trừ số chủ dịch vụ đang giữ.
      remaining: selfCollect ? 0 : Math.max(0, payable - paid - held),
      autoPayable,
      overridden: override != null,
      collector: isMain ? collector : "PLATFORM",
      extra,
      held,
      providerOwes: selfCollect ? Math.max(0, gross - payable + paid) : Math.max(0, held + paid - payable),
    };
  };
  const out: SidePayout[] = [];
  if (g.room != null) out.push(mk("room", g.room, roomDiscount, b.paidToRoom, b.payableRoomOverride));
  if (g.bus != null) out.push(mk("bus", g.bus, busDiscount, b.paidToBus, b.payableBusOverride));
  return out;
}
