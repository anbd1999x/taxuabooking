import "server-only";
import { randomBytes } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { parseDateOnly } from "./dates";
import { TicketError } from "./ticket";
import { bankName, normalizeConfig, vietQrPayload, vnNow } from "./ticket-core";
import { DINE_MAX_LINES, DINE_MAX_QTY, type DineCustomer, type DineData, type DineOrderVM, type DineReqVM, type DineStatus } from "./dine-core";

/**
 * Gọi món QR tại bàn — phía server. Khách quét QR dán ở bàn (/qr/<slug>/<bàn>?k=<qrKey>) rồi gọi món; quán nhận ở tab
 * "Gọi món QR" của /admin/provider/ve. Giá lấy theo thực đơn lúc gọi và chụp lại vào dòng đơn; không tin giá từ client.
 * Hoá đơn của bàn = mọi lần gọi (`DineOrder`) chưa `paid` / `cancel`; "Đã thu · dọn bàn" đóng tất cả cùng lúc.
 */
const fail = (m: string): never => {
  throw new TicketError(m);
};
const num = (d: Prisma.Decimal | number | null | undefined) => Number(d ?? 0);
const LIVE: DineStatus[] = ["new", "cooking", "served"];
const orderInc = { items: true } as const;
type OrderRow = Prisma.DineOrderGetPayload<{ include: typeof orderInc }>;

function orderVM(o: OrderRow): DineOrderVM {
  const items = o.items.map((i) => ({ name: i.name, price: num(i.price), qty: i.qty, note: i.note ?? "" }));
  return {
    id: o.id, tableId: o.tableId, table: o.tableName, status: o.status as DineStatus, note: o.note ?? "", source: o.source,
    at: o.createdAt.getTime(), servedAt: o.servedAt?.getTime() ?? null, items, total: items.reduce((a, i) => a + i.price * i.qty, 0),
  };
}
const reqVM = (r: { id: string; tableId: string | null; tableName: string; kind: string; method: string | null; createdAt: Date }): DineReqVM => ({
  id: r.id, tableId: r.tableId, table: r.tableName, kind: r.kind === "pay" ? "pay" : "staff", method: r.method ?? "", at: r.createdAt.getTime(),
});
/** Ảnh của món: danh sách images, món cũ chỉ có ảnh bìa thì lấy ảnh bìa. */
const menuImages = (m: { images: string[]; imageUrl: string | null }) => (m.images.length ? m.images : m.imageUrl ? [m.imageUrl] : []);
export const qrPath = (slug: string, table: string, key: string) => `/qr/${slug}/${encodeURIComponent(table.toLowerCase())}?k=${key}`;

// ----------------------------- Màn hình quán -----------------------------
export async function loadDine(venueId: string): Promise<DineData> {
  const v = await prisma.ticketVenue.findUniqueOrThrow({ where: { id: venueId }, select: { id: true, name: true, slug: true, config: true } });
  // Bàn chưa có khoá QR ⇒ cấp một lần.
  const noKey = await prisma.ticketTable.findMany({ where: { venueId, qrKey: null }, select: { id: true } });
  for (const t of noKey) await prisma.ticketTable.update({ where: { id: t.id }, data: { qrKey: randomBytes(4).toString("hex") } });
  const today = parseDateOnly(vnNow().today).getTime() - 7 * 3_600_000; // 00:00 giờ VN
  const [tables, menu, orders, reqs, sold, paid] = await Promise.all([
    // Bàn bị chuyển "ngừng dùng" (tab Thiết lập) khi còn món chưa thu vẫn phải hiện để còn thu tiền.
    prisma.ticketTable.findMany({ where: { venueId, OR: [{ active: true }, { dineOrders: { some: { status: { in: LIVE } } } }] }, orderBy: [{ floor: "asc" }, { sortOrder: "asc" }, { name: "asc" }] }),
    prisma.ticketMenuItem.findMany({ where: { venueId }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.dineOrder.findMany({ where: { venueId, status: { in: LIVE } }, include: orderInc, orderBy: { createdAt: "asc" } }),
    prisma.dineRequest.findMany({ where: { venueId, doneAt: null }, orderBy: { createdAt: "asc" } }),
    prisma.dineOrderItem.groupBy({ by: ["menuItemId"], _sum: { qty: true }, where: { order: { venueId, status: { not: "cancel" } } } }),
    prisma.dineOrder.findMany({ where: { venueId, status: "paid", paidAt: { gte: new Date(today) } }, select: { items: { select: { price: true, qty: true } } } }),
  ]);
  const cfg = normalizeConfig(v.config);
  const soldBy = new Map(sold.map((x) => [x.menuItemId, x._sum.qty ?? 0]));
  return {
    venue: { id: v.id, name: v.name, slug: v.slug, hasBank: !!(cfg.bankBin && cfg.bankAcc) },
    tables: tables.map((t) => ({ id: t.id, name: t.name, cap: t.capacity, zone: t.zone, floor: t.floor, url: qrPath(v.slug, t.name, t.qrKey ?? "") })),
    menu: menu.map((m) => ({ id: m.id, name: m.name, group: m.group ?? "", desc: m.description ?? "", price: num(m.price), hot: m.hot, avail: m.active, imageUrl: m.imageUrl, images: menuImages(m), sold: soldBy.get(m.id) ?? 0 })),
    orders: orders.map(orderVM),
    reqs: reqs.map(reqVM),
    revenueToday: paid.reduce((a, o) => a + o.items.reduce((b, i) => b + num(i.price) * i.qty, 0), 0),
    now: Date.now(),
  };
}

/** Đơn mới → Bếp đang làm → Đã lên món. */
export async function advanceDineOrder(venueId: string, orderId: string): Promise<void> {
  const o = (await prisma.dineOrder.findFirst({ where: { id: orderId, venueId } })) ?? fail("Đơn không tồn tại.");
  const next = o.status === "new" ? { status: "cooking", cookingAt: new Date() } : o.status === "cooking" ? { status: "served", servedAt: new Date() } : null;
  if (!next) return;
  // Điều kiện status trong where: hai người cùng bấm thì chỉ một lần chuyển.
  await prisma.dineOrder.updateMany({ where: { id: o.id, status: o.status }, data: next });
}

/** Huỷ một lần gọi chưa lên món (khách gọi nhầm / hết nguyên liệu). */
export async function cancelDineOrder(venueId: string, orderId: string): Promise<void> {
  const r = await prisma.dineOrder.updateMany({ where: { id: orderId, venueId, status: { in: ["new", "cooking"] } }, data: { status: "cancel" } });
  if (!r.count) fail("Đơn đã lên món hoặc đã thu tiền — không huỷ được.");
}

export async function closeDineRequest(venueId: string, id: string): Promise<void> {
  await prisma.dineRequest.updateMany({ where: { id, venueId, doneAt: null }, data: { doneAt: new Date() } });
}

/**
 * "Đã thu · dọn bàn": đóng mọi lần gọi đang mở của bàn + mọi yêu cầu của bàn. Trả tổng tiền đã thu.
 * `expectIds` = các lần gọi nhân viên ĐANG THẤY trên hoá đơn: bàn vừa gọi thêm / có lần bị huỷ trong lúc đó ⇒ từ chối,
 * để lần gọi mới không bị đóng "đã thu" (biến khỏi cột bếp) trong khi tiền chưa thu.
 */
export async function payDineTable(venueId: string, tableId: string, method: string, by: string, expectIds?: string[]): Promise<number> {
  return prisma.$transaction(async (tx) => {
    const orders = await tx.dineOrder.findMany({ where: { venueId, tableId, status: { in: LIVE } }, include: orderInc });
    if (!orders.length) return fail("Bàn không có món nào cần thu.");
    if (expectIds && (orders.length !== new Set(expectIds).size || orders.some((o) => !expectIds.includes(o.id))))
      return fail("Hoá đơn bàn vừa thay đổi (khách gọi thêm / có lần gọi bị huỷ) — xem lại tổng rồi bấm thu lại.");
    const now = new Date();
    await tx.dineOrder.updateMany({ where: { id: { in: orders.map((o) => o.id) }, status: { in: LIVE } }, data: { status: "paid", paidAt: now, payMethod: method, paidBy: by } });
    await tx.dineRequest.updateMany({ where: { venueId, tableId, doneAt: null }, data: { doneAt: now } });
    return orders.reduce((a, o) => a + orderVM(o).total, 0);
  });
}

/** Thêm nhanh một bàn ở tab "Bàn & mã QR": tên tự đánh số theo khu (B1, B2… / BC1…). */
export async function addDineTable(venueId: string, zone: string): Promise<string> {
  const z = zone.trim().slice(0, 40) || "Trong nhà";
  const all = await prisma.ticketTable.findMany({ where: { venueId }, select: { name: true, zone: true, floor: true } });
  const same = all.filter((t) => t.zone === z);
  // Tiền tố: lấy từ bàn cùng khu (phần chữ của tên), chưa có thì ghép chữ cái đầu của tên khu.
  const prefix = same.map((t) => /^[^\d]+/.exec(t.name)?.[0]).find(Boolean) ?? (z.normalize("NFD").replace(/[̀-ͯ]/g, "").split(/\s+/).map((w) => w[0]).join("").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2) || "B");
  let n = same.length + 1;
  while (all.some((t) => t.name.toLowerCase() === `${prefix}${n}`.toLowerCase())) n++;
  const name = `${prefix}${n}`.slice(0, 12);
  await prisma.ticketTable.create({ data: { venueId, name, zone: z, floor: same[0]?.floor ?? 0, capacity: 4, qrKey: randomBytes(4).toString("hex") } });
  return name;
}

/**
 * "Đổi mã QR" một bàn: cấp khoá mới ⇒ thẻ QR đã in (và điện thoại đang mở trang bàn bằng khoá cũ) hết dùng ngay
 * (`tableForQr` so khoá trực tiếp trong DB). Trả đường dẫn QR mới để in lại thẻ.
 */
export async function rotateDineQr(venueId: string, tableId: string): Promise<{ name: string; url: string }> {
  const t = (await prisma.ticketTable.findFirst({ where: { id: tableId, venueId }, include: { venue: { select: { slug: true } } } })) ?? fail("Bàn không tồn tại.");
  let key = randomBytes(4).toString("hex");
  while (key === t.qrKey) key = randomBytes(4).toString("hex");
  await prisma.ticketTable.update({ where: { id: t.id }, data: { qrKey: key } });
  return { name: t.name, url: qrPath(t.venue.slug, t.name, key) };
}

// ----------------------------- Điện thoại khách -----------------------------
/** Bàn ứng với mã QR. Sai khoá / bàn ngừng dùng ⇒ null (không tiết lộ lý do). */
export async function tableForQr(slug: string, table: string, key: string) {
  if (!/^[a-z0-9-]{1,120}$/.test(slug) || !/^[0-9a-f]{6,16}$/.test(key) || table.length > 20) return null;
  const v = await prisma.ticketVenue.findFirst({ where: { slug, kind: "RESTAURANT" }, select: { id: true, name: true, config: true, tables: { where: { active: true, qrKey: key } } } });
  const t = v?.tables.find((x) => x.name.toLowerCase() === table.toLowerCase());
  return v && t ? { venueId: v.id, venueName: v.name, config: v.config, table: t } : null;
}
type QrTable = NonNullable<Awaited<ReturnType<typeof tableForQr>>>;

/**
 * `tableForQr` có chống dò khoá (8 ký tự hex) — dùng ở MỌI cửa vào công khai (trang /qr, GET/POST /api/qr): mỗi IP chỉ
 * được thử 20 bộ (quán, bàn, khoá) SAI KHÁC NHAU / 10 phút, quá thì chặn cả lần đúng trong cửa sổ đó. Đếm theo bộ khác
 * nhau (không theo lượt) để một điện thoại còn mở trang của bàn vừa bị xoá / đổi tên — nạp lại 5 giây một lần — không
 * làm cả wifi quán (chung IP) bị chặn. Bộ nhớ trong tiến trình, như `rate-limit.ts`.
 */
const BAD_MAX = 20, BAD_WIN = 10 * 60_000;
const badHits = new Map<string, Map<string, number>>();
export async function tableForQrGuarded(ip: string, slug: string, table: string, key: string): Promise<QrTable | null> {
  const now = Date.now();
  const m = badHits.get(ip);
  if (m) {
    for (const [k, t] of m) if (now - t >= BAD_WIN) m.delete(k);
    if (!m.size) badHits.delete(ip);
    else if (m.size >= BAD_MAX) return null;
  }
  const q = await tableForQr(slug, table, key);
  if (!q) {
    const mm = badHits.get(ip) ?? new Map<string, number>();
    const combo = `${slug}|${table.toLowerCase()}|${key}`.slice(0, 200);
    if (!mm.has(combo)) mm.set(combo, now);
    badHits.set(ip, mm);
    if (badHits.size > 10_000) for (const [k, v] of badHits) if ([...v.values()].every((t) => now - t >= BAD_WIN)) badHits.delete(k);
  }
  return q;
}

export async function dineCustomerState(q: QrTable): Promise<DineCustomer> {
  const [menu, orders, reqs, lastPaid] = await Promise.all([
    prisma.ticketMenuItem.findMany({ where: { venueId: q.venueId }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.dineOrder.findMany({ where: { tableId: q.table.id, status: { in: LIVE } }, include: orderInc, orderBy: { createdAt: "asc" } }),
    prisma.dineRequest.findMany({ where: { tableId: q.table.id, doneAt: null } }),
    prisma.dineOrder.findFirst({ where: { tableId: q.table.id, status: "paid", paidAt: { gte: new Date(Date.now() - 30 * 60_000) } }, select: { id: true } }),
  ]);
  const vms = orders.map(orderVM);
  const bill = vms.reduce((a, o) => a + o.total, 0);
  const cfg = normalizeConfig(q.config);
  // Nội dung CK hiện cho khách phải khớp chuỗi trong mã VietQR (vietQrPayload bỏ ký tự ngoài A-Z0-9) ⇒ bỏ dấu trước.
  const memo = `BAN ${q.table.name}`.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[đĐ]/g, "D").toUpperCase().replace(/[^A-Z0-9 -]/g, "").slice(0, 25);
  return {
    venue: q.venueName,
    table: q.table.name,
    menu: menu.map((m) => ({ id: m.id, name: m.name, group: m.group ?? "", desc: m.description ?? "", price: num(m.price), hot: m.hot, avail: m.active, imageUrl: m.imageUrl, images: menuImages(m) })),
    orders: vms,
    bill,
    payReq: reqs.find((r) => r.kind === "pay")?.method ?? null,
    staffAsked: reqs.some((r) => r.kind === "staff"),
    paid: !vms.length && !!lastPaid,
    bank: cfg.bankBin && cfg.bankAcc && bill > 0 ? { name: bankName(cfg.bankBin), account: cfg.bankAcc, holder: cfg.bankHolder, memo, qr: vietQrPayload({ bin: cfg.bankBin, account: cfg.bankAcc, amount: bill, memo }) } : null,
    now: Date.now(),
  };
}

/** Một lần gọi món của bàn. Món đang "Hết món" hoặc không còn trong thực đơn ⇒ từ chối cả lần gọi. */
export async function createDineOrder(input: { venueId: string; tableId: string; items: { menuId: string; qty: number; note?: string }[]; note?: string; source?: string }): Promise<{ id: string; qty: number }> {
  const t = (await prisma.ticketTable.findFirst({ where: { id: input.tableId, venueId: input.venueId, active: true } })) ?? fail("Bàn không hợp lệ.");
  const lines = input.items.filter((i) => Math.round(i.qty) > 0);
  if (!lines.length) fail("Chưa chọn món nào.");
  if (lines.length > DINE_MAX_LINES) fail(`Mỗi lần gọi tối đa ${DINE_MAX_LINES} món khác nhau.`);
  const menu = await prisma.ticketMenuItem.findMany({ where: { venueId: input.venueId, id: { in: lines.map((l) => l.menuId) } } });
  // Cùng một món tách thành nhiều dòng cũng không được vượt giới hạn phần mỗi lần gọi.
  const per = new Map<string, number>();
  for (const l of lines) per.set(l.menuId, (per.get(l.menuId) ?? 0) + Math.round(l.qty));
  const items = lines.map((l) => {
    const m = menu.find((x) => x.id === l.menuId) ?? fail("Có món không còn trong thực đơn — tải lại thực đơn.");
    if (!m.active) fail(`${m.name} vừa hết món — bỏ món này rồi gửi lại.`);
    const qty = Math.round(l.qty);
    if ((per.get(m.id) ?? 0) > DINE_MAX_QTY) fail(`${m.name}: tối đa ${DINE_MAX_QTY} phần mỗi lần gọi.`);
    return { menuItemId: m.id, name: m.name, price: m.price, qty, note: (l.note ?? "").trim().slice(0, 120) || null };
  });
  const o = await prisma.dineOrder.create({
    data: { venueId: input.venueId, tableId: t.id, tableName: t.name, note: input.note?.trim().slice(0, 300) || null, source: (input.source ?? "QR").slice(0, 20), items: { create: items } },
  });
  return { id: o.id, qty: items.reduce((a, i) => a + i.qty, 0) };
}

/** Gọi nhân viên / xin thanh toán. Đang có yêu cầu cùng loại chưa xử lý ⇒ cập nhật (không tạo trùng). */
export async function createDineRequest(input: { venueId: string; tableId: string; kind: "staff" | "pay"; method?: string }): Promise<void> {
  const t = (await prisma.ticketTable.findFirst({ where: { id: input.tableId, venueId: input.venueId, active: true } })) ?? fail("Bàn không hợp lệ.");
  if (input.kind === "pay" && !(await prisma.dineOrder.count({ where: { tableId: t.id, status: { in: LIVE } } }))) fail("Bàn chưa gọi món nào.");
  const method = input.kind === "pay" ? (input.method === "Chuyển khoản" ? "Chuyển khoản" : "Tiền mặt") : null;
  const open = await prisma.dineRequest.findFirst({ where: { tableId: t.id, kind: input.kind, doneAt: null } });
  if (open) await prisma.dineRequest.update({ where: { id: open.id }, data: { method } });
  else await prisma.dineRequest.create({ data: { venueId: input.venueId, tableId: t.id, tableName: t.name, kind: input.kind, method } });
}
