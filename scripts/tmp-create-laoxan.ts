// Tạo homestay "Lao Xan Boutique Stay" (chế độ contactOnly — nhắn tin nhận thông tin).
// Dữ liệu theo bảng giá niêm yết 01/10/2026 – 03/05/2027 của Lao Xan.
// Chạy: npx tsx scripts/tmp-create-laoxan.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Giá theo thứ: listPrice = T2–T5; priceFri/priceSun = T6 & CN; priceSat = T7.
function weekPrices(weekday: number, friSun: number, sat: number) {
  return { listPrice: weekday, priceFri: friSun, priceSat: sat, priceSun: friSun };
}

async function main() {
  const existing = await prisma.service.findUnique({ where: { slug: "lao-xan" } });
  if (existing) {
    console.log("Đã tồn tại service lao-xan:", existing.id, "— không tạo lại.");
    return;
  }

  const svc = await prisma.service.create({
    data: {
      slug: "lao-xan",
      category: "HOMESTAY",
      title: "Lao Xan Boutique Stay",
      summary:
        "Một nơi để chậm lại giữa mây trời Tà Xùa — boutique stay phong cách mộc Tây Bắc tại trung tâm Tà Xùa, có nhà hàng, quầy bar và khu cầu gỗ ngắm mây riêng.",
      description: [
        "Lao Xan Boutique Stay — \"Một nơi để chậm lại\" giữa mây trời Tà Xùa. Không gian lưu trú ấm cúng, yên tĩnh theo định hướng retreat, thiết kế gỗ nguyên bản phong cách mộc Tây Bắc, nằm ngay trung tâm Tà Xùa (xã Tà Xùa, Sơn La).",
        "",
        "Tiện ích chung tại Lao Xan:",
        "• Nhà hàng phục vụ đồ uống và quầy bar pha chế",
        "• Phục vụ đồ Âu và rượu vang tại không gian ngoài trời và trong nhà",
        "• Khuôn viên cảnh quan rộng, thích hợp dạo và ngắm mây",
        "• Khu cầu gỗ ngắm mây dành riêng cho khách đặt phòng",
        "• Khu đốt lửa, nghe nhạc và xem phim ngoài trời miễn phí",
        "• Bãi đỗ ô tô riêng",
        "",
        "Trải nghiệm đi kèm: ăn sáng phục vụ theo nhu cầu (không nằm trong giá phòng), lễ tân online 24h hỗ trợ trong suốt kỳ nghỉ, phục vụ đồ ăn nhẹ và đồ uống về đêm khi có nhu cầu. Khách hạng Hoa Lê được ưu đãi 10% đồ uống tại quầy bar và 10% thuê xe máy, đặt xe cabin đi qua Lao Xan.",
      ].join("\n"),
      area: "Trung tâm Tà Xùa, xã Tà Xùa, Sơn La",
      distanceKm: 0,
      basePrice: 750000,
      priceUnit: "/đêm",
      contactName: "Lao Xan Boutique Stay",
      contactOnly: true, // không quản lý lịch — luôn hiện khi tìm kiếm, khách nhắn tin nhận thông tin
      published: true,
      policy: [
        "Nhận phòng 14h00 · Trả phòng 12h00",
        "Cọc 50% để giữ phòng",
        "Giá phòng áp dụng theo tiêu chuẩn từng hạng phòng",
        "Trẻ em dưới 6 tuổi: miễn phí",
        "Trẻ em 6–12 tuổi: phụ thu 150.000đ/khách",
        "Người lớn hoặc trẻ em trên 12 tuổi: phụ thu 250.000đ/khách",
        "Ăn sáng phục vụ theo nhu cầu (không nằm trong giá phòng)",
        "Giá Lễ/Tết: Hoa Lê 1.500.000đ · Tớ Dầy 1.150.000–1.250.000đ · Tớ Dầy Family 1.800.000đ · Bungalow Duplex 2.500.000đ/đêm",
        "Giá trên chưa bao gồm VAT",
        "Bảng giá áp dụng từ 01/10/2026 đến hết 03/05/2027",
      ].join("\n"),
    },
  });
  console.log("Đã tạo service:", svc.id, svc.slug);

  // ===== Hạng phòng + phòng =====
  const AIRCON = "Điều hòa 2 chiều";

  // Hoa Lê — tầng 2, 25m², cao cấp, view thung lũng mây, ban công riêng.
  const hoaLe = await prisma.roomType.create({
    data: {
      serviceId: svc.id,
      name: "Hoa Lê",
      capacity: 2,
      weekdayPrice: 1000000,
      weekendPrice: 1350000,
      holidayPrice: 1500000,
      cloudView: true,
      airCon: true,
      sortOrder: 0,
      rooms: {
        create: [
          {
            name: "Hoa Lê",
            capacity: 2,
            maxCapacity: 3,
            extraPersonFee: 250000,
            amenities: `Tầng 2, 25m², View thung lũng mây, Ban công riêng tư, ${AIRCON}, Máy sấy tóc, Siêu nước, Trà & cà phê miễn phí`,
            description:
              "Hạng phòng cao cấp dành cho khách ưu tiên sự riêng tư — tầng 2 view thung lũng mây, ban công gỗ riêng tư, thiết kế gỗ nguyên bản phong cách mộc Tây Bắc, chăn ga gối đệm cao cấp. Tiêu chuẩn 2 khách, tối đa 3 khách.",
            sortOrder: 0,
            ...weekPrices(1000000, 1150000, 1350000),
          },
        ],
      },
    },
  });

  // Tớ Dầy — tầng 1, 25m² (4 phòng: 1–2 giá thấp hơn, 3–4 giá cao hơn).
  const toDay = await prisma.roomType.create({
    data: {
      serviceId: svc.id,
      name: "Tớ Dầy",
      capacity: 2,
      weekdayPrice: 750000,
      weekendPrice: 950000,
      holidayPrice: 1150000,
      airCon: true,
      sortOrder: 1,
      rooms: {
        create: [
          ...[1, 2].map((n) => ({
            name: `Tớ Dầy ${n}`,
            capacity: 2,
            maxCapacity: 3,
            extraPersonFee: 250000,
            amenities: `Tầng 1, 25m², Ban công tầng 1 rộng thoáng, ${AIRCON}, Thiết kế gỗ tự nhiên`,
            description:
              "Không gian lưu trú ấm cúng, yên bình giữa thung lũng mây Tà Xùa — tầng 1, ban công rộng thoáng, thiết kế gỗ tự nhiên phong cách Tây Bắc. Tiêu chuẩn 2 khách, tối đa 3 khách.",
            sortOrder: n - 1,
            ...weekPrices(750000, 850000, 950000),
          })),
          ...[3, 4].map((n) => ({
            name: `Tớ Dầy ${n}`,
            capacity: 2,
            maxCapacity: 3,
            extraPersonFee: 250000,
            amenities: `Tầng 1, 25m², Ban công tầng 1 rộng thoáng, ${AIRCON}, Thiết kế gỗ tự nhiên`,
            description:
              "Không gian lưu trú ấm cúng, yên bình giữa thung lũng mây Tà Xùa — tầng 1, ban công rộng thoáng, thiết kế gỗ tự nhiên phong cách Tây Bắc. Tiêu chuẩn 2 khách, tối đa 3 khách.",
            sortOrder: n - 1,
            ...weekPrices(850000, 950000, 1150000),
          })),
        ],
      },
    },
  });

  // Tớ Dầy Family — tiêu chuẩn 4 khách, giường 1,6m + 1,2m, 1 WC.
  const family = await prisma.roomType.create({
    data: {
      serviceId: svc.id,
      name: "Tớ Dầy Family",
      capacity: 4,
      weekdayPrice: 1200000,
      weekendPrice: 1600000,
      holidayPrice: 1800000,
      airCon: true,
      sortOrder: 2,
      rooms: {
        create: [
          {
            name: "Tớ Dầy Family",
            capacity: 4,
            maxCapacity: 5,
            extraPersonFee: 250000,
            amenities: `01 giường 1,6m + 01 giường 1,2m, 01 WC, ${AIRCON}, Thiết kế gỗ tự nhiên`,
            description:
              "Phòng gia đình tiêu chuẩn 4 khách với 1 giường 1,6m và 1 giường 1,2m, 1 WC — phù hợp gia đình hoặc nhóm bạn nghỉ nhẹ nhàng, riêng tư tại Lao Xan.",
            sortOrder: 0,
            ...weekPrices(1200000, 1400000, 1600000),
          },
        ],
      },
    },
  });

  // Bungalow Duplex — 2 tầng, 2 phòng ngủ, 2 WC, tiêu chuẩn 4 khách.
  const duplex = await prisma.roomType.create({
    data: {
      serviceId: svc.id,
      name: "Bungalow Duplex",
      capacity: 4,
      weekdayPrice: 1600000,
      weekendPrice: 2200000,
      holidayPrice: 2500000,
      airCon: true,
      sortOrder: 3,
      rooms: {
        create: [
          {
            name: "Bungalow Duplex",
            capacity: 4,
            maxCapacity: 5,
            extraPersonFee: 250000,
            amenities: `2 tầng, 2 phòng ngủ, 2 WC, ${AIRCON}, Thiết kế gỗ nguyên bản`,
            description:
              "Bungalow 2 tầng với 2 phòng ngủ và 2 WC riêng — tiêu chuẩn 4 khách, không gian riêng tư trọn vẹn giữa khuôn viên cảnh quan của Lao Xan.",
            sortOrder: 0,
            ...weekPrices(1600000, 1900000, 2200000),
          },
        ],
      },
    },
  });

  console.log("Đã tạo hạng phòng:", [hoaLe.name, toDay.name, family.name, duplex.name].join(", "));
  const count = await prisma.room.count({ where: { roomType: { serviceId: svc.id } } });
  console.log("Tổng số phòng:", count);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
