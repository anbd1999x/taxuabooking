import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const ps = await p.place.findMany({ where: { kind: { in: ["RESTAURANT","CAFE"] } }, orderBy: [{ kind: "asc" }, { name: "asc" }] });
for (const x of ps) console.log(`\n[${x.kind}] ${x.published?"P":"-"} ${x.name} | slug=${x.slug} | area=${x.area} | addr=${x.address||""} | price=${x.price||""} | hours=${x.hours||""} | tags=${x.tags||""} | img=${x.image||x.images?.length||""}\n desc(${(x.desc||"").length}): ${(x.desc||"").replace(/\s+/g," ").slice(0,300)}\n tip: ${(x.tip||"").slice(0,200)}\n content(${(x.content||"").length}): ${(x.content||"").replace(/\s+/g," ").slice(0,200)}`);
console.log("\nTOTAL", ps.length);
await p.$disconnect();
