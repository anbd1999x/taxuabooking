import { NextResponse } from "next/server";
import { runBookingReminders, runBookingRemindersLocked } from "@/lib/booking-reminders";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Nhắc lịch đơn (lên xe / xe về / nhận phòng thu tiền / checkout) qua Web Push tới admin.
 * App TỰ chạy mỗi 5 phút (src/instrumentation.ts) — endpoint này để chạy tay / xem trước. Mốc giờ & nội dung: src/lib/booking-reminders.ts.
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

  // Gửi thật: dùng bản có khoá để không trùng với bộ hẹn giờ trong app (instrumentation).
  const results = dry ? await runBookingReminders(at, true) : await runBookingRemindersLocked(at);
  return NextResponse.json({ at: at.toISOString(), dry, results });
}
