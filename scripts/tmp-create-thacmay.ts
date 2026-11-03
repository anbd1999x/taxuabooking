/**
 * Tạo homestay "Thác Mây Tà Xùa" (Đỉnh Gió) + 4 hạng phòng + 13 phòng
 * từ tab THONG_TIN_PHONG của sheet chủ nhà.
 * Giá: T2–T5 = listPrice · T6 & CN = priceFri/priceSun · T7 = priceSat.
 * Giá lễ (tab Gia_Ngay_Le): VIP 2.500.000 · Lux 3.500.000 (Tết Dương 1–2/1/2027; 3/1 thấp hơn — ghi ở policy).
 * Tên phòng "Lux 1..3", "VIP 1..10" khớp cột lịch booking ("VIP 1 THÁC MÂY"...).
 * Chạy: npx tsx scripts/tmp-create-thacmay.ts
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const SLUG = "thac-may-ta-xua";
const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/10HRllWN2w8f4NadcVh9vCqqyiSIEQ6gQbZQ5nDFgEJA/edit?gid=0#gid=0";

interface RoomDef { name: string; description: string }
interface RtDef {
  name: string;
  weekday: number; // T2–T5
  friSun: number; // T6 & CN
  sat: number; // T7
  holiday: number;
  capacity: number;
  maxCapacity: number | null;
  hasBathtub: boolean;
  amenities: string;
  rooms: RoomDef[];
}

const ROOM_TYPES: RtDef[] = [
  {
    name: "Căn Lux Săn Mây",
    weekday: 1_600_000, friSun: 1_700_000, sat: 2_000_000, holiday: 3_500_000,
    capacity: 2, maxCapacity: 5, hasBathtub: true,
    amenities: "Bồn tắm kính, Rộng 60m2, Điều hòa 2 chiều, Ăn sáng, 1 giường King + 1 sofa bed",
    rooms: [
      { name: "Lux 1", description: "Căn Lux 1 - Panorama Săn Mây · view biển mây & thung lũng" },
      { name: "Lux 2", description: "Căn Lux 2 - Hoàng Hôn Lãng Mạn · trực diện thác mây, biển mây" },
      { name: "Lux 3", description: "Căn Lux 3 - Bình Minh Đỉnh Gió · trực diện thác mây, biển mây" },
    ],
  },
  {
    name: "Phòng VIP có bồn tắm",
    weekday: 1_300_000, friSun: 1_400_000, sat: 1_700_000, holiday: 2_500_000,
    capacity: 4, maxCapacity: 5, hasBathtub: true,
    amenities: "Bồn tắm kính, Rộng 30m2, Điều hòa 2 chiều, Ăn sáng, 2 giường Queen đôi",
    rooms: [
      { name: "VIP 1", description: "VIP 1 Thác Mây · trực diện thác mây, biển mây" },
      { name: "VIP 2", description: "VIP 2 Hoàng Hôn · trực diện thác mây, biển mây" },
      { name: "VIP 3", description: "VIP 3 Đỉnh Gió · trực diện thác mây, biển mây" },
      { name: "VIP 4", description: "VIP 4 Best View · trực diện thác mây, biển mây" },
      { name: "VIP 5", description: "VIP 5 Sơn Tra · trực diện biển mây" },
      { name: "VIP 6", description: "VIP 6 Sa Mộc 1 · trực diện thác mây, biển mây" },
    ],
  },
  {
    name: "Phòng VIP",
    weekday: 1_300_000, friSun: 1_400_000, sat: 1_700_000, holiday: 2_500_000,
    capacity: 4, maxCapacity: 5, hasBathtub: false,
    amenities: "Rộng 30m2, Điều hòa 2 chiều, Ăn sáng, 2 giường Queen đôi",
    rooms: [
      { name: "VIP 7", description: "VIP 7 Sa Mộc 2 · trực diện biển mây" },
      { name: "VIP 8", description: "VIP 8 Sa Mộc 3 · trực diện biển mây" },
      { name: "VIP 9", description: "VIP 9 Sa Mộc 4 · trực diện biển mây" },
    ],
  },
  {
    name: "Phòng VIP gia đình",
    weekday: 1_300_000, friSun: 1_400_000, sat: 1_700_000, holiday: 2_500_000,
    capacity: 6, maxCapacity: 10, hasBathtub: false,
    amenities: "Rộng 50m2, Điều hòa 2 chiều, Ăn sáng, 3 giường Queen đôi",
    rooms: [{ name: "VIP 10", description: "VIP 10 · phòng gia đình 3 giường, trực diện biển mây" }],
  },
];

const SUMMARY =
  "Thác Mây Tà Xùa — Đỉnh Gió: 13 phòng gồm 3 căn Lux 60m2 bồn tắm kính panorama săn mây và 10 phòng VIP 2–3 giường Queen trực diện thác mây, biển mây; kèm nhà hàng ẩm thực Tây Bắc, điều hòa 2 chiều, ăn sáng, wifi.";

const DESCRIPTION = `Thác Mây Tà Xùa nằm tại khu vực Đỉnh Gió — một trong những điểm săn mây đẹp nhất Tà Xùa (cách Đỉnh Gió 0,5km), gồm 13 phòng: 3 căn Lux rộng 60m2 với bồn tắm kính và view panorama biển mây, các phòng VIP rộng 30m2 với 2 giường Queen đôi (VIP 1–6 có bồn tắm kính) và phòng VIP 10 gia đình rộng 50m2 với 3 giường Queen cho nhóm tới 10 khách.

Dịch vụ bao gồm:
- Ăn sáng cho khách lưu trú
- Điều hòa 2 chiều, bình nóng lạnh, wifi toàn khu
- Nhà Hàng Thác Mây tại khu trung tâm: ẩm thực Tây Bắc, mở cửa 6h30–22h00 (đặt trước để giữ bàn view đẹp)
- Show nhạc acoustic tại Cây Hạnh Phúc ngay trong khuôn viên home

Vị trí thuận tiện đi các điểm check-in: Đỉnh Gió Tà Xùa 0,5km · Khe Cải Emei Hill 6km · Sống Lưng Khủng Long, Thảo Nguyên, Cây Cô Đơn, Mỏm Cá Heo ~15km.

Mùa săn mây đẹp nhất: tháng 9 đến tháng 4, biển mây dày đặc từ sáng sớm.`;

const POLICY = `Giá Lễ (Tết Dương lịch 1–2/1/2027): Phòng VIP 2.500.000đ · Căn Lux 3.500.000đ/đêm; ngày 3/1/2027: VIP 1.800.000đ · Lux 2.000.000đ.

Giá phòng theo thứ: T2–T5 giá thường · T6 & Chủ nhật +100.000đ · Thứ 7 giá cuối tuần.

Sức chứa: căn Lux tiêu chuẩn 2 khách (1 giường King + sofa bed, tối đa 5) · phòng VIP tiêu chuẩn 4 khách (2 giường Queen, tối đa 5) · VIP 10 tiêu chuẩn 6 khách (3 giường Queen, tối đa 10).`;

async function main() {
  const existing = await prisma.service.findUnique({ where: { slug: SLUG } });
  if (existing) {
    console.log(`Đã tồn tại service ${SLUG} (${existing.id}) — không tạo lại.`);
    return;
  }

  const service = await prisma.service.create({
    data: {
      slug: SLUG,
      category: "HOMESTAY",
      title: "Thác Mây Tà Xùa",
      summary: SUMMARY,
      description: DESCRIPTION,
      policy: POLICY,
      area: "Đỉnh Gió, Tà Xùa",
      basePrice: 1_300_000,
      priceUnit: "/đêm",
      contactName: "Thác Mây Tà Xùa",
      published: true,
      sheetUrl: SHEET_URL,
    },
  });
  console.log(`Tạo service ${service.title} (${service.id})`);

  let rtSort = 0;
  let roomSort = 0;
  for (const rt of ROOM_TYPES) {
    const roomType = await prisma.roomType.create({
      data: {
        serviceId: service.id,
        name: rt.name,
        capacity: rt.capacity,
        weekdayPrice: rt.weekday,
        weekendPrice: rt.sat,
        priceFri: rt.friSun,
        priceSat: rt.sat,
        priceSun: rt.friSun,
        holidayPrice: rt.holiday,
        totalRooms: rt.rooms.length,
        hasBathtub: rt.hasBathtub,
        cloudView: true,
        breakfast: true,
        airCon: true,
        sortOrder: rtSort++,
      },
    });
    for (const room of rt.rooms) {
      await prisma.room.create({
        data: {
          roomTypeId: roomType.id,
          name: room.name,
          description: room.description,
          amenities: rt.amenities,
          capacity: rt.capacity,
          maxCapacity: rt.maxCapacity,
          listPrice: rt.weekday,
          priceFri: rt.friSun,
          priceSat: rt.sat,
          priceSun: rt.friSun,
          sortOrder: roomSort++,
        },
      });
    }
    console.log(`  + RT "${rt.name}" (${rt.rooms.length} phòng, ${rt.weekday}/${rt.friSun}/${rt.sat}) ${roomType.id}`);
  }
  console.log("Xong.");
}
main().finally(() => prisma.$disconnect());
