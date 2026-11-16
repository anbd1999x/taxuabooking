import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const rts = await p.roomType.findMany({ where: { service: { published: true }, OR: [{ name: { contains: "ungalow", mode: "insensitive" } }, { name: { contains: "house", mode: "insensitive" } }, { name: { contains: "Căn", mode: "insensitive" } }, { name: { contains: "nhà gỗ", mode: "insensitive" } }] }, include: { service: { select: { title: true, slug: true, area: true, easyRoad: true } }, rooms: true, images: { take: 2 } } });
for (const rt of rts) {
  console.log(`\n# ${rt.service.title} (/homestay/${rt.service.slug}, ${rt.service.area}, easyRoad=${rt.service.easyRoad}) — ${rt.name} bath=${rt.hasBathtub} cloud=${rt.cloudView} bf=${rt.breakfast} ac=${rt.airCon} heat=${rt.heating}`);
  console.log("  desc:", (rt.description||"").slice(0,250).replace(/\s+/g," "));
  console.log("  img:", rt.images.map(i=>i.url).join(" "));
  for (const r of rt.rooms) console.log(`  - ${r.name} cap=${r.capacity}/${r.maxCapacity} list=${r.listPrice} sale=${r.salePrice} fri=${r.priceFri} sat=${r.priceSat} | ${(r.description||"").slice(0,160).replace(/\s+/g," ")} | am=${(r.amenities||"").slice(0,150)}`);
}
await p.$disconnect();
