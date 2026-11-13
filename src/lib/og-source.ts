import "server-only";
import { cache } from "react";
import type { ServiceCategory } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isVideoUrl } from "@/lib/utils";

/** Ảnh (không phải video) của các dịch vụ trong nhóm danh mục: ảnh bìa từng dịch vụ trước, rồi tới ảnh phụ. */
const categoryImagePool = cache(async (key: "STAY" | ServiceCategory): Promise<string[]> => {
  const cats: ServiceCategory[] = key === "STAY" ? ["HOMESTAY", "BUNGALOW"] : [key];
  try {
    const rows = await prisma.service.findMany({
      where: { category: { in: cats }, published: true, images: { some: {} } },
      orderBy: [{ featured: "desc" }, { createdAt: "asc" }],
      take: 4,
      select: { images: { orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }], take: 3, select: { url: true } } },
    });
    const lists = rows.map((r) => r.images.map((i) => i.url).filter((u) => !isVideoUrl(u)));
    const covers = lists.map((l) => l[0]).filter(Boolean);
    const rest = lists.flatMap((l) => l.slice(1));
    return [...new Set([...covers, ...rest])];
  } catch {
    return []; // DB lỗi ⇒ ảnh mặc định
  }
});

/**
 * Ảnh đại diện cho trang danh mục khi chia sẻ link: ảnh bìa của dịch vụ nổi bật (thiếu thì
 * dịch vụ đầu tiên có ảnh) trong danh mục đó. Không có ⇒ null (dùng ảnh biển mây mặc định).
 * Homestay gộp cả bungalow. Combo = xe + phòng nên cũng lấy ảnh homestay, nhưng lấy ảnh KẾ TIẾP
 * (bìa homestay thứ 2, thiếu thì ảnh phụ) để không trùng ảnh với trang /homestay.
 */
export const categoryShareImage = cache(async (category: ServiceCategory): Promise<string | null> => {
  const stay = category === "HOMESTAY" || category === "BUNGALOW" || category === "COMBO";
  const pool = await categoryImagePool(stay ? "STAY" : category);
  return (category === "COMBO" ? pool[1] : undefined) ?? pool[0] ?? null;
});

/**
 * Ảnh đại diện cho trang địa điểm (lịch trình/bản đồ = CHECKIN, cafe, nhà hàng).
 * `nth` = lấy ảnh bìa thứ mấy (0 = đầu tiên): /lich-trinh dùng 0, /ban-do dùng 1 để 2 trang
 * không trùng ảnh; không đủ ảnh thì lùi về ảnh đầu.
 */
export const placeShareImage = cache(
  async (kind: "CHECKIN" | "CAFE" | "RESTAURANT", nth = 0): Promise<string | null> => {
    try {
      const rows = await prisma.place.findMany({
        where: { kind, published: true, coverImage: { not: null } },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        take: nth + 4,
        select: { coverImage: true },
      });
      const urls = [...new Set(rows.map((r) => r.coverImage).filter((u): u is string => !!u && !isVideoUrl(u)))];
      return urls[nth] ?? urls[0] ?? null;
    } catch {
      return null;
    }
  },
);

/** Ảnh đại diện cho trang danh sách /kinh-nghiem: ảnh bìa bài viết mới nhất có ảnh. */
export const articleShareImage = cache(async (): Promise<string | null> => {
  try {
    const rows = await prisma.article.findMany({
      where: { published: true, coverImage: { not: null } },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: { coverImage: true },
    });
    return rows.map((r) => r.coverImage).find((u): u is string => !!u && !isVideoUrl(u)) ?? null;
  } catch {
    return null;
  }
});
