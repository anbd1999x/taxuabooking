import "server-only";
import { Prisma, type FleetPayment, type FleetRental, type FleetServiceLog, type FleetVehicle } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/format";
import { parseDateOnly, toDateKey, today } from "@/lib/dates";
import type { SessionPayload } from "@/lib/auth-token";
import {
  autoPick,
  isVehicleFree,
  keptOf,
  poolFor,
  normalizeConfig,
  quoteRental,
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
    cancelled: r.state === "cancel" || r.state === "reject",
    rejected: r.state === "reject",
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

/**
 * Chủ dịch vụ mà phiên làm việc thay mặt: ADMIN ⇒ "all" (mọi nhà xe); PROVIDER ⇒ chính mình;
 * STAFF (nhân viên giao xe) ⇒ chủ đã tạo tài khoản (providerId) — tài khoản bị khoá ⇒ null.
 */
export async function fleetOwnerOf(session: SessionPayload | null): Promise<string | "all" | null> {
  if (!session) return null;
  if (session.role === "ADMIN") return "all";
  if (session.role === "PROVIDER") return session.sub;
  // Bản demo: chỉ đúng chủ xe demo.
  if (session.role === "DEMO") {
    const u = await prisma.adminUser.findUnique({ where: { id: session.sub }, select: { username: true } });
    return u?.username === "demo-nha-xe" ? session.sub : null;
  }
  if (session.role === "STAFF") {
    // Lễ tân homestay (staffArea "phong") KHÔNG được vào đội xe — chỉ nhân viên xe (staffArea "xe" / null cũ).
    const u = await prisma.adminUser.findUnique({ where: { id: session.sub }, select: { providerId: true, active: true, role: true, staffArea: true } });
    return u?.active && u.role === "STAFF" && u.staffArea !== "phong" && u.providerId ? u.providerId : null;
  }
  return null;
}

/** Dịch vụ thuê xe máy mà phiên được quản lý (chủ dịch vụ/nhân viên: của chủ; admin: tất cả). */
export async function fleetServicesFor(session: SessionPayload) {
  const owner = await fleetOwnerOf(session);
  if (!owner) return [];
  return prisma.service.findMany({
    where: {
      category: "MOTORBIKE",
      ...(owner === "all" ? {} : { ownerId: owner }),
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
  const owner = await fleetOwnerOf(session);
  if (!owner) return null;
  return prisma.service.findFirst({
    where: { id: serviceId, category: "MOTORBIKE", ...(owner === "all" ? {} : { ownerId: owner }) },
    select: { id: true, title: true, ownerId: true },
  });
}

/** Nhân viên thuộc đội xe (staffArea "xe" hoặc null — tài khoản cũ); lễ tân homestay ("phong") không tính. */
export const FLEET_STAFF_AREA: Prisma.AdminUserWhereInput = { OR: [{ staffArea: null }, { staffArea: { not: "phong" } }] };

/** Tài khoản nhân viên giao xe của chủ dịch vụ. */
export async function loadStaff(ownerId: string | null) {
  if (!ownerId) return [];
  const rows = await prisma.adminUser.findMany({
    where: { role: "STAFF", providerId: ownerId, ...FLEET_STAFF_AREA },
    select: { id: true, name: true, username: true, phone: true, active: true },
    orderBy: { createdAt: "asc" },
  });
  return rows;
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
  const svc = await prisma.service.findUnique({ where: { id: serviceId }, select: { ownerId: true } });
  const [vehicles, rentals, pending, config, staff] = await Promise.all([
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
    loadStaff(svc?.ownerId ?? null),
  ]);
  return { vehicles: vehicles.map(vehicleVM), rentals: rentals.map(rentalVM), pending, config, staff, hasOwner: !!svc?.ownerId, ...vnNow() };
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
      assigned: b.fleetRentals.filter((r) => r.state !== "cancel" && r.state !== "reject").length,
      rejected: b.fleetRentals.some((r) => r.state === "reject"),
    }))
    // Chủ xe đã từ chối đơn ⇒ không nhắc xếp xe nữa (đơn chờ sàn xử lý với khách).
    .filter((b) => b.assigned < b.qty && !b.rejected)
    .map((b) => ({ id: b.id, code: b.code, name: b.name, phone: b.phone, s: b.s, e: b.e, qty: b.qty, label: b.label, assigned: b.assigned }));
}

type Tx = Prisma.TransactionClient;

/** Khoá theo dịch vụ trong transaction: chặn 2 thao tác xếp xe chạy song song chọn trùng một xe. */
export async function lockFleet(tx: Tx, serviceId: string): Promise<void> {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${"fleet:" + serviceId}))::text AS ok`;
}

const bookingSelect = {
  id: true, code: true, serviceId: true, serviceTitle: true, category: true, customerName: true, phone: true, note: true,
  useDate: true, endDate: true, pickupTime: true, returnTime: true, quantity: true, rentalVehicleId: true,
  referencePrice: true, amountCollected: true, paymentStatus: true, surcharges: true, ctvId: true, status: true,
  bikeCount: true, bikeType: true, bikeFrom: true, bikeTo: true, bikePickup: true, bikeReturn: true, bikeAmount: true,
  ctv: { select: { name: true } },
} as const;
type BookingRow = Prisma.BookingRequestGetPayload<{ select: typeof bookingSelect }>;

/** Lượt thuê "đã giao xe" (có biên bản) hoặc đã trả — không được tự đổi/huỷ. */
const locked = (r: { hand: Prisma.JsonValue | null; ret: Prisma.JsonValue | null }) => r.hand != null || r.ret != null;
const addDaysKeyLocal = (k: string, n: number) => new Date(Date.parse(`${k}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const ALIVE = { OR: [{ state: null }, { state: { notIn: ["cancel", "reject"] } }] };
/**
 * Lượt thuê KHÔNG thuộc đơn `id` — GỒM CẢ lượt tạo tay (bookingId null). Không dùng `NOT: { bookingId }`:
 * SQL `NOT ("bookingId" = $1)` loại luôn dòng NULL ⇒ trước đây tự xếp / đổi ngày đơn web bỏ qua mọi đơn tại quầy
 * ⇒ xếp trùng xe đang cho khách thuê tại quầy.
 */
const notBooking = (id: string) => ({ OR: [{ bookingId: null }, { bookingId: { not: id } }] });

/** Nhu cầu xe của một đơn: đơn xe máy (đặt lẻ) hoặc xe máy THUÊ KÈM combo. */
type Demand = {
  s: string; e: string; st: string; et: string; qty: number;
  /** Lọc xe phù hợp trong một nhà xe. */
  pool: (vs: FleetVehicleVM[], typeName: (id: string | null) => string) => FleetVehicleVM[];
  total: number | null; // tổng tiền thuê (chia đều cho số xe)
  source: string; place: string; combo: boolean;
};

function demandOf(b: BookingRow): Demand | null {
  if (b.status === "CANCELLED") return null;
  if (b.category === "MOTORBIKE" && b.serviceId) {
    return {
      s: toDateKey(b.useDate), e: toDateKey(b.endDate ?? b.useDate),
      st: b.pickupTime ?? "08:00", et: b.returnTime ?? "17:00", qty: Math.max(1, b.quantity),
      pool: (vs) => poolFor(vs, b.rentalVehicleId),
      total: toNumber(b.referencePrice), source: b.ctvId ? "CTV" : "Web", place: "Theo đơn web", combo: false,
    };
  }
  if (b.category === "COMBO" && (b.bikeCount ?? 0) > 0 && b.bikeFrom && b.bikeTo) {
    const key = (b.bikeType ?? "wave").toLowerCase();
    return {
      s: toDateKey(b.bikeFrom), e: toDateKey(b.bikeTo),
      st: b.bikePickup ?? "08:00", et: b.bikeReturn ?? "17:00", qty: b.bikeCount!,
      // Xe đúng loại combo (Wave / PG1) theo tên xe hoặc tên loại xe web đã gắn.
      pool: (vs, typeName) => vs.filter((v) => `${v.name} ${typeName(v.rentalVehicleId)}`.toLowerCase().includes(key)),
      total: toNumber(b.bikeAmount), source: b.ctvId ? "CTV" : "Combo", place: `Combo · ${b.serviceTitle}`, combo: true,
    };
  }
  return null;
}

/**
 * Tiền đã thu của đơn web xe máy ↔ sổ thu chi đội xe (một nguồn số liệu):
 * sàn ghi "đã thu" ở đơn ⇒ thêm dòng "Sàn thu hộ" vào sổ xe (chia theo xe); nhà xe ghi thu ở trang xe ⇒
 * `pushFleetPayments` cập nhật lại "đã thu" + tình trạng thanh toán của đơn. Hai chiều luôn khớp tổng.
 */
async function mirrorBookingPayments(tx: Tx, b: BookingRow): Promise<void> {
  if (b.category !== "MOTORBIKE") return;
  let rentals = await tx.fleetRental.findMany({ where: { bookingId: b.id }, include: { payments: true }, orderBy: { createdAt: "asc" } });
  if (!rentals.length) return;
  const alive0 = rentals.filter((r) => r.state !== "cancel" && r.state !== "reject");
  // Lượt bị huỷ (đổi ngày phải đổi xe, giảm số xe, nhà xe huỷ 1 xe…) mà đang giữ tiền của đơn ⇒ chuyển số tiền
  // đó sang lượt còn hiệu lực của CÙNG đơn — nếu không, lúc trả xe quyết toán sẽ đòi khách trả lại lần nữa.
  // Phần nhà xe đã GIỮ CỌC khi huỷ (phí "Giữ cọc khi huỷ") là doanh thu của lượt đã huỷ — không chuyển đi.
  const strandedAmt = (r: (typeof rentals)[number]) => Math.round(r.payments.reduce((c, p) => c + Number(p.amount), 0) - keptOf(rentalVM(r)));
  const stranded = rentals.filter((r) => !alive0.includes(r) && strandedAmt(r) !== 0);
  if (stranded.length && alive0.length) {
    const to = alive0[0];
    for (const r of stranded) {
      const amt = strandedAmt(r);
      await tx.fleetRental.update({ where: { id: r.id }, data: { deposit: { decrement: amt }, payments: { create: { amount: -amt, method: "Chuyển nội bộ", kind: `Chuyển sang ${to.code}`, by: "Hệ thống" } } } });
      await tx.fleetRental.update({ where: { id: to.id }, data: { deposit: { increment: amt }, payments: { create: { amount: amt, method: "Chuyển nội bộ", kind: `Chuyển từ ${r.code} (đã huỷ)`, by: "Hệ thống" } } } });
    }
    rentals = await tx.fleetRental.findMany({ where: { bookingId: b.id }, include: { payments: true }, orderBy: { createdAt: "asc" } });
  }
  const ledger = rentals.reduce((a, r) => a + r.payments.reduce((c, p) => c + Number(p.amount), 0), 0);
  const delta = Math.round((toNumber(b.amountCollected) ?? 0) - ledger);
  if (!delta) return;
  const alive = rentals.filter((r) => r.state !== "cancel" && r.state !== "reject");
  const targets = alive.length ? alive : [rentals[rentals.length - 1]];
  const sumT = targets.reduce((a, r) => a + Number(r.total), 0) || targets.length;
  let left = delta;
  for (const [i, r] of targets.entries()) {
    const part = i === targets.length - 1 ? left : Math.round((delta * (Number(r.total) || 1)) / sumT);
    left -= part;
    if (!part) continue;
    await tx.fleetRental.update({
      where: { id: r.id },
      data: {
        deposit: { increment: part },
        payments: { create: { amount: part, method: "Sàn thu hộ", kind: part > 0 ? "Sàn ghi nhận thu" : "Sàn ghi nhận hoàn", by: "Sàn" } },
      },
    });
  }
}

/**
 * Gọi ĐẦU transaction trước khi nhà xe ghi tiền vào lượt thuê của đơn web: khoá dòng đơn (chặn sàn ghi thu
 * chen giữa) rồi đưa khoản sàn đã thu mà sổ xe chưa có vào sổ. Nếu bỏ bước này, trang xe đang mở từ trước
 * (chưa đồng bộ) ghi cọc ⇒ `pushFleetPayments` đặt "đã thu" = sổ xe ⇒ MẤT khoản sàn vừa thu; quyết toán
 * khi trả xe cũng đòi khách khoản đã trả cho sàn.
 */
export async function syncBookingLedger(tx: Tx, bookingId: string): Promise<void> {
  await tx.$queryRaw`SELECT id FROM "BookingRequest" WHERE id = ${bookingId} FOR UPDATE`;
  const b = await tx.bookingRequest.findUnique({ where: { id: bookingId }, select: bookingSelect });
  if (b) await mirrorBookingPayments(tx, b);
}

/** Sau khi nhà xe ghi thu / hoàn / phí phát sinh ở trang xe ⇒ cập nhật đơn web (đã thu, tình trạng, phụ thu, nhật ký). */
export async function pushFleetPayments(
  tx: Tx,
  bookingId: string,
  by: string,
  note: { title: string; body?: string },
  newFees: { k: string; amt: number }[] = [],
  plate = "",
): Promise<void> {
  const b = await tx.bookingRequest.findUnique({ where: { id: bookingId }, select: { category: true, referencePrice: true, surcharges: true } });
  if (!b || b.category !== "MOTORBIKE") return; // combo: tiền xe máy kèm trả riêng cho nhà xe, không vào bill combo
  const rentals = await tx.fleetRental.findMany({ where: { bookingId }, include: { payments: true } });
  const ledger = rentals.reduce((a, r) => a + r.payments.reduce((c, p) => c + Number(p.amount), 0), 0);
  // Phí phát sinh khi trả xe ⇒ phụ thu của đơn (tổng khách trả tăng tương ứng).
  const sur = Array.isArray(b.surcharges) ? [...(b.surcharges as unknown[])] : [];
  const feeTotal = newFees.reduce((a, f) => a + f.amt, 0);
  for (const f of newFees) sur.push({ id: `fleet-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, label: `${plate ? "Xe " + plate + ": " : ""}${f.k}`, amount: f.amt });
  const total = (toNumber(b.referencePrice) ?? 0) + feeTotal;
  const paymentStatus = ledger <= 0 ? "UNPAID" : total > 0 && ledger >= total ? "PAID" : "DEPOSITED";
  await tx.bookingRequest.update({
    where: { id: bookingId },
    data: {
      amountCollected: Math.max(0, ledger),
      paymentStatus,
      ...(paymentStatus === "PAID" ? { paidAt: new Date() } : {}),
      ...(feeTotal ? { surcharges: sur as Prisma.InputJsonValue, referencePrice: total } : {}),
    },
  });
  await tx.bookingLog.create({ data: { bookingId, kind: "PAYMENT", title: note.title, body: note.body ?? `Đã thu cộng dồn: ${Math.max(0, ledger).toLocaleString("vi-VN")}đ`, by } });
}

/** Chọn nhà xe cho xe máy kèm combo: nhà xe đã bật đồng bộ web, đủ xe đúng loại còn trống; ưu tiên nổi bật. */
async function pickComboService(tx: Tx, d: Demand): Promise<string | null> {
  const svcs = await tx.service.findMany({
    where: { category: "MOTORBIKE", published: true, fleetVehicles: { some: {} } },
    select: { id: true, featured: true, priorityOrder: true, fleetConfig: { select: { data: true } }, rentalVehicles: { select: { id: true, vehicleType: true } } },
    orderBy: [{ featured: "desc" }, { priorityOrder: "desc" }, { title: "asc" }],
  });
  const T = toDateKey(today());
  let best: { id: string; free: number } | null = null;
  for (const s of svcs.filter((x) => normalizeConfig(x.fleetConfig?.data).webSync)) {
    await lockFleet(tx, s.id);
    const vs = (await tx.fleetVehicle.findMany({ where: { serviceId: s.id } })).map((v) => vehicleVM(v));
    const names = new Map(s.rentalVehicles.map((r) => [r.id, r.vehicleType]));
    const rs = (await tx.fleetRental.findMany({ where: { vehicle: { serviceId: s.id }, endDate: { gte: parseDateOnly(addDaysKeyLocal(d.s < T ? d.s : T, -60)) }, ...ALIVE } })).map((r) => rentalVM(r));
    const free = autoPick(d.pool(vs, (id) => (id ? names.get(id) ?? "" : "")), d.s, d.e, d.qty, rs, T, d.st, d.et, vnNow().now).length;
    if (free >= d.qty) return s.id;
    if (free > 0 && (!best || free > best.free)) best = { id: s.id, free };
  }
  return best?.id ?? null;
}

/** Nhật ký ghi kèm mốc "· N xe" (số xe của đơn lúc đội xe xếp / tính lại) — dùng làm mốc so số xe lần trước. */
const FLEET_ASSIGN_TITLE = "Đội xe: đã xếp xe theo đơn";
const FLEET_REPRICE_TITLE = "Đội xe: tính lại tiền thuê theo lịch / số xe mới";
const COMBO_ASSIGN_TITLE = "Xe máy kèm combo: đã xếp xe";
/** Số xe của đơn ở lần đội xe xếp / tính lại gần nhất (null = đơn cũ chưa có mốc). */
async function lastQtyMark(tx: Tx, bookingId: string): Promise<number | null> {
  const logs = await tx.bookingLog.findMany({
    where: { bookingId, title: { in: [FLEET_ASSIGN_TITLE, FLEET_REPRICE_TITLE, COMBO_ASSIGN_TITLE] } },
    orderBy: { createdAt: "desc" }, take: 5, select: { body: true },
  });
  for (const l of logs) {
    const m = /· (\d+) xe(?=\s|$)/m.exec(l.body ?? "");
    if (m) return Number(m[1]);
  }
  return null;
}

/**
 * Đối chiếu MỘT đơn với đội xe (trong transaction đã khoá dịch vụ):
 *  - đơn huỷ / đổi sang dịch vụ khác / không còn nhu cầu xe ⇒ huỷ lượt chưa giao;
 *  - đổi ngày, giờ ⇒ cập nhật lượt chưa giao; xe không còn rảnh ⇒ huỷ lượt đó để xếp xe khác;
 *  - giảm số xe ⇒ huỷ bớt lượt chưa giao; thiếu xe ⇒ tự xếp thêm (trừ khi chủ xe đã từ chối đơn);
 *  - cuối cùng khớp tiền đã thu của đơn với sổ thu chi xe.
 */
async function reconcileBooking(tx: Tx, b: BookingRow, forceSvcId?: string): Promise<number> {
  const rentals = await tx.fleetRental.findMany({ where: { bookingId: b.id }, include: { vehicle: true }, orderBy: { createdAt: "asc" } });
  const alive = rentals.filter((r) => r.state !== "cancel" && r.state !== "reject");
  const T = toDateKey(today());
  const NOW = vnNow().now; // giờ VN: xe giao chưa trả quá giờ hẹn hôm nay ⇒ coi là quá hạn, vẫn đang bận
  const d = demandOf(b);
  // Nhà xe phục vụ: đơn xe máy ⇒ dịch vụ của đơn; combo ⇒ nhà xe admin chỉ định (forceSvcId), không thì
  // nhà xe đang giữ xe, chưa có thì chọn nhà xe còn xe.
  let svcId: string | null = d ? (d.combo ? forceSvcId ?? alive[0]?.vehicle.serviceId ?? null : b.serviceId) : null;
  if (d?.combo && !svcId && d.e >= T) svcId = await pickComboService(tx, d);
  const valid = !!d && !!svcId && (d.e >= T || alive.some(locked));

  // 1) Đơn không còn nhu cầu xe ở nhà xe này ⇒ huỷ mọi lượt chưa giao.
  for (const r of alive) {
    if (locked(r)) continue;
    if (!valid || r.vehicle.serviceId !== svcId) await tx.fleetRental.update({ where: { id: r.id }, data: { state: "cancel", webPending: false } });
  }
  if (!valid || !d || !svcId || d.e < T) {
    await mirrorBookingPayments(tx, b);
    return 0;
  }

  const vehiclesRaw = await tx.fleetVehicle.findMany({ where: { serviceId: svcId } });
  if (!vehiclesRaw.length) return 0;
  const vehicles = vehiclesRaw.map((v) => vehicleVM(v));
  const names = new Map((await tx.rentalVehicle.findMany({ where: { serviceId: svcId }, select: { id: true, vehicleType: true } })).map((r) => [r.id, r.vehicleType]));
  const others = (await tx.fleetRental.findMany({
    where: { vehicle: { serviceId: svcId }, endDate: { gte: parseDateOnly(addDaysKeyLocal(T, -60)) }, ...notBooking(b.id) },
  })).map((r) => rentalVM(r));

  // 2) Đổi ngày/giờ ⇒ cập nhật lượt chưa giao; xe bận ⇒ huỷ để xếp xe khác.
  let keep = alive.filter((r) => r.vehicle.serviceId === svcId);
  const keep0 = keep.length;
  let datesChanged = false;
  for (const r of keep.filter((x) => !locked(x))) {
    const changed = toDateKey(r.startDate) !== d.s || toDateKey(r.endDate) !== d.e || r.startTime !== d.st || r.endTime !== d.et;
    if (!changed) continue;
    datesChanged = true;
    const v = vehicles.find((x) => x.id === r.vehicleId);
    if (v && v.mode !== "off" && isVehicleFree({ id: v.id, mode: "ready" }, d.s, d.e, others, T, undefined, NOW, d.st, d.et)) {
      await tx.fleetRental.update({ where: { id: r.id }, data: { startDate: parseDateOnly(d.s), endDate: parseDateOnly(d.e), startTime: d.st, endTime: d.et } });
    } else {
      await tx.fleetRental.update({ where: { id: r.id }, data: { state: "cancel", webPending: false } });
      keep = keep.filter((x) => x.id !== r.id);
    }
  }

  // 3) Giảm số xe ⇒ huỷ bớt lượt chưa giao (mới nhất trước).
  if (keep.length > d.qty) {
    const extra = keep.filter((x) => !locked(x)).reverse().slice(0, keep.length - d.qty);
    for (const r of extra) await tx.fleetRental.update({ where: { id: r.id }, data: { state: "cancel", webPending: false } });
    keep = keep.filter((x) => !extra.includes(x));
  }

  // 3b) Đơn đã có xe mà đổi ngày / đổi số xe ⇒ TÍNH LẠI tiền thuê từng lượt CHƯA giao theo giá hiện tại của xe
  // (phụ thu cuối tuần / lễ, giảm thuê dài — `quoteRental`). Trước đây chỉ dời ngày, `total` giữ giá cũ ⇒ quyết toán
  // khi trả xe (total − đã thu) ra số hoàn / thu sai. Lượt đã giao xe giữ nguyên giá (đã chốt với khách).
  // Số xe của ĐƠN đổi so với mốc lần trước (nhật ký "· N xe"); đơn cũ chưa có mốc ⇒ chỉ nhận biết khi giảm xe.
  // KHÔNG so keep0 với d.qty: đơn thiếu xe (chưa xếp đủ) sẽ bị tính lại giá ở mọi lần đồng bộ.
  const mark = keep0 > 0 ? await lastQtyMark(tx, b.id) : null;
  const qtyChanged = keep0 > 0 && (mark != null ? mark !== d.qty : keep0 > d.qty);
  const reprice = keep0 > 0 && (datesChanged || qtyChanged);
  const P = reprice ? normalizeConfig((await tx.fleetConfig.findUnique({ where: { serviceId: svcId }, select: { data: true } }))?.data) : null;
  const quote = (v: FleetVehicleVM) => quoteRental(v, d.s, d.e, d.st, d.et, false, P!).t;
  const priceLog: string[] = [];
  if (P) {
    for (const r of keep.filter((x) => !locked(x))) {
      const t = quote(vehicleVM(r.vehicle));
      if (t === Number(r.total)) continue;
      await tx.fleetRental.update({ where: { id: r.id }, data: { total: t } });
      priceLog.push(`${r.code} (${r.vehicle.plate}): ${Number(r.total).toLocaleString("vi-VN")}đ → ${t.toLocaleString("vi-VN")}đ`);
    }
  }

  // 4) Thiếu xe ⇒ tự xếp thêm (chủ xe đã từ chối đơn này thì thôi).
  const need = d.qty - keep.length;
  let added = 0;
  // Admin chỉ định nhà xe (forceSvcId) ⇒ xếp lại kể cả khi đơn từng bị một nhà xe từ chối.
  if (need > 0 && (forceSvcId || !rentals.some((r) => r.state === "reject"))) {
    const busy = [...others, ...keep.map((r) => rentalVM(r))];
    const picks = autoPick(d.pool(vehicles, (id) => (id ? names.get(id) ?? "" : "")), d.s, d.e, need, busy, T, d.st, d.et, NOW);
    const days = Math.max(1, Math.round((Date.parse(d.e) - Date.parse(d.s)) / 86_400_000) + 1);
    for (const v of picks) {
      await tx.fleetRental.create({
        data: {
          code: fleetCode(), vehicleId: v.id, bookingId: b.id, customerName: b.customerName, phone: b.phone,
          startDate: parseDateOnly(d.s), endDate: parseDateOnly(d.e), startTime: d.st, endTime: d.et,
          // Đơn đổi ngày / số xe ⇒ lượt mới cùng cách tính với lượt đã tính lại (giá hiện tại của xe);
          // chỉ xếp thêm cho đơn thiếu xe ⇒ giữ cách tính cũ (theo giá đơn).
          total: P ? quote(v) : d.total != null ? Math.round(d.total / d.qty) : v.price * days,
          deposit: 0, place: d.place, source: d.source, ctvName: b.ctv?.name ?? null, note: b.note, webPending: true,
        },
      });
    }
    added = picks.length;
    if (P) for (const v of picks) priceLog.push(`Xe thêm ${v.plate}: ${quote(v).toLocaleString("vi-VN")}đ`);
    if (d.combo) {
      const title = picks.length ? COMBO_ASSIGN_TITLE : "Xe máy kèm combo: chưa có xe trống";
      if (picks.length || !(await tx.bookingLog.count({ where: { bookingId: b.id, title } }))) {
        await tx.bookingLog.create({ data: { bookingId: b.id, kind: "SYSTEM", title, body: picks.length ? picks.map((v) => `${v.name} ${v.plate}`).join(", ") + ` · ${d.qty} xe · chờ nhà xe xác nhận` : `Cần ${d.qty} xe ${b.bikeType ?? ""} ${d.s} → ${d.e}`, by: "Hệ thống" } });
      }
    } else if (picks.length && !P) {
      // Mốc số xe của đơn (để lần sau biết đơn đổi số xe hay chỉ đang thiếu xe).
      await tx.bookingLog.create({
        data: {
          bookingId: b.id, kind: "SYSTEM", by: "Hệ thống", title: FLEET_ASSIGN_TITLE,
          body: `${d.s} → ${d.e} · ${d.qty} xe\n${picks.map((v) => `${v.name} ${v.plate}`).join(", ")} · chờ nhà xe xác nhận`,
        },
      });
    }
  }
  // Đổi số xe mà giá không đổi vẫn ghi MỘT lần để cập nhật mốc số xe (lần sau mốc khớp ⇒ không lặp).
  if (priceLog.length || qtyChanged) {
    const handed = keep.filter(locked).map((r) => r.code);
    await tx.bookingLog.create({
      data: {
        bookingId: b.id, kind: "SYSTEM", by: "Hệ thống",
        title: FLEET_REPRICE_TITLE,
        body: [`${d.s} → ${d.e} · ${d.qty} xe`, ...priceLog, handed.length ? `Xe đã giao giữ nguyên giá: ${handed.join(", ")}` : ""].filter(Boolean).join("\n"),
      },
    });
  }
  await mirrorBookingPayments(tx, b);
  return added;
}

/**
 * Đồng bộ đội xe cho MỘT đơn (gọi sau khi khách đặt, admin tạo / sửa / đổi trạng thái / ghi thu đơn).
 * Đơn đổi nhà xe ⇒ dọn ở nhà xe cũ rồi xếp ở nhà xe mới. Lỗi không ảnh hưởng thao tác chính.
 */
export async function syncFleetForBooking(bookingId: string): Promise<void> {
  const b = await prisma.bookingRequest.findUnique({ where: { id: bookingId }, select: bookingSelect });
  if (!b) return;
  const svcIds = new Set<string>();
  if (b.serviceId && b.category === "MOTORBIKE") svcIds.add(b.serviceId);
  const old = await prisma.fleetRental.findMany({ where: { bookingId }, select: { vehicle: { select: { serviceId: true } } } });
  for (const r of old) svcIds.add(r.vehicle.serviceId);
  const comboNeedsBikes = b.category === "COMBO" && (b.bikeCount ?? 0) > 0;
  if (!svcIds.size && !comboNeedsBikes) return;
  if (svcIds.size && !comboNeedsBikes) {
    const withFleet = await prisma.fleetVehicle.groupBy({ by: ["serviceId"], where: { serviceId: { in: [...svcIds] } } });
    if (!withFleet.length) return;
  }
  await prisma.$transaction(async (tx) => {
    await syncBookingTx(tx, bookingId);
  });
}

/**
 * Đối chiếu MỘT đơn trong transaction, theo thứ tự khoá cố định: khoá theo ĐƠN → khoá các nhà xe liên quan
 * (đọc lại SAU khoá đơn) → khoá dòng đơn + đọc lại đơn → `reconcileBooking`.
 *  - Khoá theo đơn: hai lần đồng bộ cùng đơn chạy song song (vd đổi giai đoạn gọi sync 2 lần, combo chưa có xe nên
 *    chưa có nhà xe để khoá) phải nối đuôi nhau — lần sau đọc lượt thuê lần trước vừa tạo, không xếp trùng xe.
 *  - Đọc lại đơn bên trong khoá: `mirrorBookingPayments` so "đã thu" của đơn với sổ xe — dùng bản đọc trước khoá
 *    thì nhà xe vừa ghi cọc chen giữa sẽ bị ghi thành dòng "Sàn ghi nhận hoàn" sai.
 */
async function syncBookingTx(tx: Tx, bookingId: string, extraSvcIds: string[] = [], forceSvcId?: string): Promise<number | null> {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${"fleet-booking:" + bookingId}))::text AS ok`;
  const pre = await tx.bookingRequest.findUnique({ where: { id: bookingId }, select: { serviceId: true, category: true } });
  if (!pre) return null;
  const svcIds = new Set(extraSvcIds);
  if (pre.serviceId && pre.category === "MOTORBIKE") svcIds.add(pre.serviceId);
  for (const r of await tx.fleetRental.findMany({ where: { bookingId }, select: { vehicle: { select: { serviceId: true } } } })) svcIds.add(r.vehicle.serviceId);
  for (const id of [...svcIds].sort()) await lockFleet(tx, id);
  // Cùng thứ tự với route đội xe (khoá nhà xe → FOR UPDATE dòng đơn trong syncBookingLedger) ⇒ không khoá chéo.
  await tx.$queryRaw`SELECT id FROM "BookingRequest" WHERE id = ${bookingId} FOR UPDATE`;
  const b = await tx.bookingRequest.findUnique({ where: { id: bookingId }, select: bookingSelect });
  if (!b) return null;
  return reconcileBooking(tx, b, forceSvcId);
}

/** Thông tin để admin PHÂN xe máy kèm combo cho một nhà xe (form sửa đơn). */
export interface ComboBikeAssign {
  need: number; // số xe đơn cần
  typeName: string; // "wave" | "pg1"
  from: string; // yyyy-mm-dd
  to: string;
  st: string;
  et: string;
  currentId: string; // nhà xe đang giữ xe ("" = chưa phân)
  assigned: number; // số xe đang giữ ở nhà xe hiện tại
  pending: boolean; // còn chờ nhà xe duyệt
  rejected: boolean; // từng bị nhà xe từ chối
  handed: boolean; // đã giao xe ⇒ không đổi nhà xe được
  options: { id: string; title: string; free: number; webSync: boolean }[];
}

/**
 * Danh sách nhà xe có thể nhận xe máy kèm của đơn combo + số xe đúng loại còn trống trong khoảng thuê
 * (không tính xe đơn này đang giữ). Đơn không có xe kèm / đã huỷ ⇒ null.
 */
export async function comboBikeAssignInfo(bookingId: string): Promise<ComboBikeAssign | null> {
  const b = await prisma.bookingRequest.findUnique({ where: { id: bookingId }, select: bookingSelect });
  if (!b) return null;
  const d = demandOf(b);
  if (!d?.combo) return null;
  const T = toDateKey(today());
  const mine = await prisma.fleetRental.findMany({
    where: { bookingId },
    select: { state: true, webPending: true, hand: true, ret: true, vehicle: { select: { serviceId: true } } },
    orderBy: { createdAt: "asc" },
  });
  const alive = mine.filter((r) => r.state !== "cancel" && r.state !== "reject");
  const currentId = alive[0]?.vehicle.serviceId ?? "";
  const svcs = await prisma.service.findMany({
    where: { category: "MOTORBIKE", fleetVehicles: { some: {} }, OR: [{ published: true }, { id: currentId || "-" }] },
    select: {
      id: true, title: true, fleetConfig: { select: { data: true } },
      rentalVehicles: { select: { id: true, vehicleType: true } }, fleetVehicles: true,
    },
    orderBy: [{ featured: "desc" }, { priorityOrder: "desc" }, { title: "asc" }],
  });
  const busy = await prisma.fleetRental.findMany({
    where: {
      vehicle: { serviceId: { in: svcs.map((s) => s.id) } },
      endDate: { gte: parseDateOnly(addDaysKeyLocal(d.s < T ? d.s : T, -60)) },
      AND: [notBooking(bookingId)],
      ...ALIVE,
    },
  });
  const options = svcs.map((s) => {
    const names = new Map(s.rentalVehicles.map((r) => [r.id, r.vehicleType]));
    const ids = new Set(s.fleetVehicles.map((v) => v.id));
    const rs = busy.filter((r) => ids.has(r.vehicleId)).map((r) => rentalVM(r));
    const pool = d.pool(s.fleetVehicles.map((v) => vehicleVM(v)), (id) => (id ? names.get(id) ?? "" : ""));
    return {
      id: s.id,
      title: s.title,
      free: autoPick(pool, d.s, d.e, pool.length, rs, T, d.st, d.et, vnNow().now).length,
      webSync: normalizeConfig(s.fleetConfig?.data).webSync,
    };
  });
  return {
    need: d.qty,
    typeName: (b.bikeType ?? "wave").toLowerCase(),
    from: d.s, to: d.e, st: d.st, et: d.et,
    currentId,
    assigned: alive.filter((r) => r.vehicle.serviceId === currentId).length,
    pending: alive.some((r) => r.webPending),
    rejected: mine.some((r) => r.state === "reject"),
    handed: alive.some(locked),
    options,
  };
}

/**
 * Admin PHÂN xe máy kèm combo cho một nhà xe cụ thể: nhả xe chưa giao ở nhà xe cũ, xếp xe đúng loại còn
 * trống ở nhà xe mới (chờ nhà xe duyệt), ghi nhật ký đơn. Nhà xe mới không còn xe nào ⇒ báo lỗi, giữ nguyên.
 */
export async function assignComboBikeService(bookingId: string, serviceId: string, by: string): Promise<{ ok: true; assigned: number; need: number; title: string } | { error: string }> {
  const b = await prisma.bookingRequest.findUnique({ where: { id: bookingId }, select: bookingSelect });
  if (!b) return { error: "Không tìm thấy đơn." };
  const d = demandOf(b);
  if (!d?.combo) return { error: "Đơn không có xe máy thuê kèm (hoặc đã huỷ)." };
  if (d.e < toDateKey(today())) return { error: "Lịch thuê xe đã qua, không phân lại được." };
  const svc = await prisma.service.findFirst({ where: { id: serviceId, category: "MOTORBIKE", fleetVehicles: { some: {} } }, select: { id: true, title: true } });
  if (!svc) return { error: "Nhà xe không hợp lệ hoặc chưa có đội xe." };
  const old = await prisma.fleetRental.findMany({ where: { bookingId, ...ALIVE }, select: { hand: true, ret: true, vehicle: { select: { serviceId: true, service: { select: { title: true } } } } } });
  if (old.some((r) => locked(r) && r.vehicle.serviceId !== svc.id)) return { error: "Xe đã giao cho khách ở nhà xe hiện tại — không đổi nhà xe được." };
  const from = [...new Set(old.filter((r) => r.vehicle.serviceId !== svc.id).map((r) => r.vehicle.service.title))];
  try {
    const assigned = await prisma.$transaction(async (tx) => {
      // Khoá + đọc lại đơn bên trong transaction (xem syncBookingTx) — `b` ở trên chỉ dùng để kiểm tra sơ bộ.
      if ((await syncBookingTx(tx, bookingId, [svc.id], svc.id)) == null) throw new Error("Không tìm thấy đơn.");
      const n = await tx.fleetRental.count({ where: { bookingId, vehicle: { serviceId: svc.id }, ...ALIVE } });
      if (!n) throw new Error(`${svc.title} không còn xe ${comboBikeName(b.bikeType)} trống trong khoảng ngày thuê.`);
      await tx.bookingLog.create({
        data: {
          bookingId, kind: "SUPPLIER", by,
          title: `Phân xe máy kèm cho ${svc.title}`,
          body: `${from.length ? `Chuyển từ ${from.join(", ")} · ` : ""}Đã xếp ${n}/${d.qty} xe${n < d.qty ? " (nhà xe thiếu xe trống)" : ""}`,
        },
      });
      return n;
    });
    return { ok: true, assigned, need: d.qty, title: svc.title };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Không phân được xe." };
  }
}
const comboBikeName = (key: string | null) => ((key ?? "wave").toLowerCase() === "pg1" ? "PG1" : "Wave");

/** Tự xếp xe cho đơn vừa đặt (gọi sau createBooking / đặt combo). Lỗi không ảnh hưởng đơn. */
export async function autoAssignFleetForBooking(bookingId: string): Promise<void> {
  await syncFleetForBooking(bookingId);
}

/** Đối chiếu toàn bộ đơn ↔ lượt thuê của một dịch vụ (khi mở trang quản lý xe). */
export async function syncFleetBookings(serviceId: string): Promise<void> {
  const hasFleet = await prisma.fleetVehicle.count({ where: { serviceId } });
  if (!hasFleet) return;
  await releaseExpiredHolds(serviceId);
  const T = today();
  // Đơn xe máy còn hiệu lực + mọi đơn đang có lượt thuê chưa giao ở nhà xe này (dọn đơn huỷ / đổi nhà xe / combo).
  const linked = await prisma.fleetRental.findMany({
    where: { vehicle: { serviceId }, bookingId: { not: null }, ...ALIVE, hand: { equals: Prisma.DbNull } },
    select: { bookingId: true },
  });
  const bookings = await prisma.bookingRequest.findMany({
    where: {
      OR: [
        { serviceId, category: "MOTORBIKE", status: { not: "CANCELLED" }, OR: [{ endDate: { gte: T } }, { endDate: null, useDate: { gte: T } }] },
        { id: { in: [...new Set(linked.map((l) => l.bookingId!))] } },
      ],
    },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  // Danh sách đơn đọc ngoài khoá chỉ để biết cần đối chiếu đơn nào; dữ liệu đơn đọc lại trong khoá (syncBookingTx).
  for (const b of bookings) {
    await prisma.$transaction(async (tx) => {
      await syncBookingTx(tx, b.id, [serviceId]);
    });
  }
}

/**
 * Tự NHẢ XE: lượt thuê tạo tay (không từ đơn web/combo), chưa cọc, chưa giao, đã tạo quá `holdH` giờ
 * (Cài đặt → "Tự nhả xe nếu chưa cọc sau", 0 = tắt) ⇒ huỷ để xe trống lại. Trả số lượt đã nhả.
 */
export async function releaseExpiredHolds(serviceId?: string): Promise<number> {
  const cfgs = await prisma.fleetConfig.findMany({ where: serviceId ? { serviceId } : {}, select: { serviceId: true, data: true } });
  const svcIds = serviceId ? [serviceId] : (await prisma.fleetVehicle.groupBy({ by: ["serviceId"] })).map((x) => x.serviceId);
  let n = 0;
  for (const sid of svcIds) {
    const holdH = normalizeConfig(cfgs.find((c) => c.serviceId === sid)?.data).holdH;
    if (!holdH) continue;
    const cutoff = new Date(Date.now() - holdH * 3_600_000);
    const r = await prisma.fleetRental.updateMany({
      where: {
        vehicle: { serviceId: sid }, bookingId: null, state: null, webPending: false, deposit: { lte: 0 },
        hand: { equals: Prisma.DbNull }, ret: { equals: Prisma.DbNull }, createdAt: { lt: cutoff },
        endDate: { gte: today() }, payments: { none: {} },
      },
      data: { state: "cancel", note: `Tự nhả xe: quá ${holdH} giờ chưa cọc` },
    });
    n += r.count;
  }
  return n;
}

/** Dịch vụ (trong danh sách) đã BẬT "dùng đội xe để tính còn xe trên web". */
export async function fleetWebServices(serviceIds: string[], db: Prisma.TransactionClient | typeof prisma = prisma): Promise<string[]> {
  if (!serviceIds.length) return [];
  const rows = await db.fleetConfig.findMany({ where: { serviceId: { in: serviceIds } }, select: { serviceId: true, data: true } });
  return rows.filter((r) => normalizeConfig(r.data).webSync).map((r) => r.serviceId);
}

/**
 * Số xe CÒN RẢNH theo đội xe thật cho từng loại xe bán trên web trong [fromKey stTime, toKey etTime).
 * Chỉ trả cho dịch vụ đã BẬT webSync và có đội xe (còn lại ⇒ không có trong map, dùng lịch tồn cũ).
 * Lượt thuê của đơn đã huỷ không tính là bận (kể cả khi chưa ai mở trang quản lý xe để dọn).
 */
export async function fleetFreeByWebType(
  allServiceIds: string[],
  fromKey: string,
  toKey: string,
  stTime?: string | null,
  etTime?: string | null,
): Promise<Map<string, { free: number; total: number }>> {
  const out = new Map<string, { free: number; total: number }>();
  const serviceIds = await fleetWebServices(allServiceIds);
  if (!serviceIds.length) return out;
  const vehiclesRaw = await prisma.fleetVehicle.findMany({ where: { serviceId: { in: serviceIds } } });
  if (!vehiclesRaw.length) return out;
  const T = toDateKey(today());
  const rentals = (await prisma.fleetRental.findMany({
    where: {
      vehicle: { serviceId: { in: serviceIds } },
      startDate: { lte: parseDateOnly(toKey) },
      endDate: { gte: parseDateOnly(addDaysKeyLocal(fromKey < T ? fromKey : T, -60)) },
      NOT: { booking: { status: "CANCELLED" } },
    },
  })).map((r) => rentalVM(r));
  const types = await prisma.rentalVehicle.findMany({ where: { serviceId: { in: serviceIds } }, select: { id: true, serviceId: true } });
  const st = stTime && /^\d{2}:\d{2}$/.test(stTime) ? stTime : "00:00";
  const et = etTime && /^\d{2}:\d{2}$/.test(etTime) ? etTime : "23:59";
  for (const t of types) {
    const vs = vehiclesRaw.filter((v) => v.serviceId === t.serviceId).map((v) => vehicleVM(v));
    if (!vs.length) continue;
    const pool = poolFor(vs, t.id).filter((v) => v.mode !== "off");
    out.set(t.id, { free: pool.filter((v) => isVehicleFree(v, fromKey, toKey, rentals, T, undefined, vnNow().now, st, et)).length, total: pool.length });
  }
  return out;
}
