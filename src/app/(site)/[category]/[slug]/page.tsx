import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import Image from "next/image";
import { getServiceDetail, getSettings, getHomestayCards } from "@/lib/queries";
import { CATEGORIES } from "@/lib/constants";
import { formatPrice, toNumber } from "@/lib/format";
import { SITE } from "@/lib/site";
import { prisma } from "@/lib/prisma";
import { roomPricing, roomListPrice } from "@/lib/availability";
import { today, toDateKey, addDays } from "@/lib/dates";
import { BookingPanel } from "@/components/BookingPanel";
import { HomestayBooking, type HomestayRoom } from "@/components/HomestayBooking";
import { CabinBooking } from "@/components/cabin/CabinBooking";
import { ServiceReviews } from "@/components/ServiceReviews";
import { buildDirectionOptions } from "@/lib/cabin";
import { CabinRoutes } from "@/components/CabinRoutes";
import { Gallery } from "@/components/Gallery";
import { Badge } from "@/components/ui/Badge";

export const dynamic = "force-dynamic";

/** Mở link Google Maps rút gọn (maps.app.goo.gl / goo.gl) → URL đầy đủ có toạ độ. */
async function expandMapsUrl(mapUrl: string | null | undefined): Promise<string | null> {
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
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string; slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const service = await getServiceDetail(slug);
  if (!service) return {};
  const cat = CATEGORIES[service.category];
  const cover = service.images.find((i) => i.isCover)?.url ?? service.images[0]?.url;
  return {
    title: service.title,
    description: service.summary,
    alternates: { canonical: `/${cat.slug}/${service.slug}` },
    openGraph: {
      title: service.title,
      description: service.summary,
      url: `${SITE.url}/${cat.slug}/${service.slug}`,
      images: cover ? [{ url: cover }] : undefined,
    },
  };
}

export default async function ServiceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ category: string; slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { category, slug } = await params;
  const sp = await searchParams;
  const [service, settings] = await Promise.all([
    getServiceDetail(slug),
    getSettings(),
  ]);
  if (!service) notFound();

  const cat = CATEGORIES[service.category];
  // Chuẩn hoá URL: nếu sai danh mục, chuyển về URL đúng (tốt cho SEO).
  if (category !== cat.slug) redirect(`/${cat.slug}/${service.slug}`);

  // Đơn đặt do Tà Xùa Booking gọi xác nhận → dùng số nền tảng (settings), không dùng số riêng của cơ sở.
  const phone = settings.contactPhone || SITE.defaultPhone;
  const zalo = settings.contactZalo || SITE.defaultZalo;

  // ===== Homestay / Bungalow: trải nghiệm đặt phòng theo thiết kế (lịch + thẻ phòng + panel) =====
  // Thứ tự hiển thị phòng: theo "Thứ tự hiển thị" của TỪNG PHÒNG trên toàn homestay
  // (không gom theo hạng); bằng nhau thì giữ thứ tự hạng phòng.
  const stayRooms = service.roomTypes
    .flatMap((rt) => rt.rooms.map((r) => ({ rt, r })))
    .sort((a, b) => a.r.sortOrder - b.r.sortOrder);
  const isStayWithRooms = cat.availabilityKind === "stay" && cat.key !== "COMBO" && stayRooms.length > 0;

  if (isStayWithRooms) {
    const NUM_DAYS = 75;
    const start = today();
    const windowEnd = addDays(start, NUM_DAYS - 1);
    const roomIds = stayRooms.map((x) => x.r.id);
    // Ngày bị chiếm (không bán) của từng phòng trong cửa sổ hiển thị.
    const statuses = await prisma.roomDayStatus.findMany({
      where: { roomId: { in: roomIds }, date: { gte: start, lte: windowEnd }, status: { not: "AVAILABLE" } },
      select: { roomId: true, date: true },
    });
    const occByRoom = new Map<string, string[]>();
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
        extraFee: toNumber(r.extraPersonFee),
        earlyFee: toNumber(r.earlyCheckinFee),
        lateFee: toNumber(r.lateCheckoutFee),
        amenities: (r.amenities ?? "").split(",").map((a) => a.trim()).filter(Boolean),
        media: r.images.map((i) => ({
          url: i.url,
          type: /\.(mp4|webm|mov|m4v|ogg)(\?|$)/i.test(i.url) ? ("video" as const) : ("image" as const),
        })),
        base: pricing.weekdayPrice,
        listPrice: toNumber(r.listPrice) ?? 0,
        hasSale: roomListPrice(r) != null,
        days: pricing.daysOfWeek ?? [null, null, null, null, null, null, null],
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
            addressLocality: service.area ?? "Tà Xùa, Bắc Yên",
            addressRegion: "Sơn La",
            addressCountry: "VN",
          },
          ...(roomPrices.length
            ? { priceRange: `${Math.min(...roomPrices).toLocaleString("vi-VN")}–${Math.max(...roomPrices).toLocaleString("vi-VN")}đ/đêm` }
            : {}),
        },
        {
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Trang chủ", item: SITE.url },
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
          <a href="/" className="hover:text-forest-700">Trang chủ</a>
          <span className="mx-2">/</span>
          <a href={`/${cat.slug}`} className="hover:text-forest-700">{cat.shortLabel}</a>
          <span className="mx-2">/</span>
          <span className="text-gray-700">{service.title}</span>
        </nav>

        <HomestayBooking
          serviceId={service.id}
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
          policy={service.policy}
          description={service.description}
          suggestions={suggestions}
          header={
            <div className="flex flex-col gap-4">
              <Gallery images={service.images.map((i) => ({ url: i.url, alt: i.alt }))} title={service.title} />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="ok">{cat.shortLabel}</Badge>
                  {service.featured && <Badge tone="warn">Nổi bật</Badge>}
                  {service.area && (
                    <a href="#vi-tri" className="text-sm font-semibold text-forest-700 underline underline-offset-4 hover:text-sunset-600">
                      📍 {service.area} · Xem bản đồ ↓
                    </a>
                  )}
                </div>
                <h1 className="mt-2 text-[clamp(26px,4vw,40px)] font-extrabold leading-[1.1] tracking-tight text-ink">{service.title}</h1>
                <p className="mt-2 text-[17px] text-gray-600">{service.summary}</p>
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

  return (
    <div className="container-page py-8">
      <nav className="mb-4 text-sm text-gray-500">
        <a href="/" className="hover:text-forest-700">Trang chủ</a>
        <span className="mx-2">/</span>
        <a href={`/${cat.slug}`} className="hover:text-forest-700">{cat.shortLabel}</a>
        <span className="mx-2">/</span>
        <span className="text-gray-700">{service.title}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-[1.6fr_1fr]">
        {/* Nội dung */}
        <div className="min-w-0">
          <Gallery
            images={service.images.map((i) => ({ url: i.url, alt: i.alt }))}
            title={service.title}
          />

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Badge tone="ok">{cat.shortLabel}</Badge>
            {service.featured && <Badge tone="warn">Nổi bật</Badge>}
            {service.area && <span className="text-sm text-gray-500">📍 {service.area}</span>}
          </div>

          <h1 className="mt-2 text-2xl font-bold text-ink sm:text-3xl">{service.title}</h1>
          <p className="mt-2 text-gray-600">{service.summary}</p>

          <section className="mt-6">
            <h2 className="text-lg font-semibold text-ink">Giới thiệu</h2>
            <p className="mt-2 whitespace-pre-line leading-relaxed text-gray-700">
              {service.description}
            </p>
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
              <h2 className="text-lg font-semibold text-ink">Các loại phòng</h2>
              <div className="mt-3 space-y-3">
                {service.roomTypes.map((r) => {
                  const roomPrices = r.rooms
                    .map((rm) => toNumber(rm.salePrice) ?? toNumber(rm.listPrice) ?? 0)
                    .filter((n) => n > 0);
                  const fromPrice = roomPrices.length ? Math.min(...roomPrices) : null;
                  const caps = r.rooms.map((rm) => rm.capacity);
                  const capLabel = caps.length
                    ? (Math.min(...caps) === Math.max(...caps) ? `${caps[0]}` : `${Math.min(...caps)}–${Math.max(...caps)}`)
                    : `${r.capacity}`;
                  return (
                  <div key={r.id} className="rounded-xl bg-white p-3 ring-1 ring-black/5">
                    <div className="flex items-start gap-4">
                      <div className="flex-1">
                        <p className="font-medium text-ink">{r.name}</p>
                        <p className="text-xs text-gray-500">Sức chứa {capLabel} người · {r.rooms.length || r.totalRooms} phòng</p>
                        <p className="mt-1 text-sm">
                          {fromPrice != null ? (
                            <>
                              <span className="text-gray-500">Từ </span>
                              <span className="font-semibold text-forest-700">{formatPrice(fromPrice)}</span>
                              <span className="text-gray-500">/đêm</span>
                            </>
                          ) : (
                            <span className="text-gray-500">Liên hệ xác nhận giá</span>
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
                              <Image src={img.url} alt={img.alt} fill sizes="160px" className="object-cover" />
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
                            {room.name} · {formatPrice(room.salePrice ?? room.listPrice)} →
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
              <h2 className="text-lg font-semibold text-ink">Các loại xe</h2>
              <div className="mt-3 space-y-3">
                {service.rentalVehicles.map((v) => (
                  <div key={v.id} className="flex items-center justify-between rounded-xl bg-white p-3 ring-1 ring-black/5">
                    <div>
                      <p className="font-medium text-ink">{v.vehicleType}</p>
                      <p className="text-xs text-gray-500">
                        {v.totalUnits} xe{v.deliveryFee ? ` · phí giao nhận ${formatPrice(v.deliveryFee)}` : ""}
                      </p>
                    </div>
                    <p className="font-semibold text-forest-700">{formatPrice(v.pricePerDay)}/ngày</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Thông tin tuyến (xe ôm / taxi) */}
          {service.transport && (
            <section className="mt-8">
              <h2 className="text-lg font-semibold text-ink">Thông tin tuyến</h2>
              <div className="mt-3 rounded-xl bg-white p-4 ring-1 ring-black/5 text-sm">
                <p><span className="text-gray-500">Điểm đón: </span>{service.transport.fromPoint}</p>
                <p className="mt-1"><span className="text-gray-500">Điểm đến: </span>{service.transport.toArea}</p>
                {service.transport.vehicleType && (
                  <p className="mt-1"><span className="text-gray-500">Phương tiện: </span>{service.transport.vehicleType}</p>
                )}
                <p className="mt-1">
                  <span className="text-gray-500">Giá: </span>
                  {service.transport.fixedPrice != null
                    ? <span className="font-semibold text-forest-700">{formatPrice(service.transport.fixedPrice)}</span>
                    : <span className="font-medium text-sky-700">Liên hệ xác nhận giá</span>}
                </p>
                {service.transport.priceNote && (
                  <p className="mt-1 text-gray-500">{service.transport.priceNote}</p>
                )}
              </div>
            </section>
          )}

          {/* Lộ trình & giá từng chặng (cabin) */}
          {service.cabinPriceRows.length > 0 && (
            <section className="mt-8">
              <h2 className="text-lg font-semibold text-ink">Giá vé theo chặng</h2>
              {service.area && <p className="mt-1 text-sm text-gray-500">Lộ trình: {service.area}</p>}
              <div className="mt-3 overflow-hidden rounded-xl ring-1 ring-black/5">
                <table className="w-full text-sm">
                  <thead className="bg-forest-50 text-left text-xs uppercase text-gray-500">
                    <tr>
                      <th className="px-4 py-2">Loại vé</th>
                      <th className="px-4 py-2">Điểm đón</th>
                      <th className="px-4 py-2">Điểm đến</th>
                      <th className="px-4 py-2 text-right">Giá vé</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {service.cabinPriceRows.map((row) => (
                      <tr key={row.id}>
                        <td className="px-4 py-2">
                          <span className="rounded-full bg-forest-100 px-2 py-0.5 text-xs font-medium text-forest-700">
                            {row.ticketType === "OUTBOUND" ? "Chiều đi" : row.ticketType === "RETURN" ? "Chiều về" : "Khứ hồi"}
                          </span>
                        </td>
                        <td className="px-4 py-2 font-medium text-ink">{row.pickupPoint}</td>
                        <td className="px-4 py-2 text-gray-600">{row.destination}</td>
                        <td className="px-4 py-2 text-right font-bold text-forest-700">{formatPrice(row.price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Liên hệ */}
          <section className="mt-8 rounded-xl bg-forest-50 p-4">
            <h2 className="text-sm font-semibold text-forest-800">Liên hệ trực tiếp</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              <a href={`tel:${phone.replace(/\s/g, "")}`} className="rounded-lg bg-forest-600 px-4 py-2 text-sm font-semibold text-white hover:bg-forest-700">
                📞 {phone}
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
          {service.category === "CABIN" && cabinOutbound ? (
            <CabinBooking
              serviceId={service.id}
              operatorName={service.title}
              outbound={cabinOutbound}
              ret={cabinReturn}
              phone={phone}
              zalo={zalo}
              pickupProvince={typeof sp.pickup === "string" ? sp.pickup : null}
            />
          ) : (
            <BookingPanel
              serviceId={service.id}
              category={service.category}
              kind={cat.availabilityKind}
              phone={phone}
              zalo={zalo}
            />
          )}
        </div>
      </div>
      <ServiceReviews serviceId={service.id} path={`/${cat.slug}/${service.slug}`} />
    </div>
  );
}
