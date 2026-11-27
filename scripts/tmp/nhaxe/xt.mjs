import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const s = await p.service.findMany({ where: { category: "CABIN" }, select: { id:true, slug: true, title: true, summary:true, area:true, mapUrl:true, policy:true, description: true, luggage:true, luggageNote:true } });
for (const x of s) console.log(JSON.stringify(x).slice(0, 3000), "\n");
const r = await p.cabinRoute.findMany({ include: { stops: true, service: { select: { slug: true } } } });
for (const x of r) console.log(JSON.stringify(x), "\n");
await p.$disconnect();
