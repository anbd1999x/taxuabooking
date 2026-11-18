import { syncServiceSheet } from "../src/lib/sheet-sync";
import { PrismaClient } from "@prisma/client";
async function main() {
  const r = await syncServiceSheet("cmwlsv2li0000unncr6citxcn");
  console.log(JSON.stringify(r, null, 2));
  const p = new PrismaClient();
  const rooms = await p.room.findMany({ where: { roomType: { serviceId: "cmwlsv2li0000unncr6citxcn" } }, select: { id: true, name: true }, orderBy: { sortOrder: "asc" } });
  for (const d of ["2026-11-19", "2026-11-27", "2026-11-29", "2026-12-04", "2026-12-09", "2026-12-19", "2026-12-27"]) {
    const st = await p.roomDayStatus.findMany({ where: { roomId: { in: rooms.map((x) => x.id) }, date: new Date(d) }, select: { roomId: true, status: true } });
    console.log(d, rooms.map((x) => `${x.name}=${st.find((s) => s.roomId === x.id)?.status ?? "-"}`).join(" | "));
  }
  await p.$disconnect();
}
main();
