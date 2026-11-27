import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import Link from "@/components/Link";
import { BreadcrumbLd } from "@/components/BreadcrumbLd";
import { getContentMap, getLocale, getT, loadDict, lp, tLong } from "@/lib/i18n/server";
import { i18nAlternates, i18nOg } from "@/lib/i18n/meta";
import { renderMarkdown } from "@/lib/markdown";
import { SITE } from "@/lib/site";
import { cachedRoads, centerPt } from "@/lib/road-distance";
import {
  attractionPath, fmtKm, getAttraction, isFree, nearestHomes, nearestSpots, inTaXua, placeImages, priceLabel, realAddress, relatedArticles, tidy,
} from "@/lib/attractions";
import { attractionMeta, nameWithTx, whereText } from "@/lib/attraction-meta";

/**
 * Trang chi tiết ĐIỂM THAM QUAN (Place kind CHECKIN): dựng hoàn toàn phía server, không <Suspense>
 * ⇒ bot / công cụ AI đọc đủ nội dung trong HTML. Mọi số liệu từ DB (quãng đường xe chạy = cache RoadDistance).
 */
export const dynamic = "force-dynamic";

const G = "oklch(0.29 0.055 160)";
const ACCENT = "oklch(0.68 0.18 45)";
const BORDER = "oklch(0.92 0.01 160)";
const MUTED = "oklch(0.48 0.02 160)";
const PAGE = "oklch(0.975 0.01 150)";
const sectionH = "text-[22px] font-extrabold tracking-[-0.02em]";

async function load(slug: string) {
  const p = await getAttraction(slug);
  if (!p) return null;
  const road = p.lat != null && p.lng != null ? ((await cachedRoads(centerPt(), [{ id: p.id, lat: p.lat, lng: p.lng }]))[p.id] ?? null) : null;
  return { p, road };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const d = await load(slug);
  if (!d) return {};
  const [t, locale] = await Promise.all([getT(), getLocale()]);
  const { title, description } = attractionMeta(d.p, d.road, t, locale);
  const path = attractionPath(d.p.slug!);
  return {
    title: title.length > 43 ? { absolute: title } : title,
    description,
    alternates: await i18nAlternates(path),
    openGraph: await i18nOg({ title, description, path, image: placeImages(d.p)[0] ?? null, alt: tidy(t(d.p.name)) }),
  };
}

export default async function AttractionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const d = await load(slug);
  if (!d) notFound();
  const { p, road } = d;
  const [t, locale] = await Promise.all([getT(), getLocale()]);
  const [homes, spots, articles, content, enContent, enDict] = await Promise.all([nearestHomes(p), nearestSpots(p), relatedArticles(p), tLong(p.content?.trim() || null), getContentMap("en"), loadDict("en")]);
  // Tên tiếng Anh đã dịch (VD "Dolphin Rock") ⇒ alternateName: khách quốc tế / công cụ AI tìm theo tên này.
  const enName = enContent[p.name.trim()] ?? enDict[p.name.trim()] ?? "";
  const altName = [tidy(p.name), tidy(enName)].filter((n, i, a) => n && a.indexOf(n) === i && n !== tidy(t(p.name)));

  const path = attractionPath(p.slug!);
  const name = tidy(t(p.name));
  const { h1 } = attractionMeta(p, road, t, locale);
  const images = placeImages(p);
  const price = priceLabel(p.price);
  const hours = p.hours?.trim() ?? "";
  const tip = p.tip?.trim() ? tidy(t(p.tip.trim())) : "";
  const where = whereText(p, road, t);
  // Điểm nằm ngoài xã Tà Xùa (VD đồi Mâm Xôi ở xã Xím Vàng) ⇒ không ghi "xã Tà Xùa".
  const local = inTaXua(p);
  const km = road ? fmtKm(road.km, locale) : "";
  const hasGeo = p.lat != null && p.lng != null;
  const coord = hasGeo ? `${p.lat!.toFixed(5)}, ${p.lng!.toFixed(5)}` : "";
  const mapsUrl = p.mapUrl?.trim() || (hasGeo ? `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${p.name} Tà Xùa Sơn La`)}`);
  const embed = hasGeo ? `https://www.google.com/maps?q=${p.lat},${p.lng}&z=14&output=embed` : "";

  // Đoạn mở: trả lời thẳng "ở đâu, cách trung tâm bao xa, giờ đẹp, chi phí" — chỉ câu có dữ liệu.
  const lead = [
    road
      ? where && !local
        ? t("{0} nằm ở {1}, tỉnh Sơn La, cách trung tâm xã Tà Xùa {2} km đường xe chạy (đi xe máy khoảng {3} phút).", [name, where, km, road.min])
        : where
        ? t("{0} nằm ở {1}, xã Tà Xùa, tỉnh Sơn La, cách trung tâm xã {2} km đường xe chạy (đi xe máy khoảng {3} phút).", [name, where, km, road.min])
        : t("{0} thuộc xã Tà Xùa, tỉnh Sơn La, cách trung tâm xã {1} km đường xe chạy (đi xe máy khoảng {2} phút).", [name, km, road.min])
      : where
        ? t("{0} nằm ở {1}, xã Tà Xùa, tỉnh Sơn La.", [name, where])
        : t("{0} thuộc xã Tà Xùa, tỉnh Sơn La.", [name]),
    hours ? t("Khung giờ đẹp để tới: {0}.", [hours]) : "",
    price ? t("Chi phí tham khảo: {0}.", [t(price)]) : "",
    p.desc?.trim() ? tidy(t(p.desc.trim())) : "",
  ].filter(Boolean);

  const facts: { k: string; v: string; d?: string }[] = [];
  if (road) facts.push({ k: t("Cách trung tâm"), v: `${km} km`, d: t("khoảng {0} phút xe máy", [road.min]) });
  if (hours) facts.push({ k: t("Giờ đẹp"), v: hours, d: t("Giờ Việt Nam") });
  if (price) facts.push({ k: t("Chi phí tham khảo"), v: t(price), d: t("Nên hỏi lại tại chỗ") });
  if (where) facts.push({ k: t("Vị trí"), v: where, d: local ? t("Xã Tà Xùa, Sơn La") : t("Sơn La") });

  // FAQ dựng từ dữ liệu thật — câu nào thiếu dữ liệu thì bỏ.
  const kmList = (xs: { n: string; km: number; min: number }[]) => xs.map((x) => t("{0} ({1} km, khoảng {2} phút)", [x.n, fmtKm(x.km, locale), x.min])).join(locale === "zh" ? "；" : "; ");
  const faq: [string, string][] = [];
  faq.push([
    t("{0} ở đâu?", [name]),
    [
      where && !local ? t("{0} nằm ở {1}, tỉnh Sơn La.", [name, where]) : where ? t("{0} nằm ở {1}, xã Tà Xùa, tỉnh Sơn La.", [name, where]) : t("{0} thuộc xã Tà Xùa, tỉnh Sơn La.", [name]),
      coord ? t("Toạ độ: {0}.", [coord]) : "",
      t("Bấm \"Mở Google Maps\" trên trang để chỉ đường."),
    ].filter(Boolean).join(" "),
  ]);
  if (road)
    faq.push([
      t("{0} cách trung tâm Tà Xùa bao xa?", [name]),
      t("Khoảng {0} km đường xe chạy từ trung tâm xã Tà Xùa, đi xe máy mất khoảng {1} phút. Số liệu tính theo bản đồ OpenStreetMap; đường dốc, trơn hoặc sương mù thì đi lâu hơn.", [km, road.min]),
    ]);
  if (hours) faq.push([t("Đi {0} lúc mấy giờ đẹp nhất?", [name]), [t("Khung giờ đẹp: {0}.", [hours]), tip].filter(Boolean).join(" ")]);
  if (price)
    faq.push([
      t("{0} có mất vé không?", [name]),
      isFree(p.price) ? t("Theo thông tin Tà Xùa Booking đang có, {0} không thu vé vào. Mức thu có thể thay đổi, nên hỏi lại tại chỗ.", [name]) : t("Chi phí tham khảo: {0}. Mức thu có thể thay đổi theo năm, nên hỏi lại tại chỗ.", [t(price)]),
    ]);
  if (homes.length) faq.push([t("Homestay nào gần {0} nhất?", [name]), t("Gần nhất theo đường xe chạy: {0}.", [kmList(homes.slice(0, 3).map((h) => ({ n: t(h.title), km: h.road.km, min: h.road.min })))])]);
  if (spots.length) faq.push([t("Gần {0} còn điểm nào nên ghé?", [name]), t("Các điểm gần nhất theo đường xe chạy: {0}.", [kmList(spots.slice(0, 3).map((s) => ({ n: tidy(t(s.name)), km: s.road.km, min: s.road.min })))])]);

  // JSON-LD: @id cố định theo URL bản tiếng Việt ⇒ 4 bản ngôn ngữ là MỘT thực thể.
  const abs = (u: string) => (/^https?:\/\//i.test(u) ? u : `${SITE.url}${u.startsWith("/") ? "" : "/"}${u}`);
  const pageUrl = `${SITE.url}${await lp(path)}`;
  const attractionLd = {
    "@context": "https://schema.org",
    "@type": "TouristAttraction",
    "@id": `${SITE.url}${path}#place`,
    name,
    ...(altName.length ? { alternateName: altName } : {}),
    url: pageUrl,
    ...(p.desc?.trim() ? { description: tidy(t(p.desc.trim())) } : {}),
    ...(images.length ? { image: images.slice(0, 8).map(abs) } : {}),
    ...(hasGeo ? { geo: { "@type": "GeoCoordinates", latitude: p.lat, longitude: p.lng } } : {}),
    hasMap: mapsUrl,
    ...(isFree(p.price) ? { isAccessibleForFree: true } : {}),
    address: { "@type": "PostalAddress", ...(realAddress(p.address) ? { streetAddress: t(realAddress(p.address)) } : {}), addressLocality: local ? t("Tà Xùa, Bắc Yên") : t("Xím Vàng, Bắc Yên"), addressRegion: t("Sơn La"), addressCountry: "VN" },
    containedInPlace: local
      ? { "@type": "Place", name: t("Tà Xùa"), containedInPlace: { "@type": "AdministrativeArea", name: t("Sơn La"), addressCountry: "VN" } }
      : { "@type": "AdministrativeArea", name: t("Sơn La"), addressCountry: "VN" },
  };
  const faqLd = faq.length
    ? { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) }
    : null;
  const ld = (o: object) => JSON.stringify(o).replace(/</g, "\\u003c");

  return (
    <div style={{ background: PAGE }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ld(attractionLd) }} />
      {faqLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ld(faqLd) }} />}
      <BreadcrumbLd items={[{ name: t("Trang chủ"), path: "/" }, { name: t("Điểm tham quan Tà Xùa"), path: "/diem-den" }, { name, path }]} />

      <div className="container-page flex min-w-0 flex-col gap-6 pb-16 pt-5 [overflow-x:clip]">
        <nav className="flex flex-wrap gap-2 text-sm" style={{ color: MUTED }} aria-label={t("Đường dẫn")}>
          <Link href="/">{t("Trang chủ")}</Link><span>/</span>
          <Link href="/diem-den">{t("Điểm tham quan Tà Xùa")}</Link><span>/</span>
          <span className="font-bold text-ink">{name}</span>
        </nav>

        <header className="flex flex-col gap-3">
          <h1 className="text-[clamp(26px,3.6vw,40px)] font-extrabold leading-[1.1] tracking-[-0.03em] text-ink">{h1}</h1>
          <p className="max-w-[860px] text-[16px] leading-[1.7]" style={{ color: "oklch(0.32 0.02 160)" }}>{lead.join(" ")}</p>
          <div className="flex flex-wrap gap-2">
            <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="rounded-full px-4 py-2.5 text-sm font-bold text-white" style={{ background: G }}>{t("Mở Google Maps")}</a>
            <a href="#vi-tri" className="rounded-full border-[1.5px] bg-white px-4 py-2.5 text-sm font-bold" style={{ borderColor: "oklch(0.88 0.02 160)", color: "oklch(0.3 0.05 160)" }}>{t("Xem bản đồ ↓")}</a>
            <Link href="/thoi-tiet-ta-xua" className="rounded-full border-[1.5px] bg-white px-4 py-2.5 text-sm font-bold" style={{ borderColor: "oklch(0.88 0.02 160)", color: "oklch(0.3 0.05 160)" }}>{t("Thời tiết & khả năng có mây")}</Link>
          </div>
        </header>

        {images.length > 0 && (
          <section aria-label={t("Ảnh {0}", [name])} className="grid gap-2 sm:grid-cols-4 sm:grid-rows-2">
            {images.slice(0, 5).map((src, i) => (
              <div key={src} className={`relative overflow-hidden rounded-[18px] bg-forest-50 ${i === 0 ? "aspect-[4/3] sm:col-span-2 sm:row-span-2 sm:aspect-auto sm:min-h-[340px]" : "hidden aspect-[4/3] sm:block"}`}>
                <Image
                  src={src}
                  alt={i === 0 ? (local ? t("{0}, xã Tà Xùa, Sơn La", [name]) : t("{0}, {1}, Sơn La", [name, where])) : t("{0} Tà Xùa, ảnh {1}", [name, i + 1])}
                  fill
                  priority={i === 0}
                  sizes={i === 0 ? "(max-width:640px) 100vw, 620px" : "300px"}
                  className="object-cover"
                />
              </div>
            ))}
          </section>
        )}

        {facts.length > 0 && (
          <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,170px),1fr))" }}>
            {facts.map((f) => (
              <div key={f.k} className="rounded-2xl border bg-white px-4 py-3.5" style={{ borderColor: BORDER }}>
                <div className="text-xs font-semibold" style={{ color: MUTED }}>{f.k}</div>
                <div className="mt-1 text-base font-extrabold tracking-[-0.01em]">{f.v}</div>
                {f.d && <div className="mt-0.5 text-xs" style={{ color: MUTED }}>{f.d}</div>}
              </div>
            ))}
          </div>
        )}

        <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="flex min-w-0 flex-col gap-8">
            {content && (
              <section className="flex flex-col gap-2">
                <h2 className={sectionH}>{t("Giới thiệu {0}", [name])}</h2>
                <div
                  className="leading-[1.7] [&_a]:font-semibold [&_a]:text-forest-700 [&_a]:underline [&_h2]:mt-6 [&_h2]:text-[18px] [&_h2]:font-extrabold [&_h2]:text-ink [&_h3]:mt-4 [&_h3]:font-bold [&_li]:my-1 [&_p]:my-3 [&_ul]:my-3 [&_ul]:list-inside [&_ul]:list-disc"
                  style={{ color: "oklch(0.35 0.02 160)", fontSize: 15 }}
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(content.replace(/ *— */g, ", ")) }}
                />
              </section>
            )}
            {tip && (
              <div className="rounded-2xl border px-4 py-3.5 text-[15px] leading-[1.6]" style={{ background: "oklch(0.96 0.05 80)", borderColor: "oklch(0.9 0.06 80)" }}>
                <b>{t("Mẹo:")}</b> {tip}
              </div>
            )}

            <section id="vi-tri" className="flex scroll-mt-20 flex-col gap-3">
              <h2 className={sectionH}>{t("Vị trí và đường đi tới {0}", [name])}</h2>
              <div className="overflow-hidden rounded-[18px] border bg-white" style={{ borderColor: BORDER }}>
                {embed && (
                  <div className="h-[280px]">
                    <iframe src={embed} loading="lazy" referrerPolicy="no-referrer-when-downgrade" title={t("Bản đồ {0}", [name])} className="h-full w-full border-0" />
                  </div>
                )}
                <div className="flex flex-wrap items-center justify-between gap-3 px-[18px] py-3.5 text-sm leading-[1.6]" style={{ color: "oklch(0.35 0.02 160)" }}>
                  <div>
                    {coord && <div>{t("Toạ độ: {0}", [coord])}</div>}
                    {road && <div>{t("Từ trung tâm xã Tà Xùa: {0} km, khoảng {1} phút xe máy (theo OpenStreetMap).", [km, road.min])}</div>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link href="/ban-do" className="rounded-full border-[1.5px] px-4 py-2.5 font-bold" style={{ borderColor: "oklch(0.88 0.02 160)", color: "oklch(0.3 0.05 160)" }}>{t("Bản đồ Tà Xùa")}</Link>
                    <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="rounded-full px-4 py-2.5 font-bold text-white" style={{ background: G }}>{t("Mở Google Maps")}</a>
                  </div>
                </div>
              </div>
            </section>

            {homes.length > 0 && (
              <section className="flex flex-col gap-3">
                <h2 className={sectionH}>{t("Homestay gần {0}", [name])}</h2>
                <p className="text-sm" style={{ color: MUTED }}>{t("Xếp theo quãng đường xe chạy từ homestay tới điểm này.")}</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {homes.map((h) => (
                    <Link key={h.slug} href={`/homestay/${h.slug}`} className="group flex gap-3 rounded-[18px] border bg-white p-2.5 transition hover:shadow-md" style={{ borderColor: BORDER }}>
                      <div className="relative h-[84px] w-[110px] flex-none overflow-hidden rounded-xl bg-forest-50">
                        {h.cover && <Image src={h.cover} alt={t("Homestay {0} gần {1}", [t(h.title), name])} fill sizes="110px" className="object-cover" />}
                      </div>
                      <div className="flex min-w-0 flex-col justify-center gap-1">
                        <div className="truncate font-extrabold group-hover:text-forest-700">{t(h.title)}</div>
                        {h.area && <div className="truncate text-xs" style={{ color: MUTED }}>{t(h.area)}</div>}
                        <div className="text-sm font-bold" style={{ color: ACCENT }}>{t("{0} km · {1} phút", [fmtKm(h.road.km, locale), h.road.min])}</div>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {faq.length > 0 && (
              <section className="flex flex-col gap-3">
                <h2 className={sectionH}>{t("Câu hỏi thường gặp")}</h2>
                <div className="divide-y rounded-[18px] border bg-white px-5" style={{ borderColor: BORDER }}>
                  {faq.map(([q, a]) => (
                    <div key={q} className="py-4">
                      <h3 className="text-[16px] font-bold text-ink">{q}</h3>
                      <p className="mt-1.5 text-[15px] leading-[1.65]" style={{ color: "oklch(0.35 0.02 160)" }}>{a}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          <aside className="flex flex-col gap-5 lg:sticky lg:top-[84px]">
            {spots.length > 0 && (
              <section className="flex flex-col gap-2.5 rounded-[22px] border bg-white p-4" style={{ borderColor: BORDER }}>
                <h2 className="text-lg font-extrabold">{t("Điểm gần {0}", [name])}</h2>
                {spots.map((s) => (
                  <Link key={s.slug} href={attractionPath(s.slug)} className="group flex items-center gap-3">
                    <div className="relative h-14 w-16 flex-none overflow-hidden rounded-lg bg-forest-50">
                      {s.cover && <Image src={s.cover} alt={t("{0} Tà Xùa", [tidy(t(s.name))])} fill sizes="64px" className="object-cover" />}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold group-hover:text-forest-700">{tidy(t(s.name))}</div>
                      <div className="text-xs" style={{ color: MUTED }}>{t("{0} km · {1} phút", [fmtKm(s.road.km, locale), s.road.min])}</div>
                    </div>
                  </Link>
                ))}
                <Link href="/diem-den" className="pt-1 text-sm font-bold" style={{ color: "oklch(0.4 0.08 160)" }}>{t("Tất cả điểm tham quan →")}</Link>
              </section>
            )}
            {articles.length > 0 && (
              <section className="flex flex-col gap-2 rounded-[22px] border bg-white p-4" style={{ borderColor: BORDER }}>
                <h2 className="text-lg font-extrabold">{t("Bài viết liên quan")}</h2>
                <ul className="flex flex-col gap-2 text-sm">
                  {articles.map((a) => (
                    <li key={a.slug}><Link href={`/kinh-nghiem/${a.slug}`} className="font-semibold text-forest-700 hover:underline">{t(a.title)}</Link></li>
                  ))}
                </ul>
              </section>
            )}
            <section className="flex flex-col gap-2 rounded-[22px] p-4 text-white" style={{ background: G }}>
              <div className="text-lg font-extrabold">{t("Đi {0} cần xe và chỗ ở?", [nameWithTx(p, t)])}</div>
              <Link href="/combo" className="rounded-full px-4 py-2.5 text-center text-sm font-extrabold text-white" style={{ background: ACCENT }}>{t("Combo xe cabin + homestay")}</Link>
              <div className="flex gap-2 text-sm">
                <Link href="/homestay" className="flex-1 rounded-full bg-white/10 px-3 py-2 text-center font-bold">{t("Homestay")}</Link>
                <Link href="/thue-xe-may" className="flex-1 rounded-full bg-white/10 px-3 py-2 text-center font-bold">{t("Thuê xe máy")}</Link>
                <Link href="/xe-om" className="flex-1 rounded-full bg-white/10 px-3 py-2 text-center font-bold">{t("Xe ôm")}</Link>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
