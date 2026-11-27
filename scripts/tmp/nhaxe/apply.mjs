import fs from "node:fs";
import { OPS, EXCERPT } from "./data.mjs";
const SRC = "src", OUT = "out";
fs.mkdirSync(OUT, { recursive: true });
const L = ["vi", "en", "zh", "ko"];
const rd = (p) => fs.readFileSync(p, "utf8");
const cnt = (s, x) => s.split(x).length - 1;
for (const [slug, ops] of Object.entries(OPS)) for (const lang of L) {
  const lines = rd(`${SRC}/${slug}.content.${lang}.md`).split("\n");
  const drop = new Set();
  for (const [k, n, v] of ops) {
    const i = n - 1;
    if (k === "set") lines[i] = v[lang];
    else if (k === "sub") {
      const [o, nw] = v[lang];
      if (cnt(lines[i], o) !== 1) throw new Error(`${slug} ${lang} ${n}: ${o}`);
      lines[i] = lines[i].replace(o, () => nw);
    } else if (k === "del") {
      if (lines[i + 1].trim() !== "") throw new Error(`${slug} ${lang} ${n}: next not blank`);
      drop.add(i); drop.add(i + 1);
    } else if (k === "del1") drop.add(i);
  }
  fs.writeFileSync(`${OUT}/${slug}.content.${lang}.md`, lines.filter((_, k) => !drop.has(k)).join("\n"));
}
for (const [slug, m] of Object.entries(EXCERPT)) for (const lang of L) {
  const t = rd(`${SRC}/${slug}.excerpt.${lang}.md`);
  const [o, nw] = m[lang];
  if (cnt(t, o) !== 1) throw new Error(`excerpt ${slug} ${lang}`);
  fs.writeFileSync(`${OUT}/${slug}.excerpt.${lang}.md`, t.replace(o, () => nw));
}
console.log("ok");
