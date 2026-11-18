import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const id = "cmwlzyuba0000unl0tfyhyipu";
const s = await p.service.findUnique({ where: { id }, select: { description: true } });
const description = s.description.split("\n").filter((l) => !l.startsWith("- **Family 8 người**")).join("\n");
await p.service.update({ where: { id }, data: { description } });
console.log(description.split("\n").filter((l) => /Family/.test(l)));
await p.$disconnect();
