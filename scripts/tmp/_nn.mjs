import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const s = await p.service.findMany({ where: { slug: { contains: "nang" } }, select: { id: true, title: true, slug: true, basePrice: true, originalPrice: true, roomTypes: { select: { name: true, weekdayPrice: true, weekendPrice: true, rooms: { orderBy: { sortOrder: "asc" } } } } } });
for (const x of s) { console.log(x.id, x.title, x.slug, String(x.basePrice), String(x.originalPrice));
  for (const t of x.roomTypes) { console.log(" ", t.name, String(t.weekdayPrice), String(t.weekendPrice));
    for (const r of t.rooms) console.log("    ", r.id, r.name, "list", String(r.listPrice), "sale", String(r.salePrice), "days", ["priceMon","priceTue","priceWed","priceThu","priceFri","priceSat","priceSun"].map(k => String(r[k])).join(","), "listDays", Object.keys(r).filter(k => /^list.+/.test(k) && k!=="listPrice").map(k=>k+"="+r[k]).join(","), "comm", String(r.commission)); } }
await p.$disconnect();
