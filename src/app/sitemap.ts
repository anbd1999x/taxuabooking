import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { CATEGORIES, CATEGORY_LIST } from "@/lib/constants";
import { SITE } from "@/lib/site";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = SITE.url.replace(/\/$/, "");

  const [services, articles, rooms, places] = await Promise.all([
    prisma.service.findMany({
      where: { published: true },
      select: { slug: true, category: true, updatedAt: true },
    }),
    prisma.article.findMany({
      where: { published: true },
      select: { slug: true, updatedAt: true },
    }),
    prisma.room.findMany({
      where: { roomType: { service: { published: true } } },
      select: { id: true, updatedAt: true, roomType: { select: { service: { select: { slug: true, category: true } } } } },
    }),
    prisma.place.findMany({
      where: { published: true, slug: { not: null } },
      select: { slug: true, kind: true, updatedAt: true },
    }),
  ]);

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "daily", priority: 1 },
    { url: `${base}/kinh-nghiem`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${base}/huong-dan`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/nha-hang`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${base}/cafe`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${base}/lien-he`, changeFrequency: "monthly", priority: 0.4 },
  ];

  const categoryRoutes: MetadataRoute.Sitemap = CATEGORY_LIST.map((c) => ({
    url: `${base}/${c.slug}`,
    changeFrequency: "daily",
    priority: 0.8,
  }));

  const serviceRoutes: MetadataRoute.Sitemap = services.map((s) => ({
    url: `${base}/${CATEGORIES[s.category].slug}/${s.slug}`,
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

  // Trang chi tiết từng phòng homestay.
  const roomRoutes: MetadataRoute.Sitemap = rooms.map((r) => ({
    url: `${base}/${CATEGORIES[r.roomType.service.category].slug}/${r.roomType.service.slug}/phong/${r.id}`,
    lastModified: r.updatedAt,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  // Trang chi tiết nhà hàng / cafe.
  const placeRoutes: MetadataRoute.Sitemap = places.map((p) => ({
    url: `${base}/${p.kind === "CAFE" ? "cafe" : "nha-hang"}/${p.slug}`,
    lastModified: p.updatedAt,
    changeFrequency: "weekly",
    priority: 0.5,
  }));

  return [...staticRoutes, ...categoryRoutes, ...serviceRoutes, ...roomRoutes, ...articleRoutes, ...placeRoutes];
}
