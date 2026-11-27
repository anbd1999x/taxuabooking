import fs from "node:fs";
const add = JSON.parse(fs.readFileSync("scripts/tmp/seo-team/a4/dict-add.json", "utf8"));
const ov = JSON.parse(fs.readFileSync("scripts/tmp/seo-team/a4/dict-en-override.json", "utf8"));
const check = process.argv.includes("--check");
const len = (s) => [...s].length;
for (const [i, l] of ["en", "zh", "ko"].entries()) {
  const p = `src/lib/i18n/dict/${l}.json`;
  const f = fs.readFileSync(p, "utf8");
  const o = JSON.parse(f);
  let added = 0, changed = 0;
  for (const [k, vals] of Object.entries(add)) {
    if (!vals[i]) continue;
    if (!(k in o)) { o[k] = vals[i]; added++; } else if (o[k] !== vals[i]) { o[k] = vals[i]; changed++; }
  }
  if (l === "en") for (const [k, v] of Object.entries(ov)) { if (!(k in o)) console.log("  MISSING key for override:", k.slice(0, 50)); if (o[k] !== v) { o[k] = v; changed++; } }
  for (const k of [...Object.keys(add), ...(l === "en" ? Object.keys(ov) : [])]) {
    const v = o[k]; if (/(title|^.{0,70}$)/.test("")) {}
    if (/—/.test(v)) console.log("  DASH", l, v);
  }
  console.log(l, "added", added, "changed", changed);
  if (!check) fs.writeFileSync(p, JSON.stringify(o, null, 1) + "\n");
}
// độ dài
for (const [k, v] of Object.entries(ov)) console.log(len(v), v.slice(0, 70));
for (const [k, vals] of Object.entries(add)) if (len(k) < 70 || len(vals[0]) > 140) console.log(len(k), "|", vals.map(len).join("/"), "|", vals[0].slice(0, 60));
