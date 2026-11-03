/**
 * Tạo homestay "Mây Hạ Retreat" + 5 hạng phòng + 17 phòng từ sheet bảng giá.
 * Giá áp dụng 1/11/2026–31/3/2027: T2–T6 + CN = listPrice · Thứ 7 = priceSat.
 * Giá lễ ghi trong policy. Chiết khấu CTV 100k/phòng (VIP 1–2: T7/lễ 150k).
 * Chạy: npx tsx scripts/tmp-create-mayha.ts
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const SLUG = "may-ha-retreat";
const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1-BGnlbNLZfKHQnRJPOUEydXJyCWcy1fD8_XB4FcyjyE/edit?gid=1486653852#gid=1486653852";

interface RtDef {
  name: string;
  weekday: number;
  sat: number;
  holiday: number;
  capacity: number;
  maxCapacity: number | null;
  commission: number;
  commissionSat?: number;
  rooms: string[];
}

const ROOM_TYPES: RtDef[] = [
  {
    name: "Phòng đơn tầng 1",
    weekday: 600_000, sat: 950_000, holiday: 1_200_000,
    capacity: 2, maxCapacity: 3, commission: 100_000,
    rooms: ["Phòng 101", "Phòng 102", "Phòng 103"],
  },
  {
    name: "Phòng đơn tầng 2",
    weekday: 600_000, sat: 950_000, holiday: 1_200_000,
    capacity: 2, maxCapacity: 3, commission: 100_000,
    rooms: ["Phòng 201", "Phòng 202", "Phòng 203", "Phòng 205", "Phòng 206"],
  },
  {
    name: "Phòng đôi VIP",
    weekday: 900_000, sat: 1_400_000, holiday: 1_600_000,
    capacity: 4, maxCapacity: null, commission: 100_000, commissionSat: 150_000,
    rooms: ["VIP 1", "VIP 2"],
  },
  {
    name: "Bungalow VIP 2 mặt kính",
    weekday: 800_000, sat: 1_300_000, holiday: 1_600_000,
    capacity: 2, maxCapacity: 3, commission: 100_000,
    rooms: ["VIP 3", "VIP 5", "VIP 6", "VIP 7", "VIP 8"],
  },
  {
    name: "Bungalow VIP 1 mặt kính",
    weekday: 800_000, sat: 1_200_000, holiday: 1_500_000,
    capacity: 2, maxCapacity: 3, commission: 100_000,
    rooms: ["VIP 9", "VIP 10"],
  },
];

const SUMMARY =
  "Mây Hạ Retreat — Tà Xùa: phòng đơn tiêu chuẩn 2 khách wc khép kín, phòng đôi VIP 4 khách và khu bungalow VIP 1–2 mặt kính; điều hòa 2 chiều, giường 1.8m×2m, wifi toàn khu.";

const DESCRIPTION = `Mây Hạ Retreat gồm khu phòng đơn (tầng 1 & tầng 2) tiêu chuẩn 2 khách, phòng đôi VIP tiêu chuẩn 4 khách và khu bungalow VIP thiết kế 1–2 mặt kính ngắm mây.

Dịch vụ bao gồm:
- Phòng nghỉ theo tiêu chuẩn, kích thước giường 1.8m × 2.0m
- Trà, nước lọc miễn phí trong phòng
- Bàn chải đánh răng, sữa tắm...
- Trang thiết bị: ấm siêu tốc, máy sấy, quạt điện, ĐIỀU HÒA 2 CHIỀU, bình nóng lạnh, dép...
- Wifi trong khu vực homestay

Giờ nhận phòng: check-in sau 14h00 · check-out trước 12h00. Nếu còn phòng trống, hỗ trợ nhận sớm/trả muộn: nhận phòng 7h–10h phụ thu 200k/phòng, 10h–12h phụ thu 100k/phòng.

Xe khứ hồi 500k/người.

Giờ làm việc: 7h00–22h00 (hỗ trợ ngoài khung giờ vui lòng báo trước). Xuất trình giấy tờ tùy thân (CCCD hoặc VNeID) khi nhận phòng.`;

const POLICY = `Giá Lễ: Phòng đơn 1.200.000đ · Phòng đôi VIP 1.600.000đ · Bungalow VIP 2 mặt kính 1.600.000đ · Bungalow VIP 1 mặt kính 1.500.000đ/đêm.

Phụ thu quá tiêu chuẩn 200k/khách — ngày Lễ phụ thu 300k/người. Miễn phí 1 bé dưới 6 tuổi/phòng, từ bé thứ 2 phụ thu như người lớn.

Cuối tuần book cặp T6+T7 hoặc T7+CN — không bán lẻ đêm thứ 7.

Đặt cọc: CTV/khách cọc trước tối thiểu 50%, còn lại thanh toán khi nhận phòng.

Quy định hoàn/hủy:
- Không hoàn/hủy cọc.
- Hỗ trợ bảo lưu cọc, dời lịch khi báo trước 7 ngày; bảo lưu trong 30 ngày, giá phòng tính theo thời điểm ngày đi; chỉ hỗ trợ dời lịch 1 lần; dời quá 30 ngày tính phí 200k/phòng.
- Thiên tai, bão lũ: bảo lưu cọc 30 ngày (báo trước 2 ngày).
- Phòng Lễ, Tết không hoàn - hủy - dời.

Nội quy: không hút thuốc trong phòng; không mang đồ ăn nặng mùi (sầu riêng, măng cụt...); không mang thú cưng; không tự ý di chuyển đồ đạc; không sử dụng chất cấm.`;

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
      title: "Mây Hạ Retreat",
      summary: SUMMARY,
      description: DESCRIPTION,
      policy: POLICY,
      area: "Tà Xùa",
      basePrice: 600_000,
      priceUnit: "/đêm",
      contactName: "Mây Hạ Retreat",
      contactPhone: "0962863412",
      mapUrl: "https://maps.app.goo.gl/NZvQpFU2PXkVwuGN7",
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
        priceSat: rt.sat,
        holidayPrice: rt.holiday,
        totalRooms: rt.rooms.length,
        airCon: true,
        sortOrder: rtSort++,
      },
    });
    for (const name of rt.rooms) {
      await prisma.room.create({
        data: {
          roomTypeId: roomType.id,
          name,
          capacity: rt.capacity,
          maxCapacity: rt.maxCapacity,
          extraPersonFee: 200_000,
          listPrice: rt.weekday,
          priceSat: rt.sat,
          commission: rt.commission,
          commissionSat: rt.commissionSat ?? undefined,
          sortOrder: roomSort++,
        },
      });
    }
    console.log(`  + RT "${rt.name}" (${rt.rooms.length} phòng, ${rt.weekday}/${rt.sat}) ${roomType.id}`);
  }
  console.log("Xong.");
}
main().finally(() => prisma.$disconnect());
