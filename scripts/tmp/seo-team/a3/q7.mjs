import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const a = await p.article.findMany({ where:{published:true}, select:{slug:true,coverImage:true,content:true} });
const seen = new Map();
for (const x of a) { for (const m of x.content.matchAll(/!\[([^\]]*)\]\((\/uploads\/[^)]+)\)/g)) if(!seen.has(m[2])) seen.set(m[2], m[1]+"  ["+x.slug+"]"); }
for (const [u,alt] of seen) console.log(u, "|", alt);
await p.$disconnect();
