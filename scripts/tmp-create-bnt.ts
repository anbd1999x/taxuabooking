/**
 * Tạo homestay "Bếp Nhà Táo" (Khe Cải — cơ sở 2) + 5 hạng phòng + 13 phòng
 * (Phòng 1–13, sheet ghi "PHÒNG 1"/"P6"; Drive gọi là Mây 1–13).
 * Giá niêm yết: CN–T6 = listPrice · T7 = priceSat · Lễ tết ghi ở holidayPrice.
 * Chiết khấu CTV 100k/phòng (CN–T6 và T7 như nhau).
 * Chạy: npx tsx scripts/tmp-create-bnt.ts
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const SLUG = "bep-nha-tao";
const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1JILC7am7luML5Rpt9oYaPVXCcIAG4pHKGmB1bUxLajc/edit?gid=504658563#gid=504658563";

interface RtDef {
  name: string;
  weekday: number;
  sat: number;
  holiday: number;
  capacity: number;
  maxCapacity: number | null;
  hasBathtub: boolean;
  rooms: string[];
}

const ROOM_TYPES: RtDef[] = [
  {
    name: "Phòng đôi 2 giường",
    weekday: 1_000_000, sat: 1_300_000, holiday: 1_500_000,
    capacity: 4, maxCapacity: 5, hasBathtub: false,
    rooms: ["Phòng 1", "Phòng 2"],
  },
  {
    name: "Phòng 3 giường",
    weekday: 1_200_000, sat: 1_500_000, holiday: 1_700_000,
    capacity: 6, maxCapacity: 7, hasBathtub: false,
    rooms: ["Phòng 3"],
  },
  {
    name: "Phòng 3 giường có bồn tắm",
    weekday: 1_200_000, sat: 1_500_000, holiday: 1_700_000,
    capacity: 6, maxCapacity: 7, hasBathtub: true,
    rooms: ["Phòng 8"],
  },
  {
    name: "Phòng đơn",
    weekday: 800_000, sat: 1_000_000, holiday: 1_200_000,
    capacity: 2, maxCapacity: 3, hasBathtub: false,
    rooms: ["Phòng 4", "Phòng 5", "Phòng 11", "Phòng 12"],
  },
  {
    name: "Phòng đơn có bồn tắm",
    weekday: 800_000, sat: 1_000_000, holiday: 1_200_000,
    capacity: 2, maxCapacity: 3, hasBathtub: true,
    rooms: ["Phòng 6", "Phòng 7", "Phòng 9", "Phòng 10", "Phòng 13"],
  },
];

const COMMISSION = 100_000;

const SUMMARY =
  "Bếp Nhà Táo — Khe Cải, Tà Xùa (cơ sở 2 Đồi Mây): 13 phòng gồm phòng đơn, phòng đơn có bồn tắm, phòng đôi 2 giường và phòng 3 giường; homestay kèm nhà hàng, cafe; điều hòa, đệm sưởi, wifi toàn khu.";

const DESCRIPTION = `Bếp Nhà Táo (Khe Cải — cơ sở 2 trong hệ thống Đồi Mây Tà Xùa) là homestay kết hợp nhà hàng và cafe, gồm 13 phòng: phòng đơn tiêu chuẩn 2 khách (một số phòng có bồn tắm), phòng đôi 2 giường tiêu chuẩn 4 khách và phòng 3 giường tiêu chuẩn 6 khách.

Dịch vụ bao gồm:
- Phòng nghỉ theo tiêu chuẩn, giường kích thước 1.8m × 2.0m
- Nước lọc miễn phí trong phòng
- Bàn chải đánh răng, sữa tắm, dầu gội, khăn tắm
- Trang thiết bị: điều hòa, máy sấy, quạt điện, ĐỆM SƯỞI, bình nóng lạnh, dép, loa Bluetooth, đèn ngủ, ghế thư giãn...
- Wifi trong khu vực homestay

Dịch vụ ngoài: ăn sáng mỳ tôm 35k · cơm trưa 90k/người · tối lẩu, nướng, mẹt nướng Tây Bắc · cafe · thuê xe máy 200k/ngày. Nhận đặt ăn, book tour, combo du lịch, taxi, tổ chức sự kiện ở Tà Xùa.

Giờ nhận phòng: check-in sau 14h00 · check-out trước 12h00. Nếu còn phòng trống: nhận phòng trước 6h phụ thu 50% giá niêm yết, 7h–10h phụ thu 30%, sau 10h miễn phí; trả muộn trước 15h phụ thu 30%, trước 18h 50%, sau 18h 100% giá niêm yết.

Hotline: 0355 360 227 – 0866 008 000.`;

const POLICY = `Giá Lễ tết: Phòng đơn 1.200.000đ · Phòng đôi 2 giường 1.500.000đ · Phòng 3 giường 1.700.000đ/đêm.

Phụ thu: trẻ 0–dưới 6 tuổi miễn phí; từ 6 tuổi trở lên 200.000đ/người/đêm (ngủ ghép). Dọn dẹp decor honeymoon/sinh nhật 100k/phòng. Ngày thường hết phòng đơn: bán phòng đôi tính giá phòng đơn.

Đặt cọc: CTV/khách cọc trước tối thiểu 50%, còn lại thanh toán khi nhận phòng.

Quy định hoàn - hủy:
- Hoãn trước 10 ngày: bảo lưu trong 30 ngày hoặc pass lại cho khách khác.
- Hủy trong vòng 7–10 ngày: 50% booking · 4–7 ngày: 80% · trong 3 ngày: 100%.
- Phí 100k/phòng với phòng hủy và pass đổi thông tin; đổi ngày đã chọn phụ thu 200k/phòng.
- Bất khả kháng (thiên tai, bão lũ, dịch bệnh, sức khỏe có chẩn đoán y tế): bảo lưu và dời ngày trong 30 ngày tùy tình trạng phòng trống.

Nội quy: không hút thuốc trong phòng; không mang đồ ăn nặng mùi (sầu riêng, măng cụt...); không mang vật nuôi; không tự ý di chuyển đồ đạc; không sử dụng chất cấm.`;

async function main() {
  const existing = await prisma.service.findUnique({ where: { slug: SLUG } });
  if (existing) {
    console.log(`Đã tồn tại service ${SLUG} (${existing.id}) — không tạo lại.`);
    return;
  }

  const service = await prisma.service.create({
    data: {
      slug: SLUG,
      category: "HOMESTAY",
      title: "Bếp Nhà Táo",
      summary: SUMMARY,
      description: DESCRIPTION,
      policy: POLICY,
      area: "Khe Cải, Tà Xùa",
      basePrice: 800_000,
      priceUnit: "/đêm",
      contactName: "Bếp Nhà Táo",
      contactPhone: "0866008000",
      mapUrl: "https://maps.app.goo.gl/RNuEFTt7K3kTnZKq5",
      published: true,
      sheetUrl: SHEET_URL,
    },
  });
  console.log(`Tạo service ${service.title} (${service.id})`);

  let rtSort = 0;
  for (const rt of ROOM_TYPES) {
    const roomType = await prisma.roomType.create({
      data: {
        serviceId: service.id,
        name: rt.name,
        capacity: rt.capacity,
        weekdayPrice: rt.weekday,
        weekendPrice: rt.sat,
        priceSat: rt.sat,
        holidayPrice: rt.holiday,
        totalRooms: rt.rooms.length,
        hasBathtub: rt.hasBathtub,
        airCon: true,
        heating: true, // đệm sưởi
        sortOrder: rtSort++,
      },
    });
    for (const name of rt.rooms) {
      const num = Number(name.replace(/\D+/g, ""));
      await prisma.room.create({
        data: {
          roomTypeId: roomType.id,
          name,
          description: `Mây ${num}`, // tên phòng theo cách gọi của homestay
          capacity: rt.capacity,
          maxCapacity: rt.maxCapacity,
          extraPersonFee: 200_000,
          listPrice: rt.weekday,
          priceSat: rt.sat,
          commission: COMMISSION,
          sortOrder: num, // thứ tự hiển thị toàn cục theo số phòng
        },
      });
    }
    console.log(`  + RT "${rt.name}" (${rt.rooms.length} phòng, ${rt.weekday}/${rt.sat}) ${roomType.id}`);
  }
  console.log("Xong.");
}
main().finally(() => prisma.$disconnect());
