import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
const p = new PrismaClient();
const D = "scripts/tmp/seo-team/a3";
const rows = [];
for (const slug of process.argv.slice(2)) {
  const a = await p.article.findUnique({ where: { slug } });
  const m = JSON.parse(fs.readFileSync(`${D}/tr/${slug}.meta.json`, "utf8"));
  const md = (l) => fs.readFileSync(`${D}/tr/${slug}.${l}.md`, "utf8").replace(/\r\n/g, "\n").trim();
  rows.push([a.title, m.en.title, m.zh.title, m.ko.title]);
  rows.push([a.excerpt, m.en.excerpt, m.zh.excerpt, m.ko.excerpt]);
  rows.push([a.content, md("en"), md("zh"), md("ko")]);
}
fs.writeFileSync(`${D}/tr/import.json`, JSON.stringify(rows));
console.log("rows", rows.length);
await p.$disconnect();
