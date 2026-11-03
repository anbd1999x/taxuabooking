// Tăng giá TẤT CẢ phòng của A Phủ Home's thêm 50.000đ (giá thường, chiết khấu nếu có, và giá theo thứ).
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const PLUS = 50_000;
const APPLY = process.argv.includes("--apply");

const n = (v: unknown) => (v == null ? null : Number(v));

async function main() {
  const svc = await prisma.service.findFirst({
    where: { title: { contains: "A Phủ", mode: "insensitive" } },
    include: { roomTypes: { include: { rooms: true }, orderBy: { sortOrder: "asc" } } },
  });
  if (!svc) return console.log("Không tìm thấy A Phủ");
  console.log(`${svc.title} — ${APPLY ? "ÁP DỤNG" : "chạy thử"} (+${PLUS.toLocaleString("vi-VN")}đ)`);

  for (const rt of svc.roomTypes) {
    for (const r of rt.rooms) {
      const days = [r.priceMon, r.priceTue, r.priceWed, r.priceThu, r.priceFri, r.priceSat, r.priceSun].map(n);
      const data = {
        listPrice: (n(r.listPrice) ?? 0) + PLUS,
        salePrice: n(r.salePrice) != null ? n(r.salePrice)! + PLUS : null,
        priceMon: days[0] != null ? days[0] + PLUS : null,
        priceTue: days[1] != null ? days[1] + PLUS : null,
        priceWed: days[2] != null ? days[2] + PLUS : null,
        priceThu: days[3] != null ? days[3] + PLUS : null,
        priceFri: days[4] != null ? days[4] + PLUS : null,
        priceSat: days[5] != null ? days[5] + PLUS : null,
        priceSun: days[6] != null ? days[6] + PLUS : null,
      };
      console.log(
        `  ${rt.name} / ${r.name}: list ${n(r.listPrice)} -> ${data.listPrice}; T2..CN [${days.join(",")}] -> [${[data.priceMon, data.priceTue, data.priceWed, data.priceThu, data.priceFri, data.priceSat, data.priceSun].join(",")}]`,
      );
      if (APPLY) await prisma.room.update({ where: { id: r.id }, data });
    }
  }
  if (!APPLY) console.log("(Thêm --apply để ghi thật)");
  else console.log("ĐÃ CẬP NHẬT XONG.");
}
main().finally(() => prisma.$disconnect());
