import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
async function main() {
  const s = await p.service.findFirst({
    where: { title: { contains: "Lưng Chừng" } },
    select: { title: true, sheetUrl: true, roomTypes: { select: { name: true, rooms: { select: { name: true } } } } },
  });
  console.log(JSON.stringify(s, null, 1));
}
main().finally(() => p.$disconnect());
