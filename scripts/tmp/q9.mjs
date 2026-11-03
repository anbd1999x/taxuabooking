import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
for (const slug of ["trekking-dinh-ta-xua","kinh-nghiem-san-may-ta-xua","sai-lam-lan-dau-di-ta-xua"]) {
  const a = await p.article.findUnique({ where: { slug } });
  console.log("\n====", slug, "====\n", a.content.slice(0, 2200));
}
await p.$disconnect();
