import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  for (const slug of ["ta-xua-o-dau-cach-ha-noi-bao-nhieu-km", "chi-phi-du-lich-ta-xua-tu-tuc", "gia-ve-xe-cabin-ha-noi-ta-xua", "ta-xua-mua-nao-dep-nhat", "thue-xe-may-ta-xua", "xe-om-taxi-ta-xua"]) {
    const a = await prisma.article.findUnique({ where: { slug }, select: { content: true, coverImage: true } });
    console.log("=====", slug, a?.coverImage, "\n" + (a?.content ?? "").slice(0, 2300));
  }
  const imgs = await prisma.article.findMany({ select: { coverImage: true }, where: { published: true } });
  console.log("COVERS", [...new Set(imgs.map((i) => i.coverImage))].slice(0, 30).join(" "));
  const st = await prisma.siteSetting.findMany({ where: { key: { in: ["phone", "hotline", "zalo"] } } }); console.log(st);
}
main().finally(() => prisma.$disconnect());
