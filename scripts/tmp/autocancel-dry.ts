import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  // Chỉ ĐỌC: mô phỏng quy tắc 2 trên các đơn đang chờ (bỏ qua mốc bật tính năng) để kiểm tra truy vấn.
  const pending = await prisma.bookingRequest.findMany({
    where: { status: { in: ["NEW", "CONTACTING"] }, paymentStatus: "UNPAID", category: { in: ["HOMESTAY", "BUNGALOW", "COMBO"] } },
    select: { code: true, createdAt: true, useDate: true, endDate: true, roomId: true, roomIds: true, heldRoom: true, serviceTitle: true },
  });
  for (const b of pending) {
    const ids = [...new Set([...(b.roomIds ?? []), ...(b.roomId ? [b.roomId] : [])])];
    const lastNight = b.endDate && b.endDate > b.useDate ? new Date(b.endDate.getTime() - 86_400_000) : b.useDate;
    const hits = ids.length ? await prisma.roomDayStatus.findMany({ where: { roomId: { in: ids }, date: { gte: b.useDate, lte: lastNight } }, select: { date: true, status: true, note: true, bookingId: true, room: { select: { name: true } } } }) : [];
    console.log(b.code, b.serviceTitle.slice(0, 30), "| tạo", b.createdAt.toISOString().slice(0, 16), "| ở", b.useDate.toISOString().slice(0, 10), "→", b.endDate?.toISOString().slice(0, 10), "| phòng", ids.length, "| khoá:", hits.map((h) => `${h.room.name} ${h.date.toISOString().slice(5, 10)} ${h.status}/${h.note ?? ""}${h.bookingId ? "/đơn" : ""}`).join("; ") || "không");
  }
}
main().finally(() => prisma.$disconnect());
