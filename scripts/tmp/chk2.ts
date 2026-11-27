import { prisma } from "../../src/lib/prisma";
async function main() {
  const bs = await prisma.bookingRequest.findMany({ orderBy: { updatedAt: "desc" }, take: 6, select: { code: true, category: true, updatedAt: true, createdAt: true, serviceTitle: true, referencePrice: true, roomAmount: true } });
  console.log(bs);
  const logs = await prisma.bookingLog.findMany({ orderBy: { createdAt: "desc" }, take: 8, select: { createdAt: true, title: true, booking: { select: { code: true } } } });
  console.log(logs.map((l) => [l.createdAt.toISOString(), l.booking.code, l.title]));
}
main().finally(() => prisma.$disconnect());
