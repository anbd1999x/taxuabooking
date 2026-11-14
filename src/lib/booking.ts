import "server-only";
import { ensureServiceSheetFresh } from "./sheet-sync";
import type { ServiceCategory } from "@prisma/client";
import { prisma } from "./prisma";
import { CATEGORIES } from "./constants";
import {
  parseDateOnly,
  enumerateNights,
  enumerateDays,
  toDateKey,
  nightsBetween,
  today,
} from "./dates";
import {
  aggregateStay,
  roomPricing,
  priceForDay,
  roomCommissionForNights,
  type AvailabilityRecord,
  type StayAvailabilityResult,
} from "./availability";
import { checkWeekendPolicy } from "./weekend-policy";
import { toNumber, formatPrice } from "./format";
import { generateBookingCode } from "./utils";
import { resolveCommission } from "./commission";
import { billableOccupants, multiRoomExtraCost, partyLabel, DEFAULT_CHILD_FREE_UNDER } from "./occupancy";
import type { BookingInput } from "./validation";

export interface StayOption {
  id: string;
  name: string;
  capacity: number;
  status: StayAvailabilityResult["status"];
  bookable: boolean;
  availableUnits: number;
  pricePerUnit: number | null; // tổng giá 1 phòng/xe cho cả kỳ
  count: number; // số đêm/ngày
  commission?: number; // tổng chiết khấu CTV cho phòng này cả kỳ (homestay)
}

export interface TripOption {
  id: string;
  label: string;
  departureTime: string;
  price: number;
  seatsAvailable: number;
  status: StayAvailabilityResult["status"];
  bookable: boolean;
}

export interface TransportOption {
  fixedPrice: number | null;
  note: string | null;
  needsConfirmation: boolean;
}

export interface ComputedAvailability {
  kind: "stay" | "trip" | "rental" | "transport";
  nights: number;
  stayOptions?: StayOption[];
  tripOptions?: TripOption[];
  transport?: TransportOption;
  /** combo và các dịch vụ không có lịch ngày -> true */
  manualConfirmOnly?: boolean;
  basePrice?: number | null;
  /** Vi phạm chính sách bán cuối tuần theo cụm (homestay) — có giá trị = không cho đặt. */
  policyNote?: string;
}

/** Tính tình trạng + giá cho một dịch vụ theo ngày khách chọn (server-authoritative). */
export async function computeAvailability(
  serviceId: string,
  fromKey: string,
  toKey: string | null,
  requested: number,
): Promise<ComputedAvailability | null> {
  const service = await prisma.service.findFirst({
    where: { id: serviceId, published: true },
  });
  if (!service) return null;

  const kind = CATEGORIES[service.category].availabilityKind;
  const from = parseDateOnly(fromKey);
  const to = toKey ? parseDateOnly(toKey) : null;
  const qty = Math.max(1, requested);

  if (kind === "stay") {
    // Giá & sức chứa ở cấp phòng con → mỗi phòng là một lựa chọn đặt riêng.
    const roomTypes = await prisma.roomType.findMany({
      where: { serviceId },
      orderBy: { sortOrder: "asc" },
      include: { rooms: { orderBy: { sortOrder: "asc" } } },
    });
    const rooms = roomTypes
      .flatMap((rt) => rt.rooms.map((r) => ({ ...r, typeName: rt.name })))
      // "Thứ tự hiển thị" TOÀN CỤC giữa các hạng (giống lưới admin) — các hạng có
      // phòng xen kẽ (vd Mơ có/không bồn) vẫn hiện đúng thứ tự Mơ 1..Mơ 9 như sheet.
      // sort ổn định: phòng cùng sortOrder giữ nguyên thứ tự theo hạng như cũ.
      .sort((a, b) => a.sortOrder - b.sortOrder);
    // Combo (hoặc homestay chưa khai báo phòng) -> chỉ nhận yêu cầu, admin xác nhận.
    if (rooms.length === 0) {
      return {
        kind: "stay",
        nights: to ? nightsBetween(from, to) : 1,
        manualConfirmOnly: true,
        basePrice: toNumber(service.basePrice),
      };
    }
    const checkout = to ?? parseDateOnly(nextDayKey(fromKey));
    const nights = enumerateNights(from, checkout);

    const roomIds = rooms.map((r) => r.id);
    const statuses = await prisma.roomDayStatus.findMany({
      where: { roomId: { in: roomIds }, date: { gte: from, lt: checkout } },
    });
    // roomId -> tập ngày bị chiếm (không bán).
    const occupied = new Map<string, Set<string>>();
    for (const s of statuses) {
      if (s.status === "AVAILABLE") continue;
      let set = occupied.get(s.roomId);
      if (!set) occupied.set(s.roomId, (set = new Set()));
      set.add(toDateKey(s.date));
    }

    const stayOptions: StayOption[] = rooms.map((room) => {
      const occ = occupied.get(room.id);
      const free = nights.length > 0 && (!occ || nights.every((d) => !occ.has(toDateKey(d))));
      const pricing = roomPricing(room);
      let total = 0;
      let hasIbNight = false; // đêm nào không công khai giá (≤ 0) → giá tham khảo = null
      for (const d of nights) {
        const p = priceForDay(d, pricing, null);
        if (p <= 0) hasIbNight = true;
        else total += p;
      }
      return {
        id: room.id,
        name: `${room.typeName} · ${room.name}`,
        capacity: room.capacity,
        status: free ? "AVAILABLE" : "SOLD_OUT",
        bookable: free,
        availableUnits: free ? 1 : 0,
        pricePerUnit: nights.length > 0 && !hasIbNight ? total : null,
        count: nights.length,
        commission: roomCommissionForNights(room, nights, toNumber(service.roomCommission)),
      };
    });

    const policyNote = checkWeekendPolicy(service.weekendPolicy, nights) ?? undefined;
    return { kind: "stay", nights: nights.length, stayOptions, policyNote };
  }

  if (kind === "rental") {
    const vehicles = await prisma.rentalVehicle.findMany({
      where: { serviceId },
      orderBy: { sortOrder: "asc" },
    });
    const end = to ?? from;
    const days = enumerateDays(from, end);
    const vIds = vehicles.map((v) => v.id);
    const avails = await prisma.rentalAvailability.findMany({
      where: { rentalVehicleId: { in: vIds }, date: { gte: from, lte: end } },
    });
    const byV = new Map<string, Map<string, AvailabilityRecord>>();
    for (const a of avails) {
      if (!byV.has(a.rentalVehicleId)) byV.set(a.rentalVehicleId, new Map());
      byV.get(a.rentalVehicleId)!.set(toDateKey(a.date), {
        status: a.status,
        availableUnits: a.availableUnits,
        priceOverride: toNumber(a.priceOverride),
      });
    }
    const stayOptions: StayOption[] = vehicles.map((v) => {
      const records = byV.get(v.id) ?? new Map();
      const price = toNumber(v.pricePerDay)!;
      const r = aggregateStay({
        days,
        requestedUnits: qty,
        pricing: { weekdayPrice: price, weekendPrice: price, holidayPrice: null },
        records,
      });
      return {
        id: v.id,
        name: v.vehicleType,
        capacity: 1,
        status: r.status,
        bookable: r.bookable,
        availableUnits: r.minAvailableUnits,
        // Xe máy luôn có giá/ngày niêm yết: ngày chưa nhập lịch vẫn tính được tiền thuê
        // (tình trạng thì vẫn "chờ xác nhận") — trước đây đơn bị để trống giá.
        pricePerUnit:
          r.totalPricePerUnit ??
          (price > 0
            ? days.reduce((sum, d) => {
                const o = records.get(toDateKey(d))?.priceOverride;
                return sum + (o != null && o > 0 ? o : price);
              }, 0)
            : null),
        count: r.count,
      };
    });
    return { kind: "rental", nights: days.length, stayOptions };
  }

  if (kind === "trip") {
    const trips = await prisma.cabinTrip.findMany({
      where: { serviceId, departureDate: from },
      orderBy: { departureTime: "asc" },
    });
    const tripOptions: TripOption[] = trips.map((t) => {
      const bookable =
        t.status !== "SOLD_OUT" &&
        t.status !== "NOT_UPDATED" &&
        t.status !== "PENDING_CONFIRM" && // chờ xác nhận → không coi là chắc chỗ
        t.seatsAvailable >= qty;
      return {
        id: t.id,
        label: `${t.operatorName} · ${t.route}`,
        departureTime: t.departureTime,
        price: toNumber(t.price)!,
        seatsAvailable: t.seatsAvailable,
        status: t.status,
        bookable,
      };
    });
    return { kind: "trip", nights: 1, tripOptions };
  }

  // transport (xe ôm / taxi)
  const info = await prisma.transportInfo.findUnique({ where: { serviceId } });
  return {
    kind: "transport",
    nights: 1,
    transport: {
      fixedPrice: toNumber(info?.fixedPrice),
      note: info?.priceNote ?? null,
      needsConfirmation: true,
    },
  };
}

function nextDayKey(key: string): string {
  const d = parseDateOnly(key);
  d.setUTCDate(d.getUTCDate() + 1);
  return toDateKey(d);
}

export interface CreateBookingResult {
  code: string;
  needsConfirmation: boolean;
}

/**
 * Tạo yêu cầu đặt. Giá & tình trạng được TÍNH LẠI phía server,
 * bỏ qua mọi giá gửi từ trình duyệt.
 */
export async function createBooking(
  input: BookingInput,
  ctvId?: string | null,
): Promise<CreateBookingResult> {
  const service = await prisma.service.findFirst({
    where: { id: input.serviceId, published: true },
  });
  if (!service) throw new Error("Dịch vụ không tồn tại.");
  if (service.contactOnly || service.inquiryOnly) {
    throw new Error("Cơ sở này không nhận đặt trực tiếp trên web — vui lòng nhắn tin/gọi để nhận thông tin và giữ phòng.");
  }

  const kind = CATEGORIES[service.category].availabilityKind;
  const qty = input.quantity;

  // Làm tươi lịch từ sheet/API NGAY TẠI SERVER trước khi tính tình trạng (trước đây chỉ trình
  // duyệt gọi, và trang homestay đặt nhiều phòng không gọi). Vừa đồng bộ <60s thì bỏ qua; lỗi không chặn đặt.
  if (service.category === "HOMESTAY" || service.category === "BUNGALOW") {
    await ensureServiceSheetFresh(service.id).catch(() => {});
  }

  // Không nhận đặt cho ngày đã qua; giới hạn độ dài kỳ để tránh dữ liệu rác.
  if (input.useDate < toDateKey(today())) throw new Error("Ngày sử dụng đã qua — vui lòng chọn ngày khác.");
  if (input.endDate && nightsBetween(parseDateOnly(input.useDate), parseDateOnly(input.endDate)) > 60) {
    throw new Error("Kỳ đặt tối đa 60 ngày.");
  }
  // Homestay đặt theo từng phòng cụ thể → quantity = số phòng của đơn.
  let bookingQty = qty;

  let referencePrice: number | null = null;
  let needsConfirmation = true;
  let selectionLabel: string | null = null;
  let nights: number | null = null;
  let roomTypeId: string | null = null;
  let roomId: string | null = null;
  let roomIdList: string[] = []; // homestay: mọi phòng của đơn (roomId = phòng đầu)
  let cabinTripId: string | null = null;
  let rentalVehicleId: string | null = null;
  let stayCommission = 0; // chiết khấu CTV theo phòng/đêm (homestay)
  let bAdults: number | null = null; // người lớn (homestay)
  let bChildrenAges: number[] = []; // tuổi từng trẻ (homestay)

  const computed = await computeAvailability(
    input.serviceId,
    input.useDate,
    input.endDate ?? null,
    qty,
  );

  // Chặn đặt cuối tuần lẻ nếu homestay có chính sách bán theo cụm.
  if (computed?.policyNote) throw new Error(computed.policyNote);

  if (computed?.kind === "stay" && computed.stayOptions) {
    // Lựa chọn là một hoặc NHIỀU PHÒNG cụ thể cùng homestay (roomIds). Client cũ gửi roomId
    // (hoặc roomTypeId rất cũ) → coi như 1 phòng.
    const legacyId = input.roomId ?? input.roomTypeId;
    const pickIds = [...new Set(input.roomIds?.length ? input.roomIds : legacyId ? [legacyId] : [])];
    const opts = pickIds.map((id) => computed.stayOptions!.find((o) => o.id === id));
    // Có danh sách phòng mà id gửi lên không khớp → không tạo đơn "trống" (không phòng, không giá).
    if (opts.length === 0 || opts.some((o) => !o)) {
      throw new Error("Phòng đã chọn không hợp lệ — vui lòng tải lại trang và chọn lại phòng.");
    }
    const picked = opts as StayOption[];
    const roomRows = await prisma.room.findMany({
      where: { id: { in: picked.map((o) => o.id) } },
      select: { id: true, roomTypeId: true, capacity: true, maxCapacity: true },
    });
    const rowOf = new Map(roomRows.map((r) => [r.id, r]));
    roomId = picked[0].id;
    roomIdList = picked.map((o) => o.id);
    roomTypeId = rowOf.get(picked[0].id)?.roomTypeId ?? null;
    nights = picked[0].count;
    bookingQty = picked.length;
    // Có phòng nào không chắc trống → cả đơn chờ xác nhận.
    needsConfirmation = picked.some((o) => !o.bookable);
    stayCommission = picked.reduce((n, o) => n + (o.commission ?? 0), 0);

    // Người lớn / trẻ em: trẻ dưới ngưỡng miễn phí không tính người; từ ngưỡng tính như 1 người.
    // Đoàn chia vào các phòng đã chọn → sức chứa = tổng các phòng.
    const freeUnder = service.childFreeUnderAge ?? DEFAULT_CHILD_FREE_UNDER;
    bAdults = Math.max(1, input.adults ?? input.quantity ?? 1);
    bChildrenAges = input.childrenAges ?? [];
    const occupants = billableOccupants(bAdults, bChildrenAges, freeUnder);
    const ec = multiRoomExtraCost(
      occupants,
      picked.map((o) => {
        const row = rowOf.get(o.id);
        return { capacity: row?.capacity ?? o.capacity ?? 2, maxCapacity: row?.maxCapacity };
      }),
      toNumber(service.extraPersonFee),
      picked[0].count,
    );
    if (ec.overCapacity) {
      throw new Error(
        picked.length > 1
          ? `Số khách (${occupants}) vượt sức chứa tối đa của ${picked.length} phòng đã chọn (${ec.max}). Vui lòng chọn thêm phòng hoặc giảm số người.`
          : `Số khách (${occupants}) vượt sức chứa tối đa của phòng (${ec.max}). Vui lòng chọn phòng lớn hơn hoặc giảm số người.`,
      );
    }
    // Có phòng không công khai giá (IB) → cả đơn không có giá tham khảo.
    const roomsTotal = picked.every((o) => o.pricePerUnit != null)
      ? picked.reduce((n, o) => n + (o.pricePerUnit ?? 0), 0)
      : null;
    referencePrice = roomsTotal != null ? roomsTotal + ec.cost : null;
    selectionLabel =
      `${picked.length > 1 ? `${picked.length} phòng: ` : ""}${picked.map((o) => o.name).join(" + ")} · ${partyLabel(bAdults, bChildrenAges)}` +
      (ec.extraGuests > 0 ? ` · +${ec.extraGuests} khách phụ thu ${formatPrice(ec.cost)}` : "");
  } else if (computed?.kind === "rental" && computed.stayOptions) {
    const opt = computed.stayOptions.find((o) => o.id === input.rentalVehicleId);
    if (!opt && computed.stayOptions.length > 0) throw new Error("Loại xe đã chọn không hợp lệ — vui lòng chọn lại.");
    if (opt) {
      rentalVehicleId = opt.id;
      selectionLabel = opt.name;
      nights = opt.count;
      referencePrice = opt.pricePerUnit != null ? opt.pricePerUnit * qty : null;
      needsConfirmation = !opt.bookable;
    }
  } else if (computed?.kind === "trip" && computed.tripOptions) {
    const opt = computed.tripOptions.find((o) => o.id === input.cabinTripId);
    if (!opt && computed.tripOptions.length > 0) throw new Error("Chuyến đã chọn không hợp lệ — vui lòng chọn lại.");
    if (opt) {
      cabinTripId = opt.id;
      selectionLabel = `${opt.label} · ${opt.departureTime}`;
      referencePrice = opt.price * qty;
      needsConfirmation = !opt.bookable;
    }
  } else if (computed?.kind === "transport") {
    referencePrice =
      computed.transport?.fixedPrice != null
        ? computed.transport.fixedPrice
        : null;
    needsConfirmation = true;
  } else if (computed?.manualConfirmOnly) {
    referencePrice = computed.basePrice != null ? computed.basePrice * qty : null;
    needsConfirmation = true;
  }

  // Chiết khấu CTV: homestay (có phòng) tính theo phòng/đêm; còn lại = mức cố định/đơn.
  const commissionAmount = ctvId
    ? roomId
      ? stayCommission
      : await resolveCommission(service.id, ctvId)
    : 0;
  // Chiết khấu từng căn (snapshot cho MỌI đơn homestay, kể cả khách tự đặt) → dùng để
  // tính tiền chủ dịch vụ thực nhận = tiền phòng bán ra − chiết khấu.
  const roomCommission = roomId ? stayCommission : null;

  // Mã yêu cầu không trùng.
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
      note: input.note ?? null,
      useDate: parseDateOnly(input.useDate),
      endDate: input.endDate ? parseDateOnly(input.endDate) : null,
      nights,
      quantity: bookingQty,
      adults: bAdults,
      childrenAges: bChildrenAges,
      roomTypeId,
      roomId,
      roomIds: roomIdList,
      cabinTripId,
      rentalVehicleId,
      selectionLabel,
      referencePrice,
      needsConfirmation,
      ctvId: ctvId ?? null,
      commissionAmount,
      roomCommission,
    },
  });

  return { code, needsConfirmation };
}
