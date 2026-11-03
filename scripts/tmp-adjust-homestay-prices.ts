// Tăng/giảm giá TẤT CẢ phòng của một homestay (giá thường, chiết khấu nếu có, giá theo thứ).
// Dùng: npx tsx scripts/tmp-adjust-homestay-prices.ts "<tên tìm>" <delta> [--apply]
// VD:   npx tsx scripts/tmp-adjust-homestay-prices.ts "chillout" -50000 --apply
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const [term, deltaArg] = process.argv.slice(2).filter((a) => a !== "--apply");
const APPLY = process.argv.includes("--apply");
const DELTA = Number(deltaArg);
const n = (v: unknown) => (v == null ? null : Number(v));

async function main() {
  if (!term || !Number.isFinite(DELTA) || DELTA === 0) {
    console.log('Dùng: tmp-adjust-homestay-prices.ts "<tên>" <delta đồng> [--apply]');
    return;
  }
  const list = await prisma.service.findMany({
    where: { category: { in: ["HOMESTAY", "BUNGALOW"] } },
    select: { id: true, title: true, slug: true },
  });
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const hits = list.filter((s) => norm(s.title + " " + s.slug).includes(norm(term)));
  if (hits.length !== 1) {
    console.log(hits.length === 0 ? `Không tìm thấy "${term}". Danh sách:` : `Khớp ${hits.length} homestay — thu hẹp từ khoá:`);
    (hits.length ? hits : list).forEach((s) => console.log(" -", s.slug, "|", s.title));
    return;
  }
  const svc = await prisma.service.findUnique({
    where: { id: hits[0].id },
    include: { roomTypes: { orderBy: { sortOrder: "asc" }, include: { rooms: { orderBy: { sortOrder: "asc" } } } } },
  });
  console.log(`${svc!.title} (${svc!.slug}) — ${APPLY ? "ÁP DỤNG" : "chạy thử"} (${DELTA > 0 ? "+" : ""}${DELTA / 1000}k)`);

  for (const rt of svc!.roomTypes) {
    for (const r of rt.rooms) {
      const adj = (v: number | null) => (v != null && v > 0 ? Math.max(0, v + DELTA) : v); // 0/null giữ nguyên
      const days = [r.priceMon, r.priceTue, r.priceWed, r.priceThu, r.priceFri, r.priceSat, r.priceSun].map(n);
      const data = {
        listPrice: adj(n(r.listPrice) ?? 0) ?? 0,
        salePrice: adj(n(r.salePrice)),
        priceMon: adj(days[0]), priceTue: adj(days[1]), priceWed: adj(days[2]), priceThu: adj(days[3]),
        priceFri: adj(days[4]), priceSat: adj(days[5]), priceSun: adj(days[6]),
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
