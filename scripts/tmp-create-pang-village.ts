/**
 * Tạo homestay "Pàng Village Tà Xùa" (Paang Village) từ sheet chủ nhà: ảnh bảng giá + thư
 * mời hợp tác (chính sách CTV) ở tab "Bảng giá phòng lẻ"; lịch theo tháng (phòng ở CỘT).
 * Giá: listPrice = CN–T5 · priceFri/priceSat = T6–T7. Giá Lễ Tết ghi ở policy.
 * Chiết khấu CTV: trong tuần 10% · cuối tuần (T6+T7) 5% (không áp dụng Lễ Tết).
 * Lịch sheet ghi số phòng trần ("101") → phòng tên "Achu 101" có sheetAlias "101".
 * Chạy: npx tsx scripts/tmp-create-pang-village.ts
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const SLUG = "pang-village-ta-xua";
const SHEET_URL = "https://docs.google.com/spreadsheets/d/1cG8uqvcgD3joM34z5UGMIDEhlu-FHc3oEqe2vpxmY40/edit?gid=0#gid=0";

interface RoomDef { name: string; alias?: string; description: string }
interface RtDef {
  name: string; weekday: number; weekend: number; holiday: number;
  capacity: number; maxCapacity: number | null; hasBathtub: boolean; amenities: string; rooms: RoomDef[];
}

const BASE = "Ăn sáng (7–9h), Quạt trần, Đệm sưởi, Máy sấy tóc, Ấm siêu tốc, Trà & nước lọc miễn phí";
const SINGLE = "1 giường 1m8 x 2m";
const DOUBLE = "2 giường 1m6 x 2m";

const RTS: RtDef[] = [
  {
    name: "Achu phòng đôi", weekday: 1_400_000, weekend: 1_600_000, holiday: 2_000_000,
    capacity: 4, maxCapacity: null, hasBathtub: false, amenities: `${DOUBLE}, ${BASE}`,
    rooms: [
      { name: "Achu 101", alias: "101", description: "Achu 101 · tầng 1 · 2 giường 1m6 · tiêu chuẩn 4 khách" },
      { name: "Achu 102", alias: "102", description: "Achu 102 · tầng 1 · 2 giường 1m6 · tiêu chuẩn 4 khách" },
      { name: "Achu 103", alias: "103", description: "Achu 103 · tầng 1 · 2 giường 1m6 · tiêu chuẩn 4 khách" },
      { name: "Achu 201", alias: "201", description: "Achu 201 · tầng 2 · 2 giường 1m6 · tiêu chuẩn 4 khách" },
      { name: "Achu 202", alias: "202", description: "Achu 202 · tầng 2 · 2 giường 1m6 · tiêu chuẩn 4 khách" },
      { name: "Achu 203", alias: "203", description: "Achu 203 · tầng 2 · 2 giường 1m6 · tiêu chuẩn 4 khách" },
    ],
  },
  {
    name: "Achu 204 (bồn tắm)", weekday: 1_600_000, weekend: 1_800_000, holiday: 2_200_000,
    capacity: 4, maxCapacity: null, hasBathtub: true, amenities: `${DOUBLE}, Bồn tắm, ${BASE}`,
    rooms: [{ name: "Achu 204", alias: "204", description: "Achu 204 · tầng 2 · 2 giường 1m6 · có bồn tắm · tiêu chuẩn 4 khách" }],
  },
  {
    name: "Achu phòng đơn", weekday: 1_000_000, weekend: 1_200_000, holiday: 1_400_000,
    capacity: 2, maxCapacity: 3, hasBathtub: false, amenities: `${SINGLE}, ${BASE}`,
    rooms: [{ name: "Achu 104", alias: "104", description: "Achu 104 · tầng 1 · 1 giường 1m8 · tiêu chuẩn 2, tối đa 3 khách" }],
  },
  {
    name: "Sapu phòng đơn view mây", weekday: 1_000_000, weekend: 1_200_000, holiday: 1_400_000,
    capacity: 2, maxCapacity: 3, hasBathtub: false, amenities: `${SINGLE}, View mây qua vách kính, ${BASE}`,
    rooms: [
      { name: "Sapu 1", description: "Sapu 1 · tầng 1 · view 2 mặt kính" },
      ...[2, 3, 4].map((n) => ({ name: `Sapu ${n}`, description: `Sapu ${n} · tầng 1 · view mây qua vách kính` })),
      { name: "Sapu 5", description: "Sapu 5 · tầng 1 · view 2 mặt kính" },
      { name: "Sapu 6", description: "Sapu 6 · tầng 2 · ban công ngắm bình minh, thác mây" },
      ...[7, 8, 9].map((n) => ({ name: `Sapu ${n}`, description: `Sapu ${n} · tầng 2 · view mây qua vách kính` })),
    ],
  },
  {
    name: "Sapu 10 (bồn tắm)", weekday: 1_200_000, weekend: 1_400_000, holiday: 1_600_000,
    capacity: 2, maxCapacity: 3, hasBathtub: true, amenities: `${SINGLE}, Bồn tắm, Ban công hoàng hôn, ${BASE}`,
    rooms: [{ name: "Sapu 10", description: "Sapu 10 · tầng 2 · ban công ngắm hoàng hôn + bồn tắm" }],
  },
];

const SUMMARY =
  "Pàng Village (Paang Village) Tà Xùa — quần thể nhà gỗ giữa vườn hoa tại Bản Cáo A: dãy Achu phòng đôi 4 khách và dãy Sapu phòng đơn view mây qua vách kính, có phòng bồn tắm, ban công hoàng hôn; giá đã gồm ăn sáng.";

const DESCRIPTION = `Pàng Village (Paang Village — "Cloud Paradise") nằm tại cột mốc KM18, đường tỉnh 112, Bản Cáo A, xã Tà Xùa — quần thể nhà gỗ giữa vườn hoa, nhìn ra biển mây.

Các hạng phòng:
- Dãy Achu — phòng đôi (101, 102, 103, 201, 202, 203): 2 giường 1m6 x 2m, tiêu chuẩn 4 khách. Achu 204 có bồn tắm.
- Achu 104 — phòng đơn 1 giường 1m8 x 2m.
- Dãy Sapu — phòng đơn view mây (Sapu 1 – 9): 1 giường 1m8 x 2m, tiêu chuẩn 2 khách, tối đa 3; tầng 1 view kính, tầng 2 có phòng ban công ngắm bình minh, thác mây.
- Sapu 10: ban công ngắm hoàng hôn + bồn tắm.

Tiện nghi: ăn sáng miễn phí (7h – 9h), quạt trần, đệm sưởi, máy sấy tóc, ấm siêu tốc, trà và nước lọc miễn phí. Có khu dịch vụ ăn uống trong khuôn viên.`;

const POLICY = `Giá theo thứ: Chủ nhật – Thứ 5 giá trong tuần · Thứ 6 – Thứ 7 giá cuối tuần. Giá đã gồm VAT và ăn sáng.
Giá Lễ Tết (đ/đêm): Achu 101–103, 201–203: 2.000.000 · Achu 204: 2.200.000 · Achu 104, Sapu 1–9: 1.400.000 · Sapu 10: 1.600.000.
Phòng đơn tiêu chuẩn 2 khách, tối đa 3 (phụ thu người thứ 3). Phòng đôi tiêu chuẩn 4 khách.
Phụ thu: trẻ em 5–12 tuổi 200.000đ/người/đêm (Lễ Tết 300.000đ) · từ 13 tuổi 300.000đ/người/đêm (Lễ Tết 400.000đ). Trẻ dưới 5 tuổi miễn phí.
Đặt cọc 50% giá trị đơn, không hỗ trợ hoàn/huỷ.
Dời lịch: báo trước 5 ngày, tối đa 2 lần, bảo lưu trong 30 ngày.
Giảm số phòng: báo trước 5 ngày, hỗ trợ 1 lần duy nhất; dưới 5 ngày mất 100% tiền cọc của số phòng giảm.`;

function commission(rt: RtDef) {
  const k = (v: number, pct: number) => Math.round((v * pct) / 1000) * 1000;
  return { commission: k(rt.weekday, 0.1), commissionFri: k(rt.weekend, 0.05), commissionSat: k(rt.weekend, 0.05) };
}

async function main() {
  const existing = await prisma.service.findUnique({ where: { slug: SLUG } });
  if (existing) { console.log(`Đã tồn tại ${SLUG} (${existing.id}) — bỏ qua.`); return; }
  const svc = await prisma.service.create({
    data: {
      slug: SLUG, category: "HOMESTAY", title: "Pàng Village Tà Xùa", summary: SUMMARY, description: DESCRIPTION,
      policy: POLICY, area: "Bản Cáo A, Tà Xùa (KM18 ĐT112)", basePrice: 1_000_000, priceUnit: "/đêm",
      contactName: "Paang Village", contactPhone: "0592000555", published: true, sheetUrl: SHEET_URL,
      extraPersonFee: 300_000, childFreeUnderAge: 5,
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
        hasBathtub: rt.hasBathtub, cloudView: true, breakfast: true, heating: true, sortOrder: rtSort++,
      },
    });
    for (const r of rt.rooms) {
      await prisma.room.create({
        data: {
          roomTypeId: roomType.id, name: r.name, sheetAlias: r.alias ?? null, description: r.description,
          amenities: rt.amenities, capacity: rt.capacity, maxCapacity: rt.maxCapacity,
          listPrice: rt.weekday, priceFri: rt.weekend, priceSat: rt.weekend,
          ...commission(rt), sortOrder: roomSort++,
        },
      });
    }
    console.log(`  + ${rt.name}: ${rt.rooms.map((r) => r.name).join(", ")}`);
  }
}
main().finally(() => prisma.$disconnect());
