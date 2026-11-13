import { PrismaClient } from "@prisma/client";
import { AUTO_CANCEL_FROM, cancelBookingsBlockedBySheet } from "../../src/lib/booking-auto-cancel";
const prisma = new PrismaClient();
async function main() {
  const real = await prisma.bookingRequest.count({ where: { status: { in: ["NEW", "CONTACTING"] }, paymentStatus: "UNPAID", createdAt: { gte: AUTO_CANCEL_FROM } } });
  if (real > 0) { console.log("CÓ", real, "đơn thật sau mốc → không chạy thử"); return; }
  const room = await prisma.room.findFirst({ where: { roomType: { service: { category: "HOMESTAY", sheetUrl: { not: null } } } }, select: { id: true, name: true, roomTypeId: true, roomType: { select: { serviceId: true, service: { select: { title: true } } } } } });
  if (!room) throw new Error("no room");
  const night = new Date("2027-10-10"), out = new Date("2027-10-12");
  if (await prisma.roomDayStatus.count({ where: { roomId: room.id, date: { gte: night, lt: out } } })) throw new Error("ngày thử đã có khoá thật");
  const t0 = new Date(Math.max(Date.now(), AUTO_CANCEL_FROM.getTime() + 1000));
  const mk = (code: string, createdAt: Date, extra: object) => prisma.bookingRequest.create({ data: { code, category: "HOMESTAY", serviceId: room.roomType.serviceId, serviceTitle: "ĐƠN THỬ TỰ HUỶ (sẽ xoá)", customerName: "Test", phone: "0000000000", useDate: night, endDate: out, nights: 2, roomTypeId: room.roomTypeId, roomId: room.id, roomIds: [room.id], createdAt, ...extra } });
  const a = await mk("TX-TESTA2", t0, {});                                         // đặt trước khi chủ nhà khoá → phải huỷ
  const c = await mk("TX-TESTC2", t0, { heldRoom: true });                         // đã đánh dấu giữ phòng → giữ
  const d = await mk("TX-TESTD2", t0, { paymentStatus: "DEPOSITED" });             // đã cọc → giữ
  const b = await mk("TX-TESTB2", new Date(t0.getTime() + 2000), {});              // đặt SAU khi phòng đã khoá → giữ
  const ids = [a.id, b.id, c.id, d.id];
  let lockId: string | null = null;
  try {
    const before = await cancelBookingsBlockedBySheet(room.roomType.serviceId, "SHEET");   // chưa có khoá
    // chủ nhà ghi "đã đặt" đêm thứ 2 của kỳ ở (2027-10-11)
    lockId = (await prisma.roomDayStatus.create({ data: { roomId: room.id, date: new Date("2027-10-11"), status: "BOOKED", note: "SHEET", createdAt: new Date(t0.getTime() + 1000) } })).id;
    const after = await cancelBookingsBlockedBySheet(room.roomType.serviceId, "SHEET");
    console.log(room.roomType.service.title, "/", room.name, "| chưa khoá:", JSON.stringify(before), "| sau khi sheet khoá:", JSON.stringify(after));
    for (const r of await prisma.bookingRequest.findMany({ where: { id: { in: ids } }, select: { code: true, status: true, cancelReason: true }, orderBy: { code: "asc" } })) console.log(r.code, r.status, "|", r.cancelReason ?? "-");
  } finally {
    if (lockId) await prisma.roomDayStatus.delete({ where: { id: lockId } }).catch(() => {});
    const del = await prisma.bookingRequest.deleteMany({ where: { id: { in: ids } } });
    console.log("đã xoá đơn thử:", del.count, "| đơn thử còn sót:", await prisma.bookingRequest.count({ where: { code: { startsWith: "TX-TEST" } } }), "| khoá thử còn sót:", await prisma.roomDayStatus.count({ where: { roomId: room.id, date: { gte: night, lt: out } } }));
  }
}
main().finally(() => prisma.$disconnect());
