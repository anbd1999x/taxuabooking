import "server-only";
import type { AvailabilityStatus, CabinDirection, CabinTrip, Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { parseDateOnly, toDateKey, today, isValidDateKey } from "./dates";
import { toNumber } from "./format";

/**
 * LỊCH CABIN "LUÔN MỞ BÁN":
 * - Nhà xe KHÔNG cần tạo chuyến trước. Ngày nào chưa có `CabinTrip` ⇒ coi như chuyến
 *   ẢO đang mở bán, luôn còn chỗ (giờ/giá/điểm đón lấy theo chuyến gần nhất cùng chiều,
 *   thiếu thì theo lộ trình).
 * - Chuyến THẬT chỉ được tạo khi có đơn đặt (để gắn `cabinTripId`) hoặc khi admin chỉnh ngày đó.
 * - Ngày HẾT VÉ = chuyến có `status = SOLD_OUT` (admin đánh dấu) ⇒ bị loại khỏi tìm kiếm
 *   cabin & combo, không nhận đặt. Số chỗ (`seatsAvailable`) chỉ để thống kê, KHÔNG chặn đặt.
 */

/** Id chuyến ảo: `v~<serviceId>~<OUTBOUND|RETURN>~<yyyy-mm-dd>` (cuid không chứa "~"). */
const VPREFIX = "v~";
/** Số chỗ hiển thị cho chuyến đang mở bán (không giới hạn trên thực tế). */
export const OPEN_SEATS = 99;
const DEFAULT_TIME: Record<CabinDirection, string> = { OUTBOUND: "21:00", RETURN: "12:00" };
const DEFAULT_SEATS = 22;

export function virtualTripId(serviceId: string, direction: CabinDirection, dateKey: string): string {
  return `${VPREFIX}${serviceId}~${direction}~${dateKey}`;
}

export function parseVirtualTripId(
  id: string,
): { serviceId: string; direction: CabinDirection; dateKey: string } | null {
  if (!id.startsWith(VPREFIX)) return null;
  const [serviceId, direction, dateKey] = id.slice(VPREFIX.length).split("~");
  if (!serviceId || (direction !== "OUTBOUND" && direction !== "RETURN") || !dateKey || !isValidDateKey(dateKey)) {
    return null;
  }
  return { serviceId, direction, dateKey };
}

/** Ngày bị đánh dấu HẾT VÉ (không bán). Mọi trạng thái khác = đang mở bán. */
export function isTripClosed(t: { status: AvailabilityStatus }): boolean {
  return t.status === "SOLD_OUT";
}

/** Chuyến (thật hoặc ảo) dùng cho tìm kiếm / hiển thị / tính giá. */
export interface TripView {
  id: string;
  virtual: boolean;
  serviceId: string;
  direction: CabinDirection;
  departureDate: Date;
  departureTime: string;
  price: number;
  status: AvailabilityStatus;
  closed: boolean;
  /** Chỗ để HIỂN THỊ / xếp đoàn: đang mở bán = OPEN_SEATS, hết vé = 0. */
  seatsAvailable: number;
  pickupPoint: string;
  dropoffPoint: string;
  route: string;
  operatorName: string;
}

interface TripTemplate {
  operatorName: string;
  route: string;
  departureTime: string;
  pickupPoint: string;
  dropoffPoint: string;
  price: number;
  seatsTotal: number;
}

/** "21:00 hằng tối" → "21:00". */
function timeIn(s: string | null | undefined): string | null {
  const m = s?.match(/(\d{1,2})[:h](\d{2})/);
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : null;
}

/** Mẫu chuyến cho mỗi nhà xe theo chiều: chuyến gần nhất (mọi ngày), thiếu thì theo lộ trình. */
async function templatesFor(
  serviceIds: string[],
  direction: CabinDirection,
  db: Prisma.TransactionClient = prisma,
): Promise<Map<string, TripTemplate>> {
  const out = new Map<string, TripTemplate>();
  if (serviceIds.length === 0) return out;
  const [latest, services] = await Promise.all([
    db.cabinTrip.findMany({
      where: { serviceId: { in: serviceIds }, direction },
      orderBy: [{ departureDate: "desc" }, { departureTime: "asc" }],
      distinct: ["serviceId"],
    }),
    db.service.findMany({
      where: { id: { in: serviceIds } },
      select: {
        id: true,
        title: true,
        area: true,
        cabinRoutes: { where: { direction }, include: { stops: { orderBy: { sortOrder: "asc" }, take: 1 } } },
      },
    }),
  ]);
  const byService = new Map(latest.map((t) => [t.serviceId, t]));
  for (const s of services) {
    const ref = byService.get(s.id);
    const route = s.cabinRoutes[0];
    const routeLabel = route?.fromPoint && route?.toPoint ? `${route.fromPoint} → ${route.toPoint}` : null;
    out.set(s.id, {
      operatorName: ref?.operatorName ?? s.title,
      route: ref?.route ?? routeLabel ?? s.area ?? (direction === "RETURN" ? "Tà Xùa → Hà Nội" : "Hà Nội → Tà Xùa"),
      departureTime:
        ref?.departureTime ?? timeIn(route?.startInfo) ?? timeIn(route?.stops[0]?.time) ?? DEFAULT_TIME[direction],
      pickupPoint: ref?.pickupPoint ?? route?.fromPoint ?? "",
      dropoffPoint: ref?.dropoffPoint ?? route?.toPoint ?? "",
      price: toNumber(ref?.price) ?? 0,
      seatsTotal: ref?.seatsTotal || DEFAULT_SEATS,
    });
  }
  return out;
}

function realView(t: CabinTrip): TripView {
  const closed = isTripClosed(t);
  return {
    id: t.id,
    virtual: false,
    serviceId: t.serviceId,
    direction: t.direction,
    departureDate: t.departureDate,
    departureTime: t.departureTime,
    price: toNumber(t.price) ?? 0,
    status: closed ? "SOLD_OUT" : "AVAILABLE",
    closed,
    seatsAvailable: closed ? 0 : OPEN_SEATS,
    pickupPoint: t.pickupPoint,
    dropoffPoint: t.dropoffPoint,
    route: t.route,
    operatorName: t.operatorName,
  };
}

function virtualView(serviceId: string, direction: CabinDirection, date: Date, tpl: TripTemplate): TripView {
  return {
    id: virtualTripId(serviceId, direction, toDateKey(date)),
    virtual: true,
    serviceId,
    direction,
    departureDate: date,
    departureTime: tpl.departureTime,
    price: tpl.price,
    status: "AVAILABLE",
    closed: false,
    seatsAvailable: OPEN_SEATS,
    pickupPoint: tpl.pickupPoint,
    dropoffPoint: tpl.dropoffPoint,
    route: tpl.route,
    operatorName: tpl.operatorName,
  };
}

/** Chuyến của NHIỀU nhà xe trong MỘT ngày + chiều: chuyến thật (sớm nhất) hoặc chuyến ảo. */
export async function tripsOnDate(
  serviceIds: string[],
  direction: CabinDirection,
  date: Date,
): Promise<Map<string, TripView>> {
  const out = new Map<string, TripView>();
  if (serviceIds.length === 0) return out;
  const real = await prisma.cabinTrip.findMany({
    where: { serviceId: { in: serviceIds }, direction, departureDate: date },
    orderBy: { departureTime: "asc" },
  });
  for (const t of real) if (!out.has(t.serviceId)) out.set(t.serviceId, realView(t));
  const missing = serviceIds.filter((id) => !out.has(id));
  if (missing.length) {
    const tpls = await templatesFor(missing, direction);
    for (const id of missing) {
      const tpl = tpls.get(id);
      if (tpl) out.set(id, virtualView(id, direction, date, tpl));
    }
  }
  return out;
}

/** Chuyến của MỘT nhà xe cho nhiều ngày liên tiếp (dải ngày đặt vé): dateKey → chuyến. */
export async function tripsForDays(
  serviceId: string,
  direction: CabinDirection,
  days: Date[],
): Promise<Map<string, TripView>> {
  const out = new Map<string, TripView>();
  if (days.length === 0) return out;
  const real = await prisma.cabinTrip.findMany({
    where: { serviceId, direction, departureDate: { gte: days[0], lte: days[days.length - 1] } },
    orderBy: [{ departureDate: "asc" }, { departureTime: "asc" }],
  });
  for (const t of real) {
    const k = toDateKey(t.departureDate);
    if (!out.has(k)) out.set(k, realView(t));
  }
  const tpl = (await templatesFor([serviceId], direction)).get(serviceId);
  if (tpl) {
    for (const d of days) {
      const k = toDateKey(d);
      if (!out.has(k)) out.set(k, virtualView(serviceId, direction, d, tpl));
    }
  }
  return out;
}

/** Xem chuyến theo id (thật hoặc ảo) — KHÔNG tạo gì trong DB. null = id không hợp lệ. */
export async function peekTrip(id: string): Promise<TripView | null> {
  const v = parseVirtualTripId(id);
  if (!v) {
    const t = await prisma.cabinTrip.findUnique({ where: { id } });
    return t ? realView(t) : null;
  }
  const date = parseDateOnly(v.dateKey);
  return (await tripsOnDate([v.serviceId], v.direction, date)).get(v.serviceId) ?? null;
}

/**
 * Lấy chuyến THẬT theo id; id ảo ⇒ tạo chuyến thật cho ngày đó từ mẫu (hoặc dùng chuyến
 * thật đã có trong ngày). Gọi khi GHI đơn / admin chỉnh ngày. null = id không hợp lệ.
 */
export async function materializeTrip(
  id: string,
  db: Prisma.TransactionClient = prisma,
): Promise<CabinTrip | null> {
  const v = parseVirtualTripId(id);
  if (!v) return db.cabinTrip.findUnique({ where: { id } });
  return ensureTripOnDate(v.serviceId, v.direction, v.dateKey, db);
}

/** Chuyến thật của nhà xe cho ngày + chiều; chưa có thì tạo từ mẫu (đang mở bán). */
export async function ensureTripOnDate(
  serviceId: string,
  direction: CabinDirection,
  dateKey: string,
  db: Prisma.TransactionClient = prisma,
): Promise<CabinTrip | null> {
  const date = parseDateOnly(dateKey);
  const existing = await db.cabinTrip.findFirst({
    where: { serviceId, direction, departureDate: date },
    orderBy: { departureTime: "asc" },
  });
  if (existing) return existing;
  const svc = await db.service.findFirst({ where: { id: serviceId, category: "CABIN" }, select: { id: true } });
  if (!svc) return null;
  const tpl = (await templatesFor([serviceId], direction, db)).get(serviceId);
  if (!tpl) return null;
  return db.cabinTrip.create({
    data: {
      serviceId,
      operatorName: tpl.operatorName,
      route: tpl.route,
      direction,
      departureDate: date,
      departureTime: tpl.departureTime,
      pickupPoint: tpl.pickupPoint,
      dropoffPoint: tpl.dropoffPoint,
      price: tpl.price,
      seatsTotal: tpl.seatsTotal,
      seatsAvailable: tpl.seatsTotal,
      status: "AVAILABLE",
    },
  });
}

/** Ngày đã qua (theo giờ VN/UTC date của hệ thống) — không nhận đặt. */
export function isPastDate(d: Date): boolean {
  return d < today();
}
