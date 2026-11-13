import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  await new Promise((r) => setTimeout(r, 400_000)); // ~6,5 phút: đủ 1 lượt hẹn giờ (1' sau khởi động + chu kỳ 5') và 1 lượt đồng bộ sheet
  const logs = await prisma.bookingLog.findMany({ where: { by: "Hệ thống", title: "Tự động huỷ đơn" }, select: { createdAt: true, body: true, booking: { select: { code: true } } }, orderBy: { createdAt: "desc" }, take: 10 });
  console.log("đơn bị tự huỷ:", logs.length, logs.map((l) => `${l.booking.code} ${l.createdAt.toISOString().slice(0, 16)} ${l.body}`).join(" | "));
  const g = await prisma.bookingRequest.groupBy({ by: ["status", "paymentStatus"], _count: true });
  console.log(g.map((x) => `${x.status}/${x.paymentStatus}=${x._count}`).join("  "));
  const sync = await prisma.sheetSyncLog.findMany({ where: { createdAt: { gte: new Date(Date.now() - 420_000) } }, select: { ok: true, summary: true }, take: 50 });
  console.log("log đồng bộ 7 phút qua:", sync.length, "| lỗi:", sync.filter((s) => !s.ok).length, "| có tự huỷ:", sync.filter((s) => s.summary.includes("tự huỷ")).length);
  const s = await prisma.service.findFirst({ where: { sheetUrl: { not: null } }, orderBy: { sheetSyncedAt: "desc" }, select: { title: true, sheetSyncedAt: true, sheetSyncResult: true } });
  console.log("đồng bộ gần nhất:", s?.title, s?.sheetSyncedAt?.toISOString(), s?.sheetSyncResult?.slice(0, 80));
}
main().finally(() => prisma.$disconnect());
