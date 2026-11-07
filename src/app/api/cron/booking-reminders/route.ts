import { NextResponse } from "next/server";
import { runBookingReminders } from "@/lib/booking-reminders";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Nhắc lịch đơn (lên xe / xe về / nhận phòng thu tiền / checkout) qua Web Push tới admin.
 * Crontab VPS gọi mỗi 15 phút kèm ?key=<CRON_SECRET>. Mốc giờ & nội dung: src/lib/booking-reminders.ts.
 * Thử: ?dry=1 (chỉ xem trước, không gửi) · ?at=2026-11-08T09:05:00%2B07:00 (giả lập thời điểm, chỉ khi dry).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const key = url.searchParams.get("key") ?? request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (key !== secret) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const dry = url.searchParams.get("dry") === "1";
  const atRaw = url.searchParams.get("at");
  const at = dry && atRaw ? new Date(atRaw) : new Date();
  if (Number.isNaN(at.getTime())) return NextResponse.json({ error: "Tham số at không hợp lệ." }, { status: 400 });

  const results = await runBookingReminders(at, dry);
  return NextResponse.json({ at: at.toISOString(), dry, results });
}
