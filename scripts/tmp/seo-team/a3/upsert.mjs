import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
const p = new PrismaClient();
const D = "scripts/tmp/seo-team/a3";
for (const slug of process.argv.slice(2)) {
  const content = fs.readFileSync(`${D}/${slug}.md`, "utf8").replace(/\r\n/g, "\n").trim();
  const m = JSON.parse(fs.readFileSync(`${D}/${slug}.meta.json`, "utf8"));
  const ex = await p.article.findUnique({ where: { slug } });
  if (ex && ex.published) { console.log("SKIP (đã đăng, không ghi đè)", slug); continue; }
  const data = { title: m.title.trim(), excerpt: m.excerpt.trim(), content, coverImage: m.coverImage, topic: m.topic, published: false };
  const r = ex ? await p.article.update({ where: { slug }, data }) : await p.article.create({ data: { slug, ...data } });
  console.log(ex ? "updated" : "created", slug, r.id, r.published);
}
await p.$disconnect();
