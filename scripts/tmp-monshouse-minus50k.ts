// Giảm giá TẤT CẢ phòng của Mon's House Tà Xùa đi 50.000đ (giá thường, chiết khấu nếu có, giá theo thứ).
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const PLUS = -50_000;
const APPLY = process.argv.includes("--apply");
const n = (v: unknown) => (v == null ? null : Number(v));

async function main() {
  const list = await prisma.service.findMany({
    where: { category: { in: ["HOMESTAY", "BUNGALOW"] } },
    select: { id: true, title: true, slug: true },
  });
  const hit = list.find((s) => /mon'?s\s*house/i.test(s.title) || /mons-house/i.test(s.slug));
  if (!hit) {
    console.log("Không tìm thấy 'Mon's House'. Danh sách homestay:");
    list.forEach((s) => console.log(" -", s.slug, "|", s.title));
    return;
  }
  const svc = await prisma.service.findUnique({
    where: { id: hit.id },
    include: { roomTypes: { orderBy: { sortOrder: "asc" }, include: { rooms: { orderBy: { sortOrder: "asc" } } } } },
  });
  console.log(`${svc!.title} (${svc!.slug}) — ${APPLY ? "ÁP DỤNG" : "chạy thử"} (${PLUS / 1000}k)`);

  for (const rt of svc!.roomTypes) {
    for (const r of rt.rooms) {
      const days = [r.priceMon, r.priceTue, r.priceWed, r.priceThu, r.priceFri, r.priceSat, r.priceSun].map(n);
      // 0 = "IB để biết giá" → giữ nguyên; không cho giá tụt xuống <= 0
      const plus = (v: number | null) => (v != null && v > 0 ? Math.max(v + PLUS, 0) : v);
      const data = {
        listPrice: Math.max((n(r.listPrice) ?? 0) + PLUS, 0),
        salePrice: n(r.salePrice) != null ? Math.max(n(r.salePrice)! + PLUS, 0) : null,
        priceMon: plus(days[0]), priceTue: plus(days[1]), priceWed: plus(days[2]), priceThu: plus(days[3]),
        priceFri: plus(days[4]), priceSat: plus(days[5]), priceSun: plus(days[6]),
      };
      console.log(
        `  ${rt.name} / ${r.name}: list ${n(r.listPrice)} -> ${data.listPrice}${n(r.salePrice) != null ? `; sale ${n(r.salePrice)} -> ${data.salePrice}` : ""}; T2..CN [${days.join(",")}] -> [${[data.priceMon, data.priceTue, data.priceWed, data.priceThu, data.priceFri, data.priceSat, data.priceSun].join(",")}]`,
      );
      if (APPLY) await prisma.room.update({ where: { id: r.id }, data });
    }
  }
  if (!APPLY) console.log("(Thêm --apply để ghi thật)");
  else console.log("ĐÃ CẬP NHẬT XONG.");
}
main().finally(() => prisma.$disconnect());
