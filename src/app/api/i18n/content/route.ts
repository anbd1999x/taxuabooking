import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n/config";
import { contentVersionOf, getContentMap } from "@/lib/i18n/server";

/**
 * Bản dịch nội dung ngắn (DB) cho Client Component trang khách — thay cho việc nhúng cả map vào HTML mỗi trang.
 * `v` khớp phiên bản hiện tại ⇒ cache immutable (URL đổi khi bản dịch đổi); lệch (bản dịch vừa sửa) ⇒ cache ngắn.
 */
export async function GET(req: NextRequest) {
  const l = req.nextUrl.searchParams.get("l");
  if (!isLocale(l) || l === DEFAULT_LOCALE) return NextResponse.json({}, { status: 400 });
  const map = await getContentMap(l);
  const fresh = req.nextUrl.searchParams.get("v") === contentVersionOf(map);
  return NextResponse.json(map, {
    headers: { "Cache-Control": fresh ? "public, max-age=31536000, immutable" : "public, max-age=60" },
  });
}
