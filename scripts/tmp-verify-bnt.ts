import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const SID = "cmvzgzju40000unj857mkzx27";
async function main() {
  const list = await prisma.roomDayStatus.findMany({
    where: {
      room: { roomType: { serviceId: SID } },
      date: { in: [new Date("2026-11-02"), new Date("2026-11-24"), new Date("2026-11-25")] },
    },
    select: { date: true, status: true, room: { select: { name: true } } },
  });
  const byDate = new Map<string, string[]>();
  for (const x of list) {
    const k = x.date.toISOString().slice(0, 10);
    byDate.set(k, [...(byDate.get(k) ?? []), x.room.name + (x.status !== "BOOKED" ? `(${x.status})` : "")]);
  }
  for (const [k, v] of [...byDate].sort()) console.log(k, "→", v.sort((a, b) => a.localeCompare(b, "vi", { numeric: true })).join(", "));
  const months: { m: string; n: number }[] = await prisma.$queryRaw`
    SELECT to_char(date,'YYYY-MM') m, count(*)::int n FROM "RoomDayStatus" rds
    JOIN "Room" r ON r.id = rds."roomId" JOIN "RoomType" rt ON rt.id = r."roomTypeId"
    WHERE rt."serviceId" = ${SID} GROUP BY 1 ORDER BY 1`;
  console.log(months);
}
main().finally(() => prisma.$disconnect());
