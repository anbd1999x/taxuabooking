import { NextResponse } from "next/server";
import { syncAllSheets } from "@/lib/sheet-sync";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Đồng bộ lịch phòng từ Google Sheet cho mọi homestay có link. Gọi định kỳ bằng
 * cron (crontab VPS / cron-job.org / Vercel Cron…). Nếu đặt env CRON_SECRET thì
 * phải truyền ?key=<CRON_SECRET> (hoặc header Authorization: Bearer <CRON_SECRET>).
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const url = new URL(request.url);
    const key = url.searchParams.get("key") ?? request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (key !== secret) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const results = await syncAllSheets();
  const ok = results.filter((r) => r.ok).length;
  return NextResponse.json({
    synced: results.length,
    ok,
    failed: results.length - ok,
    results,
  });
}
