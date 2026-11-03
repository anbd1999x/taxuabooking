import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
for (const slug of ["48-gio-o-ta-xua-nhat-ky","gia-homestay-ta-xua-ngay-thuong-cuoi-tuan-le"]) {
  const a = await p.article.findUnique({ where: { slug } });
  console.log("=====", slug, "=====");
  console.log("TITLE:", a.title);
  console.log("EXCERPT:", a.excerpt);
  console.log(a.content);
}
await p.$disconnect();
