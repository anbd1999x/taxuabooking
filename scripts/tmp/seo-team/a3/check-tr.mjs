// node scripts/tmp/seo-team/a3/check-tr.mjs <slug>  — so cấu trúc bản dịch tr/<slug>.{en,zh,ko}.md với <slug>.md
import fs from "node:fs";
const D = "scripts/tmp/seo-team/a3";
const slug = process.argv[2];
const vi = fs.readFileSync(`${D}/${slug}.md`, "utf8").replace(/\r\n/g, "\n").trim();
const feat = (c) => ({
  h2: (c.match(/^## /gm) ?? []).length,
  h3: (c.match(/^### /gm) ?? []).length,
  rows: (c.match(/^\|/gm) ?? []).length,
  bullets: (c.match(/^(- |\d+\. )/gm) ?? []).length,
  links: [...c.matchAll(/(?<!!)\[[^\]]*\]\(([^)]+)\)/g)].map((m) => m[1]).join(" "),
  imgs: [...c.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)].map((m) => m[1]).join(" "),
  money: [...c.matchAll(/\d{1,3}(?:\.\d{3})+đ/g)].map((m) => m[0]).sort().join(" "),
  paras: c.split(/\n\s*\n/).length,
});
const fv = feat(vi);
let bad = 0;
const meta = fs.existsSync(`${D}/tr/${slug}.meta.json`) ? JSON.parse(fs.readFileSync(`${D}/tr/${slug}.meta.json`, "utf8")) : null;
if (!meta) { console.log("✗ thiếu tr/" + slug + ".meta.json"); bad++; }
for (const l of ["en", "zh", "ko"]) {
  const p = `${D}/tr/${slug}.${l}.md`;
  if (!fs.existsSync(p)) { console.log(`✗ ${l}: thiếu file`); bad++; continue; }
  const c = fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n").trim();
  const f = feat(c);
  const errs = [];
  for (const k of Object.keys(fv)) if (String(fv[k]) !== String(f[k])) errs.push(`${k}: vi=${String(fv[k]).slice(0, 300)} | ${l}=${String(f[k]).slice(0, 300)}`);
  if (/—/.test(c)) errs.push("có dấu —");
  if (l === "zh") { const left = (c.match(/Tà Xùa(?! (Booking|Hill|Retreat|Clouds|Farm))/g) ?? []).length; if (left > 3) errs.push(`zh còn ${left} chữ "Tà Xùa" (nên là 塔萨 trừ tên riêng)`); if (!c.includes("塔萨")) errs.push("zh thiếu 塔萨"); }
  if (l === "ko" && !c.includes("따쑤아")) errs.push("ko thiếu 따쑤아");
  if (!c.includes("27/11/2026")) errs.push("thiếu ngày 27/11/2026 ở dòng nguồn");
  if (meta && (!meta[l]?.title || !meta[l]?.excerpt)) errs.push("meta thiếu title/excerpt");
  if (/[À-ỹ]{2,}/.test(c.replace(/\[[^\]]*\]\([^)]*\)/g, "").replace(/\*\*[^*]+\*\*/g, "")) && l !== "en") { /* tên riêng tiếng Việt được phép */ }
  console.log(`${errs.length ? "✗" : "✓"} ${l}: h2 ${f.h2}, h3 ${f.h3}, dòng bảng ${f.rows}, gạch đầu dòng ${f.bullets}, đoạn ${f.paras}`);
  for (const e of errs) console.log("   - " + e);
  bad += errs.length;
}
process.exit(bad ? 1 : 0);
