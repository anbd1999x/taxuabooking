import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const places = await prisma.place.findMany({
    orderBy: [{ kind: "asc" }, { sortOrder: "asc" }],
    select: { id: true, kind: true, slug: true, name: true, area: true, address: true, phone: true, mapUrl: true, coverImage: true, images: true, published: true },
  });
  for (const p of places) {
    const imgs = p.images ? p.images.split("|").filter(Boolean).length : 0;
    console.log(`${p.kind} | ${p.name} | ${p.slug} | area=${p.area} | cover=${p.coverImage ? "CÓ" : "KHÔNG"} | ảnh=${imgs} | pub=${p.published}`);
    console.log(`   map=${p.mapUrl ?? "-"} | phone=${p.phone ?? "-"} | addr=${p.address ?? "-"} | id=${p.id}`);
  }
  console.log("Tổng:", places.length);
}
main().finally(() => prisma.$disconnect());
