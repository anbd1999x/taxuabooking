// So sánh lịch Thác Mây trong DB với API (từ hôm nay, 7 tháng).
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const norm = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").replace(/đ/gi, "d").toLowerCase().replace(/\s+/g, " ").trim();
async function main() {
  const today = new Date(); const t0 = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const api = new Set<string>();
  for (let i = 0; i < 7; i++) {
    const d = new Date(Date.UTC(t0.getUTCFullYear(), t0.getUTCMonth() + i, 1));
    const j = await (await fetch(`https://thacmaytaxua.vn/api/calendar/all?month=${d.getUTCMonth() + 1}&year=${d.getUTCFullYear()}`)).json();
    for (const day of j.calendar) for (const rm of Object.values<any>(day.rooms))
      if (rm.isBooked && new Date(day.fullDateStr) >= t0) api.add(`${norm(rm.sheetName)}|${day.fullDateStr}`);
  }
  const rows = await p.roomDayStatus.findMany({
    where: { room: { roomType: { serviceId: "cmw0ipudt0000unys7uonetxb" } }, date: { gte: t0 }, status: { not: "AVAILABLE" } },
    select: { date: true, status: true, note: true, bookingId: true, room: { select: { name: true } } },
  });
  const db = new Set(rows.map((r) => `${norm(r.room.name)}|${r.date.toISOString().slice(0, 10)}`));
  const onlyApi = [...api].filter((k) => !db.has(k));
  const onlyDb = rows.filter((r) => !api.has(`${norm(r.room.name)}|${r.date.toISOString().slice(0, 10)}`));
  console.log("API booked:", api.size, "DB locked:", db.size);
  console.log("API có, DB không:", onlyApi.slice(0, 20));
  console.log("DB có, API không:", onlyDb.slice(0, 20).map((r) => `${r.room.name} ${r.date.toISOString().slice(0, 10)} ${r.status} note=${r.note} booking=${r.bookingId}`));
}
main().finally(() => p.$disconnect());
