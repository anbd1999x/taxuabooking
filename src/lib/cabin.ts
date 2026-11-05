import "server-only";
import { unstable_cache } from "next/cache";
import type { AvailabilityStatus, CabinDirection, Prisma, ServiceCategory } from "@prisma/client";
import { prisma } from "./prisma";
import { parseDateOnly, toDateKey, addDays, today } from "./dates";
import { toNumber } from "./format";
import { generateBookingCode } from "./utils";
import { resolveCommission } from "./commission";
import { hasOriginFare, legFareFor, roundTripFareFor, type FareRow } from "./combo";
import { cabinSeatTotal } from "./combo-pricing";
import type { CabinBookingInput } from "./validation";

const WD = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const LOW_THRESHOLD = 5;
/** Điểm đón mặc định khi khách không chọn (khớp mặc định của ô tìm kiếm). */
const DEFAULT_PICKUP = "Hà Nội";

export type DayState = "ok" | "low" | "full" | "unk";

export interface CabinTripAvail {
  id: string;
  dateKey: string;
  departureTime: string;
  status: AvailabilityStatus;
  priceSingle: number;
  singleAvailable: number;
  priceDouble: number | null;
  doubleAvailable: number;
  pickupPoint: string;
  dropoffPoint: string;
}

export interface CabinDay {
  key: string; // yyyy-mm-dd
  wd: string; // T5
  dd: string; // 05/11
  state: DayState;
  trip: CabinTripAvail | null;
}

export interface CabinDirectionOptions {
  direction: CabinDirection;
  days: CabinDay[];
  /** index ngày được chọn ban đầu trong days */
  pickIndex: number;
}

function tripToAvail(t: {
  id: string;
  departureDate: Date;
  departureTime: string;
  status: AvailabilityStatus;
  price: Prisma.Decimal | number;
  seatsAvailable: number;
  priceDouble: Prisma.Decimal | number | null;
  seatsDoubleAvailable: number;
  pickupPoint: string;
  dropoffPoint: string;
}): CabinTripAvail {
  return {
    id: t.id,
    dateKey: toDateKey(t.departureDate),
    departureTime: t.departureTime,
    status: t.status,
    priceSingle: toNumber(t.price) ?? 0,
    singleAvailable: t.seatsAvailable,
    priceDouble: toNumber(t.priceDouble),
    doubleAvailable: t.seatsDoubleAvailable,
    pickupPoint: t.pickupPoint,
    dropoffPoint: t.dropoffPoint,
  };
}

function dayState(trip: CabinTripAvail | null): DayState {
  if (!trip) return "unk";
  if (trip.status === "SOLD_OUT") return "full";
  if (trip.status === "NOT_UPDATED" || trip.status === "PENDING_CONFIRM") return "unk";
  const free = trip.singleAvailable + trip.doubleAvailable;
  if (free <= 0) return "full";
  if (trip.status === "LIMITED" || free <= LOW_THRESHOLD) return "low";
  return "ok";
}

function label(d: Date) {
  return {
    key: toDateKey(d),
    wd: WD[d.getUTCDay()],
    dd: `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`,
  };
}

/**
 * Dải 7 ngày cho một chiều, bắt đầu từ ngày neo (anchorKey) hoặc hôm nay.
 * Mỗi ngày kèm chuyến (nếu có) để widget đổi ngày không cần gọi lại server.
 */
async function buildDirectionOptionsImpl(
  serviceId: string,
  direction: CabinDirection,
  anchorKey: string | null,
  span = 7,
): Promise<CabinDirectionOptions> {
  const anchor = anchorKey ? parseDateOnly(anchorKey) : today();
  const days: Date[] = Array.from({ length: span }, (_, i) => addDays(anchor, i));
  const first = days[0];
  const last = days[days.length - 1];

  const trips = await prisma.cabinTrip.findMany({
    where: { serviceId, direction, departureDate: { gte: first, lte: last } },
    orderBy: [{ departureDate: "asc" }, { departureTime: "asc" }],
  });
  // Mỗi ngày lấy chuyến đầu tiên (một chuyến/đêm theo mô hình hiện tại).
  const byDay = new Map<string, CabinTripAvail>();
  for (const t of trips) {
    const key = toDateKey(t.departureDate);
    if (!byDay.has(key)) byDay.set(key, tripToAvail(t));
  }

  const out: CabinDay[] = days.map((d) => {
    const l = label(d);
    const trip = byDay.get(l.key) ?? null;
    return { key: l.key, wd: l.wd, dd: l.dd, state: dayState(trip), trip };
  });

  return { direction, days: out, pickIndex: 0 };
}
/** Cache 30s — hiển thị dải ngày có thể trễ chút; lúc GỬI ĐƠN luôn tính lại trực tiếp. */
export const buildDirectionOptions = unstable_cache(buildDirectionOptionsImpl, ["cabin-direction-options"], { revalidate: 30 });

export interface CabinOperatorCard {
  id: string;
  slug: string;
  title: string;
  area: string | null;
  coverImage: string | null;
  outbound: CabinTripAvail | null;
  ret: CabinTripAvail | null;
  fromPrice: number | null;
  state: DayState;
}

/**
 * Danh sách nhà xe cabin theo ngày đi và/hoặc ngày về.
 * - Chỉ ngày đi  → nhà xe có chuyến CHIỀU ĐI ngày đó.
 * - Chỉ ngày về  → nhà xe có chuyến CHIỀU VỀ ngày đó.
 * - Cả hai       → nhà xe có cả chiều đi (ngày đi) lẫn chiều về (ngày về).
 * `pickup` = điểm đón của khách: giá "từ" lấy theo bảng giá chặng (`CabinPriceRow`,
 * bảng riêng của nhà xe, thiếu thì bảng chung — như combo); nhà xe có bảng giá
 * nhưng không khai chặng đó bị ẩn. Không chọn (Hà Nội mặc định) → giá chuyến.
 */
async function getCabinOperatorsImpl(
  fromKey: string | null,
  toKey: string | null,
  pickup: string | null = null,
): Promise<CabinOperatorCard[]> {
  const from = fromKey ? parseDateOnly(fromKey) : null;
  const to = toKey ? parseDateOnly(toKey) : null;
  const origin = pickup?.trim() || null;
  // Bảng giá chung (serviceId=null) cho nhà xe chưa có bảng giá riêng.
  const generalRows: FareRow[] = await prisma.cabinPriceRow.findMany({ where: { serviceId: null } });

  // Mặc định (chưa chọn ngày): hiện TẤT CẢ nhà xe cabin. Giá "từ" = vé đơn rẻ nhất
  // trong các chuyến sắp tới; chọn ngày để xem giờ chạy & chỗ trống chính xác.
  if (!from && !to) {
    const svcs = await prisma.service.findMany({
      where: { category: "CABIN", published: true },
      orderBy: [{ featured: "desc" }, { title: "asc" }],
      include: {
        images: { orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }], take: 1 },
        cabinTrips: { where: { direction: "OUTBOUND", departureDate: { gte: today() } }, orderBy: { price: "asc" }, take: 1 },
        cabinPriceRows: true,
      },
    });
    return svcs.flatMap((s): CabinOperatorCard[] => {
      let fromPrice = s.cabinTrips[0] ? toNumber(s.cabinTrips[0].price) : null;
      const rows: FareRow[] = s.cabinPriceRows.length ? s.cabinPriceRows : generalRows;
      if (rows.length) {
        // Giá chặng 1 chiều/khách theo điểm đón (mặc định Hà Nội) — khớp giá lúc đặt.
        if (origin && !hasOriginFare(rows, origin)) return []; // bảng giá không khai điểm đón này
        fromPrice = legFareFor(rows, origin ?? DEFAULT_PICKUP, "OUTBOUND");
      }
      return [{
        id: s.id,
        slug: s.slug,
        title: s.title,
        area: s.area,
        coverImage: s.images[0]?.url ?? null,
        outbound: null,
        ret: null,
        fromPrice,
        state: "unk",
      }];
    });
  }

  const or: Prisma.CabinTripWhereInput[] = [];
  if (from) or.push({ direction: "OUTBOUND", departureDate: from });
  if (to) or.push({ direction: "RETURN", departureDate: to });

  const services = await prisma.service.findMany({
    where: { category: "CABIN", published: true },
    orderBy: [{ featured: "desc" }, { title: "asc" }],
    include: {
      images: { orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }], take: 1 },
      cabinTrips: { where: { OR: or } },
      cabinPriceRows: true,
    },
  });

  const cards: CabinOperatorCard[] = [];
  for (const s of services) {
    const outTrip = from ? s.cabinTrips.find((t) => t.direction === "OUTBOUND") ?? null : null;
    const retTrip = to ? s.cabinTrips.find((t) => t.direction === "RETURN") ?? null : null;
    // Chỉ giữ nhà xe có đủ (các) chiều đang tìm.
    if (from && !outTrip) continue;
    if (to && !retTrip) continue;
    const outbound = outTrip ? tripToAvail(outTrip) : null;
    const ret = retTrip ? tripToAvail(retTrip) : null;

    // Giá "từ"/khách cho hành trình đang tìm: khứ hồi = đi + về, một chiều = chiều đó.
    let fromPrice: number | null = null;
    const rows: FareRow[] = s.cabinPriceRows.length ? s.cabinPriceRows : generalRows;
    if (origin && rows.length) {
      if (!hasOriginFare(rows, origin)) continue; // nhà xe không đón ở điểm này
      fromPrice =
        outbound && ret
          ? roundTripFareFor(rows, origin)
          : legFareFor(rows, origin, outbound ? "OUTBOUND" : "RETURN");
      // null = có đón nhưng bảng chưa khai giá cho (các) chiều này → thẻ hiện "Liên hệ xác nhận giá".
    } else {
      // Không chọn điểm đón (Hà Nội mặc định): ưu tiên bảng giá chặng dòng Hà Nội
      // (giá khứ hồi niêm yết thường rẻ hơn cộng 2 chiều); thiếu thì giá chuyến.
      const legs = [outbound?.priceSingle, ret?.priceSingle].filter(
        (x): x is number => typeof x === "number" && x > 0,
      );
      const need = (outbound ? 1 : 0) + (ret ? 1 : 0);
      const tripFare = need > 0 && legs.length === need ? legs.reduce((a, b) => a + b, 0) : null;
      const tableFare = rows.length
        ? outbound && ret
          ? roundTripFareFor(rows, DEFAULT_PICKUP)
          : legFareFor(rows, DEFAULT_PICKUP, outbound ? "OUTBOUND" : "RETURN")
        : null;
      // Có bảng giá chặng thì CHỈ theo bảng (khớp giá lúc đặt); chưa có bảng mới dùng giá chuyến.
      fromPrice = rows.length ? tableFare : tripFare;
    }

    // Chiều "chính" để xếp hạng còn chỗ: ưu tiên chiều đi, nếu chỉ tìm chiều về thì theo chiều về.
    const primary = outbound ?? ret;
    cards.push({
      id: s.id,
      slug: s.slug,
      title: s.title,
      area: s.area,
      coverImage: s.images[0]?.url ?? null,
      outbound,
      ret,
      fromPrice,
      state: dayState(primary),
    });
  }

  // Sắp xếp: còn chỗ trước, chưa cập nhật/hết chỗ sau.
  const rank: Record<DayState, number> = { ok: 0, low: 1, unk: 2, full: 3 };
  return cards.sort((a, b) => rank[a.state] - rank[b.state]);
}
/* ===================== Giá chặng (dùng chung hiển thị + đặt vé) ===================== */

/** Bảng giá chặng áp cho nhà xe: bảng riêng nếu có, không thì bảng chung (serviceId=null). */
async function fareRowsFor(serviceId: string): Promise<FareRow[]> {
  const rows = await prisma.cabinPriceRow.findMany({
    where: { OR: [{ serviceId }, { serviceId: null }] },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  const own = rows.filter((r) => r.serviceId === serviceId);
  return own.length ? own : rows.filter((r) => r.serviceId === null);
}

/** Giá chặng MỖI KHÁCH (nằm chung) cho hành trình: khứ hồi hoặc chiều đi. */
function journeyFare(rows: FareRow[], origin: string, roundTrip: boolean): number | null {
  return roundTrip ? roundTripFareFor(rows, origin) : legFareFor(rows, origin, "OUTBOUND");
}

export interface CabinFareOption {
  origin: string;
  /** Giá MỖI KHÁCH khi nằm chung (buồng = 2 × fare). */
  fare: number;
}

/**
 * Danh sách điểm xuất phát + giá chặng/khách cho widget đặt vé của một nhà xe.
 * hasTable = false: nhà xe chưa có bảng giá chặng → widget dùng giá chuyến làm dự phòng.
 */
export async function getCabinFareOptions(
  serviceId: string,
  roundTrip: boolean,
): Promise<{ hasTable: boolean; options: CabinFareOption[] }> {
  const rows = await fareRowsFor(serviceId);
  if (!rows.length) return { hasTable: false, options: [] };
  const seen = new Set<string>();
  const options: CabinFareOption[] = [];
  for (const r of rows) {
    // Điểm xuất phát của khách: dòng "Chiều về" có thể nhập "Tà Xùa → <tỉnh>".
    const places = r.ticketType === "RETURN" ? [r.destination, r.pickupPoint] : [r.pickupPoint];
    for (const place of places) {
      const name = place?.trim();
      if (!name || name.toLowerCase() === "tà xùa" || seen.has(name.toLowerCase())) continue;
      const fare = journeyFare(rows, name, roundTrip);
      if (fare == null) continue; // chặng chưa khai đủ giá cho hành trình này
      seen.add(name.toLowerCase());
      options.push({ origin: name, fare });
    }
  }
  return { hasTable: true, options };
}

/** Cache 30s theo cặp ngày tìm — giảm tải khi nhiều khách tìm cùng ngày. */
export const getCabinOperators = unstable_cache(getCabinOperatorsImpl, ["cabin-operators"], { revalidate: 30 });

export interface CreateCabinBookingResult {
  code: string;
  needsConfirmation: boolean;
}

function fmt(n: number) {
  return new Intl.NumberFormat("vi-VN").format(n) + "đ";
}

/**
 * Tạo yêu cầu đặt xe cabin (khứ hồi, vé đơn/đôi). Giá & tình trạng TÍNH LẠI
 * phía server; bỏ qua mọi giá gửi từ client. Một yêu cầu gồm cả chiều đi + về.
 */
export async function createCabinBooking(
  input: CabinBookingInput,
  ctvId?: string | null,
): Promise<CreateCabinBookingResult> {
  const service = await prisma.service.findFirst({
    where: { id: input.serviceId, published: true, category: "CABIN" },
  });
  if (!service) throw new Error("Nhà xe không tồn tại.");

  const outbound = await prisma.cabinTrip.findFirst({
    where: { id: input.outboundTripId, serviceId: service.id, direction: "OUTBOUND" },
  });
  if (!outbound) throw new Error("Chuyến đi không hợp lệ.");

  const ret = input.returnTripId
    ? await prisma.cabinTrip.findFirst({
        where: { id: input.returnTripId, serviceId: service.id, direction: "RETURN" },
      })
    : null;
  if (input.returnTripId && !ret) throw new Error("Chuyến về không hợp lệ.");

  // Tính THEO NGƯỜI: shared = số khách NẰM GHÉP (đi lẻ thì nhà xe xếp ghép với khách khác),
  // solo = số khách NẰM RIÊNG (bao trọn buồng). Tổng = số khách.
  const shared = input.shared;
  const solo = input.solo;
  const people = shared + solo;
  if (people < 1) throw new Error("Vui lòng chọn ít nhất 1 khách.");
  if (input.people != null && input.people !== people) {
    throw new Error(`Đã xếp ${people}/${input.people} khách — vui lòng xếp đủ chỗ nằm cho cả đoàn.`);
  }

  // Ngày: không đặt chuyến đã chạy; chiều về không được trước chiều đi.
  if (outbound.departureDate < today()) throw new Error("Chuyến đi đã qua ngày khởi hành.");
  if (ret && ret.departureDate < outbound.departureDate) {
    throw new Error("Ngày về phải cùng hoặc sau ngày đi.");
  }

  // Giá chặng MỖI KHÁCH (server-authoritative): theo bảng giá chặng của nhà xe (thiếu thì
  // bảng chung) và điểm xuất phát; khứ hồi ưu tiên dòng "Khứ hồi", không có thì đi + về.
  // Nhà xe chưa có bảng giá chặng → dự phòng bằng giá chuyến (đi + về).
  const origin = input.origin?.trim() || DEFAULT_PICKUP;
  const rows = await fareRowsFor(service.id);
  // Thiếu giá (bảng chưa khai chặng/chiều này, hoặc chuyến chưa có giá) → vẫn nhận yêu cầu
  // nhưng KHÔNG tự đặt giá: referencePrice = null, nhà xe/sàn báo giá khi gọi xác nhận.
  let fare: number | null;
  if (rows.length) {
    fare = journeyFare(rows, origin, Boolean(ret));
  } else {
    const legs = [outbound, ...(ret ? [ret] : [])].map((t) => toNumber(t.price) ?? 0);
    fare = legs.every((p) => p > 0) ? legs.reduce((a, b) => a + b, 0) : null;
  }
  // Nằm ghép: mỗi người 1 vé; nằm riêng: mỗi người 2 × giá vé.
  const total = fare == null ? null : cabinSeatTotal(fare, shared, solo);

  // Chỗ trên xe tính theo SỐ KHÁCH ở kho vé thường (giống combo & "+ Thêm vé" của admin).
  const legNeedsConfirm = (t: typeof outbound) =>
    t.status === "NOT_UPDATED" ||
    t.status === "PENDING_CONFIRM" ||
    t.status === "SOLD_OUT" ||
    people > t.seatsAvailable;
  const needsConfirmation = fare == null || legNeedsConfirm(outbound) || (ret ? legNeedsConfirm(ret) : false);

  const tickets = [
    shared ? `${shared} khách nằm ghép (cabin đôi)` : null,
    solo ? `${solo} khách nằm riêng (cabin đơn, ×2 giá)` : null,
  ]
    .filter(Boolean)
    .join(" + ") + ` · ${people} khách`;
  const fareText =
    fare == null
      ? `chờ báo giá (${ret ? "khứ hồi" : "1 chiều"} từ ${origin})`
      : `${fmt(fare)}/khách ${ret ? "khứ hồi" : "1 chiều"} từ ${origin}`;
  const selectionLabel = ret
    ? `Khứ hồi · ${tickets} · ${fareText} · đi ${toDateKey(outbound.departureDate)} ${outbound.departureTime}, về ${toDateKey(ret.departureDate)} ${ret.departureTime}`
    : `Một chiều · ${tickets} · ${fareText} · ${toDateKey(outbound.departureDate)} ${outbound.departureTime}`;

  const noteParts = [
    input.note?.trim() || null,
    input.pickup ? `Đón: ${input.pickup}` : null,
    input.drop ? `Trả: ${input.drop}` : null,
    total == null ? "Chờ báo giá" : `Tạm tính: ${fmt(total)}`,
  ].filter(Boolean);

  let code = generateBookingCode();
  for (let i = 0; i < 5; i++) {
    const exists = await prisma.bookingRequest.findUnique({ where: { code } });
    if (!exists) break;
    code = generateBookingCode();
  }

  await prisma.bookingRequest.create({
    data: {
      code,
      category: service.category as ServiceCategory,
      serviceId: service.id,
      serviceTitle: service.title,
      customerName: input.customerName,
      phone: input.phone,
      note: noteParts.join(" · ") || null,
      useDate: outbound.departureDate,
      endDate: ret ? ret.departureDate : null,
      // Giữ chỗ khi xác nhận: trừ ĐÚNG số khách ở kho vé thường (cả đi lẫn về).
      // Cách nằm chung/riêng đã ghi trong selectionLabel cho nhà xe.
      quantity: people,
      seatsSingle: people,
      seatsDouble: 0,
      cabinTripId: outbound.id,
      cabinReturnTripId: ret?.id ?? null,
      selectionLabel,
      referencePrice: total,
      needsConfirmation,
      ctvId: ctvId ?? null,
      commissionAmount: await resolveCommission(service.id, ctvId),
    },
  });

  return { code, needsConfirmation };
}
