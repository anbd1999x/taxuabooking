import "server-only";
import { cache } from "react";
import type { ServiceCategory } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isVideoUrl } from "@/lib/utils";

/**
 * Ảnh đại diện cho trang danh mục khi chia sẻ link: ảnh bìa của dịch vụ nổi bật (thiếu thì
 * dịch vụ đầu tiên có ảnh) trong danh mục đó. Không có ⇒ null (dùng ảnh biển mây mặc định).
 */
export const categoryShareImage = cache(async (category: ServiceCategory): Promise<string | null> => {
  // Homestay gộp cả bungalow; combo = xe + phòng nên lấy ảnh homestay.
  const cats: ServiceCategory[] =
    category === "HOMESTAY" || category === "BUNGALOW" || category === "COMBO" ? ["HOMESTAY", "BUNGALOW"] : [category];
  try {
    const rows = await prisma.service.findMany({
      where: { category: { in: cats }, published: true, images: { some: {} } },
      orderBy: [{ featured: "desc" }, { createdAt: "asc" }],
      take: 3,
      select: { images: { orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }], take: 3, select: { url: true } } },
    });
    for (const r of rows) {
      const img = r.images.find((i) => !isVideoUrl(i.url));
      if (img) return img.url;
    }
  } catch {
    /* DB lỗi ⇒ ảnh mặc định */
  }
  return null;
});

/** Ảnh đại diện cho trang địa điểm (lịch trình/bản đồ = CHECKIN, cafe, nhà hàng). */
export const placeShareImage = cache(async (kind: "CHECKIN" | "CAFE" | "RESTAURANT"): Promise<string | null> => {
  try {
    const p = await prisma.place.findFirst({
      where: { kind, published: true, coverImage: { not: null } },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { coverImage: true },
    });
    return p?.coverImage && !isVideoUrl(p.coverImage) ? p.coverImage : null;
  } catch {
    return null;
  }
});
