import { PrismaClient } from "@prisma/client";
import { placeMeta } from "../../../../src/lib/place-meta";
const p = new PrismaClient();
const t = (s: string, v?: readonly any[]) => s.replace(/\{(\d+)\}/g, (_, i) => String(v?.[+i] ?? ""));
const all = await p.place.findMany({ where: { published: true, kind: { in: ["CAFE", "RESTAURANT"] } } });
for (const x of all) { const m = placeMeta(x, t); console.log(`${m.title.length} | ${m.title}\n   ${m.description.length} | ${m.description}`); }
await p.$disconnect();
