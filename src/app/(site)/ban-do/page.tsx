import type { Metadata } from "next";
import { pageMeta } from "@/lib/og";
import { placeShareImage } from "@/lib/og-source";
import { prisma } from "@/lib/prisma";
import { loadItinerary } from "@/lib/itinerary-store";
import { MAP_CENTER, MAP_GATE, projectSpots } from "@/lib/checkin-map";
import { isVideoUrl } from "@/lib/utils";
import { CheckinMap, type MapSpot, type MapPlan } from "@/components/itinerary/CheckinMap";
import { SatBoard, type BoardSpot, type BoardPlan } from "@/components/itinerary/SatBoard";
import { roadPath } from "@/lib/road-path";

export const dynamic = "force-dynamic";

const META = {
  title: "Bản đồ Tà Xùa: điểm check-in & cung đường",
  description:
    "Bản đồ vệ tinh Tà Xùa với các điểm check-in: Cây cô đơn, Sống lưng khủng long, Mỏm cá heo, thảo nguyên. Chọn lịch trình 2N1Đ, 3N2Đ để xem cung đường từng ngày.",
  path: "/ban-do",
};

/** Ảnh chia sẻ link lấy từ địa điểm thật trong DB (thiếu thì ảnh biển mây). */
export async function generateMetadata(): Promise<Metadata> {
  return pageMeta({ ...META, image: await placeShareImage("CHECKIN", 1) });
}

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

  // Mặc định: bản đồ ẢNH VỆ TINH (ghim theo toạ độ thật, đường theo đường xe thật). ?view=3d ⇒ bản đồ hoạt hình cũ.
  if (view !== "3d") {
    const firstImage = (p: (typeof rows)[number]) => [p.coverImage, ...(p.images ?? "").split("|")].map((u) => (u ?? "").trim()).find((u) => u && !isVideoUrl(u)) ?? null;
    const placed = rows.filter((p): p is typeof p & { lat: number; lng: number } => p.lat != null && p.lng != null);
    const spots: BoardSpot[] = [
      { id: "tt", cat: "center", ...MAP_CENTER, name: "Trung tâm Tà Xùa", sub: "", desc: "Khu chợ, homestay, quán ăn. Điểm xuất phát của mọi cung đường.", tip: "Đổ xăng và ăn sáng ở đây trước khi đi xa.", best: "", image: null, mapUrl: `https://maps.google.com/?q=${MAP_CENTER.lat},${MAP_CENTER.lng}`, href: null },
      { id: "by", cat: "start", ...MAP_GATE, name: "Bắc Yên (xe cabin)", sub: "", desc: "Nơi xe cabin dừng, từ đây lên Tà Xùa theo đèo quanh co.", tip: "", best: "", image: null, mapUrl: `https://maps.google.com/?q=${MAP_GATE.lat},${MAP_GATE.lng}`, href: null },
      ...placed.map((p): BoardSpot => ({
        id: p.id,
        cat: p.kind === "CHECKIN" ? "cam" : "cafe",
        lat: p.lat,
        lng: p.lng,
        name: p.name,
        sub: p.kind === "CHECKIN" ? (p.address ?? "") : (p.area ?? ""),
        desc: p.desc ?? "",
        tip: p.tip ?? "",
        best: p.kind === "CHECKIN" ? (p.hours ?? "") : "",
        image: firstImage(p),
        mapUrl: p.mapUrl || `https://maps.google.com/?q=${p.lat},${p.lng}`,
        href: p.kind !== "CHECKIN" && p.slug ? `/${p.kind === "CAFE" ? "cafe" : "nha-hang"}/${p.slug}` : null,
      })),
    ];
    const at = new Map(spots.map((s) => [s.id, s]));
    const names = new Map(rows.map((p) => [p.id, p.name]));
    const boardPlans: BoardPlan[] = [];
    for (const p of config.plans) {
      if (!p.published || !p.days.some((d) => d.stops.length)) continue;
      const total = p.days.reduce((a, d) => a + d.stops.length, 0);
      let gi = 0;
      const days: BoardPlan["days"] = [];
      for (const d of p.days) {
        if (!d.stops.length) continue;
        const stops = d.stops.map((st) => {
          const own = !!st.placeId && at.has(st.placeId);
          const custom = !st.placeId || !names.has(st.placeId);
          const edge = custom && (gi === 0 || gi === total - 1); // chặng xe đầu & cuối: Bắc Yên
          gi++;
          return { time: st.time, name: (st.placeId && names.get(st.placeId)) || st.name, note: st.note, spotId: own ? st.placeId! : edge ? "by" : "tt", own };
        });
        // ngày sau bắt đầu từ trung tâm (nơi ở) nếu điểm đầu không phải trung tâm
        const seq = [...(days.length && stops[0].spotId !== "tt" ? ["tt"] : []), ...stops.map((x) => x.spotId)];
        days.push({ title: d.title, stops, path: await roadPath(seq.map((id) => at.get(id)!)) });
      }
      boardPlans.push({ id: p.id, name: p.name || "Lịch trình", sub: p.sub, days });
    }
    // "Khám phá tự do": đường từ Bắc Yên lên trung tâm ra điểm xa nhất, và nhánh về phía đối diện.
    const far = (from: { lat: number; lng: number }) => placed.reduce<(typeof placed)[number] | null>((b, p) => (!b || Math.hypot(p.lat - from.lat, p.lng - from.lng) > Math.hypot(b.lat - from.lat, b.lng - from.lng) ? p : b), null);
    const f1 = far(MAP_CENTER);
    const f2 = f1 ? far(f1) : null;
    const freeRoads = [await roadPath([MAP_GATE, MAP_CENTER, ...(f1 ? [f1] : [])]), ...(f2 && f2 !== f1 ? [await roadPath([MAP_CENTER, f2])] : [])];
    return <SatBoard spots={spots} plans={boardPlans} freeRoads={freeRoads} initialPlan={typeof initialPlan === "string" ? initialPlan : undefined} />;
  }

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

  return <CheckinMap spots={[...fixed, ...checkins]} plans={plans} initialPlan={typeof initialPlan === "string" ? initialPlan : undefined} initialView="3d" />;
}
