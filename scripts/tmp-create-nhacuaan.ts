/**
 * Tạo homestay "Nhà của An" — 1 hạng phòng, 10 căn thiết kế đồng bộ (An 1 … An 10, theo tên ảnh Drive).
 * Giá (2 khách/phòng/đêm): T2–T5 700k · T6 & CN 900k · T7 1.100k · Lễ Tết 1.300k (ghi trong chính sách —
 * hệ thống chưa có lịch ngày lễ). Tối đa 3 khách/phòng, phụ thu người thứ 3: 200k/đêm. Trẻ dưới 6 tuổi free.
 * Chiết khấu: 100k/phòng/đêm, riêng Thứ 7 không chiết khấu.
 * Chạy: npx tsx scripts/tmp-create-nhacuaan.ts   (DATABASE_URL theo .env)
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const SLUG = "nha-cua-an-ta-xua";
const TITLE = "Nhà của An";
const WEEKDAY = 700_000; // T2–T5
const FRI_SUN = 900_000; // T6 & Chủ nhật
const SAT = 1_100_000; // Thứ 7
const HOLIDAY = 1_300_000; // Lễ, Tết (ghi trong chính sách)
const ROOMS = 10;
const AMENITIES =
  "Phòng khép kín, Bình nóng lạnh, Ấm siêu tốc, Máy sấy tóc, Nước lọc miễn phí, Snack miễn phí";

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
        "Nhà của An — 10 căn phòng thiết kế đồng bộ tại Tà Xùa, phòng khép kín có nóng lạnh, ấm siêu tốc, máy sấy; miễn phí nước lọc & snack, có quán cafe trong khuôn viên. Tối đa 3 khách/phòng.",
      description: `Nhà của An gồm 10 căn phòng thiết kế đồng bộ, giống nhau, nằm trong một khuôn viên riêng tại Tà Xùa, có quán cafe Nhà của An ngay trong khu.

Phòng: khép kín, có bình nóng lạnh, ấm siêu tốc, máy sấy tóc. Miễn phí nước lọc và snack.
Giá tiêu chuẩn cho 2 khách, nhận tối đa 3 khách/phòng. Giá phòng chưa bao gồm ăn sáng.`,
      policy: `Giá phòng theo thứ (2 khách/phòng/đêm): Thứ 2 – Thứ 5: 700.000đ · Thứ 6 và Chủ nhật: 900.000đ · Thứ 7: 1.100.000đ.
Lễ, Tết: 1.300.000đ/đêm/2 khách (giá lễ 2/9 áp dụng từ 30/8 đến 1/9).
Tối đa 3 khách/phòng. Phụ thu người thứ 3: 200.000đ/người/đêm.
Trẻ em dưới 6 tuổi miễn phí.
Giá phòng chưa bao gồm ăn sáng. Miễn phí nước lọc, snack.`,
      area: "Tà Xùa",
      basePrice: WEEKDAY,
      priceUnit: "/đêm",
      contactName: TITLE,
      published: true,
      extraPersonFee: 200_000,
      childFreeUnderAge: 6,
    },
  });

  const roomType = await prisma.roomType.create({
    data: {
      serviceId: svc.id,
      name: "Phòng tiêu chuẩn",
      capacity: 2,
      weekdayPrice: WEEKDAY,
      weekendPrice: SAT,
      holidayPrice: HOLIDAY,
      priceFri: FRI_SUN,
      priceSat: SAT,
      priceSun: FRI_SUN,
      totalRooms: ROOMS,
      hasBathtub: false,
      cloudView: false,
      breakfast: false,
      airCon: false,
      heating: false,
      sortOrder: 0,
    },
  });

  for (let n = 1; n <= ROOMS; n++) {
    await prisma.room.create({
      data: {
        roomTypeId: roomType.id,
        name: `An ${n}`,
        description: `Căn An ${n} · phòng khép kín · tiêu chuẩn 2 khách, tối đa 3 khách (phụ thu người thứ 3)`,
        amenities: AMENITIES,
        capacity: 2,
        maxCapacity: 3,
        listPrice: WEEKDAY,
        priceFri: FRI_SUN,
        priceSat: SAT,
        priceSun: FRI_SUN,
        // Chiết khấu 100k/phòng/đêm, Thứ 7 không chiết khấu.
        commission: 100_000,
        commissionSat: 0,
        sortOrder: n - 1,
      },
    });
  }
  console.log(`Đã tạo ${TITLE} (${svc.id}) · hạng "${roomType.name}" · ${ROOMS} phòng An 1 … An ${ROOMS}`);
}
main().finally(() => prisma.$disconnect());
