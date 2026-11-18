// Điền mô tả (desc) + nội dung chi tiết (content) cho quán cà phê / nhà hàng còn trống, kèm bản dịch en/zh/ko.
//   node --env-file=.env scripts/tmp/places/publish.mjs [--dry]
// Chỉ ghi vào ô đang TRỐNG, không ghi đè nội dung admin đã nhập.
import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

const DIR = "scripts/tmp/places";
const dry = process.argv.includes("--dry");
const L = ["vi", "en", "zh", "ko"];
const data = Object.fromEntries(L.map((l) => [l, JSON.parse(fs.readFileSync(`${DIR}/${l}.json`, "utf8"))]));
const refs = (t) => [...(t ?? "").matchAll(/\]\((\/[^)]+)\)/g)].map((m) => m[1]).sort().join(" ");
const norm = (s) => s.replace(/\r\n?/g, "\n").trim();
const sha = (s) => createHash("sha1").update(s).digest("hex");

let bad = 0;
for (const slug of Object.keys(data.vi)) {
  const [d, c] = data.vi[slug];
  for (const l of L.slice(1)) {
    const t = data[l][slug];
    if (!t) { bad++; console.log(`✗ ${l} thiếu ${slug}`); continue; }
    if ((d === null) !== (t[0] === null)) { bad++; console.log(`✗ ${l}/${slug}: desc null lệch`); }
    if (refs(t[1]) !== refs(c)) { bad++; console.log(`✗ ${l}/${slug}: link lệch`); }
  }
}
if (bad) process.exit(1);

const prisma = new PrismaClient();
const places = await prisma.place.findMany({ where: { slug: { in: Object.keys(data.vi) } } });
const enDone = new Set((await prisma.translation.findMany({ where: { locale: "en" }, select: { sourceHash: true } })).map((r) => r.sourceHash));
const rows = [];
let nDesc = 0, nContent = 0;
for (const p of places) {
  const [d, c] = data.vi[p.slug];
  const tr = L.slice(1).map((l) => data[l][p.slug]);
  const upd = {};
  if (!p.desc?.trim() && d) { upd.desc = d; nDesc++; rows.push([d, ...tr.map((t) => t[0])]); }
  else if (p.desc?.trim() && !enDone.has(sha(norm(p.desc)))) console.log(`! mô tả ngắn cũ chưa dịch: ${p.slug}: ${p.desc}`);
  if (!p.content?.trim()) { upd.content = c; nContent++; rows.push([c, ...tr.map((t) => t[1])]); }
  if (Object.keys(upd).length && !dry) await prisma.place.update({ where: { id: p.id }, data: upd });
}
await prisma.$disconnect();
fs.writeFileSync(`${DIR}/translations.json`, JSON.stringify(rows, null, 1));
console.log(`${dry ? "[dry] " : ""}${places.length} quán · điền desc ${nDesc} · content ${nContent} · ${rows.length} chuỗi dịch`);
if (!dry) execFileSync("node", ["--env-file=.env", "scripts/i18n/import-content.mjs", `${DIR}/translations.json`], { stdio: "inherit" });
