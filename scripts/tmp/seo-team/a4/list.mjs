import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const arts = await p.article.findMany({ where: { published: true }, select: { slug: true, title: true, topic: true, excerpt:true }, orderBy: { topic: "asc" } });
const by = {};
for (const a of arts) (by[a.topic ?? "null"] ??= []).push(a);
for (const [k, v] of Object.entries(by)) { console.log("##", k, v.length); for (const a of v) console.log("  ", a.slug, "|", a.title); }
await p.$disconnect();
