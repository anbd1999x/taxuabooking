import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const a = await p.article.findUnique({ where: { slug: "o-ta-xua-nen-chon-khu-nao" } });
console.log(a.content.slice(0, 3500));
await p.$disconnect();
