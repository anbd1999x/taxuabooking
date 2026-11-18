import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const x = await p.place.findUnique({ where: { slug: "thao-coffee-ta-xua" } });
console.log(x.content, "\n-----\n", (await p.place.findUnique({ where: { slug: "tiem-ca-phe-hoang-hon" } })).content);
for (const slug of ["chillout-village","may-ban-ta-xua","noong-oi-homestay","nha-cua-an-ta-xua","cloud-forest-ta-xua","sunset-clouds-ta-xua","khen-coffee-house-ta-xua","la-cheu-homestay"]) {
  const s = await p.service.findUnique({ where: { slug }, select: { title: true, area: true, summary: true, description: true } });
  if (s) console.log(`\n### ${slug} | ${s.area}\n${(s.description||"").replace(/\n+/g," ").slice(0,900)}`);
}
await p.$disconnect();
