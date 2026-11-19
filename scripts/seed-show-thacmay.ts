/**
 * Show MẪU bán theo bàn, lấy cấu hình công khai của "Thác Mây Show – Acoustic Hoàng Hôn" trên https://thacmaytaxua.vn
 * (16:30–18:30 mỗi ngày · 15 bàn Premium + 25 bàn Standard, mỗi bàn 2–4 người · 3 Set Hoàng Hôn 199k / 279k / 399k).
 * Địa điểm để CHƯA mở bán (published=false) và chưa khai tài khoản nhận tiền; chạy lại không nhân đôi.
 * Chạy: npx tsx --tsconfig scripts/tsconfig.scripts.json --env-file=.env scripts/seed-show-thacmay.ts
 */
import { prisma } from "../src/lib/prisma";
import { createVenue } from "../src/lib/ticket";
import { demoCover, seedTableShowSample } from "../src/lib/module-demo";

const NAME = "Thác Mây Show - Acoustic Hoàng Hôn";

async function main() {
  let v = await prisma.ticketVenue.findFirst({ where: { name: NAME } });
  if (!v) v = await prisma.ticketVenue.findUniqueOrThrow({ where: { id: await createVenue({ kind: "SHOW", name: NAME }) } });
  await prisma.ticketVenue.update({
    where: { id: v.id },
    data: {
      area: "Sân khấu Thác Mây Show · Home Thác Mây, Đỉnh Gió",
      ...(v.coverImage ? {} : { coverImage: demoCover("thac-may-show") }),
      description: "Đêm nhạc acoustic đón hoàng hôn đầu tiên tại Tà Xùa. Đêm nhạc lãng mạn giữa đại ngàn mây đỏ, vừa thưởng trà ấm vừa nghe tình ca mộc mạc. Ngắm hoàng hôn nhuộm đỏ biển mây, tặng đồ uống thảo mộc ấm nóng, ban nhạc mộc mạc acoustic.",
    },
  });
  await seedTableShowSample(v.id);
  const f = await prisma.ticketVenue.findUniqueOrThrow({ where: { id: v.id }, select: { slug: true, published: true, _count: { select: { sessions: true, orders: true, menu: true } } } });
  console.log(`${NAME}`);
  console.log(`  Quản trị : /admin/provider/ve?tab=live&venue=${v.id}`);
  console.log(`  Trang đặt: /ve/${f.slug}   ${f.published ? "" : "(chưa mở bán — tick 'Hiển thị & mở bán trên web' ở Thiết lập)"}`);
  console.log(`  ${f._count.sessions} suất 16:30 · 40 bàn (15 Premium + 25 Standard) · ${f._count.menu} set · ${f._count.orders} đơn mẫu`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
