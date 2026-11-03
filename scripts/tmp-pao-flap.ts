import { PrismaClient } from "@prisma/client";
import { syncServiceSheet } from "../src/lib/sheet-sync";
const p = new PrismaClient();

async function snapshot(svcId: string) {
  const rows = await p.roomDayStatus.findMany({
    where: { note: "SHEET", room: { roomType: { serviceId: svcId } } },
    select: { date: true, status: true, room: { select: { name: true } } },
  });
  return new Map(rows.map(r => [`${r.room.name}|${r.date.toISOString().slice(0,10)}`, r.status]));
}

async function main() {
  const svc = await p.service.findFirst({ where: { title: { contains: "Pao" } }, select: { id: true, title: true, sheetUrl: true } });
  if (!svc) return;
  console.log(svc.title, svc.sheetUrl);
  const before = await snapshot(svc.id);
  const res = await syncServiceSheet(svc.id, "MANUAL");
  console.log("changes:", res.changes, res.summary);
  const after = await snapshot(svc.id);
  for (const [k, v] of after) if (before.get(k) !== v) console.log(`+/≠ ${k}: ${before.get(k) ?? "(trống)"} -> ${v}`);
  for (const [k, v] of before) if (!after.has(k)) console.log(`- ${k}: ${v} -> (trống)`);
}
main().finally(() => p.$disconnect());
