import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const arts = await p.article.findMany({ select: { slug:true, title:true, topic:true, coverImage:true, content:true } });
console.log("ARTICLES:", arts.length);
for (const a of arts) console.log(" -", a.slug, "|", a.title, "| topic:", a.topic, "| cover:", a.coverImage, "| len:", a.content.length);
const svcs = await p.service.findMany({ select: { title:true, slug:true, category:true, area:true, distanceKm:true, featured:true, basePrice:true, easyRoad:true, images: { select:{url:true}, take:4 } } });
console.log("\nSERVICES:", svcs.length);
for (const s of svcs) console.log(" -", s.category, "|", s.title, "|", s.slug, "| area:", s.area, "| km:", s.distanceKm, "| feat:", s.featured, "| price:", s.basePrice, "| easyRoad:", s.easyRoad, "|", s.images.map(i=>i.url).join(" "));
await p.$disconnect();
