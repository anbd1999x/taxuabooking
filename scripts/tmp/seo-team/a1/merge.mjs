// Thêm khoá còn thiếu vào dict en/zh/ko (không ghi đè khoá đã có). Đọc lại file ngay trước khi ghi.
import fs from "node:fs";
const rows = JSON.parse(fs.readFileSync("scripts/tmp/seo-team/a1/" + (process.argv[2] || "tr.json") + "", "utf8"));
const dry = process.argv.includes("--dry");
["en", "zh", "ko"].forEach((l, i) => {
  const f = `src/lib/i18n/dict/${l}.json`;
  const raw = fs.readFileSync(f, "utf8");
  const d = JSON.parse(raw);
  const indent = raw.startsWith("{\n  ") ? 2 : raw.startsWith("{\n\t") ? "\t" : 1;
  const same = JSON.stringify(d, null, indent) + (raw.endsWith("\n") ? "\n" : "") === raw;
  let added = 0;
  for (const r of rows) if (!(r[0] in d)) { d[r[0]] = r[i + 1]; added++; }
  console.log(l, "added", added, "roundtrip", same, "indent", JSON.stringify(indent));
  if (!dry && same && added) fs.writeFileSync(f, JSON.stringify(d, null, indent) + (raw.endsWith("\n") ? "\n" : ""));
});
