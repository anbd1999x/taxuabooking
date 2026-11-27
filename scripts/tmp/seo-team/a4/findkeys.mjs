import fs from "node:fs";
const d = JSON.parse(fs.readFileSync("src/lib/i18n/dict/en.json", "utf8"));
const targets = fs.readFileSync(0, "utf8").split("\n").map((s) => s.trim()).filter(Boolean);
const inv = new Map(); for (const [k, v] of Object.entries(d)) (inv.get(v) ?? inv.set(v, []).get(v)).push(k);
for (const t of targets) {
  const parts = [t, ...t.split(" · ")];
  let found = false;
  for (const p of parts) { const ks = inv.get(p); if (ks) { found = true; for (const k of ks) console.log(JSON.stringify(k), "=>", JSON.stringify(p)); } }
  if (!found) {
    // thử khớp mẫu có {0}
    for (const [k, v] of Object.entries(d)) if (/\{\d\}/.test(v) && /Tà Xùa/.test(v)) { const segs = v.split(/{d}/); const m = (p) => p.startsWith(segs[0]) && p.endsWith(segs[segs.length-1]) && segs.every((x) => p.includes(x)); if (parts.some(m)) { found = true; console.log(JSON.stringify(k), "=>", JSON.stringify(v), "(mẫu)"); } }
  }
  if (!found) console.log("??", t);
}
