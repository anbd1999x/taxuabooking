import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  // Ảnh khuôn viên Mây Bản (7 ảnh đầu của service may-ban-ta-xua) để tái dùng cho Place cafe Mây Bản
  const imgs = await prisma.serviceImage.findMany({
    where: { service: { slug: "may-ban-ta-xua" } },
    orderBy: { sortOrder: "asc" },
    take: 7,
    select: { url: true },
  });
  console.log(JSON.stringify(imgs.map((i) => i.url)));
}
main().finally(() => prisma.$disconnect());
