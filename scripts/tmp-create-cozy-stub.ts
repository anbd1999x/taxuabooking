// Tạo homestay COZY (ẨN, chưa có giá/ảnh) để đồng bộ lịch từ "sổ đặt phòng". Chạy: npx tsx scripts/tmp-create-cozy-stub.ts
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const ROOMS: [string, string[]][] = [
  ["Deluxe", ["DLX-01 - Lý Sơn", "DLX-02 - Sò Điệp"]],
  ["Family Deluxe", ["FDX-01 - Cá Voi Xanh"]],
  ["Family Suite", ["FSP-01 - Kỳ Lân Biển"]],
  ["Superior", ["SUP-01 - Trường Sa", "SUP-02 - Hoàng Sa", "SUP-03 - Thổ Chu", "SUP-04 - Sứa Đỏ", "SUP-05 - Mực Đom Đóm", "SUP-06 - Ốc Hương"]],
];
async function main() {
  if (await prisma.service.findUnique({ where: { slug: "cozy-homestay" } })) return console.log("Đã có cozy-homestay");
  const svc = await prisma.service.create({
    data: {
      slug: "cozy-homestay", category: "HOMESTAY", title: "COZY", summary: "(Chờ thông tin từ chủ nhà)", description: "(Chờ thông tin từ chủ nhà)",
      published: false, priceUnit: "/đêm",
      sheetUrl: "https://docs.google.com/spreadsheets/d/1AavE77G8NRHUhXdMKYzpbhWhGLQ3D7G51aKVRxkAVuo/htmlview",
    },
  });
  let s = 0, rs = 0;
  for (const [rt, rooms] of ROOMS) {
    const t = await prisma.roomType.create({ data: { serviceId: svc.id, name: rt, weekdayPrice: 0, weekendPrice: 0, totalRooms: rooms.length, sortOrder: s++ } });
    for (const name of rooms) await prisma.room.create({ data: { roomTypeId: t.id, name, sortOrder: rs++ } });
  }
  console.log(svc.id);
}
main().finally(() => prisma.$disconnect());
