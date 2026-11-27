import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const a = await p.article.findUnique({ where: { slug: process.argv[2] }, select: { content: true, updatedAt: true } });
console.log(a.updatedAt); console.log(a.content);
await p.$disconnect();
