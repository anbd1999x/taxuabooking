import { toNumber } from "./format";

/**
 * Tiền SÀN phải thanh toán cho nhà cung cấp trong một đơn, tách theo bên:
 *  - "room": homestay / dịch vụ chính của đơn (homestay, xe máy, taxi, xe ôm; combo = phần tiền phòng)
 *  - "bus" : nhà xe (đơn cabin = cả đơn; combo = phần tiền vé)
 * Phải trả = tiền bán ra của bên đó − chiết khấu bên đó để lại cho sàn.
 * File thuần (không server-only) để dùng chung cho trang chi tiết, action và thống kê.
 */
export type PayoutSide = "room" | "bus";

export interface SidePayout {
  side: PayoutSide;
  gross: number; // tiền bán ra phần của bên này
  discount: number; // chiết khấu cho sàn
  payable: number; // phải thanh toán = gross − discount
  paid: number; // đã thanh toán
  remaining: number; // còn chưa thanh toán
}

export function supplierPayouts(
  b: {
    category: string;
    referencePrice: unknown;
    roomAmount: unknown;
    busAmount: unknown;
    cabinTripId: string | null;
    paidToRoom: unknown;
    paidToBus: unknown;
  },
  roomDiscount: number,
  busDiscount: number,
): SidePayout[] {
  const price = toNumber(b.referencePrice as never) ?? 0;
  const mk = (side: PayoutSide, gross: number, discount: number, paidRaw: unknown): SidePayout => {
    const payable = Math.max(0, gross - discount);
    const paid = toNumber(paidRaw as never) ?? 0;
    return { side, gross, discount, payable, paid, remaining: Math.max(0, payable - paid) };
  };
  if (b.category === "COMBO") {
    const out: SidePayout[] = [mk("room", toNumber(b.roomAmount as never) ?? 0, roomDiscount, b.paidToRoom)];
    if (b.cabinTripId || b.busAmount != null) {
      out.push(mk("bus", toNumber(b.busAmount as never) ?? 0, busDiscount, b.paidToBus));
    }
    return out;
  }
  if (b.category === "CABIN") return [mk("bus", price, busDiscount, b.paidToBus)];
  return [mk("room", price, roomDiscount, b.paidToRoom)];
}
