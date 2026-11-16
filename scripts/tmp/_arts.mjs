import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const a = await p.article.findMany({ orderBy: { createdAt: "asc" }, select: { slug: true, title: true, topic: true, published: true, coverImage: true, content: true } });
for (const x of a) console.log(x.published ? "P" : "-", x.topic, x.slug, "|", x.title, "|", x.content.length);
await p.$disconnect();
