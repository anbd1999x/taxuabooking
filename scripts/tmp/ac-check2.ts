import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const b = await prisma.bookingRequest.findUnique({ where: { code: "TX-3VR4P6" }, select: { status: true, paymentStatus: true, heldRoom: true, heldBus: true, amountCollected: true, cancelReason: true, customerName: true, logs: { orderBy: { createdAt: "asc" }, select: { createdAt: true, kind: true, title: true, body: true, by: true } } } });
  console.log(b?.status, b?.paymentStatus, "heldRoom", b?.heldRoom, "heldBus", b?.heldBus, "thu", String(b?.amountCollected), "|", b?.cancelReason);
  for (const l of b?.logs ?? []) console.log(" ", l.createdAt.toISOString().slice(11, 19), l.kind, "|", l.title, "|", (l.body ?? "").slice(0, 90), "|", l.by);
  const logs = await prisma.sheetSyncLog.findMany({ where: { createdAt: { gte: new Date("2026-11-12T12:30:00Z") }, service: { title: { contains: "Khèn" } } }, orderBy: { createdAt: "asc" }, select: { createdAt: true, source: true, summary: true, changes: true } });
  for (const l of logs) console.log("SYNC", l.createdAt.toISOString().slice(11, 19), l.source, l.changes, l.summary.slice(0, 200));
}
main().finally(() => prisma.$disconnect());
