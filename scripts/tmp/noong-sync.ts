import { PrismaClient } from "@prisma/client";
import { syncServiceSheet } from "../../src/lib/sheet-sync";

const prisma = new PrismaClient();

async function snapshot(serviceId: string) {
  const rows = await prisma.roomDayStatus.findMany({
    where: { room: { roomType: { serviceId } }, date: { gte: new Date("2026-11-11"), lte: new Date("2026-12-10") } },
    select: { date: true, status: true, note: true, room: { select: { name: true } } },
    orderBy: [{ date: "asc" }],
  });
  const byDay = new Map<string, string[]>();
  for (const r of rows) {
    if (r.status === "AVAILABLE") continue;
    const d = r.date.toISOString().slice(5, 10);
    byDay.set(d, [...(byDay.get(d) ?? []), `${r.room.name.replace(/[^0-9]/g, "") || r.room.name}${r.status === "BOOKED" ? "" : ":" + r.status[0]}`]);
  }
  return [...byDay.entries()].map(([d, v]) => `${d}: ${v.sort((a, b) => parseInt(a) - parseInt(b)).join(" ")}`).join("\n");
}

async function main() {
  const svc = await prisma.service.findFirst({
    where: { sheetUrl: { contains: "1lnrvD2qdKHdo26luy8mx4o-bJWPxmeNZ2pjZ8MzmD4M" } },
    select: { id: true, title: true, sheetUrl: true, roomTypes: { select: { rooms: { select: { name: true, sheetAlias: true } } } } },
  });
  if (!svc) throw new Error("no service with that sheet");
  console.log(svc.title, "|", svc.roomTypes.flatMap((t) => t.rooms.map((r) => r.name + (r.sheetAlias ? `(${r.sheetAlias})` : ""))).join(", "));
  console.log("--- BEFORE\n" + (await snapshot(svc.id)));
  const res = await syncServiceSheet(svc.id, "MANUAL");
  console.log("--- SYNC", JSON.stringify(res, null, 1));
  console.log("--- AFTER\n" + (await snapshot(svc.id)));
}
main().finally(() => prisma.$disconnect());
