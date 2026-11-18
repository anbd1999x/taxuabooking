import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const s = await p.service.findMany({ where: { OR: [{ title: { contains: "chill", mode: "insensitive" } }, { slug: { contains: "chill" } }] }, select: { id: true, title: true, slug: true, category: true, published: true } });
console.log(JSON.stringify(s));
await p.$disconnect();
