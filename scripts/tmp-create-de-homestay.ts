/**
 * Tạo "Dê Homestay Tà Xùa" theo sheet báo giá chủ nhà
 * (docs.google.com/spreadsheets/d/1jZx-Sy4JAXwVJ7_s6ZssFi5-QZTk_lzomZc2ZW97OSY).
 * - Phòng đơn (Sa 2/4/6/8/9): chuẩn 2, tối đa 3 · Phòng đôi (Sa 3/5/7): chuẩn 4, tối đa 6.
 * - Giá niêm yết: Ngày thường = CN–T5 · Cuối tuần = T6, T7 · Lễ Tết ghi trong chính sách.
 * - Chiết khấu 100k/phòng/đêm mọi ngày, trừ Thứ 7 (và lễ tết).
 * - Phụ thu từ 6 tuổi: 200k/người/đêm; dưới 6 tuổi free.
 * Chạy: npx tsx scripts/tmp-create-de-homestay.ts   (DATABASE_URL theo .env = prod)
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const SLUG = "de-homestay-ta-xua";
const TITLE = "Dê Homestay";
const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1jZx-Sy4JAXwVJ7_s6ZssFi5-QZTk_lzomZc2ZW97OSY/edit?gid=817459191#gid=817459191";
const MAP_URL = "https://maps.app.goo.gl/6pJvJz1TDUM1LM7E9";
const AMENITIES =
  "Giường 1m6×2m hoặc 1m8×2m, Phòng khép kín, Bình nóng lạnh, Đệm sưởi, Ấm siêu tốc, Máy sấy tóc, Quạt điện, Trà & nước lọc miễn phí, Đồ dùng cá nhân, Dép đi trong nhà, Wifi";

type R = { name: string; weekday: number; weekend: number; holiday: number; alias?: string; note?: string };
const TYPES: { name: string; capacity: number; max: number; rooms: R[] }[] = [
  {
    name: "Phòng đơn",
    capacity: 2,
    max: 3,
    rooms: [
      { name: "Sa 2", weekday: 600_000, weekend: 700_000, holiday: 900_000 },
      { name: "Sa 4", weekday: 600_000, weekend: 800_000, holiday: 1_000_000 },
      { name: "Sa 6", weekday: 600_000, weekend: 800_000, holiday: 1_000_000 },
      { name: "Sa 8", weekday: 500_000, weekend: 600_000, holiday: 700_000 },
      { name: "Sa 9", weekday: 600_000, weekend: 800_000, holiday: 1_000_000, alias: "Sa 9 (sofa), Sa9", note: "có sofa" },
    ],
  },
  {
    name: "Phòng đôi",
    capacity: 4,
    max: 6,
    rooms: [
      { name: "Sa 3", weekday: 900_000, weekend: 1_200_000, holiday: 1_500_000 },
      { name: "Sa 5", weekday: 900_000, weekend: 1_200_000, holiday: 1_500_000 },
      { name: "Sa 7", weekday: 900_000, weekend: 1_200_000, holiday: 1_500_000 },
    ],
  },
];

const fmt = (n: number) => n.toLocaleString("vi-VN") + "đ";
const priceLines = TYPES.flatMap((t) =>
  t.rooms.map(
    (r) =>
      `- ${t.name} ${r.name} (${t.capacity} khách, tối đa ${t.max}): CN–T5 ${fmt(r.weekday)} · T6, T7 ${fmt(r.weekend)} · Lễ Tết ${fmt(r.holiday)}`,
  ),
).join("\n");

async function main() {
  const existing = await prisma.service.findFirst({
    where: { OR: [{ slug: SLUG }, { title: { equals: TITLE, mode: "insensitive" } }] },
    select: { id: true, slug: true, title: true },
  });
  if (existing) {
    console.log(`Đã có "${existing.title}" (${existing.slug}, ${existing.id}) — không tạo trùng.`);
    return;
  }
  const minPrice = Math.min(...TYPES.flatMap((t) => t.rooms.map((r) => r.weekday)));

  const svc = await prisma.service.create({
    data: {
      slug: SLUG,
      category: "HOMESTAY",
      title: TITLE,
      summary:
        "Dê Homestay nằm ngay trung tâm xã Tà Xùa, trên tuyến phố đi bộ Thiên đường mây, mặt đường tỉnh lộ 112 — gần khèn check-in, cà phê H'Mông, Gió Bản. 8 phòng đơn & đôi có đệm sưởi, nóng lạnh, wifi.",
      description: `Dê Homestay ở trung tâm xã Tà Xùa, nằm trên tuyến phố đi bộ Thiên đường mây Tà Xùa, mặt đường tỉnh lộ 112 — cách Thiên đường mây khoảng 100m, gần khèn check-in, cà phê H'Mông, Gió Bản. Đường vào dễ đi, thuận tiện dạo phố và đi các điểm săn mây.

Home có 8 phòng riêng:
- **Phòng đơn** (Sa 2, Sa 4, Sa 6, Sa 8, Sa 9): tiêu chuẩn 2 khách, tối đa 3 khách.
- **Phòng đôi** (Sa 3, Sa 5, Sa 7): tiêu chuẩn 4 khách, tối đa 6 khách.

Dịch vụ bao gồm:
- Phòng nghỉ theo tiêu chuẩn, giường 1m6×2m hoặc 1m8×2m
- Trà, nước lọc miễn phí trong phòng
- Bàn chải đánh răng, sữa tắm, dao cạo râu, bông tăm…
- Ấm siêu tốc, máy sấy tóc, quạt điện, đệm sưởi, bình nóng lạnh, dép đi trong nhà
- Wifi trong khu vực homestay

Giá phòng không bao gồm ăn sáng. Home có cho thuê xe máy (Wave, PG1) và hỗ trợ xe cabin đưa đón Hà Nội – Tà Xùa.`,
      policy: `Giá niêm yết (theo số khách tiêu chuẩn, chưa gồm phụ thu thêm người):
${priceLines}
Ngày thường: Chủ nhật – Thứ 5 · Cuối tuần: Thứ 6, Thứ 7 · Lễ Tết: Tết Dương, Tết Âm, các ngày lễ.
Giá phòng không bao gồm ăn sáng.

Phụ thu:
- Trẻ em dưới 6 tuổi: miễn phí tiền phòng.
- Từ 6 tuổi trở lên: phụ thu 200.000đ/người/đêm (ngủ ghép).
- Dọn dẹp, decor honeymoon / sinh nhật: từ 200.000đ/phòng.

Giờ nhận – trả phòng:
- Check in: sau 14h00 · Check out: trước 12h00.
Trường hợp homestay có phòng trống, sẽ hỗ trợ khách nhận phòng sớm hoặc trả phòng muộn:
- Nhận phòng trước 06h00: phí 50% giá niêm yết
- Nhận phòng từ 07h00 – 10h00: phí 30% giá niêm yết
- Nhận phòng từ sau 10h00: miễn phí
- Trả phòng muộn trước 15h00: 30% giá niêm yết
- Trả phòng muộn trước 18h00: 50% giá niêm yết
- Trả phòng muộn sau 18h00: 100% giá niêm yết

Nội quy:
- Không hút thuốc trong phòng.
- Không mang đồ ăn nặng mùi (măng cụt, sầu riêng…) vào phòng.
- Không mang vật nuôi vào phòng.
- Không tự ý di chuyển đồ đạc trong phòng.
- Không sử dụng chất cấm, chất gây nghiện, chất độc hại.
Homestay có quyền từ chối phục vụ nếu khách vi phạm một trong các trường hợp trên.

Thanh toán: đặt cọc trước tối thiểu 50%, số còn lại thanh toán khi nhận phòng.

Hoàn – huỷ:
- Home không hoàn huỷ, hỗ trợ dời lịch.
- Dời lịch báo trước 7 ngày để home hỗ trợ (không dời vào cuối tuần, dời trong vòng 30 ngày).
- Huỷ phòng trước 5 ngày check-in: home không hoàn cọc.
- Trường hợp bất khả kháng (thiên tai, bão lũ, dịch bệnh, sức khoẻ có chẩn đoán của cơ sở y tế…): bảo lưu và dời ngày trong vòng 30 ngày kể từ ngày nhận phòng, tuỳ tình trạng phòng trống.`,
      area: "Trung tâm xã Tà Xùa",
      distanceKm: 0,
      mapUrl: MAP_URL,
      basePrice: minPrice,
      priceUnit: "/đêm",
      contactName: TITLE,
      published: true,
      easyRoad: true,
      extraPersonFee: 200_000,
      childFreeUnderAge: 6,
      sheetUrl: SHEET_URL,
    },
  });

  let sort = 0;
  for (const [ti, t] of TYPES.entries()) {
    const base = t.rooms[0];
    const rt = await prisma.roomType.create({
      data: {
        serviceId: svc.id,
        name: t.name,
        capacity: t.capacity,
        weekdayPrice: base.weekday,
        weekendPrice: base.weekend,
        holidayPrice: base.holiday,
        priceFri: base.weekend,
        priceSat: base.weekend,
        totalRooms: t.rooms.length,
        heating: true, // đệm sưởi
        sortOrder: ti,
      },
    });
    for (const r of t.rooms) {
      await prisma.room.create({
        data: {
          roomTypeId: rt.id,
          name: r.name,
          sheetAlias: r.alias ?? null,
          description: `${t.name} ${r.name}${r.note ? ` (${r.note})` : ""} · tiêu chuẩn ${t.capacity} khách, tối đa ${t.max} khách (phụ thu 200.000đ/người/đêm từ 6 tuổi) · Lễ Tết ${fmt(r.holiday)}/đêm`,
          amenities: AMENITIES,
          capacity: t.capacity,
          maxCapacity: t.max,
          listPrice: r.weekday, // CN–T5
          priceFri: r.weekend,
          priceSat: r.weekend,
          commission: 100_000, // chiết khấu 100k/phòng/đêm
          commissionSat: 0, // trừ Thứ 7
          sortOrder: sort++,
        },
      });
    }
    console.log(`  ${t.name}: ${t.rooms.map((r) => r.name).join(", ")}`);
  }
  console.log(`Đã tạo ${TITLE} — id ${svc.id}, slug ${SLUG}`);
}
main().finally(() => prisma.$disconnect());
