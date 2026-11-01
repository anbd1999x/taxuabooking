import type { Place, PlaceReview } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { renderMarkdown } from "@/lib/markdown";
import { formatDate } from "@/lib/format";
import { SITE } from "@/lib/site";
import { CafeDetailBody, type CafeRelated } from "./CafeDetailBody";

/** Trạng thái mở cửa (giờ VN) + nhãn kiểu "Đang mở · đóng 18:00". */
function openInfo(hours: string | null): { open: boolean; text: string } {
  const m = (hours ?? "").match(/(\d{1,2}):(\d{2})\s*[–\-]\s*(\d{1,2}):(\d{2})/);
  if (!m) return { open: true, text: "Giờ mở cửa theo quán" };
  const nowVN = new Date(Date.now() + 7 * 3600_000);
  const cur = nowVN.getUTCHours() * 60 + nowVN.getUTCMinutes();
  const from = +m[1] * 60 + +m[2];
  const to = +m[3] * 60 + +m[4];
  const open = from <= to ? cur >= from && cur < to : cur >= from || cur < to;
  const hm = (h: string, mm: string) => `${h}:${mm}`;
  return { open, text: open ? `Đang mở · đóng ${hm(m[3], m[4])}` : `Đã đóng · mở ${hm(m[1], m[2])}` };
}

function mapEmbed(place: Place): string {
  const url = (place.mapUrl ?? "").trim();
  if (url.includes("/maps/embed")) return url;
  const at = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (at) return `https://www.google.com/maps?q=${at[1]},${at[2]}&z=16&output=embed`;
  const qp = url.match(/[?&]q=([^&]+)/);
  if (qp) return `https://www.google.com/maps?q=${qp[1]}&z=15&output=embed`;
  const q = encodeURIComponent(`${place.name} Tà Xùa, Bắc Yên, Sơn La`);
  return `https://www.google.com/maps?q=${q}&z=14&output=embed`;
}

function mapOpenUrl(place: Place): string {
  const url = (place.mapUrl ?? "").trim();
  if (url) return url;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${place.name} Tà Xùa Bắc Yên Sơn La`)}`;
}

function autoContent(p: Place, tags: string[]): string {
  const parts: string[] = [];
  parts.push(
    `${p.name} nằm ở khu vực **${p.area}** của Tà Xùa${p.hours ? `, mở cửa ${p.hours}` : ""}${p.price ? `, giá ${p.price.toLowerCase()}` : ""}.` +
      (p.desc ? ` ${p.desc}` : ""),
  );
  if (tags.length) parts.push(`## Điểm nổi bật\n\n${tags.map((t) => `- ${t}`).join("\n")}`);
  parts.push(
    `## Giờ ghé đẹp nhất\n\nSáng **5h30–9h** là khung mây dày nhất — tới sớm để có bàn mép ban công; chiều **16h30–18h** đón hoàng hôn. Xem thêm [kinh nghiệm cà phê săn mây](/kinh-nghiem/ca-phe-san-may-ta-xua).`,
  );
  return parts.join("\n\n");
}

export async function CafeDetail({ place, basePath }: { place: Place & { reviews: PlaceReview[] }; basePath: string }) {
  const gallery = [place.coverImage, ...(place.images ?? "").split("|")].map((s) => (s ?? "").trim()).filter(Boolean);
  const reviews = place.reviews;
  const avg = reviews.length ? reviews.reduce((a, r) => a + r.rating, 0) / reviews.length : null;
  const dist = [5, 4, 3, 2, 1].map((s) => reviews.filter((r) => r.rating === s).length);

  const rawTags = (place.tags ?? "").split(",").map((t) => t.trim()).filter(Boolean);
  const feat = rawTags.some((t) => /^gợi ý$/i.test(t));
  const tags = rawTags.filter((t) => !/^gợi ý$/i.test(t));

  const sameArea = await prisma.place.findMany({
    where: { kind: place.kind, published: true, id: { not: place.id }, area: place.area },
    orderBy: { sortOrder: "asc" },
    take: 4,
  });
  const fill =
    sameArea.length < 4
      ? await prisma.place.findMany({
          where: { kind: place.kind, published: true, id: { notIn: [place.id, ...sameArea.map((x) => x.id)] } },
          orderBy: { sortOrder: "asc" },
          take: 4 - sameArea.length,
        })
      : [];
  const related: CafeRelated[] = [...sameArea, ...fill].map((r) => ({
    id: r.id,
    slug: r.slug ?? r.id,
    name: r.name,
    area: r.area,
    hours: r.hours,
    price: r.price,
    tags: (r.tags ?? "").split(",").map((t) => t.trim()).filter((t) => t && !/^gợi ý$/i.test(t)),
    image: r.coverImage ?? null,
  }));

  const { open, text: openText } = openInfo(place.hours);
  const contentHtml = renderMarkdown(place.content?.trim() || autoContent(place, tags));

  const pageUrl = `${SITE.url}${basePath}/${place.slug}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CafeOrCoffeeShop",
    name: place.name,
    url: pageUrl,
    image: gallery.length ? gallery : undefined,
    telephone: place.phone ?? undefined,
    address: {
      "@type": "PostalAddress",
      streetAddress: place.address ?? undefined,
      addressLocality: `${place.area}, Tà Xùa, Bắc Yên`,
      addressRegion: "Sơn La",
      addressCountry: "VN",
    },
    priceRange: place.price ?? undefined,
    openingHours: place.hours ?? undefined,
    ...(avg != null ? { aggregateRating: { "@type": "AggregateRating", ratingValue: Number(avg.toFixed(1)), reviewCount: reviews.length } } : {}),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <CafeDetailBody
        placeId={place.id}
        slug={place.slug ?? place.id}
        basePath={basePath}
        name={place.name}
        area={place.area}
        address={place.address}
        hours={place.hours}
        price={place.price}
        phone={place.phone}
        feat={feat}
        openText={openText}
        openOpen={open}
        gallery={gallery}
        contentHtml={contentHtml}
        amenities={tags}
        avg={avg}
        reviewCount={reviews.length}
        dist={dist}
        reviews={reviews.map((r) => ({ id: r.id, name: r.name, rating: r.rating, content: r.content, date: formatDate(r.createdAt) }))}
        mapEmbed={mapEmbed(place)}
        mapOpenUrl={mapOpenUrl(place)}
        related={related}
      />
    </>
  );
}
