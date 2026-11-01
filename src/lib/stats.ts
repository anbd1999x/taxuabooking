import "server-only";
import { prisma } from "./prisma";
import { parseDateOnly, addDays } from "./dates";
import { toNumber } from "./format";

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
}

export interface StatsResult {
  totals: StatRow;
  byCtv: StatRow[];
  byProvider: StatRow[]; // rỗng khi xem ở phạm vi một chủ dịch vụ
}

function emptyRow(id: string, name: string): StatRow {
  return { id, name, orders: 0, completed: 0, awaiting: 0, revenue: 0, collected: 0, outstanding: 0, commission: 0, commissionUnpaid: 0 };
}

type Bk = {
  status: string;
  paymentStatus: string;
  referencePrice: unknown;
  amountCollected: unknown;
  ctvId: string | null;
  commissionAmount: unknown;
  commissionPaid: boolean;
};

function accumulate(row: StatRow, b: Bk) {
  if (b.status === "CANCELLED") return; // đơn huỷ không tính
  const price = toNumber(b.referencePrice as never) ?? 0;
  const collected = toNumber(b.amountCollected as never) ?? 0;
  const isChot = b.status === "CONFIRMED" || b.status === "COMPLETED";

  row.orders += 1;
  if (b.status === "COMPLETED") row.completed += 1;
  if (b.paymentStatus !== "PAID") row.awaiting += 1;
  row.collected += collected;
  if (isChot) {
    row.revenue += price;
    row.outstanding += Math.max(0, price - collected);
    if (b.ctvId) {
      const comm = toNumber(b.commissionAmount as never) ?? 0;
      row.commission += comm;
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

  const bookings = await prisma.bookingRequest.findMany({
    where: {
      createdAt: { gte: from, lt: toExclusive },
      ...(ownerId ? { service: { ownerId } } : {}),
    },
    select: {
      status: true,
      paymentStatus: true,
      referencePrice: true,
      amountCollected: true,
      ctvId: true,
      ctv: { select: { name: true } },
      commissionAmount: true,
      commissionPaid: true,
      service: { select: { ownerId: true, owner: { select: { name: true } } } },
    },
  });

  const totals = emptyRow("_all", "Tổng");
  const byCtv = new Map<string, StatRow>();
  const byProvider = new Map<string, StatRow>();

  for (const b of bookings) {
    accumulate(totals, b);

    const ck = b.ctvId ?? "_none";
    const cn = b.ctv?.name ?? "Khách tự đặt (không qua CTV)";
    const crow = byCtv.get(ck) ?? emptyRow(ck, cn);
    accumulate(crow, b);
    byCtv.set(ck, crow);

    if (!ownerId) {
      const pk = b.service?.ownerId ?? "_none";
      const pn = b.service?.owner?.name ?? "Chưa gán chủ dịch vụ";
      const prow = byProvider.get(pk) ?? emptyRow(pk, pn);
      accumulate(prow, b);
      byProvider.set(pk, prow);
    }
  }

  const sortByRevenue = (a: StatRow, b: StatRow) => b.revenue - a.revenue;
  return {
    totals,
    byCtv: [...byCtv.values()].sort(sortByRevenue),
    byProvider: [...byProvider.values()].sort(sortByRevenue),
  };
}
