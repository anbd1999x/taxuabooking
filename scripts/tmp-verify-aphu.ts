import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
async function main() {
  const list = await p.roomDayStatus.findMany({
    where: {
      room: { roomType: { service: { slug: "a-phu-homes" } } },
      date: { gte: new Date("2026-11-01"), lte: new Date("2026-11-05") },
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
}
main().finally(() => p.$disconnect());
