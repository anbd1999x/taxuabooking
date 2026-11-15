// Liệt kê bài viết (kinh nghiệm) CHƯA đủ bản dịch en/zh/ko cho tiêu đề / tóm tắt / nội dung.
//   node --env-file=.env scripts/i18n/check-articles.mjs            → in danh sách thiếu
//   node --env-file=.env scripts/i18n/check-articles.mjs --dump DIR  → ghi thêm DIR/art-<slug>.json (title, excerpt, content gốc)
// Web tra bản dịch theo sha1(chuỗi gốc đã trim) — nạp bằng scripts/i18n/import-content.mjs ([[gốc, en, zh, ko], …]).
import { PrismaClient } from "@prisma/client";
import { createHash } from "node:crypto";
import fs from "node:fs";

const prisma = new PrismaClient();
const sha = (s) => createHash("sha1").update(s.replace(/\r\n/g, "\n").trim()).digest("hex");
const dumpIdx = process.argv.indexOf("--dump");
const dumpDir = dumpIdx > 0 ? process.argv[dumpIdx + 1] : null;
if (dumpDir) fs.mkdirSync(dumpDir, { recursive: true });

const arts = await prisma.article.findMany({ orderBy: { createdAt: "desc" }, select: { slug: true, title: true, excerpt: true, content: true, published: true } });
let missing = 0;
for (const a of arts) {
  const miss = [];
  for (const f of ["title", "excerpt", "content"]) {
    const v = a[f];
    if (!v || !v.trim()) continue;
    const have = new Set((await prisma.translation.findMany({ where: { sourceHash: sha(v) }, select: { locale: true } })).map((t) => t.locale));
    for (const l of ["en", "zh", "ko"]) if (!have.has(l)) miss.push(`${f}.${l}`);
  }
  if (!miss.length) continue;
  missing++;
  console.log(`${a.published ? "" : "(ẩn) "}${a.slug} — thiếu ${miss.join(", ")}`);
  if (dumpDir) fs.writeFileSync(`${dumpDir}/art-${a.slug}.json`, JSON.stringify({ title: a.title, excerpt: a.excerpt, content: a.content }, null, 1));
}
console.log(missing ? `\n${missing}/${arts.length} bài chưa đủ bản dịch.` : `Tất cả ${arts.length} bài đã đủ bản dịch en/zh/ko.`);
await prisma.$disconnect();
