import "server-only";
import { unstable_cache } from "next/cache";
import type {
  Prisma,
  ServiceCategory,
  RoomType,
  RoomAvailability,
  RentalVehicle,
  RentalAvailability,
} from "@prisma/client";

type RoomTypeWithAvail = RoomType & { availabilities?: RoomAvailability[] };
type RentalVehicleWithAvail = RentalVehicle & {
  availabilities?: RentalAvailability[];
};
import { prisma } from "./prisma";
import { CATEGORIES } from "./constants";
import {
  aggregateStay,
  roomTypePricing,
  type AvailabilityRecord,
  type StayAvailabilityResult,
} from "./availability";
import {
  enumerateNights,
  enumerateDays,
  parseDateOnly,
  toDateKey,
  addDays,
} from "./dates";
import { toNumber } from "./format";

/**
 * Cache tầng dữ liệu cho trang công khai (TTL ngắn): giảm tải DB khi đông
 * truy cập. Dữ liệu trễ tối đa TTL giây; luồng ĐẶT ĐƠN luôn tính lại trực tiếp
 * (booking.ts / cabin.ts / combo.ts) nên không bị ảnh hưởng bởi cache này.
 * CHÚ Ý: chỉ cache hàm trả dữ liệu thuần (string/number/boolean) — kết quả bị
 * JSON-hoá nên Date/Decimal sẽ mất kiểu.
 */
const TTL = 60; // giây — dữ liệu ít đổi (cài đặt, bảng giá, lộ trình, thẻ dịch vụ)
const TTL_AVAIL = 30; // giây — dữ liệu gắn với tình trạng còn chỗ

async function getSettingsImpl(): Promise<Record<string, string>> {
  const rows = await prisma.siteSetting.findMany();
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}
export const getSettings = unstable_cache(getSettingsImpl, ["settings"], { revalidate: TTL });

export interface ServiceCard {
  id: string;
  slug: string;
  category: ServiceCategory;
  title: string;
  summary: string;
  area: string | null;
  coverImage: string | null;
  images: { url: string; alt: string | null }[];
  basePrice: number | null;
  originalPrice: number | null; // giá gốc gạch ngang (null = không khuyến mãi)
  priceUnit: string | null;
  featured: boolean;
  availability?: AvailabilitySummary;
}

export interface AvailabilitySummary {
  status: StayAvailabilityResult["status"];
  bookable: boolean;
  fromPrice: number | null; // giá thấp nhất khả dụng cho kỳ
  note?: string;
}

function coverOf(images: { url: string; isCover: boolean }[]): string | null {
  if (images.length === 0) return null;
  return (images.find((i) => i.isCover) ?? images[0]).url;
}

export interface ListFilters {
  q?: string;
  from?: string; // yyyy-mm-dd
  to?: string;
  priceMin?: number;
  priceMax?: number;
}

/** Danh sách dịch vụ theo danh mục + lọc + (tuỳ chọn) tính tình trạng theo ngày. */
export async function listServicesByCategory(
  category: ServiceCategory,
  filters: ListFilters = {},
): Promise<ServiceCard[]> {
  const kind = CATEGORIES[category].availabilityKind;
  const where: Prisma.ServiceWhereInput = { published: true, category };

  if (filters.q) {
    where.OR = [
      { title: { contains: filters.q, mode: "insensitive" } },
      { summary: { contains: filters.q, mode: "insensitive" } },
      { area: { contains: filters.q, mode: "insensitive" } },
    ];
  }
  if (filters.priceMin != null || filters.priceMax != null) {
    where.basePrice = {};
    if (filters.priceMin != null) where.basePrice.gte = filters.priceMin;
    if (filters.priceMax != null) where.basePrice.lte = filters.priceMax;
  }

  const wantAvailability = Boolean(filters.from);
  const from = filters.from ? parseDateOnly(filters.from) : null;
  const to = filters.to ? parseDateOnly(filters.to) : from ? addDays(from, 1) : null;

  const services = await prisma.service.findMany({
    where,
    orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
    include: {
      images: { orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }], select: { url: true, alt: true, isCover: true } },
      roomTypes:
        wantAvailability && kind === "stay"
          ? {
              include: {
                availabilities:
                  from && to
                    ? { where: { date: { gte: from, lt: to } } }
                    : false,
              },
            }
          : false,
      rentalVehicles:
        wantAvailability && kind === "rental"
          ? {
              include: {
                availabilities:
                  from && to
                    ? { where: { date: { gte: from, lte: to } } }
                    : false,
              },
            }
          : false,
      cabinTrips:
        wantAvailability && kind === "trip" && from
          ? { where: { departureDate: from } }
          : false,
    },
  });

  return services.map((s): ServiceCard => {
    const card: ServiceCard = {
      id: s.id,
      slug: s.slug,
      category: s.category,
      title: s.title,
      summary: s.summary,
      area: s.area,
      coverImage: coverOf(s.images),
      images: s.images.map((i) => ({ url: i.url, alt: i.alt })),
      basePrice: toNumber(s.basePrice),
      originalPrice: toNumber(s.originalPrice),
      priceUnit: s.priceUnit,
      featured: s.featured,
    };

    if (!wantAvailability || !from || !to) return card;

    if (kind === "stay" && "roomTypes" in s && Array.isArray(s.roomTypes)) {
      const nights = enumerateNights(from, to);
      let best: AvailabilitySummary | null = null;
      for (const room of s.roomTypes as RoomTypeWithAvail[]) {
        const records = new Map<string, AvailabilityRecord>();
        for (const a of room.availabilities ?? []) {
          records.set(toDateKey(a.date), {
            status: a.status,
            availableUnits: a.availableRooms,
            priceOverride: toNumber(a.priceOverride),
          });
        }
        const r = aggregateStay({
          days: nights,
          requestedUnits: 1,
          pricing: roomTypePricing(room),
          records,
        });
        const summary: AvailabilitySummary = {
          status: r.status,
          bookable: r.bookable,
          fromPrice: r.totalPricePerUnit,
        };
        best = pickBetter(best, summary);
      }
      card.availability = best ?? {
        status: "NOT_UPDATED",
        bookable: false,
        fromPrice: null,
      };
    } else if (
      kind === "rental" &&
      "rentalVehicles" in s &&
      Array.isArray(s.rentalVehicles)
    ) {
      const days = enumerateDays(from, to);
      let best: AvailabilitySummary | null = null;
      for (const v of s.rentalVehicles as RentalVehicleWithAvail[]) {
        const records = new Map<string, AvailabilityRecord>();
        for (const a of v.availabilities ?? []) {
          records.set(toDateKey(a.date), {
            status: a.status,
            availableUnits: a.availableUnits,
            priceOverride: toNumber(a.priceOverride),
          });
        }
        const price = toNumber(v.pricePerDay)!;
        const r = aggregateStay({
          days,
          requestedUnits: 1,
          pricing: { weekdayPrice: price, weekendPrice: price, holidayPrice: null },
          records,
        });
        best = pickBetter(best, {
          status: r.status,
          bookable: r.bookable,
          fromPrice: r.totalPricePerUnit,
        });
      }
      card.availability = best ?? {
        status: "NOT_UPDATED",
        bookable: false,
        fromPrice: null,
      };
    } else if (kind === "trip" && "cabinTrips" in s && Array.isArray(s.cabinTrips)) {
      const trips = s.cabinTrips;
      if (trips.length === 0) {
        card.availability = { status: "NOT_UPDATED", bookable: false, fromPrice: null };
      } else {
        const bookable = trips.some(
          (t) => t.status !== "SOLD_OUT" && t.status !== "NOT_UPDATED" && t.seatsAvailable > 0,
        );
        const minPrice = Math.min(...trips.map((t) => toNumber(t.price) ?? Infinity));
        card.availability = {
          status: bookable
            ? trips.some((t) => t.seatsAvailable <= 5 && t.seatsAvailable > 0)
              ? "LIMITED"
              : "AVAILABLE"
            : "SOLD_OUT",
          bookable,
          fromPrice: Number.isFinite(minPrice) ? minPrice : null,
        };
      }
    }
    return card;
  });
}

/** Chọn summary "tốt hơn" (ưu tiên bookable, rồi giá thấp hơn). */
function pickBetter(
  a: AvailabilitySummary | null,
  b: AvailabilitySummary,
): AvailabilitySummary {
  if (!a) return b;
  if (a.bookable !== b.bookable) return a.bookable ? a : b;
  const ap = a.fromPrice ?? Infinity;
  const bp = b.fromPrice ?? Infinity;
  return bp < ap ? b : a;
}

/** Dịch vụ nổi bật cho trang chủ. */
async function getFeaturedServicesImpl(limit = 8): Promise<ServiceCard[]> {
  const services = await prisma.service.findMany({
    where: { published: true, featured: true },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { images: { orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }], select: { url: true, alt: true, isCover: true } } },
  });
  return services.map((s) => ({
    id: s.id,
    slug: s.slug,
    category: s.category,
    title: s.title,
    summary: s.summary,
    area: s.area,
    coverImage: coverOf(s.images),
    images: s.images.map((i) => ({ url: i.url, alt: i.alt })),
    basePrice: toNumber(s.basePrice),
    originalPrice: toNumber(s.originalPrice),
    priceUnit: s.priceUnit,
    featured: s.featured,
  }));
}

export const getFeaturedServices = unstable_cache(getFeaturedServicesImpl, ["featured-services"], { revalidate: TTL });

/** Dịch vụ cho lưới "nổi bật" trang chủ — đa danh mục để lọc. */
async function getHomeServicesImpl(limit = 8): Promise<ServiceCard[]> {
  const services = await prisma.service.findMany({
    where: { published: true },
    orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
    take: limit,
    include: { images: { orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }], select: { url: true, alt: true, isCover: true } } },
  });
  return services.map((s) => ({
    id: s.id, slug: s.slug, category: s.category, title: s.title, summary: s.summary,
    area: s.area, coverImage: coverOf(s.images), images: s.images.map((i) => ({ url: i.url, alt: i.alt })),
    basePrice: toNumber(s.basePrice), originalPrice: toNumber(s.originalPrice), priceUnit: s.priceUnit, featured: s.featured,
  }));
}

export const getHomeServices = unstable_cache(getHomeServicesImpl, ["home-services"], { revalidate: TTL });

export interface HomeCabinRoute {
  di: { time: string; place: string; note: string | null }[];
  ve: { time: string; place: string; note: string | null }[];
  startInfo: string;
  pickupInfo: string;
}

/** Lộ trình cabin đại diện cho trang chủ (nhà xe đầu tiên có lộ trình). */
async function getHomeCabinRouteImpl(): Promise<HomeCabinRoute> {
  const svc = await prisma.service.findFirst({
    where: { category: "CABIN", published: true, cabinRoutes: { some: {} } },
    // Ưu tiên nhà xe đang được đánh dấu "nổi bật".
    orderBy: [{ featured: "desc" }, { updatedAt: "desc" }],
    include: { cabinRoutes: { include: { stops: { orderBy: { sortOrder: "asc" } } } } },
  });
  const out = svc?.cabinRoutes.find((r) => r.direction === "OUTBOUND");
  const ret = svc?.cabinRoutes.find((r) => r.direction === "RETURN");
  const map = (stops?: { time: string; place: string; note: string | null }[]) =>
    (stops ?? []).map((s) => ({ time: s.time, place: s.place, note: s.note }));
  return {
    di: map(out?.stops),
    ve: map(ret?.stops),
    startInfo: out?.startInfo || "21:00 hằng tối",
    pickupInfo: out?.fromPoint || "68 Mạc Thái Tổ",
  };
}
export const getHomeCabinRoute = unstable_cache(getHomeCabinRouteImpl, ["home-cabin-route"], { revalidate: TTL });

export async function getServiceDetail(slug: string) {
  return prisma.service.findFirst({
    where: { slug, published: true },
    include: {
      images: { orderBy: { sortOrder: "asc" } },
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
      rentalVehicles: { orderBy: { sortOrder: "asc" } },
      transport: true,
      cabinPriceRows: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
      cabinRoutes: { include: { stops: { orderBy: { sortOrder: "asc" } } }, orderBy: { direction: "asc" } },
    },
  });
}

/** Chi tiết một phòng con (cho trang chi tiết phòng kiểu booking). */
export async function getRoomDetail(slug: string, roomId: string) {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: {
      images: { orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }] },
      roomType: {
        include: {
          images: { orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }] },
          service: true,
        },
      },
    },
  });
  if (!room || room.roomType.service.slug !== slug || !room.roomType.service.published) {
    return null;
  }
  return room;
}

export type HomestayCardStatus = "ok" | "low" | "full" | "none";

/**
 * Thẻ homestay cho trang danh sách. Giá "từ" = giá thấp nhất trong các phòng con.
 * Có ngày nhận/trả → tính tình trạng còn phòng thật trong kỳ (Còn/Còn ít/Hết).
 */
async function getHomestayCardsImpl(fromKey?: string | null, toKey?: string | null) {
  const list = await prisma.service.findMany({
    where: { category: "HOMESTAY", published: true },
    orderBy: [{ featured: "desc" }, { title: "asc" }],
    include: {
      images: { orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }], take: 1 },
      roomTypes: { select: { rooms: { select: { id: true, listPrice: true, salePrice: true } } } },
    },
  });

  const hasDates = Boolean(fromKey && toKey && toKey > fromKey);
  const nights = hasDates ? enumerateNights(parseDateOnly(fromKey!), parseDateOnly(toKey!)) : [];
  const occupied = new Set<string>();
  if (hasDates && nights.length) {
    const roomIds = list.flatMap((s) => s.roomTypes.flatMap((rt) => rt.rooms.map((r) => r.id)));
    if (roomIds.length) {
      const rows = await prisma.roomDayStatus.findMany({
        where: { roomId: { in: roomIds }, date: { in: nights }, status: { not: "AVAILABLE" } },
        select: { roomId: true },
      });
      for (const r of rows) occupied.add(r.roomId); // phòng bị chiếm ít nhất 1 đêm = không bán cả kỳ
    }
  }

  return list.map((s) => {
    const rooms = s.roomTypes.flatMap((rt) => rt.rooms);
    // Giá hiệu lực mỗi phòng + giá niêm yết (để gạch ngang khi phòng rẻ nhất đang giảm giá).
    const priced = rooms
      .map((r) => {
        const list = toNumber(r.listPrice) ?? 0;
        const sale = toNumber(r.salePrice);
        return { eff: sale ?? list, list, onSale: sale != null && list > sale };
      })
      .filter((p) => p.eff > 0);
    const cheapest = priced.length ? priced.reduce((a, b) => (b.eff < a.eff ? b : a)) : null;
    const from = cheapest ? cheapest.eff : toNumber(s.basePrice) ?? 0;
    const fromOld = cheapest?.onSale ? cheapest.list : null;
    const cat = /bungalow/i.test(`${s.title} ${s.area ?? ""}`) ? "Bungalow" : "Homestay";

    let status: HomestayCardStatus = "none";
    let freeRooms = 0;
    if (hasDates) {
      freeRooms = rooms.filter((r) => !occupied.has(r.id)).length;
      status = freeRooms === 0 ? "full" : freeRooms <= 2 ? "low" : "ok";
    }

    return {
      id: s.id,
      slug: s.slug,
      name: s.title,
      area: s.area ?? "Tà Xùa",
      desc: s.summary,
      price: from,
      priceOld: fromOld,
      cover: s.images[0]?.url ?? null,
      featured: s.featured,
      cat,
      status,
      freeRooms,
    };
  });
}

export const getHomestayCards = unstable_cache(getHomestayCardsImpl, ["homestay-cards"], { revalidate: TTL_AVAIL });

async function getCabinPriceRowsImpl() {
  // Hiển thị bảng giá của nhà xe đang được tick "nổi bật"; nếu nhà xe đó chưa có
  // bảng giá riêng (hoặc chưa tick nhà xe nào) thì dùng bảng giá chung (serviceId=null).
  const featured = await prisma.service.findFirst({
    where: { category: "CABIN", published: true, featured: true },
    select: { id: true },
  });
  const order = [{ sortOrder: "asc" as const }, { createdAt: "asc" as const }];
  let rows = await prisma.cabinPriceRow.findMany({
    where: featured ? { serviceId: featured.id } : { serviceId: null },
    orderBy: order,
  });
  if (rows.length === 0 && featured) {
    rows = await prisma.cabinPriceRow.findMany({ where: { serviceId: null }, orderBy: order });
  }
  return rows.map((r) => ({
    id: r.id,
    pickupPoint: r.pickupPoint,
    destination: r.destination,
    price: toNumber(r.price),
    note: r.note,
  }));
}

export const getCabinPriceRows = unstable_cache(getCabinPriceRowsImpl, ["cabin-price-rows"], { revalidate: TTL });

/** Giá "từ..." để hiển thị ô nổi bật cạnh bảng giá cabin (giống thiết kế). */
export async function getPriceHighlights() {
  const [combo, home, bike] = await Promise.all([
    prisma.service.findFirst({
      where: { category: "COMBO", published: true },
      orderBy: { basePrice: "asc" },
      select: { title: true, slug: true, basePrice: true },
    }),
    prisma.roomType.aggregate({
      _min: { weekdayPrice: true },
      where: { service: { category: { in: ["HOMESTAY", "BUNGALOW"] }, published: true } },
    }),
    prisma.rentalVehicle.aggregate({
      _min: { pricePerDay: true },
      where: { service: { category: "MOTORBIKE", published: true } },
    }),
  ]);
  return {
    combo: combo
      ? { title: combo.title, slug: combo.slug, price: toNumber(combo.basePrice) }
      : null,
    homeFrom: toNumber(home._min.weekdayPrice),
    bikeFrom: toNumber(bike._min.pricePerDay),
  };
}

export type PriceHighlights = Awaited<ReturnType<typeof getPriceHighlights>>;

export interface CabinDay {
  dateKey: string;
  weekday: string;
  dayNum: string;
  price: number | null;
  status: import("@prisma/client").AvailabilityStatus;
  count: number;
}
export interface CabinTripLite {
  id: string;
  serviceSlug: string;
  time: string;
  operator: string;
  route: string;
  pickup: string;
  price: number | null;
  seatsAvailable: number;
  status: import("@prisma/client").AvailabilityStatus;
}

const WD = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

/** Dữ liệu 7 ngày tới cho lưới chọn ngày xe cabin (hero 1c). */
export async function getCabinWeek(): Promise<{
  days: CabinDay[];
  tripsByDay: Record<string, CabinTripLite[]>;
  defaultDateKey: string;
}> {
  const start = parseDateOnly(toDateKey(new Date()));
  const end = addDays(start, 6);

  const trips = await prisma.cabinTrip.findMany({
    where: {
      departureDate: { gte: start, lte: end },
      service: { published: true },
    },
    include: { service: { select: { slug: true } } },
    orderBy: [{ departureDate: "asc" }, { departureTime: "asc" }],
  });

  const tripsByDay: Record<string, CabinTripLite[]> = {};
  for (const t of trips) {
    const key = toDateKey(t.departureDate);
    (tripsByDay[key] ??= []).push({
      id: t.id,
      serviceSlug: t.service.slug,
      time: t.departureTime,
      operator: t.operatorName,
      route: t.route,
      pickup: t.pickupPoint,
      price: toNumber(t.price),
      seatsAvailable: t.seatsAvailable,
      status: t.status,
    });
  }

  const days: CabinDay[] = [];
  for (let i = 0; i < 7; i++) {
    const d = addDays(start, i);
    const key = toDateKey(d);
    const dayTrips = tripsByDay[key] ?? [];
    let status: import("@prisma/client").AvailabilityStatus = "NOT_UPDATED";
    let price: number | null = null;
    if (dayTrips.length > 0) {
      const prices = dayTrips.map((t) => t.price).filter((p): p is number => p != null);
      price = prices.length ? Math.min(...prices) : null;
      const available = dayTrips.filter(
        (t) => t.status !== "SOLD_OUT" && t.status !== "NOT_UPDATED" && t.seatsAvailable > 0,
      );
      if (available.length > 0) {
        const seats = available.reduce((s, t) => s + t.seatsAvailable, 0);
        status = seats <= 5 ? "LIMITED" : "AVAILABLE";
      } else if (dayTrips.every((t) => t.status === "NOT_UPDATED")) {
        status = "NOT_UPDATED";
      } else {
        status = "SOLD_OUT";
      }
    }
    days.push({
      dateKey: key,
      weekday: WD[d.getUTCDay()],
      dayNum: key.slice(8, 10),
      price,
      status,
      count: dayTrips.length,
    });
  }

  const defaultDateKey =
    days.find((d) => d.count > 0 && d.status !== "SOLD_OUT")?.dateKey ??
    days.find((d) => d.count > 0)?.dateKey ??
    days[0].dateKey;

  return { days, tripsByDay, defaultDateKey };
}

export async function getArticles(limit?: number) {
  return prisma.article.findMany({
    where: { published: true },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function getArticle(slug: string) {
  return prisma.article.findFirst({ where: { slug, published: true } });
}

export interface RentalBikeCard {
  id: string;
  serviceSlug: string;
  shopTitle: string;
  name: string;
  image: string | null;
  pricePerDay: number;
  totalUnits: number;
  deliveryFee: number | null;
  kind: "Xe số" | "Xe côn tay" | "Xe địa hình";
  featured: boolean;
  available: number | null; // theo ngày đã chọn; null = chưa chọn hoặc chưa cập nhật
  state: "ok" | "low" | "full" | "unk";
}

/** Phân loại xe theo tên (best-effort) để lọc & gắn nhãn. */
function bikeKind(name: string): RentalBikeCard["kind"] {
  const n = name.toLowerCase();
  if (/(xr|cào cào|cao cao|địa hình|dia hinh|wr|klx|crf|cross)/.test(n)) return "Xe địa hình";
  if (/(exciter|winner|côn|con tay|cbr|gsx|r15|mt-|sonic|raider|satria|fz)/.test(n)) return "Xe côn tay";
  return "Xe số";
}

/** Danh sách xe máy cho thuê (làm phẳng theo từng loại xe), kèm tồn theo ngày nếu có. */
export async function getRentalBikes(from: string | null, to: string | null): Promise<RentalBikeCard[]> {
  const services = await prisma.service.findMany({
    where: { category: "MOTORBIKE", published: true },
    orderBy: [{ featured: "desc" }, { title: "asc" }],
    include: {
      images: { orderBy: { sortOrder: "asc" }, take: 1 },
      rentalVehicles: { orderBy: { sortOrder: "asc" } },
    },
  });

  let start: Date | null = null;
  let end: Date | null = null;
  let days: Date[] = [];
  if (from) {
    start = parseDateOnly(from);
    end = to ? parseDateOnly(to) : start;
    if (end < start) end = start;
    days = enumerateDays(start, end);
  }

  const vehicleIds = services.flatMap((s) => s.rentalVehicles.map((v) => v.id));
  const availMap = new Map<string, Map<string, number>>();
  if (start && vehicleIds.length) {
    const rows = await prisma.rentalAvailability.findMany({
      where: { rentalVehicleId: { in: vehicleIds }, date: { gte: start, lte: end! } },
      select: { rentalVehicleId: true, date: true, availableUnits: true, status: true },
    });
    for (const r of rows) {
      if (r.status === "NOT_UPDATED") continue;
      let m = availMap.get(r.rentalVehicleId);
      if (!m) availMap.set(r.rentalVehicleId, (m = new Map()));
      m.set(toDateKey(r.date), r.availableUnits);
    }
  }

  const cards: RentalBikeCard[] = [];
  for (const s of services) {
    for (const v of s.rentalVehicles) {
      let available: number | null = null;
      let state: RentalBikeCard["state"] = "unk";
      if (start) {
        const m = availMap.get(v.id);
        let min = Infinity;
        let missing = false;
        for (const d of days) {
          const k = toDateKey(d);
          if (m && m.has(k)) min = Math.min(min, m.get(k)!);
          else missing = true;
        }
        if (missing || min === Infinity) {
          state = "unk";
          available = null;
        } else {
          available = min;
          state = min <= 0 ? "full" : min <= 2 ? "low" : "ok";
        }
      }
      cards.push({
        id: v.id,
        serviceSlug: s.slug,
        shopTitle: s.title,
        name: v.vehicleType,
        image: v.imageUrl ?? s.images[0]?.url ?? null,
        pricePerDay: toNumber(v.pricePerDay) ?? 0,
        totalUnits: v.totalUnits,
        deliveryFee: toNumber(v.deliveryFee),
        kind: bikeKind(v.vehicleType),
        featured: s.featured,
        available,
        state,
      });
    }
  }
  return cards;
}

export interface XeomRoute {
  id: string;
  slug: string;
  title: string;
  from: string;
  to: string;
  desc: string;
  vehicleType: string | null;
  price: number | null; // giá cố định 1 chiều/người; null = liên hệ
  priceNote: string | null;
  kind: "Điểm săn mây" | "Tour nửa ngày" | "Đưa đón bến xe";
  image: string | null;
  featured: boolean;
  driverName: string | null;
  driverPhone: string | null;
  driverBirthYear: number | null;
}

function xeomKind(text: string): XeomRoute["kind"] {
  const n = text.toLowerCase();
  if (/tour/.test(n)) return "Tour nửa ngày";
  if (/(bến|ben |bắc yên|bac yen|đưa đón|dua don|sân bay|san bay|háng đồng|hang dong|trung chuyển|trung chuyen)/.test(n)) return "Đưa đón bến xe";
  return "Điểm săn mây";
}

/** Danh sách tuyến xe ôm (mỗi dịch vụ XEOM = một tuyến). */
export async function getXeomRoutes(): Promise<XeomRoute[]> {
  const services = await prisma.service.findMany({
    where: { category: "XEOM", published: true },
    orderBy: [{ featured: "desc" }, { title: "asc" }],
    include: { transport: true, images: { orderBy: { sortOrder: "asc" }, take: 1 } },
  });
  return services.map((s) => {
    const t = s.transport;
    const from = t?.fromPoint || "Trung tâm xã Tà Xùa";
    const to = t?.toArea || s.title;
    return {
      id: s.id,
      slug: s.slug,
      title: s.title,
      from,
      to,
      desc: s.summary,
      vehicleType: t?.vehicleType ?? null,
      price: toNumber(t?.fixedPrice),
      priceNote: t?.priceNote ?? null,
      kind: xeomKind(`${s.title} ${to}`),
      image: s.images[0]?.url ?? null,
      featured: s.featured,
      driverName: t?.driverName ?? null,
      driverPhone: t?.driverPhone ?? null,
      driverBirthYear: t?.driverBirthYear ?? null,
    };
  });
}

export interface TaxiRoute {
  id: string;
  slug: string;
  title: string;
  from: string;
  to: string;
  desc: string;
  vehicleType: string | null;
  price: number | null; // giá cố định theo chuyến (cả xe); null = liên hệ
  priceNote: string | null;
  kind: "Đưa đón Bắc Yên" | "Đường dài" | "Tham quan";
  image: string | null;
  featured: boolean;
  driverName: string | null;
  driverPhone: string | null;
  driverBirthYear: number | null;
}

function taxiKind(text: string): TaxiRoute["kind"] {
  const n = text.toLowerCase();
  if (/(tour|tham quan|săn mây|san may|check.?in)/.test(n)) return "Tham quan";
  if (/(hà nội|ha noi|mộc châu|moc chau|đường dài|duong dai|sân bay|san bay|phù yên|phu yen|nội bài|noi bai)/.test(n)) return "Đường dài";
  return "Đưa đón Bắc Yên";
}

/** Danh sách tuyến taxi (mỗi dịch vụ TAXI = một tuyến). */
export async function getTaxiRoutes(): Promise<TaxiRoute[]> {
  const services = await prisma.service.findMany({
    where: { category: "TAXI", published: true },
    orderBy: [{ featured: "desc" }, { title: "asc" }],
    include: { transport: true, images: { orderBy: { sortOrder: "asc" }, take: 1 } },
  });
  return services.map((s) => {
    const t = s.transport;
    const from = t?.fromPoint || "Trung tâm Tà Xùa";
    const to = t?.toArea || s.title;
    return {
      id: s.id,
      slug: s.slug,
      title: s.title,
      from,
      to,
      desc: s.summary,
      vehicleType: t?.vehicleType ?? null,
      price: toNumber(t?.fixedPrice),
      priceNote: t?.priceNote ?? null,
      kind: taxiKind(`${s.title} ${to} ${from}`),
      image: s.images[0]?.url ?? null,
      featured: s.featured,
      driverName: t?.driverName ?? null,
      driverPhone: t?.driverPhone ?? null,
      driverBirthYear: t?.driverBirthYear ?? null,
    };
  });
}
