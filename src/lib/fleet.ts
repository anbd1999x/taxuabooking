import "server-only";
import { Prisma, type FleetPayment, type FleetRental, type FleetServiceLog, type FleetVehicle } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/format";
import { parseDateOnly, toDateKey, today } from "@/lib/dates";
import type { SessionPayload } from "@/lib/auth-token";
import {
  autoPick,
  normalizeConfig,
  vnNow,
  type FleetCond,
  type FleetConfig,
  type FleetFee,
  type FleetHand,
  type FleetKind,
  type FleetMode,
  type FleetRentalVM,
  type FleetRet,
  type FleetVehicleVM,
} from "@/lib/fleet-core";

/**
 * Đội xe cho thuê (chủ dịch vụ xe máy): nạp dữ liệu, kiểm quyền, tự xếp xe cho đơn web.
 * Đơn web (BookingRequest MOTORBIKE) KHÔNG trừ trực tiếp vào xe — `syncFleetBookings` đối chiếu:
 *  - đơn còn hiệu lực chưa từng được xếp ⇒ tự chọn xe rảnh phù hợp (cùng loại xe web nếu có gắn),
 *    lượt thuê ở trạng thái "Đơn web · chờ duyệt" (`webPending`) cho tới khi chủ xe xác nhận;
 *  - đơn đã huỷ ⇒ huỷ các lượt thuê sinh ra từ đơn đó (xe trống lại);
 *  - đơn đổi ngày/giờ ⇒ cập nhật lượt thuê chưa giao.
 * Gọi khi mở trang quản lý xe và ngay sau khi khách đặt (không chặn luồng đặt nếu lỗi).
 */

export const todayKey = () => toDateKey(today());

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function fleetCode(): string {
  return "XM-" + Array.from({ length: 5 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join("");
}

/** DateTime → "yyyy-mm-dd HH:MM" theo giờ Việt Nam. */
export const vnStamp = (d: Date) => new Date(d.getTime() + 7 * 3_600_000).toISOString().slice(0, 16).replace("T", " ");

export function vehicleVM(v: FleetVehicle & { serviceLogs?: FleetServiceLog[] }): FleetVehicleVM {
  return {
    id: v.id,
    name: v.name,
    plate: v.plate,
    kind: (["so", "ga", "con"].includes(v.kind) ? v.kind : "ga") as FleetKind,
    color: v.color ?? "",
    year: v.year,
    odo: v.odo,
    price: toNumber(v.pricePerDay) ?? 0,
    cond: (["good", "ok", "service"].includes(v.condition) ? v.condition : "good") as FleetCond,
    mode: (["ready", "maint", "off"].includes(v.mode) ? v.mode : "ready") as FleetMode,
    note: v.note ?? "",
    imageUrl: v.imageUrl,
    media: v.media?.length ? v.media : v.imageUrl ? [v.imageUrl] : [],
    rentalVehicleId: v.rentalVehicleId,
    oilEvery: v.oilEvery || 2000,
    lastOil: v.lastOilOdo ?? v.odo,
    insExp: v.insuranceExp ? toDateKey(v.insuranceExp) : null,
    svc: (v.serviceLogs ?? [])
      .slice()
      .sort((a, b) => b.date.getTime() - a.date.getTime() || b.createdAt.getTime() - a.createdAt.getTime())
      .map((x) => ({ id: x.id, d: toDateKey(x.date), what: x.what, cost: toNumber(x.cost) ?? 0, odo: x.odo })),
  };
}

const asObj = <T,>(j: Prisma.JsonValue | null | undefined): T | null => (j && typeof j === "object" && !Array.isArray(j) ? (j as unknown as T) : null);

export function rentalVM(r: FleetRental & { booking?: { code: string } | null; payments?: FleetPayment[] }): FleetRentalVM {
  const hand = asObj<FleetHand>(r.hand);
  const ret = asObj<FleetRet>(r.ret);
  const fees = Array.isArray(r.fees) ? (r.fees as unknown as FleetFee[]).filter((f) => f && typeof f.amt === "number") : [];
  return {
    id: r.id,
    code: r.code,
    vid: r.vehicleId,
    bookingId: r.bookingId,
    bookingCode: r.booking?.code ?? null,
    name: r.customerName,
    phone: r.phone,
    cccd: r.cccd ?? "",
    s: toDateKey(r.startDate),
    e: toDateKey(r.endDate),
    st: r.startTime,
    et: r.endTime,
    total: toNumber(r.total) ?? 0,
    deposit: toNumber(r.deposit) ?? 0,
    place: r.place ?? "",
    src: r.source,
    note: r.note ?? "",
    cancelled: r.state === "cancel",
    web: r.webPending,
    ctv: r.ctvName ?? "",
    hand: hand ? { odo: Number(hand.odo) || 0, fuel: hand.fuel ?? "Đầy", acc: Array.isArray(hand.acc) ? hand.acc : [], doc: hand.doc ?? "Không giữ", photos: Array.isArray(hand.photos) ? hand.photos : [], at: hand.at ?? "", by: hand.by ?? "" } : null,
    ret: ret ? { odo: Number(ret.odo) || 0, fuel: ret.fuel ?? "Đầy", at: ret.at ?? "", by: ret.by ?? "" } : null,
    fees,
    pays: (r.payments ?? [])
      .slice()
      .sort((a, b) => a.at.getTime() - b.at.getTime())
      .map((p) => ({ id: p.id, at: vnStamp(p.at), amt: toNumber(p.amount) ?? 0, method: p.method, kind: p.kind, by: p.by ?? "" })),
  };
}

/** Dịch vụ thuê xe máy mà phiên được quản lý (chủ dịch vụ: của mình; admin: tất cả). */
export async function fleetServicesFor(session: SessionPayload) {
  return prisma.service.findMany({
    where: {
      category: "MOTORBIKE",
      ...(session.role === "ADMIN" ? {} : { ownerId: session.sub }),
    },
    orderBy: [{ published: "desc" }, { title: "asc" }],
    select: {
      id: true,
      title: true,
      area: true,
      contactPhone: true,
      owner: { select: { phone: true } },
      rentalVehicles: { select: { id: true, vehicleType: true }, orderBy: { sortOrder: "asc" } },
    },
  });
}

/** Kiểm quyền thao tác trên dịch vụ. Trả service hoặc null. */
export async function canManageFleet(session: SessionPayload | null, serviceId: string) {
  if (!session || (session.role !== "ADMIN" && session.role !== "PROVIDER")) return null;
  return prisma.service.findFirst({
    where: { id: serviceId, category: "MOTORBIKE", ...(session.role === "ADMIN" ? {} : { ownerId: session.sub }) },
    select: { id: true, title: true },
  });
}

export async function loadConfig(serviceId: string): Promise<FleetConfig> {
  const row = await prisma.fleetConfig.findUnique({ where: { serviceId } });
  return normalizeConfig(row?.data);
}

export async function saveConfig(serviceId: string, cfg: FleetConfig): Promise<void> {
  const data = normalizeConfig(cfg) as unknown as Prisma.InputJsonValue;
  await prisma.fleetConfig.upsert({ where: { serviceId }, create: { serviceId, data }, update: { data } });
}

/** Toàn bộ dữ liệu đội xe của một dịch vụ (xe + lượt thuê từ đầu năm trước + cấu hình). */
export async function loadFleet(serviceId: string) {
  const since = parseDateOnly(`${new Date().getUTCFullYear() - 1}-01-01`);
  const [vehicles, rentals, pending, config] = await Promise.all([
    prisma.fleetVehicle.findMany({
      where: { serviceId },
      include: { serviceLogs: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
    prisma.fleetRental.findMany({
      where: { vehicle: { serviceId }, endDate: { gte: since } },
      include: { booking: { select: { code: true } }, payments: true },
      orderBy: { startDate: "asc" },
    }),
    unassignedBookings(serviceId),
    loadConfig(serviceId),
  ]);
  return { vehicles: vehicles.map(vehicleVM), rentals: rentals.map(rentalVM), pending, config, ...vnNow() };
}

/** Đơn web còn hiệu lực nhưng chưa đủ xe (thiếu xe trống lúc xếp). */
async function unassignedBookings(serviceId: string) {
  const list = await prisma.bookingRequest.findMany({
    where: {
      serviceId,
      category: "MOTORBIKE",
      status: { not: "CANCELLED" },
      OR: [{ endDate: { gte: today() } }, { endDate: null, useDate: { gte: today() } }],
    },
    select: {
      id: true, code: true, customerName: true, phone: true, useDate: true, endDate: true, quantity: true, selectionLabel: true,
      fleetRentals: { select: { state: true } },
    },
    orderBy: { useDate: "asc" },
  });
  return list
    .map((b) => ({
      id: b.id,
      code: b.code,
      name: b.customerName,
      phone: b.phone,
      s: toDateKey(b.useDate),
      e: toDateKey(b.endDate ?? b.useDate),
      qty: b.quantity,
      label: b.selectionLabel ?? "",
      assigned: b.fleetRentals.filter((r) => r.state !== "cancel").length,
      everAssigned: b.fleetRentals.length > 0,
    }))
    .filter((b) => b.assigned < b.qty && !(b.everAssigned && b.assigned === 0));
}

type Tx = Prisma.TransactionClient;

const bookingSelect = {
  id: true, serviceId: true, customerName: true, phone: true, note: true, useDate: true, endDate: true,
  pickupTime: true, returnTime: true, quantity: true, rentalVehicleId: true, referencePrice: true, amountCollected: true,
  ctvId: true, status: true, ctv: { select: { name: true } },
} as const;
type BookingRow = Prisma.BookingRequestGetPayload<{ select: typeof bookingSelect }>;

/** Tự xếp xe cho MỘT đơn web (nếu đơn chưa từng được xếp). Trả số xe đã xếp. */
async function assignBooking(tx: Tx, b: BookingRow): Promise<number> {
  if (!b.serviceId) return 0;
  const [vehiclesRaw, rentalsRaw] = await Promise.all([
    tx.fleetVehicle.findMany({ where: { serviceId: b.serviceId } }),
    tx.fleetRental.findMany({ where: { vehicle: { serviceId: b.serviceId }, endDate: { gte: parseDateOnly(toDateKey(today()) ) } } }),
  ]);
  if (!vehiclesRaw.length) return 0;
  const vehicles = vehiclesRaw.map((v) => vehicleVM(v));
  const rentals = rentalsRaw.map((r) => rentalVM(r));
  const s = toDateKey(b.useDate);
  const e = toDateKey(b.endDate ?? b.useDate);
  // Xe gắn đúng loại xe khách chọn trên web; chưa gắn xe nào cho loại đó ⇒ xét cả đội xe.
  const linked = b.rentalVehicleId ? vehicles.filter((v) => v.rentalVehicleId === b.rentalVehicleId) : [];
  const pool = linked.length ? linked : vehicles;
  const qty = Math.max(1, b.quantity);
  const picks = autoPick(pool, s, e, qty, rentals, todayKey());
  if (!picks.length) return 0;
  const total = toNumber(b.referencePrice);
  const collected = toNumber(b.amountCollected) ?? 0;
  const days = Math.max(1, Math.round((Date.parse(e) - Date.parse(s)) / 86_400_000) + 1);
  for (const v of picks) {
    const dep = Math.round(collected / qty);
    await tx.fleetRental.create({
      data: {
        code: fleetCode(),
        vehicleId: v.id,
        bookingId: b.id,
        customerName: b.customerName,
        phone: b.phone,
        startDate: parseDateOnly(s),
        endDate: parseDateOnly(e),
        startTime: b.pickupTime ?? "08:00",
        endTime: b.returnTime ?? "17:00",
        total: total != null ? Math.round(total / qty) : v.price * days,
        deposit: dep,
        place: "Theo đơn web",
        source: b.ctvId ? "CTV" : "Web",
        ctvName: b.ctv?.name ?? null,
        note: b.note,
        webPending: true,
        ...(dep > 0 ? { payments: { create: { amount: dep, method: "Chuyển khoản", kind: "Cọc", by: "Đơn web" } } } : {}),
      },
    });
  }
  return picks.length;
}

/** Tự xếp xe cho đơn vừa đặt (gọi sau createBooking). Lỗi không ảnh hưởng đơn. */
export async function autoAssignFleetForBooking(bookingId: string): Promise<void> {
  const b = await prisma.bookingRequest.findUnique({
    where: { id: bookingId },
    select: { ...bookingSelect, category: true, _count: { select: { fleetRentals: true } } },
  });
  if (!b || b.category !== "MOTORBIKE" || b.status === "CANCELLED" || b._count.fleetRentals > 0) return;
  await prisma.$transaction((tx) => assignBooking(tx, b));
}

/** Đối chiếu đơn web ↔ lượt thuê của một dịch vụ (xem chú thích đầu file). */
export async function syncFleetBookings(serviceId: string): Promise<void> {
  const hasFleet = await prisma.fleetVehicle.count({ where: { serviceId } });
  if (!hasFleet) return;
  // 1) Đơn đã huỷ ⇒ huỷ lượt thuê chưa nhận lại xe.
  await prisma.fleetRental.updateMany({
    where: { vehicle: { serviceId }, booking: { status: "CANCELLED" }, OR: [{ state: null }, { state: { not: "cancel" } }], ret: { equals: Prisma.DbNull } },
    data: { state: "cancel", webPending: false },
  });
  // 2) Đơn còn hiệu lực, chưa kết thúc.
  const bookings = await prisma.bookingRequest.findMany({
    where: {
      serviceId,
      category: "MOTORBIKE",
      status: { not: "CANCELLED" },
      OR: [{ endDate: { gte: today() } }, { endDate: null, useDate: { gte: today() } }],
    },
    select: { ...bookingSelect, fleetRentals: { select: { id: true, state: true, hand: true, startDate: true, endDate: true, startTime: true, endTime: true } } },
    orderBy: { createdAt: "asc" },
  });
  for (const b of bookings) {
    if (b.fleetRentals.length === 0) {
      await prisma.$transaction((tx) => assignBooking(tx, b));
      continue;
    }
    // Đơn đổi ngày/giờ ⇒ cập nhật các lượt chưa giao xe.
    const s = b.useDate.getTime();
    const e = (b.endDate ?? b.useDate).getTime();
    for (const r of b.fleetRentals) {
      if (r.state || r.hand) continue;
      const changed =
        r.startDate.getTime() !== s ||
        r.endDate.getTime() !== e ||
        (b.pickupTime && r.startTime !== b.pickupTime) ||
        (b.returnTime && r.endTime !== b.returnTime);
      if (changed) {
        await prisma.fleetRental.update({
          where: { id: r.id },
          data: {
            startDate: b.useDate,
            endDate: b.endDate ?? b.useDate,
            ...(b.pickupTime ? { startTime: b.pickupTime } : {}),
            ...(b.returnTime ? { endTime: b.returnTime } : {}),
          },
        });
      }
    }
  }
}
