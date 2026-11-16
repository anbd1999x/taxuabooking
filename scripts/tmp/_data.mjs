import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const s = await p.service.findMany({ where: { published: true, category: { in: ["HOMESTAY","BUNGALOW","CABIN"] } }, include: { roomTypes: { include: { rooms: true } }, cabinRoutes: { include: { stops: true } }, cabinPriceRows: true, images: { take: 3 } } });
for (const x of s) {
  console.log(`\n### ${x.category} | ${x.title} | /${x.category==="CABIN"?"xe-cabin":"homestay"}/${x.slug} | area=${x.area} | easyRoad=${x.easyRoad} | featured=${x.featured}`);
  console.log("summary:", (x.summary||"").slice(0,300).replace(/\s+/g," "));
  console.log("desc:", (x.description||"").slice(0,500).replace(/\s+/g," "));
  console.log("imgs:", x.images.map(i=>i.url).join(" "));
  for (const rt of x.roomTypes) {
    console.log(` RT ${rt.name} bath=${rt.hasBathtub} cloud=${rt.cloudView} bf=${rt.breakfast} ac=${rt.airCon} heat=${rt.heating}`);
    for (const r of rt.rooms) console.log(`   - ${r.name} cap=${r.capacity}/${r.maxCapacity} list=${r.listPrice} sale=${r.salePrice} sat=${r.priceSat} am=${(r.amenities||"").slice(0,120)}`);
  }
  for (const r of x.cabinRoutes) console.log(` ROUTE ${r.direction} ${r.title} ${r.totalTime} start=${r.startLabel} ${r.startInfo} | ${r.stops.map(s=>s.place+"("+(s.note||"")+")").join(" > ").slice(0,500)}`);
  for (const r of x.cabinPriceRows) console.log(` PRICE ${r.ticketType} ${r.pickupPoint} -> ${r.destination} ${r.price} ${r.note||""}`);
}
await p.$disconnect();
