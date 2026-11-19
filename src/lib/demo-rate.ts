import "server-only";
import { NextResponse } from "next/server";
import { clientIp, rateLimit } from "./rate-limit";
import { DEMO_COOKIE } from "./fleet-demo";

/**
 * Giới hạn cửa mở bản demo (GET có tác dụng phụ ghi DB production: dựng lại dữ liệu mẫu).
 * - Mỗi IP mở demo ≤ 20 lần / 10 phút (quá ⇒ 429).
 * - `?reset=1` (xoá & dựng lại toàn bộ dữ liệu mẫu) chỉ nhận khi ĐANG có cookie demo (nút "Làm mới" nằm trong trang
 *   demo; bot / link lạ không có cookie) và ≤ 3 lần / giờ / IP — quá thì vẫn mở demo nhưng KHÔNG dựng lại.
 * Trả `{ blocked }` (response 429) hoặc `{ force }` = có được dựng lại hay không.
 */
export function demoGate(request: Request, wantReset: boolean): { blocked: NextResponse } | { force: boolean } {
  const ip = clientIp(request);
  if (!rateLimit(`demo-open:${ip}`, 20, 10 * 60_000)) {
    return { blocked: new NextResponse("Bạn mở bản demo hơi nhiều. Vui lòng thử lại sau ít phút.", { status: 429, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "Retry-After": "600" } }) };
  }
  if (!wantReset) return { force: false };
  const hasDemo = (request.headers.get("cookie") ?? "").split(/;\s*/).some((c) => c.startsWith(`${DEMO_COOKIE}=`));
  return { force: hasDemo && rateLimit(`demo-reset:${ip}`, 3, 60 * 60_000) };
}
