import { PrismaClient, type AvailabilityStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// ---- Date helpers (inline để không phụ thuộc alias khi chạy bằng tsx) ----
function toKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function today(): Date {
  return new Date(Date.UTC(
    new Date().getUTCFullYear(),
    new Date().getUTCMonth(),
    new Date().getUTCDate(),
  ));
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}
function isWeekend(d: Date): boolean {
  const day = d.getUTCDay();
  return day === 0 || day === 6;
}

const IMG = {
  cloud1:
    "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1600&q=80",
  cloud2:
    "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1600&q=80",
  mountain:
    "https://images.unsplash.com/photo-1483728642387-6c3bdd6c93e5?w=1600&q=80",
  homestay:
    "https://images.unsplash.com/photo-1521401830884-6c03c1c87ebb?w=1600&q=80",
  room: "https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=1600&q=80",
  room2:
    "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1600&q=80",
  bungalow:
    "https://images.unsplash.com/photo-1540541338287-41700207dee6?w=1600&q=80",
  motorbike:
    "https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=1600&q=80",
  road: "https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=1600&q=80",
  bus: "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=1600&q=80",
};

/** Sinh tình trạng mẫu cho 1 ngày (tạo đa dạng trạng thái để minh hoạ). */
function sampleDay(
  date: Date,
  totalUnits: number,
  index: number,
): { status: AvailabilityStatus; availableUnits: number } {
  // Cứ ~mỗi 11 ngày để 1 ngày "chưa cập nhật" nhằm minh hoạ.
  if ((index + 3) % 11 === 0) {
    return { status: "NOT_UPDATED", availableUnits: 0 };
  }
  if (isWeekend(date)) {
    // Cuối tuần đông: đôi khi hết, đôi khi còn ít.
    if (index % 7 === 0) return { status: "SOLD_OUT", availableUnits: 0 };
    const left = Math.max(1, Math.floor(totalUnits * 0.3));
    return { status: "LIMITED", availableUnits: left };
  }
  return { status: "AVAILABLE", availableUnits: totalUnits };
}

async function main() {
  console.log("🌱 Bắt đầu seed...");

  // Xoá dữ liệu cũ (an toàn cho môi trường dev).
  await prisma.cabinPriceRow.deleteMany();
  await prisma.bookingRequest.deleteMany();
  await prisma.roomAvailability.deleteMany();
  await prisma.rentalAvailability.deleteMany();
  await prisma.cabinTrip.deleteMany();
  await prisma.roomType.deleteMany();
  await prisma.rentalVehicle.deleteMany();
  await prisma.transportInfo.deleteMany();
  await prisma.serviceImage.deleteMany();
  await prisma.service.deleteMany();
  await prisma.article.deleteMany();
  await prisma.siteSetting.deleteMany();
  await prisma.adminUser.deleteMany();

  // ---- Admin ----
  const username = process.env.ADMIN_USERNAME || "admin";
  const password = process.env.ADMIN_PASSWORD || "taxua@2026";
  await prisma.adminUser.create({
    data: {
      username,
      name: "Quản trị viên",
      role: "ADMIN",
      passwordHash: await bcrypt.hash(password, 10),
    },
  });
  // Tài khoản demo CTV & chủ dịch vụ (gán chủ sở hữu ở cuối seed).
  const ctvUser = await prisma.adminUser.create({
    data: { username: "ctv1", name: "CTV Nguyễn Văn A", phone: "0911111111", role: "CTV", passwordHash: await bcrypt.hash("ctv123", 10) },
  });
  const chuXe = await prisma.adminUser.create({
    data: { username: "chuxe1", name: "Chủ xe Tà Xùa Express", phone: "0922222222", role: "PROVIDER", passwordHash: await bcrypt.hash("chu123", 10) },
  });
  const chuHome = await prisma.adminUser.create({
    data: { username: "chuhome1", name: "Chủ Mây Homestay", phone: "0933333333", role: "PROVIDER", passwordHash: await bcrypt.hash("chu123", 10) },
  });
  console.log(`✅ Admin: ${username} / ${password} · CTV: ctv1/ctv123 · Chủ: chuxe1,chuhome1 /chu123`);

  // ---- Site settings ----
  await prisma.siteSetting.createMany({
    data: [
      { key: "contactPhone", value: "0357452952" },
      { key: "contactZalo", value: "0357452952" },
      { key: "contactEmail", value: "anbd.dev@gmail.com" },
      { key: "contactFacebook", value: "https://www.facebook.com/an.danh.bui.2025/" },
      { key: "contactAddress", value: "Tà Xùa, Bắc Yên, Sơn La" },
      { key: "heroTitle", value: "Lên Tà Xùa săn mây, mọi thứ có ở đây." },
      {
        key: "heroSubtitle",
        value:
          "Xe cabin, homestay, thuê xe máy, taxi và combo — xem giá và tình trạng còn chỗ theo ngày.",
      },
      // Cấu hình khối bảng giá cabin (poster)
      { key: "cabinFareSubtitle", value: "Xuất phát 21:00 hằng tối" },
      { key: "cabinComboTitle", value: "Xe + Home view kính trung tâm" },
      { key: "cabinComboSub", value: "Trọn gói 2 ngày 1 đêm" },
      { key: "cabinComboPrice", value: "700000" },
      { key: "cabinComboNote", value: "Giá từ Hà Nội · đã gồm vé xe & home view kính trung tâm" },
      { key: "cabinHomeFrom", value: "500000" },
      { key: "cabinBikeFrom", value: "150000" },
      { key: "cabinFareFootnote", value: "Giá có thể thay đổi theo thời điểm. Vui lòng liên hệ trước để giữ chỗ." },
      { key: "cabinTagline", value: "Đi xa không chỉ là khoảng cách, mà là những trải nghiệm đáng nhớ!" },
    ],
  });

  const start = today();
  const DAYS = 45;

  // ======================= HOMESTAY =======================
  const homestays = [
    {
      slug: "may-homestay-ta-xua",
      title: "Mây Homestay Tà Xùa",
      summary: "View săn mây trực diện, cách sống lưng khủng long 2km.",
      area: "Trung tâm Tà Xùa",
      featured: true,
      easyRoad: true,
      rooms: [
        { name: "Phòng đôi view mây", capacity: 2, weekday: 450000, weekend: 650000, total: 5, feat: { cloudView: true, breakfast: true, airCon: true, heating: true } },
        { name: "Phòng gia đình", capacity: 4, weekday: 750000, weekend: 1050000, total: 3, feat: { cloudView: true, breakfast: true, heating: true, bathtub: true } },
        { name: "Phòng tập thể (dorm)", capacity: 8, weekday: 150000, weekend: 200000, total: 12, feat: { breakfast: true } },
      ],
    },
    {
      slug: "song-lung-khung-long-homestay",
      title: "Sống Lưng Khủng Long Homestay",
      summary: "Ngay chân cung đường sống lưng khủng long nổi tiếng.",
      area: "Sống lưng khủng long",
      featured: true,
      easyRoad: false,
      rooms: [
        { name: "Phòng đôi ban công", capacity: 2, weekday: 500000, weekend: 700000, total: 4, feat: { cloudView: true, breakfast: true, heating: true } },
        { name: "Phòng 3 người", capacity: 3, weekday: 650000, weekend: 900000, total: 3, feat: { cloudView: true, breakfast: true, airCon: true, heating: true, bathtub: true } },
      ],
    },
    {
      slug: "tram-may-homestay",
      title: "Trạm Mây Homestay",
      summary: "Không gian gỗ ấm cúng, bếp lửa, phù hợp nhóm bạn.",
      area: "Xã Tà Xùa",
      featured: false,
      easyRoad: true,
      rooms: [
        { name: "Phòng đôi tiêu chuẩn", capacity: 2, weekday: 400000, weekend: 550000, total: 6, feat: { breakfast: true, airCon: true, heating: true } },
        { name: "Phòng tập thể 6 người", capacity: 6, weekday: 140000, weekend: 180000, total: 6, feat: { breakfast: true } },
      ],
    },
  ];

  for (const h of homestays) {
    const service = await prisma.service.create({
      data: {
        slug: h.slug,
        category: "HOMESTAY",
        title: h.title,
        summary: h.summary,
        description:
          `${h.title} nằm tại ${h.area}, là điểm lưu trú lý tưởng để săn mây Tà Xùa. ` +
          "Phòng sạch sẽ, có nước nóng, wifi, phục vụ ăn sáng. Chủ nhà thân thiện, hỗ trợ tư vấn lịch trình và thuê xe.",
        area: h.area,
        basePrice: Math.min(...h.rooms.map((r) => r.weekday)),
        priceUnit: "/đêm",
        contactName: "Chủ homestay",
        contactPhone: "0987 654 321",
        contactZalo: "0987654321",
        featured: h.featured,
        easyRoad: h.easyRoad,
        images: {
          create: [
            { url: IMG.homestay, isCover: true, sortOrder: 0, alt: h.title },
            { url: IMG.room, sortOrder: 1, alt: "Phòng nghỉ" },
            { url: IMG.cloud2, sortOrder: 2, alt: "View mây" },
          ],
        },
      },
    });

    for (let i = 0; i < h.rooms.length; i++) {
      const r = h.rooms[i];
      const f: Partial<Record<"bathtub" | "cloudView" | "breakfast" | "airCon" | "heating", boolean>> = r.feat ?? {};
      const room = await prisma.roomType.create({
        data: {
          serviceId: service.id,
          name: r.name,
          capacity: r.capacity,
          weekdayPrice: r.weekday,
          weekendPrice: r.weekend,
          holidayPrice: Math.round(r.weekend * 1.2),
          totalRooms: r.total,
          imageUrl: i === 0 ? IMG.room : IMG.room2,
          sortOrder: i,
          hasBathtub: f.bathtub ?? false,
          cloudView: f.cloudView ?? false,
          breakfast: f.breakfast ?? false,
          airCon: f.airCon ?? false,
          heating: f.heating ?? false,
        },
      });

      const avail = [];
      for (let d = 0; d < DAYS; d++) {
        const date = addDays(start, d);
        const s = sampleDay(date, r.total, d + i);
        avail.push({
          roomTypeId: room.id,
          date,
          availableRooms: s.availableUnits,
          status: s.status,
        });
      }
      await prisma.roomAvailability.createMany({ data: avail });
    }
  }
  console.log("✅ Homestay");

  // ======================= BUNGALOW =======================
  const bungalows = [
    {
      slug: "bungalow-bien-may-ta-xua",
      title: "Bungalow Biển Mây Tà Xùa",
      summary: "Bungalow riêng biệt, cửa kính lớn đón trọn biển mây.",
      area: "Đồi Tà Xùa",
      featured: true,
      rooms: [
        { name: "Bungalow đôi", capacity: 2, weekday: 800000, weekend: 1150000, total: 4 },
        { name: "Bungalow gia đình", capacity: 4, weekday: 1300000, weekend: 1800000, total: 2 },
      ],
    },
    {
      slug: "bungalow-go-ta-xua",
      title: "Gỗ Bungalow Tà Xùa",
      summary: "Thiết kế gỗ mộc, bồn tắm ngoài trời ngắm mây.",
      area: "Xã Tà Xùa",
      featured: false,
      rooms: [
        { name: "Bungalow đôi tiêu chuẩn", capacity: 2, weekday: 750000, weekend: 1000000, total: 5 },
      ],
    },
  ];

  for (const b of bungalows) {
    const service = await prisma.service.create({
      data: {
        slug: b.slug,
        category: "HOMESTAY", // Bungalow đã gộp vào Homestay
        title: b.title,
        summary: b.summary,
        description:
          `${b.title} tại ${b.area} mang đến trải nghiệm nghỉ dưỡng riêng tư giữa thiên nhiên. ` +
          "Mỗi bungalow có ban công riêng, chăn ấm, nước nóng và view mây tuyệt đẹp vào sáng sớm.",
        area: b.area,
        basePrice: Math.min(...b.rooms.map((r) => r.weekday)),
        priceUnit: "/đêm",
        contactName: "Lễ tân Bungalow",
        contactPhone: "0987 654 321",
        contactZalo: "0987654321",
        featured: b.featured,
        images: {
          create: [
            { url: IMG.bungalow, isCover: true, sortOrder: 0, alt: b.title },
            { url: IMG.cloud1, sortOrder: 1, alt: "Biển mây" },
          ],
        },
      },
    });

    for (let i = 0; i < b.rooms.length; i++) {
      const r = b.rooms[i];
      const room = await prisma.roomType.create({
        data: {
          serviceId: service.id,
          name: r.name,
          capacity: r.capacity,
          weekdayPrice: r.weekday,
          weekendPrice: r.weekend,
          holidayPrice: Math.round(r.weekend * 1.25),
          totalRooms: r.total,
          imageUrl: IMG.bungalow,
          sortOrder: i,
        },
      });
      const avail = [];
      for (let d = 0; d < DAYS; d++) {
        const date = addDays(start, d);
        const s = sampleDay(date, r.total, d + i + 2);
        avail.push({
          roomTypeId: room.id,
          date,
          availableRooms: s.availableUnits,
          status: s.status,
        });
      }
      await prisma.roomAvailability.createMany({ data: avail });
    }
  }
  console.log("✅ Bungalow");

  // ======================= CABIN =======================
  const cabinOperators = [
    {
      slug: "xe-cabin-ta-xua-express",
      title: "Tà Xùa Express — Xe cabin limousine",
      operator: "Tà Xùa Express",
      route: "Hà Nội → Tà Xùa",
      price: 350000,
      times: ["21:30", "22:30"],
      featured: true,
    },
    {
      slug: "xe-cabin-son-la-cloud",
      title: "Sơn La Cloud — Cabin đôi cao cấp",
      operator: "Sơn La Cloud",
      route: "Hà Nội → Bắc Yên → Tà Xùa",
      price: 320000,
      times: ["20:00"],
      featured: false,
    },
  ];

  for (const c of cabinOperators) {
    const service = await prisma.service.create({
      data: {
        slug: c.slug,
        category: "CABIN",
        title: c.title,
        summary: `${c.route}, xe cabin đôi đời mới, đón/trả tận nơi khu vực nội thành.`,
        description:
          `Nhà xe ${c.operator} khai thác tuyến ${c.route} bằng xe cabin limousine đời mới. ` +
          "Mỗi khách một cabin riêng, có rèm, cổng sạc, chăn gối sạch. Hỗ trợ đón tại các điểm trong nội thành Hà Nội.",
        area: c.route,
        basePrice: c.price,
        priceUnit: "/vé",
        contactName: c.operator,
        contactPhone: "0987 654 321",
        contactZalo: "0987654321",
        featured: c.featured,
        images: {
          create: [{ url: IMG.bus, isCover: true, sortOrder: 0, alt: c.title }],
        },
      },
    });

    const priceDouble = Math.round((c.price * 1.7) / 1000) * 1000; // cabin đôi ~1.7x
    const singleTotal = 18;
    const doubleTotal = 4;
    const trips = [];
    for (let d = 1; d <= 30; d++) {
      const date = addDays(start, d);
      // Chiều đi (OUTBOUND) theo các giờ tối.
      for (const t of c.times) {
        const s = sampleDay(date, singleTotal, d);
        const doubleAvail = s.status === "SOLD_OUT" ? 0 : Math.max(0, doubleTotal - (d % 3));
        trips.push({
          serviceId: service.id,
          operatorName: c.operator,
          route: c.route,
          direction: "OUTBOUND" as const,
          departureDate: date,
          departureTime: t,
          pickupPoint: "Bến xe Mỹ Đình / đón nội thành",
          dropoffPoint: "Trung tâm Tà Xùa",
          price: c.price,
          seatsTotal: singleTotal,
          seatsAvailable: s.availableUnits,
          priceDouble,
          seatsDoubleTotal: doubleTotal,
          seatsDoubleAvailable: doubleAvail,
          status: s.status,
        });
      }
      // Chiều về (RETURN) 12:00 trưa.
      const rs = sampleDay(date, singleTotal, d + 3);
      const rDouble = rs.status === "SOLD_OUT" ? 0 : Math.max(0, doubleTotal - ((d + 1) % 3));
      trips.push({
        serviceId: service.id,
        operatorName: c.operator,
        route: `${c.route.split("→").reverse().join("→").trim()}`,
        direction: "RETURN" as const,
        departureDate: date,
        departureTime: "12:00",
        pickupPoint: "Đón tại Tà Xùa (homestay / trung tâm)",
        dropoffPoint: "Hà Nội (nội thành)",
        price: c.price,
        seatsTotal: singleTotal,
        seatsAvailable: rs.availableUnits,
        priceDouble,
        seatsDoubleTotal: doubleTotal,
        seatsDoubleAvailable: rDouble,
        status: rs.status,
      });
    }
    await prisma.cabinTrip.createMany({ data: trips });
  }
  console.log("✅ Cabin");

  // ======================= MOTORBIKE =======================
  const motorService = await prisma.service.create({
    data: {
      slug: "thue-xe-may-ta-xua",
      category: "MOTORBIKE",
      title: "Thuê xe máy Tà Xùa — Giao tận nơi",
      summary: "Xe số, xe côn tay bền khỏe, leo đèo tốt, giao nhận tại trung tâm.",
      description:
        "Dịch vụ cho thuê xe máy tại Tà Xùa với nhiều dòng xe phù hợp đường đèo. " +
        "Xe được bảo dưỡng thường xuyên, kèm mũ bảo hiểm và áo mưa. Hỗ trợ giao nhận tại homestay.",
      area: "Trung tâm Tà Xùa",
      basePrice: 150000,
      priceUnit: "/ngày",
      contactName: "Nhà xe Tà Xùa",
      contactPhone: "0987 654 321",
      contactZalo: "0987654321",
      featured: true,
      images: {
        create: [{ url: IMG.motorbike, isCover: true, sortOrder: 0, alt: "Thuê xe máy" }],
      },
    },
  });

  const vehicles = [
    { type: "Honda Wave (xe số)", price: 150000, total: 8, fee: 0 },
    { type: "Honda Winner (côn tay)", price: 250000, total: 4, fee: 30000 },
    { type: "Yamaha Sirius", price: 140000, total: 6, fee: 0 },
  ];
  for (let i = 0; i < vehicles.length; i++) {
    const v = vehicles[i];
    const vehicle = await prisma.rentalVehicle.create({
      data: {
        serviceId: motorService.id,
        vehicleType: v.type,
        pricePerDay: v.price,
        totalUnits: v.total,
        deliveryFee: v.fee || null,
        imageUrl: IMG.motorbike,
        sortOrder: i,
      },
    });
    const avail = [];
    for (let d = 0; d < DAYS; d++) {
      const date = addDays(start, d);
      const s = sampleDay(date, v.total, d + i);
      avail.push({
        rentalVehicleId: vehicle.id,
        date,
        availableUnits: s.availableUnits,
        status: s.status,
      });
    }
    await prisma.rentalAvailability.createMany({ data: avail });
  }
  console.log("✅ Xe máy");

  // ======================= XE ÔM & TAXI =======================
  const xeom = await prisma.service.create({
    data: {
      slug: "xe-om-ta-xua",
      category: "XEOM",
      title: "Xe ôm Tà Xùa — Tài xế bản địa",
      summary: "Chở khách tham quan các điểm săn mây, giá liên hệ theo tuyến.",
      description:
        "Đội xe ôm người bản địa, thông thạo mọi cung đường Tà Xùa, đưa đón linh hoạt theo yêu cầu. " +
        "Giá tuỳ tuyến và thời điểm, vui lòng liên hệ để được báo giá chính xác.",
      area: "Toàn khu vực Tà Xùa",
      basePrice: null,
      priceUnit: "",
      contactName: "Anh Páo",
      contactPhone: "0987 654 321",
      contactZalo: "0987654321",
      featured: false,
      images: { create: [{ url: IMG.road, isCover: true, sortOrder: 0, alt: "Xe ôm" }] },
      transport: {
        create: {
          fromPoint: "Trung tâm Tà Xùa",
          toArea: "Các điểm săn mây, sống lưng khủng long, cây cô đơn",
          vehicleType: "Xe máy",
          fixedPrice: null, // -> Liên hệ xác nhận giá
          priceNote: "Giá tuỳ tuyến đường, liên hệ để báo giá.",
        },
      },
    },
  });

  const taxi = await prisma.service.create({
    data: {
      slug: "taxi-ta-xua",
      category: "TAXI",
      title: "Taxi Tà Xùa — Xe 4-7 chỗ",
      summary: "Đưa đón Bắc Yên ↔ Tà Xùa, xe gầm cao đi đường đèo an toàn.",
      description:
        "Dịch vụ taxi/xe ghép 4-7 chỗ đưa đón tuyến Bắc Yên ↔ Tà Xùa và các điểm lân cận. " +
        "Tài xế quen đường đèo, xe gầm cao an toàn. Giá cố định theo tuyến chính, các tuyến khác liên hệ.",
      area: "Bắc Yên ↔ Tà Xùa",
      basePrice: 400000,
      priceUnit: "/chuyến",
      contactName: "Tổng đài taxi",
      contactPhone: "0987 654 321",
      contactZalo: "0987654321",
      featured: false,
      images: { create: [{ url: IMG.road, isCover: true, sortOrder: 0, alt: "Taxi" }] },
      transport: {
        create: {
          fromPoint: "Thị trấn Bắc Yên",
          toArea: "Trung tâm Tà Xùa",
          vehicleType: "Xe 4-7 chỗ gầm cao",
          fixedPrice: 400000,
          priceNote: "Giá cho 1 chuyến xe 4 chỗ. Xe 7 chỗ liên hệ.",
        },
      },
    },
  });
  console.log("✅ Xe ôm & Taxi");

  // ======================= COMBO =======================
  await prisma.service.create({
    data: {
      slug: "combo-san-may-ta-xua-2n1d",
      category: "COMBO",
      title: "Combo săn mây Tà Xùa 2N1Đ",
      summary: "Trọn gói: xe cabin khứ hồi + homestay + xe máy + tư vấn lịch trình.",
      description:
        "Combo 2 ngày 1 đêm gồm: vé xe cabin khứ hồi Hà Nội - Tà Xùa, 1 đêm homestay phòng đôi, " +
        "thuê xe máy 1 ngày và tư vấn lịch trình săn mây. Phù hợp cặp đôi và nhóm bạn. " +
        "Lịch khởi hành linh hoạt, vui lòng gửi yêu cầu để được xác nhận chỗ.",
      area: "Hà Nội ↔ Tà Xùa",
      basePrice: 1500000,
      priceUnit: "/khách",
      contactName: "Tư vấn combo",
      contactPhone: "0987 654 321",
      contactZalo: "0987654321",
      featured: true,
      images: {
        create: [
          { url: IMG.cloud1, isCover: true, sortOrder: 0, alt: "Combo săn mây" },
          { url: IMG.mountain, sortOrder: 1, alt: "Tà Xùa" },
        ],
      },
    },
  });
  console.log("✅ Combo");

  // ======================= PHÒNG RIÊNG LẺ =======================
  // Tạo các phòng riêng (có tên) cho mỗi hạng phòng, theo số lượng totalRooms.
  const allRoomTypes = await prisma.roomType.findMany();
  for (const t of allRoomTypes) {
    const n = Math.max(1, t.totalRooms);
    // Giá & sức chứa ở cấp phòng con: giá thường = giá ngày thường của hạng;
    // cuối tuần (T7/CN) giữ qua giá theo thứ. Để trống salePrice (không giảm mặc định).
    await prisma.room.createMany({
      data: Array.from({ length: n }, (_, i) => ({
        roomTypeId: t.id,
        name: `${t.name} ${i + 1}`,
        amenities: "Wifi miễn phí, Nước nóng, TV, Chăn ấm, Ban công view mây",
        description: "Phòng sạch sẽ, thoáng, view đẹp, phù hợp nghỉ dưỡng và săn mây.",
        sortOrder: i,
        capacity: t.capacity,
        listPrice: t.weekdayPrice,
        priceSat: t.weekendPrice,
        priceSun: t.weekendPrice,
      })),
    });
  }
  console.log("✅ Phòng riêng lẻ");

  // ======================= ARTICLES =======================
  await prisma.article.createMany({
    data: [
      {
        slug: "kinh-nghiem-san-may-ta-xua",
        title: "Kinh nghiệm săn mây Tà Xùa cho người mới",
        excerpt: "Thời điểm, cung đường và lưu ý để săn mây Tà Xùa thành công.",
        content:
          "Mùa săn mây Tà Xùa đẹp nhất từ tháng 10 đến tháng 4. Nên có mặt tại điểm ngắm trước 5h30 sáng. " +
          "Các điểm nổi tiếng: sống lưng khủng long, cây cô đơn, mỏm cá heo. Nhớ mang áo ấm vì sáng sớm rất lạnh.",
        coverImage: IMG.cloud1,
      },
      {
        slug: "di-ta-xua-bang-xe-cabin",
        title: "Đi Tà Xùa bằng xe cabin: nên chọn nhà xe nào?",
        excerpt: "So sánh các nhà xe cabin và mẹo đặt vé ngày cao điểm.",
        content:
          "Xe cabin là lựa chọn thoải mái nhất để đi Tà Xùa. Nên đặt vé trước 2-3 ngày vào cuối tuần. " +
          "Chọn chuyến đêm để tiết kiệm thời gian và kịp săn mây sáng sớm.",
        coverImage: IMG.bus,
      },
      {
        slug: "lich-trinh-ta-xua-2-ngay-1-dem",
        title: "Gợi ý lịch trình Tà Xùa 2 ngày 1 đêm",
        excerpt: "Lịch trình chi tiết tối ưu cho chuyến đi cuối tuần.",
        content:
          "Ngày 1: di chuyển, nhận phòng, tham quan sống lưng khủng long, săn mây chiều. " +
          "Ngày 2: dậy sớm săn mây, ăn sáng, check-in cây cô đơn rồi trở về.",
        coverImage: IMG.mountain,
      },
    ],
  });
  console.log("✅ Bài viết");

  // ======================= BẢNG GIÁ CABIN =======================
  await prisma.cabinPriceRow.createMany({
    data: (
      [
        ["Hà Nội", 500000], ["Hải Phòng", 950000], ["Thái Nguyên", 700000],
        ["Bắc Ninh", 700000], ["Bắc Giang", 800000], ["Quảng Ninh", 950000],
        ["Thái Bình", 900000], ["Hưng Yên", 700000], ["Hải Dương", 800000],
        ["Hà Nam", 850000], ["Ninh Bình", 850000],
      ] as [string, number][]
    ).map(([pickupPoint, price], i) => ({ pickupPoint, destination: "Tà Xùa", price, sortOrder: i })),
  });
  console.log("✅ Bảng giá cabin");

  // ======================= LỘ TRÌNH CABIN =======================
  const cabStops = {
    OUTBOUND: {
      title: "Ngủ một giấc, mở mắt là tới mây.", totalTime: "~8 tiếng", startLabel: "Khởi hành", startInfo: "21:00 hằng tối",
      fromPoint: "68 Mạc Thái Tổ, Cầu Giấy", toPoint: "Trung tâm xã Tà Xùa",
      stops: [
        { time: "21:00", place: "68 Mạc Thái Tổ", note: "Lên xe tại Cầu Giấy, Hà Nội. Nhận chăn gối, ngả lưng.", tag: "Lên xe" },
        { time: "02:00", place: "Phú Thọ", note: "Dừng nghỉ chân, vệ sinh, ăn nhẹ.", tag: "Nghỉ chân" },
        { time: "04:00", place: "Bắc Yên", note: "Tới Bắc Yên, chuẩn bị đổi xe.", tag: "Tới nơi" },
        { time: "05:00", place: "Trung chuyển lên Tà Xùa", note: "Xe trung chuyển đưa lên đỉnh, kịp đón bình minh.", tag: "Đón bình minh" },
      ],
    },
    RETURN: {
      title: "Ăn trưa trên núi, tối đã về phố.", totalTime: "~7 tiếng", startLabel: "Đón khách", startInfo: "12:00 hằng ngày",
      fromPoint: "Tà Xùa (homestay / trung tâm xã)", toPoint: "68 Mạc Thái Tổ, Cầu Giấy",
      stops: [
        { time: "12:00", place: "Đón tại Tà Xùa", note: "Xe trung chuyển đón tại homestay hoặc trung tâm xã.", tag: "Đón khách" },
        { time: "13:20", place: "Bắc Yên", note: "Lên xe cabin, xuất phát về Hà Nội.", tag: "Xuất phát" },
        { time: "16:00", place: "Ba Vì", note: "Dừng nghỉ chân, vệ sinh, ăn nhẹ.", tag: "Nghỉ chân" },
        { time: "19:00", place: "68 Mạc Thái Tổ", note: "Về tới Cầu Giấy, Hà Nội.", tag: "Về tới nơi" },
      ],
    },
  } as const;
  const cabinServices = await prisma.service.findMany({ where: { category: "CABIN" } });
  for (const c of cabinServices) {
    for (const dir of ["OUTBOUND", "RETURN"] as const) {
      const d = cabStops[dir];
      await prisma.cabinRoute.create({
        data: {
          serviceId: c.id, direction: dir, title: d.title, totalTime: d.totalTime,
          startLabel: d.startLabel, startInfo: d.startInfo, fromPoint: d.fromPoint, toPoint: d.toPoint,
          stops: { create: d.stops.map((s, i) => ({ sortOrder: i, time: s.time, place: s.place, note: s.note, tag: s.tag })) },
        },
      });
    }
    await prisma.cabinPriceRow.createMany({
      data: [
        { serviceId: c.id, pickupPoint: "Hà Nội", destination: "Tà Xùa", ticketType: "ROUND_TRIP", price: 500000, sortOrder: 0 },
        { serviceId: c.id, pickupPoint: "Hà Nội", destination: "Tà Xùa", ticketType: "OUTBOUND", price: 300000, sortOrder: 1 },
        { serviceId: c.id, pickupPoint: "Tà Xùa", destination: "Hà Nội", ticketType: "RETURN", price: 300000, sortOrder: 2 },
      ],
    });
  }
  console.log("✅ Lộ trình cabin");

  // Gán chủ dịch vụ demo
  const firstCabin = await prisma.service.findFirst({ where: { category: "CABIN" }, orderBy: { createdAt: "asc" } });
  const firstHome = await prisma.service.findFirst({ where: { category: "HOMESTAY" }, orderBy: { createdAt: "asc" } });
  if (firstCabin) await prisma.service.update({ where: { id: firstCabin.id }, data: { ownerId: chuXe.id } });
  if (firstHome) await prisma.service.update({ where: { id: firstHome.id }, data: { ownerId: chuHome.id } });
  await prisma.adminUser.update({ where: { id: ctvUser.id }, data: { providerId: chuHome.id } });
  console.log("✅ Gán chủ dịch vụ demo");

  console.log("🎉 Seed hoàn tất!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
