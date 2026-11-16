import type { Metadata } from "next";
import { ogBlock } from "@/lib/og";
import { notFound } from "next/navigation";
import { getRoomDetail, getSettings } from "@/lib/queries";
import { CATEGORIES } from "@/lib/constants";
import { formatPrice } from "@/lib/format";
import { roomFromPrice, isRoomPriceOnRequest } from "@/lib/availability";
import { SITE } from "@/lib/site";
import { Gallery } from "@/components/Gallery";
import { BookingPanel } from "@/components/BookingPanel";
import { AgentNote } from "@/components/AgentNote";
import { Badge } from "@/components/ui/Badge";
import { getT, tLong } from "@/lib/i18n/server";
import { i18nAlternates, i18nOg } from "@/lib/i18n/meta";
import Link from "@/components/Link";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string; slug: string; roomId: string }>;
}): Promise<Metadata> {
  const t = await getT();
  const { slug, roomId } = await params;
  const room = await getRoomDetail(slug, roomId);
  if (!room) return {};
  const svc = room.roomType.service;
  const title = t("{0} – {1}: phòng homestay Tà Xùa", [t(room.name), t(svc.title)]);
  const own = ((await tLong(room.description)) ?? "").trim().replace(/[.\s]+$/, "");
  const tail = t(" Phòng {0} khách tại {1}, Tà Xùa. Xem ảnh, giá từng đêm, lịch trống và đặt phòng tại Tà Xùa Booking.", [room.capacity, t(svc.title)]);
  const description = own.length >= 120 ? own + "." : `${own ? own + "." : `${t(room.name)} (${t(room.roomType.name)}).`}${tail}`;
  const path = `/${CATEGORIES[svc.category].slug}/${svc.slug}/phong/${room.id}`;
  const cover = room.images[0]?.url ?? room.roomType.images.find((i) => !/\.(mp4|webm|mov)$/i.test(i.url))?.url;
  return {
    title,
    description,
    alternates: await i18nAlternates(path),
    openGraph: await i18nOg({ title, description, path, image: cover, alt: `${t(room.name)} – ${t(svc.title)}` }),
  };
}

export default async function RoomDetailPage({
  params,
}: {
  params: Promise<{ category: string; slug: string; roomId: string }>;
}) {
  const t = await getT();
  const { slug, roomId } = await params;
  const [room, settings] = await Promise.all([getRoomDetail(slug, roomId), getSettings()]);
  if (!room) notFound();

  const rt = room.roomType;
  const svc = rt.service;
  const cat = CATEGORIES[svc.category];
  // Đơn đặt do Tà Xùa Booking gọi xác nhận → dùng số nền tảng (settings), không dùng số riêng của cơ sở.
  const phone = settings.contactPhone || SITE.defaultPhone;
  const zalo = settings.contactZalo || SITE.defaultZalo;

  // Giá "từ" = đêm rẻ nhất trong tuần (có giá theo thứ) + giá gạch của đêm đó.
  const { price: fromPrice, strike: listStrike } = roomFromPrice(room);
  const priceOnRequest = isRoomPriceOnRequest(room);
  const amenities = (room.amenities ?? "")
    .split(",")
    .map((a) => a.trim())
    .filter(Boolean);

  // Ưu tiên media riêng của phòng; nếu phòng chưa có thì dùng của hạng phòng.
  // Video nhận diện theo đuôi file (ảnh phòng và video phòng cùng ở room.images).
  const isVid = (u: string) => /\.(mp4|webm|mov|m4v|ogg)(\?|$)/i.test(u);
  const roomImgs = room.images.filter((i) => !isVid(i.url));
  const roomVids = room.images.filter((i) => isVid(i.url));
  const galleryImages =
    roomImgs.length > 0
      ? roomImgs.map((i) => ({ url: i.url, alt: i.alt }))
      : rt.images.filter((i) => i.type === "image").map((i) => ({ url: i.url, alt: i.alt }));
  const videos =
    roomVids.length > 0
      ? roomVids.map((i) => i.url)
      : rt.images.filter((i) => i.type === "video").map((i) => i.url);

  return (
    <div className="container-page py-8">
      <nav className="mb-4 text-sm text-gray-500">
        <Link href="/" className="hover:text-forest-700">{t("Trang chủ")}</Link>
        <span className="mx-2">/</span>
        <Link href={`/${cat.slug}`} className="hover:text-forest-700">{t(cat.shortLabel)}</Link>
        <span className="mx-2">/</span>
        <Link href={`/${cat.slug}/${svc.slug}`} className="hover:text-forest-700">{t(svc.title)}</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-700">{t(room.name)}</span>
      </nav>
      <AgentNote name={svc.title} />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.6fr_1fr]">
        <div>
          <Gallery images={galleryImages} title={t(room.name)} />

          {videos.length > 0 && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {videos.map((u, i) => (
                <video key={i} src={u} controls playsInline preload="metadata" className="w-full rounded-2xl bg-black" />
              ))}
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Badge tone="ok">{t(rt.name)}</Badge>
            <span className="text-sm text-gray-500">{t("👥 Sức chứa {0} người", [room.capacity])}</span>
            {svc.area && <span className="text-sm text-gray-500">📍 {t(svc.area)}</span>}
          </div>

          <h1 className="mt-2 text-2xl font-bold text-ink sm:text-3xl">{t(room.name)}</h1>
          <p className="mt-1 text-gray-500">
            {t("Thuộc")}{" "}<Link href={`/${cat.slug}/${svc.slug}`} className="text-forest-700 hover:underline">{t(svc.title)}</Link>
          </p>

          <div className="mt-4 flex flex-wrap items-end gap-4 rounded-2xl bg-white p-4 ring-1 ring-black/5">
            <div>
              <p className="text-xs text-gray-500">{t("Giá phòng")}</p>
              {priceOnRequest ? (
                <p className="text-xl font-bold text-forest-700">{t("IB để biết giá")}</p>
              ) : (
                <>
                  <p className="text-2xl font-bold text-forest-700">
                    {fromPrice > 0 && <span className="mr-1 text-sm font-medium text-gray-500">{t("từ")}</span>}
                    {t(formatPrice(fromPrice))}<span className="text-xs font-normal text-gray-500">{t("/đêm")}</span>
                  </p>
                  {listStrike != null && (
                    <p className="text-sm text-gray-400 line-through">{t(formatPrice(listStrike))}</p>
                  )}
                </>
              )}
            </div>
            <div>
              <p className="text-xs text-gray-500">{t("Sức chứa")}</p>
              <p className="text-xl font-bold text-ink">
                {room.capacity}{" "}{t("người")}
                {room.maxCapacity && room.maxCapacity > room.capacity && (
                  <span className="text-sm font-medium text-gray-500">{" "}{t("· tối đa {0}", [room.maxCapacity])}</span>
                )}
              </p>
            </div>
          </div>

          {(svc.extraPersonFee || svc.earlyCheckinFee || svc.lateCheckoutFee) && (
            <div className="mt-3 rounded-2xl bg-sunset-50 p-4 text-sm leading-relaxed text-gray-700 ring-1 ring-sunset-100">
              <p className="font-semibold text-sunset-700">{t("Phụ thu (thanh toán tại chỗ)")}</p>
              <ul className="mt-1 list-inside list-disc text-gray-600">
                {svc.extraPersonFee && (
                  <li>{t("Thêm người (vượt {0} khách): {1}/người/đêm", [room.capacity, t(formatPrice(svc.extraPersonFee))])}</li>
                )}
                {svc.earlyCheckinFee && <li>{t("Check-in sớm: {0}", [t(formatPrice(svc.earlyCheckinFee))])}</li>}
                {svc.lateCheckoutFee && <li>{t("Check-out muộn: {0}", [t(formatPrice(svc.lateCheckoutFee))])}</li>}
              </ul>
            </div>
          )}

          {amenities.length > 0 && (
            <section className="mt-6">
              <h2 className="text-lg font-semibold text-ink">{t("Tiện ích phòng")}</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {amenities.map((a) => (
                  <span key={a} className="rounded-lg bg-forest-50 px-3 py-1.5 text-sm text-forest-700 ring-1 ring-forest-100">
                    ✓ {t(a)}
                  </span>
                ))}
              </div>
            </section>
          )}

          {room.description && (
            <section className="mt-6">
              <h2 className="text-lg font-semibold text-ink">{t("Mô tả")}</h2>
              <p className="mt-2 whitespace-pre-line leading-relaxed text-gray-700">{await tLong(room.description)}</p>
            </section>
          )}

          <section className="mt-8 rounded-xl bg-forest-50 p-4">
            <h2 className="text-sm font-semibold text-forest-800">{t("Liên hệ trực tiếp")}</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              <a href={`tel:${phone.replace(/\s/g, "")}`} className="rounded-lg bg-forest-600 px-4 py-2 text-sm font-semibold text-white hover:bg-forest-700">📞 {t(phone)}</a>
              {zalo && <a href={`https://zalo.me/${zalo}`} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-sunset-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sunset-600">💬 Chat Zalo</a>}
            </div>
          </section>
        </div>

        {/* Đặt phòng (homestay "chỉ liên hệ" → nhắn tin để nhận thông tin) */}
        <div>
          {svc.contactOnly || svc.inquiryOnly ? (
            <div className="flex flex-col gap-3 rounded-2xl bg-white p-5 shadow-md ring-1 ring-black/5 lg:sticky lg:top-20">
              <div className="text-lg font-extrabold text-ink">{svc.contactOnly ? t("Nhắn tin để nhận thông tin") : t("Nhắn tin để biết chi tiết")}</div>
              <p className="text-sm leading-relaxed text-gray-600">
                {svc.contactOnly
                  ? t("Homestay này không hiển thị lịch trống trên web. Nhắn tin hoặc gọi cho Tà Xùa Booking để kiểm tra phòng trống, nhận báo giá chính xác và giữ phòng.")
                  : t("Homestay này không nhận đặt trực tiếp trên web. Xem phòng trống theo ngày ở trang homestay, rồi nhắn tin hoặc gọi cho Tà Xùa Booking để biết chi tiết và giữ phòng.")}
              </p>
              <a
                href={zalo ? `https://zalo.me/${zalo}` : `tel:${phone.replace(/\s/g, "")}`}
                target={zalo ? "_blank" : undefined}
                rel={zalo ? "noopener noreferrer" : undefined}
                className="rounded-xl bg-sunset-500 px-4 py-3.5 text-center text-base font-bold text-white transition hover:bg-sunset-600"
              >
                {t("💬 Nhắn tin nhận thông tin")}
              </a>
              <a href={`tel:${phone.replace(/\s/g, "")}`} className="rounded-xl px-4 py-2.5 text-center text-sm font-bold text-forest-800 ring-1 ring-gray-200">
                {t("Gọi {0}", [t(phone)])}
              </a>
            </div>
          ) : (
            <BookingPanel
              serviceId={svc.id}
              category={svc.category}
              kind={cat.availabilityKind}
              phone={phone}
              zalo={zalo}
            />
          )}
        </div>
      </div>
    </div>
  );
}
