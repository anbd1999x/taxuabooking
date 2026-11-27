import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const slugs = process.argv.slice(2);
for (const s of slugs) { const x = await p.place.findUnique({ where: { slug: s } }); console.log("=====", x.kind, x.slug, "|", x.name, "| area:", x.area, "| price:", x.price, "| hours:", x.hours, "| tags:", x.tags, "| booking:", x.booking, "| phone:", x.phone, "| imgs:", (x.images||'').split('|').filter(Boolean).length); console.log("DESC:", x.desc); console.log(x.content); }
await p.$disconnect();
