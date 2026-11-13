import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
(async () => {
  const s = await prisma.service.findMany({ where: { slug: { in: ["haus-meej-ta-xua","happy-town-ta-xua","lang-thang-homestay","chung-chinh-homestay","cloud-forest-ta-xua","mons-house-ta-xua","noong-oi-homestay","la-cheu-homestay","khen-coffee-house-ta-xua"] } }, select: { title: true, policy: true, summary: true } });
  for (const x of s) console.log("##", x.title, "\n", (x.policy ?? "").replace(/\s+/g, " "), "\n");
  await prisma.$disconnect();
})();
