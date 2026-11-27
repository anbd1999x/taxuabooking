import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const rows = await p.article.findMany({ where: { OR: [{ content: { contains: "Hồng Ngọc" } }, { content: { contains: "công bố còn ít" } }, { content: { contains: "chưa rõ" } }] }, select: { slug: true, title: true, topic: true, updatedAt: true } });
console.log(rows);
await p.$disconnect();
