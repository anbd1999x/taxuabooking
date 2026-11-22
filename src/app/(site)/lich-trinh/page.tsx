import type { Metadata } from "next";
import { pageMeta } from "@/lib/og";
import { placeShareImage } from "@/lib/og-source";
import { prisma } from "@/lib/prisma";
import { loadItinerary } from "@/lib/itinerary-store";
import { PLACE_KIND_TO_STOP, type FeaturedKey, type StopKind } from "@/lib/itinerary";
import { getSettings } from "@/lib/queries";
import { SITE } from "@/lib/site";
import { isVideoUrl } from "@/lib/utils";
import { ItineraryView, type ItineraryPlace, type ViewPlan } from "@/components/itinerary/ItineraryView";
import type { CostPreset } from "@/components/itinerary/ItineraryCost";
import { getT, tLong } from "@/lib/i18n/server";
import { renderMarkdown } from "@/lib/markdown";
import { i18nMeta } from "@/lib/i18n/meta";

export const dynamic = "force-dynamic";

const META = {
  title: "Lịch trình & chi phí đi Tà Xùa 2N1Đ, 3N2Đ",
  description:
    "Lịch trình Tà Xùa theo giờ từ Hà Nội (xe cabin đêm hoặc limousine): 2 ngày 1 đêm, 3 ngày 2 đêm, tự tính chi phí theo số người — xe, phòng, ăn uống, vé check-in.",
  path: "/lich-trinh",
};

/** Ảnh chia sẻ link lấy từ địa điểm thật trong DB (thiếu thì ảnh biển mây). */
export async function generateMetadata(): Promise<Metadata> {
  return i18nMeta({ ...META, image: await placeShareImage("CHECKIN") });
}

type SP = { ngay?: string; phong?: string; sophong?: string; khach?: string; xe?: string; ve?: string; giam?: string };

/** Số nguyên ≥ 0 từ query (kẹp trần); không hợp lệ ⇒ null. */
const qNum = (v: string | undefined, max: number) => {
  const n = Number(v);
  return v != null && v !== "" && Number.isFinite(n) && n >= 0 ? Math.min(max, Math.round(n)) : null;
};

export default async function ItineraryPage({ searchParams }: { searchParams: Promise<SP> }) {
  const tr = await getT();
  const sp = await searchParams;
  const wantDays = Number(sp.ngay);
  // Link "Tham khảo lịch trình & chi phí" từ trang đặt homestay / combo: tiền phòng (+ vé xe) đang chọn.
  const roomTotal = qNum(sp.phong, 500_000_000);
  const presetTransport = sp.xe === "cabin" || sp.xe === "limo" ? sp.xe : null;
  const preset: CostPreset | null =
    roomTotal && roomTotal > 0
      ? {
          roomTotal,
          rooms: Math.max(1, qNum(sp.sophong, 50) ?? 1),
          pax: Math.max(1, Math.min(40, qNum(sp.khach, 40) ?? 2)),
          busTotal: presetTransport ? (qNum(sp.ve, 500_000_000) ?? 0) : null,
          discount: presetTransport ? (qNum(sp.giam, 50_000_000) ?? 0) : 0,
          transport: presetTransport,
        }
      : null;
  const rows = await prisma.place.findMany({
    where: { published: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, kind: true, slug: true, name: true, area: true, address: true, price: true, hours: true, tags: true, desc: true, tip: true, content: true, coverImage: true, images: true, mapUrl: true },
  });
  const { config } = await loadItinerary(rows);

  // Điểm check-in không có trang riêng ⇒ bài mô tả chi tiết (markdown) mở ngay trên thẻ "Nên ghé" (đã dịch theo ngôn ngữ).
  const detail = new Map(
    await Promise.all(
      rows
        .filter((p) => p.kind === "CHECKIN" && p.content?.trim())
        .map(async (p) => [p.id, renderMarkdown((await tLong(p.content!.trim())) ?? "")] as const),
    ),
  );
  const all: ItineraryPlace[] = rows.flatMap((p) => {
    const kind = PLACE_KIND_TO_STOP[p.kind];
    if (!kind) return [];
    const price = p.price ? (/^\d+$/.test(p.price) ? tr("Từ {0}đ", [Number(p.price).toLocaleString("vi-VN")]) : p.price) : null;
    const hours = p.hours ? `${kind === "checkin" ? tr("Đẹp nhất") : tr("Mở")} ${p.hours}` : null;
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
      media: [p.coverImage, ...(p.images ?? "").split("|")]
        .map((u) => (u ?? "").trim())
        .filter(Boolean)
        .slice(0, 12)
        .map((url) => ({ url, video: isVideoUrl(url) })),
      href: kind !== "checkin" && p.slug ? `/${kind === "cafe" ? "cafe" : "nha-hang"}/${p.slug}` : null,
      detailHtml: detail.get(p.id) ?? null,
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
      name: p.name || tr("Lịch trình"),
      sub: p.sub,
      transport: p.transport,
      nights: p.nights,
      days: p.days
        .map((d) => ({
          label: d.label,
          title: d.title,
          stops: d.stops.flatMap((s) => {
            const pl = s.placeId ? byId.get(s.placeId) : undefined;
            const name = pl?.name ?? s.name;
            if (!name && !s.title) return [];
            const kind = (pl?.kind ?? "move") as StopKind;
            return [{
              time: s.time,
              end: s.end,
              // tên hoạt động (nếu có) làm dòng chính, địa điểm thành dòng nhỏ
              title: s.title || name,
              place: s.title && name !== s.title ? name : "",
              note: s.note,
              kind,
              placeId: pl?.id ?? null,
              cost: s.cost,
              unit: s.unit,
              cat: s.cat || (kind === "cafe" || kind === "food" ? "an" : "ve"),
              incl: s.incl,
              subs: s.subs,
            }];
          }),
        }))
        .filter((d) => d.stops.length),
    }));

  // ?ngay=N (từ trang đặt combo/phòng): mở sẵn lịch trình có số đêm khớp (N − 1), không có thì lấy cái gần nhất;
  // đặt combo ⇒ ưu tiên đúng cách đi (cabin / limousine) của vé đang chọn.
  const wantNights = wantDays - 1;
  const pool = preset?.transport && plans.some((p) => p.transport === preset.transport) ? plans.filter((p) => p.transport === preset.transport) : plans;
  const initialPlan =
    Number.isFinite(wantDays) && wantDays >= 1 && pool.length
      ? [...pool].sort((a, b) => Math.abs(a.nights - wantNights) - Math.abs(b.nights - wantNights))[0].id
      : undefined;

  const settings = await getSettings();
  const zalo = "https://zalo.me/" + (settings.contactZalo || SITE.defaultZalo).replace(/\D/g, "");
  return <ItineraryView plans={plans} places={places} cost={config.cost} zalo={zalo} prep={config.prep} initialPlan={initialPlan} preset={preset} />;
}
