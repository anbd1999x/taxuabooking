/**
 * Tạo 2 homestay "Haus Meej Tà Xùa" + "Happy Town Tà Xùa" từ sheet chung
 * (tab "Bảng Giá" + tab lịch theo tháng, cột KHU phân biệt 2 home).
 * Giá: listPrice = trong tuần (CN–T5) · priceFri/priceSat = cuối tuần (T6–T7).
 * Chiết khấu CTV: Haus Meej 100k/phòng/đêm; Happy Town: Táo 100k, Lều Cam & Bungalow Happy 0.
 * Chạy: npx tsx scripts/tmp-create-hausmeej-happytown.ts
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const SHEET_URL = "https://docs.google.com/spreadsheets/d/1FDsf_vrdLq0746jJH_JAzCCf-pFlAlpZwPtLQQexc-0/htmlview";
const HOTLINE = "0355303689";

interface RoomDef { name: string; weekday: number; weekend: number; capacity: number; maxCapacity: number | null; description: string }
interface RtDef { name: string; amenities: string; commission: number | null; cloudView: boolean; rooms: RoomDef[] }
interface HomeDef { slug: string; title: string; area: string; summary: string; description: string; policy: string; roomTypes: RtDef[] }

const NOTES = `Nhận phòng 13:00 · Trả phòng 11:00. Xuất trình giấy tờ tùy thân (ảnh CCCD hoặc VNeID) khi nhận phòng.
Giá theo thứ: Chủ nhật – Thứ 5 giá trong tuần · Thứ 6 – Thứ 7 giá cuối tuần.
Phụ thu người thêm (extra): 150.000đ/người/đêm. Trẻ dưới 6 tuổi không thu extra.
Check-in sớm (7:00 – 10:00): phụ thu 200.000đ/phòng — gọi hotline ${HOTLINE} để kiểm tra phòng trống.
Đặt phòng thanh toán 100% tiền phòng. Hoàn cọc trong 24h; sau 24h huỷ phòng không hoàn cọc.
Dời lịch: báo trước tối thiểu 1 tuần · bảo lưu cọc 1 tháng · tuỳ tình trạng phòng · tối đa 2 lần/booking · giá cập nhật theo thời điểm dời.
Giờ làm việc lễ tân 7:00 – 22:00 (ngoài giờ vui lòng báo trước).
CẤM mang thú cưng vào phòng.`;

const OFFER = `Ưu đãi: giảm 10% ăn uống tại Happy Town (không áp dụng Thứ 7 và ngày lễ) · voucher giảm 10% cà phê tại quán cafe Haus Meej Đỉnh Gió (đọc pass: "Hầu Mênh nghĩa là uống cạn").`;

const HAUS: HomeDef = {
  slug: "haus-meej-ta-xua",
  title: "Haus Meej Tà Xùa",
  area: "Đỉnh Gió, Tà Xùa",
  summary: "Haus Meej Tà Xùa — homestay kèm quán cafe Haus Meej tại Đỉnh Gió: phòng Sunset ngắm hoàng hôn, 4 phòng Mountain View và phòng Panorama view toàn cảnh; nhiều phòng kê thêm giường cho tối đa 4 khách.",
  description: `Haus Meej Tà Xùa nằm tại khu Đỉnh Gió, Tà Xùa, ngay cạnh quán cafe Haus Meej.

Các hạng phòng:
- Sunset (SS01, SS02): phòng đôi cho 2 khách, ngắm hoàng hôn.
- Mountain View (MV1 – MV4): phòng view núi cho 2 khách; MV1 và MV3 kê thêm sofa bed/giường phụ cho tối đa 4 khách.
- Panorama: phòng view toàn cảnh, tiêu chuẩn 2 khách, tối đa 4 khách.

${OFFER}`,
  policy: NOTES,
  roomTypes: [
    {
      name: "Sunset", amenities: "Phòng đôi, View hoàng hôn", commission: 100_000, cloudView: true,
      rooms: ["SS01", "SS02"].map((n) => ({ name: n, weekday: 700_000, weekend: 900_000, capacity: 2, maxCapacity: null, description: `Phòng Sunset ${n} · 2 khách · ngắm hoàng hôn` })),
    },
    {
      name: "Mountain View", amenities: "View núi", commission: 100_000, cloudView: true,
      rooms: [
        { name: "MV1", weekday: 800_000, weekend: 1_000_000, capacity: 2, maxCapacity: 4, description: "Phòng MV1 · tiêu chuẩn 2 khách · kê thêm giường tối đa 4 khách" },
        { name: "MV2", weekday: 800_000, weekend: 1_000_000, capacity: 2, maxCapacity: null, description: "Phòng MV2 · 2 khách · view núi" },
        { name: "MV3", weekday: 900_000, weekend: 1_100_000, capacity: 2, maxCapacity: 4, description: "Phòng MV3 · tiêu chuẩn 2 khách · kê thêm giường tối đa 4 khách" },
        { name: "MV4", weekday: 800_000, weekend: 1_000_000, capacity: 2, maxCapacity: null, description: "Phòng MV4 · 2 khách · view núi" },
      ],
    },
    {
      name: "Panorama", amenities: "View toàn cảnh (panorama)", commission: 100_000, cloudView: true,
      rooms: [{ name: "Panorama", weekday: 1_200_000, weekend: 1_400_000, capacity: 2, maxCapacity: 4, description: "Phòng Panorama · view toàn cảnh · tiêu chuẩn 2 khách, tối đa 4 khách" }],
    },
  ],
};

const HAPPY: HomeDef = {
  slug: "happy-town-ta-xua",
  title: "Happy Town Tà Xùa",
  area: "Tà Xùa",
  summary: "Happy Town Tà Xùa — khu lưu trú vui nhộn với 7 phòng Táo, lều Cam cắm trại cho nhóm 4 người và bungalow Happy giá chỉ từ 200.000đ; có dịch vụ ăn uống tại chỗ.",
  description: `Happy Town Tà Xùa là khu lưu trú nhiều lựa chọn, hợp cả cặp đôi lẫn nhóm bạn và khách đi tour.

Các hạng phòng:
- Táo (Táo 1 – Táo 7): phòng tiêu chuẩn 2 khách, kê thêm sofa bed/giường phụ cho tối đa 4 khách.
- Lều Cam (2 lều): lều cắm trại cho tối đa 4 người, không thu extra.
- Bungalow Happy (6 bungalow tầng trên/dưới): cho 1–2 khách, giá tiết kiệm, không thu extra.

${OFFER}`,
  policy: NOTES + "\nLều Cam và bungalow Happy không thu extra.",
  roomTypes: [
    {
      name: "Táo", amenities: "Tiêu chuẩn 2 khách, Sofa bed / giường phụ", commission: 100_000, cloudView: false,
      rooms: [1, 2, 3, 4, 5, 6, 7].map((n) => ({ name: `Táo ${n}`, weekday: 700_000, weekend: 1_000_000, capacity: 2, maxCapacity: 4, description: `Phòng Táo ${n} · tiêu chuẩn 2 khách · tối đa 4 khách` })),
    },
    {
      name: "Lều Cam", amenities: "Lều cắm trại, Tối đa 4 người, Không thu extra", commission: null, cloudView: false,
      rooms: [1, 2].map((n) => ({ name: `Lều Cam ${n}`, weekday: 300_000, weekend: 400_000, capacity: 4, maxCapacity: null, description: `Lều Cam ${n} · lều cắm trại cho tối đa 4 người` })),
    },
    {
      name: "Bungalow Happy", amenities: "Bungalow 1–2 khách, Không thu extra", commission: null, cloudView: false,
      rooms: ["Bun 1 trên", "Bun 2 trên", "Bun 3 trên", "Bun 1 dưới", "Bun 2 dưới", "Bun 3 dưới"].map((n) => ({ name: n, weekday: 200_000, weekend: 200_000, capacity: 2, maxCapacity: null, description: `Bungalow Happy · ${n} · 1–2 khách` })),
    },
  ],
};

async function createHome(h: HomeDef) {
  const existing = await prisma.service.findUnique({ where: { slug: h.slug } });
  if (existing) { console.log(`Đã tồn tại ${h.slug} (${existing.id}) — bỏ qua.`); return; }
  const minPrice = Math.min(...h.roomTypes.flatMap((rt) => rt.rooms.map((r) => r.weekday)));
  const svc = await prisma.service.create({
    data: {
      slug: h.slug, category: "HOMESTAY", title: h.title, summary: h.summary, description: h.description,
      policy: h.policy, area: h.area, basePrice: minPrice, priceUnit: "/đêm",
      contactName: h.title, contactPhone: HOTLINE, published: true, sheetUrl: SHEET_URL,
      extraPersonFee: 150_000, earlyCheckinFee: 200_000, childFreeUnderAge: 6,
    },
  });
  console.log(`\n${svc.title} (${svc.id})`);
  let rtSort = 0, roomSort = 0;
  for (const rt of h.roomTypes) {
    const r0 = rt.rooms[0];
    const roomType = await prisma.roomType.create({
      data: {
        serviceId: svc.id, name: rt.name, capacity: r0.capacity,
        weekdayPrice: r0.weekday, weekendPrice: r0.weekend, priceFri: r0.weekend, priceSat: r0.weekend,
        totalRooms: rt.rooms.length, cloudView: rt.cloudView, sortOrder: rtSort++,
      },
    });
    for (const r of rt.rooms) {
      await prisma.room.create({
        data: {
          roomTypeId: roomType.id, name: r.name, description: r.description, amenities: rt.amenities,
          capacity: r.capacity, maxCapacity: r.maxCapacity,
          listPrice: r.weekday, priceFri: r.weekend, priceSat: r.weekend,
          commission: rt.commission, sortOrder: roomSort++,
        },
      });
    }
    console.log(`  + ${rt.name}: ${rt.rooms.map((r) => r.name).join(", ")}`);
  }
}

async function main() {
  await createHome(HAUS);
  await createHome(HAPPY);
}
main().finally(() => prisma.$disconnect());
