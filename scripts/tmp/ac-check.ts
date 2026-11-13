import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  console.log("now", new Date().toISOString(), "| giờ đã lưu:", (await prisma.siteSetting.findUnique({ where: { key: "autoCancelHours" } }))?.value);
  const logs = await prisma.bookingLog.findMany({ where: { by: "Hệ thống", title: "Tự động huỷ đơn" }, orderBy: { createdAt: "desc" }, take: 12, select: { createdAt: true, body: true, booking: { select: { id: true, code: true, category: true, serviceTitle: true, createdAt: true, useDate: true, endDate: true, roomId: true, roomIds: true, heldRoom: true, ctvId: true, clientIp: true } } } });
  for (const l of logs) {
    const b = l.booking;
    console.log(`\n${b.code} ${b.category} | tạo ${b.createdAt.toISOString()} | huỷ ${l.createdAt.toISOString()} | sau ${Math.round((l.createdAt.getTime() - b.createdAt.getTime()) / 60000)} phút | ở ${b.useDate.toISOString().slice(0, 10)}→${b.endDate?.toISOString().slice(0, 10)} | ${b.serviceTitle.slice(0, 40)}`);
    console.log("   ", l.body);
    const ids = [...new Set([...(b.roomIds ?? []), ...(b.roomId ? [b.roomId] : [])])];
    if (ids.length) {
      const last = b.endDate && b.endDate > b.useDate ? new Date(b.endDate.getTime() - 86400000) : b.useDate;
      const locks = await prisma.roomDayStatus.findMany({ where: { roomId: { in: ids }, date: { gte: b.useDate, lte: last } }, select: { date: true, status: true, note: true, bookingId: true, createdAt: true, updatedAt: true, room: { select: { name: true } } } });
      for (const k of locks) console.log("    khoá:", k.room.name, k.date.toISOString().slice(0, 10), k.status, k.note, k.bookingId ? "đơn" : "", "| tạo", k.createdAt.toISOString(), "| sửa", k.updatedAt.toISOString());
    }
  }
}
main().finally(() => prisma.$disconnect());
