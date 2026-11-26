import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n/config";
import { contentVersionOf, getContentMap } from "@/lib/i18n/server";
import { CONTENT_GLOBAL } from "@/lib/i18n/content-store";

/**
 * Bản dịch nội dung ngắn (DB) cho Client Component trang khách — thay cho việc nhúng cả map vào HTML mỗi trang.
 * `v` khớp phiên bản hiện tại ⇒ cache immutable (URL đổi khi bản dịch đổi); lệch (bản dịch vừa sửa) ⇒ cache ngắn.
 */
export async function GET(req: NextRequest) {
  const l = req.nextUrl.searchParams.get("l");
  if (!isLocale(l) || l === DEFAULT_LOCALE) return NextResponse.json({}, { status: 400 });
  const map = await getContentMap(l);
  const fresh = req.nextUrl.searchParams.get("v") === contentVersionOf(map);
  const cache = fresh ? "public, max-age=31536000, immutable" : "public, max-age=60";
  // ?js=1: cùng dữ liệu, dạng script gán biến toàn cục (layout gốc nạp trước khi hydrate — xem contentScriptUrl).
  if (req.nextUrl.searchParams.get("js") === "1") {
    // JSON.stringify không thoát U+2028 / U+2029; thoát thêm cho chắc với trình phân tích JS cũ.
    const json = JSON.stringify({ l, d: map }).replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
    return new NextResponse(`self.${CONTENT_GLOBAL}=${json};`, {
      headers: { "Content-Type": "application/javascript; charset=utf-8", "Cache-Control": cache },
    });
  }
  return NextResponse.json(map, { headers: { "Cache-Control": cache } });
}
