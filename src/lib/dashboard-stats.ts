import "server-only";
import { prisma } from "./prisma";
import { toNumber } from "./format";
import { CATEGORIES } from "./constants";

/** Một đơn rút gọn cho biểu đồ Tổng quan (client tự gom theo ngày/tuần/tháng/năm). */
export interface DashBooking {
  t: number; // createdAt (ms)
  s: "NEW" | "CONTACTING" | "CONFIRMED" | "COMPLETED" | "CANCELLED";
  c: string; // nhãn loại dịch vụ
  p: number; // giá trị đơn (referencePrice; combo = tổng khách trả)
  v: string; // tên dịch vụ
  ctv: boolean; // đặt qua CTV
  u: string; // ngày sử dụng yyyy-mm-dd (UTC date)
}

export async function getDashboardBookings(): Promise<DashBooking[]> {
  const rows = await prisma.bookingRequest.findMany({
    select: {
      createdAt: true,
      status: true,
      category: true,
      referencePrice: true,
      serviceTitle: true,
      ctvId: true,
      useDate: true,
    },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((b) => ({
    t: b.createdAt.getTime(),
    s: b.status,
    c: CATEGORIES[b.category]?.shortLabel ?? b.category,
    p: toNumber(b.referencePrice) ?? 0,
    v: b.serviceTitle,
    ctv: !!b.ctvId,
    u: b.useDate.toISOString().slice(0, 10),
  }));
}
