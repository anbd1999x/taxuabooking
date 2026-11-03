import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
async function main() {
  const s = await p.service.findFirst({
    where: { title: { contains: "Bản Mây", mode: "insensitive" } },
    select: { id: true, title: true, sheetUrl: true },
  });
  console.log(JSON.stringify(s, null, 2));
}
main().finally(() => p.$disconnect());
