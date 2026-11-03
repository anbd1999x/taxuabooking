import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const s = await prisma.service.update({
    where: { slug: "may-ha-retreat" },
    data: { weekendPolicy: "SAT_PAIRED" },
    select: { title: true, weekendPolicy: true },
  });
  console.log(s);
}
main().finally(() => prisma.$disconnect());
