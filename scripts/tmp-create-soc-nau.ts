/**
 * Tạo "Sóc Nâu Homestay" theo sheet bảng giá + lịch của chủ nhà
 * (docs.google.com/spreadsheets/d/17kSSHcdFV8Pns6o5Sm-0SMhSMTxyrx7HEqzYg5AhIZg).
 * - Phòng đơn S201–S206 (2, tối đa 3) · Phòng đôi nhà sàn N1–N4 (4, tối đa 6; sheet giá ghi S101–104)
 *   · Bungalow 1–9 (2, tối đa 3) · VIP 1, VIP 2 (2, tối đa 3).
 * - Giá: CN–Thứ 6 / Thứ 7 / Ngày lễ. Phụ thu 200k/người; trẻ dưới 4 tuổi miễn phí. Không chiết khấu.
 * Chạy: npx tsx scripts/tmp-create-soc-nau.ts   (DATABASE_URL theo .env = prod)
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const SLUG = "soc-nau-homestay-ta-xua";
const TITLE = "Sóc Nâu Homestay";
const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/17kSSHcdFV8Pns6o5Sm-0SMhSMTxyrx7HEqzYg5AhIZg/edit?gid=626530984#gid=626530984";
const COMMON = "Phòng khép kín, Máy sấy tóc, Ấm siêu tốc, Khăn tắm, Sữa tắm, Dầu gội";

type R = { name: string; alias?: string; note?: string };
type T = {
  name: string;
  capacity: number;
  max: number;
  weekday: number;
  sat: number;
  holiday: number;
  airCon?: boolean;
  bed: string;
  amenities: string;
  rooms: R[];
};
const TYPES: T[] = [
  {
    name: "Phòng đơn",
    capacity: 2,
    max: 3,
    weekday: 300_000,
    sat: 750_000,
    holiday: 900_000,
    bed: "1 giường 1m8×2m",
    amenities: `Giường 1m8×2m, ${COMMON}`,
    rooms: ["S201", "S202", "S203", "S204", "S205", "S206"].map((name) => ({ name })),
  },
  {
    name: "Phòng đôi nhà sàn",
    capacity: 4,
    max: 6,
    weekday: 700_000,
    sat: 1_100_000,
    holiday: 1_400_000,
    bed: "2 giường 1m8×2m",
    amenities: `2 giường 1m8×2m, ${COMMON}`,
    rooms: [1, 2, 3, 4].map((i) => ({ name: `Nhà sàn N${i}`, alias: `N${i}, S10${i}` })),
  },
  {
    name: "Bungalow",
    capacity: 2,
    max: 3,
    weekday: 700_000,
    sat: 1_100_000,
    holiday: 1_400_000,
    airCon: true,
    bed: "1 giường 1m8×2m",
    amenities: `Giường 1m8×2m, Điều hoà 2 chiều, Ban công, ${COMMON}`,
    rooms: [
      { name: "Bungalow 1", note: "2 mặt kính" },
      { name: "Bungalow 2" },
      { name: "Bungalow 3", note: "2 mặt kính" },
      { name: "Bungalow 4" },
      { name: "Bungalow 5", note: "2 mặt kính" },
      { name: "Bungalow 6", note: "2 mặt kính, tầng 1, không ban công" },
      { name: "Bungalow 7", note: "2 mặt kính, tầng 2" },
      { name: "Bungalow 8", note: "tầng 2" },
      { name: "Bungalow 9", note: "tầng 1, không ban công" },
    ].map((r) => ({ ...r, alias: r.name.replace("Bungalow", "Bung") })),
  },
  {
    name: "Phòng VIP",
    capacity: 2,
    max: 3,
    weekday: 800_000,
    sat: 1_200_000,
    holiday: 1_500_000,
    bed: "1 giường",
    amenities: COMMON,
    rooms: [
      { name: "VIP 1", alias: "VIP I, VIP1" },
      { name: "VIP 2", alias: "VIP II, VIP2" },
    ],
  },
];

const fmt = (n: number) => n.toLocaleString("vi-VN") + "đ";
const priceLines = TYPES.map(
  (t) =>
    `- ${t.name} (${t.capacity} khách, tối đa ${t.max}): CN–Thứ 6 ${fmt(t.weekday)} · Thứ 7 ${fmt(t.sat)} · Ngày lễ ${fmt(t.holiday)}`,
).join("\n");

async function main() {
  const existing = await prisma.service.findFirst({
    where: { OR: [{ slug: SLUG }, { title: { contains: "Sóc Nâu", mode: "insensitive" } }] },
    select: { id: true, slug: true, title: true },
  });
  if (existing) {
    console.log(`Đã có "${existing.title}" (${existing.slug}, ${existing.id}) — không tạo trùng.`);
    return;
  }
  const svc = await prisma.service.create({
    data: {
      slug: SLUG,
      category: "HOMESTAY",
      title: TITLE,
      summary:
        "Sóc Nâu Homestay Tà Xùa — 21 phòng riêng khép kín: phòng đơn giá từ 300.000đ/đêm, phòng đôi nhà sàn cho nhóm 4–6 người, khu bungalow có điều hoà 2 chiều và ban công, phòng VIP.",
      description: `Sóc Nâu Homestay là homestay phòng riêng ở Tà Xùa với nhiều hạng phòng cho cả cặp đôi lẫn nhóm bạn, gia đình. Tất cả phòng đều khép kín, có máy sấy tóc, ấm siêu tốc, khăn tắm, sữa tắm và dầu gội.

Home có 21 phòng:
- **Phòng đơn** (S201 – S206): 1 giường 1m8×2m, tiêu chuẩn 2 khách, tối đa 3 khách.
- **Phòng đôi nhà sàn** (N1 – N4): 2 giường 1m8×2m, tiêu chuẩn 4 khách, tối đa 6 khách.
- **Bungalow** (1 – 9): 1 giường 1m8×2m, điều hoà 2 chiều, ban công (bungalow 6 và 9 không có ban công); bungalow 1, 3, 5, 6, 7 có 2 mặt kính. Tiêu chuẩn 2 khách, tối đa 3 khách.
- **Phòng VIP** (VIP 1, VIP 2): tiêu chuẩn 2 khách, tối đa 3 khách.

Giá phòng ngày thường áp dụng từ Chủ nhật đến Thứ 6; Thứ 7 và ngày lễ có giá riêng.`,
      policy: `Giá phòng (theo số khách tiêu chuẩn, chưa gồm phụ thu thêm người):
${priceLines}

Phụ thu:
- Trẻ em dưới 4 tuổi: miễn phí.
- Phòng đơn, bungalow, VIP: tiêu chuẩn 2 khách, tối đa 3 khách — phụ thu 200.000đ/người từ người thứ 3.
- Phòng đôi nhà sàn: tiêu chuẩn 4 khách, tối đa 6 khách — phụ thu 200.000đ/người từ người thứ 5.

Hoàn – huỷ:
- Homestay không hoàn – huỷ.
- Bảo lưu cọc trong vòng 30 ngày; khách muốn bảo lưu, chuyển lịch cần báo trước 5 ngày. Thời điểm đi mới tính theo giá hiện hành.
- Trường hợp bất khả kháng (thiên tai, bão lũ, dịch bệnh, sức khoẻ của khách có chẩn đoán của cơ sở y tế…): bảo lưu trong 30 ngày, thời điểm đi mới tính theo giá hiện hành.`,
      area: "Tà Xùa",
      basePrice: Math.min(...TYPES.map((t) => t.weekday)),
      priceUnit: "/đêm",
      contactName: TITLE,
      published: true,
      extraPersonFee: 200_000,
      childFreeUnderAge: 4,
      sheetUrl: SHEET_URL,
    },
  });

  let sort = 0;
  for (const [ti, t] of TYPES.entries()) {
    const rt = await prisma.roomType.create({
      data: {
        serviceId: svc.id,
        name: t.name,
        capacity: t.capacity,
        weekdayPrice: t.weekday,
        weekendPrice: t.sat,
        holidayPrice: t.holiday,
        priceSat: t.sat,
        priceSun: t.weekday,
        totalRooms: t.rooms.length,
        airCon: !!t.airCon,
        sortOrder: ti,
      },
    });
    for (const r of t.rooms) {
      await prisma.room.create({
        data: {
          roomTypeId: rt.id,
          name: r.name,
          sheetAlias: r.alias ?? null,
          description: `${t.name}${r.note ? ` (${r.note})` : ""} · ${t.bed} · tiêu chuẩn ${t.capacity} khách, tối đa ${t.max} khách (phụ thu 200.000đ/người) · Ngày lễ ${fmt(t.holiday)}/đêm`,
          amenities: r.note?.includes("không ban công") ? t.amenities.replace("Ban công, ", "") : t.amenities,
          capacity: t.capacity,
          maxCapacity: t.max,
          listPrice: t.weekday, // CN–Thứ 6
          priceSat: t.sat,
          commission: 0, // chủ nhà: không chiết khấu
          sortOrder: sort++,
        },
      });
    }
    console.log(`  ${t.name}: ${t.rooms.map((r) => r.name).join(", ")}`);
  }
  console.log(`Đã tạo ${TITLE} — id ${svc.id}, slug ${SLUG}`);
}
main().finally(() => prisma.$disconnect());
