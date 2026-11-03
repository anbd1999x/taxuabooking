import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const p = await prisma.place.findFirst({ where: { slug: "chill-cafe" }, select: { name:true, coverImage:true, images:true } });
  console.log("cover:", p?.coverImage);
  console.log("images[0..2]:", (p?.images??"").split("|").slice(0,3));
  const p2 = await prisma.place.findFirst({ where: { slug: "panorama-coffee" }, select: { coverImage:true } });
  console.log("panorama cover:", p2?.coverImage);
}
main().finally(()=>prisma.$disconnect());
