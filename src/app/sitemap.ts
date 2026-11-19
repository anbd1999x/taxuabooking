import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { PUBLIC_VENUE } from "@/lib/ticket-core";
import { CATEGORIES, CATEGORY_LIST, serviceCatSlug } from "@/lib/constants";
import { SITE } from "@/lib/site";
import { LOCALE_META, TARGET_LOCALES, VI_ONLY_PATHS, localePath } from "@/lib/i18n/config";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = SITE.url.replace(/\/$/, "");

  // Không đưa trang từng phòng (/phong/<id>) vào sitemap: gần như trùng nhau và đã noindex — dồn lượt thu thập của Google cho trang chính.
  const [services, articles, places, venues] = await Promise.all([
    prisma.service.findMany({
      where: { published: true },
      select: { slug: true, category: true, updatedAt: true },
    }),
    prisma.article.findMany({
      where: { published: true },
      select: { slug: true, updatedAt: true },
    }),
    prisma.place.findMany({
      where: { published: true, slug: { not: null }, kind: { in: ["RESTAURANT", "CAFE"] } },
      select: { slug: true, kind: true, updatedAt: true },
    }),
    // Địa điểm bán vé / đặt bàn đang mở bán (/ve/<slug>).
    prisma.ticketVenue.findMany({ where: PUBLIC_VENUE, select: { slug: true, updatedAt: true } }),
  ]);

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "daily", priority: 1 },
    { url: `${base}/lich-trinh`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${base}/ban-do`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${base}/kinh-nghiem`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${base}/huong-dan`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/nha-hang`, changeFrequency: "weekly", priority: 0.6 },
    ...(venues.length ? [{ url: `${base}/ve`, changeFrequency: "daily" as const, priority: 0.7 }] : []),
    ...venues.map((v) => ({ url: `${base}/ve/${v.slug}`, lastModified: v.updatedAt, changeFrequency: "daily" as const, priority: 0.6 })),
    { url: `${base}/cafe`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${base}/lien-he`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${base}/gioi-thieu`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${base}/hop-tac`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/hop-tac/xe-may`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${base}/gop-y`, changeFrequency: "daily", priority: 0.5 },
    { url: `${base}/cam-ket`, changeFrequency: "monthly", priority: 0.5 },
  ];

  const categoryRoutes: MetadataRoute.Sitemap = CATEGORY_LIST.map((c) => ({
    url: `${base}/${c.slug}`,
    changeFrequency: "daily",
    priority: 0.8,
  }));

  const serviceRoutes: MetadataRoute.Sitemap = services.map((s) => ({
    url: `${base}/${serviceCatSlug(s.category)}/${s.slug}`,
    lastModified: s.updatedAt,
    changeFrequency: "daily",
    priority: 0.7,
  }));

  const articleRoutes: MetadataRoute.Sitemap = articles.map((a) => ({
    url: `${base}/kinh-nghiem/${a.slug}`,
    lastModified: a.updatedAt,
    changeFrequency: "monthly",
    priority: 0.5,
  }));

  // Trang chi tiết nhà hàng / cafe.
  const placeRoutes: MetadataRoute.Sitemap = places.map((p) => ({
    url: `${base}/${p.kind === "CAFE" ? "cafe" : "nha-hang"}/${p.slug}`,
    lastModified: p.updatedAt,
    changeFrequency: "weekly",
    priority: 0.5,
  }));

  // Đa ngôn ngữ: mỗi URL khai kèm các bản /en, /zh, /ko (hreflang) để Google ghép cặp.
  const all = [...staticRoutes, ...categoryRoutes, ...serviceRoutes, ...articleRoutes, ...placeRoutes];
  return all.map((r) => {
    const path = r.url.slice(base.length) || "/";
    if (VI_ONLY_PATHS.includes(path)) return r; // trang chỉ tiếng Việt: không khai bản en/zh/ko
    const languages: Record<string, string> = { [LOCALE_META.vi.htmlLang]: r.url };
    for (const l of TARGET_LOCALES) languages[LOCALE_META[l].htmlLang] = `${base}${localePath(path, l)}`;
    return { ...r, alternates: { languages } };
  });
}
