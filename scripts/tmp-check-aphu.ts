// Kiểm tra cấu trúc hạng phòng / phòng + giá của homestay A Phủ.
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const svc = await prisma.service.findFirst({
    where: { title: { contains: "A Phủ", mode: "insensitive" } },
    include: { roomTypes: { orderBy: { sortOrder: "asc" }, include: { rooms: { orderBy: { sortOrder: "asc" } } } } },
  });
  if (!svc) return console.log("Không tìm thấy dịch vụ A Phủ");
  console.log(`${svc.title} (${svc.category}) id=${svc.id}`);
  for (const rt of svc.roomTypes) {
    console.log(`- Hạng: ${rt.name} (weekday=${rt.weekdayPrice} weekend=${rt.weekendPrice}) — ${rt.rooms.length} phòng`);
    for (const r of rt.rooms) {
      console.log(`    · ${r.name}: list=${r.listPrice} sale=${r.salePrice} T2..CN=[${[r.priceMon, r.priceTue, r.priceWed, r.priceThu, r.priceFri, r.priceSat, r.priceSun].join(",")}]`);
    }
  }
}
main().finally(() => prisma.$disconnect());
