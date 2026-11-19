import "server-only";
import { randomBytes } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import type { SessionPayload } from "./auth-token";
import { parseDateOnly, toDateKey } from "./dates";
import { dmy, wdShort } from "./date-format";
import { generateBookingCode, slugify } from "./utils";
import {
  DATE_RE, PUBLIC_VENUE, asReview, normPhone, isPublicVenue, DEFAULT_COLS, DEFAULT_ROWS, DRAFT_HOLD_MIN, isSeatItem, seatName, unitWord, TIME_RE, WEB_CONFIRM_MIN, WEB_MAX, addDaysKey, cellType, mealOverlap, mealRange, normalizeConfig, normalizeLayout, scanSessionTime, scanCandidateTimes, seatClassOf, seatKey, slotPassed, vnNow, webHoldCap,
  type OrderStatus, type PubAvail, type PubCard, type PubShow, type PubVenue, type ScanResult, type SeatLayout, type TkData, type TkOrder, type TkVenueRef, type VenueConfig, type VenueKind,
} from "./ticket-core";

/**
 * Module Vé & đặt bàn — phía server. Mọi giá / quota / chỗ ngồi tính lại ở đây, không tin client.
 * - Chống bán trùng ghế / bàn: unique (sessionId, key) trên TicketSeat.
 * - Chống vượt quota: khoá advisory theo suất (`lockSession`) rồi mới đếm.
 * - Đơn chờ thu tiền quá `holdUntil` ⇒ tự huỷ + nhả chỗ (`releaseExpiredTicketHolds`, chạy khi mở trang và 5 phút/lần).
 * `createTicketOrder` dùng chung cho quầy / điện thoại (quản trị) và luồng đặt của khách sau này.
 */

/** Lỗi nghiệp vụ — thông báo hiện thẳng cho người dùng. */
export class TicketError extends Error {}
const fail = (m: string): never => {
  throw new TicketError(m);
};
type Tx = Prisma.TransactionClient;
/** Thời gian tối đa của giao dịch tạo / chốt đơn. */
const TX_OPTS = { timeout: 30_000, maxWait: 15_000 };
const num = (d: Prisma.Decimal | number | null | undefined) => Number(d ?? 0);

// ----------------------------- Quyền -----------------------------
/** "all" (admin) | id chủ địa điểm (PROVIDER, hoặc chủ của nhân viên STAFF) | null. */
export async function ticketOwnerOf(session: SessionPayload | null): Promise<"all" | string | null> {
  if (!session) return null;
  if (session.role === "ADMIN") return "all";
  // DEMO = khách xem bản demo (/demo/ve, /demo/goi-mon): thao tác trên các địa điểm của chủ demo (src/lib/module-demo.ts).
  if (session.role === "PROVIDER" || session.role === "DEMO") return session.sub;
  if (session.role === "STAFF") {
    const u = await prisma.adminUser.findUnique({ where: { id: session.sub }, select: { providerId: true, active: true } });
    return u?.active && u.providerId ? u.providerId : null;
  }
  return null;
}

export async function venuesFor(session: SessionPayload | null): Promise<TkVenueRef[]> {
  const owner = await ticketOwnerOf(session);
  if (!owner) return [];
  const rows = await prisma.ticketVenue.findMany({
    where: owner === "all" ? {} : { ownerId: owner },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, kind: true, name: true, review: true, published: true },
  });
  return rows.map((r) => ({ id: r.id, kind: r.kind as VenueKind, name: r.name, review: asReview(r.review), published: r.published }));
}

export async function canManageVenue(session: SessionPayload | null, venueId: string) {
  const owner = await ticketOwnerOf(session);
  if (!owner || !venueId) return null;
  return prisma.ticketVenue.findFirst({ where: { id: venueId, ...(owner === "all" ? {} : { ownerId: owner }) }, select: { id: true, kind: true, name: true, ownerId: true, review: true, published: true } });
}

// ----------------------------- Nạp dữ liệu -----------------------------
const orderInclude = { items: true, seats: true, tickets: true } as const;
type OrderRow = Prisma.TicketOrderGetPayload<{ include: typeof orderInclude }>;
const hhmm = (d: Date) => vnNow(d.getTime()).now;

export function orderVM(o: OrderRow): TkOrder {
  return {
    id: o.id, code: o.code, token: o.token, sessionId: o.sessionId,
    // Đơn nháp: note chỉ chứa khoá giữ chỗ theo IP (HOLD_NOTE), không phải ghi chú của khách.
    name: o.customerName, phone: o.phone, guests: o.guests, note: o.status === "draft" ? "" : (o.note ?? ""), source: o.source,
    status: o.status as OrderStatus,
    ticketAmount: num(o.ticketAmount), foodAmount: num(o.foodAmount), total: num(o.total), deposit: num(o.deposit), paid: num(o.paid),
    payMethod: o.payMethod, holdUntil: o.holdUntil ? o.holdUntil.getTime() : null, createdBy: o.createdBy, createdAt: o.createdAt.getTime(),
    items: o.items.map((i) => ({ kind: i.kind === "food" ? "food" : "ticket", refId: i.refId, name: i.name, price: num(i.price), qty: i.qty, note: i.note ?? "" })),
    seats: o.seats.map((s) => s.key),
    tickets: o.tickets
      .slice()
      .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }))
      .map((t) => ({ id: t.id, code: t.code, token: t.token, kind: t.kind === "food" ? "food" : "entry", label: t.label, seatKey: t.seatKey, usedAt: t.usedAt ? hhmm(t.usedAt) : null, usedBy: t.usedBy })),
  };
}

export async function loadTicketData(venueId: string): Promise<TkData> {
  await releaseExpiredTicketHolds(venueId).catch(() => 0);
  const { today } = vnNow();
  const from = parseDateOnly(addDaysKey(today, -1));
  // Màn quản trị nạp lại 20 giây/lần ⇒ không kéo mọi đơn tương lai (PERF-3). Vé cổng / nhà hàng chỉ xem 7 ngày tới (lấy 14),
  // show xem theo từng suất (lấy 180 ngày). Đơn đang chờ (wait/draft) luôn lấy hết — danh sách chờ gọi / chờ thu không bị sót.
  const kindRow = await prisma.ticketVenue.findUniqueOrThrow({ where: { id: venueId }, select: { kind: true } });
  const until = parseDateOnly(addDaysKey(today, kindRow.kind === "SHOW" ? 180 : 14));
  const near = { date: { gte: from, lte: until } };
  const [v, sessions, orders, locks] = await Promise.all([
    prisma.ticketVenue.findUniqueOrThrow({
      where: { id: venueId },
      include: {
        tiers: { orderBy: [{ sortOrder: "asc" }, { price: "desc" }] },
        menu: { orderBy: [{ sortOrder: "asc" }, { name: "asc" }] },
        tables: { orderBy: [{ floor: "asc" }, { sortOrder: "asc" }, { name: "asc" }] },
      },
    }),
    // Suất show giữ đủ (dòng nhẹ; "+ Tạo suất nhanh" nối tiếp suất cuối). Vé cổng / bàn tạo suất khi cần ⇒ chỉ cần khoảng gần.
    prisma.ticketSession.findMany({ where: { venueId, date: kindRow.kind === "SHOW" ? { gte: from } : near.date }, orderBy: [{ date: "asc" }, { time: "asc" }] }),
    prisma.ticketOrder.findMany({
      where: { venueId, OR: [{ status: { in: ["wait", "draft"] }, session: { date: { gte: from } } }, { status: { not: "cancel" }, session: near }] },
      include: orderInclude, orderBy: { createdAt: "asc" },
    }),
    prisma.ticketSeat.findMany({ where: { orderId: null, session: { venueId, date: { gte: from } } }, select: { sessionId: true, key: true } }),
  ]);
  // Đơn chờ ở ngày xa hơn cửa sổ suất ⇒ nạp thêm đúng các suất đó (RestTab/GateTab không thiếu giờ / ngày).
  const haveIds = new Set(sessions.map((s) => s.id));
  const missIds = [...new Set(orders.map((o) => o.sessionId).filter((id) => !haveIds.has(id)))];
  if (missIds.length) {
    const extra = await prisma.ticketSession.findMany({ where: { id: { in: missIds }, venueId } });
    sessions.push(...extra);
    sessions.sort((a, b) => a.date.getTime() - b.date.getTime() || a.time.localeCompare(b.time));
  }
  const owner = v.ownerId ? await prisma.adminUser.findUnique({ where: { id: v.ownerId }, select: { name: true } }) : null;
  return {
    venue: {
      id: v.id, kind: v.kind as VenueKind, slug: v.slug, name: v.name, area: v.area ?? "", description: v.description ?? "", coverImage: v.coverImage, published: v.published, placeId: v.placeId,
      config: normalizeConfig(v.config), layout: normalizeLayout(v.layout), ownerId: v.ownerId, ownerName: owner?.name ?? "",
      review: asReview(v.review), reviewNote: v.reviewNote ?? "", submittedAt: v.submittedAt ? v.submittedAt.getTime() : null,
    },
    tiers: v.tiers.map((t) => ({ id: t.id, name: t.name, price: num(t.price), listPrice: t.listPrice == null ? null : num(t.listPrice), seatClass: t.seatClass === "vip" || t.seatClass === "norm" ? t.seatClass : null, quota: t.quota, active: t.active })),
    menu: v.menu.map((m) => ({ id: m.id, name: m.name, group: m.group ?? "", price: num(m.price), active: m.active, images: m.images.length ? m.images : m.imageUrl ? [m.imageUrl] : [] })),
    tables: v.tables.map((t) => ({ id: t.id, name: t.name, cap: t.capacity, zone: t.zone, floor: t.floor, round: t.round, active: t.active })),
    sessions: sessions.map((s) => ({ id: s.id, date: toDateKey(s.date), time: s.time, quota: s.quota, status: s.status === "paused" ? "paused" : "open" })),
    orders: orders.map(orderVM),
    locks,
    today,
    now: Date.now(),
  };
}

/** Đơn chờ thu tiền đã quá hạn giữ chỗ ⇒ huỷ + nhả ghế / bàn. Trả số đơn đã huỷ. */
export async function releaseExpiredTicketHolds(venueId?: string): Promise<number> {
  const expired = () => ({ status: { in: ["wait", "draft"] }, holdUntil: { lt: new Date() }, ...(venueId ? { venueId } : {}) });
  const exp = await prisma.ticketOrder.findMany({ where: expired(), select: { id: true } });
  if (!exp.length) return 0;
  return prisma.$transaction(async (tx) => {
    // Khoá dòng đơn rồi kiểm lại: đơn vừa được "Đã thu tiền" / chốt (ở giao dịch khác) không bị huỷ, không mất ghế.
    const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "TicketOrder" WHERE id = ANY(${exp.map((e) => e.id)}) FOR UPDATE SKIP LOCKED`;
    if (!locked.length) return 0;
    const still = await tx.ticketOrder.findMany({ where: { id: { in: locked.map((l) => l.id) }, ...expired() }, select: { id: true } });
    if (!still.length) return 0;
    const ids = still.map((e) => e.id);
    await tx.ticketSeat.deleteMany({ where: { orderId: { in: ids } } });
    const res = await tx.ticketOrder.updateMany({ where: { id: { in: ids } }, data: { status: "cancel" } });
    return res.count;
  });
}

/** Khoá dòng đơn trong giao dịch (chống đua giữa thu tiền / chốt đơn / huỷ / tự nhả hết hạn). */
async function lockOrder(tx: Tx, orderId: string): Promise<void> {
  await tx.$queryRaw`SELECT id FROM "TicketOrder" WHERE id = ${orderId} FOR UPDATE`;
}

// ----------------------------- Suất -----------------------------
async function lockSession(tx: Tx, sessionId: string): Promise<void> {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${"ticket:" + sessionId}))::text AS ok`;
}
/**
 * Nhà hàng: khoá cấp ĐỊA ĐIỂM cho mọi lượt giữ bàn (lấy TRƯỚC khoá suất). Bàn đặt lúc S chiếm [S, S + mealMin) nên chồng
 * sang các khung giờ (suất) khác — unique (sessionId, key) chỉ chặn trùng đúng một khung, phần chồng giờ phải đếm dưới khoá này.
 */
async function lockRestVenue(tx: Tx, venueId: string): Promise<void> {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${"ticket-rest:" + venueId}))::text AS ok`;
}

/**
 * Bàn trong `tableIds` đã có lượt giữ chồng giờ với (date, time) — xét suất của ngày trước / trong / sau (qua nửa đêm).
 * Trả [{ tableId, time }] của lượt đang chặn. Gọi dưới `lockRestVenue` để không có lượt mới chen giữa lúc đếm và lúc ghi.
 */
async function restConflicts(tx: Tx, venueId: string, date: string, time: string, tableIds: string[], mealMin: number, exceptOrderId?: string) {
  if (!tableIds.length) return [];
  const rows = await tx.ticketSeat.findMany({
    where: { key: { in: tableIds }, ...(exceptOrderId ? { OR: [{ orderId: null }, { orderId: { not: exceptOrderId } }] } : {}), session: { venueId, date: { gte: parseDateOnly(addDaysKey(date, -1)), lte: parseDateOnly(addDaysKey(date, 1)) } } },
    select: { key: true, session: { select: { date: true, time: true } } },
  });
  return rows.filter((r) => r.session.time && mealOverlap(toDateKey(r.session.date), r.session.time, date, time, mealMin)).map((r) => ({ tableId: r.key, time: r.session.time }));
}
const checkDate = (date: string) => (DATE_RE.test(date) ? date : fail("Ngày không hợp lệ."));

/** GATE / RESTAURANT: suất tạo khi cần (như chuyến ảo của cabin). */
async function ensureSession(tx: Tx, venueId: string, date: string, time: string) {
  const d = parseDateOnly(checkDate(date));
  return tx.ticketSession.upsert({ where: { venueId_date_time: { venueId, date: d, time } }, create: { venueId, date: d, time }, update: {} });
}

export async function createSessions(venueId: string, dates: string[], time: string): Promise<number> {
  if (!TIME_RE.test(time)) fail("Giờ diễn chưa đúng dạng HH:MM.");
  const { today } = vnNow();
  const list = [...new Set(dates)].filter((d) => DATE_RE.test(d) && d >= today).slice(0, 60);
  if (!list.length) fail("Chọn ít nhất một ngày từ hôm nay trở đi.");
  const res = await prisma.ticketSession.createMany({ data: list.map((d) => ({ venueId, date: parseDateOnly(d), time })), skipDuplicates: true });
  return res.count;
}

/** Đổi quota ngày (GATE) / tạm dừng – mở bán lại. */
export async function patchSession(venueId: string, date: string, time: string, patch: { quota?: number; status?: "open" | "paused" }) {
  await prisma.$transaction(async (tx) => {
    const v = await tx.ticketVenue.findUniqueOrThrow({ where: { id: venueId }, select: { kind: true } });
    const s =
      v.kind === "SHOW"
        ? ((await tx.ticketSession.findUnique({ where: { venueId_date_time: { venueId, date: parseDateOnly(checkDate(date)), time } } })) ?? fail("Suất diễn không tồn tại."))
        : await ensureSession(tx, venueId, date, time);
    await lockSession(tx, s.id);
    const data: Prisma.TicketSessionUpdateInput = {};
    if (patch.status) data.status = patch.status;
    if (patch.quota != null) {
      const sold = await soldQty(tx, s.id);
      if (patch.quota < sold) fail(`Đã bán ${sold} vé — quota không thể thấp hơn.`);
      data.quota = Math.min(100000, Math.round(patch.quota));
    }
    await tx.ticketSession.update({ where: { id: s.id }, data });
  });
}

export async function deleteSession(venueId: string, sessionId: string) {
  const s = (await prisma.ticketSession.findFirst({ where: { id: sessionId, venueId } })) ?? fail("Suất không tồn tại.");
  if (await prisma.ticketOrder.count({ where: { sessionId: s.id, status: { not: "cancel" } } })) fail("Suất đã có đơn — huỷ hết đơn trước, hoặc bấm Tạm dừng.");
  await prisma.ticketSession.delete({ where: { id: s.id } });
}

/** Số vé (dòng kind=ticket) đã bán + đang giữ của suất; `refId` = chỉ đếm một hạng vé. */
async function soldQty(tx: Tx, sessionId: string, refId?: string): Promise<number> {
  const r = await tx.ticketOrderItem.aggregate({
    _sum: { qty: true },
    where: { kind: "ticket", ...(refId ? { refId } : {}), order: { sessionId, status: { not: "cancel" } } },
  });
  return r._sum.qty ?? 0;
}

// ----------------------------- Tạo đơn -----------------------------
export interface NewTicketOrder {
  venueId: string;
  date: string;
  time: string;
  name: string;
  phone: string;
  email?: string | null;
  guests?: number;
  note?: string;
  source: string;
  ctvId?: string | null;
  createdBy?: string | null;
  /** Vé không số ghế (vé cổng, khu đứng). */
  tickets?: { tierId: string; qty: number }[];
  /** SHOW: mã ghế. */
  seats?: string[];
  /** RESTAURANT: bàn. */
  tableIds?: string[];
  food?: { menuId: string; qty: number; note?: string }[];
  /**
   * paid = thu đủ ngay · confirmed = đã xác nhận, chưa thu · hold = chờ thu tiền, giữ chỗ có hạn · request = chờ gọi xác nhận ·
   * draft = khách web giữ ghế / bàn DRAFT_HOLD_MIN phút trong lúc điền thông tin (chốt bằng finalizeDraft).
   */
  mode: "paid" | "confirmed" | "hold" | "request" | "draft";
  /** Tổng tiền khách đang thấy — lệch số server ⇒ từ chối (giá vừa đổi). */
  expectedTotal?: number;
  payMethod?: string;
  /** Thao tác của quản trị: không ép chính sách "đặt món tối thiểu". */
  staff?: boolean;
  /** Khách xem BẢN DEMO đặt thử trên địa điểm demo (chưa mở bán) — bỏ điều kiện "đã mở bán", các kiểm tra khác giữ nguyên. */
  preview?: boolean;
  /** Đơn nháp của khách web: khoá thiết bị (băm IP) để giới hạn số chỗ giữ cùng lúc (webHoldCap). */
  holdKey?: string;
}
/** Tiền tố ghi chú của đơn nháp mang khoá giữ chỗ — finalizeDraft ghi đè note bằng ghi chú thật của khách. */
const HOLD_NOTE = "#hold:";

async function newOrderCode(tx: Tx): Promise<string> {
  for (let i = 0; i < 6; i++) {
    const code = generateBookingCode("TICKET");
    if (!(await tx.ticketOrder.findUnique({ where: { code }, select: { id: true } }))) return code;
  }
  return fail("Không tạo được mã đơn, thử lại.");
}
const newToken = () => randomBytes(12).toString("base64url");

export async function createTicketOrder(input: NewTicketOrder): Promise<{ id: string; code: string; token: string }> {
  const name = input.name.trim().slice(0, 80);
  const phone = normPhone(input.phone);
  if (name.length < 2 && input.mode !== "draft") fail("Nhập tên khách.");
  // Nhả các đơn đã quá hạn giữ chỗ trước (tác vụ định kỳ chỉ chạy 5 phút/lần) ⇒ ghế / quota của đơn hết hạn không chặn người mua kế tiếp.
  await releaseExpiredTicketHolds(input.venueId).catch(() => 0);
  try {
    return await prisma.$transaction(async (tx) => {
      const v = await tx.ticketVenue.findUniqueOrThrow({ where: { id: input.venueId }, include: { tiers: true, menu: true, tables: true } });
      const kind = v.kind as VenueKind;
      const cfg = normalizeConfig(v.config);
      const layout = normalizeLayout(v.layout);
      const dateKey = checkDate(input.date);
      const vn = vnNow();
      if (dateKey < vn.today) fail("Ngày đã qua.");
      const time = kind === "GATE" ? "" : input.time;
      let webUnits = 0;
      if (!input.staff) {
        if (!isPublicVenue(v) && !input.preview) fail("Địa điểm này chưa mở bán.");
        // Khách web chỉ đặt trước tối đa 1 năm (vé cổng / bàn tạo suất khi cần — không để API tạo suất vô hạn về sau).
        if (dateKey > addDaysKey(vn.today, 365)) fail("Chỉ nhận đặt trước tối đa 1 năm.");
        if (kind !== "GATE" && slotPassed(dateKey, time, vn.today, vn.now)) fail("Khung giờ này đã qua.");
        const n = (input.tickets ?? []).reduce((a, t) => a + Math.max(0, Math.round(t.qty)), 0) + (kind === "SHOW" ? new Set(input.seats ?? []).size : kind === "RESTAURANT" ? new Set(input.tableIds ?? []).size : 0);
        if (n > WEB_MAX[kind]) fail(kind === "RESTAURANT" ? `Mỗi đơn tối đa ${WEB_MAX[kind]} bàn — đoàn lớn hơn vui lòng gọi quán.` : `Mỗi đơn tối đa ${WEB_MAX[kind]} vé.`);
        webUnits = n;
      }
      if (input.mode === "draft" && input.holdKey && !input.staff) await capWebHolds(tx, v.id, kind, input.holdKey, webUnits);
      if (kind !== "GATE" && !TIME_RE.test(time)) fail("Giờ không hợp lệ.");
      if (kind === "RESTAURANT" && !cfg.slots.includes(time)) fail("Khung giờ này quán không nhận đặt.");
      if (kind === "RESTAURANT") await lockRestVenue(tx, v.id);
      const s =
        kind === "SHOW"
          ? ((await tx.ticketSession.findUnique({ where: { venueId_date_time: { venueId: v.id, date: parseDateOnly(dateKey), time } } })) ?? fail("Suất diễn không tồn tại."))
          : await ensureSession(tx, v.id, dateKey, time);
      await lockSession(tx, s.id);
      if (s.status === "paused") fail("Suất này đang tạm dừng bán.");

      const items: { kind: string; refId: string; name: string; price: number; qty: number; note?: string }[] = [];
      // --- Vé không số ghế ---
      let qtyNew = 0;
      for (const t of input.tickets ?? []) {
        const qty = Math.round(t.qty);
        if (!qty) continue;
        if (qty < 0 || qty > 200) fail("Số vé không hợp lệ.");
        const tier = v.tiers.find((x) => x.id === t.tierId && x.active && !x.seatClass) ?? fail("Hạng vé không hợp lệ.");
        if (kind === "SHOW" && tier.quota != null) {
          const sold = await soldQty(tx, s.id, tier.id);
          if (sold + qty > tier.quota) fail(`${tier.name}: chỉ còn ${Math.max(0, tier.quota - sold)} vé.`);
        }
        items.push({ kind: "ticket", refId: tier.id, name: tier.name, price: num(tier.price), qty });
        qtyNew += qty;
      }
      if (kind === "GATE") {
        if (!qtyNew) fail("Chọn ít nhất 1 vé.");
        const quota = s.quota ?? cfg.quota;
        const sold = await soldQty(tx, s.id);
        if (sold + qtyNew > quota) fail(`Vượt quota ngày ${dmy(dateKey)} — chỉ còn ${Math.max(0, quota - sold)} vé. Tăng quota trước khi bán.`);
      }
      // --- Ghế (SHOW) ---
      const seats = kind === "SHOW" ? [...new Set(input.seats ?? [])] : [];
      if (seats.length > 60) fail("Mỗi đơn tối đa 60 ghế.");
      for (const cls of ["vip", "norm"] as const) {
        const n = seats.filter((k) => seatClassOf(layout, k) === cls).length;
        if (!n) continue;
        const tier = v.tiers.find((x) => x.seatClass === cls && x.active) ?? fail(`Chưa khai giá ghế ${cls === "vip" ? "VIP" : "Thường"} (tab Thiết lập).`);
        items.push({ kind: "ticket", refId: tier.id, name: `${unitWord(cfg.seatUnit)} ${tier.name}`, price: num(tier.price), qty: n });
      }
      if (seats.some((k) => !seatClassOf(layout, k))) fail("Có ghế không bán được trên sơ đồ.");
      if (kind === "SHOW" && !seats.length && !qtyNew) fail("Chọn ghế hoặc vé.");
      // --- Bàn (RESTAURANT) ---
      const tables = kind === "RESTAURANT" ? [...new Set(input.tableIds ?? [])].map((id) => v.tables.find((t) => t.id === id && t.active) ?? fail("Bàn không hợp lệ.")) : [];
      if (kind === "RESTAURANT" && !tables.length) fail("Chọn bàn.");
      // --- Món ---
      for (const f of input.food ?? []) {
        const qty = Math.round(f.qty);
        if (!qty) continue;
        if (qty < 0 || qty > 200) fail("Số lượng món không hợp lệ.");
        const m = v.menu.find((x) => x.id === f.menuId && x.active) ?? fail("Món không còn bán.");
        items.push({ kind: "food", refId: m.id, name: m.name, price: num(m.price), qty, note: (f.note ?? "").trim().slice(0, 120) || undefined });
      }

      const sum = (k: string) => items.filter((i) => i.kind === k).reduce((a, i) => a + i.price * i.qty, 0);
      const ticketAmount = sum("ticket");
      const foodAmount = sum("food");
      const total = ticketAmount + foodAmount;
      let deposit = 0;
      if (kind === "RESTAURANT") {
        if (cfg.policy === "deposit") deposit = cfg.amount * tables.length;
        if (cfg.policy === "min" && !input.staff && input.mode !== "draft" && foodAmount < cfg.amount * tables.length)
          fail(`Mỗi bàn cần đặt trước tối thiểu ${cfg.amount.toLocaleString("vi-VN")}đ tiền món.`);
      }
      const keys = kind === "SHOW" ? seats : tables.map((t) => t.id);
      if (keys.length && (await tx.ticketSeat.count({ where: { sessionId: s.id, key: { in: keys } } })))
        fail(kind === "SHOW" ? "Có ghế vừa được người khác giữ — tải lại sơ đồ." : "Bàn này vừa có người đặt ở khung giờ đó.");
      if (kind === "RESTAURANT") {
        const clash = await restConflicts(tx, v.id, dateKey, time, keys, cfg.mealMin);
        if (clash.length) {
          const t = tables.find((x) => x.id === clash[0].tableId);
          fail(`Bàn ${t?.name ?? ""} đã có khách đặt lúc ${clash[0].time} (giữ bàn ${mealRange(clash[0].time, cfg.mealMin)}) — chọn bàn hoặc giờ khác.`);
        }
      }

      if (input.expectedTotal != null && Math.round(input.expectedTotal) !== (kind === "RESTAURANT" ? deposit + foodAmount : total)) fail("Giá vừa thay đổi — tải lại trang để xem giá mới.");
      const status = input.mode === "paid" || input.mode === "confirmed" ? "ok" : input.mode === "draft" ? "draft" : "wait";
      const order = await tx.ticketOrder.create({
        data: {
          code: await newOrderCode(tx),
          token: newToken(),
          venueId: v.id,
          sessionId: s.id,
          customerName: name,
          phone,
          email: input.email?.trim().slice(0, 120) || null,
          guests: Math.min(500, Math.max(1, Math.round(input.guests ?? (qtyNew + seats.length || 1)))),
          note: input.mode === "draft" && input.holdKey ? HOLD_NOTE + input.holdKey : input.note?.trim().slice(0, 500) || null,
          source: input.source.slice(0, 30),
          ctvId: input.ctvId ?? null,
          createdBy: input.createdBy ?? null,
          status,
          ticketAmount, foodAmount, total, deposit,
          paid: input.mode === "paid" ? (kind === "RESTAURANT" ? deposit : total) : 0,
          payMethod: input.mode === "paid" ? (input.payMethod ?? "Tiền mặt") : null,
          // Khách web: mọi đơn chờ (chưa xác nhận / chưa thu) tự huỷ sau WEB_CONFIRM_MIN phút. Quầy / điện thoại: giữ chỗ chờ thu = holdMin.
          holdUntil:
            input.mode === "draft" ? new Date(Date.now() + DRAFT_HOLD_MIN * 60_000)
            : status !== "wait" ? null
            : !input.staff ? new Date(Date.now() + WEB_CONFIRM_MIN * 60_000)
            : input.mode === "hold" ? new Date(Date.now() + cfg.holdMin * 60_000)
            : null,
          items: { create: items },
          seats: { create: keys.map((key) => ({ sessionId: s.id, key })) },
        },
      });
      if (status === "ok") await issueTickets(tx, order.id);
      return { id: order.id, code: order.code, token: order.token };
      // Đơn nhiều vé (đoàn 100+ khách) trên đường truyền chậm cần hơn 5 giây mặc định của Prisma.
    }, TX_OPTS);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new TicketError("Chỗ vừa được người khác giữ — tải lại và thử lại.");
    throw e;
  }
}

/**
 * TK-7 / SEC-7: một IP chỉ giữ nháp tối đa webHoldCap(kind) chỗ cùng lúc tại một địa điểm (đếm trong DB ⇒ đúng cả khi chạy nhiều replica).
 * Vượt mức ⇒ nhả các nháp CŨ NHẤT của chính IP đó (khách tải lại trang / quên gửi `replace` vẫn giữ được lựa chọn mới),
 * nên một máy không chiếm quá một đơn tối đa trên sơ đồ. Khoá advisory theo (địa điểm, IP) chống hai lượt giữ song song.
 */
async function capWebHolds(tx: Tx, venueId: string, kind: VenueKind, holdKey: string, want: number): Promise<void> {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${"ticket-ip:" + venueId + ":" + holdKey}))::text AS ok`;
  const mine = await tx.ticketOrder.findMany({
    where: { venueId, status: "draft", note: HOLD_NOTE + holdKey, holdUntil: { gt: new Date() } },
    select: { id: true, seats: { select: { id: true } }, items: { where: { kind: "ticket" }, select: { qty: true } } },
    orderBy: { createdAt: "asc" },
  });
  const units = (x: (typeof mine)[number]) => (kind === "RESTAURANT" ? x.seats.length : x.items.reduce((a, i) => a + i.qty, 0));
  const cap = webHoldCap(kind);
  let held = mine.reduce((a, x) => a + units(x), 0);
  const drop: string[] = [];
  for (const x of mine) {
    if (held + want <= cap) break;
    drop.push(x.id);
    held -= units(x);
  }
  if (!drop.length) return;
  // SKIP LOCKED: nháp đang được chốt / nhả ở giao dịch khác thì không chờ (tránh khoá chéo) — báo khách thử lại.
  const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "TicketOrder" WHERE id = ANY(${drop}) AND status = 'draft' FOR UPDATE SKIP LOCKED`;
  if (locked.length < drop.length) fail("Bạn đang giữ chỗ ở một cửa sổ khác — thử lại sau ít giây.");
  const ids = locked.map((l) => l.id);
  await tx.ticketSeat.deleteMany({ where: { orderId: { in: ids } } });
  await tx.ticketOrder.updateMany({ where: { id: { in: ids } }, data: { status: "cancel", holdUntil: null } });
}

/** Phát vé điện tử cho đơn đã xác nhận (mỗi người / mỗi ghế 1 mã; mỗi dòng món 1 voucher). Nhà hàng không phát vé. */
async function issueTickets(tx: Tx, orderId: string): Promise<void> {
  const o = await tx.ticketOrder.findUniqueOrThrow({ where: { id: orderId }, include: { items: true, seats: true, tickets: { select: { id: true } }, venue: { include: { tiers: true } } } });
  if (o.tickets.length || o.venue.kind === "RESTAURANT") return;
  const layout = normalizeLayout(o.venue.layout);
  const unit = normalizeConfig(o.venue.config).seatUnit;
  const rows: { kind: string; label: string; seatKey?: string }[] = [];
  const tierName = (cls: string | null) => o.venue.tiers.find((t) => t.seatClass === cls)?.name ?? (cls === "vip" ? "VIP" : "Thường");
  for (const k of o.seats.map((s) => s.key).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })))
    rows.push({ kind: "entry", label: `${unitWord(unit)} ${seatName(layout, k, unit)} · ${tierName(seatClassOf(layout, k))}`, seatKey: k });
  for (const i of o.items) {
    if (i.kind === "food") rows.push({ kind: "food", label: `${i.qty}× ${i.name}` });
    // Dòng ghế (đã phát vé theo từng ghế ở trên): nhận theo hạng ghế; hạng đã bị xoá thì theo tên "Ghế …" lúc tạo đơn.
    else if (!(o.venue.tiers.some((t) => t.id === i.refId) ? !!o.venue.tiers.find((t) => t.id === i.refId)?.seatClass : isSeatItem(i.name))) for (let n = 0; n < i.qty; n++) rows.push({ kind: "entry", label: i.name });
  }
  // Vé vào trước, voucher sau.
  rows.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "entry" ? -1 : 1));
  if (rows.length) await tx.ticket.createMany({ data: rows.map((r, n) => ({ orderId: o.id, code: `${o.code}-${n + 1}`, token: newToken(), kind: r.kind, label: r.label, seatKey: r.seatKey ?? null })) });
}

// ----------------------------- Thao tác trên đơn -----------------------------
async function ownOrder(tx: Tx, venueId: string, orderId: string) {
  if (orderId) await lockOrder(tx, orderId);
  return (await tx.ticketOrder.findFirst({ where: { id: orderId, venueId }, include: { tickets: true, venue: { select: { kind: true, config: true } } } })) ?? fail("Đơn không tồn tại.");
}
const alive = <T extends { status: string }>(o: T): T =>
  o.status === "cancel" ? fail("Đơn đã huỷ (hết hạn giữ chỗ).") : o.status === "draft" ? fail("Khách đang giữ chỗ trên web, chưa gửi đơn — đợi khách gửi hoặc bấm nhả chỗ.") : o;

/** Xác nhận đơn chờ (chưa cần thu tiền) ⇒ phát vé. */
export async function confirmOrder(venueId: string, orderId: string) {
  await prisma.$transaction(async (tx) => {
    const o = alive(await ownOrder(tx, venueId, orderId));
    if (o.status !== "wait") return;
    await tx.ticketOrder.update({ where: { id: o.id }, data: { status: "ok", holdUntil: null } });
    await issueTickets(tx, o.id);
  });
}

/** Ghi "đã thu tiền" (vé: thu đủ; nhà hàng: thu cọc) ⇒ đơn chờ thành đã xác nhận + phát vé. */
export async function payOrder(venueId: string, orderId: string, method: string) {
  await prisma.$transaction(async (tx) => {
    const o = alive(await ownOrder(tx, venueId, orderId));
    const amount = o.venue.kind === "RESTAURANT" ? num(o.deposit) : num(o.total);
    await tx.ticketOrder.update({ where: { id: o.id }, data: { paid: amount, payMethod: method, holdUntil: null, ...(o.status === "wait" ? { status: "ok" } : {}) } });
    await issueTickets(tx, o.id);
  });
}

/** Hoàn tác "đã thu": vé chưa dùng thì thu hồi, đơn quay về chờ thu tiền (giữ chỗ thêm một hạn). */
export async function unpayOrder(venueId: string, orderId: string) {
  await prisma.$transaction(async (tx) => {
    const o = alive(await ownOrder(tx, venueId, orderId));
    if (o.venue.kind === "RESTAURANT") return void (await tx.ticketOrder.update({ where: { id: o.id }, data: { paid: 0, payMethod: null } }));
    if (o.tickets.some((t) => t.usedAt)) fail("Đã có vé được soát — không hoàn tác được.");
    await tx.ticket.deleteMany({ where: { orderId: o.id } });
    await tx.ticketOrder.update({
      where: { id: o.id },
      data: { paid: 0, payMethod: null, status: "wait", holdUntil: new Date(Date.now() + normalizeConfig(o.venue.config).holdMin * 60_000) },
    });
  });
}

/** Huỷ đơn ⇒ nhả ghế / bàn. Vé đã soát thì không huỷ được. */
export async function cancelOrder(venueId: string, orderId: string) {
  await prisma.$transaction(async (tx) => {
    const o = await ownOrder(tx, venueId, orderId);
    if (o.status === "cancel") return;
    if (o.tickets.some((t) => t.usedAt)) fail("Đơn đã có vé được soát — không huỷ được.");
    await tx.ticketSeat.deleteMany({ where: { orderId: o.id } });
    await tx.ticketOrder.update({ where: { id: o.id }, data: { status: "cancel", holdUntil: null } });
  });
}

/** Nhà hàng: Khách đã đến → Bắt đầu lên món → Trả bàn (nhả bàn cho khung giờ đó). */
export async function setTableStatus(venueId: string, orderId: string, to: "here" | "eat" | "done") {
  await prisma.$transaction(async (tx) => {
    const o = alive(await ownOrder(tx, venueId, orderId));
    const okFrom: Record<string, string[]> = { here: ["ok"], eat: ["here", "ok"], done: ["here", "eat"] };
    if (!okFrom[to].includes(o.status)) fail("Trạng thái bàn đã thay đổi — tải lại.");
    if (to === "done") await tx.ticketSeat.deleteMany({ where: { orderId: o.id } });
    await tx.ticketOrder.update({ where: { id: o.id }, data: { status: to } });
  });
}

// ----------------------------- Ghế -----------------------------
/** Khoá / mở khoá một ghế cho khách mời. */
export async function toggleSeatLock(venueId: string, sessionId: string, key: string): Promise<boolean> {
  const s = (await prisma.ticketSession.findFirst({ where: { id: sessionId, venueId }, include: { venue: { select: { layout: true } } } })) ?? fail("Suất không tồn tại.");
  if (!seatClassOf(normalizeLayout(s.venue.layout), key)) fail("Ô này không phải ghế bán được.");
  const cur = await prisma.ticketSeat.findUnique({ where: { sessionId_key: { sessionId, key } } });
  if (cur?.orderId) fail("Ghế đã có đơn.");
  if (cur) {
    await prisma.ticketSeat.delete({ where: { id: cur.id } });
    return false;
  }
  try {
    await prisma.ticketSeat.create({ data: { sessionId, key } });
  } catch {
    fail("Ghế vừa có người giữ.");
  }
  return true;
}

/** Đổi ghế của một đơn sang ghế trống CÙNG HẠNG (không đổi giá). */
export async function moveSeat(venueId: string, orderId: string, from: string, to: string) {
  await prisma.$transaction(async (tx) => {
    if (from === to) return;
    const o = alive(await ownOrder(tx, venueId, orderId));
    const v = await tx.ticketVenue.findUniqueOrThrow({ where: { id: venueId }, include: { tiers: true } });
    const layout = normalizeLayout(v.layout);
    const cls = seatClassOf(layout, to) ?? fail("Ô đích không phải ghế bán được.");
    if (cls !== seatClassOf(layout, from)) fail("Chỉ đổi được sang ghế cùng hạng (khác hạng là khác giá).");
    const seat = (await tx.ticketSeat.findFirst({ where: { orderId: o.id, key: from } })) ?? fail("Đơn không giữ ghế này.");
    if (await tx.ticketSeat.findUnique({ where: { sessionId_key: { sessionId: o.sessionId, key: to } } })) fail(`Ghế ${to} không còn trống.`);
    await tx.ticketSeat.update({ where: { id: seat.id }, data: { key: to } });
    const name = v.tiers.find((t) => t.seatClass === cls)?.name ?? (cls === "vip" ? "VIP" : "Thường");
    const unit = normalizeConfig(v.config).seatUnit;
    await tx.ticket.updateMany({ where: { orderId: o.id, seatKey: from }, data: { seatKey: to, label: `${unitWord(unit)} ${seatName(layout, to, unit)} · ${name}` } });
  }).catch((e) => {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") fail(`Ghế ${to} vừa có người giữ.`);
    throw e;
  });
}

/** Lưu sơ đồ ghế; từ chối nếu làm mất ghế đang có đơn / đang khoá ở suất sắp tới. */
export async function saveLayout(venueId: string, raw: unknown): Promise<SeatLayout> {
  const layout = normalizeLayout(raw);
  const used = await prisma.ticketSeat.findMany({ where: { session: { venueId, date: { gte: parseDateOnly(vnNow().today) } } }, select: { key: true } });
  const lost = [...new Set(used.map((u) => u.key).filter((k) => !seatClassOf(layout, k)))];
  if (lost.length) fail(`Ghế ${lost.slice(0, 6).join(", ")}${lost.length > 6 ? "…" : ""} đang có đơn hoặc đang khoá ở suất sắp tới — không bỏ được.`);
  await prisma.ticketVenue.update({ where: { id: venueId }, data: { layout: layout as unknown as Prisma.InputJsonValue } });
  return layout;
}

// ----------------------------- Thiết lập -----------------------------
/** `review`: "approved" khi admin tạo (mặc định); đối tác tự tạo truyền "draft" ⇒ phải gửi admin duyệt mới mở bán được. */
export async function createVenue(input: { kind: VenueKind; name: string; ownerId?: string | null; placeId?: string | null; review?: "approved" | "draft" }): Promise<string> {
  // Tạo từ một quán có sẵn ở danh mục Nhà hàng / Cafe / Check-in: lấy tên, khu vực, ảnh bìa, giờ mở cửa của quán đó.
  const place = input.placeId ? await prisma.place.findUnique({ where: { id: input.placeId }, select: { id: true, name: true, area: true, coverImage: true, hours: true, desc: true } }) : null;
  const name = (input.name.trim() || place?.name || "").slice(0, 100);
  if (name.length < 2) fail("Nhập tên địa điểm.");
  const base0 = slugify(name) || "dia-diem";
  const base = base0 === "don" ? "don-ve" : base0; // /ve/don/<token> là trang vé điện tử
  let slug = base;
  for (let i = 2; await prisma.ticketVenue.findUnique({ where: { slug }, select: { id: true } }); i++) slug = `${base}-${i}`;
  const tiers: Prisma.TicketTierCreateWithoutVenueInput[] =
    input.kind === "GATE"
      ? [{ name: "Người lớn", price: 50000, sortOrder: 0 }, { name: "Trẻ em 6–11", price: 30000, sortOrder: 1 }, { name: "Dưới 6 tuổi", price: 0, sortOrder: 2 }]
      : input.kind === "SHOW"
        ? [{ name: "VIP", price: 450000, seatClass: "vip", sortOrder: 0 }, { name: "Thường", price: 250000, seatClass: "norm", sortOrder: 1 }]
        : [];
  const v = await prisma.ticketVenue.create({
    data: {
      kind: input.kind, name, slug, ownerId: input.ownerId || null, review: input.review ?? "approved",
      placeId: place?.id ?? null, area: place?.area ?? null, description: place?.desc ?? null,
      coverImage: place?.coverImage && /^\/uploads\/[\w.-]+$/.test(place.coverImage) ? place.coverImage : null,
      config: place?.hours ? { hours: place.hours } : {},
      layout: input.kind === "SHOW" ? { rows: DEFAULT_ROWS, cols: DEFAULT_COLS, cells: Object.fromEntries([0, 1].flatMap((r) => Array.from({ length: DEFAULT_COLS }, (_, c) => [`${r}-${c}`, "vip"]))) } : Prisma.JsonNull,
      tiers: { create: tiers },
    },
  });
  return v.id;
}

/** Địa điểm đang mở bán gắn với một quán (Place) — để trang quán hiện nút "Đặt bàn online" / "Mua vé". */
export async function venueForPlace(placeId: string): Promise<{ slug: string; kind: VenueKind } | null> {
  const v = await prisma.ticketVenue.findFirst({ where: { placeId, ...PUBLIC_VENUE }, select: { slug: true, kind: true }, orderBy: { createdAt: "asc" } });
  return v ? { slug: v.slug, kind: v.kind as VenueKind } : null;
}

/** Ghi đè một phần cấu hình (đã chuẩn hoá). */
export async function patchVenueConfig(venueId: string, patch: Record<string, unknown>) {
  const v = await prisma.ticketVenue.findUniqueOrThrow({ where: { id: venueId }, select: { config: true } });
  const next = normalizeConfig({ ...(v.config as Record<string, unknown>), ...patch });
  await prisma.ticketVenue.update({ where: { id: venueId }, data: { config: next as unknown as Prisma.InputJsonValue } });
}

export async function deleteTable(venueId: string, tableId: string) {
  const t = (await prisma.ticketTable.findFirst({ where: { id: tableId, venueId } })) ?? fail("Bàn không tồn tại.");
  if (await prisma.ticketSeat.count({ where: { key: t.id, session: { venueId, date: { gte: parseDateOnly(vnNow().today) } } } }))
    fail("Bàn đang có khách đặt ở ngày sắp tới — chuyển sang 'ngừng dùng' thay vì xoá.");
  // Gọi món QR: còn lần gọi chưa thu ⇒ xoá bàn làm đơn treo (tableId null), không thu được.
  if (await prisma.dineOrder.count({ where: { tableId: t.id, status: { in: ["new", "cooking", "served"] } } }))
    fail("Bàn còn món gọi qua QR chưa thu tiền — thu tiền / dọn bàn trước khi xoá.");
  await prisma.ticketTable.delete({ where: { id: t.id } });
}

// ----------------------------- Soát vé -----------------------------
const sessionLabel = (date: Date, time: string) => `${wdShort(date)} ${dmy(date)}${time ? " · " + time : ""}`;

/** Số vé vào cổng hôm nay: đã soát / tổng (đơn đã xác nhận). */
export async function scanStats(owner: "all" | string, venueId?: string): Promise<{ checked: number; total: number }> {
  const where: Prisma.TicketWhereInput = {
    kind: "entry",
    order: {
      status: { in: ["ok", "here", "eat", "done"] },
      session: { date: parseDateOnly(vnNow().today) },
      venue: { ...(venueId ? { id: venueId } : {}), ...(owner === "all" ? {} : { ownerId: owner }) },
    },
  };
  const [total, checked] = await Promise.all([prisma.ticket.count({ where }), prisma.ticket.count({ where: { ...where, usedAt: { not: null } } })]);
  return { checked, total };
}

/**
 * Quét một mã: nội dung QR (token hoặc URL chứa token), mã vé (TX-VE-XXXXX-2) hoặc mã đơn (TX-VE-XXXXX ⇒ vé kế tiếp chưa dùng).
 * `deliver` = xác nhận đã giao voucher đồ ăn uống.
 */
export async function scanTicket(owner: "all" | string, by: string, raw: string, opts: { venueId?: string; sessionId?: string; deliver?: boolean } = {}): Promise<ScanResult> {
  const input = raw.trim().split(/[/?#=]/).filter(Boolean).pop()?.trim() ?? "";
  const none: ScanResult = { kind: "none", title: "Không tìm thấy mã", sub: "Kiểm tra lại mã hoặc tra cứu theo số điện thoại" };
  if (input.length < 6 || input.length > 60) return none;
  const inc = { order: { include: { session: true, venue: { select: { id: true, name: true, ownerId: true } }, tickets: { select: { id: true, kind: true, code: true, usedAt: true } } } } } as const;
  let t = await prisma.ticket.findFirst({ where: { OR: [{ token: input }, { code: input.toUpperCase() }] }, include: inc });
  if (!t) {
    const o = await prisma.ticketOrder.findUnique({ where: { code: input.toUpperCase() }, select: { id: true } });
    if (o) {
      const order = { code: "asc" } as const;
      t =
        (await prisma.ticket.findFirst({ where: { orderId: o.id, kind: "entry", usedAt: null }, orderBy: order, include: inc })) ??
        (await prisma.ticket.findFirst({ where: { orderId: o.id, kind: "entry" }, orderBy: order, include: inc }));
      if (!t) return { kind: "wrong", title: "Đơn chưa có vé", sub: "Đơn chưa được xác nhận / chưa thu tiền nên chưa phát vé" };
    }
  }
  if (!t) return none;
  const o = t.order;
  if (owner !== "all" && o.venue.ownerId !== owner) return none;
  if (o.status === "cancel" || o.status === "wait" || o.status === "draft") return { kind: "wrong", title: "Vé không hợp lệ", sub: o.status === "cancel" ? `Đơn ${o.code} đã huỷ` : `Đơn ${o.code} chưa thanh toán` };
  if (opts.venueId && o.venue.id !== opts.venueId) return { kind: "wrong", title: "Sai địa điểm", sub: `Vé của ${o.venue.name}` };
  if (toDateKey(o.session.date) !== vnNow().today) return { kind: "wrong", title: o.session.time ? "Sai suất diễn" : "Sai ngày", sub: `Vé của ${sessionLabel(o.session.date, o.session.time)}, không phải hôm nay` };
  // TK-5: show nhiều suất / ngày — vé phải đúng SUẤT. Máy soát chọn suất (sessionId) ⇒ so thẳng; không chọn ⇒ so với suất đang mở cổng.
  if (o.session.time) {
    if (opts.sessionId) {
      if (o.sessionId !== opts.sessionId) return { kind: "wrong", title: "Sai suất diễn", sub: `Vé suất ${o.session.time} · ${o.venue.name}` };
    } else {
      // Suất tạm dừng không có đơn (chưa bán vé nào) không được coi là suất đang soát.
      const rows = await prisma.ticketSession.findMany({
        where: { venueId: o.venue.id, date: o.session.date },
        select: { time: true, status: true, _count: { select: { orders: { where: { status: { notIn: ["cancel", "draft"] } } } } } },
      });
      const cur = scanSessionTime(scanCandidateTimes(rows.map((x) => ({ time: x.time, status: x.status, orders: x._count.orders }))), vnNow().now);
      if (cur && cur !== o.session.time) return { kind: "wrong", title: "Sai suất diễn", sub: `Vé suất ${o.session.time}, đang soát suất ${cur} · ${o.venue.name}` };
    }
  }
  // Máy soát không chọn địa điểm (soát chung các địa điểm của chủ) ⇒ ghi rõ vé thuộc địa điểm nào.
  const at = opts.venueId ? "" : ` · ${o.venue.name}`;

  const usedSub = () => `Đã quét lúc ${t.usedAt ? hhmm(t.usedAt) : ""}${t.usedBy ? " bởi " + t.usedBy : ""} · ${t.label}`;
  if (t.kind === "food") {
    if (t.usedAt) return { kind: "used", title: "Voucher đã nhận", sub: usedSub() };
    if (!opts.deliver) return { kind: "food", title: "Voucher đồ ăn uống", sub: `${t.label} · chưa nhận · bấm để đánh dấu đã giao${at}`, ticketId: t.id };
    const r = await prisma.ticket.updateMany({ where: { id: t.id, usedAt: null }, data: { usedAt: new Date(), usedBy: by } });
    return r.count ? { kind: "ok", title: "Đã giao voucher", sub: `${t.label} · ${o.customerName} · đơn ${o.code}${at}` } : { kind: "used", title: "Voucher đã nhận", sub: t.label };
  }
  if (t.usedAt) return { kind: "used", title: "Vé đã dùng", sub: usedSub() };
  const r = await prisma.ticket.updateMany({ where: { id: t.id, usedAt: null }, data: { usedAt: new Date(), usedBy: by } });
  if (!r.count) return { kind: "used", title: "Vé đã dùng", sub: t.label };
  const entries = o.tickets.filter((x) => x.kind === "entry").sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
  return { kind: "ok", title: "Hợp lệ · mời vào", sub: `${t.label} · ${o.customerName} · vé ${entries.findIndex((x) => x.id === t.id) + 1}/${entries.length} của đơn ${o.code}${o.session.time ? ` · suất ${o.session.time}` : ""}${at}` };
}

/** Vé điện tử của một đơn (trang công khai /ve/don/<token>). */
export async function orderByToken(token: string) {
  if (!/^[\w-]{10,40}$/.test(token)) return null;
  // Hết hạn giữ chỗ nhưng tác vụ định kỳ chưa chạy ⇒ huỷ ngay, để khách không chuyển khoản cho đơn đã quá hạn.
  const head = await prisma.ticketOrder.findUnique({ where: { token }, select: { venueId: true, status: true, holdUntil: true } });
  if (head && (head.status === "wait" || head.status === "draft") && head.holdUntil && head.holdUntil.getTime() < Date.now()) await releaseExpiredTicketHolds(head.venueId).catch(() => 0);
  const o = await prisma.ticketOrder.findUnique({ where: { token }, include: { ...orderInclude, session: true, venue: { select: { name: true, kind: true, area: true, slug: true, config: true, layout: true, tables: { select: { id: true, name: true } } } } } });
  if (!o || o.status === "draft") return null;
  const cfg = normalizeConfig(o.venue.config);
  const kind = o.venue.kind as VenueKind;
  const order = orderVM(o);
  /** Số tiền khách cần chuyển trước: vé show = cả đơn, nhà hàng = tiền cọc; vé cổng trả khi được gọi xác nhận. */
  const due = order.status === "wait" && kind !== "GATE" ? Math.max(0, (kind === "RESTAURANT" ? order.deposit : order.total) - order.paid) : 0;
  return {
    order, date: toDateKey(o.session.date), time: o.session.time, email: o.email ?? "",
    /** Đơn bị huỷ vì hết hạn giữ chỗ (máy tự nhả giữ nguyên holdUntil; quản trị huỷ tay thì xoá holdUntil). */
    expired: order.status === "cancel" && !!order.holdUntil && order.holdUntil <= Date.now(),
    /** Đơn khách web ⇒ giữ WEB_CONFIRM_MIN phút chờ xác nhận; đơn quầy / điện thoại ⇒ null. */
    webHoldMin: o.createdBy ? null : WEB_CONFIRM_MIN,
    /** Đơn thuộc loại phải chuyển khoản trước (vé show / cọc bàn, địa điểm có tài khoản) — dùng cho câu báo hết hạn. */
    prepay: kind !== "GATE" && (kind === "RESTAURANT" ? order.deposit : order.total) > 0 && !!cfg.bankBin && !!cfg.bankAcc,
    /** Giờ VN hết hạn giữ chỗ "HH:MM". */
    holdUntilHm: order.holdUntil ? vnNow(order.holdUntil).now : "",
    venue: { name: o.venue.name, kind, area: o.venue.area ?? "", slug: o.venue.slug },
    /** Tên chỗ ngồi của đơn (show): "Ghế A7" / "Bàn P-03" — theo sơ đồ + kiểu chỗ của địa điểm. */
    seatLabels: kind === "SHOW" ? order.seats.slice().sort((x, y) => x.localeCompare(y, undefined, { numeric: true })).map((k) => `${unitWord(cfg.seatUnit)} ${seatName(normalizeLayout(o.venue.layout), k, cfg.seatUnit)}`) : [],
    tables: o.seats.map((s) => o.venue.tables.find((t) => t.id === s.key)?.name ?? "").filter(Boolean),
    pay: due > 0 && cfg.bankBin && cfg.bankAcc ? { amount: due, bin: cfg.bankBin, account: cfg.bankAcc, holder: cfg.bankHolder } : null,
  };
}

// ============================ TRANG KHÁCH (/ve) ============================
type PubVenueRow = Prisma.TicketVenueGetPayload<{ include: { tiers: true; menu: true; tables: true } }>;
const pubInclude = {
  tiers: { where: { active: true }, orderBy: [{ sortOrder: "asc" }, { price: "desc" }] },
  menu: { where: { active: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] },
  tables: { where: { active: true }, orderBy: [{ floor: "asc" }, { sortOrder: "asc" }, { name: "asc" }] },
} satisfies Prisma.TicketVenueInclude;

function pubVenue(v: PubVenueRow): PubVenue {
  const c = normalizeConfig(v.config);
  return {
    slug: v.slug, kind: v.kind as VenueKind, name: v.name, area: v.area ?? "", description: v.description ?? "", coverImage: v.coverImage,
    hours: c.hours, artist: c.artist, notes: c.notes, policy: c.policy, amount: c.amount, slots: c.slots, floors: c.floors,
    hasBank: !!(c.bankBin && c.bankAcc), holdMin: c.holdMin, seatUnit: c.seatUnit, mealMin: c.mealMin, layout: normalizeLayout(v.layout),
    tiers: v.tiers.map((t) => ({ id: t.id, name: t.name, price: num(t.price), listPrice: t.listPrice == null ? null : num(t.listPrice), seatClass: t.seatClass === "vip" || t.seatClass === "norm" ? t.seatClass : null, quota: t.quota })),
    menu: v.menu.map((m) => ({ id: m.id, name: m.name, group: m.group ?? "", price: num(m.price), desc: m.description ?? "", images: m.images.length ? m.images : m.imageUrl ? [m.imageUrl] : [] })),
    tables: v.tables.map((t) => ({ id: t.id, name: t.name, cap: t.capacity, zone: t.zone, floor: t.floor, round: t.round })),
  };
}

/** Tình trạng còn chỗ 7 ngày tới (vé cổng / bàn) và các suất diễn sắp tới — không lộ thông tin khách. */
async function pubAvail(v: PubVenueRow, cfg: VenueConfig): Promise<PubAvail> {
  const vn = vnNow();
  const days = Array.from({ length: 7 }, (_, i) => addDaysKey(vn.today, i));
  const kind = v.kind as VenueKind;
  // Nhà hàng: lấy thêm ngày trước / sau để tính lượt giữ bàn chồng qua nửa đêm.
  const sessions = await prisma.ticketSession.findMany({
    where: {
      venueId: v.id,
      date: kind === "SHOW" ? { gte: parseDateOnly(vn.today) } : kind === "RESTAURANT" ? { gte: parseDateOnly(addDaysKey(vn.today, -1)), lte: parseDateOnly(addDaysKey(days[6], 1)) } : { gte: parseDateOnly(vn.today), lte: parseDateOnly(days[6]) },
    },
    orderBy: [{ date: "asc" }, { time: "asc" }],
    take: 400,
  });
  const ids = sessions.map((s) => s.id);
  const [seats, items] = await Promise.all([
    kind === "GATE" ? [] : prisma.ticketSeat.findMany({ where: { sessionId: { in: ids } }, select: { sessionId: true, key: true, order: { select: { status: true } } } }),
    kind === "RESTAURANT" ? [] : prisma.ticketOrderItem.findMany({ where: { kind: "ticket", order: { sessionId: { in: ids }, status: { not: "cancel" } } }, select: { refId: true, qty: true, order: { select: { sessionId: true } } } }),
  ]);
  const out: PubAvail = { today: vn.today, days, gate: {}, shows: [], rest: {} };
  if (kind === "GATE") {
    for (const d of days) {
      const s = sessions.find((x) => toDateKey(x.date) === d);
      const sold = s ? items.filter((i) => i.order.sessionId === s.id).reduce((a, i) => a + i.qty, 0) : 0;
      out.gate[d] = { left: Math.max(0, (s?.quota ?? cfg.quota) - sold), paused: s?.status === "paused" };
    }
  } else if (kind === "SHOW") {
    const layout = normalizeLayout(v.layout);
    const sellable: string[] = [];
    for (let r = 0; r < layout.rows; r++) for (let c = 0; c < layout.cols; c++) if (cellType(layout, r, c) === "vip" || cellType(layout, r, c) === "norm") sellable.push(seatKey(r, c));
    const stand = v.tiers.filter((t) => t.active && !t.seatClass);
    for (const s of sessions) {
      const date = toDateKey(s.date);
      if (slotPassed(date, s.time, vn.today, vn.now)) continue;
      const taken: PubShow["taken"] = {};
      for (const x of seats) if (x.sessionId === s.id) taken[x.key] = x.order && (x.order.status === "draft" || x.order.status === "wait") ? "held" : "sold";
      const standLeft: PubShow["standLeft"] = {};
      for (const t of stand) standLeft[t.id] = t.quota == null ? null : Math.max(0, t.quota - items.filter((i) => i.order.sessionId === s.id && i.refId === t.id).reduce((a, i) => a + i.qty, 0));
      const standCap = stand.reduce((a, t) => a + (t.quota ?? 0), 0);
      const standFree = Object.values(standLeft).reduce((a: number, n) => a + (n ?? 0), 0);
      out.shows.push({ date, time: s.time, paused: s.status === "paused", taken, standLeft, free: sellable.filter((k) => !taken[k]).length + standFree, total: sellable.length + standCap });
    }
  } else {
    // Mỗi khung giờ của 7 ngày: bàn có lượt giữ chồng giờ (|S − giờ khung| < mealMin), kể cả lượt ở khung giờ khác.
    const held = seats.map((x) => {
      const s = sessions.find((y) => y.id === x.sessionId)!;
      return { key: x.key, date: toDateKey(s.date), time: s.time };
    });
    for (const d of days)
      for (const time of new Set([...cfg.slots, ...sessions.filter((s) => toDateKey(s.date) === d).map((s) => s.time)]))
        out.rest[`${d}|${time}`] = [...new Set(held.filter((x) => mealOverlap(x.date, x.time, d, time, cfg.mealMin)).map((x) => x.key))];
  }
  return out;
}

const RELEASE_EVERY_MS = 30_000;
const lastRelease = new Map<string, number>();

/** Trang đặt của một địa điểm đang mở bán. */
export async function publicVenue(slug: string, demoOwnerId?: string): Promise<{ venue: PubVenue; avail: PubAvail } | null> {
  if (!/^[a-z0-9-]{1,120}$/.test(slug)) return null;
  // demoOwnerId = khách đang xem bản demo: thấy thêm các địa điểm (chưa mở bán) của chủ demo.
  const v = await prisma.ticketVenue.findFirst({ where: { slug, ...(demoOwnerId ? { OR: [{ ...PUBLIC_VENUE }, { ownerId: demoOwnerId }] } : PUBLIC_VENUE) }, include: pubInclude });
  if (!v) return null;
  // PERF-3: trang khách nạp lại 20 giây/lần ⇒ dọn đơn hết hạn tối đa 1 lần / RELEASE_EVERY_MS / địa điểm (mỗi tiến trình).
  // Đặt chỗ (createTicketOrder) vẫn dọn ngay trước khi đếm, nên ghế hết hạn không chặn người mua; chậm nhất ~30 giây hiện "trống".
  const last = lastRelease.get(v.id) ?? 0;
  if (Date.now() - last > RELEASE_EVERY_MS) {
    lastRelease.set(v.id, Date.now());
    if (lastRelease.size > 2000) lastRelease.clear();
    await releaseExpiredTicketHolds(v.id).catch(() => 0);
  }
  return { venue: pubVenue(v), avail: await pubAvail(v, normalizeConfig(v.config)) };
}

/** Thẻ danh sách /ve: mọi địa điểm đang mở bán + còn chỗ theo từng ngày trong 7 ngày tới. */
export async function publicVenueCards(demoOwnerId?: string): Promise<{ today: string; days: string[]; cards: PubCard[] }> {
  const vn = vnNow();
  const days = Array.from({ length: 7 }, (_, i) => addDaysKey(vn.today, i));
  // Trang /ve: chỉ địa điểm đã mở bán. Màn "Trang khách" của bản demo (demoOwnerId): chỉ các địa điểm của chủ demo.
  const rows = await prisma.ticketVenue.findMany({ where: demoOwnerId ? { ownerId: demoOwnerId } : PUBLIC_VENUE, include: pubInclude, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
  const cards = await Promise.all(
    rows.map(async (v): Promise<PubCard> => {
      const cfg = normalizeConfig(v.config);
      const a = await pubAvail(v, cfg);
      const kind = v.kind as VenueKind;
      const per: PubCard["days"] = {};
      // Khung giờ "chính" của nhà hàng để báo còn bàn: 19:00 nếu có, không thì khung giữa.
      const prime = cfg.slots.includes("19:00") ? "19:00" : cfg.slots[Math.floor(cfg.slots.length / 2)];
      for (const d of days) {
        if (kind === "GATE") per[d] = a.gate[d].paused ? { time: "", left: 0 } : { time: "", left: a.gate[d].left };
        else if (kind === "SHOW") {
          const s = a.shows.find((x) => x.date === d);
          per[d] = s ? { time: s.time, left: s.paused ? 0 : s.free } : null;
        } else {
          const time = slotPassed(d, prime, vn.today, vn.now) ? (cfg.slots.find((t) => !slotPassed(d, t, vn.today, vn.now)) ?? "") : prime;
          per[d] = time ? { time, left: v.tables.length - (a.rest[`${d}|${time}`]?.filter((id) => v.tables.some((t) => t.id === id)).length ?? 0) } : null;
        }
      }
      const prices = v.tiers.map((t) => num(t.price)).filter((p) => p > 0);
      return {
        slug: v.slug, kind, name: v.name, area: v.area ?? "", hours: cfg.hours, coverImage: v.coverImage, days: per,
        from: kind === "RESTAURANT" ? (cfg.policy === "deposit" ? cfg.amount : 0) : prices.length ? Math.min(...prices) : 0,
      };
    }),
  );
  return { today: vn.today, days, cards };
}

/** Khách bỏ chọn / quay lại bước chọn chỗ ⇒ nhả ghế / bàn đang giữ nháp. */
export async function releaseDraft(token: string): Promise<void> {
  const o = await prisma.ticketOrder.findUnique({ where: { token }, select: { id: true, status: true } });
  if (!o || o.status !== "draft") return;
  await prisma.$transaction(async (tx) => {
    await lockOrder(tx, o.id);
    // Kiểm lại sau khi khoá: đơn vừa được chốt ở giao dịch khác thì không nhả ghế của nó.
    const res = await tx.ticketOrder.updateMany({ where: { id: o.id, status: "draft" }, data: { status: "cancel", holdUntil: null } });
    if (res.count) await tx.ticketSeat.deleteMany({ where: { orderId: o.id } });
  });
}

/**
 * Chốt đơn nháp (khách đã giữ ghế / bàn ở bước 2) thành đơn thật: gắn liên hệ + món, tính lại tiền.
 * Đơn chờ WEB_CONFIRM_MIN phút: cần trả trước (vé show = cả đơn, nhà hàng = cọc) và có tài khoản ⇒ trang vé hiện VietQR;
 * còn lại ⇒ chờ địa điểm gọi xác nhận. Quá hạn chưa xác nhận / chưa thu ⇒ tự huỷ.
 */
export async function finalizeDraft(input: {
  token: string; slug: string; name: string; phone: string; email?: string | null; note?: string; guests?: number;
  food?: { menuId: string; qty: number; note?: string }[]; expectedTotal?: number; source?: string; ctvId?: string | null;
  /** Khách bản demo đặt thử trên địa điểm demo — bỏ điều kiện "đang mở bán" như createTicketOrder. */
  preview?: boolean;
}): Promise<{ id: string; code: string; token: string }> {
  const name = input.name.trim().slice(0, 80);
  if (name.length < 2) fail("Nhập họ tên.");
  if (!/^[\w-]{10,40}$/.test(input.token)) fail(`Hết ${DRAFT_HOLD_MIN} phút giữ chỗ nên ghế / bàn đã được nhả. Bạn chọn lại giúp mình nhé.`);
  // TK-9: suất tạm dừng / giờ đã qua / địa điểm vừa gỡ ⇒ nhả nháp (ghi trong giao dịch) rồi mới báo lỗi, không để đơn treo.
  let reject = "";
  const res = await prisma.$transaction(async (tx) => {
    const ref = await tx.ticketOrder.findUnique({ where: { token: input.token }, select: { id: true } });
    if (ref) await lockOrder(tx, ref.id);
    const o = await tx.ticketOrder.findUnique({ where: { token: input.token }, include: { seats: true, session: true, venue: { include: { menu: true, tables: { select: { id: true, name: true } } } } } });
    if (!o || o.venue.slug !== input.slug || o.status !== "draft" || !o.holdUntil || o.holdUntil.getTime() < Date.now())
      return fail(`Hết ${DRAFT_HOLD_MIN} phút giữ chỗ nên ghế / bàn đã được nhả. Bạn chọn lại giúp mình nhé.`);
    const kind = o.venue.kind as VenueKind;
    const cfg = normalizeConfig(o.venue.config);
    const vn = vnNow();
    reject =
      !isPublicVenue(o.venue) && !input.preview ? "Địa điểm này vừa ngừng bán — chỗ đã được nhả."
      : o.session.status === "paused" ? "Suất này vừa tạm dừng bán — chỗ đã được nhả, bạn chọn suất / giờ khác giúp mình nhé."
      : kind !== "GATE" && slotPassed(toDateKey(o.session.date), o.session.time, vn.today, vn.now) ? "Khung giờ này đã qua — chỗ đã được nhả, bạn chọn suất / giờ khác giúp mình nhé."
      : "";
    if (reject) {
      await tx.ticketSeat.deleteMany({ where: { orderId: o.id } });
      await tx.ticketOrder.update({ where: { id: o.id }, data: { status: "cancel", holdUntil: null } });
      return null;
    }
    if (kind === "RESTAURANT") {
      // Kiểm lại chồng giờ (quán có thể vừa tăng thời lượng giữ bàn sau lúc khách giữ nháp).
      await lockRestVenue(tx, o.venueId);
      const clash = await restConflicts(tx, o.venueId, toDateKey(o.session.date), o.session.time, o.seats.map((s) => s.key), cfg.mealMin, o.id);
      if (clash.length) fail(`Bàn ${o.venue.tables.find((t) => t.id === clash[0].tableId)?.name ?? ""} đã có khách đặt lúc ${clash[0].time} — quay lại chọn bàn hoặc giờ khác giúp mình nhé.`);
    }
    const food: { kind: string; refId: string; name: string; price: number; qty: number; note?: string }[] = [];
    for (const f of input.food ?? []) {
      const qty = Math.round(f.qty);
      if (!qty) continue;
      if (qty < 0 || qty > 200) fail("Số lượng món không hợp lệ.");
      const m = o.venue.menu.find((x) => x.id === f.menuId && x.active) ?? fail("Món không còn bán.");
      food.push({ kind: "food", refId: m.id, name: m.name, price: num(m.price), qty, note: (f.note ?? "").trim().slice(0, 120) || undefined });
    }
    const foodAmount = food.reduce((a, i) => a + i.price * i.qty, 0);
    const total = num(o.ticketAmount) + foodAmount;
    const deposit = num(o.deposit);
    if (kind === "RESTAURANT" && cfg.policy === "min" && foodAmount < cfg.amount * o.seats.length) fail(`Mỗi bàn cần đặt trước tối thiểu ${cfg.amount.toLocaleString("vi-VN")}đ tiền món.`);
    if (input.expectedTotal != null && Math.round(input.expectedTotal) !== (kind === "RESTAURANT" ? deposit + foodAmount : total)) fail("Giá vừa thay đổi — tải lại trang để xem giá mới.");
    await tx.ticketOrder.update({
      where: { id: o.id },
      data: {
        customerName: name,
        phone: normPhone(input.phone),
        email: input.email?.trim().slice(0, 120) || null,
        note: input.note?.trim().slice(0, 500) || null,
        ...(input.guests ? { guests: Math.min(500, Math.max(1, Math.round(input.guests))) } : {}),
        source: (input.source ?? "Web").slice(0, 30),
        ctvId: input.ctvId ?? null,
        status: "wait",
        foodAmount, total,
        // Chờ chuyển khoản hay chờ gọi xác nhận đều giữ chỗ WEB_CONFIRM_MIN phút kể từ lúc gửi; quá hạn ⇒ tự huỷ + nhả chỗ.
        holdUntil: new Date(Date.now() + WEB_CONFIRM_MIN * 60_000),
        items: { create: food },
      },
    });
    return { id: o.id, code: o.code, token: o.token };
  }, TX_OPTS);
  return res ?? fail(reject || "Không chốt được đơn, thử lại.");
}

// ----------------------------- Email vé -----------------------------
const escHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);

/**
 * Thư cho khách: "received" = đã nhận đơn (kèm link theo dõi / thanh toán), "confirmed" = vé đã sẵn sàng (link mở mã QR).
 * Không có email hoặc SMTP chưa cấu hình ⇒ bỏ qua êm. Không bao giờ ném lỗi ra luồng đặt.
 */
export async function sendTicketEmail(orderId: string, kind: "received" | "confirmed"): Promise<void> {
  try {
    const o = await prisma.ticketOrder.findUnique({ where: { id: orderId }, include: { session: true, venue: { select: { name: true, kind: true, config: true, published: true, review: true } }, tickets: { select: { id: true } } } });
    if (!o?.email || !/^\S+@\S+\.\S+$/.test(o.email)) return;
    // TK-4: địa điểm chưa mở bán (địa điểm demo, bản nháp chưa duyệt) không bao giờ gửi thư — chặn ngay tại đây để mọi
    // chỗ gọi (đặt web, xác nhận, ghi thu, phiên demo) đều an toàn: người lạ không mượn SMTP của site gửi tới email bất kỳ.
    if (!isPublicVenue(o.venue)) return;
    const { mailConfigured, sendMail } = await import("./mail");
    if (!(await mailConfigured())) return;
    const { SITE } = await import("./site");
    const url = `${SITE.url}/ve/don/${o.token}`;
    const when = sessionLabel(o.session.date, o.session.time);
    const rest = o.venue.kind === "RESTAURANT";
    const cfg = normalizeConfig(o.venue.config);
    // Cần chuyển khoản trước (vé show = cả đơn, nhà hàng = cọc) + địa điểm có tài khoản ⇒ trang đơn có VietQR.
    const prepay = o.venue.kind !== "GATE" && num(rest ? o.deposit : o.total) > num(o.paid) && !!cfg.bankBin && !!cfg.bankAcc;
    const until = o.holdUntil ? `${hhmm(o.holdUntil)} ${dmy(vnNow(o.holdUntil.getTime()).today)}` : "";
    const holdNote = until ? ` Chỗ được giữ đến ${until}; quá giờ mà đơn chưa được ${prepay ? "thanh toán" : "xác nhận"} thì đơn tự huỷ và nhả chỗ.` : "";
    const subject = kind === "confirmed" ? `${rest ? "Đã xác nhận bàn" : "Vé của bạn đã sẵn sàng"} · ${o.venue.name} · ${o.code}` : `Đã nhận ${rest ? "yêu cầu đặt bàn" : "đơn vé"} ${o.code} · ${o.venue.name}`;
    const lead =
      kind === "confirmed"
        ? rest ? "Quán đã xác nhận giữ bàn cho bạn." : `Đơn đã được xác nhận. Mở link bên dưới để lấy ${o.tickets.length} mã QR — mỗi người một mã, đưa cho nhân viên quét khi vào cổng.`
        : (prepay
            ? `Tụi mình đã giữ chỗ cho bạn. Mở link bên dưới để xem thông tin chuyển khoản; ${rest ? "bàn được xác nhận" : "vé QR hiện ngay tại đó"} khi nhận được tiền.`
            : `Tụi mình đã nhận yêu cầu và sẽ gọi lại xác nhận. ${rest ? "Trạng thái bàn" : "Vé QR"} hiện ở link bên dưới ngay khi đơn được xác nhận.`) + holdNote;
    const amount = `${num(rest ? o.deposit : o.total).toLocaleString("vi-VN")}đ`;
    const text = `Chào ${o.customerName},\n\n${lead}\n\n${o.venue.name}\n${when}\nMã đơn: ${o.code}\n${rest ? "Cọc bàn" : "Tổng tiền"}: ${amount}\n\n${url}\n\nTà Xùa Booking`;
    const html = `<div style="font-family:system-ui,Segoe UI,sans-serif;max-width:520px;margin:0 auto;color:#16241d">
<h2 style="margin:0 0 4px;font-size:20px">${escHtml(o.venue.name)}</h2>
<p style="margin:0 0 14px;color:#5b6660">${escHtml(when)} · Mã đơn <b style="font-family:monospace">${escHtml(o.code)}</b></p>
<p style="line-height:1.6">Chào ${escHtml(o.customerName)},<br>${escHtml(lead)}</p>
<p style="margin:6px 0 18px">${rest ? "Cọc bàn" : "Tổng tiền"}: <b style="color:#c2571a">${amount}</b></p>
<p><a href="${url}" style="display:inline-block;background:#1b583d;color:#fff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:999px">${kind === "confirmed" && !rest ? "Mở vé điện tử" : "Xem đơn của tôi"}</a></p>
<p style="color:#5b6660;font-size:13px;line-height:1.6">Hoặc dán link vào trình duyệt: ${url}</p>
<p style="color:#5b6660;font-size:13px">Tà Xùa Booking</p></div>`;
    await sendMail({ to: o.email, subject, html, text });
  } catch (e) {
    console.error("[ticket] gửi email lỗi", e);
  }
}
