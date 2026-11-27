import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const a = await p.article.findMany({ select: { slug: true, title: true, topic: true, published: true, coverImage:true }, orderBy:{createdAt:"asc"} });
for (const x of a) console.log((x.published?"":"(ẩn) ")+x.slug+" | "+x.title+" | "+x.topic);
console.log(a.length);
await p.$disconnect();
