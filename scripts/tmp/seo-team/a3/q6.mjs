import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
for (const s of process.argv.slice(2)) { const x = await p.place.findUnique({ where:{slug:s} }); console.log("=====", s, JSON.stringify({ ...x, description: x?.description?.slice(0,1500) }, null, 1)); }
await p.$disconnect();
