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
