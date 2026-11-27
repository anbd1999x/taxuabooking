// Ghép bản dịch (khoá slug.field) với chuỗi gốc NGUYÊN VĂN lấy từ DB (need-tr.json) → file cho import-content.mjs.
import fs from "node:fs";
const need = JSON.parse(fs.readFileSync("scripts/tmp/seo-team/a1/need-tr.json", "utf8"));
const bySlot = new Map(need.map((n) => [n.at, n]));
const tr = Object.assign({}, ...[1, 2, 3].map((i) => JSON.parse(fs.readFileSync(`scripts/tmp/seo-team/a1/place-tr-${i}.json`, "utf8"))));
const rows = [];
for (const [at, vals] of Object.entries(tr)) {
  const n = bySlot.get(at);
  if (!n) { console.log("KHÔNG CÓ NGUỒN:", at); continue; }
  rows.push([n.src, ...vals]);
}
const covered = new Set(Object.keys(tr));
for (const n of need) if (n.miss.length && !covered.has(n.at)) console.log("CHƯA DỊCH:", n.at, n.miss.join(","));
fs.writeFileSync("scripts/tmp/seo-team/a1/place-tr.import.json", JSON.stringify(rows, null, 1));
console.log("rows", rows.length);
