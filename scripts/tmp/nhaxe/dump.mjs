import { PrismaClient } from "@prisma/client";
import { createHash } from "node:crypto";
import fs from "node:fs";
const p = new PrismaClient();
const sha = (s) => createHash("sha1").update(s.replace(/\r\n/g, "\n").trim()).digest("hex");
const slugs = process.argv.slice(2);
const dir = "scripts/tmp/nhaxe/src"; fs.mkdirSync(dir, { recursive: true });
for (const slug of slugs) {
  const a = await p.article.findUnique({ where: { slug } });
  for (const f of ["title","excerpt","content"]) {
    const v = a[f]; if (!v) continue;
    fs.writeFileSync(`${dir}/${slug}.${f}.vi.md`, v);
    const tr = await p.translation.findMany({ where: { sourceHash: sha(v) } });
    for (const t of tr) fs.writeFileSync(`${dir}/${slug}.${f}.${t.locale}.md`, t.text ?? t.value ?? JSON.stringify(t));
  }
}
const one = await p.translation.findFirst(); console.log(Object.keys(one));
await p.$disconnect();
