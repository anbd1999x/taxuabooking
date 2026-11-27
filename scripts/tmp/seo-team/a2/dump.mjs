import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
const p = new PrismaClient();
const all = await p.article.findMany({ select: { slug: true, title: true, published: true, topic: true, excerpt:true } , orderBy:{createdAt:"desc"}});
fs.writeFileSync("scripts/tmp/seo-team/a2/orig/list.json", JSON.stringify(all,null,1));
for (const s of process.argv.slice(2)) { const a = await p.article.findUnique({ where: { slug: s } }); if (!a) { console.log("NONE", s); continue; } fs.writeFileSync(`scripts/tmp/seo-team/a2/orig/${s}.md`, a.content); fs.writeFileSync(`scripts/tmp/seo-team/a2/orig/${s}.meta.json`, JSON.stringify({title:a.title, excerpt:a.excerpt, coverImage:a.coverImage, topic:a.topic, published:a.published, updatedAt:a.updatedAt},null,1)); console.log(s, a.published, a.content.length); }
await p.$disconnect();
