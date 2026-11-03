// Xoá toàn bộ CabinTrip của nhà xe Xuân Trường: npx tsx scripts/tmp-delete-xuantruong-trips.ts [--apply]
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

async function main() {
  const services = await prisma.service.findMany({
    where: { category: "CABIN", title: { contains: "Xuân Trường", mode: "insensitive" } },
    select: { id: true, title: true, slug: true },
  });
  if (services.length === 0) {
    console.log("Không tìm thấy nhà xe nào tên chứa 'Xuân Trường' (category CABIN).");
    const all = await prisma.service.findMany({ where: { category: "CABIN" }, select: { title: true } });
    console.log("Các nhà xe cabin hiện có:", all.map((s) => s.title).join(" | "));
    return;
  }
  for (const s of services) {
    const ids = (await prisma.cabinTrip.findMany({ where: { serviceId: s.id }, select: { id: true } })).map((t) => t.id);
    const bookings = ids.length
      ? await prisma.bookingRequest.count({
          where: { OR: [{ cabinTripId: { in: ids } }, { cabinReturnTripId: { in: ids } }] },
        })
      : 0;
    console.log(`Nhà xe: ${s.title} (${s.slug}) — ${ids.length} chuyến, ${bookings} đơn đang tham chiếu các chuyến này`);
    if (APPLY && ids.length) {
      const r = await prisma.cabinTrip.deleteMany({ where: { serviceId: s.id } });
      console.log(`  -> ĐÃ XOÁ ${r.count} chuyến.`);
    }
  }
  if (!APPLY) console.log("(Chạy thử — thêm --apply để xoá thật)");
}

main().finally(() => prisma.$disconnect());
