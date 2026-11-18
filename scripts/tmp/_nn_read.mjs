import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const svcs = await p.service.findMany({ where: { OR: [{ title: { contains: "nắng", mode: "insensitive" } }, { slug: { contains: "nang" } }] }, select: { id: true, title: true, slug: true, category: true, published: true } });
console.log(svcs);
for (const s of svcs.filter((x) => /nh[ặa]t/i.test(x.title))) {
  const rts = await p.roomType.findMany({ where: { serviceId: s.id }, orderBy: { sortOrder: "asc" }, include: { rooms: { orderBy: { sortOrder: "asc" } } } });
  const n = (v) => (v == null ? "-" : Number(v) / 1000);
  for (const rt of rts) {
    console.log(`## ${rt.name}`);
    for (const r of rt.rooms) console.log(`  ${r.name.padEnd(22)} list=${n(r.listPrice)} sale=${n(r.salePrice)} | bán T2-CN: ${[r.priceMon, r.priceTue, r.priceWed, r.priceThu, r.priceFri, r.priceSat, r.priceSun].map(n).join(",")} | gạch T2-CN: ${[r.listPriceMon, r.listPriceTue, r.listPriceWed, r.listPriceThu, r.listPriceFri, r.listPriceSat, r.listPriceSun].map(n).join(",")}`);
  }
}
await p.$disconnect();
