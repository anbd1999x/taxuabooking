import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const p = await prisma.place.findUnique({ where: { slug: "thao-coffee-ta-xua" }, select: { coverImage: true, images: true } });
  console.log("cover:", p?.coverImage);
  console.log("images:", (p?.images ?? "").split("|").slice(0, 3).join("\n"));
}
main().finally(() => prisma.$disconnect());
