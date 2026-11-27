import fs from "node:fs";
const files = ["src/app/(site)/diem-den/[slug]/page.tsx", "src/app/(site)/diem-den/page.tsx", "src/app/(site)/thoi-tiet-ta-xua/page.tsx", "src/lib/attraction-meta.ts", "src/app/(site)/ban-do/page.tsx", "src/components/Header.tsx", "src/components/Footer.tsx"];
const keys = new Set();
const STR = /\b(?:t|tr)\(\s*"((?:[^"\\]|\\.)*)"/g;
for (const f of files) {
  const s = fs.readFileSync(f, "utf8");
  for (const m of s.matchAll(STR)) keys.add(JSON.parse(`"${m[1]}"`));
}
const extra = ["Khá cao", "Trung bình", "Thấp", "Rất thấp",
  "Điều kiện dự báo khá thuận cho biển mây sáng sớm. Nếu đi, nên có mặt ở điểm ngắm trước 6h.",
  "Có thể có mây mỏng ở thung lũng, chưa chắc chắn. Nên xem lại dự báo tối hôm trước.",
  "Ít khả năng có biển mây. Trời thường nhìn rõ núi, hợp đi check-in.",
  "Rất ít khả năng có biển mây theo dự báo hiện tại.", "Miễn phí"];
extra.forEach((k) => keys.add(k));
const sb = fs.readFileSync("src/components/SeoBlock.tsx", "utf8");
const blk = sb.slice(sb.indexOf("DIEM_DEN: {"), sb.indexOf("export async function SeoBlock"));
for (const m of blk.matchAll(/"((?:[^"\\]|\\.)*)"/g)) { const k = JSON.parse(`"${m[1]}"`); if (/[À-ỹ]/.test(k)) keys.add(k); }
const mode = process.argv[2];
const out = {};
for (const l of ["en", "zh", "ko"]) {
  const d = JSON.parse(fs.readFileSync(`src/lib/i18n/dict/${l}.json`, "utf8"));
  out[l] = [...keys].filter((k) => !(k in d) && /[A-Za-zÀ-ỹ]/.test(k));
}
if (mode === "--json") console.log(JSON.stringify(out.en, null, 1));
console.log("missing en", out.en.length, "zh", out.zh.length, "ko", out.ko.length);
