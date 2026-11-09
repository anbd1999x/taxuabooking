/**
 * Tạo homestay "Khèn Coffee House Tà Xùa" từ sheet chủ nhà (ảnh bảng giá ở tab "Bảng Giá"
 * + tab lịch theo tháng: phòng ở CỘT, ngày ở HÀNG).
 * Giá: CN–T5 = listPrice · T6–T7 = priceFri/priceSat (CN dùng listPrice). Giá Lễ/Tết ghi ở policy.
 * Sức chứa tiêu chuẩn: 1 giường = 2 khách, 2 giường = 4, 3 giường = 6; nhận thêm tối đa +2 (phụ thu 200k/người).
 * Chạy: npx tsx scripts/tmp-create-khen.ts
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const SLUG = "khen-coffee-house-ta-xua";
const SHEET_URL = "https://docs.google.com/spreadsheets/d/1Rgelj_7hkkSJSp9zOCbJ4tl8hCg0JtXJ0G49jLb78Wc/edit?usp=drivesdk";

interface RtDef {
  name: string;
  weekday: number; // CN–T5
  weekend: number; // T6–T7
  holiday: number;
  beds: number;
  hasBathtub: boolean;
  cloudView: boolean;
  amenities: string;
  rooms: { name: string; description: string }[];
}

const VIEW = "View biển mây";
const RTS: RtDef[] = [
  {
    name: "Phòng 1 giường view biển mây", weekday: 700_000, weekend: 900_000, holiday: 1_200_000, beds: 1,
    hasBathtub: false, cloudView: true, amenities: `1 giường, ${VIEW}, WC khép kín`,
    rooms: [
      { name: "Bình Minh", description: "Căn 1 Bình Minh · 1 giường · view biển mây" },
      { name: "Chạm Mây", description: "Căn 2 Chạm Mây · 1 giường · view biển mây" },
      { name: "Mây Bay", description: "Căn 4 Mây Bay · 1 giường · view biển mây" },
      { name: "Hoàng Hôn", description: "Căn 5 Hoàng Hôn · 1 giường · view biển mây" },
      { name: "Thung Lũng Mây", description: "Phòng Thung Lũng Mây · 1 giường · view biển mây" },
    ],
  },
  {
    name: "Mây Lang Thang", weekday: 800_000, weekend: 1_000_000, holiday: 1_400_000, beds: 1,
    hasBathtub: false, cloudView: true, amenities: `1 giường, ${VIEW}, WC khép kín`,
    rooms: [{ name: "Mây Lang Thang", description: "Phòng Mây Lang Thang · 1 giường · view biển mây" }],
  },
  {
    name: "Chạm Bình Yên (bồn tắm)", weekday: 1_200_000, weekend: 1_400_000, holiday: 2_000_000, beds: 1,
    hasBathtub: true, cloudView: true, amenities: `1 giường, Bồn tắm, ${VIEW}, WC khép kín`,
    rooms: [{ name: "Chạm Bình Yên", description: "Phòng Chạm Bình Yên · 1 giường · có bồn tắm · view biển mây" }],
  },
  {
    name: "Thác Mây (2 giường)", weekday: 1_000_000, weekend: 1_400_000, holiday: 1_700_000, beds: 2,
    hasBathtub: false, cloudView: true, amenities: `2 giường, ${VIEW}, WC khép kín`,
    rooms: [{ name: "Thác Mây", description: "Căn 3 Thác Mây · 2 giường · view biển mây" }],
  },
  {
    name: "Nhà Của Nắng 1 (3 giường)", weekday: 900_000, weekend: 1_400_000, holiday: 1_700_000, beds: 3,
    hasBathtub: false, cloudView: true, amenities: `3 giường, ${VIEW}, Vệ sinh ngoài (không khép kín)`,
    rooms: [{ name: "Nhà Của Nắng 1", description: "Nhà Của Nắng 1 · 3 giường · view biển mây · vệ sinh ngoài" }],
  },
  {
    name: "Nhà Của Nắng 2 giường", weekday: 700_000, weekend: 1_000_000, holiday: 1_400_000, beds: 2,
    hasBathtub: false, cloudView: true, amenities: `2 giường, ${VIEW}, Vệ sinh ngoài (không khép kín)`,
    rooms: [
      { name: "Nhà Của Nắng 2", description: "Nhà Của Nắng 2 · 2 giường · view biển mây · vệ sinh ngoài" },
      { name: "Nhà Của Nắng 3", description: "Nhà Của Nắng 3 · 2 giường · view biển mây · vệ sinh ngoài" },
    ],
  },
  {
    name: "Nhà Của Nắng 5", weekday: 800_000, weekend: 1_200_000, holiday: 1_700_000, beds: 2,
    hasBathtub: false, cloudView: true, amenities: `2 giường, ${VIEW}, WC khép kín`,
    rooms: [{ name: "Nhà Của Nắng 5", description: "Nhà Của Nắng 5 · 2 giường · view biển mây" }],
  },
  {
    name: "Phòng Khèn (không view)", weekday: 300_000, weekend: 400_000, holiday: 500_000, beds: 1,
    hasBathtub: false, cloudView: false, amenities: "1 giường, Không view, Giá tiết kiệm",
    rooms: [1, 2, 3].map((n) => ({ name: `Khèn ${n}`, description: `Phòng Khèn ${n} · 1 giường · không view · giá tiết kiệm` })),
  },
];

const SUMMARY =
  "Khèn Coffee House Tà Xùa — homestay kèm quán cà phê view biển mây: 15 phòng từ phòng 1 giường săn mây, phòng có bồn tắm, căn 2–3 giường cho nhóm (Nhà Của Nắng) tới phòng Khèn giá tiết kiệm.";

const DESCRIPTION = `Khèn Coffee House Tà Xùa là homestay kèm không gian quán cà phê, hầu hết các phòng nhìn thẳng ra biển mây Tà Xùa.

Các hạng phòng:
- Phòng 1 giường view biển mây: Bình Minh, Chạm Mây, Mây Bay, Hoàng Hôn, Thung Lũng Mây, Mây Lang Thang.
- Chạm Bình Yên: phòng 1 giường có bồn tắm, view biển mây.
- Thác Mây: phòng 2 giường cho nhóm 4 khách.
- Nhà Của Nắng: căn 2–3 giường cho gia đình/nhóm bạn (Nhà Của Nắng 1, 2, 3 vệ sinh ngoài; Nhà Của Nắng 5 khép kín).
- Phòng Khèn 1, 2, 3: phòng 1 giường không view, giá tiết kiệm.

Giá đã bao gồm hỗ trợ gửi đồ và vệ sinh cá nhân khi đến sớm.`;

const POLICY = `Nhận phòng 14:00 · Trả phòng 12:00.
Giá theo thứ: Chủ nhật – Thứ 5 giá thường · Thứ 6 – Thứ 7 giá cuối tuần. Bảng giá áp dụng theo số người tiêu chuẩn (1 giường = 2 khách).
Giá Lễ/Tết (đ/đêm): Bình Minh, Hoàng Hôn, Chạm Mây, Mây Bay, Thung Lũng Mây 1.200.000 · Mây Lang Thang 1.400.000 · Chạm Bình Yên 2.000.000 · Thác Mây 1.700.000 · Nhà Của Nắng 1 1.700.000 · Nhà Của Nắng 2, 3 1.400.000 · Nhà Của Nắng 5 1.700.000 · Khèn 1, 2, 3 500.000.
Phụ thu quá số người tiêu chuẩn: 200.000đ/người. Miễn phí trẻ em dưới 6 tuổi.
Check-in sớm (nếu có phòng trống, từ 6h): 200.000đ.
Hỗ trợ lùi lịch 01 lần trong vòng 30 ngày, báo trước ngày nhận phòng ít nhất 5 ngày.`;

async function main() {
  const existing = await prisma.service.findUnique({ where: { slug: SLUG } });
  if (existing) {
    console.log(`Đã tồn tại ${SLUG} (${existing.id}) — bỏ qua.`);
    return;
  }
  const svc = await prisma.service.create({
    data: {
      slug: SLUG,
      category: "HOMESTAY",
      title: "Khèn Coffee House Tà Xùa",
      summary: SUMMARY,
      description: DESCRIPTION,
      policy: POLICY,
      area: "Tà Xùa",
      basePrice: 300_000,
      priceUnit: "/đêm",
      contactName: "Khèn Coffee House",
      published: true,
      sheetUrl: SHEET_URL,
      extraPersonFee: 200_000,
      earlyCheckinFee: 200_000,
      childFreeUnderAge: 6,
    },
  });
  console.log(`${svc.title} (${svc.id})`);
  let rtSort = 0;
  let roomSort = 0;
  for (const rt of RTS) {
    const capacity = rt.beds * 2;
    const roomType = await prisma.roomType.create({
      data: {
        serviceId: svc.id,
        name: rt.name,
        capacity,
        weekdayPrice: rt.weekday,
        weekendPrice: rt.weekend,
        priceFri: rt.weekend,
        priceSat: rt.weekend,
        holidayPrice: rt.holiday,
        totalRooms: rt.rooms.length,
        hasBathtub: rt.hasBathtub,
        cloudView: rt.cloudView,
        sortOrder: rtSort++,
      },
    });
    for (const r of rt.rooms) {
      await prisma.room.create({
        data: {
          roomTypeId: roomType.id,
          name: r.name,
          description: r.description,
          amenities: rt.amenities,
          capacity,
          maxCapacity: capacity + 2,
          listPrice: rt.weekday,
          priceFri: rt.weekend,
          priceSat: rt.weekend,
          sortOrder: roomSort++,
        },
      });
    }
    console.log(`  + ${rt.name}: ${rt.rooms.map((r) => r.name).join(", ")}`);
  }
}
main().finally(() => prisma.$disconnect());
