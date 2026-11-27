// en: "Tà Xùa" → "Ta Xua" trong bản dịch tiêu đề + tóm tắt của mọi bài đang đăng (người nước ngoài gõ không dấu).
// Giữ tên riêng: Tà Xùa Booking / Hill / Retreat / Clouds / Farm.
import { PrismaClient } from "@prisma/client";
import { createHash } from "node:crypto";
const p = new PrismaClient();
const dry = process.argv.includes("--dry");
const sha = (s) => createHash("sha1").update(s.replace(/\r\n/g, "\n").trim()).digest("hex");
const RE = /Tà Xùa(?! (Booking|Hill|Retreat|Clouds|Farm))/g;
const arts = await p.article.findMany({ where: { published: true }, select: { title: true, excerpt: true } });
const hashes = arts.flatMap((a) => [a.title, a.excerpt].filter(Boolean).map(sha));
const rows = await p.translation.findMany({ where: { locale: "en", sourceHash: { in: hashes } }, select: { id: true, value: true } });
let n = 0;
for (const r of rows) {
  const v = r.value.replace(RE, "Ta Xua");
  if (v === r.value) continue;
  n++;
  if (dry) { if (n <= 8) console.log(v); continue; }
  await p.translation.update({ where: { id: r.id }, data: { value: v } });
}
console.log(dry ? "DRY" : "ĐÃ GHI", n, "/", rows.length);
await p.$disconnect();
