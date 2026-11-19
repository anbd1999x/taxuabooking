import Link from "@/components/Link";
import { venueForPlace } from "@/lib/ticket";
import type { Place, PlaceReview } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/queries";
import { renderMarkdown } from "@/lib/markdown";
import { formatDate } from "@/lib/format";
import { SITE } from "@/lib/site";
import { isVideoUrl } from "@/lib/utils";
import { PlaceGallery } from "./place/PlaceGallery";
import { ExpandableDescription } from "./place/ExpandableDescription";
import { PlaceReviews, type ReviewItem } from "./place/PlaceReviews";
import { SaveButton } from "./place/SaveButton";
import { getT, tLong } from "@/lib/i18n/server";
import type { TFunc } from "@/lib/i18n/config";

const PAGE = "oklch(0.975 0.01 150)";
const G = "oklch(0.29 0.055 160)";
const ACCENT = "oklch(0.68 0.18 45)";
const PRICE = "oklch(0.6 0.18 45)";
const GOLD = "oklch(0.75 0.16 70)";
const BORDER = "oklch(0.92 0.01 160)";
const BTNBORDER = "oklch(0.88 0.02 160)";
const MUTED = "oklch(0.48 0.02 160)";
const TAGBG = "oklch(0.95 0.025 155)";
const TAGFG = "oklch(0.36 0.08 155)";

/** Đang mở hay đã đóng (giờ Việt Nam) từ chuỗi "6:00–19:00". Hỗ trợ quán mở qua đêm. */
function openStatus(hours: string | null, t: TFunc): { open: boolean; label: string } | null {
  const m = (hours ?? "").match(/(\d{1,2}):(\d{2})\s*[–\-]\s*(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const nowVN = new Date(Date.now() + 7 * 3600_000); // UTC+7
  const cur = nowVN.getUTCHours() * 60 + nowVN.getUTCMinutes();
  const from = +m[1] * 60 + +m[2];
  const to = +m[3] * 60 + +m[4];
  const open = from <= to ? cur >= from && cur < to : cur >= from || cur < to; // qua đêm
  const closeT = `${m[3]}:${m[4]}`;
  const openT = `${m[1]}:${m[2]}`;
  return { open, label: open ? t("Đang mở · đóng {0}", [closeT]) : t("Đã đóng · mở {0}", [openT]) };
}

function mapEmbed(place: Place): string {
  const url = (place.mapUrl ?? "").trim();
  if (url.includes("/maps/embed")) return url;
  // Ưu tiên toạ độ CỦA ĐỊA ĐIỂM (!3d…!4d…); phần @lat,lng chỉ là tâm khung nhìn, lệch ghim vài trăm mét.
  const at = url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) ?? url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
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
function autoContent(p: Place, t: TFunc): string {
  const isCafe = p.kind === "CAFE";
  const tags = (p.tags ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  const parts: string[] = [];
  parts.push(
    t("{0} nằm ở khu vực **{1}** của Tà Xùa{2}{3}.", [
      t(p.name),
      t(p.area),
      p.hours ? t(", mở cửa {0}", [p.hours]) : "",
      p.price ? t(", giá {0}", [t(p.price).toLowerCase()]) : "",
    ]) + (p.desc ? ` ${t(p.desc)}` : ""),
  );
  if (tags.length) parts.push(`## ${t("Điểm nổi bật")}\n\n${tags.map((x) => `- ${t(x)}`).join("\n")}`);
  parts.push(
    isCafe
      ? `## ${t("Giờ ghé đẹp nhất")}\n\n${t("Sáng **5h30–9h** là khung mây dày nhất — tới sớm để có bàn mép ban công; chiều **16h30–18h** đón hoàng hôn. Xem thêm [kinh nghiệm cà phê săn mây](/kinh-nghiem/ca-phe-san-may-ta-xua).")}`
      : `## ${t("Mẹo gọi món")}\n\n${t("Ưu tiên các món bản địa: gà đồi, cá suối, rau cải mèo; nhóm đông nên **đặt bàn trước từ chiều**, món tính theo cân nhớ hỏi giá trước. Xem thêm [món ngon Tà Xùa](/kinh-nghiem/an-gi-o-ta-xua).")}`,
  );
  return parts.join("\n\n");
}

const pillBtn = "whitespace-nowrap rounded-full bg-white px-4 py-2.5 text-sm font-bold";

/** Khung giờ đẹp cho cafe săn mây (nội dung biên tập chung, chỉ hiện ở trang cafe). */
const BEST_TIME = [
  { h: "5:30–7:00", t: "Mây dày nhất", d: "Tới trước 6h để có bàn mép ban công.", hot: true },
  { h: "7:00–9:00", t: "Mây tan dần", d: "Nắng lên, ảnh có chiều sâu.", hot: false },
  { h: "9:00–16:00", t: "Vắng khách", d: "Ngồi làm việc, trời trong thấy núi.", hot: false },
  { h: "16:30–18:00", t: "Hoàng hôn", d: "Nắng xiên qua thung lũng, chiều muộn đẹp.", hot: true },
];

export async function PlaceDetail({ place, basePath }: { place: Place & { reviews: PlaceReview[] }; basePath: string }) {
  const tr = await getT();
  // Quán đã mở đặt bàn / bán vé trên web (module Vé & đặt bàn, gắn qua TicketVenue.placeId).
  const venue = await venueForPlace(place.id);
  const gallery = [place.coverImage, ...(place.images ?? "").split("|")].map((s) => (s ?? "").trim()).filter((s) => s && !isVideoUrl(s));
  const reviews = place.reviews;
  const count = reviews.length;
  const avg = count ? reviews.reduce((a, r) => a + r.rating, 0) / count : null;
  const distribution: [number, number, number, number, number] = [0, 0, 0, 0, 0];
  for (const r of reviews) distribution[5 - Math.min(5, Math.max(1, r.rating))] += 1;

  const settings = await getSettings();
  // Phần nhà hàng/cafe KHÔNG hiển thị SĐT/nút gọi — mọi liên hệ qua Zalo.
  const hasOwnZalo = !!place.zalo;
  const zalo = (place.zalo || settings.contactZalo || SITE.defaultZalo).replace(/\s/g, "");
  const zaloHref = `https://zalo.me/${zalo}`;
  const bookingLabel =
    place.booking === "call" ? tr("Nhận đặt bàn trước — nhắn Zalo") :
    place.booking === "group" ? tr("Nhận đặt bàn cho nhóm từ 6 người") :
    place.booking === "no" ? tr("Không nhận đặt bàn, nên tới sớm") : null;

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
    address: {
      "@type": "PostalAddress",
      streetAddress: place.address ?? undefined,
      addressLocality: tr("{0}, Tà Xùa, Bắc Yên", [place.area]),
      addressRegion: tr("Sơn La"),
      addressCountry: "VN",
    },
    priceRange: place.price ?? undefined,
    openingHours: place.hours ?? undefined,
    ...(avg != null
      ? { aggregateRating: { "@type": "AggregateRating", ratingValue: Number(avg.toFixed(1)), reviewCount: count } }
      : {}),
  };

  const isCafe = place.kind === "CAFE";
  const kindLabel = isCafe ? "Cafe" : tr("Nhà hàng");
  const listLabel = isCafe ? tr("Cafe Tà Xùa") : tr("Nhà hàng Tà Xùa");
  // Tag "Gợi ý" (không phân biệt hoa thường) = quán được highlight → badge riêng, bỏ khỏi danh sách tag.
  const rawTags = (place.tags ?? "").split(",").map((t) => t.trim()).filter(Boolean);
  const feat = rawTags.some((t) => /^gợi ý$/i.test(t));
  const tags = rawTags.filter((t) => !/^gợi ý$/i.test(t));
  const st = openStatus(place.hours, tr);
  const reviewItems: ReviewItem[] = reviews.map((r) => ({ id: r.id, name: r.name, rating: r.rating, content: r.content, date: formatDate(r.createdAt) }));

  // Thẻ thông tin nhanh — chỉ hiện mục có dữ liệu.
  const facts: { k: string; v: string; d?: string }[] = [{ k: tr("Khu vực"), v: place.area, d: tr("Tà Xùa, Bắc Yên") }];
  if (place.hours) facts.push({ k: tr("Giờ mở cửa"), v: place.hours, d: place.hoursWeekend ? tr("Cuối tuần mở sớm {0}", [place.hoursWeekend]) : st ? (st.open ? tr("Đang mở cửa") : tr("Hiện đã đóng")) : tr("Giờ Việt Nam") });
  if (place.price) facts.push({ k: tr("Giá tham khảo"), v: place.price, d: tr("Nên hỏi lại khi tới") });
  facts.push(count ? { k: tr("Đánh giá"), v: `${(avg ?? 0).toFixed(1).replace(".", ",")} / 5`, d: tr("{0} lượt", [count]) } : { k: tr("Đánh giá"), v: tr("Chưa có"), d: tr("Hãy là người đầu tiên") });

  const sectionH = "text-[22px] font-extrabold tracking-[-0.02em]";

  return (
    <div style={{ background: PAGE }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="container-page flex min-w-0 flex-col gap-[22px] pb-16 pt-5 [overflow-x:clip]">
        {/* Breadcrumb */}
        <nav className="flex flex-wrap gap-2 text-sm" style={{ color: MUTED }}>
          <Link href="/">{tr("Trang chủ")}</Link><span>/</span>
          <Link href={basePath}>{tr(listLabel)}</Link><span>/</span>
          <span className="font-bold" style={{ color: "oklch(0.22 0.03 160)" }}>{tr(place.name)}</span>
        </nav>

        {/* Tiêu đề + hành động */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex flex-wrap gap-1.5">
              {feat && <span className="rounded-full px-2.5 py-1 text-xs font-bold text-white" style={{ background: ACCENT }}>{tr("Gợi ý")}</span>}
              <span className="rounded-full border bg-white px-2.5 py-1 text-xs font-bold" style={{ borderColor: "oklch(0.9 0.01 160)", color: "oklch(0.3 0.04 160)" }}>{tr(kindLabel)}</span>
              {st && (
                <span className="rounded-full px-2.5 py-1 text-xs font-bold" style={st.open ? { background: "oklch(0.95 0.05 155)", color: "oklch(0.38 0.1 155)" } : { background: "oklch(0.93 0 0)", color: "oklch(0.42 0 0)" }}>{tr(st.label)}</span>
              )}
            </div>
            <h1 className="text-[clamp(28px,4vw,44px)] font-extrabold leading-[1.05] tracking-[-0.03em]">{tr(place.name)}</h1>
            <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-sm font-semibold" style={{ color: MUTED }}>
              {count > 0 && (
                <span className="inline-flex items-center gap-1.5">
                  <span className="tracking-[1px]" style={{ color: GOLD }}>{tr("★".repeat(Math.round(avg ?? 0)))}</span>
                  <b style={{ color: "oklch(0.22 0.03 160)" }}>{(avg ?? 0).toFixed(1).replace(".", ",")}</b>
                  <span>{tr("· {0} đánh giá", [count])}</span>
                </span>
              )}
              <span>{place.address ? tr(place.address) : tr("Khu {0}, Tà Xùa", [tr(place.area)])}</span>
              <a href="#place-map" className="underline [text-underline-offset:3px]" style={{ color: "oklch(0.4 0.08 160)" }}>{tr("Xem bản đồ ↓")}</a>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <SaveButton placeId={place.id} />
            <a href={mapOpenUrl(place)} target="_blank" rel="noopener noreferrer" className={pillBtn} style={{ border: `1.5px solid ${BTNBORDER}`, color: "oklch(0.3 0.05 160)" }}>{tr("Chỉ đường")}</a>
            <a href={zaloHref} target="_blank" rel="noopener noreferrer" className="whitespace-nowrap rounded-full px-[18px] py-2.5 text-sm font-bold text-white transition hover:bg-sunset-500" style={{ background: G }}>{hasOwnZalo ? tr("Nhắn Zalo") : tr("Hỏi qua Zalo")}</a>
          </div>
        </div>

        {/* Thư viện ảnh */}
        {gallery.length > 0 ? (
          <PlaceGallery images={gallery} name={place.name} />
        ) : (
          <div className="flex aspect-[16/7] items-center justify-center rounded-[22px] text-5xl" style={{ background: "linear-gradient(160deg, oklch(0.95 0.025 155), oklch(0.93 0.03 95))" }}>{place.kind === "CAFE" ? "☕" : "🍲"}</div>
        )}

        {/* Thân trang */}
        <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="flex min-w-0 flex-col gap-7">
            {/* Thông tin nhanh */}
            <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,150px),1fr))" }}>
              {facts.map((f) => (
                <div key={f.k} className="rounded-2xl border bg-white px-4 py-3.5" style={{ borderColor: BORDER }}>
                  <div className="text-xs font-semibold" style={{ color: MUTED }}>{tr(f.k)}</div>
                  <div className="mt-1 text-base font-extrabold tracking-[-0.01em]">{tr(f.v)}</div>
                  {f.d && <div className="mt-0.5 text-xs" style={{ color: MUTED }}>{tr(f.d)}</div>}
                </div>
              ))}
            </div>

            {/* Về quán */}
            <section className="flex flex-col gap-3">
              <h2 className={sectionH}>{tr("Về quán")}</h2>
              <ExpandableDescription>
                <div
                  className="leading-[1.7] [&_a]:font-semibold [&_a]:text-forest-700 [&_a]:underline [&_h2]:mt-6 [&_h2]:text-[18px] [&_h2]:font-extrabold [&_h2]:text-ink [&_h3]:mt-4 [&_h3]:text-base [&_h3]:font-bold [&_h3]:text-ink [&_img]:my-4 [&_img]:w-full [&_img]:rounded-2xl [&_li]:my-1 [&_p]:my-3 [&_ul]:my-3 [&_ul]:list-inside [&_ul]:list-disc"
                  style={{ color: "oklch(0.35 0.02 160)", fontSize: 15 }}
                  dangerouslySetInnerHTML={{ __html: renderMarkdown((await tLong(place.content?.trim())) || autoContent(place, tr)) }}
                />
              </ExpandableDescription>
            </section>

            {/* Đặc điểm / Tiện ích */}
            {tags.length > 0 && (
              <section className="flex flex-col gap-3">
                <h2 className={sectionH}>{isCafe ? tr("Tiện ích") : tr("Đặc điểm")}</h2>
                <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(min(100%,200px),1fr))" }}>
                  {tags.map((t) => (
                    <div key={t} className="flex items-center gap-2.5 rounded-xl border bg-white px-3.5 py-3 text-sm font-semibold" style={{ borderColor: BORDER }}>
                      <span className="h-2 w-2 flex-none rounded-full" style={{ background: "oklch(0.55 0.12 155)" }} />
                      {tr(t)}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Giờ đẹp để tới (chỉ cafe) */}
            {isCafe && (
              <section className="flex flex-col gap-3">
                <h2 className={sectionH}>{tr("Giờ đẹp để tới")}</h2>
                <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,160px),1fr))" }}>
                  {BEST_TIME.map((t) => (
                    <div key={t.h} className="rounded-2xl border px-4 py-3.5" style={{ background: t.hot ? "oklch(0.95 0.06 70)" : "white", borderColor: BORDER }}>
                      <div className="text-xl font-extrabold tracking-[-0.02em]" style={{ color: t.hot ? "oklch(0.48 0.15 50)" : G }}>{tr(t.h)}</div>
                      <div className="mt-1 text-sm font-bold">{tr(t.t)}</div>
                      <div className="mt-0.5 text-[13px] leading-[1.5]" style={{ color: MUTED }}>{tr(t.d)}</div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Đánh giá */}
            <PlaceReviews placeId={place.id} reviews={reviewItems} avg={avg} count={count} distribution={distribution} />

            {/* Vị trí */}
            <section id="place-map" className="flex scroll-mt-20 flex-col gap-3">
              <h2 className={sectionH}>{tr("Vị trí")}</h2>
              <div className="overflow-hidden rounded-[18px] border bg-white" style={{ borderColor: BORDER }}>
                <div className="h-[260px]">
                  <iframe src={mapEmbed(place)} loading="lazy" referrerPolicy="no-referrer-when-downgrade" title={tr("Bản đồ {0}", [tr(place.name)])} className="h-full w-full border-0" />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 px-[18px] py-3.5">
                  <div className="text-sm leading-[1.5]" style={{ color: "oklch(0.35 0.02 160)" }}>{tr(place.address) || tr("{0}, xã Tà Xùa, Bắc Yên, Sơn La", [tr(place.area)])}</div>
                  <a href={mapOpenUrl(place)} target="_blank" rel="noopener noreferrer" className="whitespace-nowrap rounded-full px-4 py-2.5 text-sm font-bold text-white" style={{ background: G }}>{tr("Mở Google Maps")}</a>
                </div>
              </div>
            </section>
          </div>

          {/* Cột phải dính */}
          <aside className="flex flex-col gap-3.5 rounded-[22px] border bg-white p-5 lg:sticky lg:top-[84px]" style={{ borderColor: BORDER, boxShadow: "0 24px 50px -30px oklch(0.25 0.06 220 / .35)" }}>
            <div>
              <div className="text-xs font-semibold" style={{ color: MUTED }}>{place.price ? (isCafe ? tr("Đồ uống từ") : tr("Giá tham khảo")) : tr("Liên hệ")}</div>
              {place.price ? (
                <div className="text-[30px] font-extrabold leading-[1.1] tracking-[-0.03em]" style={{ color: PRICE }}>{tr(place.price)}</div>
              ) : (
                <div className="text-[22px] font-extrabold leading-[1.2]" style={{ color: "oklch(0.42 0.1 250)" }}>{tr("Nhắn Zalo hỏi giá")}</div>
              )}
              <div className="text-[13px]" style={{ color: MUTED }}>{tr("Giá & giờ do quán tự cập nhật")}</div>
            </div>
            <div className="flex flex-col gap-2 rounded-[14px] px-3.5 py-3.5" style={{ background: "oklch(0.965 0.01 160)" }}>
              <div className="flex justify-between gap-3 text-sm"><span style={{ color: MUTED }}>{tr("Giờ mở cửa")}</span><b>{tr(place.hours) || tr("Liên hệ")}</b></div>
              {st && <div className="flex justify-between gap-3 text-sm"><span style={{ color: MUTED }}>{tr("Hôm nay")}</span><b style={{ color: st.open ? "oklch(0.38 0.1 155)" : "oklch(0.55 0.12 25)" }}>{st.open ? tr("Đang mở") : tr("Đã đóng")}</b></div>}
              <div className="flex justify-between gap-3 text-sm"><span style={{ color: MUTED }}>{tr("Khu vực")}</span><b className="text-right">{tr(place.area)}</b></div>
              {bookingLabel && <div className="flex justify-between gap-3 text-sm"><span style={{ color: MUTED }}>{tr("Đặt bàn")}</span><b className="text-right">{tr(bookingLabel)}</b></div>}
            </div>
            {venue && (
              <Link href={`/ve/${venue.slug}`} className="rounded-full px-3.5 py-3.5 text-center text-[15px] font-extrabold text-white" style={{ background: "oklch(0.68 0.18 45)" }}>
                {venue.kind === "RESTAURANT" ? tr("Đặt bàn online") : tr("Mua vé online")}
              </Link>
            )}
            <a href={zaloHref} target="_blank" rel="noopener noreferrer" className="rounded-full px-3.5 py-3.5 text-center text-[15px] font-extrabold text-white" style={{ background: ACCENT }}>{hasOwnZalo ? tr("Nhắn quán qua Zalo") : tr("Hỏi Tà Xùa Booking qua Zalo")}</a>
            <div className="text-center text-xs leading-[1.5]" style={{ color: MUTED }}>
              {tr("Muốn ở gần đây? Xem")}{" "}<Link href="/homestay" className="font-bold">homestay khu {tr(place.area)}</Link>{" "}{tr("hoặc đặt")}{" "}<Link href="/xe-cabin" className="font-bold">{tr("vé xe cabin")}</Link>.
            </div>
          </aside>
        </div>

        {/* Gợi ý quán khác */}
        {related.length > 0 && (
          <section className="mt-2.5 flex flex-col gap-3.5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className={sectionH}>{tr("{0} khác gần đây", [tr(kindLabel)])}</h2>
                <div className="mt-1 text-sm" style={{ color: MUTED }}>{tr("Cùng khu {0} hoặc quanh Tà Xùa", [tr(place.area)])}</div>
              </div>
              <Link href={basePath} className="text-sm font-bold" style={{ color: "oklch(0.4 0.08 160)" }}>{tr("Xem tất cả {0} →", [tr(kindLabel.toLowerCase())])}</Link>
            </div>
            <div className="grid auto-cols-[72%] grid-flow-col gap-3.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:auto-cols-[42%] lg:grid-flow-row lg:auto-cols-auto lg:grid-cols-4 [&::-webkit-scrollbar]:hidden">
              {related.map((p) => {
                const rtags = (p.tags ?? "").split(",").map((t) => t.trim()).filter((t) => t && !/^gợi ý$/i.test(t)).slice(0, 2);
                return (
                  <Link key={p.id} href={`${basePath}/${p.slug}`} className="group flex min-w-0 flex-col overflow-hidden rounded-[18px] border bg-white transition hover:shadow-[0_20px_40px_-24px_oklch(0.25_0.06_220_/.4)]" style={{ borderColor: BORDER }}>
                    <div className="relative aspect-[4/3] bg-forest-50">
                      {p.coverImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.coverImage} alt={tr(p.name)} className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-[1.04]" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-3xl">{p.kind === "CAFE" ? "☕" : "🍲"}</div>
                      )}
                      <span className="absolute left-2.5 top-2.5 rounded-full bg-white px-2.5 py-1 text-xs font-bold" style={{ color: "oklch(0.3 0.04 160)" }}>{tr(p.area)}</span>
                    </div>
                    <div className="flex flex-1 flex-col gap-1.5 px-4 pb-4 pt-3.5">
                      <div className="text-base font-extrabold leading-[1.3] tracking-[-0.01em] group-hover:text-forest-700">{tr(p.name)}</div>
                      {p.hours && <div className="text-[13px]" style={{ color: MUTED }}>🕐 {tr(p.hours)}</div>}
                      {rtags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {rtags.map((t) => <span key={t} className="whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: TAGBG, color: TAGFG }}>{tr(t)}</span>)}
                        </div>
                      )}
                      <div className="flex-1" />
                      <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
                        <span className="whitespace-nowrap text-[15px] font-extrabold" style={{ color: PRICE }}>{tr(p.price) || tr("Liên hệ")}</span>
                        <span className="whitespace-nowrap text-[13px] font-bold" style={{ color: "oklch(0.4 0.08 160)" }}>{tr("Xem quán →")}</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}
      </div>

      {/* Thanh hành động dưới cùng (mobile) */}
      <div className="sticky bottom-0 z-30 flex items-center justify-between gap-3 border-t bg-white px-4 py-2.5 lg:hidden" style={{ borderColor: BORDER }}>
        <div className="min-w-0">
          <div className="text-xs" style={{ color: MUTED }}>{place.price ? (isCafe ? tr("Đồ uống từ") : tr("Giá tham khảo")) : tr("Liên hệ")}</div>
          <div className="truncate text-[18px] font-extrabold tracking-[-0.02em]" style={{ color: PRICE }}>{tr(place.price) || tr("Liên hệ")}</div>
        </div>
        <div className="flex flex-none gap-2">
          <a href={mapOpenUrl(place)} target="_blank" rel="noopener noreferrer" className="whitespace-nowrap rounded-full px-3.5 py-3 text-sm font-bold" style={{ border: `1.5px solid ${BTNBORDER}`, color: "oklch(0.3 0.05 160)" }}>{tr("Chỉ đường")}</a>
          <a href={zaloHref} target="_blank" rel="noopener noreferrer" className="whitespace-nowrap rounded-full px-[18px] py-3 text-sm font-extrabold text-white" style={{ background: ACCENT }}>{hasOwnZalo ? tr("Nhắn Zalo") : tr("Hỏi qua Zalo")}</a>
        </div>
      </div>
    </div>
  );
}
