import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const s = await p.siteSetting.findMany({ where:{ key:{ in:["holidays","comboDiscount"] } } });
for (const x of s) console.log(x.key, typeof x.value==="string"? x.value : JSON.stringify(x.value));
await p.$disconnect();
