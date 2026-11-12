import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { loadItinerary } from "@/lib/itinerary-store";
import { MAP_CENTER, MAP_GATE, projectSpots } from "@/lib/checkin-map";
import { isVideoUrl } from "@/lib/utils";
import { CheckinMap, type MapSpot, type MapPlan } from "@/components/itinerary/CheckinMap";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Bản đồ check-in Tà Xùa — cung đường theo lịch trình",
  description:
    "Bản đồ các điểm check-in quanh Tà Xùa tính từ chợ trung tâm: Cây cô đơn, Sống lưng khủng long, Mỏm cá heo, thảo nguyên, đồi chè cổ thụ. Chọn lịch trình 2N1Đ, 3N2Đ để xem cung đường từng ngày.",
  alternates: { canonical: "/ban-do" },
};

/** "1,5 km từ trung tâm" / "300 m từ trung tâm" → km. */
function parseKm(s: string | null): number | null {
  const m = (s ?? "").match(/([\d.,]+)\s*(km|m)\b/i);
  if (!m) return null;
  const v = parseFloat(m[1].replace(",", ".")) / (m[2].toLowerCase() === "m" ? 1000 : 1);
  return Number.isFinite(v) ? v : null;
}

export default async function CheckinMapPage({ searchParams }: { searchParams: Promise<{ plan?: string; view?: string }> }) {
  const { plan: initialPlan, view } = await searchParams;
  const rows = await prisma.place.findMany({
    where: { published: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, kind: true, slug: true, name: true, area: true, address: true, hours: true, tags: true, desc: true, tip: true, coverImage: true, images: true, mapUrl: true, lat: true, lng: true },
  });
  const { config } = await loadItinerary(rows);

  // Chiếu MỌI địa điểm có toạ độ thật (lấy từ link Google Maps khi lưu) lên mặt phẳng bản đồ hoạt hình.
  const located = rows.filter((p): p is typeof p & { lat: number; lng: number } => p.lat != null && p.lng != null);
  const posOf = projectSpots([
    { id: "tt", ...MAP_CENTER },
    { id: "by", ...MAP_GATE },
    ...located.map((p) => ({ id: p.id, lat: p.lat, lng: p.lng })),
  ]);
  const TT = posOf.get("tt")!, BY = posOf.get("by")!;

  const fixed: MapSpot[] = [
    { id: "tt", pos: TT, ...MAP_CENTER, name: "Trung tâm Tà Xùa", km: 0, sub: "Chợ & UBND xã · mốc 0", desc: "Khu chợ, homestay, quán ăn. Điểm xuất phát của mọi cung đường.", tip: "Đổ xăng và ăn sáng ở đây trước khi đi xa.", best: "", image: null, mapUrl: `https://maps.google.com/?q=${MAP_CENTER.lat},${MAP_CENTER.lng}` },
    { id: "by", pos: BY, ...MAP_GATE, name: "Thị trấn Bắc Yên", km: 15, sub: "Cửa ngõ · bến xe cabin", desc: "Nơi xe cabin dừng, từ đây lên Tà Xùa theo đèo quanh co.", tip: "Dừng ngắm toàn cảnh đèo ở các khúc cua.", best: "", image: null, mapUrl: `https://maps.google.com/?q=${MAP_GATE.lat},${MAP_GATE.lng}` },
  ];
  const checkins: MapSpot[] = rows
    .filter((p) => p.kind === "CHECKIN")
    .map((p) => {
      const image = [p.coverImage, ...(p.images ?? "").split("|")].map((u) => (u ?? "").trim()).find((u) => u && !isVideoUrl(u)) ?? null;
      return {
        id: p.id,
        pos: posOf.get(p.id) ?? null, // chưa có toạ độ ⇒ chỉ hiện ở danh sách
        lat: p.lat,
        lng: p.lng,
        name: p.name,
        km: parseKm(p.address),
        sub: (p.tags ?? "").split(",").map((t) => t.trim()).filter((t) => t && !/^gợi ý$/i.test(t)).slice(0, 2).join(" · ") || p.area,
        desc: p.desc ?? "",
        tip: p.tip ?? "",
        best: p.hours ?? "",
        image,
        mapUrl: p.mapUrl || "https://maps.google.com/?q=" + encodeURIComponent(p.lat != null && p.lng != null ? `${p.lat},${p.lng}` : `${p.name}, Tà Xùa, Bắc Yên, Sơn La`),
      };
    });
  const byPlace = new Map(checkins.map((s) => [s.id, s]));
  const nameOf = new Map(rows.map((p) => [p.id, p.name]));

  // Lịch trình (admin soạn ở /admin/itinerary) → cung đường nối vị trí các điểm dừng: địa điểm có toạ độ
  // thì theo toạ độ; chưa có (hoặc điểm tự nhập) coi như ở trung tâm; chặng xe đầu & cuối là Bắc Yên.
  const plans: MapPlan[] = config.plans
    .filter((p) => p.published && p.days.some((d) => d.stops.length))
    .map((p) => {
      const total = p.days.reduce((a, d) => a + d.stops.length, 0);
      let gi = 0;
      return {
        id: p.id,
        name: p.name || "Lịch trình",
        sub: p.sub,
        days: p.days
          .filter((d) => d.stops.length)
          .map((d) => ({
            title: d.title,
            stops: d.stops.map((s) => {
              const spot = s.placeId ? byPlace.get(s.placeId) : undefined;
              const custom = !s.placeId || !nameOf.has(s.placeId);
              const edge = custom && (gi === 0 || gi === total - 1);
              gi++;
              return {
                time: s.time,
                name: (s.placeId && nameOf.get(s.placeId)) || s.name,
                note: s.note,
                pos: (s.placeId && posOf.get(s.placeId)) || (edge ? BY : TT),
                spotId: spot ? spot.id : edge ? "by" : "tt",
                checkin: !!spot,
              };
            }),
          })),
      };
    });

  return <CheckinMap spots={[...fixed, ...checkins]} plans={plans} initialPlan={typeof initialPlan === "string" ? initialPlan : undefined} initialView={view === "sat" ? "sat" : "3d"} />;
}
