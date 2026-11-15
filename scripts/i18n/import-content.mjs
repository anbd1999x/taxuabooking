// Nạp bản dịch nội dung DB (dịch sẵn) vào bảng Translation dưới dạng "cụm từ" (entity Phrase).
//   node --env-file=<env> scripts/i18n/import-content.mjs <file.json>
// file.json: [["chuỗi gốc", "English", "中文", "한국어"], ...]. Không ghi đè bản dịch admin đã nhập cho cùng chuỗi.
import { PrismaClient } from "@prisma/client";
import { createHash } from "node:crypto";
import fs from "node:fs";

const prisma = new PrismaClient();
const rows = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const sha = (s) => createHash("sha1").update(s).digest("hex");
let created = 0;
let skipped = 0;
for (const [src, ...vals] of rows) {
  const source = src.replace(/\r\n/g, "\n").trim();
  const hash = sha(source);
  for (const [i, locale] of ["en", "zh", "ko"].entries()) {
    const value = (vals[i] ?? "").trim();
    if (!value) continue;
    const exists = await prisma.translation.findFirst({ where: { locale, sourceHash: hash }, select: { id: true } });
    if (exists) { skipped++; continue; }
    await prisma.translation.create({
      data: { entity: "Phrase", entityId: hash.slice(0, 20), field: "text", locale, source, sourceHash: hash, value },
    });
    created++;
  }
}
console.log(`đã nạp ${created} bản dịch, bỏ qua ${skipped} (đã có)`);
await prisma.$disconnect();
