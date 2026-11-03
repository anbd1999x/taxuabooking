import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
async function main() {
  const day = new Date(Date.UTC(2026, 10, 7)); // đêm 7/11 (kỳ 7→8/11)
  const svcs = await p.service.findMany({
    where: { category: "HOMESTAY", published: true },
    select: { title: true, roomTypes: { select: { rooms: { select: { id: true } } } } },
  });
  const allIds = svcs.flatMap(s => s.roomTypes.flatMap(rt => rt.rooms.map(r => r.id)));
  const occ = new Set((await p.roomDayStatus.findMany({
    where: { roomId: { in: allIds }, date: day, status: { not: "AVAILABLE" } },
    select: { roomId: true },
  })).map(r => r.roomId));
  let totFree = 0, totRooms = 0;
  for (const s of svcs) {
    const ids = s.roomTypes.flatMap(rt => rt.rooms.map(r => r.id));
    const free = ids.filter(id => !occ.has(id)).length;
    totFree += free; totRooms += ids.length;
    console.log(`${free}/${ids.length} trống | ${s.title}`);
  }
  console.log(`TỔNG: ${totFree}/${totRooms} phòng trống đêm 7/11`);
}
main().finally(() => p.$disconnect());
