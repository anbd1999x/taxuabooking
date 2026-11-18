import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const ps = await p.place.findMany({ where: { kind: { in: ["RESTAURANT","CAFE"] }, published: true }, include: { reviews: { where: { approved: true } } }, orderBy: [{ kind: "asc" }, { name: "asc" }] });
for (const x of ps) {
  const imgs = [x.coverImage, ...(x.images||"").split("|")].filter(Boolean);
  console.log(`${x.kind[0]} | ${x.slug} | ${x.name} | ${x.area} | addr=${x.address||""} | ph=${x.phone||""} | price=${x.price||""} | h=${x.hours||""}/${x.hoursWeekend||""} | book=${x.booking||""} | tags=${x.tags||""} | desc=${(x.desc||"").length} | tip=${(x.tip||"").length} | content=${(x.content||"").length} | imgs=${imgs.length} ${imgs.slice(0,3).join(",")} | rev=${x.reviews.length} ${x.reviews.map(r=>r.rating+":"+r.content.slice(0,80)).join(" / ")}`);
}
await p.$disconnect();
