import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/queries";
import { roomPricing } from "@/lib/availability";
import { isCommunalRoom } from "@/lib/combo";
import { toNumber } from "@/lib/format";
import { SITE } from "@/lib/site";
import { PhotoCollage, type CollageHome } from "@/components/admin/PhotoCollage";
import { COLLAGE_PRESETS_KEY } from "./preset-key";

export const dynamic = "force-dynamic";

/** Bỏ dấu + chữ thường để so trùng tiện ích. */
const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d");
/** Không phải tiện ích (diện tích, giường, tầng, sức chứa…) — chỉ dùng tiện ích thật làm ưu điểm. */
const NOT_AMENITY = /\d+\s*(m2|m²|m\b|nguoi|khach)|\bgiuong\b|\btang\b|toi da|tieu chuan|phong ngu|phong doi|phong don|extra|^\d/;
const VIDEO_RE = /\.(mp4|webm|mov|m4v|ogg)(\?|$)/i;

/** Giá các đêm có thể có của 1 phòng (giá thường + giá theo thứ), bỏ 0/IB. */
function roomPrices(r: Parameters<typeof roomPricing>[0]): number[] {
  const p = roomPricing(r);
  return [p.weekdayPrice, ...(p.daysOfWeek ?? [])].filter((v): v is number => v != null && v > 0);
}

/**
 * Ghép ảnh review: chọn 2–10 ảnh trong kho ảnh THẬT của homestay (ảnh chung +
 * ảnh hạng phòng + ảnh từng phòng), thêm tên/vị trí/ưu nhược/giá rồi xuất PNG.
 */
export default async function CollagePage() {
  await requireAdmin();
  const [services, settings, cabinRows, presetRow] = await Promise.all([
    prisma.service.findMany({
      where: { category: "HOMESTAY" },
      orderBy: [{ published: "desc" }, { title: "asc" }],
      include: {
        images: { orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }] },
        roomTypes: {
          orderBy: { sortOrder: "asc" },
          include: {
            images: { orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }] },
            rooms: {
              orderBy: { sortOrder: "asc" },
              include: { images: { orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }] } },
            },
          },
        },
      },
    }),
    getSettings(),
    // Vé khứ hồi tham khảo cho giá combo: bảng giá của nhà xe cabin nổi bật, thiếu thì bảng chung.
    prisma.cabinPriceRow.findMany({
      where: {
        ticketType: "ROUND_TRIP",
        OR: [{ serviceId: null }, { service: { category: "CABIN", featured: true, published: true } }],
      },
      select: { serviceId: true, pickupPoint: true, price: true },
    }),
    // Mẫu bố cục đã lưu (đọc thẳng DB, không qua cache cài đặt → lưu xong mở lại thấy ngay).
    prisma.siteSetting.findUnique({ where: { key: COLLAGE_PRESETS_KEY } }),
  ]);
  let presets: unknown[] = [];
  try {
    const v = JSON.parse(presetRow?.value ?? "[]");
    if (Array.isArray(v)) presets = v;
  } catch {
    presets = [];
  }

  const own = cabinRows.filter((r) => r.serviceId);
  const rows = own.length ? own : cabinRows;
  const hn = rows.filter((r) => /h[aà]\s*n[oộ]i/i.test(r.pickupPoint));
  const fares = (hn.length ? hn : rows).map((r) => toNumber(r.price) ?? 0).filter((v) => v > 0);
  const fare = fares.length ? Math.min(...fares) : 0;

  const homes: CollageHome[] = services.map((s) => {
    const photos: CollageHome["photos"] = [];
    const seen = new Set<string>();
    const add = (url: string, tag: string, label: string) => {
      if (!url || VIDEO_RE.test(url) || seen.has(url)) return;
      seen.add(url);
      photos.push({ id: `${tag}:${photos.length}`, url, tag, label });
    };
    for (const im of s.images) add(im.url, "home", im.alt || "Ảnh chung");
    const tags: CollageHome["tags"] = [{ key: "home", name: "Ảnh chung" }];
    for (const rt of s.roomTypes) {
      const before = photos.length;
      if (rt.imageUrl) add(rt.imageUrl, rt.id, rt.name);
      for (const im of rt.images) add(im.url, rt.id, im.alt || rt.name);
      for (const r of rt.rooms) for (const im of r.images) add(im.url, rt.id, `${rt.name} · ${r.name}`);
      if (photos.length > before) tags.push({ key: rt.id, name: rt.name });
    }

    // Giá lẻ: thấp nhất – cao nhất trong mọi phòng (mọi thứ trong tuần).
    const rooms = s.roomTypes.flatMap((rt) => rt.rooms.map((r) => ({ rt, r })));
    const all = rooms.flatMap(({ r }) => roomPrices(r));
    const sMin = all.length ? Math.min(...all) : 0;
    const sMax = all.length ? Math.max(...all) : 0;

    // Giá combo/khách trên ảnh review = tiền phòng ÷ sức chứa của phòng đó (phòng đôi ÷ 2,
    // phòng 4 người ÷ 4…) + vé xe khứ hồi. Phòng cộng đồng: giá phòng đã là giá/người → giá + vé.
    const combos: number[] = [];
    if (fare > 0) {
      for (const { rt, r } of rooms) {
        const ps = roomPrices(r);
        if (!ps.length) continue;
        const communal = isCommunalRoom(rt.name, r.name);
        for (const p of [Math.min(...ps), Math.max(...ps)]) {
          combos.push((communal ? p : Math.round(p / Math.max(1, r.capacity))) + fare);
        }
      }
    }

    // Ưu điểm = tiện ích đã tick (hạng phòng + home) + tiện ích nhập ở từng phòng.
    const pros: string[] = [];
    const covered: string[] = []; // từ khoá đã có ý → tiện ích phòng trùng ý thì bỏ
    const anyRt = (k: "cloudView" | "hasBathtub" | "breakfast" | "airCon" | "heating") => s.roomTypes.some((rt) => rt[k]);
    const flag = (on: boolean, text: string, keys: string[]) => { if (on) { pros.push(text); covered.push(...keys); } };
    flag(anyRt("cloudView"), "View săn mây ngay tại phòng", ["bien may", "san may", "view may", "lung may"]);
    flag(anyRt("hasBathtub"), "Có phòng bồn tắm ngắm núi", ["bon tam"]);
    flag(anyRt("breakfast"), "Có bữa sáng", ["an sang", "bua sang"]);
    flag(anyRt("heating"), "Có sưởi đêm lạnh", ["dem suoi", "quat suoi", "may suoi"]);
    flag(anyRt("airCon"), "Phòng có điều hoà", ["dieu hoa"]);
    flag(s.pool, "Có hồ bơi", ["ho boi", "be boi"]);
    flag(s.easyRoad, "Đường vào dễ đi", ["duong de", "de di"]);
    // Tiện ích từng phòng: tách theo dấu phẩy, bỏ thông tin diện tích/giường/tầng/sức chứa,
    // gộp trùng (không phân biệt dấu/hoa thường), có ở NHIỀU phòng thì lên trước.
    const count = new Map<string, { text: string; n: number; first: number }>();
    let order = 0;
    for (const { r } of rooms) {
      for (const raw of (r.amenities ?? "").split(/[,;\n]/)) {
        const a = raw.trim().replace(/\.$/, "");
        const key = norm(a);
        if (!a || a.length > 40 || NOT_AMENITY.test(key)) continue;
        if (covered.some((c) => key.includes(c))) continue;
        const cur = count.get(key);
        if (cur) cur.n++;
        else count.set(key, { text: a.charAt(0).toUpperCase() + a.slice(1), n: 1, first: order++ });
      }
    }
    pros.push(...[...count.values()].sort((a, b) => b.n - a.n || a.first - b.first).map((x) => x.text).slice(0, Math.max(0, 8 - pros.length)));

    const loc = [s.area, s.distanceKm != null ? (s.distanceKm === 0 ? "ngay trung tâm" : `cách trung tâm ${String(s.distanceKm).replace(".", ",")} km`) : null]
      .filter(Boolean)
      .join(", ");

    return {
      id: s.id,
      name: s.title,
      published: s.published,
      loc: loc || "Tà Xùa, Bắc Yên, Sơn La",
      pros: pros.join("\n"),
      cons: "",
      sMin: sMin ? String(sMin) : "",
      sMax: sMax && sMax !== sMin ? String(sMax) : "",
      cMin: combos.length ? String(Math.min(...combos)) : "",
      cMax: combos.length && Math.max(...combos) !== Math.min(...combos) ? String(Math.max(...combos)) : "",
      tags,
      photos,
    };
  });

  return (
    <PhotoCollage
      homes={homes}
      initialPresets={presets}
      phone={settings.contactPhone || SITE.defaultPhone}
      domain={(process.env.NEXT_PUBLIC_SITE_URL || "https://taxuabooking.com").replace(/^https?:\/\//, "").replace(/\/$/, "")}
    />
  );
}
