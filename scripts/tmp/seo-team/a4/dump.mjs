import { PrismaClient } from "@prisma/client";
import { createHash } from "node:crypto";
const p = new PrismaClient();
const sha = (s) => createHash("sha1").update(s.replace(/\r\n/g, "\n").trim()).digest("hex");
const slugs = process.argv.slice(2);
for (const slug of slugs) {
  const a = await p.article.findUnique({ where: { slug }, select: { title: true, excerpt: true } });
  if (!a) { console.log("MISSING", slug); continue; }
  console.log("=====", slug);
  for (const f of ["title", "excerpt"]) {
    console.log(`[${f}] vi(${a[f].length}):`, JSON.stringify(a[f]));
    const rows = await p.translation.findMany({ where: { sourceHash: sha(a[f]) }, select: { locale: true, value: true, entity: true } });
    for (const r of rows) console.log(`   ${r.locale} ${r.entity} (${r.value.length}):`, r.value);
  }
}
await p.$disconnect();
