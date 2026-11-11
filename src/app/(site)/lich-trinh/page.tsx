import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { loadItinerary } from "@/lib/itinerary-store";
import { PLACE_KIND_TO_STOP, type FeaturedKey, type StopKind } from "@/lib/itinerary";
import { ItineraryView, type ItineraryPlace, type ViewPlan } from "@/components/itinerary/ItineraryView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Lịch trình Tà Xùa 2N1Đ, 3N2Đ — đi đâu, ăn gì",
  description:
    "Lịch trình Tà Xùa theo giờ cho chuyến xe cabin đêm từ Hà Nội: 2 ngày 1 đêm và 3 ngày 2 đêm, kèm điểm check-in săn mây, quán cafe và quán ăn nên ghé.",
  alternates: { canonical: "/lich-trinh" },
};

export default async function ItineraryPage() {
  const rows = await prisma.place.findMany({
    where: { published: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, kind: true, slug: true, name: true, area: true, address: true, price: true, hours: true, tags: true, desc: true, tip: true, coverImage: true, mapUrl: true },
  });
  const { config } = await loadItinerary(rows);

  const all: ItineraryPlace[] = rows.flatMap((p) => {
    const kind = PLACE_KIND_TO_STOP[p.kind];
    if (!kind) return [];
    const price = p.price ? (/^\d+$/.test(p.price) ? `Từ ${Number(p.price).toLocaleString("vi-VN")}đ` : p.price) : null;
    const hours = p.hours ? `${kind === "checkin" ? "Đẹp nhất" : "Mở"} ${p.hours}` : null;
    return [{
      id: p.id,
      kind,
      name: p.name,
      // điểm check-in: nhãn góc ảnh là khoảng cách (ô "địa chỉ"), quán: khu vực
      badge: (kind === "checkin" && p.address) || p.area,
      sub: (p.tags ?? "").split(",").map((t) => t.trim()).filter((t) => t && !/^gợi ý$/i.test(t)).slice(0, 3).join(" · "),
      desc: p.desc ?? "",
      tip: p.tip ?? "",
      facts: [hours, price].filter((x): x is string => !!x),
      image: p.coverImage ?? null,
      href: kind !== "checkin" && p.slug ? `/${kind === "cafe" ? "cafe" : "nha-hang"}/${p.slug}` : null,
      mapUrl: p.mapUrl || "https://maps.google.com/?q=" + encodeURIComponent(`${p.name} Tà Xùa Bắc Yên Sơn La`),
    }];
  });
  const byId = new Map(all.map((p) => [p.id, p]));

  // Mục "Nên ghé": admin chọn địa điểm nổi bật theo từng loại; chưa chọn ⇒ hiện tất cả.
  const places: ItineraryPlace[] = (["checkin", "cafe", "food"] as FeaturedKey[]).flatMap((k) => {
    const picked = config.featured[k].map((id) => byId.get(id)).filter((p): p is ItineraryPlace => !!p && p.kind === k);
    return picked.length ? picked : all.filter((p) => p.kind === k);
  });

  const plans: ViewPlan[] = config.plans
    .filter((p) => p.published && p.days.some((d) => d.stops.length))
    .map((p) => ({
      id: p.id,
      name: p.name || "Lịch trình",
      sub: p.sub,
      days: p.days
        .map((d) => ({
          title: d.title,
          stops: d.stops.flatMap((s) => {
            const pl = s.placeId ? byId.get(s.placeId) : undefined;
            const name = pl?.name ?? s.name;
            if (!name) return [];
            return [{ time: s.time, name, note: s.note, kind: (pl?.kind ?? "move") as StopKind, placeId: pl?.id ?? null }];
          }),
        }))
        .filter((d) => d.stops.length),
    }));

  return <ItineraryView plans={plans} places={places} prep={config.prep} />;
}
