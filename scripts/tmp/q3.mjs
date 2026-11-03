import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const arts = await p.article.findMany({ orderBy:{createdAt:"asc"}, select: { slug:true, title:true, topic:true, content:true } });
console.log("ARTICLES:", arts.length);
console.log(arts.map(a=>`${a.topic}|${a.slug}|${a.title}|${a.content.length}`).join("\n"));
// links used in articles pointing to /kinh-nghiem/ that don't exist
const slugs = new Set(arts.map(a=>a.slug));
const missing = new Set();
for (const a of arts) for (const m of a.content.matchAll(/\/kinh-nghiem\/([a-z0-9-]+)/g)) if (!slugs.has(m[1])) missing.add(m[1]);
console.log("\nMISSING LINK TARGETS:", [...missing].join("\n"));
await p.$disconnect();
