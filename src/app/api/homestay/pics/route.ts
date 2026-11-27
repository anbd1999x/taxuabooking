import { NextResponse } from "next/server";
import { getCardPics } from "@/lib/queries";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

/**
 * GET /api/homestay/pics?room=<roomId> | ?home=<slug> — danh sách ảnh slide của MỘT thẻ ở trang /homestay.
 * Trang danh sách chỉ gửi SỐ ảnh mỗi thẻ; khách rê / chạm thẻ thì mới nạp URL ở đây (trang không phình payload).
 * Công khai, chỉ homestay đang đăng; trình duyệt + CDN cache 10 phút.
 */
export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  const room = sp.get("room")?.trim() ?? "";
  const home = sp.get("home")?.trim() ?? "";
  const valid = /^[A-Za-z0-9_-]{1,80}$/;
  if ((!room && !home) || (room && !valid.test(room)) || (home && !valid.test(home))) {
    return NextResponse.json({ error: "Thiếu tham số." }, { status: 400 });
  }
  // Mỗi thẻ được nạp 1 lần/phiên ⇒ trần rộng, chỉ chặn quét hàng loạt.
  if (!rateLimit(`card-pics:${clientIp(request)}`, 600, 10 * 60_000)) {
    return NextResponse.json({ error: "Thử lại sau ít phút." }, { status: 429 });
  }
  const urls = await getCardPics(room ? { roomId: room } : { slug: home });
  return NextResponse.json(
    { urls },
    { headers: { "Cache-Control": "public, max-age=600, s-maxage=600, stale-while-revalidate=3600" } },
  );
}
