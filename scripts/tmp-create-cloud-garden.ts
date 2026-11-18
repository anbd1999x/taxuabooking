/**
 * Tạo "Cloud Garden" theo booking engine của chủ nhà (https://cloudgarden.hotelss.vn).
 * - Hạng phòng, tiện ích, giá niêm yết lấy từ API be_get_room_types / be_get_availability
 *   (giá đồng đều mọi ngày trong 14 tuần tới tại thời điểm tạo).
 * - TÊN HẠNG PHÒNG phải trùng room_type_name của API — sheet-sync (nguồn hotelss) khớp lịch theo tên hạng.
 * - Chiết khấu CTV: Thứ 7 10%, các ngày còn lại 20% trên giá niêm yết.
 * Chạy: npx tsx scripts/tmp-create-cloud-garden.ts   (DATABASE_URL theo .env = prod)
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const SLUG = "cloud-garden-ta-xua";
const TITLE = "Cloud Garden";
const CALENDAR_URL = "https://cloudgarden.hotelss.vn/?building_id=" + encodeURIComponent("vo/+yN7I1FczUlPmwLWl9w==");
const FREE = "Mỳ cốc & nước lọc miễn phí";

type T = {
  name: string; // = room_type_name của API
  label: string;
  price: number;
  capacity: number;
  max: number;
  where?: string;
  bed: string;
  amenities: string;
  airCon?: boolean;
  heating?: boolean;
  rooms: string[];
};
const TYPES: T[] = [
  {
    name: "Standard",
    label: "Phòng Standard",
    price: 700_000,
    capacity: 2,
    max: 3,
    where: "Tầng 2 nhà điều hành",
    bed: "giường 2m7×2m",
    amenities: `Giường 2m7×2m, Điều hoà, Nóng lạnh, Nệm sưởi, Ấm siêu tốc, Máy sấy tóc, ${FREE}`,
    airCon: true,
    heating: true,
    rooms: ["Star 1", "Star 2"],
  },
  {
    name: "Nature Bungalow",
    label: "Nature Bungalow",
    price: 800_000,
    capacity: 2,
    max: 3,
    where: "Khu sinh thái vườn đào",
    bed: "1 nệm 1m8×2m",
    amenities: `Nệm 1m8×2m, Điều hoà 2 chiều, Nóng lạnh, Máy sấy tóc, Ấm siêu tốc, ${FREE}`,
    airCon: true,
    rooms: ["Toa tàu 1", "Toa tàu 2"],
  },
  {
    name: "Best view Bungalow",
    label: "Best view Bungalow",
    price: 1_100_000,
    capacity: 2,
    max: 3,
    bed: "1 nệm 1m8×2m",
    amenities: `Nệm 1m8×2m, Điều hoà 2 chiều, Nóng lạnh, Máy sấy tóc, Ấm siêu tốc, ${FREE}`,
    airCon: true,
    rooms: ["Aqua", "Vòm", "Thuyền"],
  },
  {
    name: "Luxury",
    label: "Bungalow Luxury",
    price: 1_400_000,
    capacity: 2,
    max: 2,
    where: "Giữa vườn trà shan tuyết",
    bed: "1 giường",
    amenities: `Điều hoà 2 chiều, Quạt, Máy chiếu, Chậu ngâm chân thảo dược, Bàn trà, Máy sấy tóc, Ấm siêu tốc, Mỳ cốc & nước lọc`,
    airCon: true,
    rooms: ["UFO"],
  },
  {
    name: "Family 4",
    label: "Phòng Family 4 người",
    price: 1_100_000,
    capacity: 4,
    max: 4,
    bed: "2 giường 1m6×2m",
    amenities: `2 giường 1m6×2m, Điều hoà, Nệm sưởi, Máy sấy tóc, Ấm siêu tốc, ${FREE}`,
    airCon: true,
    heating: true,
    rooms: ["Sun"],
  },
  {
    name: "Family 8",
    label: "Phòng Family 8 người",
    price: 2_200_000,
    capacity: 8,
    max: 10,
    where: "Tầng 1 và tầng 2 nhà điều hành",
    bed: "4 nệm 1m6×2m",
    amenities: `4 nệm 1m6×2m, Điều hoà, Nệm sưởi, Nóng lạnh, Ấm siêu tốc, Máy sấy tóc, ${FREE}`,
    airCon: true,
    heating: true,
    rooms: ["Moon"],
  },
];

const fmt = (n: number) => n.toLocaleString("vi-VN") + "đ";

async function main() {
  const existing = await prisma.service.findFirst({
    where: { OR: [{ slug: SLUG }, { title: { equals: TITLE, mode: "insensitive" } }] },
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
        "Cloud Garden Tà Xùa — khu bungalow, nhà vườn sinh thái yên tĩnh giữa vườn đào và vườn trà shan tuyết: bungalow săn mây cho cặp đôi, phòng family 4–8 người, giá từ 700.000đ/đêm.",
      description: `Cloud Garden là khu bungalow – nhà vườn sinh thái ở Tà Xùa: không gian trong lành, yên tĩnh, gần gũi thiên nhiên. Phù hợp với cặp đôi, gia đình nhỏ, khách thích săn mây, nghỉ dưỡng và muốn có không gian riêng tư.

Home có 10 phòng:
- **Phòng Standard** (Star 1, Star 2): tầng 2 nhà điều hành, giường 2m7×2m, điều hoà, nệm sưởi. 2 khách.
- **Nature Bungalow** (Toa tàu 1, Toa tàu 2): khu sinh thái vườn đào, điều hoà 2 chiều. 2 khách.
- **Best view Bungalow** (Aqua, Vòm, Thuyền): bungalow view đẹp nhất của home, điều hoà 2 chiều. 2 khách.
- **Bungalow Luxury** (UFO): giữa vườn trà shan tuyết, có máy chiếu, bàn trà, chậu ngâm chân thảo dược. 2 khách.
- **Phòng Family 4 người** (Sun): 2 giường 1m6×2m, điều hoà, nệm sưởi.
- **Phòng Family 8 người** (Moon): 4 nệm 1m6×2m, điều hoà, nệm sưởi.

Tất cả phòng có máy sấy tóc, ấm siêu tốc; mỳ cốc và nước lọc dùng miễn phí.`,
      policy: `Giá phòng (theo số khách tiêu chuẩn):
${TYPES.map((t) => `- ${t.label} (${t.capacity} khách): ${fmt(t.price)}/đêm`).join("\n")}

Phụ thu:
- Standard, Nature Bungalow, Best view Bungalow: phụ thu 100.000đ/người từ người thứ 3.
- Family 8 người: phụ thu 100.000đ/người từ người thứ 9.`,
      area: "Tà Xùa",
      basePrice: Math.min(...TYPES.map((t) => t.price)),
      priceUnit: "/đêm",
      contactName: TITLE,
      published: true,
      extraPersonFee: 100_000,
      sheetUrl: CALENDAR_URL,
    },
  });

  let sort = 0;
  for (const [ti, t] of TYPES.entries()) {
    const rt = await prisma.roomType.create({
      data: {
        serviceId: svc.id,
        name: t.name,
        capacity: t.capacity,
        weekdayPrice: t.price,
        weekendPrice: t.price,
        totalRooms: t.rooms.length,
        cloudView: t.name === "Best view Bungalow",
        airCon: !!t.airCon,
        heating: !!t.heating,
        sortOrder: ti,
      },
    });
    for (const name of t.rooms) {
      await prisma.room.create({
        data: {
          roomTypeId: rt.id,
          name,
          description: `${t.label}${t.where ? ` · ${t.where}` : ""} · ${t.bed} · tiêu chuẩn ${t.capacity} khách${t.max > t.capacity ? `, tối đa ${t.max} khách (phụ thu 100.000đ/người)` : ""}`,
          amenities: t.amenities,
          capacity: t.capacity,
          maxCapacity: t.max,
          listPrice: t.price,
          commission: Math.round(t.price * 0.2), // các ngày thường: 20% giá niêm yết
          commissionSat: Math.round(t.price * 0.1), // Thứ 7: 10%
          sortOrder: sort++,
        },
      });
    }
    console.log(`  ${t.name} ${fmt(t.price)}: ${t.rooms.join(", ")}`);
  }
  console.log(`Đã tạo ${TITLE} — id ${svc.id}, slug ${SLUG}`);
}
main().finally(() => prisma.$disconnect());
