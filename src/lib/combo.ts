import "server-only";
import type { AvailabilityStatus } from "@prisma/client";
import { prisma } from "./prisma";
import { parseDateOnly, toDateKey, addDays, enumerateNights } from "./dates";
import { toNumber } from "./format";
import { roomPricing, priceForDay, roomCommissionForNights } from "./availability";
import { generateBookingCode } from "./utils";
import type { ComboBookingInput } from "./validation";

/** Giảm giá cố định cho mỗi combo (mỗi khách). */
export const COMBO_DISCOUNT = 50000;

export interface ComboFilters {
  bathtub: boolean;
  cloudView: boolean;
  breakfast: boolean;
  airCon: boolean;
  heating: boolean;
  easyRoad: boolean;
  pool: boolean;
}

export const EMPTY_FILTERS: ComboFilters = {
  bathtub: false,
  cloudView: false,
  breakfast: false,
  airCon: false,
  heating: false,
  easyRoad: false,
  pool: false,
};

/** Loại phòng cho combo. */
export type ComboRoomKind = "all" | "single" | "double" | "dorm";

/** Phân loại phòng theo tên hạng + sức chứa. */
function roomKindOf(capacity: number, typeName: string): Exclude<ComboRoomKind, "all"> {
  const n = typeName.toLowerCase();
  if (/dorm|tập thể|tap the|giường tầng|giuong tang|phòng chung|phong chung/.test(n) || capacity >= 4) return "dorm";
  if (capacity <= 1) return "single";
  return "double";
}

export interface ComboBusOption {
  serviceId: string;
  slug: string;
  title: string;
  area: string | null;
  cover: string | null;
  outboundTripId: string;
  returnTripId: string;
  outboundTime: string;
  returnTime: string;
  /** Giá vé khứ hồi cho 1 người (cabin đơn): chiều đi + chiều về. */
  farePerPerson: number;
  /** Số chỗ đơn còn ít nhất giữa 2 chiều. */
  seatsAvailable: number;
}

export interface ComboRoomFeatures {
  hasBathtub: boolean;
  cloudView: boolean;
  breakfast: boolean;
  airCon: boolean;
  heating: boolean;
}

export interface ComboRoomOption {
  serviceId: string;
  slug: string;
  title: string; // tên homestay
  area: string | null;
  cover: string | null;
  roomTypeId: string;
  roomId: string;
  roomName: string;
  capacity: number;
  /** Tổng tiền phòng cho cả kỳ lưu trú (1 phòng). */
  roomCost: number;
  features: ComboRoomFeatures;
  easyRoad: boolean;
  pool: boolean;
  kind: Exclude<ComboRoomKind, "all">;
}

export interface ComboMatch {
  id: string; // busServiceId:roomTypeId:roomId (duy nhất cho mỗi phòng)
  bus: ComboBusOption;
  room: ComboRoomOption;
  /** Phần tiền phòng mỗi khách (roomCost / số người). */
  roomSharePerPerson: number;
  /** Giá combo mỗi khách = phần phòng + vé khứ hồi − giảm giá. */
  pricePerPerson: number;
  /** Chênh lệch so với giá mong muốn (0 nếu không nhập). */
  distance: number;
}

/** Một homestay cùng danh sách phòng khả dụng (cho thẻ combo v2). */
export interface ComboHomeOption {
  serviceId: string;
  slug: string;
  title: string;
  area: string | null;
  cover: string | null;
  amenities: string[]; // nhãn tiện ích để hiển thị
  rooms: ComboRoomOption[];
  bestPricePerPerson: number; // giá rẻ nhất đạt được (xe rẻ nhất + phòng rẻ nhất)
}

export interface ComboSearchResult {
  fromKey: string; // ngày đi (đêm lên xe chiều đi)
  toKey: string; // ngày về (xe chạy chiều về) = check-out
  checkIn: string;
  checkOut: string;
  nights: number;
  people: number;
  budget: number | null;
  busCount: number;
  roomCount: number;
  buses: ComboBusOption[];
  homes: ComboHomeOption[];
  bestHomeId: string | null;
  matches: ComboMatch[];
}

const BOOKABLE: AvailabilityStatus[] = ["AVAILABLE", "LIMITED"];

/**
 * Tìm combo (xe cabin khứ hồi + phòng homestay) khớp nhất với giá mong muốn.
 *
 * Ngày: ngày đi = đêm lên xe (chiều đi) → check-in = ngày đi + 1; ngày về = ngày
 * xe chạy chiều về = ngày check-out. Số đêm = check-out − check-in.
 *
 * Giá combo / khách = (tiền phòng cả kỳ ÷ số người) + vé khứ hồi 1 người − 50k.
 * Kết quả sắp xếp theo mức gần giá mong muốn nhất (không nhập giá → rẻ trước).
 */
export async function findComboMatches(input: {
  fromKey: string;
  toKey: string;
  people: number;
  budget: number | null;
  filters: ComboFilters;
  roomKind?: ComboRoomKind;
  limit?: number;
}): Promise<ComboSearchResult | null> {
  const { fromKey, toKey, filters } = input;
  const roomKind = input.roomKind ?? "all";
  const people = Math.max(1, Math.floor(input.people) || 1);
  const budget = input.budget && input.budget > 0 ? input.budget : null;

  const from = parseDateOnly(fromKey); // ngày đi (chiều đi)
  const to = parseDateOnly(toKey); // ngày về (chiều về) = check-out
  const checkIn = addDays(from, 1);
  const checkOut = to;
  const nights = enumerateNights(checkIn, checkOut);
  if (nights.length < 1) return null; // ngày về phải sau check-in ít nhất 1 đêm

  const base: Omit<ComboSearchResult, "matches" | "busCount" | "roomCount" | "buses" | "homes" | "bestHomeId"> = {
    fromKey,
    toKey,
    checkIn: toDateKey(checkIn),
    checkOut: toDateKey(checkOut),
    nights: nights.length,
    people,
    budget,
  };

  const [allBuses, rooms] = await Promise.all([
    findBuses(from, to),
    findRooms(nights, people, filters, roomKind),
  ]);
  // Xe phải còn đủ chỗ (cabin đơn) cho cả đoàn ở cả hai chiều.
  const buses = allBuses.filter((b) => b.seatsAvailable >= people);

  const matches: ComboMatch[] = [];
  for (const bus of buses) {
    for (const room of rooms) {
      const roomSharePerPerson = Math.round(room.roomCost / people);
      const pricePerPerson = roomSharePerPerson + bus.farePerPerson - COMBO_DISCOUNT;
      if (pricePerPerson <= 0) continue;
      const distance = budget != null ? Math.abs(pricePerPerson - budget) : pricePerPerson;
      matches.push({
        id: `${bus.serviceId}:${room.roomTypeId}:${room.roomId}`,
        bus,
        room,
        roomSharePerPerson,
        pricePerPerson,
        distance,
      });
    }
  }

  matches.sort((a, b) => a.distance - b.distance || a.pricePerPerson - b.pricePerPerson);

  // Gom phòng theo từng homestay (thẻ combo v2: mỗi homestay chọn xe + phòng).
  const cheapestFare = buses.length ? Math.min(...buses.map((b) => b.farePerPerson)) : 0;
  const FEAT: [keyof ComboRoomFeatures, string][] = [
    ["cloudView", "⛅ View mây"],
    ["hasBathtub", "🛁 Bồn tắm"],
    ["breakfast", "🍳 Ăn sáng"],
    ["airCon", "❄️ Điều hòa"],
    ["heating", "🔥 Đêm sưởi"],
  ];
  const homeMap = new Map<string, ComboHomeOption>();
  for (const r of rooms) {
    let h = homeMap.get(r.serviceId);
    if (!h) {
      h = { serviceId: r.serviceId, slug: r.slug, title: r.title, area: r.area, cover: r.cover, amenities: [], rooms: [], bestPricePerPerson: 0 };
      homeMap.set(r.serviceId, h);
    }
    h.rooms.push(r);
  }
  for (const h of homeMap.values()) {
    const amen = new Set<string>();
    let minRoomCost = Infinity;
    for (const r of h.rooms) {
      for (const [k, label] of FEAT) if (r.features[k]) amen.add(label);
      if (r.pool) amen.add("🏊 Hồ bơi");
      if (r.easyRoad) amen.add("🛣️ Đường dễ đi");
      if (r.roomCost < minRoomCost) minRoomCost = r.roomCost;
    }
    h.amenities = [...amen];
    const share = Math.round((minRoomCost === Infinity ? 0 : minRoomCost) / people);
    h.bestPricePerPerson = Math.max(0, share + cheapestFare - COMBO_DISCOUNT);
  }
  const homes = [...homeMap.values()].sort((a, b) => {
    const da = budget != null ? Math.abs(a.bestPricePerPerson - budget) : a.bestPricePerPerson;
    const db = budget != null ? Math.abs(b.bestPricePerPerson - budget) : b.bestPricePerPerson;
    return da - db;
  });
  const bestHomeId = buses.length > 0 && homes.length > 0 ? homes[0].serviceId : null;

  return {
    ...base,
    busCount: buses.length,
    roomCount: rooms.length,
    buses,
    homes,
    bestHomeId,
    matches: matches.slice(0, input.limit ?? 24),
  };
}

async function findBuses(from: Date, to: Date): Promise<ComboBusOption[]> {
  const services = await prisma.service.findMany({
    where: { category: "CABIN", published: true },
    orderBy: [{ featured: "desc" }, { title: "asc" }],
    include: {
      images: { orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }], take: 1 },
      cabinTrips: {
        where: {
          OR: [
            { direction: "OUTBOUND", departureDate: from },
            { direction: "RETURN", departureDate: to },
          ],
        },
      },
    },
  });

  const out: ComboBusOption[] = [];
  for (const s of services) {
    const outbound = s.cabinTrips.find((t) => t.direction === "OUTBOUND");
    const ret = s.cabinTrips.find((t) => t.direction === "RETURN");
    if (!outbound || !ret) continue;
    const okOut = BOOKABLE.includes(outbound.status) && outbound.seatsAvailable > 0;
    const okRet = BOOKABLE.includes(ret.status) && ret.seatsAvailable > 0;
    if (!okOut || !okRet) continue;
    const fare = (toNumber(outbound.price) ?? 0) + (toNumber(ret.price) ?? 0);
    if (fare <= 0) continue;
    out.push({
      serviceId: s.id,
      slug: s.slug,
      title: s.title,
      area: s.area,
      cover: s.images[0]?.url ?? null,
      outboundTripId: outbound.id,
      returnTripId: ret.id,
      outboundTime: outbound.departureTime,
      returnTime: ret.departureTime,
      farePerPerson: fare,
      seatsAvailable: Math.min(outbound.seatsAvailable, ret.seatsAvailable),
    });
  }
  return out;
}

async function findRooms(
  nights: Date[],
  people: number,
  filters: ComboFilters,
  roomKind: ComboRoomKind,
): Promise<ComboRoomOption[]> {
  const services = await prisma.service.findMany({
    where: {
      category: "HOMESTAY",
      published: true,
      ...(filters.easyRoad ? { easyRoad: true } : {}),
      ...(filters.pool ? { pool: true } : {}),
    },
    include: {
      images: { orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }], take: 1 },
      roomTypes: {
        where: {
          // Tiện ích ở cấp hạng phòng.
          ...(filters.bathtub ? { hasBathtub: true } : {}),
          ...(filters.cloudView ? { cloudView: true } : {}),
          ...(filters.breakfast ? { breakfast: true } : {}),
          ...(filters.airCon ? { airCon: true } : {}),
          ...(filters.heating ? { heating: true } : {}),
        },
        // Giá & sức chứa ở cấp phòng con.
        include: { rooms: { where: { capacity: { gte: people } } } },
      },
    },
  });

  // Tất cả phòng con khớp tiêu chí.
  const allRooms = services.flatMap((s) =>
    s.roomTypes.flatMap((rt) =>
      rt.rooms.map((room) => ({ s, rt, room })),
    ),
  );
  if (allRooms.length === 0) return [];

  const roomIds = allRooms.map((x) => x.room.id);
  const statuses = await prisma.roomDayStatus.findMany({
    where: { roomId: { in: roomIds }, date: { in: nights } },
  });
  const occupied = new Map<string, Set<string>>();
  for (const st of statuses) {
    if (st.status === "AVAILABLE") continue;
    let set = occupied.get(st.roomId);
    if (!set) occupied.set(st.roomId, (set = new Set()));
    set.add(toDateKey(st.date));
  }

  const out: ComboRoomOption[] = [];
  for (const { s, rt, room } of allRooms) {
    const occ = occupied.get(room.id);
    const free = !occ || nights.every((d) => !occ.has(toDateKey(d)));
    if (!free) continue;
    const kind = roomKindOf(room.capacity, rt.name);
    if (roomKind !== "all" && kind !== roomKind) continue;
    const pricing = roomPricing(room);
    let roomCost = 0;
    for (const d of nights) roomCost += priceForDay(d, pricing, null);
    if (roomCost <= 0) continue;
    out.push({
      serviceId: s.id,
      slug: s.slug,
      title: s.title,
      area: s.area,
      cover: s.images[0]?.url ?? rt.imageUrl ?? null,
      roomTypeId: rt.id,
      roomId: room.id,
      roomName: `${rt.name} · ${room.name}`,
      capacity: room.capacity,
      roomCost,
      features: {
        hasBathtub: rt.hasBathtub,
        cloudView: rt.cloudView,
        breakfast: rt.breakfast,
        airCon: rt.airCon,
        heating: rt.heating,
      },
      easyRoad: s.easyRoad,
      pool: s.pool,
      kind,
    });
  }
  return out;
}

export interface CreateComboBookingResult {
  code: string;
  needsConfirmation: boolean;
}

/**
 * Tạo yêu cầu ĐẶT COMBO (xe cabin khứ hồi + phòng homestay).
 * Giá được TÍNH LẠI phía server. Combo luôn cần admin xác nhận thủ công.
 */
export async function createComboBooking(
  input: ComboBookingInput,
  ctvId?: string | null,
): Promise<CreateComboBookingResult> {
  const people = Math.max(1, Math.floor(input.people) || 1);
  const from = parseDateOnly(input.fromKey); // ngày đi
  const to = parseDateOnly(input.toKey); // ngày về = check-out
  const checkIn = addDays(from, 1);
  const nights = enumerateNights(checkIn, to);
  if (nights.length < 1) throw new Error("Ngày về phải sau ngày nhận phòng ít nhất 1 đêm.");

  const room = await prisma.room.findUnique({
    where: { id: input.roomId },
    include: { roomType: { include: { service: true } } },
  });
  if (!room || room.roomType.service.category !== "HOMESTAY" || !room.roomType.service.published) {
    throw new Error("Phòng homestay không hợp lệ.");
  }
  const outbound = await prisma.cabinTrip.findUnique({ where: { id: input.outboundTripId } });
  const ret = await prisma.cabinTrip.findUnique({ where: { id: input.returnTripId } });
  if (!outbound || outbound.direction !== "OUTBOUND") throw new Error("Chuyến đi không hợp lệ.");
  if (!ret || ret.direction !== "RETURN") throw new Error("Chuyến về không hợp lệ.");

  const pricing = roomPricing(room);
  let roomCost = 0;
  for (const d of nights) roomCost += priceForDay(d, pricing, null);
  const fare = (toNumber(outbound.price) ?? 0) + (toNumber(ret.price) ?? 0);
  const pricePerPerson = Math.round(roomCost / people) + fare - COMBO_DISCOUNT;
  const total = Math.max(0, pricePerPerson) * people;

  const busSvc = await prisma.service.findUnique({ where: { id: outbound.serviceId }, select: { title: true } });
  const selectionLabel =
    `Combo: xe ${outbound.operatorName || busSvc?.title || "cabin"} (đi ${toDateKey(outbound.departureDate)} ${outbound.departureTime}, ` +
    `về ${toDateKey(ret.departureDate)} ${ret.departureTime}) + ${room.roomType.service.title} · ${room.roomType.name} ${room.name}, ` +
    `${nights.length} đêm (${toDateKey(checkIn)}→${toDateKey(to)}) · ${people} người`;

  let code = generateBookingCode();
  for (let i = 0; i < 5; i++) {
    const exists = await prisma.bookingRequest.findUnique({ where: { code } });
    if (!exists) break;
    code = generateBookingCode();
  }

  await prisma.bookingRequest.create({
    data: {
      code,
      category: "COMBO",
      serviceId: room.roomType.service.id,
      serviceTitle: `Combo Tà Xùa: ${busSvc?.title ?? "xe cabin"} + ${room.roomType.service.title}`,
      customerName: input.customerName,
      phone: input.phone,
      note: input.note ?? null,
      // useDate = NGÀY NHẬN PHÒNG (đi xe đêm hôm trước) để giữ phòng đúng các đêm
      // [check-in, check-out). Ngày xe chạy nằm trong selectionLabel + cabinTripId.
      useDate: checkIn,
      endDate: to,
      nights: nights.length,
      quantity: people,
      roomTypeId: room.roomTypeId,
      roomId: room.id,
      cabinTripId: outbound.id,
      cabinReturnTripId: ret.id,
      seatsSingle: people,
      selectionLabel,
      referencePrice: total,
      needsConfirmation: true,
      ctvId: ctvId ?? null,
      commissionAmount: ctvId ? roomCommissionForNights(room, nights) : 0,
    },
  });

  return { code, needsConfirmation: true };
}

/** Parse danh sách filter từ query (?f=bathtub,cloudView,...). */
export function parseComboFilters(raw: string | undefined | null): ComboFilters {
  const set = new Set((raw ?? "").split(",").map((x) => x.trim()).filter(Boolean));
  return {
    bathtub: set.has("bathtub"),
    cloudView: set.has("cloudView"),
    breakfast: set.has("breakfast"),
    airCon: set.has("airCon"),
    heating: set.has("heating"),
    easyRoad: set.has("easyRoad"),
    pool: set.has("pool"),
  };
}
