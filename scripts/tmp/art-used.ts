import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
(async () => {
  const a = await prisma.article.findMany({ select: { slug: true, content: true, coverImage: true } });
  const ids = process.argv.slice(2);
  for (const id of ids) console.log(id, a.filter((x) => (x.content + (x.coverImage ?? "")).includes(id)).map((x) => x.slug).join(",") || "-");
  await prisma.$disconnect();
})();
