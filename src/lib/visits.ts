import "server-only";
import { prisma } from "./prisma";

/** Khách có lastSeen trong khoảng này được tính là "đang truy cập". */
export const ONLINE_WINDOW_MS = 5 * 60 * 1000;

/** Ghi nhận 1 lượt xem trang của khách (visitorId từ cookie ẩn danh). */
export async function recordVisit(visitorId: string): Promise<void> {
  const now = new Date();
  await prisma.$transaction([
    prisma.visitor.upsert({
      where: { id: visitorId },
      create: { id: visitorId, views: 1, firstSeen: now, lastSeen: now },
      update: { views: { increment: 1 }, lastSeen: now },
    }),
    prisma.siteCounter.upsert({
      where: { id: "main" },
      create: { id: "main", totalViews: 1 },
      update: { totalViews: { increment: 1 } },
    }),
  ]);
}

export interface VisitStats {
  totalViews: number; // tổng lượt xem trang từ trước tới giờ
  totalVisitors: number; // tổng khách truy cập (cookie duy nhất)
  online: number; // đang truy cập (hoạt động trong 5 phút gần nhất)
}

export async function getVisitStats(): Promise<VisitStats> {
  const since = new Date(Date.now() - ONLINE_WINDOW_MS);
  const [counter, totalVisitors, online] = await Promise.all([
    prisma.siteCounter.findUnique({ where: { id: "main" } }),
    prisma.visitor.count(),
    prisma.visitor.count({ where: { lastSeen: { gte: since } } }),
  ]);
  return { totalViews: counter?.totalViews ?? 0, totalVisitors, online };
}
