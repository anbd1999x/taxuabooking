import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
console.log(await p.service.findMany({ where: { slug: { in: ["cloud-garden-ta-xua", "ta-xua-clouds-homestay", "de-homestay-ta-xua"] } }, select: { slug: true, title: true, area: true, mapUrl: true, updatedAt: true } }));
await p.$disconnect();
