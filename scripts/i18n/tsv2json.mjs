// Chuyển bản dịch dạng TSV sang JSON cho import-content.mjs.
//   node scripts/i18n/tsv2json.mjs <nguồn.json> <out.json> <a.tsv> [b.tsv…]
// Mỗi dòng: "<khoá>\t<English>\t<中文>\t<한국어>". Khoá "#12" = phần tử thứ 12 của nguồn.json;
// khoá "=chuỗi" = chuỗi gốc viết thẳng (dùng cho mẫu có {0}). "\n" trong ô = xuống dòng. Dòng trống/# chú thích bỏ qua.
import fs from "node:fs";

const [srcFile, outFile, ...tsvs] = process.argv.slice(2);
const src = JSON.parse(fs.readFileSync(srcFile, "utf8"));
const rows = fs.existsSync(outFile) ? JSON.parse(fs.readFileSync(outFile, "utf8")) : [];
const ph = (s) => (s.match(/\{\d+\}/g) ?? []).sort().join(",");
let bad = 0;
for (const f of tsvs) {
  for (const line of fs.readFileSync(f, "utf8").replace(/\r\n/g, "\n").split("\n")) {
    if (!line.trim() || line.startsWith("//")) continue;
    const cols = line.split("\t");
    if (cols.length !== 4) { console.log(`!! ${f}: cần 4 cột: ${line.slice(0, 80)}`); bad++; continue; }
    const [k, ...v] = cols.map((c) => c.replace(/\\n/g, "\n").trim());
    const source = k.startsWith("#") ? src[+k.slice(1)] : k.startsWith("=") ? k.slice(1) : null;
    if (!source) { console.log(`!! ${f}: khoá lạ ${k}`); bad++; continue; }
    if (v.some((x) => ph(x) !== ph(source))) { console.log(`!! ${f}: ${k} lệch {n}`); bad++; }
    rows.push([source, ...v]);
  }
}
fs.writeFileSync(outFile, JSON.stringify(rows));
console.log(`${rows.length} dòng → ${outFile}${bad ? `, ${bad} lỗi` : ""}`);
