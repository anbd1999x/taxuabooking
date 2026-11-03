import { renderMarkdown } from "../../src/lib/markdown";
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const slugs = ["ta-xua-o-dau-cach-ha-noi-bao-nhieu-km","o-ta-xua-nen-chon-khu-nao","trai-nghiem-xe-cabin-di-ta-xua","mua-hoa-ta-xua","ta-xua-mua-he-thang-5-8"];
for (const s of slugs) {
  const a = await p.article.findUnique({ where: { slug: s } });
  const html = renderMarkdown(a!.content);
  const h2 = (html.match(/<h2>/g)||[]).length, h3 = (html.match(/<h3>/g)||[]).length;
  const img = (html.match(/<img /g)||[]).length, link = (html.match(/<a href/g)||[]).length;
  const stray = html.match(/[*#]{1,}[^<\n]{0,20}/g)?.filter(x=>/^\s*[#*]{2,}/.test(x)) ?? [];
  console.log(`${s}: h2=${h2} h3=${h3} img=${img} link=${link} ul=${(html.match(/<ul>/g)||[]).length} stray=${stray.length ? JSON.stringify(stray.slice(0,3)) : "0"}`);
}
await p.$disconnect();
