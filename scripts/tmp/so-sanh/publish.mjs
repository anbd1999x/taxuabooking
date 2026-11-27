// Đăng bài so sánh + gom bản dịch: node --env-file=.env scripts/tmp/so-sanh/publish.mjs <slug>...
import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
const D = "scripts/tmp/so-sanh";
const p = new PrismaClient();
const rows = [];
const lines = (s) => s.replace(/\r\n/g, "\n").trim().split("\n");
for (const slug of process.argv.slice(2)) {
  const vi = fs.readFileSync(`${D}/${slug}.md`, "utf8").replace(/\r\n/g, "\n").trim();
  const m = JSON.parse(fs.readFileSync(`${D}/${slug}.meta.json`, "utf8"));
  const tr = ["en", "zh", "ko"].map((l) => fs.readFileSync(`${D}/${slug}.${l}.md`, "utf8").replace(/\r\n/g, "\n").trim());
  for (const [i, t] of tr.entries()) if (lines(t).length !== lines(vi).length) throw new Error(`${slug} ${["en","zh","ko"][i]}: ${lines(t).length} dòng ≠ vi ${lines(vi).length}`);
  const tj = JSON.parse(fs.readFileSync(`${D}/${slug}.tr.json`, "utf8"));
  if (tj[0][0] !== m.title || tj[1][0] !== m.excerpt) throw new Error(`${slug}: tr.json lệch meta`);
  await p.article.upsert({ where: { slug }, create: { slug, title: m.title, excerpt: m.excerpt, content: vi, coverImage: m.coverImage, topic: m.topic, published: true }, update: { title: m.title, excerpt: m.excerpt, content: vi, coverImage: m.coverImage, topic: m.topic } });
  rows.push([vi, ...tr], ...tj);
  console.log("đã đăng", slug);
}
fs.writeFileSync(`${D}/import.json`, JSON.stringify(rows));
await p.$disconnect();
