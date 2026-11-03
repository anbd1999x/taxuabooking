// Đặt giá TẤT CẢ phòng Lang Thang Homestay: trong tuần (T2–T6) 850k, cuối tuần (T7+CN) 1.650k.
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const WEEKDAY = 850_000;
const WEEKEND = 1_650_000;
const APPLY = process.argv.includes("--apply");
const n = (v: unknown) => (v == null ? null : Number(v));

async function main() {
  const svc = await prisma.service.findFirst({
    where: { slug: "lang-thang-homestay" },
    include: { roomTypes: { orderBy: { sortOrder: "asc" }, include: { rooms: { orderBy: { sortOrder: "asc" } } } } },
  });
  if (!svc) {
    console.log("Không tìm thấy 'lang-thang-homestay'.");
    return;
  }
  console.log(`${svc.title} (${svc.slug}) — ${APPLY ? "ÁP DỤNG" : "chạy thử"} (T2-T6 ${WEEKDAY / 1000}k, T7+CN ${WEEKEND / 1000}k)`);

  for (const rt of svc.roomTypes) {
    for (const r of rt.rooms) {
      const days = [r.priceMon, r.priceTue, r.priceWed, r.priceThu, r.priceFri, r.priceSat, r.priceSun].map(n);
      const data = {
        priceMon: WEEKDAY, priceTue: WEEKDAY, priceWed: WEEKDAY, priceThu: WEEKDAY, priceFri: WEEKDAY,
        priceSat: WEEKEND, priceSun: WEEKEND,
      };
      console.log(
        `  ${rt.name} / ${r.name}: T2..CN [${days.join(",")}] -> [${[data.priceMon, data.priceTue, data.priceWed, data.priceThu, data.priceFri, data.priceSat, data.priceSun].join(",")}] (list=${n(r.listPrice)}, sale=${n(r.salePrice)} giữ nguyên)`,
      );
      if (APPLY) await prisma.room.update({ where: { id: r.id }, data });
    }
  }
  if (!APPLY) console.log("(Thêm --apply để ghi thật)");
  else console.log("ĐÃ CẬP NHẬT XONG.");
}
main().finally(() => prisma.$disconnect());
