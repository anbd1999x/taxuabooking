import { NextResponse } from "next/server";
import { BadImage, ImageSearchUnavailable, searchByImage } from "@/lib/image-search";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Ảnh khách gửi (trình duyệt đã thu nhỏ còn ~50–200KB; ảnh gốc điện thoại cũng lọt qua được). */
const MAX_BYTES = 8 * 1024 * 1024;

/**
 * POST /api/homestay/image-search — body = bytes ảnh (jpeg/png/webp…). Trả điểm giống (cosine CLIP) theo
 * homestay (slug) và theo phòng (roomId) để trang /homestay sắp xếp. Công khai, giới hạn tần suất theo IP.
 */
export async function POST(request: Request) {
  const len = Number(request.headers.get("content-length"));
  if (!request.headers.get("content-length") || !Number.isFinite(len)) return NextResponse.json({ error: "Thiếu độ dài ảnh." }, { status: 411 });
  if (len <= 0) return NextResponse.json({ error: "Chưa có ảnh." }, { status: 400 });
  if (len > MAX_BYTES) return NextResponse.json({ error: "Ảnh quá lớn (tối đa 8MB)." }, { status: 413 });

  const ip = clientIp(request);
  // 20 lượt / 10 phút / IP (máy dev nới rộng để thử).
  if (!rateLimit(`img-search:${ip}`, process.env.NODE_ENV === "production" ? 20 : 500, 10 * 60_000)) {
    return NextResponse.json({ error: "Bạn tìm hơi nhanh — thử lại sau ít phút nhé." }, { status: 429 });
  }

  const buf = Buffer.from(await request.arrayBuffer());
  if (buf.length > MAX_BYTES) return NextResponse.json({ error: "Ảnh quá lớn (tối đa 8MB)." }, { status: 413 });

  try {
    const result = await searchByImage(buf);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof BadImage) return NextResponse.json({ error: "Không đọc được ảnh — hãy dùng ảnh JPG, PNG hoặc WebP." }, { status: 400 });
    if (e instanceof ImageSearchUnavailable) {
      console.error("[img-search]", e.message);
      return NextResponse.json({ error: "Tìm theo ảnh đang tạm bận — thử lại sau ít phút." }, { status: 503 });
    }
    throw e;
  }
}
