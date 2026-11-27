// node --env-file=.env fixnums.mjs [--apply]
import { PrismaClient } from "@prisma/client";
import { createHash } from "node:crypto";
import fs from "node:fs";
const APPLY = process.argv.includes("--apply");
const p = new PrismaClient();
const sha = (s) => createHash("sha1").update(s.replace(/\r\n/g, "\n").trim()).digest("hex");
const KEEP = /(Xím Vàng|Sống lưng|Mâm Xôi|Háng Đồng|Chống Tra|Mỏm|Thảo nguyên|Hồ mắt|Pàng|Cáo A|Hang Chú|Làng Chếu)/i;
const PASS = /(đèo|Bắc Yên|trung chuyển|lên Tà Xùa|lên trung tâm|lên xã|cuối)/i;
const T15 = /(?<![\d.,])15(\s?)(km|公里|킬로미터|킬로)/g;
const T215 = /(?<![\d.,])215(?=\s?(?:km|公里|킬로|\*\*)|\s*(?:–|-|~|đến|to|至|到)\s*220)/g;
const FORCE = /(Rà phanh liên tục 15km|Cách tính đoạn 15km này|15km đèo từ Bắc Yên)/;
function sentenceAt(text, idx) {
  let s = idx, e = idx;
  while (s > 0 && !/[\n|]/.test(text[s - 1]) && !(text[s - 1] === " " && /[.?!:]/.test(text[s - 2]))) s--;
  while (e < text.length && !/[\n|]/.test(text[e]) && !(/[.?!]/.test(text[e]) && text[e + 1] === " ")) e++;
  return text.slice(s, e);
}
// decide for vi: returns {d15:[bool...], d215:[kind...]}
function decideVi(t) {
  const d15 = [];
  for (const m of t.matchAll(T15)) {
    const pre = t.slice(Math.max(0, m.index - 6), m.index);
    const sen = sentenceAt(t, m.index);
    const range = /(đến|–|-|~|tới)\s?$/.test(pre);
    const after = t.slice(m.index, m.index + 16);
    const force = !range && (FORCE.test(sen) || /^15\s?km\s(đèo|đường đèo)/.test(after));
    d15.push(force || (!range && PASS.test(sen) && !KEEP.test(sen)));
  }
  const d215 = [];
  for (const m of t.matchAll(T215)) d215.push(true);
  return { d15, d215 };
}
function applyTok(t, dec) {
  let i = 0;
  t = t.replace(T15, (all, sp, unit) => (dec.d15[i++] ? `14${sp}${unit}` : all));
  // ranges with 215
  t = t.replace(/210(\s*(?:đến|–|-|~|to|至|到|에서|~)\s*)215/g, "207$1210");
  t = t.replace(/215(\s*(?:đến|–|-|~|to|至|到|~)\s*)220/g, "207$1210");
  t = t.replace(T215, "210");
  return t;
}
const count = (t, re) => (t.match(re) ?? []).length;
const arts = await p.article.findMany({ where: { published: true }, select: { id: true, slug: true, title: true, excerpt: true, content: true } });
const rows = [], report = [], mism = [], olds = [];
for (const a of arts) {
  if (["tu-moc-chau-son-la-sang-ta-xua"].includes(a.slug)) continue; // xử lý riêng
  const upd = {};
  for (const f of ["title", "excerpt", "content"]) {
    const v = (a[f] ?? "").replace(/\r\n/g, "\n").trim();
    if (!v) continue;
    const dec = decideVi(v);
    if (!dec.d15.some(Boolean) && !dec.d215.length) continue;
    const nv = applyTok(v, dec);
    if (nv === v) continue;
    // translations
    const tr = {};
    for (const l of ["en", "zh", "ko"]) {
      const r = await p.translation.findFirst({ where: { locale: l, sourceHash: sha(v), entity: { not: "DineMenu" } }, orderBy: { updatedAt: "desc" } });
      if (!r) { mism.push(`${a.slug}.${f}.${l}: KHÔNG có bản dịch`); continue; }
      const c15 = count(r.value, T15), c215 = count(r.value, T215);
      if (c15 !== dec.d15.length || c215 !== dec.d215.length) { mism.push(`${a.slug}.${f}.${l}: số token lệch vi15=${dec.d15.length}/${l}=${c15} vi215=${dec.d215.length}/${l}=${c215}`); continue; }
      tr[l] = applyTok(r.value, dec);
    }
    const diffs = [];
    for (const m of v.matchAll(T15)) {} // noop
    report.push(`## ${a.slug}.${f}: 15→14 x${dec.d15.filter(Boolean).length}, 215 x${dec.d215.length}`);
    for (const [i, m] of [...v.matchAll(T15)].entries()) report.push(`   ${dec.d15[i] ? "ĐỔI" : "giữ"}: …${sentenceAt(v, m.index).slice(0, 140)}`);
    for (const m of v.matchAll(T215)) report.push(`   215: …${sentenceAt(v, m.index).slice(0, 140)}`);
    upd[f] = nv;
    if (tr.en && tr.zh && tr.ko) rows.push([nv, tr.en, tr.zh, tr.ko]);
    olds.push({ slug: a.slug, f, old: v, nv });
  }
  if (APPLY && Object.keys(upd).length) await p.article.update({ where: { id: a.id }, data: upd });
}
fs.writeFileSync("scripts/tmp/seo-team/a3/fixnums-report.txt", report.join("\n") + "\n\nLỆCH:\n" + mism.join("\n"));
fs.writeFileSync("scripts/tmp/seo-team/a3/tr/fixnums-import.json", JSON.stringify(rows));
fs.writeFileSync("scripts/tmp/seo-team/a3/fixnums-olds.json", JSON.stringify(olds));
console.log("fields changed", olds.length, "rows ok", rows.length, "mismatch", mism.length, APPLY ? "APPLIED" : "dry-run");
await p.$disconnect();
