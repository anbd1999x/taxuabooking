/**
 * Tạo "Nhặt Nắng House" theo sheet bảng giá + lịch của chủ nhà
 * (docs.google.com/spreadsheets/d/1Nea2BLjBss97rvT1t3BZLjhn2pJ8NFcmHfENBsnRkP0).
 * - Phòng đơn (2, tối đa 3): CN–T6 650k · T7 950k · Lễ 1.200k — riêng Mây Đào +100k.
 * - Phòng đôi (4, tối đa 6): CN–T6 850k · T7 1.250k · Lễ 1.600k — riêng Nắng 3 −100k.
 * - Phụ thu 200k/người; trẻ từ 4 tuổi trở xuống miễn phí. Bảng giá của chủ nhà là "giá thu về".
 * Chạy: npx tsx scripts/tmp-create-nhat-nang.ts   (DATABASE_URL theo .env = prod)
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const SLUG = "nhat-nang-house-ta-xua";
const TITLE = "Nhặt Nắng House";
const SHEET_URL = "https://docs.google.com/spreadsheets/d/1Nea2BLjBss97rvT1t3BZLjhn2pJ8NFcmHfENBsnRkP0/edit";
const COMMON = "Phòng khép kín, Bàn chải tre & kem đánh răng, Sữa tắm, Dầu gội, Khăn tắm, Máy sấy tóc, Ấm siêu tốc";
const SINGLE = { capacity: 2, max: 3, weekday: 650_000, sat: 950_000, holiday: 1_200_000 };
const DOUBLE = { capacity: 4, max: 6, weekday: 850_000, sat: 1_250_000, holiday: 1_600_000 };

type R = { name: string; alias?: string; extra: string; delta?: number };
type T = {
  name: string;
  base: typeof SINGLE;
  bed: string;
  hasBathtub?: boolean;
  airCon?: boolean;
  heating?: boolean;
  rooms: R[];
};
const TYPES: T[] = [
  {
    name: "Phòng đơn bồn tắm",
    base: SINGLE,
    bed: "1 giường",
    hasBathtub: true,
    rooms: [
      { name: "Nắng 2", extra: "Bồn tắm, Đệm sưởi" },
      { name: "Nắng 4", extra: "Bồn tắm, Điều hoà" },
      { name: "Mây Đào", extra: "Bồn tắm, Điều hoà", delta: 100_000 },
    ],
  },
  {
    name: "Phòng đơn điều hoà",
    base: SINGLE,
    bed: "1 giường",
    airCon: true,
    rooms: [
      { name: "Đào 102", extra: "Điều hoà" },
      { name: "Đào 103", extra: "Điều hoà" },
      { name: "Đào 104", extra: "Điều hoà" },
      { name: "Đào 105", extra: "Điều hoà" },
      { name: "Đào 201", alias: "201", extra: "Điều hoà" },
      { name: "Đào 203", alias: "203", extra: "Điều hoà" },
    ],
  },
  {
    name: "Phòng đơn đệm sưởi",
    base: SINGLE,
    bed: "1 giường",
    heating: true,
    rooms: [
      { name: "Nắng 5", extra: "Đệm sưởi" },
      { name: "Đào 101", extra: "Đệm sưởi" },
      { name: "Mận 1", alias: "1( căn dưới)", extra: "Đệm sưởi" },
      { name: "Mận 2", alias: "2(căn trên)", extra: "Đệm sưởi" },
    ],
  },
  {
    name: "Phòng đôi family",
    base: DOUBLE,
    bed: "2 giường",
    heating: true,
    rooms: [{ name: "Nắng 3", extra: "Đệm sưởi", delta: -100_000 }],
  },
  {
    name: "Phòng đôi gác xép",
    base: DOUBLE,
    bed: "2 giường, có gác xép",
    airCon: true,
    rooms: [
      { name: "Đào family 202", extra: "Điều hoà, Gác xép" },
      { name: "Đào family 204", extra: "Điều hoà, Gác xép" },
      { name: "Đào family 205", extra: "Điều hoà, Gác xép" },
    ],
  },
];

const fmt = (n: number) => n.toLocaleString("vi-VN") + "đ";
const line = (label: string, b: typeof SINGLE, d = 0) =>
  `- ${label} (${b.capacity} khách, tối đa ${b.max}): CN–Thứ 6 ${fmt(b.weekday + d)} · Thứ 7 ${fmt(b.sat + d)} · Lễ ${fmt(b.holiday + d)}`;

async function main() {
  const existing = await prisma.service.findFirst({
    where: { OR: [{ slug: SLUG }, { title: { contains: "Nhặt Nắng", mode: "insensitive" } }] },
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
        "Nhặt Nắng House Tà Xùa — 17 căn riêng chia 3 khu Nắng, Đào, Mận trong tổ hợp có tiệm ăn Xuân Thì và cà phê; có căn bồn tắm, căn family gác xép cho 4–6 người, phòng điều hoà hoặc đệm sưởi.",
      description: `Nhặt Nắng House là homestay phòng riêng ở Tà Xùa, nằm trong tổ hợp lưu trú – nhà hàng – cà phê cùng Tiệm ăn Xuân Thì (khách ở home được giảm 10% tại Xuân Thì). Các căn chia thành 3 khu gần nhau: khu Nắng, khu Đào và khu Mận.

Home có 17 căn:
- **Phòng đơn** (tiêu chuẩn 2 khách, tối đa 3): Nắng 2 và Nắng 4 có bồn tắm; Mây Đào có bồn tắm và điều hoà; Nắng 5, Đào 101, Mận 1, Mận 2 có đệm sưởi; Đào 102 – 105, Đào 201, Đào 203 có điều hoà.
- **Phòng đôi** (tiêu chuẩn 4 khách, tối đa 6, kê thêm đệm): Nắng 3 (family, đệm sưởi) và Đào family 202, 204, 205 (gác xép, điều hoà).

Phòng có sẵn bàn chải đánh răng bằng tre, kem đánh răng, sữa tắm, dầu gội, khăn tắm, máy sấy tóc, ấm siêu tốc.

Nhận phòng từ 14h00, trả phòng trước 12h00. Home làm việc 7h30 – 22h, nhận gửi hành lý từ 7h30 sáng.`,
      policy: `Giá phòng (theo số khách tiêu chuẩn, chưa gồm phụ thu thêm người):
${line("Phòng đơn", SINGLE)}
${line("Phòng đơn Mây Đào", SINGLE, 100_000)}
${line("Phòng đôi", DOUBLE)}
${line("Phòng đôi Nắng 3", DOUBLE, -100_000)}

Phụ thu:
- Thêm người: 200.000đ/người. Trẻ em từ 4 tuổi trở xuống miễn phí, trên 4 tuổi tính như người lớn.
- Mang theo chó/mèo (phải báo trước và được home đồng ý): phụ thu 200.000đ.
- Thuê bát đũa/bếp qua nhà hàng Xuân Thì: 150.000đ/người (phí thuê đồ và dọn dẹp).

Giờ nhận – trả phòng:
- Nhận phòng từ 14h00 · Trả phòng trước 12h00.
- Nhận phòng sớm (khi phòng trống từ hôm trước): phụ thu 200.000đ/phòng. Trả phòng muộn có phụ thu.
- Home làm việc 7h30 – 22h; nhận gửi hành lý từ 7h30 sáng. Sau 20h00 nhân viên nghỉ, cần hỗ trợ vui lòng báo sớm.
- Cần thêm chăn, gối, đệm phụ: báo lễ tân trước 15h00.

Hoàn – huỷ:
- Home không hoàn – huỷ booking.
- Hỗ trợ bảo lưu cọc, dời lịch trong 30 ngày khi khách báo trước 96 tiếng trước giờ check-in; giá phòng tính theo thời điểm ngày đi. Không áp dụng với khách nay cọc mai đi.
- Báo dời lịch sát ngày hơn quy định: khách tự nhượng (pass) phòng để nhận lại cọc; không dời lịch và không hoàn cọc.
- Chỉ hỗ trợ dời lịch 01 lần; dời lịch từ lần thứ 2 tính phí 100.000đ/phòng. Dời lịch quá 30 ngày bảo lưu: phí 200.000đ/phòng.
- Trường hợp bất khả kháng (bão lũ, sạt lở, thiên tai): bảo lưu cọc trong 30 ngày, báo trước 2 ngày, giá tính theo thời điểm đi.

Nội quy:
- Không mang thực phẩm vào homestay; hạn chế ăn uống trong phòng ngủ, không dùng đồ ăn có mùi nồng (sầu riêng, mắm tôm, cá khô, đồ nướng…).
- Không hút thuốc trong phòng. Nghiêm cấm chất kích thích, vũ khí, chất cháy nổ, đánh bạc dưới mọi hình thức.
- Kiểm tra cơ sở vật chất khi nhận phòng, có vấn đề báo home trong vòng 30 phút.
- Không di chuyển, thay đổi vị trí vật dụng trong phòng; hư hại cơ sở vật chất, chăn ga không tẩy giặt được sẽ bồi thường theo giá niêm yết tại home.
- Không làm ồn từ 22h00 đến 06h00; nhắc quá 2 lần home xin phép từ chối phục vụ.
- Khách tự bảo quản tài sản cá nhân.`,
      area: "Tà Xùa",
      basePrice: SINGLE.weekday,
      priceUnit: "/đêm",
      contactName: TITLE,
      published: true,
      extraPersonFee: 200_000,
      childFreeUnderAge: 5,
      sheetUrl: SHEET_URL,
    },
  });

  let sort = 0;
  for (const [ti, t] of TYPES.entries()) {
    const b = t.base;
    const rt = await prisma.roomType.create({
      data: {
        serviceId: svc.id,
        name: t.name,
        capacity: b.capacity,
        weekdayPrice: b.weekday + (t.rooms.length === 1 ? (t.rooms[0].delta ?? 0) : 0),
        weekendPrice: b.sat + (t.rooms.length === 1 ? (t.rooms[0].delta ?? 0) : 0),
        holidayPrice: b.holiday + (t.rooms.length === 1 ? (t.rooms[0].delta ?? 0) : 0),
        priceSat: b.sat + (t.rooms.length === 1 ? (t.rooms[0].delta ?? 0) : 0),
        priceSun: b.weekday + (t.rooms.length === 1 ? (t.rooms[0].delta ?? 0) : 0),
        totalRooms: t.rooms.length,
        hasBathtub: !!t.hasBathtub,
        airCon: !!t.airCon,
        heating: !!t.heating,
        sortOrder: ti,
      },
    });
    for (const r of t.rooms) {
      const d = r.delta ?? 0;
      await prisma.room.create({
        data: {
          roomTypeId: rt.id,
          name: r.name,
          sheetAlias: r.alias ?? null,
          description: `${t.name} · ${t.bed} · tiêu chuẩn ${b.capacity} khách, tối đa ${b.max} khách (phụ thu 200.000đ/người) · Lễ ${fmt(b.holiday + d)}/đêm`,
          amenities: `${r.extra}, ${COMMON}`,
          capacity: b.capacity,
          maxCapacity: b.max,
          listPrice: b.weekday + d, // CN–Thứ 6
          priceSat: b.sat + d,
          sortOrder: sort++,
        },
      });
    }
    console.log(`  ${t.name}: ${t.rooms.map((r) => r.name + (r.delta ? ` (${r.delta > 0 ? "+" : ""}${r.delta / 1000}k)` : "")).join(", ")}`);
  }
  console.log(`Đã tạo ${TITLE} — id ${svc.id}, slug ${SLUG}`);
}
main().finally(() => prisma.$disconnect());
