/**
 * Tạo 2 homestay "Cloud Forest Tà Xùa" + "Sunset Clouds Tà Xùa" (bản Chung Trinh) từ sheet
 * chủ nhà (tab "Hạng Phòng Cloud Forest" / "Hạng Phòng Sunset Cloud" + ảnh bảng giá Vip 360).
 * Cả 2 dùng CHUNG 1 sheet lịch (các tab tháng) — mỗi home chỉ khớp phòng của mình.
 * Giá: listPrice = T2–T5 · priceFri/priceSun = T6 & CN · priceSat = T7.
 * Chiết khấu (đ/phòng/đêm):
 *  - Cloud Forest: 10% giá đêm T2–T6 + CN, T7 = 0; hạng VIP (Tree House, Panorama, VIP 360) 100k/đêm, T7 = 0.
 *  - Sunset: 15% mọi ngày.
 * Chạy: npx tsx scripts/tmp-create-cloudforest-sunset.ts
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const SHEET_URL = "https://docs.google.com/spreadsheets/d/1giYDzCTm5e_FtlaOU3iBk7SLnnw85kCztfMgL1O-ig4/edit?usp=sharing";

type Comm = { kind: "pct"; pct: number; sat: boolean } | { kind: "flat"; amount: number };
interface RoomDef {
  name: string;
  alias?: string;
  weekday: number;
  friSun: number;
  sat: number;
  capacity: number;
  maxCapacity: number | null;
  amenities: string;
  description: string;
}
interface RtDef {
  name: string;
  hasBathtub: boolean;
  cloudView: boolean;
  breakfast: boolean;
  airCon: boolean;
  heating: boolean;
  comm: Comm;
  rooms: RoomDef[];
}
interface HomeDef {
  slug: string;
  title: string;
  summary: string;
  description: string;
  policy: string;
  extraPersonFee: number | null;
  childFreeUnderAge: number;
  roomTypes: RtDef[];
}

const CF_COMM: Comm = { kind: "pct", pct: 0.1, sat: false };
const CF_VIP: Comm = { kind: "flat", amount: 100_000 };
const CF_BASE = "Ô mai, nước lọc, cà phê miễn phí, Tủ lạnh, Ấm siêu tốc, Máy sấy tóc, Bình nóng lạnh, Đệm điện, Ăn sáng";

const house = (
  name: string, weekday: number, friSun: number, sat: number, maxCapacity: number | null,
  extra: string, description: string, alias?: string,
): RoomDef => ({
  name, alias, weekday, friSun, sat, capacity: 2, maxCapacity,
  amenities: `${extra}, ${CF_BASE}`, description,
});

const CLOUD_FOREST: HomeDef = {
  slug: "cloud-forest-ta-xua",
  title: "Cloud Forest Tà Xùa",
  summary:
    "Cloud Forest Tà Xùa — quần thể nhà gỗ giữa rừng tại bản Chung Trinh: 10 căn house riêng 45–50m² (nhiều căn có bồn tắm view thung lũng), căn VIP giường tròn xoay view 360°, Panorama VIP vách kính và phòng đôi giá mềm; giá đã gồm ăn sáng, có nhà hàng trong khu.",
  description: `Cloud Forest Tà Xùa ("To be on cloud nine") nằm tại bản Chung Trinh, Tà Xùa — quần thể nhà gỗ ẩn mình giữa rừng, phòng nào cũng hướng thẳng xuống thung lũng và bản Chung Trinh, mùa mây có thể săn mây ngay tại phòng.

Các hạng phòng:
- 10 căn house riêng (Lù, Lầu, Mùa, Vừ, Giàng, Thào, Forest, Wind, Mountain View, VIP Tree House) rộng 45–50m², phần lớn 2 phòng ngủ + gác mái chill, tiêu chuẩn 2 khách, nhận tối đa 6 khách; nhiều căn có bồn tắm cao cấp/siêu rộng view thung lũng.
- Căn VIP View 360°: giường tròn xoay, bồn tắm view núi ngay trong phòng, cửa kính lớn săn mây, rèm tự động, đèn LED trang trí.
- Panorama VIP 1 & 2: 40m², vách kính rộng hướng thung lũng, 2 giường lớn.
- Mị House & A Phủ House: phòng đôi view núi rừng Tây Bắc, giá mềm (WC bên ngoài).

Tiện ích: giá phòng đã gồm bữa sáng · ô mai, nước lọc, cà phê miễn phí · tủ lạnh, ấm siêu tốc, máy sấy tóc · bình nóng lạnh, đệm điện · nhà hàng Cloud Forest trong khuôn viên.`,
  policy: `Nhận phòng 14:00 · Trả phòng 12:00 (khách trải nghiệm trong ngày: 6:30 – 18:30).
Giá phòng theo thứ: T2–T5 giá thường · T6 & Chủ nhật · Thứ 7 giá cuối tuần. Giá tiêu chuẩn cho 2 khách, đã gồm bữa sáng.
Phụ thu từ khách thứ 3: 500.000đ/khách/đêm (đã gồm ăn sáng). Miễn phí phụ thu trẻ dưới 5 tuổi.
Đặt cọc: ngày trong tuần cọc 50% tiền phòng; Thứ 7 và Lễ Tết cọc 100%. Phần còn lại thanh toán khi check-in, dịch vụ khác thanh toán khi check-out.
Hoàn/huỷ (lưu trú 1 đêm): huỷ/dời trước 7 ngày hoàn 100% cọc · trong 3–7 ngày hoàn 50% cọc · trong 1–3 ngày không hoàn cọc.
Hoàn/huỷ (từ 2 đêm): huỷ trước 7 ngày hoàn 100% cọc · trong 5 ngày hoàn 50% cọc · huỷ ngày check-in/không đến không hoàn cọc · đặt 2 đêm chỉ ở 1 đêm hoàn 50% tiền các đêm sau.
Khi nhận phòng đặt cọc 1.000.000đ tiền mặt cho quản lý (hoàn lại khi trả phòng nếu không có hư hỏng). Mất/hỏng chìa khoá: 200.000đ/chìa.
Nội quy: không hút thuốc, không ăn uống/đun nấu trong phòng ngủ; TUYỆT ĐỐI KHÔNG mang thú cưng (pet) vào home; tuyệt đối không sử dụng chất cấm.`,
  extraPersonFee: 500_000,
  childFreeUnderAge: 5,
  roomTypes: [
    {
      name: "House view bản Chung Trinh",
      hasBathtub: false, cloudView: true, breakfast: true, airCon: false, heating: true, comm: CF_COMM,
      rooms: [
        house("Lù House", 1_500_000, 1_700_000, 2_200_000, 6,
          "Rộng 45m2, 1 giường lớn + 2 giường double, Đèn sưởi nhà tắm, Góc chill cửa sổ",
          "Căn Lù House 45m² · 1 giường lớn + 2 giường double · phòng ngủ view thẳng xuống bản Chung Trinh"),
        house("Lầu House", 1_500_000, 1_700_000, 2_200_000, 6,
          "Rộng 45m2, 1 giường lớn + 2 giường double, Góc chill cửa sổ",
          "Căn Lầu House 45m² · 1 giường lớn + 2 giường double · phòng ngủ view thẳng xuống bản Chung Trinh"),
      ],
    },
    {
      name: "House 2 phòng ngủ có bồn tắm",
      hasBathtub: true, cloudView: true, breakfast: true, airCon: false, heating: true, comm: CF_COMM,
      rooms: [
        house("Mùa House", 1_800_000, 2_000_000, 2_500_000, 6,
          "Rộng 50m2, 2 phòng ngủ, 1 giường lớn + 2 giường nhỏ, Bồn tắm, Gác mái chill",
          "Căn Mùa House 50m² · 2 phòng ngủ · gác mái chill · bồn tắm đơn"),
        house("Vừ House", 1_600_000, 1_800_000, 2_300_000, 6,
          "Rộng 50m2, 2 phòng ngủ, 1 giường lớn + 1 giường đôi, Bồn tắm view thung lũng, Gác mái chill",
          "Căn Vừ House 50m² · 2 phòng ngủ · bồn tắm cao cấp view thung lũng"),
        house("Giàng House", 1_500_000, 1_700_000, 2_200_000, 4,
          "Rộng 50m2, 2 phòng ngủ, 1 giường lớn + 2 giường nhỏ, Bồn tắm view thung lũng, Gác mái chill",
          "Căn Giàng House 50m² · 2 phòng ngủ · bồn tắm cao cấp view thung lũng"),
        house("Thào House", 1_500_000, 1_700_000, 2_200_000, 6,
          "Rộng 50m2, 2 phòng ngủ, 1 giường lớn + 2 giường nhỏ, Bồn tắm view thung lũng, Đèn sưởi nhà tắm, Gác mái chill",
          "Căn Thào House 50m² · 2 phòng ngủ · bồn tắm cao cấp view thung lũng"),
      ],
    },
    {
      name: "House bồn tắm siêu rộng",
      hasBathtub: true, cloudView: true, breakfast: true, airCon: false, heating: true, comm: CF_COMM,
      rooms: [
        house("Forest House", 1_800_000, 2_000_000, 2_500_000, 6,
          "Rộng 50m2, 1 giường lớn + 2 giường đôi, Bồn tắm siêu rộng, Ban công hướng thung lũng, Phòng khách rộng",
          "Nhà Forest House 50m² · ban công rộng hướng thung lũng · bồn tắm siêu rộng tầng dưới view trọn bản Chung Trinh"),
        house("Wind House", 1_800_000, 2_000_000, 2_500_000, 6,
          "Rộng 50m2, 3 giường nhỏ, Bồn tắm siêu rộng, Đèn sưởi nhà tắm, Phòng khách rộng",
          "Căn Wind House 50m² · 3 giường · bồn tắm siêu rộng tầng dưới view trọn bản Chung Trinh"),
        house("Mountain View House", 1_900_000, 2_100_000, 2_600_000, 6,
          "Rộng 50m2, 2 phòng ngủ, 2 giường đôi, Bồn tắm siêu rộng, View núi 2 mặt, Ban công ghế lười",
          "Căn Mountain View House 50m² · view núi rừng Tây Bắc 2 mặt không bị chắn · balcon 2 ghế lười",
          "Moutain View House, Moutian View House"),
      ],
    },
    {
      name: "VIP Tree House",
      hasBathtub: true, cloudView: true, breakfast: true, airCon: false, heating: true, comm: CF_VIP,
      rooms: [
        house("VIP Tree House", 1_900_000, 2_300_000, 2_800_000, 3,
          "Rộng 50m2, 1 giường lớn, Bồn tắm siêu rộng ngoài ban công, Ban công có bàn",
          "Nhà VIP Tree House 50m² · bồn tắm siêu rộng ngoài ban công view Chung Trinh · tối đa 3 khách"),
      ],
    },
    {
      name: "Panorama VIP",
      hasBathtub: false, cloudView: true, breakfast: true, airCon: false, heating: true, comm: CF_VIP,
      rooms: [1, 2].map((n) =>
        house(`Panorama VIP ${n}`, 1_900_000, 2_000_000, 2_500_000, 4,
          "Rộng 40m2, 2 giường lớn, Vách kính rộng hướng thung lũng, Bàn nhỏ view Chung Trinh",
          `Panorama VIP ${n} · 40m² · vách kính rộng hướng thung lũng · tối đa 4 khách`)),
    },
    {
      name: "VIP View 360°",
      hasBathtub: true, cloudView: true, breakfast: true, airCon: false, heating: true, comm: CF_VIP,
      rooms: [1, 2].map((n) =>
        house(`VIP 360 ${n}`, 2_100_000, 2_500_000, 3_000_000, 4,
          "Giường tròn xoay, Bồn tắm view núi trong phòng, Cửa kính lớn săn mây, Rèm tự động, Đèn LED trang trí, Minibar miễn phí",
          `Căn VIP View 360° số ${n} · giường tròn xoay · bồn tắm view núi · săn mây ngay tại phòng`,
          `Vip Xoay ${n}, Vip360 ${n}`)),
    },
    {
      name: "Phòng đôi view núi (WC chung)",
      hasBathtub: false, cloudView: false, breakfast: true, airCon: false, heating: false, comm: CF_COMM,
      rooms: ["Mị House", "A Phủ House"].map((name) => ({
        name, weekday: 700_000, friSun: 800_000, sat: 900_000, capacity: 2, maxCapacity: null,
        amenities: "Giường đôi 1m6x1m8, View núi rừng, Khăn tắm, Ấm siêu tốc, Máy sấy tóc, Ăn sáng, WC bên ngoài",
        description: `${name} · phòng đôi view núi rừng Tây Bắc · chỉ nhận 2 khách · phòng không khép kín (WC bên ngoài)`,
      })),
    },
  ],
};

const SS_COMM: Comm = { kind: "pct", pct: 0.15, sat: true };
const SS_BASE = "Điều hòa 2 chiều, Kệ quần áo, Gương soi toàn thân, WC khép kín, View săn mây tại phòng, Sữa tắm & dầu gội thân thiện";

const SUNSET: HomeDef = {
  slug: "sunset-clouds-ta-xua",
  title: "Sunset Clouds Tà Xùa",
  summary:
    "Sunset Clouds Tà Xùa — homestay tại bản Chung Trinh, phòng nào cũng săn mây ngay tại phòng: 4 căn Family VIP 2 tầng cho nhóm 6 khách, 4 phòng Blue cho cặp đôi và căn nhà gỗ Sunset Family; điều hòa 2 chiều, WC khép kín.",
  description: `Sunset Clouds Tà Xùa nằm tại bản Chung Trinh, Tà Xùa — nơi ngắm hoàng hôn và biển mây ngay từ phòng ngủ.

Các hạng phòng:
- Family VIP (4 căn): thiết kế 2 tầng, tầng 1 giường 1m6 x 2m, tầng 2 kê thêm 2 đệm 1m6 x 2m — tiêu chuẩn 6 khách, hợp gia đình/nhóm bạn.
- Blue (4 phòng): phòng đơn 1 giường 1m6 x 2m cho 2 khách.
- Sunset Family: căn nhà gỗ đơn 1 giường ngủ + kê thêm đệm.

Mọi phòng có điều hòa 2 chiều, kệ quần áo, gương soi toàn thân, WC khép kín, view săn mây ngay tại phòng; sữa tắm, dầu gội, bàn chải là sản phẩm thân thiện môi trường.`,
  policy: `Địa chỉ: Bản Chung Trinh, Tà Xùa.
Giá phòng theo thứ: T2–T5 giá thường · T6 & Chủ nhật · Thứ 7 giá cuối tuần.
TUYỆT ĐỐI KHÔNG mang thú cưng (pet) vào home.`,
  extraPersonFee: null,
  childFreeUnderAge: 6,
  roomTypes: [
    {
      name: "Family VIP",
      hasBathtub: false, cloudView: true, breakfast: false, airCon: true, heating: false, comm: SS_COMM,
      rooms: [1, 2, 3, 4].map((n) => ({
        name: `Family VIP ${n}`, weekday: 2_000_000, friSun: 2_200_000, sat: 2_500_000, capacity: 6, maxCapacity: null,
        amenities: `2 tầng, Giường 1m6x2m + 2 đệm 1m6x2m, ${SS_BASE}`,
        description: `Family VIP ${n} · 2 tầng · tiêu chuẩn 6 khách · săn mây tại phòng`,
      })),
    },
    {
      name: "Blue (Phòng đôi)",
      hasBathtub: false, cloudView: true, breakfast: false, airCon: true, heating: false, comm: SS_COMM,
      rooms: [1, 2, 3, 4].map((n) => ({
        name: `Blue ${n}`, weekday: 1_000_000, friSun: 1_200_000, sat: 1_400_000, capacity: 2, maxCapacity: null,
        amenities: `Giường 1m6x2m, ${SS_BASE}`,
        description: `Phòng Blue ${n} · 1 giường 1m6 x 2m · 2 khách · săn mây tại phòng`,
      })),
    },
    {
      name: "Sunset Family",
      hasBathtub: false, cloudView: true, breakfast: false, airCon: true, heating: false, comm: SS_COMM,
      rooms: [{
        name: "Sunset Family 4", weekday: 800_000, friSun: 1_000_000, sat: 1_200_000, capacity: 2, maxCapacity: null,
        amenities: `Nhà gỗ đơn, 1 giường + kê thêm đệm, ${SS_BASE}`,
        description: "Sunset Family · căn nhà gỗ đơn 1 giường + kê thêm đệm · săn mây tại phòng",
      }],
    },
  ],
};

function commission(c: Comm, r: RoomDef) {
  if (c.kind === "flat") return { commission: c.amount, commissionSat: 0 };
  const k = (v: number) => Math.round((v * c.pct) / 1000) * 1000;
  return {
    commission: k(r.weekday),
    commissionFri: k(r.friSun),
    commissionSun: k(r.friSun),
    commissionSat: c.sat ? k(r.sat) : 0,
  };
}

async function createHome(h: HomeDef) {
  const existing = await prisma.service.findUnique({ where: { slug: h.slug } });
  if (existing) {
    console.log(`Đã tồn tại ${h.slug} (${existing.id}) — bỏ qua.`);
    return;
  }
  const minPrice = Math.min(...h.roomTypes.flatMap((rt) => rt.rooms.map((r) => r.weekday)));
  const svc = await prisma.service.create({
    data: {
      slug: h.slug,
      category: "HOMESTAY",
      title: h.title,
      summary: h.summary,
      description: h.description,
      policy: h.policy,
      area: "Bản Chung Trinh, Tà Xùa",
      basePrice: minPrice,
      priceUnit: "/đêm",
      contactName: h.title,
      published: true,
      sheetUrl: SHEET_URL,
      extraPersonFee: h.extraPersonFee,
      childFreeUnderAge: h.childFreeUnderAge,
    },
  });
  console.log(`\n${svc.title} (${svc.id})`);
  let rtSort = 0;
  let roomSort = 0;
  for (const rt of h.roomTypes) {
    const r0 = rt.rooms[0];
    const roomType = await prisma.roomType.create({
      data: {
        serviceId: svc.id,
        name: rt.name,
        capacity: r0.capacity,
        weekdayPrice: r0.weekday,
        weekendPrice: r0.sat,
        priceFri: r0.friSun,
        priceSat: r0.sat,
        priceSun: r0.friSun,
        totalRooms: rt.rooms.length,
        hasBathtub: rt.hasBathtub,
        cloudView: rt.cloudView,
        breakfast: rt.breakfast,
        airCon: rt.airCon,
        heating: rt.heating,
        sortOrder: rtSort++,
      },
    });
    for (const r of rt.rooms) {
      await prisma.room.create({
        data: {
          roomTypeId: roomType.id,
          name: r.name,
          sheetAlias: r.alias ?? null,
          description: r.description,
          amenities: r.amenities,
          capacity: r.capacity,
          maxCapacity: r.maxCapacity,
          listPrice: r.weekday,
          priceFri: r.friSun,
          priceSat: r.sat,
          priceSun: r.friSun,
          ...commission(rt.comm, r),
          sortOrder: roomSort++,
        },
      });
    }
    console.log(`  + ${rt.name}: ${rt.rooms.map((r) => r.name).join(", ")}`);
  }
}

async function main() {
  await createHome(CLOUD_FOREST);
  await createHome(SUNSET);
}
main().finally(() => prisma.$disconnect());
