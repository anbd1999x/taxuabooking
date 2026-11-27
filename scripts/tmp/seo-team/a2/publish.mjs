import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
const p = new PrismaClient();
for (const slug of process.argv.slice(2)) {
  const content = fs.readFileSync(`scripts/tmp/seo-team/a2/${slug}.md`, "utf8").replace(/\r\n/g, "\n").trim();
  const m = JSON.parse(fs.readFileSync(`scripts/tmp/seo-team/a2/${slug}.meta.json`, "utf8"));
  const r = await p.article.update({ where: { slug }, data: { content, title: m.title, excerpt: m.excerpt, coverImage: m.coverImage, topic: m.topic, published: true } });
  console.log("updated", slug, r.published, content.length);
}
await p.$disconnect();
