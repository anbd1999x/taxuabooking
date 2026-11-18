import { syncServiceSheet } from "../src/lib/sheet-sync";
import { PrismaClient } from "@prisma/client";
async function main() {
  const r = await syncServiceSheet("cmwlwirx10000ungw2z3584ie");
  console.log(JSON.stringify(r, null, 2));
  const p = new PrismaClient();
  const rooms = await p.room.findMany({ where: { roomType: { serviceId: "cmwlwirx10000ungw2z3584ie" } }, select: { id: true, name: true }, orderBy: { sortOrder: "asc" } });
  for (const d of ["2026-11-19", "2026-11-30", "2026-12-12"]) {
    const st = await p.roomDayStatus.findMany({ where: { roomId: { in: rooms.map((x) => x.id) }, date: new Date(d) }, select: { roomId: true, status: true } });
    console.log(d, rooms.filter((x) => st.find((s) => s.roomId === x.id && s.status !== "AVAILABLE")).map((x) => x.name).join(", "));
  }
  await p.$disconnect();
}
main();
