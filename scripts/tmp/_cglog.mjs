import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const s = await p.service.findUnique({ where: { slug: "cloud-garden-ta-xua" }, select: { sheetSyncedAt: true, sheetSyncResult: true } });
console.log(s);
console.log(await p.sheetSyncLog.findMany({ where: { serviceId: "cmwlz09f70000un9walnpxij5" }, orderBy: { createdAt: "desc" }, take: 4, select: { createdAt: true, ok: true, source: true, summary: true } }));
await p.$disconnect();
