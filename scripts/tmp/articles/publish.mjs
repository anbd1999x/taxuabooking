// Đăng bài + gom bản dịch: node --env-file=.env scripts/tmp/articles/publish.mjs <thư mục> <slug>
import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
const [D, slug] = process.argv.slice(2);
const p = new PrismaClient();
const lines = (s) => s.replace(/\r\n/g, "\n").trim().split("\n");
const vi = fs.readFileSync(`${D}/${slug}.md`, "utf8").replace(/\r\n/g, "\n").trim();
const m = JSON.parse(fs.readFileSync(`${D}/${slug}.meta.json`, "utf8"));
const tr = ["en", "zh", "ko"].map((l) => fs.readFileSync(`${D}/${slug}.${l}.md`, "utf8").replace(/\r\n/g, "\n").trim());
for (const [i, t] of tr.entries()) if (lines(t).length !== lines(vi).length) throw new Error(`${["en", "zh", "ko"][i]}: ${lines(t).length} dòng ≠ vi ${lines(vi).length}`);
const tj = JSON.parse(fs.readFileSync(`${D}/${slug}.tr.json`, "utf8"));
if (tj[0][0] !== m.title || tj[1][0] !== m.excerpt) throw new Error("tr.json lệch meta");
await p.article.upsert({
  where: { slug },
  create: { slug, title: m.title, excerpt: m.excerpt, content: vi, coverImage: m.coverImage, topic: m.topic, published: true },
  update: { title: m.title, excerpt: m.excerpt, content: vi, coverImage: m.coverImage, topic: m.topic },
});
fs.writeFileSync(`${D}/import.json`, JSON.stringify([[vi, ...tr], ...tj]));
console.log("đã đăng", slug, "→", `${D}/import.json`);
await p.$disconnect();
