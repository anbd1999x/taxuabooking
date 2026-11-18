/**
 * Tạo "Chillin House" theo bảng giá chủ nhà gửi (áp dụng sau 15/08/2025) + sheet lịch phòng
 * (docs.google.com/spreadsheets/d/1gshdb3IN7SlNqukfdfG_vDEw2ViMmV4wgyGfle4LhwM).
 * - 5 phòng, mỗi phòng 2 khách, giá đã gồm ăn sáng: 2 Superior (1 mặt kính), 2 Deluxe (2 mặt kính), 1 Suite bồn tắm.
 * - Trong tuần = CN–T5 · Cuối tuần = T6, T7 · Lễ Tết = giá cuối tuần + 20% (ghi chú trong sheet).
 * - Sheet có 2 cột trùng nhãn "Super (1 mặt kính)" ⇒ 2 phòng Superior dùng chung bí danh, sheet-sync xếp theo thứ tự cột.
 * Chạy: npx tsx scripts/tmp-create-chillin-house.ts   (DATABASE_URL theo .env = prod)
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const SLUG = "chillin-house-ta-xua";
const TITLE = "Chillin House";
const SHEET_URL = "https://docs.google.com/spreadsheets/d/1gshdb3IN7SlNqukfdfG_vDEw2ViMmV4wgyGfle4LhwM/edit";
const HOLIDAY_RATE = 1.2;
const AMENITIES_BASE = "Ăn sáng tại home, Vách kính view núi & biển mây, Phòng khép kín, Bình nóng lạnh, Wifi, Khoá thẻ từ, Sân cà phê ngắm mây";

type T = {
  name: string;
  desc: string;
  weekday: number;
  weekend: number;
  bathtub?: boolean;
  amenities: string;
  rooms: { name: string; alias: string }[];
};
const TYPES: T[] = [
  {
    name: "Superior (1 mặt kính)",
    desc: "Phòng Superior 1 mặt kính nhìn ra núi và biển mây",
    weekday: 1_100_000,
    weekend: 1_250_000,
    amenities: AMENITIES_BASE,
    rooms: [
      { name: "Superior 1", alias: "Super (1 mặt kính)" },
      { name: "Superior 2", alias: "Super (1 mặt kính)" },
    ],
  },
  {
    name: "Deluxe (2 mặt kính)",
    desc: "Phòng Deluxe 2 mặt kính, góc nhìn rộng ra núi và biển mây",
    weekday: 1_300_000,
    weekend: 1_450_000,
    amenities: AMENITIES_BASE,
    rooms: [
      { name: "Deluxe 101", alias: "Deluxe (2 mặt kính)" },
      { name: "Deluxe 105", alias: "Deluxe (2 mặt kính)" },
    ],
  },
  {
    name: "Suite bồn tắm",
    desc: "Phòng Suite có bồn tắm đặt sát vách kính, ngâm mình ngắm biển mây",
    weekday: 1_500_000,
    weekend: 1_650_000,
    bathtub: true,
    amenities: `Bồn tắm ngắm mây, ${AMENITIES_BASE}`,
    rooms: [{ name: "Chillin Suite", alias: "Suite, Suite bồn tắm" }],
  },
];

const fmt = (n: number) => n.toLocaleString("vi-VN") + "đ";
const holiday = (t: T) => Math.round((t.weekend * HOLIDAY_RATE) / 1000) * 1000;
const priceLines = TYPES.map(
  (t) => `- Phòng ${t.name} (2 khách): CN–T5 ${fmt(t.weekday)} · T6, T7 ${fmt(t.weekend)} · Lễ Tết ${fmt(holiday(t))}`,
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
  const minPrice = Math.min(...TYPES.map((t) => t.weekday));

  const svc = await prisma.service.create({
    data: {
      slug: SLUG,
      category: "HOMESTAY",
      title: TITLE,
      summary:
        "Chillin House Tà Xùa — 5 phòng vách kính nhìn thẳng ra núi và biển mây, có phòng Suite bồn tắm ngắm mây. Giá đã gồm ăn sáng tại home, tặng voucher đồ uống & đồ ăn.",
      description: `Chillin House là homestay phòng riêng ở Tà Xùa với vách kính lớn nhìn thẳng ra núi rừng và biển mây — nằm trên giường hay ngâm bồn đều ngắm được mây. Home có sân cà phê ngoài trời để ngồi săn mây buổi sớm.

Home có 5 phòng, mỗi phòng 2 khách:
- **Phòng Superior** (2 phòng): 1 mặt kính nhìn ra núi và biển mây.
- **Phòng Deluxe** (2 phòng — 101, 105): 2 mặt kính, góc nhìn rộng.
- **Phòng Suite bồn tắm** (1 phòng): bồn tắm đặt sát vách kính, ngâm mình ngắm mây.

Giá phòng đã bao gồm:
- Ăn sáng tại home
- Voucher giảm 20% đồ uống tại Chill Coffee
- Voucher giảm 10% đồ ăn tại Xuân Thì

Giờ nhận phòng 14h00, trả phòng 12h00.`,
      policy: `Giá phòng (2 khách/phòng, đã gồm ăn sáng):
${priceLines}
Trong tuần: Chủ nhật – Thứ 5 · Cuối tuần: Thứ 6, Thứ 7 · Lễ Tết: phụ thu 20% trên giá cuối tuần.

Giờ nhận – trả phòng:
- Nhận phòng: 14h00 · Trả phòng: muộn nhất 12h00.
- Nhận phòng sớm trước 06h00: thanh toán 100% giá trị tiền phòng.
- Nhận phòng sớm từ 07h00 – 12h00: thanh toán 50% giá trị tiền phòng.
- Trả phòng muộn sau 12h00 tới 18h00: thanh toán 50% giá trị tiền phòng.
- Trả phòng muộn sau 18h00: thanh toán 100% giá trị tiền phòng.

Quy định trong phòng:
- Khu vực hút thuốc ở tầng trên của home, không hút thuốc trong phòng.
- Không mang đồ ăn, thức uống, các loại bếp lò vào trong phòng; không nấu nướng, không ăn mì hộp trong phòng.
- Không sử dụng loa kéo, thiết bị phát nhạc, hát karaoke gây ồn ào sau 22h00.
- Không mang động vật, thú nuôi vào phòng.
- Không tự ý di chuyển đồ đạc, đồ trang trí; hư hỏng sẽ bồi thường theo quy định.
- Tuyệt đối không sử dụng chất cấm, chất gây nghiện, súng đạn, chất gây cháy, độc hại.
- Khi ra khỏi phòng vui lòng gửi lại thẻ từ cho lễ tân.

Hoàn – huỷ:
- Home không hoàn – huỷ; hỗ trợ bảo lưu cọc, dời lịch khi khách báo trước 7 ngày trước giờ check-in (bảo lưu cọc trong 30 ngày, giá phòng tính theo thời điểm ngày đi).
- Chỉ hỗ trợ dời lịch 01 lần; dời lịch từ lần thứ 2 tính phí 100.000đ/phòng.
- Home có quyền huỷ booking nếu chưa nhận được tiền cọc.
- Trường hợp mưa bão: hỗ trợ bảo lưu cọc trong 30 ngày, báo trước 2 ngày so với ngày check-in, giá tính theo thời điểm đi.`,
      area: "Tà Xùa",
      basePrice: minPrice,
      priceUnit: "/đêm",
      contactName: TITLE,
      published: true,
      sheetUrl: SHEET_URL,
    },
  });

  let sort = 0;
  for (const [ti, t] of TYPES.entries()) {
    const rt = await prisma.roomType.create({
      data: {
        serviceId: svc.id,
        name: t.name,
        capacity: 2,
        priceSun: t.weekday,
        weekdayPrice: t.weekday,
        weekendPrice: t.weekend,
        holidayPrice: holiday(t),
        priceFri: t.weekend,
        priceSat: t.weekend,
        totalRooms: t.rooms.length,
        hasBathtub: !!t.bathtub,
        cloudView: true,
        breakfast: true,
        sortOrder: ti,
      },
    });
    for (const r of t.rooms) {
      await prisma.room.create({
        data: {
          roomTypeId: rt.id,
          name: r.name,
          sheetAlias: r.alias,
          description: `${t.desc} · 2 khách · đã gồm ăn sáng · Lễ Tết ${fmt(holiday(t))}/đêm`,
          amenities: t.amenities,
          capacity: 2,
          maxCapacity: 2,
          listPrice: t.weekday, // CN–T5
          priceFri: t.weekend,
          priceSat: t.weekend,
          sortOrder: sort++,
        },
      });
    }
    console.log(`  ${t.name}: ${t.rooms.map((r) => r.name).join(", ")}`);
  }
  console.log(`Đã tạo ${TITLE} — id ${svc.id}, slug ${SLUG}`);
}
main().finally(() => prisma.$disconnect());
