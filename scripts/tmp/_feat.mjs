import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
console.log("đang nổi bật:", await p.article.findMany({ where: { featuredOrder: { gt: 0 } }, select: { slug: true, featuredOrder: true } }));
const order = ["dat-phong-ta-xua-o-dau", "nha-xe-nao-di-ta-xua", "homestay-ta-xua-view-may-dep", "thue-xe-may-ta-xua", "du-lich-ta-xua-nen-dat-dich-vu-o-dau"];
for (const [i, slug] of order.entries()) await p.article.update({ where: { slug }, data: { featuredOrder: 50 - i * 10 } });
console.log(await p.article.findMany({ where: { featuredOrder: { gt: 0 } }, orderBy: { featuredOrder: "desc" }, select: { slug: true, featuredOrder: true } }));
await p.$disconnect();
