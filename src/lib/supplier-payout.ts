import { toNumber } from "./format";

/**
 * Tiền SÀN phải thanh toán cho nhà cung cấp trong một đơn, tách theo bên:
 *  - "room": homestay / dịch vụ chính của đơn (homestay, xe máy, taxi, xe ôm; combo = phần tiền phòng)
 *  - "bus" : nhà xe (đơn cabin = cả đơn; combo = phần tiền vé)
 * Phải trả = tiền bán ra của bên đó − chiết khấu bên đó để lại cho sàn (HỆ THỐNG TỰ TÍNH), TRỪ KHI
 * admin đã SỬA TAY số phải trả (`payableRoomOverride` / `payableBusOverride`) — khi đó số sửa tay là
 * số dùng ở mọi nơi (chi tiết đơn, trang chủ dịch vụ, báo cáo thanh toán); chiết khấu hiệu lực =
 * bán ra − số sửa tay.
 * File thuần (không server-only) để dùng chung cho trang chi tiết, action và thống kê.
 */
export type PayoutSide = "room" | "bus";

export interface SidePayout {
  side: PayoutSide;
  gross: number; // tiền bán ra phần của bên này
  discount: number; // chiết khấu cho sàn (hiệu lực; có thể âm nếu sửa tay cao hơn giá bán)
  payable: number; // phải thanh toán (sửa tay nếu có, không thì gross − chiết khấu)
  paid: number; // đã thanh toán
  remaining: number; // còn chưa thanh toán
  autoPayable: number; // số hệ thống tự tính (gross − chiết khấu gốc)
  overridden: boolean; // admin đã sửa tay số phải trả
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
};

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
 * Chiết khấu HIỆU LỰC từng bên sau khi áp số phải trả sửa tay (nếu có): bán ra − số sửa tay.
 * Dùng ở những nơi tự trừ chiết khấu (tiền thực nhận của chủ dịch vụ, thống kê) để khớp với
 * `supplierPayouts`.
 */
export function effectiveDiscounts(b: PayoutBooking, roomDiscount: number, busDiscount: number): { room: number; bus: number } {
  const g = sideGross(b);
  const ro = toNumber(b.payableRoomOverride as never);
  const bo = toNumber(b.payableBusOverride as never);
  return {
    room: ro != null && g.room != null ? g.room - ro : roomDiscount,
    bus: bo != null && g.bus != null ? g.bus - bo : busDiscount,
  };
}

export function supplierPayouts(b: PayoutBooking, roomDiscount: number, busDiscount: number): SidePayout[] {
  const g = sideGross(b);
  const mk = (side: PayoutSide, gross: number, discount: number, paidRaw: unknown, overrideRaw: unknown): SidePayout => {
    const autoPayable = Math.max(0, gross - discount);
    const override = toNumber(overrideRaw as never);
    const payable = override != null ? Math.max(0, override) : autoPayable;
    const paid = toNumber(paidRaw as never) ?? 0;
    return {
      side,
      gross,
      discount: override != null ? gross - payable : discount,
      payable,
      paid,
      remaining: Math.max(0, payable - paid),
      autoPayable,
      overridden: override != null,
    };
  };
  const out: SidePayout[] = [];
  if (g.room != null) out.push(mk("room", g.room, roomDiscount, b.paidToRoom, b.payableRoomOverride));
  if (g.bus != null) out.push(mk("bus", g.bus, busDiscount, b.paidToBus, b.payableBusOverride));
  return out;
}
