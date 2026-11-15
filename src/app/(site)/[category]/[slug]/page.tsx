import type { Metadata } from "next";
import { ogBlock } from "@/lib/og";
import { unstable_cache } from "next/cache";
import Link from "@/components/Link";
import { notFound, redirect } from "next/navigation";
import Image from "next/image";
import { getServiceDetail, getSettings, getHomestayCards } from "@/lib/queries";
import { CATEGORIES } from "@/lib/constants";
import { formatPrice, toNumber } from "@/lib/format";
import { SITE } from "@/lib/site";
import { AgentNote } from "@/components/AgentNote";
import { prisma } from "@/lib/prisma";
import { roomPricing, roomListPrice, roomListDaysOfWeek, isRoomPriceOnRequest } from "@/lib/availability";
import { today, toDateKey, addDays } from "@/lib/dates";
import { BookingPanel } from "@/components/BookingPanel";
import { HomestayBooking, type HomestayRoom } from "@/components/HomestayBooking";
import { CabinBooking } from "@/components/cabin/CabinBooking";
import { CabinContactPanel } from "@/components/cabin/CabinContactPanel";
import { ServiceReviews } from "@/components/ServiceReviews";
import { buildDirectionOptions, getCabinFareOptions } from "@/lib/cabin";
import { CabinRoutes } from "@/components/CabinRoutes";
import { Gallery } from "@/components/Gallery";
import { Badge } from "@/components/ui/Badge";
import { getT, lp, tLong } from "@/lib/i18n/server";
import { i18nAlternates, i18nOg } from "@/lib/i18n/meta";
import { renderMarkdown } from "@/lib/markdown";

export const dynamic = "force-dynamic";

/**
 * Mở link Google Maps rút gọn (maps.app.goo.gl / goo.gl) → URL đầy đủ có toạ độ.
 * Cache 1 ngày theo URL: không fetch ra Google mỗi lần xem trang (từng làm
 * trang chi tiết chậm vài giây mỗi click).
 */
const expandMapsUrl = unstable_cache(
  async (mapUrl: string | null | undefined): Promise<string | null> => {
    const u = (mapUrl ?? "").trim();
    if (!u) return null;
    if (!/^https?:\/\/(maps\.app\.goo\.gl|goo\.gl|g\.co)\//i.test(u)) return u;
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 4000);
      const res = await fetch(u, { redirect: "follow", signal: ctrl.signal });
      clearTimeout(timer);
      return res.url || u;
    } catch {
      return u; // không mở được thì giữ link gốc (vẫn dùng cho nút "Mở bản đồ")
    }
  },
  ["expand-maps-url"],
  { revalidate: 86400 },
);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string; slug: string }>;
}): Promise<Metadata> {
  const tr = await getT();
  const { slug } = await params;
  const service = await getServiceDetail(slug);
  if (!service) return {};
  const cat = CATEGORIES[service.category];
  const cover = service.images.find((i) => i.isCover)?.url ?? service.images[0]?.url;
  // Tiêu đề tìm kiếm: tên + loại dịch vụ + "Tà Xùa" (tên trần như "Nhà bên suối" không nói lên trang bán gì).
  const t = tr(service.title.trim());
  const tx = /tà xùa/i.test(t) ? "" : " Tà Xùa";
  const title =
    service.category === "HOMESTAY" || service.category === "BUNGALOW"
      ? tr("{0}{1}{2}: giá phòng & lịch trống", [t, /homestay|homstay|bungalow|retreat|home|house|village|garden/i.test(t) ? "" : " Homestay", tx])
      : service.category === "CABIN"
        ? tr("{0}: xe cabin Hà Nội – Tà Xùa", [t])
        : `${t}${tx}`;
  // Mô tả: phần chủ cơ sở viết thường rất ngắn ⇒ nối thêm khu vực + lời mời xem giá/đặt chỗ.
  const base = ((await tLong(service.summary)) ?? "").trim().replace(/[.\s]+$/, "");
  const tail =
    service.category === "HOMESTAY" || service.category === "BUNGALOW"
      ? tr("{0} Xem giá từng phòng, lịch trống theo ngày và đặt phòng tại Tà Xùa Booking.", [service.area && !/^tà xùa$/i.test(service.area.trim()) ? " " + tr("Khu {0}.", [tr(service.area)]) : ""])
      : service.category === "CABIN"
        ? tr(" Xem giá vé khứ hồi theo điểm đón, giờ chạy, chỗ trống theo ngày và đặt vé tại Tà Xùa Booking.")
        : tr(" Xem giá, tình trạng theo ngày và đặt tại Tà Xùa Booking.");
  const description = base.length >= 120 ? base + "." : `${base ? base + "." : t + "."}${tail}`;
  return {
    title,
    description,
    alternates: await i18nAlternates(`/${cat.slug}/${service.slug}`),
    openGraph: await i18nOg({ title, description, path: `/${cat.slug}/${service.slug}`, image: cover, alt: tr(service.title) }),
  };
}

export default async function ServiceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ category: string; slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const tr = await getT();
  const { category, slug } = await params;
  const sp = await searchParams;
  const [service, settings] = await Promise.all([
    getServiceDetail(slug),
    getSettings(),
  ]);
  if (!service) notFound();

  const cat = CATEGORIES[service.category];
  // Chuẩn hoá URL: nếu sai danh mục, chuyển về URL đúng (tốt cho SEO).
  if (category !== cat.slug) redirect(await lp(`/${cat.slug}/${service.slug}`));

  // Đơn đặt do Tà Xùa Booking gọi xác nhận → dùng số nền tảng (settings), không dùng số riêng của cơ sở.
  const phone = settings.contactPhone || SITE.defaultPhone;
  const zalo = settings.contactZalo || SITE.defaultZalo;

  // ===== Homestay / Bungalow: trải nghiệm đặt phòng theo thiết kế (lịch + thẻ phòng + panel) =====
  // Thứ tự hiển thị phòng: theo "Thứ tự hiển thị" của TỪNG PHÒNG trên toàn homestay
  // (không gom theo hạng); bằng nhau thì giữ thứ tự hạng phòng.
  const stayRooms = service.roomTypes
    .flatMap((rt) => rt.rooms.map((r) => ({ rt, r })))
    .sort(
      (a, b) =>
        a.r.sortOrder - b.r.sortOrder ||
        a.rt.sortOrder - b.rt.sortOrder ||
        a.r.name.localeCompare(b.r.name, "vi"),
    );
  const isStayWithRooms = cat.availabilityKind === "stay" && cat.key !== "COMBO" && stayRooms.length > 0;

  if (isStayWithRooms) {
    const NUM_DAYS = 75;
    const start = today();
    const windowEnd = addDays(start, NUM_DAYS - 1);
    const roomIds = stayRooms.map((x) => x.r.id);
    // Ngày bị chiếm (không bán) của từng phòng trong cửa sổ hiển thị.
    // Homestay "chỉ liên hệ" không quản lý lịch → bỏ qua, mọi phòng coi như trống.
    const statuses = service.contactOnly
      ? []
      : await prisma.roomDayStatus.findMany({
          where: { roomId: { in: roomIds }, date: { gte: start, lte: windowEnd }, status: { not: "AVAILABLE" } },
          select: { roomId: true, date: true },
        });
    const occByRoom = new Map<string, string[]>();
    // Homestay "không quản lý lịch" có khai NGÀY HẾT PHÒNG → mọi phòng kín các đêm đó.
    if (service.contactOnly && service.soldOutDates.length) {
      const sk = toDateKey(start), ek = toDateKey(windowEnd);
      const closed = service.soldOutDates.filter((k) => k >= sk && k <= ek);
      if (closed.length) for (const id of roomIds) occByRoom.set(id, [...closed]);
    }
    for (const st of statuses) {
      const arr = occByRoom.get(st.roomId) ?? [];
      arr.push(toDateKey(st.date));
      occByRoom.set(st.roomId, arr);
    }
    const rooms: HomestayRoom[] = stayRooms.map(({ rt, r }) => {
      const pricing = roomPricing(r);
      return {
        id: r.id,
        typeName: rt.name,
        name: r.name,
        capacity: r.capacity,
        maxCapacity: r.maxCapacity,
        // Phụ thu CHUNG của cả homestay (cấu hình ở Service, áp cho mọi phòng).
        extraFee: toNumber(service.extraPersonFee),
        earlyFee: toNumber(service.earlyCheckinFee),
        lateFee: toNumber(service.lateCheckoutFee),
        amenities: (r.amenities ?? "").split(",").map((a) => a.trim()).filter(Boolean),
        // Ảnh thẻ phòng = ảnh riêng của phòng + ảnh/video của hạng phòng (nhiều
        // homestay chỉ có ảnh theo hạng, phòng con chưa up ảnh riêng).
        media: [...r.images, ...rt.images].map((i) => ({
          url: i.url,
          type: /\.(mp4|webm|mov|m4v|ogg)(\?|$)/i.test(i.url) ? ("video" as const) : ("image" as const),
        })),
        base: pricing.weekdayPrice,
        listPrice: toNumber(r.listPrice) ?? 0,
        hasSale: roomListPrice(r) != null,
        por: isRoomPriceOnRequest(r),
        days: pricing.daysOfWeek ?? [null, null, null, null, null, null, null],
        listDays: roomListDaysOfWeek(r),
        occupied: occByRoom.get(r.id) ?? [],
      };
    });
    const mapQuery = `${service.title} ${service.area ?? "Tà Xùa, Bắc Yên, Sơn La"}`;
    // Link chia sẻ rút gọn (maps.app.goo.gl / goo.gl) không chứa toạ độ → mở
    // redirect phía server để lấy URL đầy đủ (có @lat,lng) cho bản đồ đúng vị trí.
    const fromQ = typeof sp.from === "string" ? sp.from : null;
    const toQ = typeof sp.to === "string" ? sp.to : null;
    const [resolvedMapUrl, homestayCards] = await Promise.all([
      expandMapsUrl(service.mapUrl),
      getHomestayCards(fromQ, toQ),
    ]);
    const suggestions = homestayCards
      .filter((c) => c.id !== service.id)
      .slice(0, 4)
      .map((c) => ({ slug: c.slug, name: c.name, area: c.area, price: c.price, cover: c.cover, cat: c.cat, status: c.status }));

    // JSON-LD cho Google: cơ sở lưu trú + breadcrumb.
    const roomPrices = rooms.map((r) => r.base).filter((n) => n > 0);
    const pageUrl = `${SITE.url}/${cat.slug}/${service.slug}`;
    const stayJsonLd = {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "LodgingBusiness",
          "@id": `${pageUrl}#lodging`,
          name: service.title,
          description: service.summary,
          url: pageUrl,
          image: service.images.slice(0, 5).map((i) => `${SITE.url}${i.url}`),
          telephone: phone.replace(/\s/g, ""),
          address: {
            "@type": "PostalAddress",
            addressLocality: service.area ?? tr("Tà Xùa, Bắc Yên"),
            addressRegion: tr("Sơn La"),
            addressCountry: "VN",
          },
          ...(roomPrices.length
            ? { priceRange: tr("{0}–{1}đ/đêm", [Math.min(...roomPrices).toLocaleString("vi-VN"), Math.max(...roomPrices).toLocaleString("vi-VN")]) }
            : {}),
        },
        {
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: tr("Trang chủ"), item: SITE.url },
            { "@type": "ListItem", position: 2, name: cat.shortLabel, item: `${SITE.url}/${cat.slug}` },
            { "@type": "ListItem", position: 3, name: service.title, item: pageUrl },
          ],
        },
      ],
    };

    return (
      <div className="container-page py-8 pb-28 lg:pb-8">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(stayJsonLd) }} />
        <nav className="mb-4 text-sm text-gray-500">
          <Link href="/" className="hover:text-forest-700">{tr("Trang chủ")}</Link>
          <span className="mx-2">/</span>
          <Link href={`/${cat.slug}`} className="hover:text-forest-700">{tr(cat.shortLabel)}</Link>
          <span className="mx-2">/</span>
          <span className="text-gray-700">{tr(service.title)}</span>
        </nav>
        <AgentNote name={service.title} />

        <HomestayBooking
          serviceId={service.id}
          contactOnly={service.contactOnly}
          inquiryOnly={service.inquiryOnly && !service.contactOnly}
          rooms={rooms}
          startKey={toDateKey(start)}
          numDays={NUM_DAYS}
          initialCheckIn={typeof sp.from === "string" ? sp.from : null}
          initialCheckOut={typeof sp.to === "string" ? sp.to : null}
          phone={phone}
          zalo={zalo}
          area={service.area}
          mapQuery={mapQuery}
          mapUrl={resolvedMapUrl}
          policy={await tLong(service.policy)}
          weekendPolicy={service.weekendPolicy}
          childFreeUnderAge={service.childFreeUnderAge}
          initialAdults={typeof sp.adults === "string" ? Math.max(1, parseInt(sp.adults, 10) || 0) || undefined : undefined}
          initialChildAges={
            typeof sp.kids === "string"
              ? sp.kids.split("-").map((x) => parseInt(x, 10)).filter((n) => Number.isInteger(n) && n >= 0 && n <= 17)
              : undefined
          }
          description={await tLong(service.description)}
          suggestions={suggestions}
          header={
            <div className="flex flex-col gap-4">
              <Gallery images={service.images.map((i) => ({ url: i.url, alt: i.alt }))} title={tr(service.title)} />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="ok">{tr(cat.shortLabel)}</Badge>
                  {service.featured && <Badge tone="warn">{tr("Nổi bật")}</Badge>}
                  {service.area && (
                    <a href="#vi-tri" className="text-sm font-semibold text-forest-700 underline underline-offset-4 hover:text-sunset-600">
                      {tr("📍 {0} · Xem bản đồ ↓", [tr(service.area)])}
                    </a>
                  )}
                </div>
                <h1 className="mt-2 text-[clamp(26px,4vw,40px)] font-extrabold leading-[1.1] tracking-tight text-ink">{tr(service.title)}</h1>
                <p className="mt-2 text-[17px] text-gray-600">{tr(service.summary)}</p>
              </div>
            </div>
          }
        />
        <ServiceReviews serviceId={service.id} path={`/${cat.slug}/${service.slug}`} />
      </div>
    );
  }

  // Xe cabin: dựng dải ngày chiều đi (và chiều về nếu có ngày về) cho widget đặt vé.
  const fromKey = typeof sp.from === "string" ? sp.from : null;
  const toKey = typeof sp.to === "string" ? sp.to : null;
  const cabinOutbound =
    service.category === "CABIN" ? await buildDirectionOptions(service.id, "OUTBOUND", fromKey) : null;
  const cabinReturn =
    service.category === "CABIN" && toKey
      ? await buildDirectionOptions(service.id, "RETURN", toKey)
      : null;
  // Giá chặng/khách theo điểm xuất phát (khứ hồi nếu có ngày về, không thì chiều đi).
  const cabinFares =
    service.category === "CABIN"
      ? await getCabinFareOptions(service.id, Boolean(toKey) || service.contactOnly)
      : null;

  // JSON-LD cho Google: dịch vụ (nhà xe, thuê xe…) + breadcrumb.
  const svcUrl = `${SITE.url}/${cat.slug}/${service.slug}`;
  const svcPrice = Number(service.basePrice ?? 0);
  const svcJsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Service",
        "@id": `${svcUrl}#service`,
        name: service.title,
        serviceType: cat.label,
        description: service.summary,
        url: svcUrl,
        image: service.images.slice(0, 5).map((i) => `${SITE.url}${i.url}`),
        areaServed: tr("Tà Xùa, Sơn La"),
        provider: { "@type": "TravelAgency", name: SITE.name, url: SITE.url, telephone: phone.replace(/\s/g, "") },
        ...(svcPrice > 0 ? { offers: { "@type": "Offer", price: svcPrice, priceCurrency: "VND", url: svcUrl, availability: "https://schema.org/InStock" } } : {}),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: tr("Trang chủ"), item: SITE.url },
          { "@type": "ListItem", position: 2, name: cat.shortLabel, item: `${SITE.url}/${cat.slug}` },
          { "@type": "ListItem", position: 3, name: service.title, item: svcUrl },
        ],
      },
    ],
  };

  return (
    <div className="container-page py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(svcJsonLd) }} />
      <nav className="mb-4 text-sm text-gray-500">
        <Link href="/" className="hover:text-forest-700">{tr("Trang chủ")}</Link>
        <span className="mx-2">/</span>
        <Link href={`/${cat.slug}`} className="hover:text-forest-700">{tr(cat.shortLabel)}</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-700">{tr(service.title)}</span>
      </nav>
      <AgentNote name={service.title} />

      <div className="grid gap-8 lg:grid-cols-[1.6fr_1fr]">
        {/* Nội dung */}
        <div className="min-w-0">
          <Gallery
            images={service.images.map((i) => ({ url: i.url, alt: i.alt }))}
            title={tr(service.title)}
          />

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Badge tone="ok">{tr(cat.shortLabel)}</Badge>
            {service.featured && <Badge tone="warn">{tr("Nổi bật")}</Badge>}
            {service.area && <span className="text-sm text-gray-500">📍 {tr(service.area)}</span>}
          </div>

          <h1 className="mt-2 text-2xl font-bold text-ink sm:text-3xl">{tr(service.title)}</h1>
          <p className="mt-2 text-gray-600">{tr(service.summary)}</p>

          {(() => {
            const base = toNumber(service.basePrice);
            const orig = toNumber(service.originalPrice);
            const onSale = base != null && orig != null && orig > base;
            if (base == null) return null;
            return (
              <p className="mt-3 flex flex-wrap items-baseline gap-x-2">
                <span className="text-sm text-gray-500">{tr("Giá từ")}</span>
                {onSale && <span className="text-base text-gray-400 line-through">{tr(formatPrice(orig))}</span>}
                <span className="text-2xl font-extrabold text-forest-700">{tr(formatPrice(base))}</span>
                {service.priceUnit && <span className="text-sm text-gray-500">{tr(service.priceUnit)}</span>}
                {onSale && (
                  <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-bold text-red-600 ring-1 ring-red-100">
                    {tr("Giảm {0}%", [Math.round((1 - base / orig) * 100)])}
                  </span>
                )}
              </p>
            );
          })()}

          <section className="mt-6">
            <h2 className="text-lg font-semibold text-ink">{tr("Giới thiệu")}</h2>
            {/* Mô tả hỗ trợ markdown tối giản (## / ### / - / > / **đậm**); văn bản thường vẫn giữ xuống dòng như cũ */}
            <div
              className="mt-2 leading-relaxed text-gray-700 [&_a]:font-semibold [&_a]:text-forest-700 [&_a]:underline [&_blockquote]:my-3 [&_blockquote]:rounded-xl [&_blockquote]:border-l-4 [&_blockquote]:border-sunset-500 [&_blockquote]:bg-sunset-50 [&_blockquote]:px-4 [&_blockquote]:py-3 [&_blockquote]:text-ink [&_h2]:mt-5 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-ink [&_h3]:mt-5 [&_h3]:font-bold [&_h3]:text-forest-700 [&_li]:my-1.5 [&_p]:my-2 [&_strong]:font-semibold [&_strong]:text-ink [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(await tLong(service.description)) }}
            />
          </section>

          {/* Lộ trình (cabin) */}
          <CabinRoutes
            routes={service.cabinRoutes.map((r) => {
              const rows = service.cabinPriceRows.filter((p) => p.ticketType === r.direction);
              const price = rows.length ? Math.min(...rows.map((p) => toNumber(p.price) ?? Infinity)) : null;
              return {
                direction: r.direction,
                title: r.title,
                totalTime: r.totalTime,
                startLabel: r.startLabel,
                startInfo: r.startInfo,
                fromPoint: r.fromPoint,
                toPoint: r.toPoint,
                price: price != null && Number.isFinite(price) ? price : null,
                stops: r.stops.map((s) => ({ time: s.time, place: s.place, note: s.note, tag: s.tag })),
              };
            })}
            routeName={service.area}
          />

          {/* Loại phòng */}
          {service.roomTypes.length > 0 && (
            <section className="mt-8">
              <h2 className="text-lg font-semibold text-ink">{tr("Các loại phòng")}</h2>
              <div className="mt-3 space-y-3">
                {service.roomTypes.map((r) => {
                  // Phòng rẻ nhất + giá niêm yết của nó (để gạch ngang khi đang giảm).
                  const priced = r.rooms
                    .map((rm) => {
                      const list = toNumber(rm.listPrice) ?? 0;
                      const sale = toNumber(rm.salePrice);
                      return { eff: sale ?? list, list, onSale: sale != null && list > sale };
                    })
                    .filter((p) => p.eff > 0);
                  const cheapest = priced.length ? priced.reduce((a, b) => (b.eff < a.eff ? b : a)) : null;
                  const fromPrice = cheapest?.eff ?? null;
                  const fromOld = cheapest?.onSale ? cheapest.list : null;
                  const caps = r.rooms.map((rm) => rm.capacity);
                  const capLabel = caps.length
                    ? (Math.min(...caps) === Math.max(...caps) ? `${caps[0]}` : `${Math.min(...caps)}–${Math.max(...caps)}`)
                    : `${r.capacity}`;
                  return (
                  <div key={r.id} className="rounded-xl bg-white p-3 ring-1 ring-black/5">
                    <div className="flex items-start gap-4">
                      <div className="flex-1">
                        <p className="font-medium text-ink">{tr(r.name)}</p>
                        <p className="text-xs text-gray-500">{tr("Sức chứa {0} người · {1} phòng", [tr(capLabel), r.rooms.length || r.totalRooms])}</p>
                        <p className="mt-1 text-sm">
                          {fromPrice != null ? (
                            <>
                              <span className="text-gray-500">{tr("Từ")}{" "}</span>
                              {fromOld != null && (
                                <span className="mr-1 text-gray-400 line-through">{tr(formatPrice(fromOld))}</span>
                              )}
                              <span className="font-semibold text-forest-700">{tr(formatPrice(fromPrice))}</span>
                              <span className="text-gray-500">{tr("/đêm")}</span>
                            </>
                          ) : (
                            <span className="font-semibold text-forest-700">{tr("IB để biết giá")}</span>
                          )}
                        </p>
                      </div>
                    </div>
                    {(r.images.length > 0 || r.imageUrl) && (
                      <div className="mt-3 flex gap-2 overflow-x-auto">
                        {(r.images.length > 0
                          ? r.images.map((i) => ({ url: i.url, alt: i.alt ?? r.name, type: i.type }))
                          : [{ url: r.imageUrl as string, alt: r.name, type: "image" }]
                        ).map((img, idx) => (
                          <div key={idx} className="relative h-28 w-40 flex-shrink-0 overflow-hidden rounded-lg bg-black/5">
                            {img.type === "video" ? (
                              <video src={img.url} className="h-full w-full object-cover" controls playsInline preload="metadata" />
                            ) : (
                              <Image src={img.url} alt={tr(img.alt)} fill sizes="160px" className="object-cover" />
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {r.rooms.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2 border-t border-gray-100 pt-3">
                        {r.rooms.map((room) => (
                          <Link
                            key={room.id}
                            href={`/${cat.slug}/${service.slug}/phong/${room.id}`}
                            className="rounded-lg bg-forest-50 px-3 py-1.5 text-sm font-medium text-forest-700 transition hover:bg-forest-100"
                          >
                            {tr(room.name)} ·{" "}
                            {isRoomPriceOnRequest(room) ? (
                              <span className="font-semibold text-forest-700">{tr("IB để biết giá")}</span>
                            ) : (
                              <>
                                {room.salePrice != null && toNumber(room.listPrice)! > toNumber(room.salePrice)! && (
                                  <span className="font-normal text-gray-400 line-through">{tr(formatPrice(room.listPrice))} </span>
                                )}
                                {tr(formatPrice(room.salePrice ?? room.listPrice))}
                              </>
                            )} →
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Xe cho thuê */}
          {service.rentalVehicles.length > 0 && (
            <section className="mt-8">
              <h2 className="text-lg font-semibold text-ink">{tr("Các loại xe")}</h2>
              <div className="mt-3 space-y-3">
                {service.rentalVehicles.map((v) => (
                  <div key={v.id} className="flex items-center justify-between rounded-xl bg-white p-3 ring-1 ring-black/5">
                    <div>
                      <p className="font-medium text-ink">{tr(v.vehicleType)}</p>
                      <p className="text-xs text-gray-500">
                        {v.totalUnits} xe{v.deliveryFee ? tr(" · phí giao nhận {0}", [tr(formatPrice(v.deliveryFee))]) : ""}
                      </p>
                    </div>
                    <p className="font-semibold text-forest-700">{tr("{0}/ngày", [tr(formatPrice(v.pricePerDay))])}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Bác tài & bảng giá (xe ôm / taxi): giá nguyên ngày + giá 1 chiều theo chặng (xe ôm: chở 1 / 2 người) */}
          {service.transport && (() => {
            const t = service.transport;
            const bike = service.category === "XEOM";
            const cap = t.capacity ?? (bike ? 2 : 4);
            const money = (v: unknown) => (v != null ? tr(formatPrice(v as never)) : tr("Liên hệ"));
            return (
              <section className="mt-8">
                <h2 className="text-lg font-semibold text-ink">{tr("Bác tài & bảng giá")}</h2>
                <div className="mt-3 rounded-xl bg-white p-4 text-sm ring-1 ring-black/5">
                  {t.driverName && (
                    <p><span className="text-gray-500">{tr("Bác tài:")}{" "}</span>{tr(t.driverName)}{t.driverBirthYear ? ` · ${tr("sinh năm {0}", [t.driverBirthYear])}` : ""}</p>
                  )}
                  {t.vehicleType && <p className="mt-1"><span className="text-gray-500">{tr("Phương tiện:")}{" "}</span>{tr(t.vehicleType)}</p>}
                  <p className="mt-1"><span className="text-gray-500">{tr("Chở tối đa:")}{" "}</span>{bike ? tr("{0} người / tài xế", [cap === 1 ? 1 : 2]) : tr("{0} khách / xe", [cap])}</p>
                  <p className="mt-1">
                    <span className="text-gray-500">{tr("Thuê nguyên ngày:")}{" "}</span>
                    <span className="font-semibold text-forest-700">
                      {bike && cap !== 1
                        ? `${tr("chở 1 người")} ${money(t.fixedPrice)} · ${tr("chở 2 người")} ${money(t.dayPriceTwo)}`
                        : money(t.fixedPrice)}
                    </span>
                  </p>
                </div>
                {service.transportRoutes.length > 0 && (
                  <div className="mt-3 overflow-hidden rounded-xl bg-white text-sm ring-1 ring-black/5">
                    <table className="w-full">
                      <thead className="bg-forest-50 text-left text-xs text-gray-500">
                        <tr>
                          <th className="px-3 py-2 font-semibold">{tr("Chặng 1 chiều")}</th>
                          <th className="px-3 py-2 text-right font-semibold">{bike ? tr("Chở 1 người") : tr("Giá cả xe")}</th>
                          {bike && cap !== 1 && <th className="px-3 py-2 text-right font-semibold">{tr("Chở 2 người")}</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {service.transportRoutes.map((r) => (
                          <tr key={r.id} className="border-t border-gray-100">
                            <td className="px-3 py-2">{tr(r.fromPoint.name)} ⇄ {tr(r.toPoint.name)}{r.note ? <span className="block text-xs text-gray-400">{tr(r.note)}</span> : null}</td>
                            <td className="px-3 py-2 text-right font-semibold text-forest-700">{money(r.priceOneWay)}</td>
                            {bike && cap !== 1 && <td className="px-3 py-2 text-right font-semibold text-forest-700">{money(r.priceTwo)}</td>}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <p className="mt-2 text-xs text-gray-500">{tr("Điểm không có trong danh sách: nhắn tin để được báo giá.")}</p>
              </section>
            );
          })()}

          {/* Lộ trình & giá từng chặng (cabin) */}
          {service.cabinPriceRows.length > 0 && (
            <section className="mt-8">
              <h2 className="text-lg font-semibold text-ink">{tr("Giá vé theo chặng")}</h2>
              {service.area && <p className="mt-1 text-sm text-gray-500">{tr("Lộ trình: {0}", [tr(service.area)])}</p>}
              <div className="mt-3 overflow-hidden rounded-xl ring-1 ring-black/5">
                <table className="w-full text-sm">
                  <thead className="bg-forest-50 text-left text-xs uppercase text-gray-500">
                    <tr>
                      <th className="px-4 py-2">{tr("Loại vé")}</th>
                      <th className="px-4 py-2">{tr("Điểm đón")}</th>
                      <th className="px-4 py-2">{tr("Điểm đến")}</th>
                      <th className="px-4 py-2 text-right">{tr("Giá vé")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {service.cabinPriceRows.map((row) => (
                      <tr key={row.id}>
                        <td className="px-4 py-2">
                          <span className="rounded-full bg-forest-100 px-2 py-0.5 text-xs font-medium text-forest-700">
                            {row.ticketType === "OUTBOUND" ? tr("Chiều đi") : row.ticketType === "RETURN" ? tr("Chiều về") : tr("Khứ hồi")}
                          </span>
                        </td>
                        <td className="px-4 py-2 font-medium text-ink">{tr(row.pickupPoint)}</td>
                        <td className="px-4 py-2 text-gray-600">{tr(row.destination)}</td>
                        <td className="px-4 py-2 text-right font-bold text-forest-700">{tr(formatPrice(row.price))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Liên hệ */}
          <section className="mt-8 rounded-xl bg-forest-50 p-4">
            <h2 className="text-sm font-semibold text-forest-800">{tr("Liên hệ trực tiếp")}</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              <a href={`tel:${phone.replace(/\s/g, "")}`} className="rounded-lg bg-forest-600 px-4 py-2 text-sm font-semibold text-white hover:bg-forest-700">
                📞 {tr(phone)}
              </a>
              {zalo && (
                <a href={`https://zalo.me/${zalo}`} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-sunset-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sunset-600">
                  💬 Chat Zalo
                </a>
              )}
            </div>
          </section>
        </div>

        {/* Panel đặt dịch vụ */}
        <div className="min-w-0">
          {service.category === "CABIN" && service.contactOnly ? (
            <CabinContactPanel
              operatorName={service.title}
              phone={phone}
              zalo={zalo}
              fares={cabinFares?.options ?? []}
              roundTrip={Boolean(toKey) || service.contactOnly}
            />
          ) : service.category === "CABIN" && cabinOutbound ? (
            <CabinBooking
              serviceId={service.id}
              operatorName={service.title}
              outbound={cabinOutbound}
              ret={cabinReturn}
              phone={phone}
              zalo={zalo}
              pickupProvince={typeof sp.pickup === "string" ? sp.pickup : null}
              hasFareTable={cabinFares?.hasTable ?? false}
              fares={cabinFares?.options ?? []}
              initialPeople={(() => { const n = Math.floor(Number(typeof sp.pax === "string" ? sp.pax : NaN)); return Number.isFinite(n) && n >= 1 ? Math.min(20, n) : 2; })()}
            />
          ) : (
            <BookingPanel
              serviceId={service.id}
              category={service.category}
              kind={cat.availabilityKind}
              phone={phone}
              zalo={zalo}
              initialTransport={
                cat.availabilityKind === "transport"
                  ? {
                      date: typeof sp.from === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.from) ? sp.from : undefined,
                      from: typeof sp.dpt === "string" ? sp.dpt.slice(0, 40) : undefined,
                      to: typeof sp.dst === "string" ? sp.dst.slice(0, 40) : undefined,
                      mode: typeof sp.tm === "string" ? sp.tm : undefined,
                      pax: typeof sp.pax === "string" ? Math.min(40, Math.max(1, parseInt(sp.pax, 10) || 1)) : undefined,
                      drv: typeof sp.drv === "string" ? Math.min(20, Math.max(1, parseInt(sp.drv, 10) || 1)) : undefined,
                    }
                  : undefined
              }
            />
          )}
        </div>
      </div>
      <ServiceReviews serviceId={service.id} path={`/${cat.slug}/${service.slug}`} />
    </div>
  );
}
