import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const list = await prisma.service.findMany({
    where: { OR: [{ title: { contains: "Dốc Mơ", mode: "insensitive" } }, { title: { contains: "Doc Mo", mode: "insensitive" } }, { slug: { contains: "doc-mo" } }, { slug: { contains: "docmo" } }] },
    include: { roomTypes: { orderBy: { sortOrder: "asc" }, include: { rooms: { orderBy: { sortOrder: "asc" } }, images: true } }, images: true, owner: true },
  });
  for (const svc of list) {
    console.log(`\n=== ${svc.title} slug=${svc.slug} id=${svc.id} cat=${svc.category} published=${svc.published} featured=${svc.featured} ownerId=${svc.ownerId ?? "-"} easyRoad=${svc.easyRoad}`);
    console.log(`    images: ${svc.images.length}`);
    for (const rt of svc.roomTypes) {
      console.log(`- Hạng: ${rt.name} id=${rt.id} cap=${rt.capacity} total=${rt.totalRooms} imgs=${rt.images.length} bathtub=${rt.hasBathtub} cloud=${rt.cloudView} bfast=${rt.breakfast} ac=${rt.airCon} heat=${rt.heating} (${rt.rooms.length} phòng)`);
      for (const r of rt.rooms) {
        console.log(`    · ${r.name} id=${r.id}: list=${r.listPrice} sale=${r.salePrice} cap=${r.capacity}/${r.maxCapacity ?? "-"} extra=${r.extraPersonFee ?? "-"} T2..CN=[${[r.priceMon,r.priceTue,r.priceWed,r.priceThu,r.priceFri,r.priceSat,r.priceSun].join(",")}] comm=${r.commission ?? "-"}`);
      }
    }
  }
  if (!list.length) console.log("KHÔNG tìm thấy service Dốc Mơ");
}
main().catch(e=>{console.error(e.message)}).finally(() => prisma.$disconnect());
