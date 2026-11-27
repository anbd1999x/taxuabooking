import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
(async () => {
  await p.translation.update({ where: { id: "cmwhyx2xw01miunzk3ix0m3fu" }, data: { value: "Ta Xua Indigo Dyeing" } });
  console.log("Nhuộm Chàm Tà Xùa: Tà Xùa Indigo Dyeing → Ta Xua Indigo Dyeing");
  await p.$disconnect();
})();
