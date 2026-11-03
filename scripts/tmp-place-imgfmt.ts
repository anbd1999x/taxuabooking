import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
async function main() {
  const x = await p.place.findFirst({ where: { coverImage: { not: null } }, select: { name: true, coverImage: true, images: true } });
  console.log(x?.name, "| cover:", x?.coverImage, "| images[0..1]:", x?.images?.split("|").slice(0, 2));
}
main().finally(() => p.$disconnect());
