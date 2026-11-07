"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { BookingStatus, PaymentStatus } from "@prisma/client";
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

  const service = await prisma.service.findUnique({ where: { id: serviceId }, select: { category: true } });
  if (!service) return { kind: "manual", nights: 0, error: "Không tìm thấy dịch vụ." };

  if (service.category === "CABIN") {
    const map = (t: { id: string; departureDate: Date; departureTime: string; route: string; price: unknown; seatsAvailable: number; status: string }): CabinTripItem => ({
      id: t.id,
      label: `${toDateKey(t.departureDate)} ${t.departureTime} · ${t.route}`,
      price: toNumber(t.price as never),
      seatsAvailable: t.seatsAvailable,
      status: t.status,
    });
    const [outbound, returns] = await Promise.all([
      prisma.cabinTrip.findMany({
        where: { serviceId, direction: "OUTBOUND", departureDate: parseDateOnly(from) },
        orderBy: { departureTime: "asc" },
      }),
      to
        ? prisma.cabinTrip.findMany({
            where: { serviceId, direction: "RETURN", departureDate: parseDateOnly(to) },
            orderBy: { departureTime: "asc" },
          })
        : Promise.resolve([]),
    ]);
    return { kind: "trip", nights: 0, outbound: outbound.map(map), returns: returns.map(map) };
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
  const trips = await prisma.cabinTrip.findMany({
    where: { serviceId, id: { in: [outId, ...(retId ? [retId] : [])] } },
    select: { price: true },
  });
  return { options: [], fallback: trips.length ? await cabinJourneyFare(serviceId, trips, roundTrip) : null };
}

/* ============================ Tạo đơn ============================ */

export interface CreateAdminBookingState {
  error?: string;
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

  const serviceId = str(fd, "serviceId");
  const customerName = str(fd, "customerName");
  const phone = str(fd, "phone");
  const useDate = str(fd, "useDate");
  const endDateRaw = str(fd, "endDate");
  const status = str(fd, "status") as BookingStatus;
  const paymentStatus = str(fd, "paymentStatus") as PaymentStatus;
  const ctvId = str(fd, "ctvId") || null;
  // Điểm xuất phát (tuyến) của khách — quyết định giá chặng cabin; mặc định như web.
  const origin = str(fd, "origin") || "Hà Nội";

  if (!serviceId) return { error: "Chọn dịch vụ." };
  if (!customerName) return { error: "Nhập tên khách." };
  if (!/^[0-9+().\s-]{8,15}$/.test(phone)) return { error: "Số điện thoại không hợp lệ." };
  const customerFacebook = normalizeFacebookUrl(str(fd, "customerFacebook"));
  if (customerFacebook === undefined) return { error: "Link Facebook không hợp lệ." };
  if (!isValidDateKey(useDate)) return { error: "Chọn ngày sử dụng." };
  if (endDateRaw && (!isValidDateKey(endDateRaw) || endDateRaw < useDate)) return { error: "Ngày kết thúc phải từ ngày bắt đầu trở đi." };
  if (!STATUSES.includes(status)) return { error: "Trạng thái không hợp lệ." };
  if (!PAYMENTS.includes(paymentStatus)) return { error: "Tình trạng thanh toán không hợp lệ." };

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
    const outbound = outId ? await prisma.cabinTrip.findFirst({ where: { id: outId, serviceId: bus.id, direction: "OUTBOUND" } }) : null;
    const ret = retId ? await prisma.cabinTrip.findFirst({ where: { id: retId, serviceId: bus.id, direction: "RETURN" } }) : null;
    if (outId && !outbound) return { error: "Chuyến đi không hợp lệ." };
    if (retId && !ret) return { error: "Chuyến về không hợp lệ." };
    if (ret && !outbound) return { error: "Chọn chuyến đi trước khi chọn chuyến về." };

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

    const roomSuggest = rooms.length && rooms.every((o) => o.pricePerUnit != null)
      ? rooms.reduce((n, o) => n + (o.pricePerUnit ?? 0), 0)
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
    adults = people;
    roomIds = picked;
    roomId = picked[0] ?? null;
    roomTypeId = roomRows.find((r) => r.id === roomId)?.roomTypeId ?? null;
    if (outbound) {
      cabinTripId = outbound.id;
      cabinReturnTripId = ret?.id ?? null;
      seatsSingle = people;
      seatsDouble = 0;
    }
    stayCommission = rooms.reduce((n, o) => n + (o.commission ?? 0), 0);
    busCommission = busCommissionFor(bus.busCommission, people, 2);
    const tickets = [shared ? `${shared} nằm ghép` : null, solo ? `${solo} nằm riêng` : null].filter(Boolean).join(" + ");
    const busWhen = outbound
      ? `đi ${toDateKey(outbound.departureDate)} ${outbound.departureTime}` +
        (ret ? `, về ${toDateKey(ret.departureDate)} ${ret.departureTime}` : "")
      : "chưa gán chuyến";
    selectionLabel =
      `Combo: xe ${bus.title} từ ${origin} (${busWhen}) · ${rooms.map((o) => o.name).join(", ") || "chưa chọn phòng"} · ` +
      `${nights ?? 0} đêm (${checkInKey}→${endDateRaw}) · ${people} khách · xe: ${tickets}`;
  } else if (service.category === "CABIN") {
    const shared = int(fd, "shared");
    const solo = int(fd, "solo");
    const people = shared + solo;
    if (people < 1) return { error: "Nhập số khách nằm ghép / nằm riêng." };
    const outId = str(fd, "cabinTripId");
    const retId = str(fd, "cabinReturnTripId");
    const outbound = outId
      ? await prisma.cabinTrip.findFirst({ where: { id: outId, serviceId, direction: "OUTBOUND" } })
      : null;
    const ret = retId ? await prisma.cabinTrip.findFirst({ where: { id: retId, serviceId, direction: "RETURN" } }) : null;
    if (outId && !outbound) return { error: "Chuyến đi không hợp lệ." };
    if (retId && !ret) return { error: "Chuyến về không hợp lệ." };
    if (ret && !outbound) return { error: "Chọn chuyến đi trước khi chọn chuyến về." };

    quantity = people;
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
  } else if (kind === "stay" || kind === "rental") {
    const pick = str(fd, kind === "stay" ? "roomId" : "rentalVehicleId");
    const c = await computeAvailability(serviceId, useDate, endDate, quantity);
    const opts = c?.stayOptions ?? [];
    if (opts.length && !pick) return { error: kind === "stay" ? "Chọn phòng." : "Chọn loại xe." };
    const opt = opts.find((o) => o.id === pick);
    if (pick && !opt) return { error: "Lựa chọn không hợp lệ — tải lại danh sách." };
    nights = c?.nights ?? null;
    if (opt && kind === "stay") {
      const room = await prisma.room.findUnique({ where: { id: opt.id }, select: { roomTypeId: true } });
      roomId = opt.id;
      roomTypeId = room?.roomTypeId ?? null;
      stayCommission = opt.commission ?? 0;
      suggested = opt.pricePerUnit;
      selectionLabel = `${opt.name} · ${quantity} khách`;
    } else if (opt) {
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
  let collected = money(fd, "amountCollected");
  if (paymentStatus === "UNPAID") collected = null;
  if (paymentStatus === "DEPOSITED" && !collected) return { error: "Nhập số tiền khách đã cọc." };
  if (paymentStatus === "PAID" && !collected) {
    if (price == null) return { error: "Nhập tổng tiền hoặc số tiền đã thu." };
    collected = price;
  }
  const payMethod = str(fd, "payMethod") || "Chuyển khoản";
  const skipInventory = fd.get("skipInventory") === "on";

  const commissionAmount = ctvId
    ? roomId || isCombo
      ? (stayCommission ?? 0)
      : await resolveCommission(serviceId, ctvId)
    : 0;

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
          category,
          serviceId,
          serviceTitle,
          customerName,
          phone,
          customerFacebook,
          note: str(fd, "note") || null,
          adminNote: str(fd, "adminNote") || null,
          useDate: parseDateOnly(bookingUseDate),
          endDate: endDate ? parseDateOnly(endDate) : null,
          nights,
          quantity: fixedQuantity ?? (roomId ? 1 : quantity),
          adults: adults ?? (roomId ? quantity : null),
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
          selectionLabel,
          referencePrice: price,
          needsConfirmation: status === "NEW",
          status,
          paymentStatus,
          amountCollected: collected,
          paidAt: paymentStatus === "PAID" ? new Date() : null,
          ctvId,
          commissionAmount,
          roomCommission: roomId ? stayCommission : null,
          busCommission,
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
