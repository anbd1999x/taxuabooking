// node assemble.mjs <slug>... → tr/import-<slug>.json + kiểm cấu trúc
import fs from "node:fs";
const D = "scripts/tmp/seo-team/a2/tr";
const cnt = (s) => { const L = s.replace(/\r\n/g, "\n").trim().split("\n"); return { h: L.filter(l => /^#/.test(l)).length, tr: L.filter(l => /^\|/.test(l)).length, li: L.filter(l => /^(- |\d+\. )/.test(l)).length, img: (s.match(/!\[/g) || []).length, link: (s.match(/\]\(\//g) || []).length, para: s.trim().split(/\n\s*\n/).length, dash: (s.match(/—/g)||[]).length }; };
for (const slug of process.argv.slice(2)) {
  const src = JSON.parse(fs.readFileSync(`${D}/art-${slug}.json`, "utf8"));
  const mt = JSON.parse(fs.readFileSync(`${D}/${slug}.meta-tr.json`, "utf8"));
  const c = { vi: src.content };
  for (const l of ["en", "zh", "ko"]) c[l] = fs.readFileSync(`${D}/${slug}.${l}.md`, "utf8").replace(/^﻿/, "").replace(/\r\n/g, "\n").trim();
  const base = cnt(c.vi);
  console.log(slug, "vi", JSON.stringify(base));
  for (const l of ["en", "zh", "ko"]) { const x = cnt(c[l]); const bad = Object.keys(base).filter(k => k !== "dash" && x[k] !== base[k]); console.log("  ", l, bad.length ? "LỆCH " + bad.map(k => `${k} ${x[k]}≠${base[k]}`).join(", ") : "khớp", x.dash ? "CÓ —" : "", l==="zh" && /Tà Xùa(?! Booking)/.test(c[l].replace(/Tà Xùa (Booking|Retreat|Hill|Clouds|Farm)/g,"")) ? "zh còn 'Tà Xùa'" : "", l==="ko" && /Tà Xùa/.test(c[l].replace(/Tà Xùa (Booking|Retreat|Hill|Clouds|Farm)/g,"").replace(/Bản Mây Tà Xùa|Thác Mây Tà Xùa|Mây Bản Tà Xùa|Thơ Garden Tà Xùa/g,"")) ? "ko còn 'Tà Xùa'" : ""); }
  const rows = [[src.title, mt.title.en, mt.title.zh, mt.title.ko], [src.excerpt, mt.excerpt.en, mt.excerpt.zh, mt.excerpt.ko], [src.content, c.en, c.zh, c.ko]];
  fs.writeFileSync(`${D}/import-${slug}.json`, JSON.stringify(rows));
}
