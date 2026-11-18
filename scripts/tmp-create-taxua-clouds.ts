/**
 * Tạo "Tà Xùa Clouds Homestay" theo booking engine của chủ nhà (https://taxuaclouds.hotelss.vn)
 * + bổ sung chính sách / bản đồ cho "Cloud Garden" (cùng chủ, cùng chính sách công khai).
 * - Hạng phòng, tiện ích, giá niêm yết lấy từ API be_get_room_types / be_get_availability
 *   (giá đồng đều mọi ngày trong 13 tuần tới tại thời điểm tạo).
 * - TÊN HẠNG PHÒNG = room_type_name của be_get_availability (sheet-sync khớp lịch theo tên hạng);
 *   tên phòng trong API để ở Room.sheetAlias.
 * - Chiết khấu CTV: Thứ 7 10%, các ngày còn lại 20% trên giá niêm yết.
 * Chạy: npx tsx scripts/tmp-create-taxua-clouds.ts   (DATABASE_URL theo .env = prod)
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const SLUG = "ta-xua-clouds-homestay";
const TITLE = "Tà Xùa Clouds Homestay";
const CALENDAR_URL = "https://taxuaclouds.hotelss.vn/?building_id=" + encodeURIComponent("ZI7R8aDUxtx6deBPosY4yQ==");
const COMMON = "Đồ vệ sinh cơ bản, Nước lọc, Quạt, Nóng lạnh, Wifi, Máy sấy & ấm siêu tốc mượn tại lễ tân";

/** Chính sách công khai trên trang đặt phòng của chủ nhà (dùng chung cho 2 cơ sở). */
export const OWNER_POLICY = `Giờ nhận – trả phòng:
- Nhận phòng: 13h00 · Trả phòng: 11h00 (chỉ cần dọn đồ ra khỏi phòng; muốn ở lại dùng bữa trưa hoặc chờ xe có thể gửi đồ tại home).
- Nhận gửi đồ từ 6h30. Nhận phòng sớm trước 6h00 sáng: phụ phí 80.000đ/giờ.
- Phòng đã sẵn sàng từ đêm hôm trước: home hỗ trợ nhận phòng sớm miễn phí từ 7h00.

Hoàn – huỷ:
- Huỷ đặt phòng trước 7 ngày: không thu phí.
- Huỷ trước 3 – 6 ngày: thu phí 50% tiền cọc.
- Huỷ trước 2 ngày: thu phí 100% tiền cọc.
- Trường hợp bất khả kháng (lũ lụt, bão…): có thể dời ngày nhận phòng khi báo trước 8 ngày; huỷ trong vòng 24h vì lý do này chịu phí 50% tiền cọc.`;

type R = { name: string; alias?: string };
type T = {
  name: string; // = room_type_name của API
  label: string;
  price: number;
  capacity: number;
  max: number;
  view?: boolean;
  bed: string;
  note: string;
  rooms: R[];
};
const TYPES: T[] = [
  {
    name: "Double",
    label: "Phòng Double",
    price: 400_000,
    capacity: 2,
    max: 3,
    bed: "1 giường 1m6×2m",
    note: "Phòng đơn khép kín (view bị nhà phía sau che)",
    rooms: [{ name: "Double 1" }, { name: "Double 2" }],
  },
  {
    name: "Bung",
    label: "Bungalow 4 người",
    price: 700_000,
    capacity: 4,
    max: 5,
    view: true,
    bed: "2 giường 1m6×2m",
    note: "Kính view thung lũng mây, có căn có ban công",
    rooms: [1, 2, 3, 4, 5].map((i) => ({ name: `Bung ${i}` })),
  },
  {
    name: "Family 6",
    label: "Family 6 người",
    price: 1_000_000,
    capacity: 6,
    max: 7,
    bed: "3 giường pallet 1m6×2m",
    note: "Phòng ở sân lửa trại, không có view thung lũng mây",
    rooms: [{ name: "Family 6", alias: "F 8, F8" }],
  },
  {
    name: "F6 view",
    label: "Family 6 người view mây",
    price: 1_000_000,
    capacity: 6,
    max: 7,
    view: true,
    bed: "3 giường pallet 1m6×2m",
    note: "Cửa kính view thung lũng mây",
    rooms: [1, 2, 3, 4].map((i) => ({ name: `F6 view ${i}`, alias: `F8-${i}` })),
  },
  {
    name: "Bếp 6",
    label: "Phòng Bếp 6 người",
    price: 1_200_000,
    capacity: 6,
    max: 8,
    view: true,
    bed: "3 giường pallet 1m6×2m",
    note: "Full view thung lũng mây",
    rooms: [{ name: "Bếp 6" }],
  },
  {
    name: "Family 8 (F8)",
    label: "Family 8 người",
    price: 1_500_000,
    capacity: 8,
    max: 10,
    bed: "4 giường pallet 1m6×2m",
    note: "Phòng view sân lửa trại",
    rooms: [{ name: "Family 8", alias: "Dorm" }],
  },
  {
    name: "Bếp 10",
    label: "Phòng Bếp 10 người",
    price: 1_700_000,
    capacity: 10,
    max: 12,
    bed: "5 giường 1m6×2m, 2 WC khép kín",
    note: "Phòng không view thung lũng",
    rooms: [{ name: "Bếp 10" }],
  },
  {
    name: "Panorama",
    label: "Panorama 8 người",
    price: 1_800_000,
    capacity: 8,
    max: 10,
    view: true,
    bed: "4 giường pallet 1m6×2m",
    note: "Full view thung lũng mây",
    rooms: [1, 2, 3, 4].map((i) => ({ name: `Panorama ${i}`, alias: `Pano ${i}` })),
  },
  {
    name: "Big team",
    label: "Nhà sàn Big team",
    price: 3_800_000,
    capacity: 30,
    max: 30,
    bed: "15 nệm 1m6×2m, 2 WC tắm khép kín + khu WC chung bên ngoài",
    note: "Nhà sàn lớn cho đoàn đông, tối đa 30 người",
    rooms: [{ name: "Big team" }],
  },
];

const fmt = (n: number) => n.toLocaleString("vi-VN") + "đ";
const mapUrl = (lat: string, lng: string) => `https://www.google.com/maps?q=${lat},${lng}`;

async function main() {
  // Cloud Garden: bổ sung chính sách công khai + bản đồ (lúc tạo chưa có).
  const cg = await prisma.service.findUnique({ where: { slug: "cloud-garden-ta-xua" }, select: { id: true, policy: true } });
  if (cg && !cg.policy?.includes("Hoàn – huỷ")) {
    await prisma.service.update({
      where: { id: cg.id },
      data: { policy: `${cg.policy ?? ""}\n\n${OWNER_POLICY}`.trim(), mapUrl: mapUrl("21.282639", "104.425750") },
    });
    console.log("Cloud Garden: đã thêm chính sách nhận/trả phòng, hoàn huỷ và bản đồ.");
  }

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
        "Tà Xùa Clouds Homestay — mặt đường chính khu trung tâm Tà Xùa, phòng từ 2 đến 30 khách, sức chứa tới 150 khách/đêm, có nhà hàng riêng; hợp cho đoàn, gia đình, nhóm bạn. Giá từ 400.000đ/đêm.",
      description: `Tà Xùa Clouds Homestay nằm mặt đường chính khu trung tâm Tà Xùa, có hệ thống phòng từ 2 đến 30 khách với sức chứa tối đa 150 khách/đêm — rất thuận tiện cho khách đoàn, gia đình, nhóm bạn và tour. Home có nhà hàng riêng phục vụ các món đặc trưng vùng cao, có sân lửa trại.

Home có 20 phòng:
- **Phòng Double** (2 phòng): 1 giường 1m6×2m, 2 khách.
- **Bungalow 4 người** (Bung 1 – 5): 2 giường 1m6×2m, kính view thung lũng mây, có căn có ban công.
- **Family 6 người**: 1 phòng ở sân lửa trại và 4 phòng view thung lũng mây (F6 view 1 – 4), mỗi phòng 3 giường pallet 1m6×2m.
- **Phòng Bếp 6 người**: full view thung lũng mây.
- **Family 8 người**: 4 giường pallet, view sân lửa trại.
- **Phòng Bếp 10 người**: 5 giường, 2 WC khép kín.
- **Panorama 8 người** (Panorama 1 – 4): 4 giường pallet, full view thung lũng mây.
- **Nhà sàn Big team**: 15 nệm, tối đa 30 người, cho đoàn đông.

Tất cả phòng khép kín, có đồ vệ sinh cơ bản, nước lọc, quạt, nóng lạnh, wifi; máy sấy và ấm siêu tốc mượn tại lễ tân.`,
      policy: `Giá phòng (theo số khách tiêu chuẩn):
${TYPES.map((t) => `- ${t.label} (${t.capacity} khách${t.max > t.capacity ? `, tối đa ${t.max}` : ""}): ${fmt(t.price)}/đêm`).join("\n")}

Phụ thu: 100.000đ/người khi vượt số khách tiêu chuẩn của phòng.

${OWNER_POLICY}`,
      area: "Trung tâm Tà Xùa",
      distanceKm: 0,
      mapUrl: mapUrl("21.279618", "104.428212"),
      basePrice: Math.min(...TYPES.map((t) => t.price)),
      priceUnit: "/đêm",
      contactName: TITLE,
      published: true,
      easyRoad: true,
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
        cloudView: !!t.view,
        sortOrder: ti,
      },
    });
    for (const r of t.rooms) {
      await prisma.room.create({
        data: {
          roomTypeId: rt.id,
          name: r.name,
          sheetAlias: r.alias ?? null,
          description: `${t.label} · ${t.note} · ${t.bed} · tiêu chuẩn ${t.capacity} khách${t.max > t.capacity ? `, tối đa ${t.max} khách (phụ thu 100.000đ/người)` : ""}`,
          amenities: `${t.view ? "View thung lũng mây, " : ""}${COMMON}`,
          capacity: t.capacity,
          maxCapacity: t.max,
          listPrice: t.price,
          commission: Math.round(t.price * 0.2), // ngày thường: 20% giá niêm yết
          commissionSat: Math.round(t.price * 0.1), // Thứ 7: 10%
          sortOrder: sort++,
        },
      });
    }
    console.log(`  ${t.name} ${fmt(t.price)}: ${t.rooms.map((r) => r.name).join(", ")}`);
  }
  console.log(`Đã tạo ${TITLE} — id ${svc.id}, slug ${SLUG}`);
}
main().finally(() => prisma.$disconnect());
