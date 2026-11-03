// Nọng Ơi — set giá theo bảng niêm yết (sheet) + 50k mỗi căn; chiết khấu CTV phẳng 50k/đêm
// (CTV trả = đúng giá niêm yết của home). Ngày thường = CN–T6 (listPrice), T7 = priceSat.
// Chạy: npx tsx scripts/tmp-fix-nongoi.ts [--apply]
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const PLUS = 50_000;

// Giá niêm yết theo sheet: [ngày thường CN-T6, thứ 7]
const SHEET: [RegExp, number, number][] = [
  [/n[ọo]o?ng\s*(1|3|4)\b/i, 1_000_000, 1_300_000],
  [/n[ọo]o?ng\s*2\b/i, 1_200_000, 1_500_000],
  [/n[ọo]o?ng\s*(5|6)\b/i, 500_000, 700_000],
  [/n[ọo]o?ng\s*(7|8|10|11)\b/i, 800_000, 1_100_000],
  [/n[ọo]o?ng\s*9\b/i, 1_100_000, 1_400_000],
];

async function main() {
  const list = await prisma.service.findMany({
    where: { category: { in: ["HOMESTAY", "BUNGALOW"] } },
    select: { id: true, title: true, slug: true },
  });
  const svcRow = list.find((s) => /n[ọo]o?ng\s*ơi|nong\s*oi/i.test(s.title + " " + s.slug));
  if (!svcRow) {
    console.log("Không tìm thấy Nọng Ơi. Danh sách homestay:");
    list.forEach((s) => console.log(" -", s.slug, "|", s.title));
    return;
  }
  const svc = await prisma.service.findUnique({
    where: { id: svcRow.id },
    include: { roomTypes: { orderBy: { sortOrder: "asc" }, include: { rooms: { orderBy: { sortOrder: "asc" } } } } },
  });
  console.log(`${svc!.title} (${svc!.slug}) — ${APPLY ? "ÁP DỤNG" : "chạy thử"} (+${PLUS / 1000}k, CK CTV ${PLUS / 1000}k)`);

  for (const rt of svc!.roomTypes) {
    for (const r of rt.rooms) {
      // Khớp theo tên phòng; thử thêm tên hạng nếu tên phòng không khớp.
      const m = SHEET.find(([re]) => re.test(r.name)) ?? SHEET.find(([re]) => re.test(rt.name + " " + r.name));
      if (!m) {
        console.log(`  !! KHÔNG KHỚP SHEET: hạng "${rt.name}" / phòng "${r.name}" (list=${r.listPrice}, T7=${r.priceSat}) — bỏ qua`);
        continue;
      }
      const [, weekday, sat] = m;
      const data = {
        listPrice: weekday + PLUS,
        salePrice: null,
        priceMon: null, priceTue: null, priceWed: null, priceThu: null,
        priceFri: null, // CN-T6 là "ngày thường" → dùng listPrice
        priceSat: sat + PLUS,
        priceSun: null,
        commission: PLUS,
        commissionMon: null, commissionTue: null, commissionWed: null, commissionThu: null,
        commissionFri: null, commissionSat: null, commissionSun: null,
      };
      console.log(`  ${rt.name} / ${r.name}: thường ${r.listPrice} -> ${data.listPrice}; T7 ${r.priceSat} -> ${data.priceSat}; CK=${PLUS / 1000}k`);
      if (APPLY) await prisma.room.update({ where: { id: r.id }, data });
    }
  }
  if (!APPLY) console.log("(Thêm --apply để ghi thật)");
  else console.log("ĐÃ CẬP NHẬT XONG.");
}
main().finally(() => prisma.$disconnect());
