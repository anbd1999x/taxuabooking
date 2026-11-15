// Chuyển bản dịch nội dung dài sang rows JSON cho import-content.mjs.
//   node scripts/i18n/long2json.mjs <nguồn.json> <rows.json> <a.txt> [b.txt…]
// Định dạng file: các khối bắt đầu bằng dòng "@@ <chỉ số> <en|zh|ko>", nội dung là các dòng sau đó.
import fs from "node:fs";

const [srcFile, rowsFile, ...files] = process.argv.slice(2);
const src = JSON.parse(fs.readFileSync(srcFile, "utf8"));
const rows = fs.existsSync(rowsFile) ? JSON.parse(fs.readFileSync(rowsFile, "utf8")) : [];
const acc = {};
for (const f of files) {
  const parts = fs.readFileSync(f, "utf8").replace(/\r\n/g, "\n").split(/^@@ (\d+) (en|zh|ko)\n/m);
  for (let i = 1; i < parts.length; i += 3) (acc[parts[i]] ??= {})[parts[i + 1]] = parts[i + 2].trim();
}
let n = 0;
for (const [idx, v] of Object.entries(acc)) {
  if (!src[+idx]) { console.log(`!! chỉ số ${idx} không có`); continue; }
  const miss = ["en", "zh", "ko"].filter((l) => !v[l]);
  if (miss.length) console.log(`!! #${idx} thiếu ${miss.join(",")}`);
  rows.push([src[+idx], v.en ?? "", v.zh ?? "", v.ko ?? ""]);
  n++;
}
fs.writeFileSync(rowsFile, JSON.stringify(rows));
console.log(`${n} khối → ${rowsFile}`);
