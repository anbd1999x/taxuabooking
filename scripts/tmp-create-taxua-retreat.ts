/**
 * Tạo homestay "Tà Xùa Retreat" từ sheet chủ nhà
 * https://docs.google.com/spreadsheets/d/1sxvgAE8YvSkRfQAiwTv_h0FE2n6mM0sGe6YJuTqkZ-A (tab "Bảng Giá Phòng"
 * = ảnh bảng giá + ảnh chính sách CTV; các tab "Tháng MM.YYYY" = lịch phòng).
 * Chỉ tạo các phòng CÓ GIÁ trong bảng giá: Bun 1–3, Vườn Mây 1–3, Ban Mai 1–3 (tên khớp cột lịch).
 * Nhà sàn 201–203, An Nhiên, Mộc Nhiên có cột lịch nhưng chưa có giá/ảnh → chưa tạo.
 * Giá: listPrice = CN–T6 · priceSat = T7 · Lễ Tết ghi trong chính sách (hệ thống chưa có lịch lễ).
 * Chiết khấu: 10% giá niêm yết, mọi ngày (cả T7).
 * Chạy: npx tsx scripts/tmp-create-taxua-retreat.ts   (DATABASE_URL theo .env)
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const SLUG = "ta-xua-retreat";
const TITLE = "Tà Xùa Retreat";
const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1sxvgAE8YvSkRfQAiwTv_h0FE2n6mM0sGe6YJuTqkZ-A/edit?gid=1116163727#gid=1116163727";

interface RoomDef { name: string; capacity: number; week: number; sat: number; holiday: number; description: string }
interface TypeDef { name: string; rooms: RoomDef[] }

const BASE_AMENITIES = "Ăn sáng tiêu chuẩn, Nước suối miễn phí trong phòng";
const TYPES: TypeDef[] = [
  {
    name: "Bungalow",
    rooms: [
      { name: "Bun 1", capacity: 4, week: 1_300_000, sat: 1_700_000, holiday: 1_900_000, description: "Bungalow 1 · tiêu chuẩn 4 khách · đã gồm ăn sáng" },
      { name: "Bun 2", capacity: 2, week: 800_000, sat: 1_100_000, holiday: 1_500_000, description: "Bungalow 2 · bungalow view · tiêu chuẩn 2 khách · đã gồm ăn sáng" },
      { name: "Bun 3", capacity: 2, week: 800_000, sat: 1_100_000, holiday: 1_500_000, description: "Bungalow 3 · bungalow view · tiêu chuẩn 2 khách · đã gồm ăn sáng" },
    ],
  },
  {
    name: "Vườn Mây",
    rooms: [1, 2, 3].map((n) => ({
      name: `Vườn Mây ${n}`, capacity: 2, week: 1_000_000, sat: 1_400_000, holiday: 1_800_000,
      description: `Phòng Vườn Mây ${n} · tiêu chuẩn 2 khách · đã gồm ăn sáng`,
    })),
  },
  {
    name: "Ban Mai",
    rooms: [1, 2, 3].map((n) => ({
      name: `Ban Mai ${n}`, capacity: 2, week: 1_000_000, sat: 1_400_000, holiday: 1_800_000,
      description: `Phòng Ban Mai ${n} · tiêu chuẩn 2 khách · đã gồm ăn sáng`,
    })),
  },
];
const pct10 = (v: number) => Math.round((v * 0.1) / 1000) * 1000;

async function main() {
  const existing = await prisma.service.findFirst({
    where: { OR: [{ slug: SLUG }, { title: { equals: TITLE, mode: "insensitive" } }] },
    select: { id: true, slug: true, title: true },
  });
  if (existing) {
    console.log(`Đã có homestay "${existing.title}" (${existing.slug}, ${existing.id}) — không tạo trùng.`);
    return;
  }
  const svc = await prisma.service.create({
    data: {
      slug: SLUG,
      category: "HOMESTAY",
      title: TITLE,
      summary:
        "Tà Xùa Retreat — homestay với 3 bungalow (có căn 4 khách cho gia đình), phòng Vườn Mây và Ban Mai cho cặp đôi; giá đã gồm ăn sáng, miễn phí nước suối trong phòng.",
      description: `Tà Xùa Retreat có các hạng phòng:
- Bungalow: Bun 1 tiêu chuẩn 4 khách (hợp gia đình/nhóm nhỏ); Bun 2 và Bun 3 bungalow view cho 2 khách.
- Vườn Mây (3 phòng): phòng đôi tiêu chuẩn 2 khách.
- Ban Mai (3 phòng): phòng đôi tiêu chuẩn 2 khách.

Giá phòng đã bao gồm ăn sáng tiêu chuẩn, miễn phí nước suối trong phòng.`,
      policy: `Giá phòng theo ngày: Chủ nhật – Thứ 6 giá thường · Thứ 7 giá cuối tuần · Lễ Tết giá riêng.
Bảng giá (đêm/phòng): Bun 1 (4 khách): 1.300.000 / T7 1.700.000 / Lễ Tết 1.900.000 · Bun 2, Bun 3 (2 khách): 800.000 / T7 1.100.000 / Lễ Tết 1.500.000 · Vườn Mây, Ban Mai (2 khách): 1.000.000 / T7 1.400.000 / Lễ Tết 1.800.000.
Giá phòng đã bao gồm ăn sáng tiêu chuẩn. Miễn phí nước suối trong phòng.
Phụ thu quá số người tiêu chuẩn: Vườn Mây, Ban Mai 300.000đ/khách (Lễ Tết 500.000đ) · Bungalow 200.000đ/khách (Lễ Tết 400.000đ). Miễn phí phụ thu trẻ em dưới 6 tuổi.
Homestay không hỗ trợ hoàn huỷ. Khách rời lịch vui lòng báo trước 5 ngày, được bảo lưu trong 30 ngày.`,
      area: "Tà Xùa",
      basePrice: 800_000,
      priceUnit: "/đêm",
      contactName: TITLE,
      published: true,
      sheetUrl: SHEET_URL,
      childFreeUnderAge: 6,
    },
  });
  let rtSort = 0;
  let roomSort = 0;
  for (const t of TYPES) {
    const r0 = t.rooms[0];
    const rt = await prisma.roomType.create({
      data: {
        serviceId: svc.id,
        name: t.name,
        capacity: r0.capacity,
        weekdayPrice: r0.week,
        weekendPrice: r0.sat,
        holidayPrice: r0.holiday,
        priceSat: r0.sat,
        totalRooms: t.rooms.length,
        breakfast: true,
        sortOrder: rtSort++,
      },
    });
    for (const r of t.rooms) {
      await prisma.room.create({
        data: {
          roomTypeId: rt.id,
          name: r.name,
          description: r.description,
          amenities: BASE_AMENITIES,
          capacity: r.capacity,
          listPrice: r.week,
          priceSat: r.sat,
          // Chiết khấu TA/CTV 10% giá niêm yết, áp dụng mọi ngày.
          commission: pct10(r.week),
          commissionSat: pct10(r.sat),
          sortOrder: roomSort++,
        },
      });
    }
    console.log(`  + ${t.name}: ${t.rooms.map((r) => r.name).join(", ")}`);
  }
  console.log(`Đã tạo ${TITLE} (${svc.id})`);
}
main().finally(() => prisma.$disconnect());
