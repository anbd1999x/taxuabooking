import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
for (const slug of ["duong-di-ta-xua-tu-ha-noi","gia-ve-xe-cabin-ha-noi-ta-xua","thoi-tiet-ta-xua-theo-thang","ta-xua-mua-nao-dep-nhat","homestay-ta-xua-view-may-dep"]) {
  const a = await p.article.findUnique({ where: { slug } });
  console.log("\n========", slug, "|", a.title, "========");
  console.log(a.content);
}
await p.$disconnect();
