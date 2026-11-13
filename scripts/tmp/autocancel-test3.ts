import { PrismaClient } from "@prisma/client";
import { AUTO_CANCEL_FROM, cancelExpiredUnpaidBookings, getAutoCancelHours } from "../../src/lib/booking-auto-cancel";
const prisma = new PrismaClient();
async function main() {
  const hours = await getAutoCancelHours();
  const base = new Date();
  const a = await prisma.bookingRequest.create({ data: { code: "TX-TESTR1", category: "XEOM", serviceTitle: "ĐƠN THỬ TỰ HUỶ (sẽ xoá)", customerName: "Test", phone: "0000000000", useDate: new Date("2027-01-01"), createdAt: base } });
  try {
    const future = new Date(base.getTime() + hours * 3_600_000 + 60_000);
    // an toàn: không có đơn thật nào khác rơi vào hạn tại thời điểm giả lập
    const others = await prisma.bookingRequest.count({ where: { id: { not: a.id }, status: { in: ["NEW", "CONTACTING"] }, paymentStatus: "UNPAID", createdAt: { gte: AUTO_CANCEL_FROM, lte: new Date(future.getTime() - hours * 3_600_000) }, logs: { none: { title: "Tự động huỷ đơn" } } } });
    if (others > 0) { console.log("có", others, "đơn thật sẽ tới hạn tại thời điểm giả lập → không chạy thử"); return; }
    const first = await cancelExpiredUnpaidBookings(future);
    await prisma.bookingRequest.update({ where: { id: a.id }, data: { status: "NEW", cancelReason: null } }); // quản trị viên mở lại
    const second = await cancelExpiredUnpaidBookings(future);
    const st = await prisma.bookingRequest.findUnique({ where: { id: a.id }, select: { status: true } });
    console.log("lần 1 huỷ:", JSON.stringify(first), "| sau khi mở lại, lần 2 huỷ:", JSON.stringify(second), "| trạng thái cuối:", st?.status);
  } finally {
    await prisma.bookingRequest.delete({ where: { id: a.id } });
    console.log("đơn thử còn sót:", await prisma.bookingRequest.count({ where: { code: { startsWith: "TX-TEST" } } }));
  }
}
main().finally(() => prisma.$disconnect());
