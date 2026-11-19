import "server-only";
import { Prisma, type RoomStay, type StayPayment } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/format";
import { parseDateOnly, toDateKey } from "@/lib/dates";
import { dmy } from "@/lib/date-format";
import type { SessionPayload } from "@/lib/auth-token";
import { roomPricing } from "@/lib/availability";
import { getHolidays } from "@/lib/holidays-server";
import { holidayKeysBetween, type Holiday } from "@/lib/holidays";
import { syncRoomTypeAvailability } from "@/lib/room-availability";
import { getAutoCancelHours } from "@/lib/booking-auto-cancel";
import {
  addDaysKey,
  diffDays,
  isLive,
  normalizeHomeConfig,
  splitTotal,
  stayCode,
  stayPrice,
  vnNow,
  type CloseVM,
  type ExpenseVM,
  type HkStatus,
  type HomeConfig,
  type HomeRoomVM,
  type HomeTypeVM,
  type LockVM,
  type StayFee,
  type StayGuest,
  type StayVM,
  type SvcLogVM,
  type WebOrderVM,
} from "@/lib/stay-core";

/**
 * Quản lý phòng (chủ homestay) — phía server. MỘT lịch phòng duy nhất: mọi lượt ở đều chiếm ô
 * RoomDayStatus nên trang khách, combo, iCal xuất ra tự thấy phòng bận.
 *  - Lượt chủ tự tạo: ô lịch gắn `stayId` (note "PMS"); chưa cọc ⇒ PENDING (tự nhả sau N giờ), đã cọc ⇒ BOOKED.
 *  - Đóng phòng: ô CLOSED note "PMS#c:<closeId>".
 *  - Đơn của sàn: ô lịch do ĐƠN giữ (bookingId) như cũ; `syncStaysForBooking` sinh lượt ở tương ứng để hiện
 *    trên sơ đồ, nhận/trả phòng, ghi dịch vụ. Chủ nhà "xác nhận còn phòng" đơn chưa chốt ⇒ heldRoom + giữ ô
 *    PENDING theo đơn (sàn chốt cọc thì thành BOOKED; đơn huỷ ⇒ nhả).
 * Sheet / iCal KHÔNG ghi đè ô có stayId hoặc note bắt đầu "PMS" (xem sheet-sync.ts, ical-sync.ts).
 */

type Tx = Prisma.TransactionClient;
/** Lỗi nghiệp vụ (phòng bận, sai dữ liệu…) — báo cho người dùng, không ghi log lỗi hệ thống. */
export class StayError extends Error {}
export const HOME_CATEGORIES = ["HOMESTAY", "BUNGALOW"] as const;
export const PMS_TAG = "PMS";
export const closeTag = (id: string) => `PMS#c:${id}`;
/** AdminUser.staffArea của lễ tân Quản lý phòng ("xe"/null = nhân viên giao xe). */
export const STAFF_AREA = "phong";

/** Khoá ngày lễ (lịch lễ chung của admin) trong [from, to) — dùng tính giá đặt tay phía server. */
export async function holKeysFor(from: string, to: string, list?: Holiday[]): Promise<string[]> {
  if (!(to > from)) return [];
  return holidayKeysBetween(list ?? (await getHolidays()), from, addDaysKey(to, -1));
}
const vnStamp = (d: Date) => new Date(d.getTime() + 7 * 3_600_000).toISOString().slice(0, 16).replace("T", " ");
const lastName = (s: string) => s.trim().split(/\s+/).pop() ?? s;
const nightsOf = (ci: string, co: string) => {
  const out: string[] = [];
  for (let d = ci; d < co; d = addDaysKey(d, 1)) out.push(d);
  return out;
};

// ============================ QUYỀN ============================

/** Chủ dịch vụ mà phiên thay mặt: ADMIN ⇒ "all"; PROVIDER ⇒ chính mình; STAFF ⇒ chủ đã tạo tài khoản (đang mở). */
export async function stayOwnerOf(session: SessionPayload | null): Promise<string | "all" | null> {
  if (!session) return null;
  if (session.role === "ADMIN") return "all";
  // DEMO = khách xem bản demo (/demo/quan-ly-phong): thao tác trên homestay của chủ demo (src/lib/module-demo.ts).
  if (session.role === "PROVIDER" || session.role === "DEMO") return session.sub;
  if (session.role === "STAFF") {
    // Chỉ lễ tân (staffArea "phong") — nhân viên giao xe của cùng chủ không vào được Quản lý phòng.
    const u = await prisma.adminUser.findUnique({ where: { id: session.sub }, select: { providerId: true, active: true, role: true, staffArea: true } });
    return u?.active && u.role === "STAFF" && u.staffArea === STAFF_AREA && u.providerId ? u.providerId : null;
  }
  return null;
}

/** Các homestay phiên được quản lý. */
export async function homeServicesFor(session: SessionPayload) {
  const owner = await stayOwnerOf(session);
  if (!owner) return [];
  const list = await prisma.service.findMany({
    where: { category: { in: [...HOME_CATEGORIES] }, ...(owner === "all" ? {} : { ownerId: owner }) },
    orderBy: [{ published: "desc" }, { title: "asc" }],
    select: { id: true, title: true, slug: true, roomTypes: { select: { _count: { select: { rooms: true } } } } },
  });
  return list.map((s) => ({ id: s.id, title: s.title, slug: s.slug, rooms: s.roomTypes.reduce((a, t) => a + t._count.rooms, 0) }));
}

export async function canManageHome(session: SessionPayload | null, serviceId: string) {
  const owner = await stayOwnerOf(session);
  if (!owner || !serviceId) return null;
  return prisma.service.findFirst({
    where: { id: serviceId, category: { in: [...HOME_CATEGORIES] }, ...(owner === "all" ? {} : { ownerId: owner }) },
    select: { id: true, title: true, slug: true, ownerId: true, extraPersonFee: true, earlyCheckinFee: true, lateCheckoutFee: true, sheetUrl: true },
  });
}

/** Khoá theo homestay trong transaction: chặn 2 thao tác cùng lúc giữ trùng một phòng. */
export async function lockHome(tx: Tx, serviceId: string): Promise<void> {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${"home:" + serviceId}))::text AS ok`;
}

// ============================ CẤU HÌNH ============================

export async function loadHomeConfig(serviceId: string): Promise<HomeConfig> {
  const [row, svc] = await Promise.all([
    prisma.homeConfig.findUnique({ where: { serviceId } }),
    prisma.service.findUnique({ where: { id: serviceId }, select: { earlyCheckinFee: true, lateCheckoutFee: true } }),
  ]);
  return normalizeHomeConfig(row?.data, { early: toNumber(svc?.earlyCheckinFee), late: toNumber(svc?.lateCheckoutFee) });
}

export async function saveHomeConfig(serviceId: string, cfg: HomeConfig): Promise<void> {
  const data = normalizeHomeConfig(cfg) as unknown as Prisma.InputJsonValue;
  await prisma.homeConfig.upsert({ where: { serviceId }, create: { serviceId, data }, update: { data } });
}

// ============================ NẠP DỮ LIỆU ============================

export async function homeRooms(serviceId: string): Promise<{ rooms: HomeRoomVM[]; types: HomeTypeVM[] }> {
  const types = await prisma.roomType.findMany({
    where: { serviceId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: { rooms: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] } },
  });
  const rooms: HomeRoomVM[] = [];
  for (const t of types) {
    for (const r of t.rooms) {
      const p = roomPricing(r);
      rooms.push({
        id: r.id,
        name: r.name,
        typeId: t.id,
        cap: r.capacity,
        max: Math.max(r.capacity, r.maxCapacity ?? r.capacity),
        hk: (["clean", "dirty", "cleaning", "maint"].includes(r.hkStatus) ? r.hkStatus : "clean") as HkStatus,
        dow: [0, 1, 2, 3, 4, 5, 6].map((i) => p.daysOfWeek?.[i] ?? p.weekdayPrice),
        hol: p.holidayPrice ?? 0,
      });
    }
  }
  return { rooms, types: types.filter((t) => t.rooms.length).map((t) => ({ id: t.id, name: t.name })) };
}

type BookingMeta = { code: string; category: string; collector: string; paymentStatus: string; roomCommission?: Prisma.Decimal | null };

const asArr = <T,>(j: Prisma.JsonValue): T[] => (Array.isArray(j) ? (j as unknown as T[]) : []);

export function stayVM(r: RoomStay & { payments: StayPayment[] }, meta?: BookingMeta | null): StayVM {
  const combo = meta?.category === "COMBO";
  const payBlock = meta && !combo && meta.collector !== "PROVIDER" && meta.paymentStatus === "UNPAID" ? "Sàn chưa ghi nhận cọc của đơn này — chưa ghi thu ở đây được." : "";
  return {
    id: r.id,
    code: r.code,
    roomId: r.roomId,
    bookingId: r.bookingId,
    bookingCode: meta?.code ?? null,
    combo,
    payBlock,
    groupId: r.groupId,
    groupName: r.groupName,
    name: r.customerName,
    phone: r.phone,
    guests: r.guests,
    guestList: asArr<StayGuest>(r.guestList).filter((g) => g && typeof g.name === "string").map((g) => ({ name: g.name, cccd: String(g.cccd ?? "") })),
    ci: toDateKey(r.checkIn),
    co: toDateKey(r.checkOut),
    total: toNumber(r.total) ?? 0,
    src: r.source,
    note: r.note ?? "",
    state: r.state,
    holdUntil: r.holdUntil ? r.holdUntil.toISOString() : null,
    inAt: r.checkedInAt ? vnStamp(r.checkedInAt) : null,
    outAt: r.checkedOutAt ? vnStamp(r.checkedOutAt) : null,
    fees: asArr<StayFee>(r.fees).filter((f) => f && typeof f.amt === "number").map((f) => ({ name: String(f.name), amt: f.amt })),
    pays: r.payments
      .slice()
      .sort((a, b) => a.at.getTime() - b.at.getTime())
      .map((p) => ({ id: p.id, at: vnStamp(p.at), amt: toNumber(p.amount) ?? 0, method: p.method, kind: p.kind, by: p.by ?? "" })),
    comm: 0,
  };
}

/** Phòng của đơn (đơn nhiều phòng: roomIds; đơn cũ: roomId). */
const roomsOfBooking = (b: { roomIds: string[]; roomId: string | null }) => (b.roomIds.length ? b.roomIds : b.roomId ? [b.roomId] : []);
const homeTotalOf = (b: { category: string; roomAmount: Prisma.Decimal | null; referencePrice: Prisma.Decimal | null }) =>
  b.category === "COMBO" ? (toNumber(b.roomAmount) ?? 0) : (toNumber(b.referencePrice) ?? 0);
const comboCollected = (b: { roomAmount: Prisma.Decimal | null; referencePrice: Prisma.Decimal | null; amountCollected: Prisma.Decimal | null }) => {
  const ref = toNumber(b.referencePrice) ?? 0;
  const ratio = ref > 0 ? Math.min(1, Math.max(0, (toNumber(b.amountCollected) ?? 0) / ref)) : 0;
  return Math.round((toNumber(b.roomAmount) ?? 0) * ratio);
};
/**
 * Chênh lệch "đã thu" của đơn sàn (không phải combo) so với sổ phòng. Sổ được phép vượt tổng tiền đơn (khoản chủ thu thêm),
 * nên so với min(tổng sổ, max(tổng đơn, đã thu)) — hội tụ về 0 kể cả khi sàn ghi đã thu nhiều hơn giá đơn.
 */
const platformDelta = (b: { amountCollected: Prisma.Decimal | null; referencePrice: Prisma.Decimal | null }, sum: number) => {
  const collected = toNumber(b.amountCollected) ?? 0;
  const total = toNumber(b.referencePrice) ?? 0;
  return Math.round(collected - Math.min(sum, Math.max(total, collected)));
};
const guestsOf = (b: { adults: number | null; childrenAges: number[]; quantity: number }) => (b.adults ?? 0) + b.childrenAges.length || b.quantity;

/** Đơn của sàn chờ chủ nhà xác nhận còn phòng (chưa xác nhận, chưa từ chối, chưa qua ngày trả). */
async function webOrders(serviceId: string, roomIds: string[], today: string): Promise<WebOrderVM[]> {
  if (!roomIds.length) return [];
  const t = parseDateOnly(today);
  const list = await prisma.bookingRequest.findMany({
    where: {
      status: { in: ["NEW", "CONTACTING", "CONFIRMED"] },
      heldRoom: false,
      AND: [
        { OR: [{ roomIds: { hasSome: roomIds } }, { roomId: { in: roomIds } }] },
        { OR: [{ endDate: { gt: t } }, { endDate: null, useDate: { gte: t } }] },
      ],
    },
    orderBy: { createdAt: "asc" },
  });
  if (!list.length) return [];
  const rejected = new Set(
    (await prisma.roomStay.findMany({ where: { serviceId, state: "reject", bookingId: { in: list.map((b) => b.id) } }, select: { bookingId: true } })).map((r) => r.bookingId),
  );
  return list
    .filter((b) => !rejected.has(b.id))
    .map((b) => {
      const ci = toDateKey(b.useDate);
      const co = toDateKey(b.endDate ?? parseDateOnly(addDaysKey(ci, 1)));
      const n = diffDays(ci, co);
      const combo = b.category === "COMBO";
      return {
        id: b.id,
        code: b.code,
        kind: combo ? `Combo ${n + 1}N${n}Đ` : "Homestay lẻ",
        name: b.customerName,
        phone: b.phone,
        ci,
        co,
        guests: guestsOf(b),
        roomIds: roomsOfBooking(b).filter((id) => roomIds.includes(id)),
        total: homeTotalOf(b),
        collected: combo ? comboCollected(b) : (toNumber(b.amountCollected) ?? 0),
        createdAt: b.createdAt.toISOString(),
        status: b.status,
        note: b.note ?? "",
      };
    });
}

/** Ô bị khoá bởi nguồn khác (sheet / OTA / khoá tay / đơn chưa có lượt ở), gộp thành khoảng đêm liên tiếp. */
async function otherLocks(roomIds: string[], from: string, ownBookingIds: Set<string>): Promise<LockVM[]> {
  if (!roomIds.length) return [];
  const cells = await prisma.roomDayStatus.findMany({
    where: { roomId: { in: roomIds }, date: { gte: parseDateOnly(from) }, status: { not: "AVAILABLE" }, stayId: null },
    select: { roomId: true, date: true, note: true, bookingId: true },
    orderBy: [{ roomId: "asc" }, { date: "asc" }],
  });
  const out: LockVM[] = [];
  for (const c of cells) {
    if (c.note?.startsWith("PMS#c:")) continue; // đóng phòng của module — hiển thị riêng
    if (c.bookingId && ownBookingIds.has(c.bookingId)) continue; // đã hiện bằng lượt ở của đơn
    const label = c.bookingId ? "Đơn sàn" : c.note === "SHEET" ? "Sheet" : c.note?.startsWith("OTA#") ? "OTA" : "Khoá tay";
    const d = toDateKey(c.date);
    const last = out[out.length - 1];
    if (last && last.roomId === c.roomId && last.label === label && last.to === d) last.to = addDaysKey(d, 1);
    else out.push({ roomId: c.roomId, from: d, to: addDaysKey(d, 1), label });
  }
  return out;
}

/** Toàn bộ dữ liệu màn Quản lý phòng của một homestay. */
export async function loadHome(serviceId: string) {
  const { today, now } = vnNow();
  const since = `${Number(today.slice(0, 4)) - 1}-01-01`;
  const svc = await prisma.service.findUnique({
    where: { id: serviceId },
    select: { ownerId: true, extraPersonFee: true, sheetUrl: true, slug: true },
  });
  const { rooms, types } = await homeRooms(serviceId);
  const roomIds = rooms.map((r) => r.id);
  const [stayRows, web, closes, expenses, logs, cfg, staff, autoCancelHours, holidayList] = await Promise.all([
    prisma.roomStay.findMany({ where: { serviceId, checkOut: { gte: parseDateOnly(since) } }, include: { payments: true }, orderBy: { checkIn: "asc" } }),
    webOrders(serviceId, roomIds, today),
    prisma.homeClose.findMany({ where: { serviceId, toDate: { gte: parseDateOnly(addDaysKey(today, -90)) } }, orderBy: { fromDate: "asc" } }),
    prisma.homeExpense.findMany({ where: { serviceId, date: { gte: parseDateOnly(since) } }, orderBy: { date: "desc" } }),
    prisma.roomServiceLog.findMany({ where: { roomId: { in: roomIds } }, orderBy: [{ date: "desc" }, { createdAt: "desc" }], take: 30 }),
    loadHomeConfig(serviceId),
    svc?.ownerId
      ? prisma.adminUser.findMany({ where: { role: "STAFF", providerId: svc.ownerId, staffArea: STAFF_AREA }, select: { id: true, name: true, username: true, phone: true, active: true }, orderBy: { createdAt: "asc" } })
      : Promise.resolve([]),
    getAutoCancelHours().catch(() => 6),
    getHolidays(),
  ]);
  // Lịch lễ chung (admin khai ở /admin/popup): khoá ngày cho báo giá đặt tay phía client + danh sách sắp tới cho tab Cài đặt.
  const holKeys = holidayKeysBetween(holidayList, addDaysKey(today, -30), addDaysKey(today, 760));
  const holidays = holidayList.filter((h) => h.yearly || h.to >= today);
  const bIds = [...new Set(stayRows.map((s) => s.bookingId).filter((x): x is string => !!x))];
  const metas = new Map(
    (bIds.length
      ? await prisma.bookingRequest.findMany({ where: { id: { in: bIds } }, select: { id: true, code: true, category: true, collector: true, paymentStatus: true, roomCommission: true } })
      : []
    ).map((b) => [b.id, b]),
  );
  const ownBookings = new Set(stayRows.filter((s) => s.bookingId && isLive(s)).map((s) => s.bookingId!));
  const locks = await otherLocks(roomIds, addDaysKey(today, -60), ownBookings);
  const stays = stayRows.map((r) => stayVM(r, r.bookingId ? metas.get(r.bookingId) : null));
  // Chiết khấu sàn (snapshot trên đơn) chia về từng phòng của đơn theo tỉ lệ tiền phòng.
  for (const id of bIds) {
    const comm = toNumber(metas.get(id)?.roomCommission) ?? 0;
    const mine = stays.filter((s) => s.bookingId === id && isLive(s));
    const sum = mine.reduce((a, s) => a + s.total, 0);
    for (const s of mine) s.comm = sum > 0 ? Math.round((comm * s.total) / sum) : Math.round(comm / mine.length);
  }
  return {
    rooms,
    types,
    stays,
    web,
    closes: closes.map((c): CloseVM => ({ id: c.id, roomIds: c.roomIds, from: toDateKey(c.fromDate), to: toDateKey(c.toDate), reason: c.reason })),
    locks,
    exps: expenses.map((e): ExpenseVM => ({ id: e.id, date: toDateKey(e.date), cat: e.category, amt: toNumber(e.amount) ?? 0, note: e.note ?? "" })),
    logs: logs.map((l): SvcLogVM => ({ id: l.id, roomId: l.roomId, date: toDateKey(l.date), what: l.what, cost: toNumber(l.cost) ?? 0 })),
    cfg,
    staff,
    hasOwner: !!svc?.ownerId,
    hasSheet: !!svc?.sheetUrl,
    extraFee: toNumber(svc?.extraPersonFee) ?? 0,
    slug: svc?.slug ?? "",
    autoCancelHours,
    holKeys,
    holidays,
    today,
    now,
  };
}
export type HomeData = Awaited<ReturnType<typeof loadHome>>;

/** Lễ tân (STAFF) không xem chi phí vận hành & danh sách tài khoản nhân viên (giao diện cũng ẩn các tab đó). */
export function forViewer(d: HomeData, role: string): HomeData {
  return role === "STAFF" ? { ...d, exps: [], staff: [] } : d;
}

// ============================ Ô LỊCH ============================

/** Tính lại số phòng trống (RoomAvailability) cho các (phòng, ngày) vừa đổi. */
export async function resyncCells(tx: Tx, roomIds: string[], dates: string[]): Promise<void> {
  if (!roomIds.length || !dates.length) return;
  const typeIds = [...new Set((await tx.room.findMany({ where: { id: { in: roomIds } }, select: { roomTypeId: true } })).map((r) => r.roomTypeId))];
  for (const t of typeIds) for (const d of [...new Set(dates)]) await syncRoomTypeAvailability(t, parseDateOnly(d), tx);
}

/**
 * Báo lỗi nếu phòng không trống trọn các đêm [ci, co) — đọc lịch thật (RoomDayStatus), mô tả ai đang giữ.
 * `own` = ô của chính lượt ở / đơn đang sửa (không tính là trùng).
 */
export async function assertRoomsFree(
  tx: Tx,
  rooms: { id: string; name: string }[],
  ci: string,
  co: string,
  own: { stayId?: string; bookingId?: string } = {},
): Promise<void> {
  const nights = nightsOf(ci, co).map(parseDateOnly);
  if (!nights.length || !rooms.length) return;
  const cells = await tx.roomDayStatus.findMany({
    where: { roomId: { in: rooms.map((r) => r.id) }, date: { in: nights }, status: { not: "AVAILABLE" } },
    orderBy: [{ roomId: "asc" }, { date: "asc" }],
  });
  const busy = cells.filter((c) => !(own.stayId && c.stayId === own.stayId) && !(own.bookingId && c.bookingId === own.bookingId));
  if (!busy.length) return;
  const stayIds = [...new Set(busy.map((c) => c.stayId).filter((x): x is string => !!x))];
  const bookingIds = [...new Set(busy.map((c) => c.bookingId).filter((x): x is string => !!x))];
  const [stays, bookings] = await Promise.all([
    stayIds.length ? tx.roomStay.findMany({ where: { id: { in: stayIds } }, select: { id: true, code: true, customerName: true } }) : [],
    bookingIds.length ? tx.bookingRequest.findMany({ where: { id: { in: bookingIds } }, select: { id: true, code: true, customerName: true } }) : [],
  ]);
  const sMap = new Map(stays.map((s) => [s.id, `lượt ${s.code} · ${s.customerName}`]));
  const bMap = new Map(bookings.map((b) => [b.id, `đơn ${b.code} · ${b.customerName}`]));
  const name = new Map(rooms.map((r) => [r.id, r.name]));
  const parts = new Map<string, string[]>();
  for (const c of busy) {
    const who = c.stayId ? (sMap.get(c.stayId) ?? "lượt ở khác") : c.bookingId ? (bMap.get(c.bookingId) ?? "đơn khác") : c.note?.startsWith("PMS#c:") ? "đóng phòng" : c.note === "SHEET" ? "Sheet" : c.note?.startsWith("OTA#") ? "lịch OTA" : "khoá tay";
    const l = parts.get(c.roomId) ?? [];
    l.push(`${dmy(toDateKey(c.date))} (${who})`);
    parts.set(c.roomId, l);
  }
  const msg = [...parts.entries()].map(([rid, l]) => `Phòng ${name.get(rid) ?? ""}: ${l.slice(0, 4).join(", ")}${l.length > 4 ? ` … +${l.length - 4} đêm` : ""}`).join(" · ");
  throw new StayError(`Phòng đã bận — ${msg}`);
}

/** Ghi các đêm của lượt ở chủ tự tạo vào lịch (đã kiểm trống trước). */
export async function writeStayCells(tx: Tx, s: { id: string; roomId: string; ci: string; co: string }, status: "BOOKED" | "PENDING"): Promise<void> {
  const nights = nightsOf(s.ci, s.co);
  for (const d of nights) {
    const date = parseDateOnly(d);
    await tx.roomDayStatus.upsert({
      where: { roomId_date: { roomId: s.roomId, date } },
      create: { roomId: s.roomId, date, status, stayId: s.id, note: PMS_TAG },
      update: { status, stayId: s.id, bookingId: null, note: PMS_TAG },
    });
  }
  await resyncCells(tx, [s.roomId], nights);
}

/** Nhả các ô của lượt ở (từ ngày `from` trở đi nếu có). */
export async function releaseStayCells(tx: Tx, stayId: string, from?: string): Promise<void> {
  const where: Prisma.RoomDayStatusWhereInput = { stayId, ...(from ? { date: { gte: parseDateOnly(from) } } : {}) };
  const rows = await tx.roomDayStatus.findMany({ where, select: { roomId: true, date: true } });
  if (!rows.length) return;
  await tx.roomDayStatus.deleteMany({ where });
  await resyncCells(tx, [...new Set(rows.map((r) => r.roomId))], rows.map((r) => toDateKey(r.date)));
}

/** Đổi trạng thái ô của lượt ở (giữ chỗ ⇒ đã cọc). */
export async function setStayCellStatus(tx: Tx, stayIds: string[], status: "BOOKED" | "PENDING"): Promise<void> {
  if (!stayIds.length) return;
  await tx.roomDayStatus.updateMany({ where: { stayId: { in: stayIds } }, data: { status } });
}

// ============================ ĐƠN SÀN ↔ LƯỢT Ở ============================

const bookingSelect = {
  id: true, code: true, category: true, status: true, heldRoom: true, useDate: true, endDate: true,
  customerName: true, phone: true, adults: true, childrenAges: true, quantity: true, roomId: true, roomIds: true,
  referencePrice: true, roomAmount: true, amountCollected: true, paymentStatus: true, collector: true, note: true, ctvId: true,
} as const;
type BookingRow = Prisma.BookingRequestGetPayload<{ select: typeof bookingSelect }>;

/** Đơn đang giữ phòng: sàn đã chốt, hoặc chủ nhà đã xác nhận còn phòng khi đơn còn chờ. */
export const bookingHolds = (b: { status: string; heldRoom: boolean }) =>
  b.status === "CONFIRMED" || b.status === "COMPLETED" || (b.heldRoom && (b.status === "NEW" || b.status === "CONTACTING"));

/**
 * Giữ ô PENDING theo đơn cho đơn CHƯA chốt mà chủ nhà đã xác nhận (đơn đã chốt: ô do sàn giữ qua
 * assignRoomsForBooking). Nhả ô cũ không còn khớp (đổi phòng / đổi ngày).
 */
async function holdPendingBookingCells(tx: Tx, b: BookingRow, roomIds: string[], homeRoomIds: string[]): Promise<void> {
  const ci = toDateKey(b.useDate);
  const co = toDateKey(b.endDate ?? parseDateOnly(addDaysKey(ci, 1)));
  const want = new Set<string>();
  for (const r of roomIds) for (const d of nightsOf(ci, co)) want.add(`${r}|${d}`);
  // Chỉ ô thuộc homestay này — đơn có phòng ở nhiều homestay không bị xoá nhầm ô của home kia.
  const mine = await tx.roomDayStatus.findMany({ where: { bookingId: b.id, roomId: { in: homeRoomIds } }, select: { id: true, roomId: true, date: true } });
  const stale = mine.filter((c) => !want.has(`${c.roomId}|${toDateKey(c.date)}`));
  if (stale.length) await tx.roomDayStatus.deleteMany({ where: { id: { in: stale.map((c) => c.id) } } });
  const have = new Set(mine.map((c) => `${c.roomId}|${toDateKey(c.date)}`));
  const touched: { roomId: string; d: string }[] = stale.map((c) => ({ roomId: c.roomId, d: toDateKey(c.date) }));
  for (const key of want) {
    if (have.has(key)) continue;
    const [roomId, d] = key.split("|");
    const date = parseDateOnly(d);
    const ex = await tx.roomDayStatus.findUnique({ where: { roomId_date: { roomId, date } } });
    if (ex && ex.status !== "AVAILABLE") continue; // đã bị giữ bởi nguồn khác — không ghi đè
    await tx.roomDayStatus.upsert({
      where: { roomId_date: { roomId, date } },
      create: { roomId, date, status: "PENDING", bookingId: b.id },
      update: { status: "PENDING", bookingId: b.id, stayId: null, note: null },
    });
    touched.push({ roomId, d });
  }
  if (touched.length) await resyncCells(tx, [...new Set(touched.map((t) => t.roomId))], touched.map((t) => t.d));
}

/** Giữ ô PENDING cho đơn chờ ngay trong transaction "Xác nhận còn phòng" (đã khoá homestay + kiểm trống). */
export async function holdPendingCellsTx(tx: Tx, bookingId: string, roomIds: string[], homeRoomIds: string[]): Promise<void> {
  const b = await tx.bookingRequest.findUnique({ where: { id: bookingId }, select: bookingSelect });
  if (b) await holdPendingBookingCells(tx, b, roomIds, homeRoomIds);
}

/**
 * Tiền đã thu của đơn sàn ↔ sổ thu của lượt ở (một nguồn): sàn ghi "đã thu" ⇒ thêm dòng "Sàn thu hộ" vào sổ
 * phòng; chủ nhà ghi thu ở đây ⇒ `pushStayPayments` cập nhật lại "đã thu" của đơn. Combo: phần tiền phòng
 * theo tỉ lệ khách đã trả cho sàn (chủ nhà không thu tiền phòng combo).
 */
async function mirrorStayPayments(tx: Tx, b: BookingRow): Promise<void> {
  const stays = await tx.roomStay.findMany({ where: { bookingId: b.id }, include: { payments: true }, orderBy: { createdAt: "asc" } });
  if (!stays.length) return;
  const lead = stays.find((s) => isLive(s)) ?? stays[0];
  const all = stays.flatMap((s) => s.payments);
  let delta: number;
  if (b.category === "COMBO") {
    const platform = all.filter((p) => p.method === "Sàn thu hộ").reduce((a, p) => a + Number(p.amount), 0);
    delta = comboCollected(b) - platform;
  } else {
    delta = platformDelta(b, all.reduce((a, p) => a + Number(p.amount), 0));
  }
  delta = Math.round(delta);
  if (!delta) return;
  await tx.stayPayment.create({ data: { stayId: lead.id, amount: delta, method: "Sàn thu hộ", kind: delta > 0 ? "Sàn ghi nhận thu" : "Sàn ghi nhận hoàn", by: "Sàn" } });
}

/** Chủ nhà ghi thu / hoàn ở lượt ở của đơn sàn ⇒ cập nhật "đã thu" + tình trạng thanh toán + nhật ký đơn. */
export async function pushStayPayments(tx: Tx, bookingId: string, by: string, title: string): Promise<void> {
  const b = await tx.bookingRequest.findUnique({ where: { id: bookingId }, select: { category: true, referencePrice: true } });
  if (!b || b.category === "COMBO") return; // combo: tiền phòng do sàn điều phối, khoản chủ nhà thu thêm không vào bill combo
  const pays = await tx.stayPayment.findMany({ where: { stay: { bookingId } }, select: { amount: true } });
  const sum = pays.reduce((a, p) => a + Number(p.amount), 0);
  const total = toNumber(b.referencePrice) ?? 0;
  const collected = Math.max(0, total > 0 ? Math.min(sum, total) : sum);
  const paymentStatus = collected <= 0 ? "UNPAID" : total > 0 && collected >= total ? "PAID" : "DEPOSITED";
  await tx.bookingRequest.update({
    where: { id: bookingId },
    data: { amountCollected: collected, paymentStatus, ...(paymentStatus === "PAID" ? { paidAt: new Date() } : {}) },
  });
  await tx.bookingLog.create({ data: { bookingId, kind: "PAYMENT", title, body: `Đã thu cộng dồn: ${collected.toLocaleString("vi-VN")}đ (ghi ở Quản lý phòng)`, by } });
}

/** Đối chiếu lượt ở của MỘT đơn trong MỘT homestay (gọi trong transaction đã khoá homestay). */
async function reconcileBookingStays(tx: Tx, b: BookingRow, serviceId: string, rooms: Map<string, HomeRoomVM>): Promise<void> {
  const myRooms = roomsOfBooking(b).filter((id) => rooms.has(id));
  const existing = await tx.roomStay.findMany({ where: { bookingId: b.id, serviceId } });
  const holds = bookingHolds(b);

  if (!holds) {
    const drop = existing.filter((s) => isLive(s) && !s.checkedInAt);
    if (drop.length) await tx.roomStay.updateMany({ where: { id: { in: drop.map((s) => s.id) } }, data: { state: "cancel" } });
    // Ô PENDING chủ nhà giữ hộ đơn chưa chốt (đơn đã huỷ / sàn bỏ xác nhận) ⇒ nhả.
    const cells = await tx.roomDayStatus.findMany({ where: { bookingId: b.id, roomId: { in: [...rooms.keys()] } }, select: { roomId: true, date: true } });
    if (cells.length) {
      await tx.roomDayStatus.deleteMany({ where: { bookingId: b.id, roomId: { in: [...rooms.keys()] } } });
      await resyncCells(tx, [...new Set(cells.map((c) => c.roomId))], cells.map((c) => toDateKey(c.date)));
    }
    return;
  }

  const ci = toDateKey(b.useDate);
  const co = toDateKey(b.endDate ?? parseDateOnly(addDaysKey(ci, 1)));
  const shares = splitTotal(homeTotalOf(b), myRooms.map((id) => stayPrice(rooms.get(id)!, ci, co, [])));
  const guests = guestsOf(b);
  const groupId = myRooms.length > 1 ? `b:${b.id}` : null;
  const groupName = myRooms.length > 1 ? `Đoàn ${lastName(b.customerName)}` : null;
  const source = b.category === "COMBO" ? "Combo sàn" : b.ctvId ? "CTV" : "Web sàn";
  const used = new Set<string>();
  for (const [i, roomId] of myRooms.entries()) {
    const per = Math.max(1, Math.ceil(guests / myRooms.length));
    const cur = existing.find((s) => s.roomId === roomId && !used.has(s.id) && s.state !== "noshow");
    const data = {
      checkIn: parseDateOnly(ci), checkOut: parseDateOnly(co), total: shares[i] ?? 0, customerName: b.customerName, phone: b.phone,
      groupId, groupName, source,
    };
    if (cur) {
      used.add(cur.id);
      // Chủ nhà đã TỪ CHỐI ⇒ giữ nguyên "reject" (đơn không quay lại tab Đơn web / sơ đồ), trừ khi sau đó chủ nhà xác nhận (heldRoom).
      const revive = cur.state === "cancel" || (cur.state === "reject" && b.heldRoom);
      // Ghi chú lượt ở: lấy ghi chú đơn khi tạo; sau đó thuộc về chủ nhà (op "edit") — đồng bộ không ghi đè.
      const changed =
        revive || toDateKey(cur.checkIn) !== ci || toDateKey(cur.checkOut) !== co || Number(cur.total) !== data.total ||
        cur.customerName !== data.customerName || cur.phone !== data.phone || cur.groupId !== groupId;
      // Đã trả phòng ⇒ giữ nguyên ngày thực tế, chỉ cập nhật tiền/tên.
      if (changed) await tx.roomStay.update({ where: { id: cur.id }, data: cur.checkedOutAt ? { total: data.total, customerName: data.customerName, phone: data.phone } : { ...data, ...(revive ? { state: null } : {}) } });
    } else {
      await createWithCode(tx, { ...data, note: b.note ?? null, serviceId, roomId, bookingId: b.id, guests: per, createdBy: "Sàn" });
    }
  }
  const extra = existing.filter((s) => !used.has(s.id) && isLive(s) && !s.checkedInAt);
  if (extra.length) await tx.roomStay.updateMany({ where: { id: { in: extra.map((s) => s.id) } }, data: { state: "cancel" } });
  if (b.status === "NEW" || b.status === "CONTACTING") await holdPendingBookingCells(tx, b, myRooms, [...rooms.keys()]);
  await mirrorStayPayments(tx, b);
}

/** Tạo lượt ở với mã LT- ngẫu nhiên (thử lại khi trùng mã). */
export async function createWithCode(tx: Tx, data: Omit<Prisma.RoomStayUncheckedCreateInput, "code">): Promise<RoomStay> {
  for (let i = 0; i < 6; i++) {
    const code = stayCode();
    if (await tx.roomStay.findUnique({ where: { code }, select: { id: true } })) continue;
    return tx.roomStay.create({ data: { ...data, code } });
  }
  throw new Error("Không tạo được mã lượt ở, thử lại.");
}

async function roomMapOf(serviceId: string) {
  return new Map((await homeRooms(serviceId)).rooms.map((r) => [r.id, r]));
}

/** Đồng bộ lượt ở theo một đơn của sàn (gọi sau khi khách đặt / admin đổi trạng thái / sửa đơn / huỷ). */
export async function syncStaysForBooking(bookingId: string): Promise<void> {
  const b = await prisma.bookingRequest.findUnique({ where: { id: bookingId }, select: bookingSelect });
  if (!b || !["HOMESTAY", "BUNGALOW", "COMBO"].includes(b.category)) return;
  const roomIds = roomsOfBooking(b);
  const prev = await prisma.roomStay.findMany({ where: { bookingId }, select: { serviceId: true } });
  const fromRooms = roomIds.length
    ? await prisma.room.findMany({ where: { id: { in: roomIds } }, select: { roomType: { select: { serviceId: true } } } })
    : [];
  const homes = [...new Set([...prev.map((p) => p.serviceId), ...fromRooms.map((r) => r.roomType.serviceId)])].sort();
  for (const serviceId of homes) {
    const rooms = await roomMapOf(serviceId);
    await prisma.$transaction(async (tx) => {
      await lockHome(tx, serviceId);
      const fresh = await tx.bookingRequest.findUnique({ where: { id: bookingId }, select: bookingSelect });
      if (fresh) await reconcileBookingStays(tx, fresh, serviceId, rooms);
    }, { timeout: 20_000 });
  }
}

/**
 * Đồng bộ mọi đơn của sàn liên quan homestay (khi mở trang). Chỉ mở transaction cho đơn có chênh lệch
 * (thiếu/thừa lượt ở, đổi ngày/tiền, tiền đã thu chưa khớp) để trang mở nhanh.
 */
export async function syncHomeBookings(serviceId: string): Promise<void> {
  const rooms = await roomMapOf(serviceId);
  const roomIds = [...rooms.keys()];
  if (!roomIds.length) return;
  const { today } = vnNow();
  const floor = parseDateOnly(addDaysKey(today, -3));
  const alive = await prisma.roomStay.findMany({ where: { serviceId, bookingId: { not: null }, state: null, checkedInAt: null }, select: { bookingId: true } });
  const list = await prisma.bookingRequest.findMany({
    where: {
      OR: [
        {
          AND: [
            { OR: [{ roomIds: { hasSome: roomIds } }, { roomId: { in: roomIds } }] },
            { OR: [{ endDate: { gte: floor } }, { endDate: null, useDate: { gte: floor } }] },
          ],
        },
        { id: { in: alive.map((a) => a.bookingId!) } },
      ],
    },
    select: bookingSelect,
  });
  if (!list.length) return;
  const stays = await prisma.roomStay.findMany({ where: { serviceId, bookingId: { in: list.map((b) => b.id) } }, include: { payments: true } });
  const pendingCount = new Map<string, number>();
  for (const c of await prisma.roomDayStatus.findMany({ where: { roomId: { in: roomIds }, bookingId: { in: list.map((b) => b.id) }, status: "PENDING" }, select: { bookingId: true } }))
    pendingCount.set(c.bookingId!, (pendingCount.get(c.bookingId!) ?? 0) + 1);
  for (const b of list) {
    const mine = stays.filter((s) => s.bookingId === b.id);
    const myRooms = roomsOfBooking(b).filter((id) => rooms.has(id));
    let need = false;
    if (!bookingHolds(b)) {
      need = mine.some((s) => isLive(s) && !s.checkedInAt) || (pendingCount.get(b.id) ?? 0) > 0;
    } else {
      const ci = toDateKey(b.useDate);
      const co = toDateKey(b.endDate ?? parseDateOnly(addDaysKey(ci, 1)));
      const live = mine.filter((s) => isLive(s) || (s.state === "reject" && !b.heldRoom));
      const shares = splitTotal(homeTotalOf(b), myRooms.map((id) => stayPrice(rooms.get(id)!, ci, co, [])));
      need =
        ((b.status === "NEW" || b.status === "CONTACTING") && (pendingCount.get(b.id) ?? 0) !== myRooms.length * diffDays(ci, co)) ||
        live.length !== myRooms.length ||
        myRooms.some((rid, i) => {
          const s = live.find((x) => x.roomId === rid);
          return !s || (!s.checkedOutAt && (toDateKey(s.checkIn) !== ci || toDateKey(s.checkOut) !== co)) || Number(s.total) !== shares[i] || s.customerName !== b.customerName || s.phone !== b.phone;
        });
      if (!need && mine.length) {
        const all = mine.flatMap((s) => s.payments);
        if (b.category === "COMBO") need = comboCollected(b) !== Math.round(all.filter((p) => p.method === "Sàn thu hộ").reduce((a, p) => a + Number(p.amount), 0));
        else {
          need = platformDelta(b, all.reduce((a, p) => a + Number(p.amount), 0)) !== 0;
        }
      }
    }
    if (!need) continue;
    try {
      await prisma.$transaction(async (tx) => {
        await lockHome(tx, serviceId);
        const fresh = await tx.bookingRequest.findUnique({ where: { id: b.id }, select: bookingSelect });
        if (fresh) await reconcileBookingStays(tx, fresh, serviceId, rooms);
      }, { timeout: 20_000 });
    } catch (err) {
      console.error("[stay] đồng bộ đơn", b.code, err);
    }
  }
}

/** Tự nhả giữ chỗ chưa cọc quá hạn (lượt chủ tự tạo). Chạy 5 phút/lần (instrumentation) + khi mở trang. */
export async function releaseExpiredStayHolds(serviceId?: string): Promise<number> {
  const due = await prisma.roomStay.findMany({
    where: { ...(serviceId ? { serviceId } : {}), bookingId: null, state: null, checkedInAt: null, holdUntil: { lt: new Date() }, payments: { none: {} } },
    select: { id: true, serviceId: true },
  });
  let n = 0;
  for (const s of due) {
    await prisma.$transaction(async (tx) => {
      await lockHome(tx, s.serviceId);
      const cur = await tx.roomStay.findUnique({ where: { id: s.id }, include: { payments: { select: { id: true } } } });
      if (!cur || cur.state || cur.checkedInAt || cur.payments.length || !cur.holdUntil || cur.holdUntil > new Date()) return;
      await tx.roomStay.update({ where: { id: s.id }, data: { state: "cancel", note: [cur.note, "Tự nhả: quá hạn giữ chỗ chưa cọc"].filter(Boolean).join(" · ") } });
      await releaseStayCells(tx, s.id);
      n++;
    });
  }
  return n;
}
