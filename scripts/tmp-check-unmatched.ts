import { PrismaClient } from "@prisma/client";
import { syncServiceSheet } from "../src/lib/sheet-sync";
const prisma = new PrismaClient();
const SLUGS = ["a-phu-home-s", "chillout-village", "la-cheu-homestay", "phong-lai-homstay"];
async function main() {
  const services = await prisma.service.findMany({
    where: { category: { in: ["HOMESTAY", "BUNGALOW"] }, sheetUrl: { not: null } },
    select: { id: true, slug: true, title: true, sheetUrl: true,
      roomTypes: { select: { name: true, rooms: { select: { name: true }, orderBy: { sortOrder: "asc" } } }, orderBy: { sortOrder: "asc" } } },
  });
  for (const s of services) {
    const r = await syncServiceSheet(s.id, "CRON"); // CRON: không ghi log nếu không đổi
    if (!r.unmatchedRows.length && !r.missingRooms.length) continue;
    console.log("=== " + s.title + " (" + s.slug + ")");
    console.log("  sheet:", s.sheetUrl);
    if (r.unmatchedRows.length) console.log("  KHÔNG KHỚP:", JSON.stringify(r.unmatchedRows));
    if (r.missingRooms.length) console.log("  PHÒNG APP THIẾU TRONG SHEET:", JSON.stringify(r.missingRooms));
    console.log("  phòng trong app:", s.roomTypes.map(rt => rt.rooms.map(x => x.name).join(", ")).join(" | "));
  }
}
main().finally(() => prisma.$disconnect());
