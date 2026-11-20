import "server-only";
import { prisma } from "./prisma";

/** Popup "Xung quanh có gì?": một homestay (điểm gốc tính khoảng cách). */
export interface NearbyHome {
  id: string;
  name: string;
  lat: number;
  lng: number;
}
export type NearbyKind = "CHECKIN" | "CAFE" | "RESTAURANT" | "HOMESTAY";
/** Một điểm xung quanh: Place đã đăng có toạ độ, hoặc một homestay khác đang hiện trên web. */
export interface NearbyPlace {
  id: string;
  kind: NearbyKind;
  name: string;
  lat: number;
  lng: number;
  rating: number | null; // điểm TB đánh giá đã duyệt
  reviewCount: number;
  short: string; // dòng mô tả ngắn (mẹo / đặc điểm / khu vực)
  desc: string;
  hours: string;
  price: string;
  cover: string | null;
  href: string | null; // trang trên web (nhà hàng / cafe có slug, homestay)
  mapUrl: string | null;
}

const PLACE_KINDS = ["CHECKIN", "CAFE", "RESTAURANT"];
const HOME_CATS = ["HOMESTAY", "BUNGALOW"] as const;

/** Mọi ĐIỂM ĐẾN có toạ độ (Place đã đăng + homestay đang hiện) — dùng chung cho popup, API quãng đường và job tính sẵn. */
export async function nearbyTargets(): Promise<{ id: string; lat: number; lng: number }[]> {
  const [places, homes] = await Promise.all([
    prisma.place.findMany({ where: { published: true, lat: { not: null }, lng: { not: null }, kind: { in: PLACE_KINDS } }, select: { id: true, lat: true, lng: true } }),
    prisma.service.findMany({ where: { published: true, category: { in: [...HOME_CATS] }, lat: { not: null }, lng: { not: null } }, select: { id: true, lat: true, lng: true } }),
  ]);
  return [...places, ...homes].map((p) => ({ id: p.id, lat: p.lat!, lng: p.lng! }));
}

/**
 * Dữ liệu popup: các homestay `homeIds` có toạ độ (giữ thứ tự truyền vào) + mọi điểm check-in / cafe /
 * nhà hàng đã đăng + các homestay đang hiện (kind HOMESTAY) có toạ độ. Quãng đường lấy riêng ở /api/nearby/roads.
 */
export async function getNearbyData(homeIds: string[]): Promise<{ homes: NearbyHome[]; places: NearbyPlace[] }> {
  const ids = [...new Set(homeIds)].slice(0, 60);
  const [homesRaw, placesRaw, staysRaw] = await Promise.all([
    ids.length
      ? prisma.service.findMany({ where: { id: { in: ids }, lat: { not: null }, lng: { not: null } }, select: { id: true, title: true, lat: true, lng: true } })
      : Promise.resolve([]),
    prisma.place.findMany({
      where: { published: true, lat: { not: null }, lng: { not: null }, kind: { in: PLACE_KINDS } },
      select: { id: true, kind: true, slug: true, name: true, lat: true, lng: true, tip: true, tags: true, desc: true, hours: true, price: true, coverImage: true, mapUrl: true },
    }),
    prisma.service.findMany({
      where: { published: true, category: { in: [...HOME_CATS] }, lat: { not: null }, lng: { not: null } },
      select: {
        id: true, title: true, slug: true, area: true, summary: true, lat: true, lng: true, mapUrl: true,
        images: { orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }], take: 1, select: { url: true } },
      },
    }),
  ]);
  const [pStats, sStats] = await Promise.all([
    placesRaw.length
      ? prisma.placeReview.groupBy({ by: ["placeId"], where: { approved: true, placeId: { in: placesRaw.map((p) => p.id) } }, _avg: { rating: true }, _count: { _all: true } })
      : Promise.resolve([]),
    staysRaw.length
      ? prisma.review.groupBy({ by: ["serviceId"], where: { status: "APPROVED", serviceId: { in: staysRaw.map((s) => s.id) } }, _avg: { rating: true }, _count: { _all: true } })
      : Promise.resolve([]),
  ]);
  const ps = new Map(pStats.map((s) => [s.placeId, s]));
  const ss = new Map(sStats.map((s) => [s.serviceId, s]));
  const order = new Map(ids.map((id, i) => [id, i]));
  const homes = homesRaw
    .map((h) => ({ id: h.id, name: h.title, lat: h.lat!, lng: h.lng! }))
    .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  const avg = (a: number | null | undefined) => (a != null ? Math.round(a * 10) / 10 : null);
  const places: NearbyPlace[] = placesRaw.map((p) => {
    const s = ps.get(p.id);
    const kind = p.kind as NearbyKind;
    return {
      id: p.id,
      kind,
      name: p.name,
      lat: p.lat!,
      lng: p.lng!,
      rating: avg(s?._avg.rating),
      reviewCount: s?._count._all ?? 0,
      short: (p.tip || p.tags?.split(",").map((x) => x.trim()).filter(Boolean).slice(0, 2).join(" · ") || "").trim(),
      desc: (p.desc ?? "").trim(),
      hours: p.hours ?? "",
      price: p.price ?? "",
      cover: p.coverImage,
      href: p.slug && kind === "RESTAURANT" ? `/nha-hang/${p.slug}` : p.slug && kind === "CAFE" ? `/cafe/${p.slug}` : null,
      mapUrl: p.mapUrl,
    };
  });
  for (const h of staysRaw) {
    const s = ss.get(h.id);
    places.push({
      id: h.id,
      kind: "HOMESTAY",
      name: h.title,
      lat: h.lat!,
      lng: h.lng!,
      rating: avg(s?._avg.rating),
      reviewCount: s?._count._all ?? 0,
      short: h.area ?? "",
      desc: (h.summary ?? "").trim(),
      hours: "",
      price: "",
      cover: h.images[0]?.url ?? null,
      href: `/homestay/${h.slug}`, // BUNGALOW cũng nằm dưới /homestay
      mapUrl: h.mapUrl,
    });
  }
  return { homes, places };
}
