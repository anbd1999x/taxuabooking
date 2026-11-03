import { PrismaClient } from "@prisma/client";
import { syncServiceSheet } from "../src/lib/sheet-sync";

const p = new PrismaClient();
async function main() {
  const svcId = "cmvzejt8r0000un78ii4m3a8n"; // Bản Mây Tà Xùa Retreat
  const res = await syncServiceSheet(svcId, "MANUAL");
  console.log(JSON.stringify({ ...res, syncedTabs: res.syncedTabs.join(", ") }, null, 1));

  // Đối chiếu ngày 7/11/2026
  const day = new Date(Date.UTC(2026, 10, 7));
  const rows = await p.roomDayStatus.findMany({
    where: { date: day, room: { roomType: { serviceId: svcId } } },
    select: { status: true, note: true, room: { select: { name: true } } },
    orderBy: { room: { name: "asc" } },
  });
  console.log(`7/11: ${rows.length} phòng có trạng thái:`);
  for (const r of rows) console.log(` ${r.room.name} -> ${r.status} (${r.note ?? "đơn app"})`);
}
main().finally(() => p.$disconnect());
