import { PrismaClient } from "@prisma/client";
import { syncServiceSheet } from "../../src/lib/sheet-sync";
const prisma = new PrismaClient();
const NAMES = ["Chung Chinh", "Cloud Forest", "Happy Town", "Haus Meej", "La Chếu", "Sunset Clouds"];
(async () => {
  for (const n of NAMES) {
    const s = await prisma.service.findFirst({
      where: { category: "HOMESTAY", title: { contains: n, mode: "insensitive" } },
      select: { id: true, title: true, sheetUrl: true, roomTypes: { select: { name: true, rooms: { select: { name: true, sheetAlias: true }, orderBy: { sortOrder: "asc" } } } } },
    });
    if (!s) { console.log("?? không thấy", n); continue; }
    const r = await syncServiceSheet(s.id, "MANUAL");
    console.log(`\n=== ${s.title}\n${s.sheetUrl}\n${r.ok ? r.summary : "LỖI: " + r.error} | changes=${r.changes}`);
    console.log("tabs OK:", r.syncedTabs.join(" | "), "\ntabs bỏ qua:", r.skippedTabs.join(" | "));
    console.log("DÒNG SHEET KHÔNG KHỚP:", JSON.stringify(r.unmatchedRows));
    console.log("PHÒNG APP KHÔNG THẤY TRONG SHEET:", JSON.stringify(r.missingRooms));
    console.log("Ô LẠ:", JSON.stringify(r.unknownValues));
    console.log("PHÒNG TRONG APP:", s.roomTypes.map((rt) => `[${rt.name}] ` + rt.rooms.map((x) => x.name + (x.sheetAlias ? ` (alias: ${x.sheetAlias})` : "")).join("; ")).join("\n   "));
  }
  await prisma.$disconnect();
  process.exit(0);
})();
