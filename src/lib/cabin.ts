import { dmy } from "@/lib/date-format";
import "server-only";
import { unstable_cache } from "next/cache";
import type { AvailabilityStatus, CabinDirection, ServiceCategory } from "@prisma/client";
import { prisma } from "./prisma";
import { parseDateOnly, toDateKey, addDays, today } from "./dates";
import { toNumber } from "./format";
import { generateBookingCode } from "./utils";
import { resolveCommission } from "./commission";
import { busCommissionFor } from "./provider-commission";
import { hasOriginFare, legFareFor, roundTripFareFor, type FareRow } from "./combo";
import { cabinSeatTotal } from "./combo-pricing";
import type { CabinBookingInput } from "./validation";
import { tripsForDays, tripsOnDate, peekTrip, materializeTrip, type TripView } from "./cabin-trips";

const WD = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
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

/** Chuyến (thật hoặc ảo — xem cabin-trips.ts) → dữ liệu widget. Luôn còn chỗ trừ ngày hết vé. */
function tripToAvail(t: TripView): CabinTripAvail {
  return {
    id: t.id,
    dateKey: toDateKey(t.departureDate),
    departureTime: t.departureTime,
    status: t.status,
    priceSingle: t.price,
    singleAvailable: t.seatsAvailable,
    priceDouble: null,
    doubleAvailable: 0,
    pickupPoint: t.pickupPoint,
    dropoffPoint: t.dropoffPoint,
  };
}

/** Lịch luôn mở bán: chỉ ngày admin đánh dấu HẾT VÉ là "full"; không có mẫu chuyến = "unk". */
function dayState(trip: CabinTripAvail | null): DayState {
  if (!trip) return "unk";
  return trip.status === "SOLD_OUT" ? "full" : "ok";
}

function label(d: Date) {
  return {
    key: toDateKey(d),
    wd: WD[d.getUTCDay()],
    dd: dmy(d), // dd/mm/yyyy (ô dải ngày chỉ lấy 2 ký tự đầu = số ngày)
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
  // Mỗi ngày: chuyến thật (nếu có) hoặc chuyến ảo đang mở bán — không cần tạo chuyến trước.
  const byDay = await tripsForDays(serviceId, direction, days);

  const out: CabinDay[] = days.map((d) => {
    const l = label(d);
    const tv = byDay.get(l.key);
    const trip = tv ? tripToAvail(tv) : null;
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
  /** Nhà xe chỉ nhận nhắn tin (Zalo) — không đặt trước trên web, luôn hiện khi tìm kiếm. */
  contactOnly: boolean;
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
        // Giá chuyến sắp tới (cả 2 chiều) — chỉ dùng khi nhà xe chưa có bảng giá chặng.
        cabinTrips: {
          where: { departureDate: { gte: today() }, price: { gt: 0 } },
          select: { direction: true, price: true },
        },
        cabinPriceRows: true,
      },
    });
    return svcs.flatMap((s): CabinOperatorCard[] => {
      // Chưa tìm: giá "từ" = VÉ KHỨ HỒI/khách THẤP NHẤT.
      const rows: FareRow[] = s.cabinPriceRows.length ? s.cabinPriceRows : generalRows;
      let fromPrice: number | null = null;
      if (rows.length) {
        if (origin) {
          // Đã chọn điểm đón → khứ hồi của chặng đó (bảng không khai điểm này thì ẩn, trừ nhà xe chỉ nhắn tin).
          if (!s.contactOnly && !hasOriginFare(rows, origin)) return [];
          fromPrice = roundTripFareFor(rows, origin);
        } else {
          // Chưa chọn điểm đón → khứ hồi rẻ nhất trong các chặng của bảng giá.
          const fares = [...new Set(rows.map((r) => r.pickupPoint))]
            .map((p) => roundTripFareFor(rows, p))
            .filter((x): x is number => x != null && x > 0);
          fromPrice = fares.length ? Math.min(...fares) : null;
        }
      } else {
        // Chưa có bảng giá chặng → chuyến đi rẻ nhất + chuyến về rẻ nhất sắp tới.
        const minOf = (d: "OUTBOUND" | "RETURN") => {
          const ps = s.cabinTrips.filter((t) => t.direction === d).map((t) => toNumber(t.price) ?? 0).filter((x) => x > 0);
          return ps.length ? Math.min(...ps) : null;
        };
        const o = minOf("OUTBOUND");
        const r = minOf("RETURN");
        fromPrice = o != null && r != null ? o + r : null;
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
        contactOnly: s.contactOnly,
      }];
    });
  }

  const services = await prisma.service.findMany({
    where: { category: "CABIN", published: true },
    orderBy: [{ featured: "desc" }, { title: "asc" }],
    include: {
      images: { orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }], take: 1 },
      cabinPriceRows: true,
    },
  });
  // Lịch luôn mở bán: mỗi nhà xe có chuyến (thật hoặc ảo) mọi ngày, trừ ngày đánh dấu hết vé.
  const ids = services.filter((s) => !s.contactOnly).map((s) => s.id);
  const [outMap, retMap] = await Promise.all([
    from ? tripsOnDate(ids, "OUTBOUND", from) : Promise.resolve(new Map<string, TripView>()),
    to ? tripsOnDate(ids, "RETURN", to) : Promise.resolve(new Map<string, TripView>()),
  ]);

  const cards: CabinOperatorCard[] = [];
  for (const s of services) {
    const outTrip = from && !s.contactOnly ? outMap.get(s.id) ?? null : null;
    const retTrip = to && !s.contactOnly ? retMap.get(s.id) ?? null : null;
    // Ngày đi/về bị đánh dấu HẾT VÉ ⇒ loại nhà xe khỏi kết quả (trừ nhà xe "chỉ nhắn tin").
    if (!s.contactOnly && from && (!outTrip || outTrip.closed)) continue;
    if (!s.contactOnly && to && (!retTrip || retTrip.closed)) continue;
    const outbound = outTrip ? tripToAvail(outTrip) : null;
    const ret = retTrip ? tripToAvail(retTrip) : null;

    // Giá "từ"/khách cho hành trình đang tìm: khứ hồi = đi + về, một chiều = chiều đó.
    let fromPrice: number | null = null;
    const rows: FareRow[] = s.cabinPriceRows.length ? s.cabinPriceRows : generalRows;
    if (s.contactOnly) {
      // Nhà xe chỉ nhắn tin: luôn hiện, giá = khứ hồi theo bảng giá chặng (thiếu → "Liên hệ").
      fromPrice = rows.length ? roundTripFareFor(rows, origin ?? DEFAULT_PICKUP) : null;
    } else if (origin && rows.length) {
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
      state: s.contactOnly ? "unk" : dayState(primary),
      contactOnly: s.contactOnly,
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

/**
 * Giá MỖI KHÁCH (nằm ghép) cho hành trình đi (+ về) của nhà xe — cùng quy tắc với
 * `createCabinBooking`: bảng giá chặng nếu có, không thì cộng giá chuyến. null = chưa có giá.
 */
export async function cabinJourneyFare(
  serviceId: string,
  legs: { price: unknown }[],
  roundTrip: boolean,
  origin: string = DEFAULT_PICKUP,
): Promise<number | null> {
  const rows = await fareRowsFor(serviceId);
  if (rows.length) return journeyFare(rows, origin, roundTrip);
  const prices = legs.map((t) => toNumber(t.price as never) ?? 0);
  return prices.length && prices.every((p) => p > 0) ? prices.reduce((a, b) => a + b, 0) : null;
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
  if (service.contactOnly) {
    throw new Error("Nhà xe này không nhận đặt trước trên web — vui lòng nhắn Zalo để giữ chỗ.");
  }

  // Chuyến có thể là chuyến ẢO (ngày chưa tạo chuyến — lịch luôn mở bán): kiểm tra trước
  // bằng peekTrip, hợp lệ mới tạo chuyến thật để gắn vào đơn.
  const outView = await peekTrip(input.outboundTripId);
  if (!outView || outView.serviceId !== service.id || outView.direction !== "OUTBOUND") {
    throw new Error("Chuyến đi không hợp lệ.");
  }
  const retView = input.returnTripId ? await peekTrip(input.returnTripId) : null;
  if (input.returnTripId && (!retView || retView.serviceId !== service.id || retView.direction !== "RETURN")) {
    throw new Error("Chuyến về không hợp lệ.");
  }
  // Ngày: không đặt chuyến đã chạy; chiều về không được trước chiều đi; ngày hết vé không bán.
  if (outView.departureDate < today()) throw new Error("Chuyến đi đã qua ngày khởi hành.");
  if (retView && retView.departureDate < outView.departureDate) throw new Error("Ngày về phải cùng hoặc sau ngày đi.");
  if (outView.closed) throw new Error(`Ngày đi ${dmy(outView.departureDate)} nhà xe đã hết vé — vui lòng chọn ngày khác.`);
  if (retView?.closed) throw new Error(`Ngày về ${dmy(retView.departureDate)} nhà xe đã hết vé — vui lòng chọn ngày khác.`);

  const outbound = await materializeTrip(input.outboundTripId);
  if (!outbound) throw new Error("Chuyến đi không hợp lệ.");
  const ret = input.returnTripId ? await materializeTrip(input.returnTripId) : null;
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
    // Nhà xe chỉ khai giá KHỨ HỒI mà khách đặt 1 chiều ⇒ không nhận trên web (widget đã mời nhắn Zalo).
    if (fare == null && !ret) {
      throw new Error("Nhà xe chỉ bán vé khứ hồi trên web — vé 1 chiều vui lòng nhắn Zalo để được báo giá.");
    }
  } else {
    const legs = [outbound, ...(ret ? [ret] : [])].map((t) => toNumber(t.price) ?? 0);
    fare = legs.every((p) => p > 0) ? legs.reduce((a, b) => a + b, 0) : null;
  }
  // Nằm ghép: mỗi người 1 vé; nằm riêng: mỗi người 2 × giá vé.
  const total = fare == null ? null : cabinSeatTotal(fare, shared, solo);

  // Lịch luôn mở bán (ngày hết vé đã bị chặn ở trên) ⇒ chỉ cần xác nhận khi chưa có giá.
  const needsConfirmation = fare == null;

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
    ? `Khứ hồi · ${tickets} · ${fareText} · đi ${dmy(outbound.departureDate)} ${outbound.departureTime}, về ${dmy(ret.departureDate)} ${ret.departureTime}`
    : `Một chiều · ${tickets} · ${fareText} · ${dmy(outbound.departureDate)} ${outbound.departureTime}`;

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
      cabinShared: shared,
      cabinSolo: solo,
      cabinTripId: outbound.id,
      cabinReturnTripId: ret?.id ?? null,
      selectionLabel,
      referencePrice: total,
      needsConfirmation,
      ctvId: ctvId ?? null,
      commissionAmount: await resolveCommission(service.id, ctvId),
      busCommission: busCommissionFor(service.busCommission, people, ret ? 2 : 1),
    },
  });

  return { code, needsConfirmation };
}
