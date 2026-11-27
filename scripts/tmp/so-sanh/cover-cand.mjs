import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
const p = new PrismaClient();
const arts = await p.article.findMany({ where: { published: true }, select: { slug: true, title: true, coverImage: true, content: true, topic: true } });
const pool = new Map();
for (const a of arts) for (const m of a.content.matchAll(/!\[([^\]]*)\]\((\/uploads\/[^)]+)\)/g)) if (!pool.has(m[2])) pool.set(m[2], { alt: m[1], uses: 0 });
for (const a of arts) for (const m of a.content.matchAll(/\((\/uploads\/[^)]+)\)/g)) if (pool.has(m[1])) pool.get(m[1]).uses++;
const covers = new Set(arts.map((a) => a.coverImage));
const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d");
const STOP = new Set("ta xua tai cua va o di den the nao bao nhieu co khong nen la cho mot nhung cac voi tu gi khi theo".split(" "));
const toks = (s) => new Set(norm(s).split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !STOP.has(w)));
const ROOM = /phòng|giường|bồn tắm|sàn gỗ|ban công|nhà gỗ|bungalow|căn/i;
const out = [];
for (const a of arts) {
  const imgs = [...a.content.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)].map((m) => m[1]);
  if (!imgs.includes(a.coverImage)) continue;
  const tt = toks(a.title + " " + a.slug.replace(/-/g, " "));
  const isReview = a.topic === "review-homestay";
  const cands = [...pool].filter(([u]) => !imgs.includes(u) && !covers.has(u) && (isReview || !ROOM.test(pool.get(u).alt)))
    .map(([u, v]) => { const at = toks(v.alt); let s = 0; for (const w of tt) if (at.has(w)) s++; return { u, alt: v.alt, s }; })
    .sort((x, y) => y.s - x.s).slice(0, 3);
  out.push({ slug: a.slug, title: a.title, topic: a.topic, cands });
}
fs.writeFileSync("scripts/tmp/so-sanh/cover-cand.json", JSON.stringify(out, null, 1));
for (const o of out) console.log(`\n# ${o.slug} — ${o.title}\n` + o.cands.map((c, i) => `  ${i} [${c.s}] ${c.alt.slice(0, 110)}`).join("\n"));
await p.$disconnect();
