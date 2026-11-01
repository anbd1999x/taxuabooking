import Link from "next/link";
import Image from "next/image";
import type { Place, PlaceReview } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { renderMarkdown } from "@/lib/markdown";
import { formatDate } from "@/lib/format";
import { SITE } from "@/lib/site";
import { PlaceReviewForm } from "./PlaceReviewForm";

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

/** Nội dung mặc định khi admin chưa biên soạn mô tả chi tiết. */
function autoContent(p: Place): string {
  const isCafe = p.kind === "CAFE";
  const tags = (p.tags ?? "").split(",").map((t) => t.trim()).filter(Boolean);
  const parts: string[] = [];
  parts.push(
    `${p.name} nằm ở khu vực **${p.area}** của Tà Xùa${p.hours ? `, mở cửa ${p.hours}` : ""}${p.price ? `, giá ${p.price.toLowerCase()}` : ""}.` +
      (p.desc ? ` ${p.desc}` : ""),
  );
  if (tags.length) parts.push(`## Điểm nổi bật\n\n${tags.map((t) => `- ${t}`).join("\n")}`);
  parts.push(
    isCafe
      ? `## Giờ ghé đẹp nhất\n\nSáng **5h30–9h** là khung mây dày nhất — tới sớm để có bàn mép ban công; chiều **16h30–18h** đón hoàng hôn. Xem thêm [kinh nghiệm cà phê săn mây](/kinh-nghiem/ca-phe-san-may-ta-xua).`
      : `## Mẹo gọi món\n\nƯu tiên các món bản địa: gà đồi, cá suối, rau cải mèo; nhóm đông nên **đặt bàn trước từ chiều**, món tính theo cân nhớ hỏi giá trước. Xem thêm [món ngon Tà Xùa](/kinh-nghiem/an-gi-o-ta-xua).`,
  );
  return parts.join("\n\n");
}

export async function PlaceDetail({ place, basePath }: { place: Place & { reviews: PlaceReview[] }; basePath: string }) {
  const gallery = [place.coverImage, ...(place.images ?? "").split("|")].map((s) => (s ?? "").trim()).filter(Boolean);
  const reviews = place.reviews;
  const avg = reviews.length ? reviews.reduce((a, r) => a + r.rating, 0) / reviews.length : null;

  // Gợi ý quán khác: cùng khu trước, rồi cùng loại.
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
  const related = [...sameArea, ...fill];

  const pageUrl = `${SITE.url}${basePath}/${place.slug}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": place.kind === "CAFE" ? "CafeOrCoffeeShop" : "Restaurant",
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
    ...(avg != null
      ? { aggregateRating: { "@type": "AggregateRating", ratingValue: Number(avg.toFixed(1)), reviewCount: reviews.length } }
      : {}),
  };

  const kindLabel = place.kind === "CAFE" ? "Cafe" : "Nhà hàng";
  const listLabel = place.kind === "CAFE" ? "Cafe Tà Xùa" : "Nhà hàng Tà Xùa";
  const tags = (place.tags ?? "").split(",").map((t) => t.trim()).filter(Boolean);

  return (
    <div className="container-page py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <nav className="mb-4 text-sm text-gray-500">
        <Link href="/" className="hover:text-forest-700">Trang chủ</Link>
        <span className="mx-2">/</span>
        <Link href={basePath} className="hover:text-forest-700">{listLabel}</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-700">{place.name}</span>
      </nav>

      {/* Ảnh */}
      {gallery.length > 0 && (
        <div className={`grid gap-2 ${gallery.length > 1 ? "sm:grid-cols-[2fr_1fr]" : ""}`}>
          <div className="relative aspect-[16/9] overflow-hidden rounded-2xl bg-forest-50">
            <Image src={gallery[0]} alt={place.name} fill priority sizes="(max-width:640px) 100vw, 800px" className="object-cover" />
          </div>
          {gallery.length > 1 && (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-1">
              {gallery.slice(1, 4).map((g, i) => (
                <div key={i} className="relative aspect-[16/10] overflow-hidden rounded-xl bg-forest-50">
                  <Image src={g} alt={`${place.name} ${i + 2}`} fill sizes="260px" className="object-cover" />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-forest-100 px-3 py-1 text-xs font-bold text-forest-800">{kindLabel}</span>
            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-600">📍 {place.area}</span>
            {avg != null && (
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
                ⭐ {avg.toFixed(1)} · {reviews.length} đánh giá
              </span>
            )}
          </div>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-ink">{place.name}</h1>
          {place.desc && <p className="mt-2 text-[17px] text-gray-600">{place.desc}</p>}
          {tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {tags.map((t) => (
                <span key={t} className="rounded-full bg-forest-50 px-3 py-1.5 text-xs font-semibold text-forest-700">{t}</span>
              ))}
            </div>
          )}

          {/* Mô tả chi tiết */}
          <div
            className="mt-5 leading-relaxed text-gray-700 [&_a]:font-semibold [&_a]:text-forest-700 [&_a]:underline [&_h2]:mt-7 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-ink [&_h3]:mt-5 [&_h3]:text-lg [&_h3]:font-bold [&_h3]:text-ink [&_img]:my-4 [&_img]:w-full [&_img]:rounded-2xl [&_li]:my-1 [&_p]:my-3.5 [&_ul]:my-3.5 [&_ul]:list-inside [&_ul]:list-disc"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(place.content?.trim() || autoContent(place)) }}
          />

          {/* Vị trí */}
          <section className="mt-8">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h2 className="text-xl font-bold text-ink">Vị trí</h2>
              <a href={mapOpenUrl(place)} target="_blank" rel="noopener noreferrer" className="whitespace-nowrap rounded-full bg-forest-700 px-4 py-2 text-sm font-semibold text-white hover:bg-forest-800">
                Mở Google Maps ↗
              </a>
            </div>
            <p className="mt-1 text-sm text-gray-500">{place.address || `${place.area}, Tà Xùa, Bắc Yên, Sơn La`}</p>
            <div className="mt-3 h-[260px] overflow-hidden rounded-2xl ring-1 ring-black/5">
              <iframe src={mapEmbed(place)} loading="lazy" referrerPolicy="no-referrer-when-downgrade" title={`Bản đồ ${place.name}`} className="h-full w-full border-0" />
            </div>
          </section>

          {/* Đánh giá */}
          <section className="mt-8">
            <h2 className="text-xl font-bold text-ink">Đánh giá{reviews.length > 0 ? ` (${reviews.length})` : ""}</h2>
            {reviews.length === 0 ? (
              <p className="mt-2 text-sm text-gray-500">Chưa có đánh giá nào — hãy là người đầu tiên!</p>
            ) : (
              <div className="mt-3 space-y-3">
                {reviews.map((r) => (
                  <div key={r.id} className="rounded-2xl bg-white p-4 ring-1 ring-black/5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-ink">{r.name}</span>
                      <span className="text-sm text-amber-500">{"⭐".repeat(r.rating)}</span>
                      <span className="text-xs text-gray-400">{formatDate(r.createdAt)}</span>
                    </div>
                    <p className="mt-1.5 text-[15px] leading-relaxed text-gray-700">{r.content}</p>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4 rounded-2xl bg-white p-4 ring-1 ring-black/5">
              <PlaceReviewForm placeId={place.id} />
            </div>
          </section>
        </div>

        {/* Cột phải: thông tin nhanh */}
        <aside className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5 lg:sticky lg:top-20">
          <div className="text-lg font-extrabold text-ink">Thông tin nhanh</div>
          <dl className="mt-3 space-y-2.5 text-sm">
            <div className="flex justify-between gap-3"><dt className="text-gray-500">Khu vực</dt><dd className="font-semibold text-ink">{place.area}</dd></div>
            {place.hours && <div className="flex justify-between gap-3"><dt className="text-gray-500">Giờ mở cửa</dt><dd className="font-semibold text-ink">{place.hours}</dd></div>}
            {place.price && <div className="flex justify-between gap-3"><dt className="text-gray-500">Giá</dt><dd className="font-semibold text-sunset-600">{place.price}</dd></div>}
            {place.phone && (
              <div className="flex justify-between gap-3"><dt className="text-gray-500">Điện thoại</dt><dd><a href={`tel:${place.phone.replace(/\s/g, "")}`} className="font-bold text-forest-700 hover:underline">{place.phone}</a></dd></div>
            )}
          </dl>
          {place.phone && (
            <a href={`tel:${place.phone.replace(/\s/g, "")}`} className="mt-4 block rounded-xl bg-sunset-500 py-3 text-center text-sm font-bold text-white hover:bg-sunset-600">
              📞 Gọi {place.phone}
            </a>
          )}
          <div className="mt-4 border-t border-gray-100 pt-4 text-[13px] leading-relaxed text-gray-500">
            Ở gần đây? Xem <Link href="/homestay" className="font-semibold text-forest-700 hover:underline">homestay {place.area}</Link> hoặc đặt{" "}
            <Link href="/xe-cabin" className="font-semibold text-forest-700 hover:underline">xe cabin</Link> cho chuyến đi.
          </div>
        </aside>
      </div>

      {/* Gợi ý quán khác */}
      {related.length > 0 && (
        <section className="mt-12 border-t border-gray-200 pt-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-xl font-bold text-ink">{kindLabel} khác ở Tà Xùa</h2>
            <Link href={basePath} className="text-sm font-bold text-forest-700 hover:text-sunset-600">Xem tất cả →</Link>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((p) => (
              <Link key={p.id} href={`${basePath}/${p.slug}`} className="group flex flex-col gap-1.5 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 transition hover:shadow-md">
                <div className="font-extrabold leading-snug text-ink group-hover:text-forest-700">{p.name}</div>
                <div className="text-xs text-gray-500">📍 {p.area}{p.hours ? ` · 🕐 ${p.hours}` : ""}</div>
                {p.desc && <p className="line-clamp-2 text-[13px] text-gray-600">{p.desc}</p>}
                {p.price && <span className="mt-auto self-start rounded-full bg-sunset-50 px-2.5 py-1 text-xs font-bold text-sunset-600">{p.price}</span>}
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
