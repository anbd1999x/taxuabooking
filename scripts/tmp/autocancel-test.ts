import { PrismaClient } from "@prisma/client";
import { AUTO_CANCEL_FROM, cancelExpiredUnpaidBookings } from "../../src/lib/booking-auto-cancel";
const prisma = new PrismaClient();
async function main() {
  // An toàn: chỉ chạy khi KHÔNG có đơn thật nào đang chờ được tạo sau mốc bật tính năng.
  const real = await prisma.bookingRequest.count({ where: { status: { in: ["NEW", "CONTACTING"] }, paymentStatus: "UNPAID", createdAt: { gte: AUTO_CANCEL_FROM } } });
  if (real > 0) { console.log("CÓ", real, "đơn thật sau mốc → không chạy thử"); return; }
  const base = new Date(Math.max(Date.now(), AUTO_CANCEL_FROM.getTime() + 1000));
  const mk = (code: string, extra: object) => prisma.bookingRequest.create({ data: { code, category: "XEOM", serviceTitle: "ĐƠN THỬ TỰ HUỶ (sẽ xoá)", customerName: "Test", phone: "0000000000", useDate: new Date("2027-01-01"), createdAt: base, ...extra } });
  const a = await mk("TX-TESTA1", {});                                   // chờ + chưa thu → phải huỷ
  const b = await mk("TX-TESTB1", { paymentStatus: "DEPOSITED" });       // đã cọc → giữ
  const c = await mk("TX-TESTC1", { status: "CONFIRMED" });              // đã xác nhận → giữ
  try {
    const early = await cancelExpiredUnpaidBookings(new Date(base.getTime() + 5 * 3_600_000));       // mới 5 giờ
    const late = await cancelExpiredUnpaidBookings(new Date(base.getTime() + 6 * 3_600_000 + 60_000)); // 6 giờ 1 phút
    const rows = await prisma.bookingRequest.findMany({ where: { id: { in: [a.id, b.id, c.id] } }, select: { code: true, status: true, paymentStatus: true, cancelReason: true, logs: { select: { title: true, body: true, by: true } } }, orderBy: { code: "asc" } });
    console.log("sau 5 giờ:", JSON.stringify(early), "| sau 6 giờ 1 phút:", JSON.stringify(late));
    for (const r of rows) console.log(r.code, r.status, r.paymentStatus, "|", r.cancelReason ?? "-", "|", JSON.stringify(r.logs));
  } finally {
    const del = await prisma.bookingRequest.deleteMany({ where: { id: { in: [a.id, b.id, c.id] } } });
    console.log("đã xoá đơn thử:", del.count, "| còn sót:", await prisma.bookingRequest.count({ where: { code: { startsWith: "TX-TEST" } } }));
  }
}
main().finally(() => prisma.$disconnect());
