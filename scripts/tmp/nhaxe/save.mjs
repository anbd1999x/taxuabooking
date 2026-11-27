// Ghi nội dung đã sửa vào Article + xuất file bản dịch cho import-content.mjs
import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
const p = new PrismaClient();
const OUT = "scripts/tmp/nhaxe/out";
const files = fs.readdirSync(OUT).filter((f) => f.endsWith(".vi.md"));
const rows = [];
for (const f of files) {
  const [slug, field] = f.replace(".vi.md", "").split(".");
  const vi = fs.readFileSync(`${OUT}/${f}`, "utf8");
  const tr = ["en", "zh", "ko"].map((l) => fs.readFileSync(`${OUT}/${slug}.${field}.${l}.md`, "utf8"));
  const cur = await p.article.findUnique({ where: { slug }, select: { [field]: true } });
  const orig = fs.readFileSync(`scripts/tmp/nhaxe/src/${slug}.${field}.vi.md`, "utf8");
  if (cur[field] !== orig) throw new Error(`${slug}.${field} đã bị sửa nơi khác sau khi dump`);
  await p.article.update({ where: { slug }, data: { [field]: vi } });
  rows.push([vi, ...tr]);
  console.log("cập nhật", slug, field);
}
fs.writeFileSync("scripts/tmp/nhaxe/import.json", JSON.stringify(rows));
await p.$disconnect();
