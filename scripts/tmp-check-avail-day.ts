import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
async function main() {
  const key = process.argv[2] ?? "2026-11-29";
  const [y, m, d] = key.split("-").map(Number);
  const day = new Date(Date.UTC(y, m - 1, d));
  const svcs = await p.service.findMany({
    where: { category: "HOMESTAY", published: true },
    select: { title: true, roomTypes: { select: { rooms: { select: { id: true, name: true } } } } },
  });
  const allIds = svcs.flatMap(s => s.roomTypes.flatMap(rt => rt.rooms.map(r => r.id)));
  const rows = await p.roomDayStatus.findMany({
    where: { roomId: { in: allIds }, date: day, status: { not: "AVAILABLE" } },
    select: { roomId: true, status: true, note: true },
  });
  const occ = new Map(rows.map(r => [r.roomId, r]));
  let totFree = 0, totRooms = 0;
  for (const s of svcs) {
    const rms = s.roomTypes.flatMap(rt => rt.rooms);
    const free = rms.filter(r => !occ.has(r.id)).length;
    totFree += free; totRooms += rms.length;
    const notes = [...new Set(rms.filter(r => occ.has(r.id)).map(r => `${occ.get(r.id)!.status}/${occ.get(r.id)!.note ?? "app"}`))];
    console.log(`${free}/${rms.length} trống | ${s.title} | ${notes.join(", ")}`);
  }
  console.log(`TỔNG ${key}: ${totFree}/${totRooms} phòng trống`);
}
main().finally(() => p.$disconnect());
