import "server-only";
import { prisma } from "./prisma";
import { parseDateOnly, toDateKey } from "./dates";
import { parseIcsBusyNights } from "./ical";
import { syncRoomTypeAvailability } from "./room-availability";

export interface IcalSyncResult {
  sourceId: string;
  label: string;
  ok: boolean;
  count: number;
  error?: string;
}

/** Đồng bộ MỘT nguồn iCal của OTA → khoá ngày bận trong RoomDayStatus (note = "OTA#<id>"). */
export async function syncIcalSource(sourceId: string): Promise<IcalSyncResult> {
  const src = await prisma.roomIcalSource.findUnique({ where: { id: sourceId }, include: { room: { select: { id: true, roomTypeId: true } } } });
  if (!src) return { sourceId, label: "", ok: false, count: 0, error: "Không tìm thấy nguồn." };
  const tag = `OTA#${src.id}`;
  const todayKey = toDateKey(new Date());
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    const res = await fetch(src.url, { redirect: "follow", signal: ctrl.signal, headers: { "User-Agent": "TaXuaBooking/1.0 iCal sync" }, cache: "no-store" });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    if (!/BEGIN:VCALENDAR/i.test(text)) throw new Error("Không phải lịch iCal hợp lệ.");
    const nights = parseIcsBusyNights(text).filter((k) => k >= todayKey); // chỉ khoá từ hôm nay trở đi
    const roomId = src.room.id;
    const affected = new Set<string>();

    await prisma.$transaction(async (tx) => {
      // Gỡ các khoá cũ của chính nguồn này (để đồng bộ lại tình trạng mới nhất).
      const old = await tx.roomDayStatus.findMany({ where: { roomId, note: tag }, select: { date: true } });
      old.forEach((o) => affected.add(toDateKey(o.date)));
      await tx.roomDayStatus.deleteMany({ where: { roomId, note: tag } });

      // Khoá các đêm bận mới — KHÔNG đè đơn thật, khoá thủ công của admin,
      // hay khoá từ nguồn OTA khác (chỉ ghi đè bản ghi do chính nguồn này tạo).
      for (const dk of nights) {
        const date = parseDateOnly(dk);
        const existing = await tx.roomDayStatus.findUnique({ where: { roomId_date: { roomId, date } } });
        if (
          existing &&
          existing.note !== tag &&
          (existing.bookingId || existing.note || existing.status !== "AVAILABLE")
        ) {
          continue; // ngày đã bận bởi nơi khác → giữ nguyên chủ sở hữu bản ghi
        }
        await tx.roomDayStatus.upsert({
          where: { roomId_date: { roomId, date } },
          create: { roomId, date, status: "CLOSED", note: tag },
          update: { status: "CLOSED", note: tag },
        });
        affected.add(dk);
      }

      await tx.roomIcalSource.update({ where: { id: src.id }, data: { lastSyncedAt: new Date(), lastResult: `${nights.length} đêm bận` } });
    });

    // Cập nhật lại số phòng trống (RoomAvailability) cho các ngày bị ảnh hưởng.
    for (const dk of affected) await syncRoomTypeAvailability(src.room.roomTypeId, parseDateOnly(dk));

    return { sourceId, label: src.label, ok: true, count: nights.length };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Lỗi không rõ";
    await prisma.roomIcalSource.update({ where: { id: src.id }, data: { lastSyncedAt: new Date(), lastResult: `Lỗi: ${msg}` } }).catch(() => {});
    return { sourceId, label: src.label, ok: false, count: 0, error: msg };
  }
}

/** Đồng bộ tất cả nguồn iCal của một phòng. */
export async function syncRoomIcal(roomId: string): Promise<IcalSyncResult[]> {
  const sources = await prisma.roomIcalSource.findMany({ where: { roomId }, select: { id: true } });
  const out: IcalSyncResult[] = [];
  for (const s of sources) out.push(await syncIcalSource(s.id));
  return out;
}

/** Đồng bộ TẤT CẢ nguồn iCal (dùng cho cron). */
export async function syncAllIcal(): Promise<IcalSyncResult[]> {
  const sources = await prisma.roomIcalSource.findMany({ select: { id: true } });
  const out: IcalSyncResult[] = [];
  for (const s of sources) out.push(await syncIcalSource(s.id));
  return out;
}
