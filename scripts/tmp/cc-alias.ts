import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const MAP: Record<string, string> = {
  "Nhà sàn 1": "Nhà sàn 101", "Nhà sàn 2": "Nhà sàn 102", "Nhà sàn 3": "Nhà sàn 103", "Nhà sàn 4": "Nhà sàn 104",
  "Nhà sàn 5": "Nhà sàn 105", "Nhà sàn 6": "Nhà sàn 106", "Nhà sàn vip 1": "Nhà sàn vip 107", "Nhà sàn vip 2": "Nhà sàn vip 108",
  "Bungalow 1": "Bungalow 201", "Bungalow 2": "Bungalow 202", "Bungalow 3": "Bungalow 203", "Bungalow 4": "Bungalow 204",
  "Vip 2 giường": "Vip 2 giường303", "Vip 1 -3 giường": "Vip 301-3 giường", "Vip 2 -3 giường": "Vip 302-3 giường",
};
(async () => {
  const s = await prisma.service.findFirst({ where: { title: { contains: "Chung Chinh" }, category: "HOMESTAY" }, select: { roomTypes: { select: { rooms: { select: { id: true, name: true, sheetAlias: true } } } } } });
  let n = 0;
  for (const r of s!.roomTypes.flatMap((t) => t.rooms)) {
    const a = MAP[r.name.trim()];
    if (!a) { console.log("không có alias cho:", r.name); continue; }
    if (r.sheetAlias) { console.log("đã có alias, bỏ qua:", r.name, r.sheetAlias); continue; }
    await prisma.room.update({ where: { id: r.id }, data: { sheetAlias: a } });
    n++;
  }
  console.log("đã gán alias:", n);
  await prisma.$disconnect();
})();
