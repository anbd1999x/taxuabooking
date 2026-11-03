// Liệt kê homestay + hạng phòng + phòng + giá để đối chiếu bảng giá.
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const list = await prisma.service.findMany({
    where: { category: { in: ["HOMESTAY", "BUNGALOW"] }, title: { contains: "phủ", mode: "insensitive" } },
    include: { roomTypes: { orderBy: { sortOrder: "asc" }, include: { rooms: { orderBy: { sortOrder: "asc" } } } } },
  });
  for (const svc of list) {
    console.log(`\n=== ${svc.title} (slug=${svc.slug}, published=${svc.published}) id=${svc.id}`);
    for (const rt of svc.roomTypes) {
      console.log(`- Hạng: ${rt.name} (${rt.rooms.length} phòng)`);
      for (const r of rt.rooms) {
        console.log(
          `    · ${r.name}: list=${r.listPrice} sale=${r.salePrice} cap=${r.capacity}/${r.maxCapacity ?? "-"} extra=${r.extraPersonFee ?? "-"} T2..CN=[${[r.priceMon, r.priceTue, r.priceWed, r.priceThu, r.priceFri, r.priceSat, r.priceSun].join(",")}] comm=${r.commission ?? "-"}`,
        );
      }
    }
  }
}
main().finally(() => prisma.$disconnect());
