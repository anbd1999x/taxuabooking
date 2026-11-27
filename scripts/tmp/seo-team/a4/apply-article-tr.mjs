// Ghi đè bản dịch tiêu đề / tóm tắt bài (bảng Translation) theo chuỗi gốc copy NGUYÊN VĂN từ DB.
// import-content.mjs không ghi đè bản đã có ⇒ script này updateMany mọi dòng cùng (locale, sourceHash), thiếu thì tạo Phrase.
import { PrismaClient } from "@prisma/client";
import { createHash } from "node:crypto";
import fs from "node:fs";
const p = new PrismaClient();
const dry = process.argv.includes("--dry");
const rows = JSON.parse(fs.readFileSync("scripts/tmp/seo-team/a4/article-tr.json", "utf8"));
const sha = (s) => createHash("sha1").update(s).digest("hex");
const len = (s) => [...s].length;
const before = [];
for (const [slug, field, ...vals] of rows) {
  const a = await p.article.findUnique({ where: { slug }, select: { title: true, excerpt: true, published: true } });
  if (!a?.published) { console.log("SKIP (không có / chưa đăng)", slug); continue; }
  const source = (a[field] ?? "").replace(/\r\n/g, "\n").trim();
  const hash = sha(source);
  for (const [i, locale] of ["en", "zh", "ko"].entries()) {
    const value = (vals[i] ?? "").trim();
    if (!value) continue;
    const max = field === "title" ? 60 : 155;
    if (locale === "en" && len(value) > max) console.log(`  !! QUÁ DÀI ${len(value)}>${max}`, slug, field, value);
    if (/—/.test(value)) console.log("  !! có —", slug);
    const old = await p.translation.findFirst({ where: { locale, sourceHash: hash }, orderBy: { updatedAt: "desc" }, select: { value: true } });
    before.push({ slug, field, locale, old: old?.value ?? null, value });
    if (dry) { console.log(`${slug} ${field} ${locale} (${len(value)}): ${value}`); continue; }
    const r = await p.translation.updateMany({ where: { locale, sourceHash: hash }, data: { value } });
    if (!r.count) await p.translation.create({ data: { entity: "Phrase", entityId: hash.slice(0, 20), field: "text", locale, source, sourceHash: hash, value } });
  }
}
fs.writeFileSync("scripts/tmp/seo-team/a4/article-tr-before.json", JSON.stringify(before, null, 1));
console.log(dry ? "DRY" : "ĐÃ GHI", before.length);
await p.$disconnect();
