import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const s = await p.service.findUnique({ where: { id: "cmwlzyuba0000unl0tfyhyipu" }, select: { description: true, policy: true } });
console.log((s.description + s.policy).split("\n").filter((l) => /Family 8|phòng:/.test(l)));
await p.$disconnect();
