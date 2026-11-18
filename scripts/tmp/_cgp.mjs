import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
for (const r of await p.room.findMany({ where: { roomType: { serviceId: "cmwlz09f70000un9walnpxij5" } }, orderBy: { sortOrder: "asc" } }))
  console.log(r.name, Object.entries(r).filter(([k, v]) => /price|commission/i.test(k) && v != null).map(([k, v]) => `${k}=${v}`).join(" "));
await p.$disconnect();
