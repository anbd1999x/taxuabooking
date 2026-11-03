// A Phủ Home's Lưng Chừng — giá web = giá thu về CTV (sheet 11/2026) + 100k; chiết khấu CTV phẳng 100k/đêm.
// Nhóm thường (Đào, Gác Mây, Sương, Sườn Đồi, A Phủ 2, A Phủ 3): thu về 550k T2-T5 / 750k T6,CN / 1.000k T7
//   → web 650k / 850k / 1.100k.
// Lưng Chừng + A Phủ 1: thu về 600k T2-T5 → web 700k / 850k / 1.100k.
// CTV trả = giá web − 100k = đúng giá thu về mọi ngày.
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

const GROUP_B = ["Lưng Chừng", "A Phủ 1"]; // thu về 600k ngày thường

async function main() {
  const svc = await prisma.service.findUnique({
    where: { slug: "a-phu-lung-chung" },
    include: { roomTypes: { include: { rooms: true } } },
  });
  if (!svc) return console.log("Không tìm thấy a-phu-lung-chung");
  console.log(`${svc.title} — ${APPLY ? "ÁP DỤNG" : "chạy thử"}`);

  for (const rt of svc.roomTypes) {
    for (const r of rt.rooms) {
      const isB = GROUP_B.some((n) => r.name.trim().toLowerCase() === n.toLowerCase());
      const data = {
        listPrice: isB ? 700_000 : 650_000, // T2-T5 (thu về + 100k)
        salePrice: null,
        priceMon: null, priceTue: null, priceWed: null, priceThu: null,
        priceFri: 850_000,  // thu về 750k + 100k
        priceSat: 1_100_000, // thu về 1.000k + 100k
        priceSun: 850_000,
        commission: 100_000, // chiết khấu CTV phẳng mọi ngày
        commissionMon: null, commissionTue: null, commissionWed: null, commissionThu: null,
        commissionFri: null, commissionSat: null, commissionSun: null,
      };
      console.log(`  ${r.name}${isB ? " [700k]" : " [650k]"}: web ${data.listPrice / 1000}k / T6,CN 850k / T7 1.100k — CK CTV 100k`);
      if (APPLY) await prisma.room.update({ where: { id: r.id }, data });
    }
  }
  if (!APPLY) console.log("(Thêm --apply để ghi thật)");
  else console.log("ĐÃ CẬP NHẬT XONG.");
}
main().finally(() => prisma.$disconnect());
