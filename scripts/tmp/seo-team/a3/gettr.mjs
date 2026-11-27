import { PrismaClient } from "@prisma/client";
import { createHash } from "node:crypto";
import fs from "node:fs";
const p = new PrismaClient();
const sha = (s) => createHash("sha1").update(s.replace(/\r\n/g, "\n").trim()).digest("hex");
fs.mkdirSync("old", { recursive: true });
for (const slug of process.argv.slice(2)) {
  const a = await p.article.findUnique({ where: { slug } });
  const out = { title: a.title, excerpt: a.excerpt };
  fs.writeFileSync(`old/${slug}.vi.md`, a.content.replace(/\r\n/g, "\n").trim());
  for (const l of ["en", "zh", "ko"]) {
    for (const f of ["title", "excerpt", "content"]) {
      const r = await p.translation.findFirst({ where: { locale: l, sourceHash: sha(a[f]), entity: { not: "DineMenu" } }, orderBy: { updatedAt: "desc" } });
      if (f === "content") fs.writeFileSync(`old/${slug}.${l}.md`, r ? r.value.trim() : "MISSING");
      else out[`${f}_${l}`] = r?.value ?? null;
    }
  }
  fs.writeFileSync(`old/${slug}.meta.json`, JSON.stringify(out, null, 1));
  console.log(slug, "ok");
}
await p.$disconnect();
