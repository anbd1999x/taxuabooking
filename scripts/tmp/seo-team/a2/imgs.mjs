import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const arts = await p.article.findMany({ where: { published: true }, select: { slug: true, content: true } });
const seen = new Map();
for (const a of arts) for (const m of a.content.matchAll(/!\[([^\]]*)\]\((\/uploads\/[^)]+)\)/g)) { if (!seen.has(m[2])) seen.set(m[2], [m[1], a.slug]); }
const re = new RegExp(process.argv[2], "i");
for (const [src, [alt, slug]] of seen) if (re.test(alt)) console.log(src, "|", alt, "|", slug);
await p.$disconnect();
