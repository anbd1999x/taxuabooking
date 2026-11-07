import "server-only";
import { prisma } from "./prisma";
import { parseDateOnly, addDays } from "./dates";
import { toNumber } from "./format";
import { comboSideCollected } from "./combo-pricing";
import { resolveBusCommissions, resolveRoomCommissions } from "./provider-commission";

/** Một dòng thống kê (tổng, theo CTV, hoặc theo chủ dịch vụ). */
export interface StatRow {
  id: string;
  name: string;
  orders: number; // tổng đơn (trừ đơn huỷ)
  completed: number; // đơn hoàn thành
  awaiting: number; // đơn chưa thanh toán đủ (còn nợ)
  revenue: number; // doanh thu = giá trị đơn đã chốt (giữ phòng/hoàn thành)
  collected: number; // đã thu
  outstanding: number; // còn thiếu (doanh thu − đã thu)
  commission: number; // hoa hồng CTV (đơn đã chốt)
  commissionUnpaid: number; // hoa hồng chưa trả CTV
  discount: number; // tổng chiết khấu đã trừ khỏi doanh thu (phạm vi chủ dịch vụ)
  // ---- Doanh thu SÀN (admin) — chỉ đơn đã chốt ----
  homeDiscount: number; // chiết khấu homestay cho sàn (theo phòng/đêm)
  busDiscount: number; // chiết khấu nhà xe cho sàn (theo khách/chiều)
  platformProfit: number; // lợi nhuận sàn = homeDiscount + busDiscount − hoa hồng CTV
}

export interface StatsResult {
  totals: StatRow;
  byCtv: StatRow[];
  byProvider: StatRow[]; // rỗng khi xem ở phạm vi một chủ dịch vụ
}

function emptyRow(id: string, name: string): StatRow {
  return {
    id, name, orders: 0, completed: 0, awaiting: 0, revenue: 0, collected: 0, outstanding: 0,
    commission: 0, commissionUnpaid: 0, discount: 0, homeDiscount: 0, busDiscount: 0, platformProfit: 0,
  };
}

type Bk = {
  status: string;
  paymentStatus: string;
  referencePrice: unknown;
  amountCollected: unknown;
  ctvId: string | null;
  commissionAmount: unknown;
  commissionPaid: boolean;
  roomCommission: unknown; // chiết khấu từng căn (trừ khỏi doanh thu khi xem ở phạm vi chủ dịch vụ)
  busCommission: unknown; // chiết khấu nhà xe (trừ khỏi doanh thu nhà xe ở phạm vi chủ dịch vụ)
};

/**
 * Đơn COMBO nhìn từ MỘT BÊN: doanh thu = phần tiền của bên đó (home = tiền
 * phòng, nhà xe = tiền vé); coi là đã thu đủ khi khách thanh toán đủ; hoa hồng
 * CTV chỉ tính cho phía homestay.
 */
function comboSideView(
  b: Bk & { roomAmount: unknown; busAmount: unknown },
  side: "home" | "bus",
): Bk {
  const amount = toNumber((side === "home" ? b.roomAmount : b.busAmount) as never) ?? 0;
  return {
    status: b.status,
    paymentStatus: b.paymentStatus,
    referencePrice: amount,
    // Đã cọc ⇒ bên này nhận 50% phần tiền của mình; thanh toán đủ ⇒ nhận đủ.
    amountCollected: comboSideCollected(b.paymentStatus, toNumber(b.amountCollected as never), amount),
    ctvId: side === "home" ? b.ctvId : null,
    commissionAmount: side === "home" ? b.commissionAmount : null,
    commissionPaid: b.commissionPaid,
    // Chiết khấu từng căn chỉ thuộc phần tiền phòng (phía homestay); vé xe không có.
    roomCommission: side === "home" ? b.roomCommission : null,
    // Chiết khấu nhà xe chỉ thuộc phần tiền vé (phía nhà xe).
    busCommission: side === "bus" ? b.busCommission : null,
  };
}

/**
 * net = true (phạm vi một chủ dịch vụ): doanh thu / đã thu / còn thiếu tính theo
 * TIỀN THỰC NHẬN = tiền bán ra − chiết khấu từng căn. net = false (admin tổng): giữ gross.
 */
function accumulate(row: StatRow, b: Bk, net = false) {
  if (b.status === "CANCELLED") return; // đơn huỷ không tính
  const gross = toNumber(b.referencePrice as never) ?? 0;
  const homeDisc = toNumber(b.roomCommission as never) ?? 0;
  const busDisc = toNumber(b.busCommission as never) ?? 0;
  const discount = net ? homeDisc + busDisc : 0;
  const price = Math.max(0, gross - discount); // thực nhận của đơn
  const rawCollected = toNumber(b.amountCollected as never) ?? 0;
  // Tiền đã thu quy về thực nhận: không vượt quá tiền thực nhận của đơn.
  const collected = net ? Math.min(rawCollected, price) : rawCollected;
  const isChot = b.status === "CONFIRMED" || b.status === "COMPLETED";

  row.orders += 1;
  if (b.status === "COMPLETED") row.completed += 1;
  if (b.paymentStatus !== "PAID") row.awaiting += 1;
  row.collected += collected;
  if (isChot) {
    row.revenue += price;
    row.discount += discount;
    row.outstanding += Math.max(0, price - collected);
    row.homeDiscount += homeDisc;
    row.busDiscount += busDisc;
    row.platformProfit += homeDisc + busDisc;
    if (b.ctvId) {
      const comm = toNumber(b.commissionAmount as never) ?? 0;
      row.commission += comm;
      row.platformProfit -= comm;
      if (!b.commissionPaid) row.commissionUnpaid += comm;
    }
  }
}

/**
 * Thống kê theo mốc thời gian (lọc theo ngày tạo đơn).
 * ownerId != null ⇒ phạm vi một chủ dịch vụ (chỉ đơn của dịch vụ họ sở hữu, không trả bảng theo chủ).
 */
export async function computeStats(fromKey: string, toKey: string, ownerId?: string | null): Promise<StatsResult> {
  const from = parseDateOnly(fromKey);
  const toExclusive = addDays(parseDateOnly(toKey), 1);

  // Nhà xe: đơn COMBO gắn serviceId homestay nhưng đi qua CHUYẾN của nhà xe.
  const ownerTripIds = ownerId
    ? (
        await prisma.cabinTrip.findMany({
          where: { service: { ownerId, category: "CABIN" } },
          select: { id: true },
        })
      ).map((t) => t.id)
    : [];

  const bookings = await prisma.bookingRequest.findMany({
    where: {
      createdAt: { gte: from, lt: toExclusive },
      ...(ownerId
        ? ownerTripIds.length
          ? {
              OR: [
                { service: { ownerId } },
                { cabinTripId: { in: ownerTripIds } },
                { cabinReturnTripId: { in: ownerTripIds } },
              ],
            }
          : { service: { ownerId } }
        : {}),
    },
    select: {
      id: true,
      category: true,
      status: true,
      paymentStatus: true,
      referencePrice: true,
      roomAmount: true,
      busAmount: true,
      cabinTripId: true,
      amountCollected: true,
      ctvId: true,
      ctv: { select: { name: true } },
      commissionAmount: true,
      commissionPaid: true,
      roomCommission: true,
      busCommission: true,
      cabinReturnTripId: true,
      quantity: true,
      seatsSingle: true,
      seatsDouble: true,
      roomId: true,
      roomIds: true,
      useDate: true,
      endDate: true,
      service: { select: { ownerId: true, owner: { select: { name: true } } } },
    },
  });

  // Thay chiết khấu home / nhà xe bằng giá trị hiệu lực (snapshot, hoặc tính bù cho đơn
  // cũ chưa có snapshot) — để tiền thực nhận của chủ dịch vụ & doanh thu sàn đúng ngay.
  const [roomDisc, busDisc] = await Promise.all([resolveRoomCommissions(bookings), resolveBusCommissions(bookings)]);
  for (const b of bookings) {
    (b as { roomCommission: unknown }).roomCommission = roomDisc.get(b.id) ?? 0;
    (b as { busCommission: unknown }).busCommission = busDisc.get(b.id) ?? 0;
  }

  // Chủ nhà xe của các đơn combo (tra theo chuyến đi) — cho bảng theo chủ dịch vụ.
  const comboTripIds = [
    ...new Set(bookings.filter((b) => b.category === "COMBO" && b.cabinTripId).map((b) => b.cabinTripId!)),
  ];
  const tripOwner = new Map<string, { id: string; name: string }>();
  if (!ownerId && comboTripIds.length) {
    const trips = await prisma.cabinTrip.findMany({
      where: { id: { in: comboTripIds } },
      select: { id: true, service: { select: { ownerId: true, owner: { select: { name: true } } } } },
    });
    for (const t of trips) {
      tripOwner.set(t.id, {
        id: t.service.ownerId ?? "_none",
        name: t.service.owner?.name ?? "Chưa gán chủ dịch vụ",
      });
    }
  }

  const totals = emptyRow("_all", "Tổng");
  const byCtv = new Map<string, StatRow>();
  const byProvider = new Map<string, StatRow>();

  // Phạm vi một chủ dịch vụ ⇒ tính theo tiền THỰC NHẬN (trừ chiết khấu từng căn).
  const net = !!ownerId;

  for (const b of bookings) {
    const isCombo = b.category === "COMBO";
    // Phạm vi MỘT chủ dịch vụ: đơn combo chỉ tính PHẦN TIỀN của bên đó.
    const scoped =
      ownerId && isCombo ? comboSideView(b, b.service?.ownerId === ownerId ? "home" : "bus") : b;

    accumulate(totals, scoped, net);

    const ck = b.ctvId ?? "_none";
    const cn = b.ctv?.name ?? "Khách tự đặt (không qua CTV)";
    const crow = byCtv.get(ck) ?? emptyRow(ck, cn);
    accumulate(crow, scoped, net);
    byCtv.set(ck, crow);

    if (!ownerId) {
      if (isCombo) {
        // Combo chia đôi bill: tiền phòng về chủ homestay, tiền vé về chủ nhà xe.
        const hk = b.service?.ownerId ?? "_none";
        const hn = b.service?.owner?.name ?? "Chưa gán chủ dịch vụ";
        const hrow = byProvider.get(hk) ?? emptyRow(hk, hn);
        accumulate(hrow, comboSideView(b, "home"));
        byProvider.set(hk, hrow);

        const bo = (b.cabinTripId && tripOwner.get(b.cabinTripId)) || { id: "_none", name: "Chưa gán chủ dịch vụ" };
        const brow = byProvider.get(bo.id) ?? emptyRow(bo.id, bo.name);
        accumulate(brow, comboSideView(b, "bus"));
        byProvider.set(bo.id, brow);
      } else {
        const pk = b.service?.ownerId ?? "_none";
        const pn = b.service?.owner?.name ?? "Chưa gán chủ dịch vụ";
        const prow = byProvider.get(pk) ?? emptyRow(pk, pn);
        accumulate(prow, b);
        byProvider.set(pk, prow);
      }
    }
  }

  const sortByRevenue = (a: StatRow, b: StatRow) => b.revenue - a.revenue;
  return {
    totals,
    byCtv: [...byCtv.values()].sort(sortByRevenue),
    byProvider: [...byProvider.values()].sort(sortByRevenue),
  };
}
