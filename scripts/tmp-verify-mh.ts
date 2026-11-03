import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const list = await prisma.roomDayStatus.findMany({
    where: {
      room: { roomType: { serviceId: "cmvzgr7wn0000unc0csd4xxzz" } },
      date: { gte: new Date("2026-11-01"), lte: new Date("2026-11-08") },
    },
    select: { date: true, status: true, room: { select: { name: true } } },
    orderBy: [{ date: "asc" }],
  });
  const byDate = new Map<string, string[]>();
  for (const x of list) {
    const k = x.date.toISOString().slice(0, 10);
    byDate.set(k, [...(byDate.get(k) ?? []), x.room.name + (x.status !== "BOOKED" ? `(${x.status})` : "")]);
  }
  for (const [k, v] of byDate) console.log(k, "→", v.sort().join(", "));
  const months: { m: string; n: number }[] = await prisma.$queryRaw`
    SELECT to_char(date,'YYYY-MM') m, count(*)::int n FROM "RoomDayStatus" rds
    JOIN "Room" r ON r.id = rds."roomId" JOIN "RoomType" rt ON rt.id = r."roomTypeId"
    WHERE rt."serviceId" = 'cmvzgr7wn0000unc0csd4xxzz' GROUP BY 1 ORDER BY 1`;
  console.log(months);
}
main().finally(() => prisma.$disconnect());
