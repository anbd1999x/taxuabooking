/**
 * Tạo homestay "Dốc Mơ Homestay" (Tà Xùa) theo BẢNG GIÁ + chính sách.
 * Giá KHÁCH TRẢ = giá bảng theo ngày: CN–T5 = giá thường (listPrice) · T6+T7 = priceFri/priceSat.
 * "Chiết khấu" = HOA HỒNG SÀN (đ/phòng/đêm) lưu ở Room.commission* → chủ nhà thực nhận = giá − chiết khấu.
 *   Trong tuần (T2–T6 & CN) = 15% giá đêm đó · Đêm T7 = 10% giá đêm đó.
 * Chạy: npx tsx scripts/tmp-create-docmo.ts
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const SLUG = "doc-mo-homestay";
const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1BmLIx-KwhQ17xaw2YL19D2g_XR9eKWb-/edit?usp=drivesdk";

const r = (n: number) => Math.round(n);

interface RtDef {
  name: string;
  low: number; // CN–T5
  high: number; // T6–T7
  capacity: number;
  maxCapacity: number;
  rooms: string[];
}

// SL / tiêu chuẩn / tối đa / giá theo BẢNG GIÁ DỐC MƠ HOMESTAY.
const ROOM_TYPES: RtDef[] = [
  { name: "Dốc Mơ", low: 599_000, high: 699_000, capacity: 2, maxCapacity: 4, rooms: ["Dốc Mơ"] },
  { name: "Cozy", low: 499_000, high: 599_000, capacity: 2, maxCapacity: 4, rooms: ["Cozy 1", "Cozy 2", "Cozy 3", "Cozy 4", "Cozy 5"] },
  { name: "Sweet", low: 699_000, high: 799_000, capacity: 4, maxCapacity: 5, rooms: ["Sweet 1", "Sweet 2", "Sweet 3"] },
  { name: "Nhà sàn H'mong", low: 2_199_000, high: 2_399_000, capacity: 12, maxCapacity: 12, rooms: ["Nhà sàn H'mong"] },
];

const EXTRA_PERSON_FEE = 200_000; // phụ thu người ≥10 tuổi vượt chuẩn / đêm

const SUMMARY =
  "Dốc Mơ Homestay — \"Nhà trong mây\" Tà Xùa: 10 căn gồm Dốc Mơ, Cozy, Sweet và Nhà sàn H'mong (tới 12 khách). Đệm sưởi ấm áp, bình nóng lạnh, khăn tắm cao cấp, wifi tốc độ cao, view săn mây. Nhận phòng 14h00 – trả phòng 12h00.";

const DESCRIPTION = `Dốc Mơ Homestay – "Nhà trong mây" giữa Tà Xùa, gồm 10 căn:
- Dốc Mơ (1 căn): tiêu chuẩn 2 khách, tối đa 4.
- Cozy (5 căn): tiêu chuẩn 2 khách, tối đa 4.
- Sweet (3 căn): tiêu chuẩn 4 khách, tối đa 5.
- Nhà sàn H'mong (1 căn): cả căn tới 12 khách – hợp đoàn, nhóm bạn.

Tiện ích bao gồm:
- Wifi tốc độ cao miễn phí
- Bình nóng lạnh, khăn tắm cao cấp, máy sấy tóc
- Đệm sưởi ấm áp
- Móc – giá treo đồ, gương đứng, dép đi trong phòng
- Đồ vệ sinh cá nhân (lược, bàn chải, kem đánh răng)
- Nước lọc miễn phí & ấm siêu tốc

Giờ nhận phòng: sau 14h00 · trả phòng: trước 12h00.
Hotline: 0855.117.868.`;

const POLICY = `Bảng giá áp dụng theo số người tiêu chuẩn của từng căn.

Phụ thu quá số người tiêu chuẩn:
- Trẻ em dưới 5 tuổi: miễn phí phụ thu.
- Trẻ em từ 5–10 tuổi: phụ thu 100.000đ/người/đêm.
- Từ 10 tuổi trở lên: phụ thu 200.000đ/người/đêm.

Giờ nhận phòng 14h00 – trả phòng 12h00.`;

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
      title: "Dốc Mơ Homestay",
      summary: SUMMARY,
      description: DESCRIPTION,
      policy: POLICY,
      area: "Tà Xùa, Bắc Yên, Sơn La",
      basePrice: 499_000,
      priceUnit: "/đêm",
      contactName: "Dốc Mơ Homestay",
      contactPhone: "0855117868",
      published: true,
      sheetUrl: SHEET_URL,
    },
  });
  console.log(`Tạo service ${service.title} (${service.id})`);

  let rtSort = 0;
  for (const rt of ROOM_TYPES) {
    const commBase = r(rt.low * 0.15); // T2–T5 & CN = 15% giá thường
    const commFri = r(rt.high * 0.15); // T6 = 15% giá T6–T7
    const commSat = r(rt.high * 0.1); // T7 = 10% giá T6–T7

    const roomType = await prisma.roomType.create({
      data: {
        serviceId: service.id,
        name: rt.name,
        capacity: rt.capacity,
        weekdayPrice: rt.low,
        weekendPrice: rt.high,
        priceSun: rt.low, // CN thuộc nhóm giá thường
        priceFri: rt.high, // T6 thuộc nhóm T6–T7
        priceSat: rt.high, // T7 thuộc nhóm T6–T7
        totalRooms: rt.rooms.length,
        heating: true, // đệm sưởi ấm áp
        cloudView: true, // "Nhà trong mây" — săn mây (anh xác nhận/bỏ nếu căn nào không có)
        hasBathtub: false,
        breakfast: false,
        airCon: false,
        sortOrder: rtSort++,
      },
    });

    let roomSort = 0;
    for (const name of rt.rooms) {
      await prisma.room.create({
        data: {
          roomTypeId: roomType.id,
          name,
          capacity: rt.capacity,
          maxCapacity: rt.maxCapacity,
          listPrice: rt.low, // giá thường (CN–T5); salePrice = null → web KHÔNG gạch giá
          priceFri: rt.high, // T6
          priceSat: rt.high, // T7
          commission: commBase, // hoa hồng nền (T2–T5, CN)
          commissionFri: commFri,
          commissionSat: commSat,
          sortOrder: roomSort++,
        },
      });
    }
    console.log(
      `  + RT "${rt.name}" (${rt.rooms.length} phòng) giá ${rt.low}/${rt.high} · HH nền ${commBase} · T6 ${commFri} · T7 ${commSat} — ${roomType.id}`,
    );
  }
  console.log("Xong tạo service + hạng phòng + phòng.");
}
main().finally(() => prisma.$disconnect());
