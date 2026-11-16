import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
const p = new PrismaClient();
const svc = new Set((await p.service.findMany({ where: { published: true }, select: { slug: true } })).map(s => s.slug));
const art = new Set((await p.article.findMany({ where: { published: true }, select: { slug: true } })).map(s => s.slug));
["bungalow-ta-xua","review-nha-xe-quang-nghia-ta-xua","xe-cabin-tra-khach-tan-homestay-ta-xua"].forEach(s => { if (art.has(s)) console.log("SLUG EXISTS!", s); art.add(s); });
const pages = new Set(["/homestay","/xe-cabin","/combo","/tra-cuu","/xe-om","/taxi"]);
for (const f of ["a","b","c"]) {
  const t = fs.readFileSync(`scripts/tmp/articles/${f}.md`, "utf8");
  for (const [, u] of t.matchAll(/\]\((\/[^)]+)\)/g)) {
    if (u.startsWith("/uploads/")) continue;
    const m = u.match(/^\/(homestay|xe-cabin|kinh-nghiem)\/([^/?#]+)$/);
    const ok = pages.has(u) || (m && (m[1] === "kinh-nghiem" ? art.has(m[2]) : svc.has(m[2])));
    if (!ok) console.log(f, "BAD", u);
  }
}
console.log("done");
await p.$disconnect();
