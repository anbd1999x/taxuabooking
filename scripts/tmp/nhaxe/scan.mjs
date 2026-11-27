import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const rows = await p.article.findMany({ select: { slug: true, title: true, content: true, excerpt: true } });
const re = /(chưa rõ|không rõ|còn ít|cần xác nhận|chưa công bố|không công bố|chưa thấy công bố|Hồng Ngọc|chưa có thông tin|không có thông tin)/i;
for (const r of rows) {
  const lines = (r.excerpt ? [r.excerpt] : []).concat(r.content.split("\n")).filter(l => re.test(l));
  if (r.slug.includes("nha-xe") || lines.length) { console.log("=== " + r.slug + " | " + r.title); for (const l of lines) console.log("  - " + l.slice(0, 400)); }
}
await p.$disconnect();
