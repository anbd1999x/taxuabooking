import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const id = "cmvxp6ruu00ltrz29o2zelhgi";
  const t0 = (await prisma.service.findUnique({ where: { id }, select: { sheetSyncedAt: true } }))!.sheetSyncedAt;
  for (let i = 0; i < 54; i++) {
    await new Promise((r) => setTimeout(r, 10000));
    const s = await prisma.service.findUnique({ where: { id }, select: { sheetSyncedAt: true, sheetSyncResult: true } });
    if (s!.sheetSyncedAt && (!t0 || s!.sheetSyncedAt > t0)) { console.log("prod synced", s!.sheetSyncedAt.toISOString(), String(s!.sheetSyncResult).slice(0, 200)); break; }
  }
  const rows = await prisma.roomDayStatus.findMany({ where: { room: { roomType: { serviceId: id } }, date: { in: [new Date("2026-11-28"), new Date("2026-12-05")] }, status: { not: "AVAILABLE" } }, select: { date: true } });
  console.log("locked 28/11:", rows.filter((r) => r.date.getUTCDate() === 28).length, "| 05/12:", rows.filter((r) => r.date.getUTCDate() === 5).length);
}
main().finally(() => prisma.$disconnect());
