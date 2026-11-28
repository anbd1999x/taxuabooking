/**
 * Tạo homestay "Omely Homestay Tà Xùa" theo ảnh bảng giá + tab "Thông tin" của sheet chủ nhà.
 * Giá: listPrice = CN–T5 · priceFri/priceSat = T6–T7. Lễ/Tết = giá T6–7 + 200k (Luxury) / +300k (VIP, Đôi).
 * Chiết khấu CTV 150.000đ/phòng/đêm. Lịch sheet: phòng ở CỘT ("VIP 201", "LUXURY  203", "ĐÔI  303").
 * Chạy: npx tsx --env-file=.env scripts/tmp-create-omely.ts
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const SLUG = "omely-homestay-ta-xua";
const SHEET_URL = "https://docs.google.com/spreadsheets/d/1LsWdONO6tKMLYOVxZ_QUcXgnfpNCzFh8dthB5vBvjbs/edit?gid=0#gid=0";

const BASE = "WC khép kín, Nóng lạnh, Ấm siêu tốc, Máy sấy tóc, Nước lọc, Quạt, Khăn tắm, Bàn chải";

interface RtDef {
  name: string; weekday: number; weekend: number; holiday: number;
  capacity: number; maxCapacity: number; hasBathtub: boolean; amenities: string; desc: string; rooms: string[];
}

const RTS: RtDef[] = [
  {
    name: "Phòng VIP", weekday: 1_100_000, weekend: 1_300_000, holiday: 1_600_000,
    capacity: 2, maxCapacity: 3, hasBathtub: true,
    amenities: `View 3 mặt kính, Bồn tắm view mây full kính, ${BASE}`,
    desc: "Phòng VIP · đón tầm săn mây, 3 mặt kính, bồn tắm view mây · tiêu chuẩn 2, tối đa 3 khách",
    rooms: ["VIP 201", "VIP 206", "VIP 301", "VIP 306"],
  },
  {
    name: "Phòng Luxury", weekday: 850_000, weekend: 950_000, holiday: 1_150_000,
    capacity: 2, maxCapacity: 3, hasBathtub: false,
    amenities: `View kính săn mây, ${BASE}`,
    desc: "Phòng Luxury · 1 mặt kính săn mây, sát thung lũng mây · tiêu chuẩn 2, tối đa 3 khách",
    rooms: ["Luxury 202", "Luxury 203", "Luxury 204", "Luxury 205", "Luxury 302", "Luxury 305"],
  },
  {
    name: "Phòng Đôi", weekday: 1_200_000, weekend: 1_400_000, holiday: 1_700_000,
    capacity: 4, maxCapacity: 6, hasBathtub: false,
    amenities: `2 giường đôi, View kính săn mây, ${BASE}`,
    desc: "Phòng Đôi · rộng rãi, view kính nhìn thẳng biển mây · tiêu chuẩn 4, tối đa 6 khách",
    rooms: ["Đôi 303", "Đôi 304"],
  },
];

const SUMMARY =
  "Omely Homestay Tà Xùa — homestay mới xây ngay khu trung tâm, mọi phòng đều có vách kính săn mây: phòng VIP 3 mặt kính kèm bồn tắm view mây, phòng Luxury sát thung lũng mây, phòng Đôi rộng cho nhóm 4–6 khách; có chỗ đỗ ô tô.";

const DESCRIPTION = `Omely Homestay nằm trong khu vực trung tâm Tà Xùa nên rất thuận tiện săn mây buổi sáng. Có chỗ để xe ô tô, xe khách dịch vụ đón trả tận cửa home.

Các hạng phòng (tất cả làm hoàn toàn mới):
- Phòng VIP (201, 206, 301, 306): 3 mặt kính xung quanh, nằm tầng 2–3 nhìn bao quát cả biển mây và núi; bồn tắm view mây full kính. Tiêu chuẩn 2 khách, tối đa 3.
- Phòng Luxury (202, 203, 204, 205, 302, 305): 1 mặt kính, view nằm trên biển mây, sát và gần thung lũng mây nhất. Tiêu chuẩn 2 khách, tối đa 3.
- Phòng Đôi (303, 304): rộng rãi, thoáng, view nhìn thẳng biển mây. Tiêu chuẩn 4 khách, tối đa 6.

Tiện nghi: WC khép kín, nóng lạnh, ấm siêu tốc, máy sấy, nước lọc, quạt, khăn tắm, bàn chải (điều hoà 2 chiều đang lắp đặt).

Dịch vụ tại home: thuê xe máy, xe cabin đôi và limousine khứ hồi.`;

const POLICY = `Giá theo thứ: Chủ nhật – Thứ 5 giá trong tuần · Thứ 6 – Thứ 7 giá cuối tuần.
Lễ/Tết: phòng Luxury +200.000đ/đêm · phòng VIP và phòng Đôi +300.000đ/đêm.
Phụ thu người vượt tiêu chuẩn: 200.000đ/người/đêm (Luxury & VIP từ người thứ 3, phòng Đôi từ người thứ 5).
Trẻ em dưới 6 tuổi miễn phí, từ 6 tuổi tính như người lớn.
Nhận phòng 14:00 · trả phòng 12:00.
Đặt phòng cọc 50% tiền phòng, 50% còn lại thanh toán khi nhận phòng.
Huỷ lịch: báo trước 20 ngày hoàn 70% cọc · trước 15 ngày hoàn 50% cọc · trước 10 ngày hỗ trợ bảo lưu · trong vòng 7 ngày không bảo lưu, không hoàn cọc. Khách không đi được có thể tự pass phòng hoặc nhờ home pass phòng.`;

async function main() {
  const existing = await prisma.service.findUnique({ where: { slug: SLUG } });
  if (existing) { console.log(`Đã tồn tại ${SLUG} (${existing.id}) — bỏ qua.`); return; }
  const svc = await prisma.service.create({
    data: {
      slug: SLUG, category: "HOMESTAY", title: "Omely Homestay Tà Xùa", summary: SUMMARY, description: DESCRIPTION,
      policy: POLICY, area: "Trung tâm Tà Xùa", basePrice: 850_000, priceUnit: "/đêm",
      contactName: "Omely Homestay", published: true, sheetUrl: SHEET_URL,
      extraPersonFee: 200_000, childFreeUnderAge: 6,
    },
  });
  console.log(`${svc.title} (${svc.id})`);
  let rtSort = 0, roomSort = 0;
  for (const rt of RTS) {
    const roomType = await prisma.roomType.create({
      data: {
        serviceId: svc.id, name: rt.name, capacity: rt.capacity,
        weekdayPrice: rt.weekday, weekendPrice: rt.weekend, priceFri: rt.weekend, priceSat: rt.weekend,
        holidayPrice: rt.holiday, totalRooms: rt.rooms.length,
        hasBathtub: rt.hasBathtub, cloudView: true, sortOrder: rtSort++,
      },
    });
    for (const name of rt.rooms) {
      await prisma.room.create({
        data: {
          roomTypeId: roomType.id, name, description: rt.desc.replace(/^[^·]+/, `${name} `),
          amenities: rt.amenities, capacity: rt.capacity, maxCapacity: rt.maxCapacity,
          listPrice: rt.weekday, priceFri: rt.weekend, priceSat: rt.weekend, holidayPrice: rt.holiday,
          commission: 150_000, sortOrder: roomSort++,
        },
      });
    }
    console.log(`  + ${rt.name}: ${rt.rooms.join(", ")}`);
  }
}
main().finally(() => prisma.$disconnect());
