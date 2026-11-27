// en: "Ta Xua" không dấu cho các khoá của trang /diem-den, /thoi-tiet-ta-xua (giữ "Tà Xùa Booking") + tên điểm.
import fs from "node:fs";
const f = "src/lib/i18n/dict/en.json";
const raw = fs.readFileSync(f, "utf8"); // đọc lại ngay trước khi ghi
const d = JSON.parse(raw);
const mine = JSON.parse(fs.readFileSync("scripts/tmp/seo-team/a1/tr.json", "utf8")).map((r) => r[0]);
const fixed = { "Mỏm cá heo": "Dolphin Rock", "Thảo nguyên Tà Xùa": "Ta Xua Grasslands", "{0} Tà Xùa": "{0} Ta Xua" };
let n = 0;
for (const k of mine) {
  if (!(k in d)) continue;
  const v = d[k].replace(/Tà Xùa(?! Booking)/g, "Ta Xua");
  if (v !== d[k]) { d[k] = v; n++; }
}
for (const [k, v] of Object.entries(fixed)) { console.log(`${k}: ${JSON.stringify(d[k])} → ${JSON.stringify(v)}`); d[k] = v; }
fs.writeFileSync(f, JSON.stringify(d, null, 1) + (raw.endsWith("\n") ? "\n" : ""));
console.log("đổi Tà Xùa → Ta Xua ở", n, "khoá của tôi");
