// Liệt kê chuỗi nội dung Place (CHECKIN) mà trang /diem-den hiển thị và đang THIẾU bản dịch (en/zh/ko).
import { PrismaClient } from "@prisma/client";
import { createHash } from "node:crypto";
import fs from "node:fs";
import { priceLabel, realAddress, tidy } from "../../../../src/lib/attractions";
const p = new PrismaClient();
const sha = (s: string) => createHash("sha1").update(s).digest("hex");
const dicts = Object.fromEntries(["en", "zh", "ko"].map((l) => [l, JSON.parse(fs.readFileSync(`src/lib/i18n/dict/${l}.json`, "utf8"))]));
(async () => {
  const rows = await p.place.findMany({ where: { kind: "CHECKIN", published: true }, orderBy: { sortOrder: "asc" } });
  const src = new Map<string, string>(); // source -> slug.field
  for (const r of rows) {
    const add = (v: string | null | undefined, f: string) => { const s = (v ?? "").replace(/\r\n/g, "\n").trim(); if (s && /[a-zà-ỹ]/i.test(s)) src.set(s, `${r.slug}.${f}`); };
    add(r.name, "name"); add(r.desc, "desc"); add(r.tip, "tip"); add(r.content, "content"); add(r.area, "area");
    add(priceLabel(r.price), "price"); add(realAddress(r.address), "address");
  }
  const out: { src: string; at: string; miss: string[]; cur: Record<string, string> }[] = [];
  for (const [s, at] of src) {
    const tr = await p.translation.findMany({ where: { sourceHash: sha(s) }, select: { locale: true, value: true } });
    const cur: Record<string, string> = {};
    for (const t of tr) cur[t.locale] = t.value;
    for (const l of ["en", "zh", "ko"]) if (!cur[l] && dicts[l][s]) cur[l] = "(dict) " + dicts[l][s];
    const miss = ["en", "zh", "ko"].filter((l) => !cur[l]);
    out.push({ src: s, at, miss, cur });
  }
  fs.writeFileSync("scripts/tmp/seo-team/a1/need-tr.json", JSON.stringify(out, null, 1));
  for (const o of out) console.log(o.miss.length ? "MISS " + o.miss.join("") : "ok     ", o.at, "|", o.src.slice(0, 50).replace(/\n/g, " "), o.miss.length < 3 ? "| en=" + (o.cur.en ?? "").slice(0, 40) : "");
  await p.$disconnect();
})();
