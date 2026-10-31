import { prisma } from "@/lib/prisma";
import { buildRoomIcs } from "@/lib/ical";
import { toDateKey, today, addDays } from "@/lib/dates";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Lịch iCal các đêm BẬN của một phòng (để dán vào OTA: Booking/Agoda/Airbnb…). */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const room = await prisma.room.findUnique({
    where: { icalToken: token },
    select: { id: true, name: true, roomType: { select: { name: true, service: { select: { title: true } } } } },
  });
  if (!room) return new Response("Not found", { status: 404 });

  const start = today();
  const end = addDays(start, 365);
  const rows = await prisma.roomDayStatus.findMany({
    where: { roomId: room.id, status: { not: "AVAILABLE" }, date: { gte: start, lte: end } },
    select: { date: true },
  });
  const busyNights = rows.map((r) => toDateKey(r.date));

  const ics = buildRoomIcs({
    calName: `${room.roomType.service.title} · ${room.roomType.name} · ${room.name}`,
    uidBase: room.id,
    busyNights,
  });

  return new Response(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `inline; filename="room-${room.id}.ics"`,
      "Cache-Control": "no-store",
    },
  });
}
