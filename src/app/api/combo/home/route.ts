import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const VIDEO_URL_RE = /\.(mp4|webm|mov|m4v|ogg)(\?|$)/i;

/**
 * Thông tin XEM NHANH một homestay cho ngăn "Xem nhà" ở trang Combo tự chọn: ảnh, mô tả ngắn,
 * chính sách, vị trí và đánh giá đã duyệt. Chỉ trả dữ liệu công khai của homestay đang đăng.
 */
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!id) return NextResponse.json({ error: "Thiếu homestay." }, { status: 400 });
  const svc = await prisma.service.findFirst({
    where: { id, category: "HOMESTAY", published: true },
    select: {
      summary: true,
      policy: true,
      mapUrl: true,
      images: { orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }], take: 16, select: { url: true } },
    },
  });
  if (!svc) return NextResponse.json({ error: "Không tìm thấy homestay." }, { status: 404 });
  const [agg, reviews] = await Promise.all([
    prisma.review.aggregate({ where: { serviceId: id, status: "APPROVED" }, _avg: { rating: true }, _count: true }),
    prisma.review.findMany({
      where: { serviceId: id, status: "APPROVED", comment: { not: null } },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: { rating: true, comment: true, createdAt: true, customer: { select: { name: true } } },
    }),
  ]);
  return NextResponse.json({
    images: svc.images.map((i) => i.url).filter((u) => !VIDEO_URL_RE.test(u)).slice(0, 12),
    summary: svc.summary,
    policy: svc.policy,
    mapUrl: svc.mapUrl,
    rating: agg._count > 0 ? agg._avg.rating : null,
    reviewCount: agg._count,
    reviews: reviews
      .filter((r) => (r.comment ?? "").trim())
      .map((r) => ({ by: r.customer.name, rating: r.rating, text: r.comment!.trim(), when: r.createdAt.toISOString().slice(0, 10) })),
  });
}
