import "server-only";
import { prisma } from "./prisma";
import { enumerateNights, addDays } from "./dates";
import { roomCommissionForNights } from "./availability";
import { toNumber } from "./format";

/**
 * Chiết khấu từng căn hiệu lực của mỗi đơn, trả map id → số tiền (đồng).
 * - Đơn đã có snapshot `roomCommission` (đơn mới) ⇒ dùng luôn.
 * - Đơn cũ (snapshot null) ⇒ TÍNH BÙ từ cấu hình chiết khấu HIỆN TẠI của phòng
 *   (fallback mức homestay) theo đúng các đêm lưu trú — để tiền thực nhận hiện đúng
 *   ngay cả khi chưa chạy backfill.
 * Chỉ áp cho homestay/combo có gắn phòng; còn lại = 0.
 */
export async function resolveRoomCommissions(
  bookings: {
    id: string;
    roomCommission: unknown;
    roomId: string | null;
    roomIds: string[];
    category: string;
    useDate: Date;
    endDate: Date | null;
  }[],
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  const need: typeof bookings = [];
  const allRoomIds = new Set<string>();

  for (const b of bookings) {
    const snap = toNumber(b.roomCommission as never);
    if (snap != null) {
      map.set(b.id, snap);
      continue;
    }
    if (b.category === "HOMESTAY" || b.category === "COMBO") {
      const ids = b.roomIds?.length ? b.roomIds : b.roomId ? [b.roomId] : [];
      if (ids.length) {
        need.push(b);
        ids.forEach((i) => allRoomIds.add(i));
        continue;
      }
    }
    map.set(b.id, 0);
  }

  if (allRoomIds.size) {
    const rooms = await prisma.room.findMany({
      where: { id: { in: [...allRoomIds] } },
      include: { roomType: { include: { service: { select: { roomCommission: true } } } } },
    });
    const byId = new Map(rooms.map((r) => [r.id, r]));
    for (const b of need) {
      const ids = b.roomIds?.length ? b.roomIds : b.roomId ? [b.roomId] : [];
      const checkout = b.endDate ?? addDays(b.useDate, 1);
      const nights = enumerateNights(b.useDate, checkout);
      let total = 0;
      for (const id of ids) {
        const r = byId.get(id);
        if (r) total += roomCommissionForNights(r, nights, toNumber(r.roomType.service.roomCommission));
      }
      map.set(b.id, total);
    }
  }
  return map;
}

/**
 * Chiết khấu hiệu lực + NHÃN PHÒNG thực của mỗi đơn homestay/combo, trả map id →
 * { discount, label }. Nạp TẤT CẢ phòng của các đơn (không chỉ đơn null snapshot) để
 * dựng nhãn kiểu "Phòng đôi (P201) + Phòng đôi (P202)" như trang chi tiết admin.
 */
export async function resolveRoomInfo(
  bookings: {
    id: string;
    roomCommission: unknown;
    roomId: string | null;
    roomIds: string[];
    category: string;
    useDate: Date;
    endDate: Date | null;
  }[],
): Promise<Map<string, { discount: number; label: string }>> {
  const out = new Map<string, { discount: number; label: string }>();
  const stayBookings = bookings.filter(
    (b) => (b.category === "HOMESTAY" || b.category === "COMBO") && (b.roomIds?.length || b.roomId),
  );
  const allRoomIds = new Set<string>();
  for (const b of stayBookings) (b.roomIds?.length ? b.roomIds : b.roomId ? [b.roomId] : []).forEach((i) => allRoomIds.add(i));

  const rooms = allRoomIds.size
    ? await prisma.room.findMany({
        where: { id: { in: [...allRoomIds] } },
        include: { roomType: { include: { service: { select: { roomCommission: true } } } } },
      })
    : [];
  const byId = new Map(rooms.map((r) => [r.id, r]));

  for (const b of stayBookings) {
    const ids = b.roomIds?.length ? b.roomIds : b.roomId ? [b.roomId] : [];
    const rs = ids.map((id) => byId.get(id)).filter((r): r is NonNullable<typeof r> => !!r);
    const label = rs.map((r) => `${r.roomType.name} (${r.name})`).join(" + ");
    const snap = toNumber(b.roomCommission as never);
    let discount = snap ?? 0;
    if (snap == null) {
      const checkout = b.endDate ?? addDays(b.useDate, 1);
      const nights = enumerateNights(b.useDate, checkout);
      discount = rs.reduce((n, r) => n + roomCommissionForNights(r, nights, toNumber(r.roomType.service.roomCommission)), 0);
    }
    out.set(b.id, { discount, label });
  }
  return out;
}

/** Chiết khấu NHÀ XE cho sàn của 1 đơn = mức (đ/khách/chiều) × số khách × số chiều. */
export function busCommissionFor(rate: unknown, people: number, legs: number): number | null {
  const r = toNumber(rate as never);
  if (r == null || r <= 0) return null;
  return r * Math.max(0, people) * Math.max(0, legs);
}

/**
 * Chiết khấu nhà xe hiệu lực của mỗi đơn có chuyến cabin (cabin / combo), map id → đồng.
 * - Có snapshot `busCommission` ⇒ dùng luôn.
 * - Đơn cũ (null) ⇒ TÍNH BÙ từ mức HIỆN TẠI của nhà xe chạy chuyến đi × số khách × số chiều.
 */
export async function resolveBusCommissions(
  bookings: {
    id: string;
    busCommission: unknown;
    cabinTripId: string | null;
    cabinReturnTripId: string | null;
    quantity: number;
    seatsSingle: number | null;
    seatsDouble: number | null;
  }[],
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  const need = bookings.filter((b) => {
    const snap = toNumber(b.busCommission as never);
    if (snap != null) map.set(b.id, snap);
    return snap == null && !!b.cabinTripId;
  });
  if (need.length) {
    const trips = await prisma.cabinTrip.findMany({
      where: { id: { in: [...new Set(need.map((b) => b.cabinTripId!))] } },
      select: { id: true, service: { select: { busCommission: true } } },
    });
    const rate = new Map(trips.map((t) => [t.id, t.service.busCommission]));
    for (const b of need) {
      const people = b.quantity; // cabin/combo: quantity = số khách
      const legs = b.cabinReturnTripId ? 2 : 1;
      map.set(b.id, busCommissionFor(rate.get(b.cabinTripId!), people, legs) ?? 0);
    }
  }
  return map;
}
