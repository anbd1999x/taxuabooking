// Ghép bản dịch (out/<slug>.meta.json + .en/.zh/.ko.md) thành file nạp [[gốc, en, zh, ko]] + kiểm cấu trúc.
import fs from "node:fs";
const dir = process.argv[2];
const slugs = ["dat-phong-ta-xua-o-dau", "nha-xe-nao-di-ta-xua", "homestay-ta-xua-view-may-dep", "thue-xe-may-ta-xua", "du-lich-ta-xua-nen-dat-dich-vu-o-dau"];
const urls = (s) => [...s.matchAll(/\]\(([^)\s]+)\)/g)].map((m) => m[1]).sort().join("\n");
const cnt = (s, re) => (s.match(re) ?? []).length;
const prices = (s) => [...s.matchAll(/\d{1,3}(?:\.\d{3})+đ/g)].map((m) => m[0]).sort().join(",");
const rows = [];
let bad = 0;
for (const slug of slugs) {
  const src = JSON.parse(fs.readFileSync(`${dir}/art-${slug}.json`, "utf8"));
  const meta = JSON.parse(fs.readFileSync(`${dir}/out/${slug}.meta.json`, "utf8"));
  const c = {};
  for (const l of ["en", "zh", "ko"]) {
    c[l] = fs.readFileSync(`${dir}/out/${slug}.${l}.md`, "utf8").replace(/^﻿/, "").replace(/\r\n/g, "\n").trim();
    const checks = {
      urls: urls(c[l]) === urls(src.content),
      h2: cnt(c[l], /^## /gm) === cnt(src.content, /^## /gm),
      h3: cnt(c[l], /^### /gm) === cnt(src.content, /^### /gm),
      tableRows: cnt(c[l], /^\|.*\|$/gm) === cnt(src.content, /^\|.*\|$/gm),
      pipes: cnt(c[l], /\|/g) === cnt(src.content, /\|/g),
      imgs: cnt(c[l], /^!\[/gm) === cnt(src.content, /^!\[/gm),
      bullets: cnt(c[l], /^- /gm) === cnt(src.content, /^- /gm),
      prices: prices(c[l]) === prices(src.content),
      faqHead: l !== "x",
      noViLeft: !/[ăơưđ]\w* (là|của|và|không|được) /i.test(c[l]),
    };
    const fail = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);
    console.log(`${slug}.${l}: ${c[l].length} ký tự (gốc ${src.content.length})`, fail.length ? "✗ " + fail.join(",") : "✓");
    if (fail.length) bad++;
    for (const f of ["title", "excerpt"]) if (!meta[f]?.[l]?.trim()) { console.log(`  thiếu ${f}.${l}`); bad++; }
  }
  rows.push([src.title, meta.title.en, meta.title.zh, meta.title.ko], [src.excerpt, meta.excerpt.en, meta.excerpt.zh, meta.excerpt.ko], [src.content, c.en, c.zh, c.ko]);
}
fs.writeFileSync(`${dir}/import.json`, JSON.stringify(rows));
console.log(bad ? `\n${bad} lỗi — CHƯA nên nạp` : "\nOK → import.json");
