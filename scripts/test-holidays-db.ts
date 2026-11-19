/**
 * Kiểm thử ĐẦU-CUỐI giá ngày lễ trên DB thật. Tạm gắn giá lễ cho 1 phòng + 1 đêm lễ xa trong tương lai,
 * đối chiếu computeAvailability (trang phòng / đặt homestay / admin tạo đơn) và findComboMatches (combo),
 * rồi KHÔI PHỤC nguyên trạng (finally) — kể cả khi lỗi.
 *   npx tsx --tsconfig scripts/tsconfig.scripts.json --env-file=.env scripts/test-holidays-db.ts
 */
import { prisma } from "../src/lib/prisma";
import { computeAvailability } from "../src/lib/booking";
import { findComboMatches, EMPTY_FILTERS } from "../src/lib/combo";
import { roomPricing, priceForDay } from "../src/lib/availability";
import { addDays, today, toDateKey, enumerateNights, parseDateOnly } from "../src/lib/dates";
import { HOLIDAYS_KEY } from "../src/lib/holidays";

let ok = 0;
let bad = 0;
function eq(name: string, got: unknown, want: unknown) {
  if (JSON.stringify(got) === JSON.stringify(want)) { ok++; console.log(`✓ ${name}`); }
  else { bad++; console.log(`✗ ${name}\n    nhận: ${JSON.stringify(got)}\n    cần : ${JSON.stringify(want)}`); }
}

async function main() {
  // Kỳ 3 đêm, đêm GIỮA là ngày lễ: ngày đi combo = D, nhận phòng D+1, trả D+4 (đêm D+1, D+2, D+3).
  const D = addDays(today(), 40);
  const ci = addDays(D, 1);
  const co = addDays(D, 4);
  const holKey = toDateKey(addDays(D, 2));
  const nights = enumerateNights(ci, co);

  // Phòng của homestay đang bán, ghép được combo, còn trống cả kỳ, có giá mọi đêm.
  const rooms = await prisma.room.findMany({
    where: { roomType: { service: { category: "HOMESTAY", published: true, contactOnly: false, inquiryOnly: false } } },
    include: { roomType: { include: { service: true } } },
  });
  const busy = new Set(
    (await prisma.roomDayStatus.findMany({ where: { date: { in: nights }, status: { not: "AVAILABLE" } }, select: { roomId: true } })).map((x) => x.roomId),
  );
  const room = rooms.find((r) => !busy.has(r.id) && nights.every((d) => priceForDay(d, roomPricing(r), null) > 0) && r.holidayPrice == null);
  if (!room) throw new Error("Không tìm được phòng trống phù hợp để thử.");
  const normal = nights.map((d) => priceForDay(d, roomPricing(room), null));
  const HOL = normal[1] + 123000; // giá lễ khác hẳn giá thường để dễ nhận ra
  console.log(`Phòng thử: ${room.roomType.service.title} · ${room.name} — đêm lễ ${holKey}, giá thường ${normal.join("+")}, giá lễ ${HOL}`);

  const oldSetting = await prisma.siteSetting.findUnique({ where: { key: HOLIDAYS_KEY } });
  try {
    await prisma.room.update({ where: { id: room.id }, data: { holidayPrice: HOL } });
    await prisma.siteSetting.upsert({
      where: { key: HOLIDAYS_KEY },
      create: { key: HOLIDAYS_KEY, value: JSON.stringify([{ name: "Thử", from: holKey, to: holKey, yearly: false }]) },
      update: { value: JSON.stringify([{ name: "Thử", from: holKey, to: holKey, yearly: false }]) },
    });
    const want = normal[0] + HOL + normal[2];

    // 1) Trang phòng / đặt homestay / admin tạo đơn.
    const av = await computeAvailability(room.roomType.serviceId, toDateKey(ci), toDateKey(co), 1);
    const opt = av?.stayOptions?.find((o) => o.id === room.id);
    eq("computeAvailability: tổng kỳ có đêm lễ", opt?.pricePerUnit, want);
    // Kỳ KHÔNG chạm đêm lễ ⇒ giá thường.
    const av2 = await computeAvailability(room.roomType.serviceId, toDateKey(ci), toDateKey(addDays(ci, 1)), 1);
    eq("computeAvailability: kỳ không có đêm lễ", av2?.stayOptions?.find((o) => o.id === room.id)?.pricePerUnit, normal[0]);

    // 2) Combo (trang tìm — cùng công thức createComboBooking).
    const res = await findComboMatches({ fromKey: toDateKey(D), toKey: toDateKey(co), people: 2, adults: 2, childrenAges: [], budget: null, filters: EMPTY_FILTERS, keepAllHomes: true });
    const cr = res?.homes.flatMap((h) => h.rooms).find((r) => r.roomId === room.id);
    if (cr) eq("findComboMatches: tiền phòng có đêm lễ", cr.roomCost, want);
    else console.log("· (bỏ qua combo: phòng không vào danh sách combo — vd home vi phạm chính sách cuối tuần)");

    // 3) Đêm lễ có giá thường ≠ giá lễ thật (đảm bảo bài thử có nghĩa).
    eq("giá lễ khác giá thường", HOL !== normal[1], true);
  } finally {
    await prisma.room.update({ where: { id: room.id }, data: { holidayPrice: null } });
    if (oldSetting) await prisma.siteSetting.update({ where: { key: HOLIDAYS_KEY }, data: { value: oldSetting.value } });
    else await prisma.siteSetting.deleteMany({ where: { key: HOLIDAYS_KEY } });
    const after = await prisma.room.findUnique({ where: { id: room.id }, select: { holidayPrice: true } });
    console.log(`Đã khôi phục: holidayPrice=${after?.holidayPrice ?? "null"}, lịch lễ ${oldSetting ? "như cũ" : "đã xoá (trước đó chưa có)"}`);
  }
  console.log(`\n${bad ? "✗" : "✓"} ${ok} đạt, ${bad} lỗi`);
}

main()
  .catch((e) => { console.error(e); bad++; })
  .finally(async () => { await prisma.$disconnect(); process.exit(bad ? 1 : 0); });
