import { PrismaClient } from "@prisma/client";
import { stripCoverImage } from "../../../src/lib/markdown";
async function main() {
const p = new PrismaClient();
const arts = await p.article.findMany({ where: { published: true }, select: { slug: true, coverImage: true, content: true } });
let bad = 0, fixed = 0;
for (const a of arts) {
  const before = [...a.content.matchAll(/!\[[^\]]*\]\(([^)\s]+)/g)].map((m) => m[1]);
  const after = [...stripCoverImage(a.content, a.coverImage).matchAll(/!\[[^\]]*\]\(([^)\s]+)/g)].map((m) => m[1]);
  if (before.includes(a.coverImage!)) fixed++;
  if (after.includes(a.coverImage!)) { bad++; console.log("còn trùng", a.slug); }
  if (after.length < 2) console.log("ít ảnh sau khi lọc:", a.slug, after.length);
}
console.log({ tongBai: arts.length, baiDuocLoc: fixed, conTrung: bad });
await p.$disconnect();
}
main();
