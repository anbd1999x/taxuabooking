import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getRoomDetail, getSettings } from "@/lib/queries";
import { CATEGORIES } from "@/lib/constants";
import { formatPrice } from "@/lib/format";
import { roomListPrice } from "@/lib/availability";
import { SITE } from "@/lib/site";
import { Gallery } from "@/components/Gallery";
import { BookingPanel } from "@/components/BookingPanel";
import { Badge } from "@/components/ui/Badge";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string; slug: string; roomId: string }>;
}): Promise<Metadata> {
  const { slug, roomId } = await params;
  const room = await getRoomDetail(slug, roomId);
  if (!room) return {};
  const svc = room.roomType.service;
  return {
    title: `${room.name} — ${svc.title}`,
    description: room.description || `${room.name} tại ${svc.title}, ${room.roomType.name}.`,
  };
}

export default async function RoomDetailPage({
  params,
}: {
  params: Promise<{ category: string; slug: string; roomId: string }>;
}) {
  const { slug, roomId } = await params;
  const [room, settings] = await Promise.all([getRoomDetail(slug, roomId), getSettings()]);
  if (!room) notFound();

  const rt = room.roomType;
  const svc = rt.service;
  const cat = CATEGORIES[svc.category];
  // Đơn đặt do Tà Xùa Booking gọi xác nhận → dùng số nền tảng (settings), không dùng số riêng của cơ sở.
  const phone = settings.contactPhone || SITE.defaultPhone;
  const zalo = settings.contactZalo || SITE.defaultZalo;

  const listStrike = roomListPrice(room);
  const amenities = (room.amenities ?? "")
    .split(",")
    .map((a) => a.trim())
    .filter(Boolean);

  // Ưu tiên ảnh riêng của phòng; nếu phòng chưa có ảnh thì dùng ảnh hạng phòng.
  const galleryImages =
    room.images.length > 0
      ? room.images.map((i) => ({ url: i.url, alt: i.alt }))
      : rt.images.filter((i) => i.type === "image").map((i) => ({ url: i.url, alt: i.alt }));

  return (
    <div className="container-page py-8">
      <nav className="mb-4 text-sm text-gray-500">
        <a href="/" className="hover:text-forest-700">Trang chủ</a>
        <span className="mx-2">/</span>
        <a href={`/${cat.slug}`} className="hover:text-forest-700">{cat.shortLabel}</a>
        <span className="mx-2">/</span>
        <a href={`/${cat.slug}/${svc.slug}`} className="hover:text-forest-700">{svc.title}</a>
        <span className="mx-2">/</span>
        <span className="text-gray-700">{room.name}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-[1.6fr_1fr]">
        <div>
          <Gallery images={galleryImages} title={room.name} />

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Badge tone="ok">{rt.name}</Badge>
            <span className="text-sm text-gray-500">👥 Sức chứa {room.capacity} người</span>
            {svc.area && <span className="text-sm text-gray-500">📍 {svc.area}</span>}
          </div>

          <h1 className="mt-2 text-2xl font-bold text-ink sm:text-3xl">{room.name}</h1>
          <p className="mt-1 text-gray-500">
            Thuộc <a href={`/${cat.slug}/${svc.slug}`} className="text-forest-700 hover:underline">{svc.title}</a>
          </p>

          <div className="mt-4 flex flex-wrap items-end gap-4 rounded-2xl bg-white p-4 ring-1 ring-black/5">
            <div>
              <p className="text-xs text-gray-500">Giá phòng</p>
              <p className="text-2xl font-bold text-forest-700">
                {formatPrice(room.salePrice ?? room.listPrice)}<span className="text-xs font-normal text-gray-500">/đêm</span>
              </p>
              {listStrike != null && (
                <p className="text-sm text-gray-400 line-through">{formatPrice(listStrike)}</p>
              )}
            </div>
            <div>
              <p className="text-xs text-gray-500">Sức chứa</p>
              <p className="text-xl font-bold text-ink">{room.capacity} người</p>
            </div>
          </div>

          {amenities.length > 0 && (
            <section className="mt-6">
              <h2 className="text-lg font-semibold text-ink">Tiện ích phòng</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {amenities.map((a) => (
                  <span key={a} className="rounded-lg bg-forest-50 px-3 py-1.5 text-sm text-forest-700 ring-1 ring-forest-100">
                    ✓ {a}
                  </span>
                ))}
              </div>
            </section>
          )}

          {room.description && (
            <section className="mt-6">
              <h2 className="text-lg font-semibold text-ink">Mô tả</h2>
              <p className="mt-2 whitespace-pre-line leading-relaxed text-gray-700">{room.description}</p>
            </section>
          )}

          <section className="mt-8 rounded-xl bg-forest-50 p-4">
            <h2 className="text-sm font-semibold text-forest-800">Liên hệ trực tiếp</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              <a href={`tel:${phone.replace(/\s/g, "")}`} className="rounded-lg bg-forest-600 px-4 py-2 text-sm font-semibold text-white hover:bg-forest-700">📞 {phone}</a>
              {zalo && <a href={`https://zalo.me/${zalo}`} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-sunset-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sunset-600">💬 Chat Zalo</a>}
            </div>
          </section>
        </div>

        {/* Đặt phòng */}
        <div>
          <BookingPanel
            serviceId={svc.id}
            category={svc.category}
            kind={cat.availabilityKind}
            phone={phone}
            zalo={zalo}
          />
        </div>
      </div>
    </div>
  );
}
