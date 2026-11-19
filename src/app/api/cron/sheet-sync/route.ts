import { NextResponse } from "next/server";
import { cronDenied } from "@/lib/cron-auth";
import { syncAllSheets } from "@/lib/sheet-sync";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Đồng bộ lịch phòng từ Google Sheet cho mọi homestay có link. Gọi định kỳ bằng
 * cron (crontab VPS / cron-job.org / Vercel Cron…). Nếu đặt env CRON_SECRET thì
 * phải truyền ?key=<CRON_SECRET> (hoặc header Authorization: Bearer <CRON_SECRET>); chưa đặt ⇒ route đóng (404).
 */
export async function GET(request: Request) {
  // Thiếu CRON_SECRET ⇒ đóng hẳn (không còn mở cho mọi người).
  const denied = cronDenied(request);
  if (denied) return denied;
  const results = await syncAllSheets();
  const ok = results.filter((r) => r.ok).length;
  return NextResponse.json({
    synced: results.length,
    ok,
    failed: results.length - ok,
    results,
  });
}
