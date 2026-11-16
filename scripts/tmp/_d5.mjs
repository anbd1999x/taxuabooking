import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const slugs = ["pang-village-ta-xua","nha-may-si","a-phu-homes","a-phu-lung-chung","sunset-clouds-ta-xua","pao-homestay","happy-town-ta-xua","chung-chinh-homestay","cloud-forest-ta-xua","noong-oi-homestay","thac-may-ta-xua","la-cheu-homestay","ta-xua-hill","mons-house-ta-xua","may-ha-retreat","ta-xua-retreat","lao-xan","chillout-village","bep-nha-tao"];
const ss = await p.service.findMany({ where: { slug: { in: slugs } }, include: { images: { take: 4, orderBy: { sortOrder: "asc" } } } });
for (const s of ss) {
  const txt = [s.description, s.policy].join("\n");
  const hits = txt.split(/\n|\. /).filter(l => /dốc|đường|đón|xe ôm|km|cách trung tâm|ô tô|xe máy|check-in|nhận phòng/i.test(l)).map(l=>l.trim().slice(0,200));
  console.log(`\n# ${s.slug} | ${s.area} | easy=${s.easyRoad}\n imgs: ${s.images.map(i=>i.url+"{"+(i.alt||"")+"}").join(" ")}\n ${hits.slice(0,10).join("\n ")}`);
}
const tr = await p.service.findMany({ where: { published: true, category: { in: ["XEOM","TAXI"] } }, include: { transport: true } });
for (const t of tr) console.log("\nTRANSPORT", t.category, t.title, t.slug, JSON.stringify(t.transport).slice(0,400));
const a = await p.article.findUnique({ where: { slug: "gia-xe-om-taxi-ta-xua" } });
console.log("\n=== xe om article\n", a.content.slice(0, 5000));
await p.$disconnect();
