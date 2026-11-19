import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

/**
 * Cửa /api/cron/*: CHƯA cấu hình CRON_SECRET ⇒ ĐÓNG (trước đây bỏ qua xác thực ⇒ ai cũng gọi được, cào sheet / ghi
 * lịch phòng hàng loạt). Việc định kỳ đã chạy trong app (instrumentation.ts) nên route chỉ để chạy tay khi có khoá.
 * Khoá nhận qua ?key= hoặc Authorization: Bearer; so sánh hằng thời gian. Trả response lỗi, hoặc null = cho qua.
 */
export function cronDenied(request: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET ?? "";
  if (!secret) return NextResponse.json({ error: "Cron endpoint disabled (CRON_SECRET not set)." }, { status: 404 });
  const url = new URL(request.url);
  const key = url.searchParams.get("key") ?? request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  // Băm trước để hai chuỗi cùng độ dài (timingSafeEqual yêu cầu) và không lộ độ dài khoá.
  const h = (s: string) => createHash("sha256").update(s).digest();
  if (!key || !timingSafeEqual(h(key), h(secret))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return null;
}
