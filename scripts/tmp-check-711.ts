import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
async function main() {
  const day = new Date(Date.UTC(2026, 10, 7));
  const n = await p.roomDayStatus.count({
    where: { date: day, room: { roomType: { service: { title: { contains: "Bản Mây" } } } }, status: "BOOKED" },
  });
  console.log("Bản Mây 7/11 BOOKED:", n);
}
main().finally(() => p.$disconnect());
