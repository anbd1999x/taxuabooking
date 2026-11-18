import { syncServiceSheet } from "../src/lib/sheet-sync";
import { PrismaClient } from "@prisma/client";
const SID = "cmwlzyuba0000unl0tfyhyipu", B = "https://taxuaclouds.hotelss.vn", ID = "ZI7R8aDUxtx6deBPosY4yQ==";
async function main() {
  const r = await syncServiceSheet(SID);
  console.log(r.ok, r.summary, "| lệch:", r.unmatchedRows, r.missingRooms, "| lỗi tab:", r.skippedTabs);
  const p = new PrismaClient();
  const rooms = await p.room.findMany({ where: { roomType: { serviceId: SID } }, select: { id: true, name: true, sheetAlias: true }, orderBy: { sortOrder: "asc" } });
  for (const d of ["2026-11-19", "2026-11-21", "2026-11-27", "2026-12-05", "2026-12-31", "2027-01-01", "2027-02-08"]) {
    const next = new Date(Date.parse(d) + 864e5).toISOString().slice(0, 10);
    const res = await fetch(B + "/be_get_availability", { method: "POST", headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest", Origin: B, Referer: B + "/" }, body: JSON.stringify({ building_id: ID, checkin: d, checkout: next }) });
    const j = (await res.json()) as { room_types: { rooms_inventory: { room_name: string }[] }[] };
    const free = new Set(j.room_types.flatMap((t) => t.rooms_inventory.map((x) => x.room_name.trim())));
    const st = await p.roomDayStatus.findMany({ where: { roomId: { in: rooms.map((x) => x.id) }, date: new Date(d) }, select: { roomId: true, status: true } });
    const diff = rooms.filter((x) => {
      const apiFree = [x.name, ...(x.sheetAlias ?? "").split(",").map((s) => s.trim())].some((n) => free.has(n));
      const dbFree = (st.find((s) => s.roomId === x.id)?.status ?? "AVAILABLE") === "AVAILABLE";
      return apiFree !== dbFree;
    });
    console.log(d, `API còn ${free.size}/20 phòng`, diff.length ? "LỆCH: " + diff.map((x) => x.name).join(", ") : "khớp");
  }
  await p.$disconnect();
}
main();
