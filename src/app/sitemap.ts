import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { PUBLIC_VENUE } from "@/lib/ticket-core";
import { ARTICLE_TOPICS, CATEGORIES, CATEGORY_LIST, serviceCatSlug } from "@/lib/constants";
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
      where: { published: true, slug: { not: null }, kind: { in: ["RESTAURANT", "CAFE", "CHECKIN"] } },
      select: { slug: true, kind: true, updatedAt: true },
    }),
    // Địa điểm bán vé / đặt bàn đang mở bán (/ve/<slug>).
    prisma.ticketVenue.findMany({ where: PUBLIC_VENUE, select: { slug: true, updatedAt: true } }),
  ]);

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "daily", priority: 1 },
    { url: `${base}/lich-trinh`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${base}/ban-do`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${base}/diem-den`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${base}/thoi-tiet-ta-xua`, changeFrequency: "daily", priority: 0.6 },
    { url: `${base}/kinh-nghiem`, changeFrequency: "weekly", priority: 0.6 },
    // Trang hub chủ đề bài kinh nghiệm (/kinh-nghiem/chu-de/<topic>); link cũ ?topic=… đã 308 sang đây.
    ...ARTICLE_TOPICS.map((t) => ({ url: `${base}/kinh-nghiem/chu-de/${t.key}`, changeFrequency: "weekly" as const, priority: 0.6 })),
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
    // Trang điều khoản / bảo mật: tín hiệu tin cậy (E-E-A-T) — trước đây chỉ có link ở chân trang, không nằm trong sitemap.
    { url: `${base}/cam-ket/dieu-khoan`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/chinh-sach-bao-mat`, changeFrequency: "yearly", priority: 0.3 },
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

  // Trang chi tiết nhà hàng / cafe / điểm tham quan (/diem-den/<slug>).
  const placeRoutes: MetadataRoute.Sitemap = places.map((p) => ({
    url: `${base}/${p.kind === "CHECKIN" ? "diem-den" : p.kind === "CAFE" ? "cafe" : "nha-hang"}/${p.slug}`,
    lastModified: p.updatedAt,
    changeFrequency: "weekly",
    priority: 0.5,
  }));

  // Đa ngôn ngữ: MỖI bản (vi, /en, /zh, /ko) là một mục <url> riêng, mục nào cũng khai đủ bộ hreflang (+ x-default).
  // Trước đây chỉ bản tiếng Việt là <loc>, bản dịch chỉ nằm ở hreflang ⇒ Search Console báo ~400 URL bản dịch
  // "URL is unknown to Google" (Google xếp lịch thu thập theo <loc>, không theo hreflang). Xem docs/seo-geo.md.
  const all = [...staticRoutes, ...categoryRoutes, ...serviceRoutes, ...articleRoutes, ...placeRoutes];
  return all.flatMap((r) => {
    const path = r.url.slice(base.length) || "/";
    if (VI_ONLY_PATHS.includes(path)) return [r]; // trang chỉ tiếng Việt: không khai bản en/zh/ko
    const languages: Record<string, string> = { [LOCALE_META.vi.htmlLang]: r.url, "x-default": r.url };
    for (const l of TARGET_LOCALES) languages[LOCALE_META[l].htmlLang] = `${base}${localePath(path, l)}`;
    return [
      { ...r, alternates: { languages } },
      ...TARGET_LOCALES.map((l) => ({ ...r, url: `${base}${localePath(path, l)}`, alternates: { languages } })),
    ];
  });
}
