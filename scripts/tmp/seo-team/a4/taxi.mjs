import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const s = await p.service.findMany({ where: { category: "TAXI", published: true }, select: { title: true, slug: true, summary: true, description: true } });
for (const x of s) { const txt = JSON.stringify(x); const m = txt.match(/.{0,80}(Hà Nội|Ha Noi|Hanoi|Nội Bài|Mỹ Đình).{0,80}/gi); console.log(x.slug, "|", m ? m.slice(0, 3).join(" ### ") : "-"); }
const cols = await p.$queryRawUnsafe(`select column_name from information_schema.columns where table_name='Service' and column_name ilike '%pric%'`); console.log(cols);
await p.$disconnect();
