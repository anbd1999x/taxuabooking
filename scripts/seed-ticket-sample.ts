/**
 * Dữ liệu MẪU cho một nhà hàng của module Vé & đặt bàn + Gọi món QR: gắn với một quán có sẵn ở danh mục Nhà hàng
 * (bảng Place), tạo bàn, thực đơn, vài lần gọi món đang chạy, một yêu cầu thanh toán và hai đơn đặt bàn trước.
 * Địa điểm để CHƯA mở bán (published=false) — khách chưa thấy; chạy lại nhiều lần không nhân đôi dữ liệu.
 * Chạy: npx tsx --tsconfig scripts/tsconfig.scripts.json --env-file=.env scripts/seed-ticket-sample.ts [slug-quán]
 */
import { prisma } from "../src/lib/prisma";
import { createVenue } from "../src/lib/ticket";
import { loadDine } from "../src/lib/dine";
import { seedRestaurantSample } from "../src/lib/module-demo";

const PLACE_SLUG = process.argv[2] || "nha-hang-doi-may";
async function main() {
  const place = await prisma.place.findFirst({ where: { slug: PLACE_SLUG } });
  if (!place) throw new Error(`Không thấy quán "${PLACE_SLUG}" ở danh mục Nhà hàng / Cafe.`);
  let venue = await prisma.ticketVenue.findFirst({ where: { placeId: place.id, kind: "RESTAURANT" } });
  if (!venue) venue = await prisma.ticketVenue.findUniqueOrThrow({ where: { id: await createVenue({ kind: "RESTAURANT", name: place.name, placeId: place.id }) } });
  const venueId = venue.id;
  await seedRestaurantSample(venueId);

  const v = await prisma.ticketVenue.findUniqueOrThrow({ where: { id: venueId } });
  const fresh = await loadDine(venueId);
  console.log(`Nhà hàng mẫu: ${v.name}  (gắn với quán /nha-hang/${place.slug})`);
  console.log(`  Quản trị : /admin/provider/ve?tab=qr&venue=${v.id}`);
  console.log(`  Đặt bàn  : /ve/${v.slug}   ${v.published ? "" : "(chưa mở bán — tick 'Hiển thị & mở bán trên web' ở Thiết lập)"}`);
  console.log(`  ${fresh.tables.length} bàn · ${fresh.menu.length} món · ${fresh.orders.length} lần gọi đang mở · ${fresh.reqs.length} yêu cầu`);
  console.log(`  Thử gọi món bàn B3: ${fresh.tables.find((t) => t.name === "B3")?.url}`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
