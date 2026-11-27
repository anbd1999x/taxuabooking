import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const slugs = ["phuot-ta-xua-bang-xe-may-tu-ha-noi","van-hoa-nguoi-hmong-ta-xua","trekking-sa-mu-u-bo-ta-xua","ta-xua-hay-moc-chau","tu-sapa-di-ta-xua"];
const r = await p.article.updateMany({ where: { slug: { in: slugs }, published: false }, data: { published: true, createdAt: new Date() } });
console.log("published", r.count);
console.log(await p.article.findMany({ where: { slug: { in: slugs } }, select: { slug: true, published: true } }));
await p.$disconnect();
