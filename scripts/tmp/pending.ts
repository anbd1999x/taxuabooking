import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const g = await prisma.bookingRequest.groupBy({ by: ["status", "paymentStatus"], _count: true });
  console.log(g.map((x) => `${x.status}/${x.paymentStatus}=${x._count}`).join("  "));
  const p = await prisma.bookingRequest.findMany({ where: { status: { in: ["NEW", "CONTACTING"] } }, select: { code: true, status: true, paymentStatus: true, category: true, createdAt: true, useDate: true, heldRoom: true, heldBus: true, inventoryApplied: true, ctvId: true }, orderBy: { createdAt: "desc" }, take: 25 });
  for (const b of p) console.log(b.code, b.status, b.paymentStatus, b.category, b.createdAt.toISOString().slice(0, 16), "use", b.useDate.toISOString().slice(0, 10), b.heldRoom ? "heldRoom" : "", b.heldBus ? "heldBus" : "", b.inventoryApplied ? "INV" : "", b.ctvId ? "ctv" : "");
}
main().finally(() => prisma.$disconnect());
