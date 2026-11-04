/**
 * Backfill BookingRequest.roomCommission cho các đơn homestay/combo đã tạo TRƯỚC khi
 * có cột này (giá trị đang null). Tính lại từ cấu hình chiết khấu HIỆN TẠI của phòng
 * + fallback mức homestay (Service.roomCommission), theo đúng các đêm lưu trú của đơn.
 *
 * Chạy: npx tsx scripts/backfill-room-commission.ts
 * (an toàn chạy lại nhiều lần — chỉ đụng đơn có roomCommission IS NULL)
 */
import { PrismaClient } from "@prisma/client";
import { enumerateNights, addDays } from "../src/lib/dates";
import { roomCommissionForNights } from "../src/lib/availability";
import { toNumber } from "../src/lib/format";

const prisma = new PrismaClient();

async function main() {
  const bookings = await prisma.bookingRequest.findMany({
    where: {
      category: { in: ["HOMESTAY", "COMBO"] },
      roomCommission: null,
    },
    select: {
      id: true,
      code: true,
      roomId: true,
      roomIds: true,
      useDate: true,
      endDate: true,
      serviceId: true,
    },
  });

  console.log(`Tìm thấy ${bookings.length} đơn homestay/combo chưa có roomCommission.`);
  let updated = 0;
  let skipped = 0;

  for (const b of bookings) {
    const roomIdList = b.roomIds?.length ? b.roomIds : b.roomId ? [b.roomId] : [];
    if (roomIdList.length === 0) {
      skipped++;
      continue; // không gắn phòng cụ thể (combo chờ xác nhận thủ công) → bỏ qua
    }
    const checkIn = b.useDate;
    const checkOut = b.endDate ?? addDays(b.useDate, 1);
    const nights = enumerateNights(checkIn, checkOut);
    if (nights.length === 0) {
      skipped++;
      continue;
    }

    const rooms = await prisma.room.findMany({
      where: { id: { in: roomIdList } },
      include: { roomType: { include: { service: { select: { roomCommission: true } } } } },
    });
    if (rooms.length === 0) {
      skipped++;
      continue;
    }

    const total = rooms.reduce(
      (n, r) =>
        n + roomCommissionForNights(r, nights, toNumber(r.roomType.service.roomCommission)),
      0,
    );

    await prisma.bookingRequest.update({
      where: { id: b.id },
      data: { roomCommission: total },
    });
    updated++;
    console.log(`  ${b.code}: ${nights.length} đêm × ${rooms.length} phòng → chiết khấu ${total.toLocaleString("vi-VN")}đ`);
  }

  console.log(`\nXong: cập nhật ${updated} đơn, bỏ qua ${skipped} đơn (không gắn phòng/không đủ dữ liệu).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
