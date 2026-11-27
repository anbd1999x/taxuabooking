import "server-only";
import type { Place } from "@prisma/client";
import { prisma } from "./prisma";
import { isVideoUrl, slugify } from "./utils";
import { cachedRoads, centerPt, type Road } from "./road-distance";

/**
 * Trang ĐIỂM THAM QUAN (/diem-den, /diem-den/<slug>) = Place kind "CHECKIN" đã đăng.
 * Mọi số liệu lấy từ DB: quãng đường xe chạy đọc cache RoadDistance (tính sẵn bằng `warmCheckinRoads`,
 * không gọi dịch vụ ngoài khi dựng trang), giờ / chi phí là trường admin nhập, thiếu thì trang bỏ mục đó.
 */

export const ATTRACTION_BASE = "/diem-den";
export const attractionPath = (slug: string) => `${ATTRACTION_BASE}/${slug}`;

/** Ảnh thật của điểm (ảnh bìa trước), bỏ video. */
export function placeImages(p: Pick<Place, "coverImage" | "images">): string[] {
  return [...new Set([p.coverImage, ...(p.images ?? "").split("|")].map((u) => (u ?? "").trim()).filter((u) => u && !isVideoUrl(u)))];
}

/** Gọn chữ admin gõ: "( Khèn Coffee )" → "(Khèn Coffee)", "30k , 40k" → "30k, 40k", " — " → ", " (quy ước không dùng gạch dài). */
export function tidy(s: string): string {
  return s.replace(/\s*—\s*/g, ", ").replace(/\(\s+/g, "(").replace(/\s+\)/g, ")").replace(/\s+([,.!?;:])/g, "$1").replace(/\s{2,}/g, " ").trim();
}

/** Chi phí admin nhập: "40000" → "40.000đ", "Free" → "Miễn phí"; còn lại giữ nguyên (đã gọn khoảng trắng). */
export function priceLabel(raw: string | null | undefined): string {
  const s = (raw ?? "").trim();
  if (!s) return "";
  if (/^free$/i.test(s)) return "Miễn phí";
  if (/^\d{4,}$/.test(s)) return `${Number(s).toLocaleString("vi-VN")}đ`;
  return tidy(s);
}
/** Điểm thuộc xã Tà Xùa? (đồi Mâm Xôi khai khu / địa chỉ "Xím Vàng" ⇒ không). */
export const inTaXua = (p: Pick<Place, "area" | "address">) => !/xím vàng/i.test(`${p.area ?? ""} ${p.address ?? ""}`);

export const isFree = (raw: string | null | undefined) => priceLabel(raw) === "Miễn phí";

/** Địa chỉ admin nhập chỉ là câu ước lượng khoảng cách ("2 km từ trung tâm") ⇒ không dùng làm địa chỉ (đã có quãng đường thật). */
export function realAddress(addr: string | null | undefined): string {
  const s0 = tidy(addr ?? "");
  if (!s0 || /\bkm\b|\d\s*km|từ trung tâm|cách trung tâm/i.test(s0)) return "";
  // Bỏ mã Plus Code ("7F55+MM2, ") và đuôi hành chính (trang đã ghi "xã Tà Xùa, tỉnh Sơn La").
  let parts = s0.replace(/^[23456789CFGHJMPQRVWX]{4,8}\+[23456789CFGHJMPQRVWX]{2,3},?\s*/i, "").split(/\s*,\s*/).filter(Boolean);
  while (parts.length && /^(việt nam|vietnam|sơn la|(tỉnh )?sơn la|bắc yên|(huyện )?bắc yên|(xã )?tà xùa)$/i.test(parts[parts.length - 1])) parts = parts.slice(0, -1);
  const s = parts.join(", ");
  // Cụm chỉ hướng ("Đằng sau quán…", "Đường đi thảo nguyên") đứng sau "ở" ⇒ viết thường chữ đầu.
  return /^(đằng|đường|gần|cạnh|sau|trước|bên|xã)\s/i.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s;
}

/** Slug mới cho điểm chưa có slug: không dấu, có "ta-xua", không trùng. */
async function freshSlug(name: string): Promise<string> {
  const base0 = slugify(name) || "diem-den";
  const base = /ta-xua/.test(base0) ? base0 : `${base0}-ta-xua`;
  for (let i = 0; i < 50; i++) {
    const s = i ? `${base}-${i + 1}` : base;
    if (!(await prisma.place.findFirst({ where: { slug: s }, select: { id: true } }))) return s;
  }
  return `${base}-${Date.now().toString(36)}`;
}

/** Điểm check-in đã đăng thiếu slug ⇒ sinh slug và GHI vào DB (để có trang chi tiết). */
async function ensureSlugs(): Promise<void> {
  const missing = await prisma.place.findMany({ where: { kind: "CHECKIN", published: true, OR: [{ slug: null }, { slug: "" }] }, select: { id: true, name: true } });
  for (const m of missing) {
    await prisma.place.update({ where: { id: m.id }, data: { slug: await freshSlug(m.name) } }).catch(() => null);
  }
}

export async function getAttraction(slug: string) {
  if (!slug || slug.length > 120) return null;
  return prisma.place.findFirst({ where: { slug, kind: "CHECKIN", published: true } });
}

export type AttractionRow = Place & { slug: string; road: Road | null };

/** Mọi điểm check-in đã đăng có slug, kèm quãng đường xe chạy từ trung tâm (cache). */
export async function listAttractions(): Promise<AttractionRow[]> {
  await ensureSlugs().catch(() => null);
  const rows = await prisma.place.findMany({ where: { kind: "CHECKIN", published: true, slug: { not: null } }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  const pts = rows.filter((p) => p.lat != null && p.lng != null).map((p) => ({ id: p.id, lat: p.lat!, lng: p.lng! }));
  const roads = await cachedRoads(centerPt(), pts).catch(() => ({}) as Record<string, Road>);
  return rows.filter((p): p is Place & { slug: string } => !!p.slug).map((p) => ({ ...p, road: roads[p.id] ?? null }));
}

export interface NearHome {
  slug: string;
  title: string;
  area: string | null;
  cover: string | null;
  road: Road;
}
export interface NearSpot {
  slug: string;
  name: string;
  area: string;
  cover: string | null;
  road: Road;
}

/** Homestay đang hiện gần điểm nhất theo QUÃNG ĐƯỜNG XE CHẠY (bảng RoadDistance: homestay → điểm, popup "Xung quanh có gì?"). */
export async function nearestHomes(p: Place, take = 4): Promise<NearHome[]> {
  if (p.lat == null || p.lng == null) return [];
  const homes = await prisma.service.findMany({
    where: { published: true, category: { in: ["HOMESTAY", "BUNGALOW"] }, lat: { not: null }, lng: { not: null } },
    select: { id: true, slug: true, title: true, area: true, lat: true, lng: true, images: { orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }], take: 3, select: { url: true } } },
  });
  if (!homes.length) return [];
  const rows = await prisma.roadDistance.findMany({ where: { placeId: p.id, serviceId: { in: homes.map((h) => h.id) } }, select: { serviceId: true, sig: true, km: true, minutes: true } });
  const byId = new Map(homes.map((h) => [h.id, h]));
  return rows
    .flatMap((r) => {
      const h = byId.get(r.serviceId);
      // chữ ký toạ độ khớp ⇒ số còn đúng với vị trí hiện tại của cả hai bên
      if (!h || r.sig !== `${h.lat},${h.lng}>${p.lat},${p.lng}`) return [];
      return [{ slug: h.slug, title: h.title, area: h.area, cover: h.images.map((i) => i.url).find((u) => !isVideoUrl(u)) ?? null, road: { km: r.km, min: r.minutes } }];
    })
    .sort((a, b) => a.road.km - b.road.km)
    .slice(0, take);
}

/** Điểm check-in khác gần nhất theo quãng đường xe chạy (cache điểm → điểm). */
export async function nearestSpots(p: Place, take = 4): Promise<NearSpot[]> {
  if (p.lat == null || p.lng == null) return [];
  const others = await prisma.place.findMany({
    where: { kind: "CHECKIN", published: true, slug: { not: null }, id: { not: p.id }, lat: { not: null }, lng: { not: null } },
    select: { id: true, slug: true, name: true, area: true, lat: true, lng: true, coverImage: true, images: true },
  });
  const roads = await cachedRoads({ id: p.id, lat: p.lat, lng: p.lng }, others.map((o) => ({ id: o.id, lat: o.lat!, lng: o.lng! })));
  return others
    .flatMap((o) => (roads[o.id] ? [{ slug: o.slug!, name: o.name, area: o.area, cover: placeImages(o)[0] ?? null, road: roads[o.id] }] : []))
    .sort((a, b) => a.road.km - b.road.km)
    .slice(0, take);
}

/** Bỏ dấu + thường hoá để so tên. */
const fold = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/**
 * Bài kinh nghiệm ĐANG ĐĂNG liên quan: slug / tiêu đề chứa tên điểm (hoặc slug điểm), rồi bài nhắc tới khu
 * (trừ "Trung tâm" quá chung), cuối cùng là bài bản đồ check-in / săn mây nếu có. Chỉ trả URL có thật.
 */
export async function relatedArticles(p: Place, take = 5): Promise<{ slug: string; title: string }[]> {
  const arts = await prisma.article.findMany({ where: { published: true }, select: { slug: true, title: true }, orderBy: { updatedAt: "desc" } });
  const name = fold(tidy(p.name).replace(/\(.*?\)/g, " ")).replace(/\bta xua\b/g, " ").replace(/\s+/g, " ").trim();
  const core = (p.slug ?? "").replace(/-?ta-xua-?/g, "-").replace(/^-|-$/g, "");
  const area = fold(p.area ?? "");
  const has = (hay: string, needle: string) => needle.length >= 4 && ` ${hay} `.includes(` ${needle} `);
  const score = (a: { slug: string; title: string }) => {
    const t = fold(a.title);
    const s = a.slug.replace(/-/g, " ");
    if (has(t, name) || has(s, name) || (core.length >= 4 && has(s, core.replace(/-/g, " ")))) return 3;
    if (area && area !== "trung tam" && (has(t, area) || has(s, area))) return 2;
    if (["ban-do-du-lich-ta-xua-diem-check-in", "kinh-nghiem-san-may-ta-xua", "san-may-ta-xua-cung-nao"].includes(a.slug)) return 1;
    return 0;
  };
  return arts
    .map((a) => ({ a, s: score(a) }))
    .filter((x) => x.s > 0)
    .sort((x, y) => y.s - x.s)
    .slice(0, take)
    .map((x) => x.a);
}

/** "13,4 km" (vi) / "13.4 km" (ngôn ngữ khác). */
export function fmtKm(km: number, locale: string): string {
  const v = Math.round(km * 10) / 10;
  return locale === "vi" ? String(v).replace(".", ",") : String(v);
}
