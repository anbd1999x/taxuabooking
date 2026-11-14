"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { BookingStatus, PaymentStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin, getSession } from "@/lib/auth";
import { CATEGORIES, BOOKING_STATUS_META } from "@/lib/constants";
import { computeAvailability } from "@/lib/booking";
import { cabinJourneyFare, getCabinFareOptions } from "@/lib/cabin";
import { cabinSeatTotal } from "@/lib/combo-pricing";
import { resolveCommission } from "@/lib/commission";
import { adjustInventory, assignRoomsForBooking, statusHoldsInventory } from "@/lib/inventory";
import { isValidDateKey, parseDateOnly, toDateKey } from "@/lib/dates";
import { formatPrice, toNumber } from "@/lib/format";
import { generateBookingCode, normalizeFacebookUrl } from "@/lib/utils";
import { busCommissionFor } from "@/lib/provider-commission";
import { parseSurcharges } from "@/lib/surcharges";
import { adminExtraCost } from "@/lib/occupancy";
import { tripsOnDate, peekTrip, materializeTrip, ensureTripOnDate, type TripView } from "@/lib/cabin-trips";
import type { CabinDirection } from "@prisma/client";
import { loadBookingEdit, type BookingEditProps } from "@/lib/booking-edit";

/** Chuyến thật của nhà xe theo id (id ảo ⇒ tạo chuyến thật cho ngày đó). Sai nhà xe/chiều ⇒ null. */
async function resolveAdminTrip(id: string, serviceId: string, direction: CabinDirection) {
  const v = await peekTrip(id);
  if (!v || v.serviceId !== serviceId || v.direction !== direction) return null;
  return materializeTrip(id);
}

/* ============================ Báo giá / lựa chọn ============================ */

export interface QuoteItem {
  id: string;
  name: string;
  /** Giá gợi ý cả kỳ cho 1 đơn vị (phòng/xe); null = chưa có giá. */
  price: number | null;
  bookable: boolean;
  note?: string;
  /** Sức chứa (phòng) — để combo đếm đủ chỗ cho đoàn. */
  capacity?: number;
}

export interface CabinTripItem {
  id: string;
  label: string;
  price: number | null;
  seatsAvailable: number;
  status: string;
}

export interface AdminQuote {
  kind: "stay" | "rental" | "trip" | "transport" | "manual";
  nights: number;
  items?: QuoteItem[];
  outbound?: CabinTripItem[];
  returns?: CabinTripItem[];
  /** Cabin: giá/khách nằm ghép cho chuyến đi (+ về) — tính lại theo chuyến chọn ở client. */
  fixedPrice?: number | null;
  policyNote?: string;
  /** Homestay: phụ thu mỗi khách vượt sức chứa chuẩn / đêm (null = không phụ thu). */
  extraFee?: number | null;
  error?: string;
}

/** Lựa chọn (phòng / xe / chuyến) + giá gợi ý cho form tạo đơn hộ khách. */
export async function quoteAdminBooking(
  serviceId: string,
  from: string,
  to: string | null,
  qty: number,
): Promise<AdminQuote> {
  await requireAdmin();
  if (!serviceId || !isValidDateKey(from)) return { kind: "manual", nights: 0, error: "Chọn dịch vụ và ngày." };
  if (to && (!isValidDateKey(to) || to < from)) return { kind: "manual", nights: 0, error: "Ngày kết thúc không hợp lệ." };

  const service = await prisma.service.findUnique({ where: { id: serviceId }, select: { category: true, extraPersonFee: true } });
  if (!service) return { kind: "manual", nights: 0, error: "Không tìm thấy dịch vụ." };

  if (service.category === "CABIN") {
    const map = (t: { id: string; departureDate: Date; departureTime: string; route: string; price: unknown; seatsAvailable: number; status: string }): CabinTripItem => ({
      id: t.id,
      label: `${toDateKey(t.departureDate)} ${t.departureTime} · ${t.route}`,
      price: toNumber(t.price as never),
      seatsAvailable: t.seatsAvailable,
      status: t.status,
    });
    // Lịch luôn mở bán: ngày chưa có chuyến ⇒ trả chuyến ẢO (tạo thật khi lưu đơn).
    const listFor = async (direction: CabinDirection, key: string) => {
      const real = await prisma.cabinTrip.findMany({
        where: { serviceId, direction, departureDate: parseDateOnly(key) },
        orderBy: { departureTime: "asc" },
      });
      if (real.length) return real.map(map);
      const v: TripView | undefined = (await tripsOnDate([serviceId], direction, parseDateOnly(key))).get(serviceId);
      return v ? [map({ ...v, price: v.price })] : [];
    };
    const [outbound, returns] = await Promise.all([
      listFor("OUTBOUND", from),
      to ? listFor("RETURN", to) : Promise.resolve([] as CabinTripItem[]),
    ]);
    return { kind: "trip", nights: 0, outbound, returns };
  }

  const kind = CATEGORIES[service.category].availabilityKind;
  // Lưu trú: thiếu ngày trả ⇒ 1 đêm. Thuê xe: thiếu ngày trả ⇒ 1 ngày.
  const toKey = kind === "stay" && to === from ? null : to;
  const c = await computeAvailability(serviceId, from, toKey, Math.max(1, qty));
  if (!c) return { kind: "manual", nights: 0, error: "Dịch vụ đang ẩn — không tính được giá, nhập tay." };

  if ((c.kind === "stay" || c.kind === "rental") && c.stayOptions?.length) {
    return {
      kind: c.kind,
      nights: c.nights,
      policyNote: c.policyNote,
      extraFee: c.kind === "stay" ? toNumber(service.extraPersonFee) : null,
      items: c.stayOptions.map((o) => ({
        id: o.id,
        name: o.name,
        price: o.pricePerUnit,
        bookable: o.bookable,
        capacity: o.capacity,
        note: c.kind === "stay" ? `${o.capacity} khách` : `còn ${o.availableUnits} xe`,
      })),
    };
  }
  if (c.kind === "transport") return { kind: "transport", nights: 1, fixedPrice: c.transport?.fixedPrice ?? null };
  return { kind: "manual", nights: c.nights, fixedPrice: c.basePrice ?? null };
}

export interface CabinFareQuote {
  /** Điểm xuất phát (tuyến) + giá MỖI KHÁCH nằm ghép theo bảng giá chặng của nhà xe. */
  options: { origin: string; fare: number }[];
  /** Nhà xe chưa có bảng giá chặng → giá theo chuyến (đi + về); null = chưa có giá. */
  fallback: number | null;
}

/** Tuyến (điểm xuất phát) + giá/khách cho chuyến đi (+ về) đã chọn — cùng quy tắc với đặt vé web. */
export async function quoteCabinFare(serviceId: string, outId: string, retId: string | null): Promise<CabinFareQuote> {
  await requireAdmin();
  const roundTrip = Boolean(retId);
  const { hasTable, options } = await getCabinFareOptions(serviceId, roundTrip);
  if (hasTable) return { options, fallback: null };
  // Id có thể là chuyến ảo (lịch luôn mở bán) ⇒ xem giá qua peekTrip, không tạo gì.
  const views = (await Promise.all([outId, ...(retId ? [retId] : [])].map((id) => peekTrip(id)))).filter(
    (v): v is TripView => v != null && v.serviceId === serviceId,
  );
  return { options: [], fallback: views.length ? await cabinJourneyFare(serviceId, views, roundTrip) : null };
}

/* ============================ Tạo đơn ============================ */

export interface CreateAdminBookingState {
  error?: string;
  /** Sửa đơn trong POPUP (form gửi stay=1): lưu xong KHÔNG chuyển trang, trả ok để popup tự đóng. */
  ok?: boolean;
}

/** Dữ liệu form "Sửa đơn" cho popup sửa ngay trên trang đang xem (chỉ admin). */
export async function fetchBookingEdit(id: string): Promise<BookingEditProps | null> {
  await requireAdmin();
  return loadBookingEdit(id);
}

const STATUSES: BookingStatus[] = ["NEW", "CONTACTING", "CONFIRMED", "COMPLETED", "CANCELLED"];
const PAYMENTS: PaymentStatus[] = ["UNPAID", "DEPOSITED", "PAID"];
const PAY_LABEL: Record<PaymentStatus, string> = { UNPAID: "Chưa thu", DEPOSITED: "Đã cọc", PAID: "Đã thanh toán đủ" };

function str(fd: FormData, k: string): string {
  return String(fd.get(k) ?? "").trim();
}
function int(fd: FormData, k: string, def = 0): number {
  const n = parseInt(str(fd, k), 10);
  return Number.isFinite(n) && n >= 0 ? n : def;
}
function money(fd: FormData, k: string): number | null {
  const t = str(fd, k).replace(/[^\d]/g, "");
  return t ? Number(t) : null;
}

/** Dữ liệu đơn dựng từ form tạo/sửa đơn hộ khách (chưa gồm mã đơn, trạng thái, thanh toán). */
export type AdminBookingData = Omit<
  Prisma.BookingRequestUncheckedCreateInput,
  "code" | "status" | "paymentStatus" | "amountCollected" | "paidAt" | "needsConfirmation" | "cancelReason"
>;

/**
 * Đọc & kiểm tra form đơn hộ khách (dùng chung TẠO và SỬA đơn): dịch vụ, ngày, phòng / chuyến
 * xe / cách nằm / tuyến, khách, tiền — tính lại giá gợi ý, chiết khấu, nhãn lựa chọn phía server.
 * `prev` (khi sửa): giữ trẻ em của đơn cũ (form chỉ nhập tổng số khách).
 */
async function buildAdminBookingData(
  fd: FormData,
  prev?: { quantity: number; adults: number | null; childrenAges: number[]; category: string } | null,
): Promise<{ error: string } | { data: AdminBookingData; isCombo: boolean }> {
  const serviceId = str(fd, "serviceId");
  const customerName = str(fd, "customerName");
  const phone = str(fd, "phone");
  const useDate = str(fd, "useDate");
  const endDateRaw = str(fd, "endDate");
  const ctvId = str(fd, "ctvId") || null;
  // Điểm xuất phát (tuyến) của khách — quyết định giá chặng cabin; mặc định như web.
  const origin = str(fd, "origin") || "Hà Nội";
  // Sửa đơn: trẻ em của đơn cũ. Combo: quantity = số tính phí ⇒ trẻ tính phí = quantity − adults.
  const childKids = prev?.childrenAges.length ?? 0;
  const comboPayingKids =
    prev && prev.category === "COMBO" && prev.adults != null ? Math.max(0, prev.quantity - prev.adults) : 0;

  if (!serviceId) return { error: "Chọn dịch vụ." };
  if (!customerName) return { error: "Nhập tên khách." };
  if (!/^[0-9+().\s-]{8,15}$/.test(phone)) return { error: "Số điện thoại không hợp lệ." };
  const customerFacebook = normalizeFacebookUrl(str(fd, "customerFacebook"));
  if (customerFacebook === undefined) return { error: "Link Facebook không hợp lệ." };
  if (!isValidDateKey(useDate)) return { error: "Chọn ngày sử dụng." };
  if (endDateRaw && (!isValidDateKey(endDateRaw) || endDateRaw < useDate)) return { error: "Ngày kết thúc phải từ ngày bắt đầu trở đi." };

  const service = await prisma.service.findUnique({ where: { id: serviceId } });
  if (!service) return { error: "Không tìm thấy dịch vụ." };
  if (ctvId) {
    const ctv = await prisma.adminUser.findFirst({ where: { id: ctvId, role: "CTV" }, select: { id: true } });
    if (!ctv) return { error: "CTV không hợp lệ." };
  }

  const kind = CATEGORIES[service.category].availabilityKind;
  let quantity = Math.max(1, int(fd, "quantity", 1));
  let endDate: string | null = endDateRaw && endDateRaw !== useDate ? endDateRaw : null;
  let nights: number | null = null;
  let roomTypeId: string | null = null;
  let roomId: string | null = null;
  let rentalVehicleId: string | null = null;
  let cabinTripId: string | null = null;
  let cabinReturnTripId: string | null = null;
  let seatsSingle: number | null = null;
  let seatsDouble: number | null = null;
  // Cách nằm theo người (nằm ghép = cabin đôi / nằm riêng = cabin đơn) — hiển thị chi tiết đơn.
  let cabinShared: number | null = null;
  let cabinSolo: number | null = null;
  let selectionLabel: string | null = null;
  let suggested: number | null = null;
  let stayCommission: number | null = null;
  // Combo (xe cabin + homestay) — ghi đè danh mục / tên / ngày / nhiều phòng / tách tiền.
  const isCombo = str(fd, "mode") === "combo";
  let category = service.category;
  let serviceTitle = service.title;
  let bookingUseDate = useDate;
  let roomIds: string[] = [];
  let roomAmount: number | null = null;
  let busAmount: number | null = null;
  let fixedQuantity: number | null = null;
  let busCommission: number | null = null; // chiết khấu nhà xe cho sàn (snapshot)
  let adults: number | null = null;

  if (isCombo) {
    // Ngày đi = đêm lên xe chiều đi → nhận phòng = ngày đi + 1; ngày về = trả phòng = ngày xe về.
    const busId = str(fd, "busServiceId");
    if (service.category !== "HOMESTAY" && service.category !== "BUNGALOW") return { error: "Chọn homestay cho combo." };
    const bus = busId ? await prisma.service.findFirst({ where: { id: busId, category: "CABIN" } }) : null;
    if (!bus) return { error: "Chọn nhà xe cho combo." };
    if (!endDateRaw) return { error: "Chọn ngày về." };
    const checkIn = parseDateOnly(useDate);
    checkIn.setUTCDate(checkIn.getUTCDate() + 1);
    const checkInKey = toDateKey(checkIn);
    if (endDateRaw <= checkInKey) return { error: "Ngày về phải sau ngày nhận phòng (ngày đi + 1) ít nhất 1 đêm." };

    const shared = int(fd, "shared");
    const solo = int(fd, "solo");
    const people = shared + solo;
    if (people < 1) return { error: "Nhập số khách nằm ghép / nằm riêng." };

    const outId = str(fd, "cabinTripId");
    const retId = str(fd, "cabinReturnTripId");
    // Không chọn chuyến ⇒ TỰ GÁN chuyến của nhà xe theo ngày đi / ngày về (lịch cabin luôn
    // mở bán). Đơn combo BẮT BUỘC gắn chuyến: thống kê/đơn của chủ nhà xe tra theo chuyến,
    // thiếu chuyến thì phần tiền vé rơi vào "Chưa gán chủ dịch vụ".
    const outbound = outId
      ? await resolveAdminTrip(outId, bus.id, "OUTBOUND")
      : await ensureTripOnDate(bus.id, "OUTBOUND", useDate);
    const ret = retId
      ? await resolveAdminTrip(retId, bus.id, "RETURN")
      : await ensureTripOnDate(bus.id, "RETURN", endDateRaw);
    if (outId && !outbound) return { error: "Chuyến đi không hợp lệ." };
    if (retId && !ret) return { error: "Chuyến về không hợp lệ." };
    if (!outbound || !ret) return { error: `Không tạo được chuyến xe của ${bus.title} cho ngày đi/về — kiểm tra lộ trình nhà xe.` };

    const picked = [...new Set(fd.getAll("roomIds").map(String).filter(Boolean))];
    const c = await computeAvailability(serviceId, checkInKey, endDateRaw, people);
    const opts = c?.stayOptions ?? [];
    if (opts.length && picked.length === 0) return { error: "Chọn ít nhất 1 phòng." };
    const chosen = picked.map((pid) => opts.find((o) => o.id === pid));
    if (chosen.some((o) => !o)) return { error: "Phòng đã chọn không hợp lệ — tải lại danh sách." };
    const rooms = chosen as NonNullable<(typeof chosen)[number]>[];
    const roomRows = rooms.length
      ? await prisma.room.findMany({ where: { id: { in: picked } }, select: { id: true, roomTypeId: true } })
      : [];

    // Đoàn đông hơn tổng sức chứa chuẩn của các phòng ⇒ cộng phụ thu người thêm vào tiền phòng.
    const comboExtra = adminExtraCost(people, rooms.map((o) => o.capacity), toNumber(service.extraPersonFee), c?.nights ?? 1);
    const roomSuggest = rooms.length && rooms.every((o) => o.pricePerUnit != null)
      ? rooms.reduce((n, o) => n + (o.pricePerUnit ?? 0), 0) + comboExtra.cost
      : null;
    const fare = outbound ? await cabinJourneyFare(bus.id, [outbound, ...(ret ? [ret] : [])], Boolean(ret), origin) : null;
    const busSuggest = fare == null ? null : cabinSeatTotal(fare, shared, solo);
    roomAmount = money(fd, "roomAmount") ?? roomSuggest;
    busAmount = money(fd, "busAmount") ?? busSuggest;
    const discount = money(fd, "discount") ?? 0;
    suggested = roomAmount != null || busAmount != null ? Math.max(0, (roomAmount ?? 0) + (busAmount ?? 0) - discount) : null;

    category = "COMBO";
    serviceTitle = `Combo Tà Xùa: ${bus.title} + ${service.title}`;
    bookingUseDate = checkInKey; // giữ phòng đúng các đêm [nhận phòng, trả phòng)
    endDate = endDateRaw;
    nights = c?.nights ?? null;
    fixedQuantity = people;
    adults = Math.max(1, people - comboPayingKids);
    roomIds = picked;
    roomId = picked[0] ?? null;
    roomTypeId = roomRows.find((r) => r.id === roomId)?.roomTypeId ?? null;
    cabinTripId = outbound.id;
    cabinReturnTripId = ret.id;
    seatsSingle = people;
    seatsDouble = 0;
    cabinShared = shared;
    cabinSolo = solo;
    stayCommission = rooms.reduce((n, o) => n + (o.commission ?? 0), 0);
    busCommission = busCommissionFor(bus.busCommission, people, 2);
    const tickets = [shared ? `${shared} khách nằm ghép (cabin đôi)` : null, solo ? `${solo} khách nằm riêng (cabin đơn)` : null].filter(Boolean).join(" + ");
    const busWhen =
      `đi ${toDateKey(outbound.departureDate)} ${outbound.departureTime}, về ${toDateKey(ret.departureDate)} ${ret.departureTime}`;
    selectionLabel =
      `Combo: xe ${bus.title} từ ${origin} (${busWhen}) · ${rooms.map((o) => o.name).join(", ") || "chưa chọn phòng"} · ` +
      `${nights ?? 0} đêm (${checkInKey}→${endDateRaw}) · ${people} khách · xe: ${tickets}` +
      (comboExtra.cost > 0 ? ` · +${comboExtra.extraGuests} khách phụ thu ${formatPrice(comboExtra.cost)}` : "");
  } else if (service.category === "CABIN") {
    const shared = int(fd, "shared");
    const solo = int(fd, "solo");
    const people = shared + solo;
    if (people < 1) return { error: "Nhập số khách nằm ghép / nằm riêng." };
    const outId = str(fd, "cabinTripId");
    const retId = str(fd, "cabinReturnTripId");
    // Không chọn chuyến ⇒ tự gán chuyến theo ngày đi (+ ngày về nếu có) — lịch luôn mở bán,
    // để vé hiện trên lịch nhà xe và được giữ chỗ như đơn đặt web.
    const outbound = outId
      ? await resolveAdminTrip(outId, serviceId, "OUTBOUND")
      : await ensureTripOnDate(serviceId, "OUTBOUND", useDate);
    const ret = retId
      ? await resolveAdminTrip(retId, serviceId, "RETURN")
      : endDate
        ? await ensureTripOnDate(serviceId, "RETURN", endDate)
        : null;
    if (outId && !outbound) return { error: "Chuyến đi không hợp lệ." };
    if (retId && !ret) return { error: "Chuyến về không hợp lệ." };
    if (ret && !outbound) return { error: "Chọn chuyến đi trước khi chọn chuyến về." };

    quantity = people;
    cabinShared = shared;
    cabinSolo = solo;
    busCommission = busCommissionFor(service.busCommission, people, retId || endDate ? 2 : 1);
    if (outbound) {
      // Có chuyến ⇒ giữ chỗ theo số khách ở kho vé thường (giống luồng đặt web).
      cabinTripId = outbound.id;
      cabinReturnTripId = ret?.id ?? null;
      seatsSingle = people;
      seatsDouble = 0;
      endDate = ret ? toDateKey(ret.departureDate) : endDate;
      const fare = await cabinJourneyFare(serviceId, [outbound, ...(ret ? [ret] : [])], Boolean(ret), origin);
      suggested = fare == null ? null : cabinSeatTotal(fare, shared, solo);
    }
    const tickets = [shared ? `${shared} khách nằm ghép` : null, solo ? `${solo} khách nằm riêng` : null]
      .filter(Boolean)
      .join(" + ");
    const when = outbound
      ? ret
        ? `đi ${toDateKey(outbound.departureDate)} ${outbound.departureTime}, về ${toDateKey(ret.departureDate)} ${ret.departureTime}`
        : `${toDateKey(outbound.departureDate)} ${outbound.departureTime}`
      : "chưa gán chuyến";
    selectionLabel = `${ret || endDate ? "Khứ hồi" : "Một chiều"} từ ${origin} · ${tickets} · ${when}`;
  } else if (kind === "stay") {
    // Homestay: chọn 1 hoặc NHIỀU phòng cùng home (giống đặt web nhiều phòng) — quantity = số
    // phòng, số khách ở adults (trẻ em của đơn cũ giữ nguyên khi sửa).
    const picked = [...new Set([...fd.getAll("roomIds").map(String), str(fd, "roomId")].filter(Boolean))];
    const c = await computeAvailability(serviceId, useDate, endDate, quantity);
    const opts = c?.stayOptions ?? [];
    if (opts.length && picked.length === 0) return { error: "Chọn phòng." };
    const chosen = picked.map((pid) => opts.find((o) => o.id === pid));
    if (chosen.some((o) => !o)) return { error: "Phòng đã chọn không hợp lệ — tải lại danh sách." };
    const rooms = chosen as NonNullable<(typeof chosen)[number]>[];
    nights = c?.nights ?? null;
    if (rooms.length) {
      const first = await prisma.room.findUnique({ where: { id: rooms[0].id }, select: { roomTypeId: true } });
      roomId = rooms[0].id;
      roomTypeId = first?.roomTypeId ?? null;
      roomIds = rooms.length > 1 ? rooms.map((o) => o.id) : [];
      stayCommission = rooms.reduce((n, o) => n + (o.commission ?? 0), 0);
      // Số khách vượt tổng sức chứa chuẩn của các phòng ⇒ cộng phụ thu người thêm (như đặt web).
      const extra = adminExtraCost(quantity, rooms.map((o) => o.capacity), toNumber(service.extraPersonFee), nights ?? 1);
      suggested = rooms.every((o) => o.pricePerUnit != null)
        ? rooms.reduce((n, o) => n + (o.pricePerUnit ?? 0), 0) + extra.cost
        : null;
      fixedQuantity = rooms.length;
      adults = Math.max(1, quantity - childKids);
      selectionLabel =
        `${rooms.map((o) => o.name).join(" + ")} · ${quantity} khách` +
        (extra.cost > 0 ? ` · +${extra.extraGuests} khách phụ thu ${formatPrice(extra.cost)}` : "");
    } else {
      suggested = c?.basePrice != null ? c.basePrice * quantity : null;
    }
  } else if (kind === "rental") {
    const pick = str(fd, "rentalVehicleId");
    const c = await computeAvailability(serviceId, useDate, endDate, quantity);
    const opts = c?.stayOptions ?? [];
    if (opts.length && !pick) return { error: "Chọn loại xe." };
    const opt = opts.find((o) => o.id === pick);
    if (pick && !opt) return { error: "Lựa chọn không hợp lệ — tải lại danh sách." };
    nights = c?.nights ?? null;
    if (opt) {
      rentalVehicleId = opt.id;
      suggested = opt.pricePerUnit != null ? opt.pricePerUnit * quantity : null;
      selectionLabel = `${opt.name} × ${quantity}`;
    } else {
      suggested = c?.basePrice != null ? c.basePrice * quantity : null;
    }
  } else {
    const c = await computeAvailability(serviceId, useDate, endDate, quantity);
    suggested = c?.transport?.fixedPrice ?? null;
  }

  const price = money(fd, "price") ?? suggested;
  const commissionAmount = ctvId
    ? roomId || isCombo
      ? (stayCommission ?? 0)
      : await resolveCommission(serviceId, ctvId)
    : 0;

  return {
    isCombo,
    data: {
      category,
      serviceId,
      serviceTitle,
      customerName,
      phone,
      customerFacebook,
      // Cabin/combo: ghi điểm đón (tuyến) vào ghi chú như đơn đặt web ("Đón: …") để trang
      // chi tiết / tin nhắn nhà xe hiện đúng điểm đón thay vì điểm mặc định của chuyến.
      note:
        [str(fd, "note") || null, isCombo || service.category === "CABIN" ? `Đón: ${origin}` : null]
          .filter(Boolean)
          .join(" · ") || null,
      adminNote: str(fd, "adminNote") || null,
      useDate: parseDateOnly(bookingUseDate),
      endDate: endDate ? parseDateOnly(endDate) : null,
      nights,
      quantity: fixedQuantity ?? (roomId ? 1 : quantity),
      adults: adults ?? (roomId ? quantity : null),
      ...(prev ? { childrenAges: prev.childrenAges } : {}),
      roomTypeId,
      roomId,
      roomIds,
      roomAmount,
      busAmount,
      rentalVehicleId,
      cabinTripId,
      cabinReturnTripId,
      seatsSingle,
      seatsDouble,
      cabinShared,
      cabinSolo,
      selectionLabel,
      referencePrice: price,
      ctvId,
      commissionAmount,
      roomCommission: roomId ? stayCommission : null,
      busCommission,
    },
  };
}

/**
 * ADMIN tạo đơn HỘ KHÁCH ngay trong trang quản trị: chọn dịch vụ + lựa chọn cụ thể,
 * đặt sẵn trạng thái xử lý & tiền đã thu. Trạng thái giữ chỗ (Đã xác nhận/Hoàn thành)
 * ⇒ trừ tồn ngay trong cùng transaction (thiếu chỗ ⇒ báo lỗi, không tạo đơn).
 */
export async function createAdminBooking(
  _prev: CreateAdminBookingState,
  fd: FormData,
): Promise<CreateAdminBookingState> {
  await requireAdmin();
  const session = await getSession();
  const by = session?.name || session?.username || "Admin";
  const status = str(fd, "status") as BookingStatus;
  const paymentStatus = str(fd, "paymentStatus") as PaymentStatus;
  if (!STATUSES.includes(status)) return { error: "Trạng thái không hợp lệ." };
  if (!PAYMENTS.includes(paymentStatus)) return { error: "Tình trạng thanh toán không hợp lệ." };

  const built = await buildAdminBookingData(fd);
  if ("error" in built) return { error: built.error };
  const { data } = built;
  const price = data.referencePrice == null ? null : Number(data.referencePrice);

  let collected = money(fd, "amountCollected");
  if (paymentStatus === "UNPAID") collected = null;
  if (paymentStatus === "DEPOSITED" && !collected) return { error: "Nhập số tiền khách đã cọc." };
  if (paymentStatus === "PAID" && !collected) {
    if (price == null) return { error: "Nhập tổng tiền hoặc số tiền đã thu." };
    collected = price;
  }
  const payMethod = str(fd, "payMethod") || "Chuyển khoản";
  const skipInventory = fd.get("skipInventory") === "on";

  let code = generateBookingCode();
  for (let i = 0; i < 5; i++) {
    if (!(await prisma.bookingRequest.findUnique({ where: { code } }))) break;
    code = generateBookingCode();
  }

  let id: string;
  try {
    id = await prisma.$transaction(async (tx) => {
      const b = await tx.bookingRequest.create({
        data: {
          code,
          ...data,
          needsConfirmation: status === "NEW",
          status,
          paymentStatus,
          amountCollected: collected,
          paidAt: paymentStatus === "PAID" ? new Date() : null,
          cancelReason: status === "CANCELLED" ? "Tạo đơn ở trạng thái huỷ" : null,
        },
      });

      // "Nhập bù đơn cũ": phòng/vé thường đã được đánh dấu kín sẵn trên lịch → chỉ ghi
      // nhận đơn, KHÔNG giữ chỗ (inventoryApplied = false ⇒ huỷ sau cũng không trả tồn).
      if (statusHoldsInventory(status) && !skipInventory) {
        if (b.roomTypeId) await assignRoomsForBooking(tx, b, true);
        if (b.cabinTripId || b.rentalVehicleId) await adjustInventory(tx, b, -1);
        if (b.roomTypeId || b.cabinTripId || b.rentalVehicleId) {
          await tx.bookingRequest.update({ where: { id: b.id }, data: { inventoryApplied: true } });
        }
      }

      const logs = [
        {
          kind: "SYSTEM",
          title: "Admin tạo đơn hộ khách",
          body: `Trạng thái: ${BOOKING_STATUS_META[status].label}${price != null ? ` · Tổng ${formatPrice(price)}` : ""}`,
        },
      ];
      if (skipInventory) {
        logs.push({
          kind: "SYSTEM",
          title: "Nhập bù đơn cũ — không trừ tồn",
          body: "Lịch phòng/vé giữ nguyên như đã đánh dấu trước đó.",
        });
      }
      if (collected) {
        logs.push({
          kind: "PAYMENT",
          title: `${PAY_LABEL[paymentStatus]} ${formatPrice(collected)}`,
          body: payMethod,
        });
      }
      await tx.bookingLog.createMany({ data: logs.map((l) => ({ ...l, bookingId: b.id, by })) });
      return b.id;
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Có lỗi xảy ra." };
  }

  for (const p of ["/admin/bookings", "/admin/reports", "/admin/provider/don", "/admin/availability", "/admin/ctv/don"]) {
    revalidatePath(p);
  }
  redirect(`/admin/bookings/${id}`);
}

/* ============================ Sửa đơn ============================ */

/**
 * SỬA TOÀN BỘ ĐƠN (chỉ ADMIN) — cùng form với tạo đơn hộ khách: đổi được danh mục, homestay,
 * phòng (nhiều phòng), nhà xe, chuyến đi/về, cách nằm, tuyến đón, ngày, số khách, khách, CTV,
 * tiền. Trạng thái & thanh toán GIỮ NGUYÊN (đổi ở trang đơn). Đơn đang giữ chỗ ⇒ trả chỗ theo
 * thông tin cũ rồi giữ lại theo thông tin mới trong CÙNG transaction (lỗi ⇒ không lưu gì).
 * Giá nhập trong form là giá CHƯA gồm phụ thu — phụ thu đã ghi ở đơn được cộng lại.
 */
export async function updateAdminBooking(
  _prev: CreateAdminBookingState,
  fd: FormData,
): Promise<CreateAdminBookingState> {
  await requireAdmin();
  const session = await getSession();
  const by = session?.name || session?.username || "Admin";
  const id = str(fd, "bookingId");
  const old = await prisma.bookingRequest.findUnique({ where: { id } });
  if (!old) return { error: "Không tìm thấy đơn." };

  const built = await buildAdminBookingData(fd, old);
  if ("error" in built) return { error: built.error };
  const data = { ...built.data };
  const surchargeTotal = parseSurcharges(old.surcharges).reduce((n, s) => n + s.amount, 0);
  if (data.referencePrice != null && surchargeTotal) data.referencePrice = Number(data.referencePrice) + surchargeTotal;
  // Hoa hồng CTV đã trả ⇒ giữ nguyên số đã trả.
  if (old.commissionPaid && old.ctvId === data.ctvId) data.commissionAmount = old.commissionAmount;

  // Nhật ký: các trường đổi.
  const fmtD = (d: Date | string | null | undefined) => (d ? (typeof d === "string" ? d.slice(0, 10) : toDateKey(d)) : "—");
  const num = (v: unknown) => (v == null ? null : Number(v));
  const changes: string[] = [];
  const diff = (label: string, a: unknown, c: unknown) => {
    if (String(a ?? "") !== String(c ?? "")) changes.push(`${label}: ${a ?? "—"} → ${c ?? "—"}`);
  };
  diff("Dịch vụ", old.serviceTitle, data.serviceTitle);
  diff("Lựa chọn", old.selectionLabel, data.selectionLabel);
  diff("Ngày", fmtD(old.useDate), fmtD(data.useDate as Date));
  diff("Đến ngày", fmtD(old.endDate), fmtD(data.endDate as Date | null));
  diff("Số lượng", old.quantity, data.quantity);
  diff("Khách", old.customerName, data.customerName);
  diff("SĐT", old.phone, data.phone);
  diff("Facebook", old.customerFacebook, data.customerFacebook);
  diff("Ghi chú", old.note, data.note);
  diff("Ghi chú nội bộ", old.adminNote, data.adminNote);
  diff("CTV", old.ctvId ?? "—", data.ctvId ?? "—");
  diff("Tổng tiền", num(old.referencePrice), num(data.referencePrice));
  diff("Tiền phòng", num(old.roomAmount), num(data.roomAmount));
  diff("Tiền xe", num(old.busAmount), num(data.busAmount));
  const sameIds = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));
  const oldRooms = old.roomIds.length ? old.roomIds : old.roomId ? [old.roomId] : [];
  const newRooms = (data.roomIds as string[] | undefined)?.length ? (data.roomIds as string[]) : data.roomId ? [data.roomId] : [];
  if (!sameIds(oldRooms, newRooms)) changes.push(`Phòng: ${oldRooms.length} → ${newRooms.length} phòng (đã đổi)`);
  if (old.cabinTripId !== data.cabinTripId || old.cabinReturnTripId !== data.cabinReturnTripId) changes.push("Chuyến xe: đã đổi");
  if (changes.length === 0) return { error: "Không có thay đổi nào." };

  try {
    await prisma.$transaction(async (tx) => {
      if (old.inventoryApplied) {
        // Trả chỗ theo thông tin CŨ…
        if (old.roomTypeId) await assignRoomsForBooking(tx, old, false);
        if (old.cabinTripId || old.rentalVehicleId) await adjustInventory(tx, old, +1);
      }
      const nb = await tx.bookingRequest.update({
        where: { id },
        data: {
          ...data,
          // Bỏ trống các tham chiếu cũ không còn dùng (đổi danh mục / bỏ chuyến…).
          roomIds: data.roomIds ?? [],
        },
      });
      if (old.inventoryApplied) {
        // …rồi giữ lại theo thông tin MỚI (thiếu chỗ ⇒ throw ⇒ rollback toàn bộ).
        if (nb.roomTypeId) await assignRoomsForBooking(tx, nb, true);
        if (nb.cabinTripId || nb.rentalVehicleId) await adjustInventory(tx, nb, -1);
        if (!nb.roomTypeId && !nb.cabinTripId && !nb.rentalVehicleId) {
          await tx.bookingRequest.update({ where: { id }, data: { inventoryApplied: false } });
        }
      }
      await tx.bookingLog.create({
        data: { bookingId: id, kind: "SYSTEM", title: "Sửa đơn", body: changes.join("\n"), by },
      });
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Có lỗi xảy ra." };
  }

  for (const p of ["/admin/bookings", "/admin/reports", "/admin/provider/don", "/admin/availability", "/admin/ctv/don", `/admin/bookings/${id}`]) {
    revalidatePath(p);
  }
  if (str(fd, "stay") === "1") return { ok: true }; // sửa trong popup → ở lại trang đang xem
  redirect(`/admin/bookings/${id}`);
}
