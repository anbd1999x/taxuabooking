import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const cc = await prisma.service.findUnique({
    where: { slug: "chung-chinh-homestay" },
    select: {
      id: true, weekendPolicy: true, contactPhone: true, distanceKm: true, mapUrl: true,
      images: { select: { url: true, isCover: true, sortOrder: true }, orderBy: { sortOrder: "asc" }, take: 3 },
      roomTypes: { select: { name: true, images: { take: 2, select: { url: true } }, rooms: { take: 2, select: { name: true, images: { take: 1, select: { url: true } } } } }, take: 2 },
    },
  });
  console.log(JSON.stringify(cc, null, 2));
  const mh = await prisma.service.findFirst({ where: { title: { contains: "Mây Hạ", mode: "insensitive" } }, select: { id: true, slug: true } });
  console.log("existing mây hạ:", mh);
}
main().finally(() => prisma.$disconnect());
