import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
(async () => {
  const p = await prisma.place.findMany({ where: { name: { in: ["Thào Coffee Tà Xùa","Cà phê Bản – Sống Lưng Khủng Long","Nhà H'Mông","Tiệm Mì Cay Tà Xùa","Bếp ăn Xuân Thì Tà Xùa","Tiệm lẩu nướng Trạm Mây","Mây Bay Coffee"] } }, select: { name: true, kind: true, slug: true } });
  console.log(p);
  const m = await prisma.service.findMany({ where: { category: "MOTORBIKE" }, select: { title: true, slug: true } }); console.log(m);
  await prisma.$disconnect();
})();
