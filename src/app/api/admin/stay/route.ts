import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getSession, hashPassword } from "@/lib/auth";
import { getDemoSession } from "@/lib/fleet-demo";
import { prisma } from "@/lib/prisma";
import { parseDateOnly, toDateKey } from "@/lib/dates";
import { dmy } from "@/lib/date-format";
import { assignRoomsForBooking, RoomConflictError } from "@/lib/inventory";
import {
  STAFF_AREA,
  StayError,
  assertRoomsFree,
  holKeysFor,
  canManageHome,
  closeTag,
  createWithCode,
  forViewer,
  holdPendingCellsTx,
  homeRooms,
  loadHome,
  loadHomeConfig,
  lockHome,
  pushStayPayments,
  releaseStayCells,
  resyncCells,
  saveHomeConfig,
  setStayCellStatus,
  stayVM,
  syncStaysForBooking,
  writeStayCells,
} from "@/lib/stay";
import {
  CLOSE_REASONS,
  EXP_CATS,
  HK_KEYS,
  PAY_METHODS,
  STAY_SOURCES,
  addDaysKey,
  billOf,
  cancelMoney,
  diffDays,
  hh,
  isLive,
  nightPrice,
  normPhone,
  paidOf,
  quoteStay,
  splitTotal,
  stayPrice,
  stayStatus,
  vnNow,
  type HomeConfig,
  type StayFee,
} from "@/lib/stay-core";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const PHONE_RE = /^0\d{9}$/;
const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });
const str = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const int = (v: unknown) => {
  const n = parseInt(String(v ?? "").replace(/\D/g, ""), 10);
  return Number.isFinite(n) ? n : 0;
};
const vnd = (n: number) => Math.round(n).toLocaleString("vi-VN") + "đ";
const dm = (k: string) => dmy(k);
/** Giờ VN "HH:MM" của hôm nay ⇒ Date (UTC). */
const vnTimeToday = (today: string, t: string) => new Date(Date.parse(`${today}T${t}:00+07:00`));

/**
 * Quản lý phòng (chủ homestay / lễ tân / admin) — theo mẫu "Admin Quan ly Phong".
 * Mọi thao tác trả lại toàn bộ dữ liệu để giao diện thay state một lần.
 * op: createStay | addPay | move | extend | edit | cancel | noShow | checkIn | checkOut | charge | close | reopen |
 *     webConfirm | webReject | setHk | svcLog | expense | flag | saveCfg | staffCreate | staffToggle | staffReset | staffDelete
 */
export async function POST(request: Request) {
  let session = await getSession();
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return bad("Thiếu dữ liệu.");
  }
  const serviceId = str(body.serviceId, 40);
  let svc = await canManageHome(session, serviceId);
  // Bản demo (/demo/quan-ly-phong): phiên demo nằm ở cookie riêng.
  if (!svc) {
    const demo = await getDemoSession();
    if (demo) {
      session = demo;
      svc = await canManageHome(demo, serviceId);
    }
  }
  if (!svc || !session) return bad("Không có quyền.", 403);
  const op = str(body.op, 30);
  // Bản demo: thử mọi thao tác, trừ tạo / sửa tài khoản đăng nhập thật.
  if (session.role === "DEMO" && op.startsWith("staff")) return bad("Bản demo không tạo / sửa tài khoản lễ tân được.", 403);
  // Lễ tân / buồng phòng: đặt phòng, thu tiền, nhận/trả phòng, dọn phòng, xác nhận đơn web. Không sửa cấu hình, chi phí.
  const STAFF_OPS = ["createStay", "addPay", "move", "extend", "edit", "noShow", "checkIn", "checkOut", "charge", "webConfirm", "webReject", "setHk", "svcLog"];
  if (session.role === "STAFF" && !STAFF_OPS.includes(op)) return bad("Tài khoản lễ tân không có quyền thao tác này.", 403);
  const who = session.name || session.username;
  const { today: T, now: NOW } = vnNow();
  const done = async (message: string, extra: Record<string, unknown> = {}) => NextResponse.json({ ...forViewer(await loadHome(serviceId), session!.role), message, ...extra });

  const { rooms } = await homeRooms(serviceId);
  const roomById = new Map(rooms.map((r) => [r.id, r]));
  const cfg = await loadHomeConfig(serviceId);
  const extraFee = Number(svc.extraPersonFee ?? 0);

  /** Lượt ở của homestay này (kèm sổ thu + thông tin đơn sàn). */
  const ownStay = async (id: string) => {
    const r = id ? await prisma.roomStay.findFirst({ where: { id, serviceId }, include: { payments: true } }) : null;
    if (!r) return null;
    const meta = r.bookingId
      ? await prisma.bookingRequest.findUnique({ where: { id: r.bookingId }, select: { code: true, category: true, collector: true, paymentStatus: true } })
      : null;
    return { row: r, vm: stayVM(r, meta) };
  };
  /** Các lượt cùng đoàn (để chia tiền đã thu theo tỉ lệ). */
  const groupOf = async (groupId: string | null, selfId: string) => {
    if (!groupId) return [];
    const rows = await prisma.roomStay.findMany({ where: { serviceId, groupId, NOT: { id: selfId } }, include: { payments: true } });
    // Kèm thông tin đơn sàn (combo / payBlock) như loadHome — thiếu thì phòng combo bị tính cả tiền phòng ⇒ quyết toán sai (hoàn nhầm).
    const bIds = [...new Set(rows.map((r) => r.bookingId).filter((x): x is string => !!x))];
    const metas = new Map(
      (bIds.length ? await prisma.bookingRequest.findMany({ where: { id: { in: bIds } }, select: { id: true, code: true, category: true, collector: true, paymentStatus: true } }) : []).map((b) => [b.id, b]),
    );
    return rows.map((r) => stayVM(r, r.bookingId ? metas.get(r.bookingId) : null));
  };

  try {
    switch (op) {
      // ===================== ĐẶT PHÒNG TẠO TAY =====================
      case "createStay": {
        const name = str(body.name, 80);
        const phone = normPhone(str(body.phone, 20));
        const ci = str(body.ci, 10);
        const co = str(body.co, 10);
        const guests = Math.max(1, Math.min(200, int(body.guests) || 1));
        const src = (STAY_SOURCES as readonly string[]).includes(str(body.src, 20)) ? str(body.src, 20) : "Gọi điện";
        const ids = Array.isArray(body.rooms) ? [...new Set((body.rooms as unknown[]).map((x) => str(x, 40)))] : [];
        const picked = ids.map((id) => roomById.get(id)).filter((r): r is NonNullable<typeof r> => !!r);
        if (name.length < 2) return bad("Nhập tên khách.");
        if (!PHONE_RE.test(phone)) return bad("Số điện thoại 10 số.");
        if (!DATE_RE.test(ci) || !DATE_RE.test(co) || co <= ci) return bad("Ngày trả phải sau ngày nhận.");
        if (ci < addDaysKey(T, -1)) return bad("Không đặt được cho ngày đã qua.");
        if (diffDays(ci, co) > 60) return bad("Tối đa 60 đêm một lần đặt.");
        if (!picked.length || picked.length !== ids.length) return bad("Chọn ít nhất 1 phòng.");
        // Giá tính lại ở server theo lịch lễ chung + giá phòng (cùng quy tắc trang khách); chỉ tin "Sửa tổng tiền" khi chủ nhập tay.
        const hk = await holKeysFor(ci, co);
        const q = quoteStay(picked, ci, co, guests, hk, extraFee);
        const override = int(body.override);
        const total = override > 0 ? override : q.total;
        const dep = int(body.dep);
        if (dep > total) return bad("Tiền cọc lớn hơn tổng tiền.");
        const method = (PAY_METHODS as readonly string[]).includes(str(body.method, 20)) ? str(body.method, 20) : "Chuyển khoản";
        const shares = splitTotal(total, picked.map((r) => stayPrice(r, ci, co, hk)));
        const groupId = picked.length > 1 ? `g:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}` : null;
        const groupName = picked.length > 1 ? `Đoàn ${name.split(/\s+/).pop()}` : null;
        const holdUntil = dep > 0 ? null : new Date(Date.now() + cfg.hold * 3_600_000);
        const note = str(body.note, 300) || null;
        await prisma.$transaction(async (tx) => {
          await lockHome(tx, serviceId);
          await assertRoomsFree(tx, picked, ci, co);
          for (const [i, r] of picked.entries()) {
            const s = await createWithCode(tx, {
              serviceId, roomId: r.id, groupId, groupName, customerName: name, phone,
              guests: Math.max(1, Math.ceil(guests / picked.length)), checkIn: parseDateOnly(ci), checkOut: parseDateOnly(co),
              total: shares[i], source: src, note, holdUntil, createdBy: who,
            });
            if (i === 0 && dep > 0) await tx.stayPayment.create({ data: { stayId: s.id, amount: dep, method, kind: "Cọc", by: who } });
            await writeStayCells(tx, { id: s.id, roomId: r.id, ci, co }, dep > 0 ? "BOOKED" : "PENDING");
          }
        }, { timeout: 20_000 });
        return done(`Đã đặt ${picked.map((r) => r.name).join(", ")} · ${dm(ci)} → ${dm(co)} · web đã báo hết phòng`);
      }

      // ===================== TIỀN =====================
      case "addPay": {
        const s = await ownStay(str(body.id, 40));
        if (!s) return bad("Không tìm thấy lượt ở.");
        if (!isLive(s.row) || s.row.checkedOutAt) return bad("Lượt ở đã kết thúc.");
        if (s.vm.payBlock) return bad(s.vm.payBlock);
        const kind = ["Cọc", "Thu", "Hoàn"].includes(str(body.kind, 10)) ? str(body.kind, 10) : "Thu";
        const method = (PAY_METHODS as readonly string[]).includes(str(body.method, 20)) ? str(body.method, 20) : "Tiền mặt";
        let amt = int(body.amt);
        if (!amt) return bad("Nhập số tiền.");
        if (kind === "Hoàn") amt = -amt;
        await prisma.$transaction(async (tx) => {
          await lockHome(tx, serviceId);
          // Đọc lại sau khi khoá: giữ chỗ có thể vừa bị tự nhả / lượt ở vừa trả phòng ở yêu cầu khác.
          const cur = await tx.roomStay.findUnique({ where: { id: s.row.id }, select: { state: true, checkedOutAt: true } });
          if (!cur || !isLive(cur) || cur.checkedOutAt) throw new StayError("Lượt ở đã kết thúc hoặc vừa bị nhả — tải lại trang.");
          await tx.stayPayment.create({ data: { stayId: s.row.id, amount: amt, method, kind, by: who } });
          if (!s.row.bookingId) {
            // Có cọc ⇒ bỏ hạn tự nhả, ô lịch thành "Đã đặt" (cả đoàn).
            const ids = s.row.groupId ? (await tx.roomStay.findMany({ where: { serviceId, groupId: s.row.groupId }, select: { id: true } })).map((x) => x.id) : [s.row.id];
            if (amt > 0) {
              await tx.roomStay.updateMany({ where: { id: { in: ids } }, data: { holdUntil: null } });
              await setStayCellStatus(tx, ids, "BOOKED");
            }
          } else {
            await pushStayPayments(tx, s.row.bookingId, who, `Chủ nhà ghi ${kind.toLowerCase()} ${vnd(Math.abs(amt))} (${method})`);
          }
        });
        return done(`Đã ghi ${kind === "Thu" ? "thu" : kind.toLowerCase()} ${vnd(Math.abs(amt))}`);
      }

      // ===================== ĐỔI PHÒNG / GIA HẠN / HUỶ =====================
      case "move": {
        const s = await ownStay(str(body.id, 40));
        const to = roomById.get(str(body.to, 40));
        if (!s || !to) return bad("Chọn phòng muốn đổi.");
        if (!isLive(s.row) || s.row.checkedOutAt) return bad("Lượt ở đã kết thúc.");
        if (to.id === s.row.roomId) return bad("Khách đang ở phòng này.");
        const ci = toDateKey(s.row.checkIn), co = toDateKey(s.row.checkOut);
        const fromName = roomById.get(s.row.roomId)?.name ?? "";
        await prisma.$transaction(async (tx) => {
          await lockHome(tx, serviceId);
          if (s.row.bookingId) {
            // Đơn của sàn: đổi phòng ngay trên đơn để ô lịch do đơn giữ chuyển theo.
            const b = await tx.bookingRequest.findUnique({ where: { id: s.row.bookingId } });
            if (!b) throw new StayError("Không tìm thấy đơn.");
            // Giá & hạng trên đơn sàn giữ nguyên ⇒ chỉ đổi sang phòng cùng hạng.
            if (roomById.get(s.row.roomId)?.typeId !== to.typeId) throw new StayError("Đơn của sàn chỉ đổi sang phòng cùng hạng.");
            await assertRoomsFree(tx, [to], ci, co, { bookingId: b.id });
            const list = (b.roomIds.length ? b.roomIds : b.roomId ? [b.roomId] : []).map((id) => (id === s.row.roomId ? to.id : id));
            const holdsPlatform = b.status === "CONFIRMED" || b.status === "COMPLETED";
            if (holdsPlatform) await assignRoomsForBooking(tx, b, false);
            else await tx.roomDayStatus.deleteMany({ where: { bookingId: b.id, roomId: s.row.roomId } });
            const nb = await tx.bookingRequest.update({ where: { id: b.id }, data: { roomIds: list, roomId: list[0] ?? null } });
            if (holdsPlatform) await assignRoomsForBooking(tx, nb, true);
            await tx.roomStay.update({ where: { id: s.row.id }, data: { roomId: to.id } });
            await tx.bookingLog.create({ data: { bookingId: b.id, kind: "SUPPLIER", title: `Chủ nhà đổi phòng ${fromName} → ${to.name}`, by: who } });
            const nights: string[] = [];
            for (let d = ci; d < co; d = addDaysKey(d, 1)) nights.push(d);
            if (!holdsPlatform) await holdPendingCellsTx(tx, b.id, list.filter((id) => roomById.has(id)), [...roomById.keys()]);
            await resyncCells(tx, [s.row.roomId, to.id], nights);
          } else {
            await assertRoomsFree(tx, [to], ci, co, { stayId: s.row.id });
            const status = (await tx.roomDayStatus.findFirst({ where: { stayId: s.row.id }, select: { status: true } }))?.status === "BOOKED" ? "BOOKED" : "PENDING";
            await releaseStayCells(tx, s.row.id);
            await tx.roomStay.update({ where: { id: s.row.id }, data: { roomId: to.id } });
            await writeStayCells(tx, { id: s.row.id, roomId: to.id, ci, co }, status);
          }
        }, { timeout: 20_000 });
        if (s.row.bookingId) await syncStaysForBooking(s.row.bookingId).catch(() => {});
        return done(`Đã đổi ${fromName} → ${to.name}`);
      }
      case "extend": {
        const s = await ownStay(str(body.id, 40));
        if (!s) return bad("Không tìm thấy lượt ở.");
        if (s.row.bookingId) return bad("Đơn của sàn — báo sàn để gia hạn (đổi ngày trên đơn).");
        if (!isLive(s.row) || s.row.checkedOutAt) return bad("Lượt ở đã kết thúc.");
        const room = roomById.get(s.row.roomId)!;
        const co = toDateKey(s.row.checkOut), nco = addDaysKey(co, 1);
        const addPrice = nightPrice(room, co, await holKeysFor(co, nco));
        await prisma.$transaction(async (tx) => {
          await lockHome(tx, serviceId);
          await assertRoomsFree(tx, [room], co, nco, { stayId: s.row.id });
          const status = (await tx.roomDayStatus.findFirst({ where: { stayId: s.row.id }, select: { status: true } }))?.status === "PENDING" ? "PENDING" : "BOOKED";
          await tx.roomStay.update({ where: { id: s.row.id }, data: { checkOut: parseDateOnly(nco), total: { increment: addPrice } } });
          await writeStayCells(tx, { id: s.row.id, roomId: room.id, ci: co, co: nco }, status);
        });
        return done(`Đã gia hạn tới ${dm(nco)}`);
      }
      case "cancel":
      case "noShow": {
        const s = await ownStay(str(body.id, 40));
        if (!s) return bad("Không tìm thấy lượt ở.");
        if (s.row.bookingId) return bad("Đơn của sàn — báo sàn để huỷ / ghi khách không đến.");
        if (!isLive(s.row) || s.row.checkedInAt) return bad(s.row.checkedInAt ? "Khách đã nhận phòng." : "Lượt ở đã kết thúc.");
        // "Không đến" chỉ từ ngày nhận phòng — trước đó là huỷ (lễ tân không có quyền huỷ, không được lách qua noShow).
        if (op === "noShow" && toDateKey(s.row.checkIn) > T) return bad(`Chưa tới ngày nhận phòng (${dm(toDateKey(s.row.checkIn))}) — muốn bỏ lượt này thì dùng Huỷ.`);
        // Đã thu tiền ⇒ bắt buộc chọn Hoàn cọc / Giữ cọc (giao diện hỏi trước khi gửi).
        const decision = ["refund", "keep"].includes(str(body.refund, 10)) ? (str(body.refund, 10) as "refund" | "keep") : null;
        const method = (PAY_METHODS as readonly string[]).includes(str(body.method, 20)) ? str(body.method, 20) : "Tiền mặt";
        const label = op === "cancel" ? "huỷ" : "không đến";
        let money = 0;
        await prisma.$transaction(async (tx) => {
          await lockHome(tx, serviceId);
          // Tính tiền SAU khi khoá (đọc lại cả đoàn): huỷ phòng cuối của đoàn mới hỏi hoàn / giữ tiền cả đoàn.
          const members = await tx.roomStay.findMany({
            where: s.row.groupId ? { serviceId, groupId: s.row.groupId } : { id: s.row.id },
            include: { payments: { select: { amount: true, method: true } } },
          });
          money = cancelMoney(s.row.id, members.map((m) => ({ id: m.id, state: m.state, pays: m.payments.map((p) => ({ amt: Number(p.amount), method: p.method })) })));
          if (money > 0 && !decision) throw new StayError(`Lượt ở đã thu ${vnd(money)} — chọn Hoàn cọc hoặc Giữ cọc.`);
          const note = money > 0 && decision === "keep" ? [s.row.note, `Giữ cọc khi ${label}: ${vnd(money)}`].filter(Boolean).join(" · ") : undefined;
          const n = await tx.roomStay.updateMany({
            where: { id: s.row.id, state: null, checkedInAt: null },
            data: { state: op === "cancel" ? "cancel" : "noshow", holdUntil: null, ...(note !== undefined ? { note } : {}) },
          });
          if (!n.count) throw new StayError("Lượt ở vừa thay đổi — tải lại trang.");
          if (money > 0 && decision === "refund") {
            await tx.stayPayment.create({ data: { stayId: s.row.id, amount: -money, method, kind: `Hoàn cọc khi ${label}`, by: who } });
            if (s.row.bookingId) await pushStayPayments(tx, s.row.bookingId, who, `Chủ nhà hoàn cọc ${vnd(money)} khi ${label} (${method})`);
          }
          await releaseStayCells(tx, s.row.id);
        });
        const tail = money > 0 ? (decision === "refund" ? ` · đã ghi hoàn ${vnd(money)}` : ` · giữ cọc ${vnd(money)}`) : "";
        return done((op === "cancel" ? "Đã huỷ, các đêm đã được nhả" : "Đã ghi khách không đến, phòng được nhả") + tail);
      }

      // ===================== SỬA LƯỢT Ở =====================
      case "edit": {
        const s = await ownStay(str(body.id, 40));
        if (!s) return bad("Không tìm thấy lượt ở.");
        if (!isLive(s.row)) return bad("Lượt ở đã huỷ / không đến — không sửa được.");
        if (s.row.checkedOutAt) return bad("Lượt ở đã trả phòng — không sửa được.");
        const room = roomById.get(s.row.roomId);
        if (!room) return bad("Không tìm thấy phòng.");
        const curCi = toDateKey(s.row.checkIn), curCo = toDateKey(s.row.checkOut);
        const has = (k: string) => body[k] !== undefined && body[k] !== null && body[k] !== "";
        const phone = has("phone") ? normPhone(str(body.phone, 20)) : s.row.phone;
        if (!PHONE_RE.test(phone)) return bad("Số điện thoại 10 số.");
        const note = has("note") || body.note === "" ? str(body.note, 300) || null : s.row.note;
        // CCCD khách chính = khách đầu trong danh sách lưu trú.
        const gl = s.vm.guestList.slice();
        if (body.cccd !== undefined) {
          const cccd = str(body.cccd, 20).replace(/\D/g, "");
          if (cccd && cccd.length !== 12) return bad("Số CCCD gồm 12 chữ số.");
          if (gl.length) gl[0] = { ...gl[0], cccd };
          else if (cccd) gl.push({ name: s.row.customerName, cccd });
        }
        const ci = has("ci") ? str(body.ci, 10) : curCi;
        const co = has("co") ? str(body.co, 10) : curCo;
        if (!DATE_RE.test(ci) || !DATE_RE.test(co)) return bad("Ngày không hợp lệ.");

        if (s.row.bookingId) {
          // Đơn của sàn: ngày / giá / khách / nguồn do sàn quyết — chủ nhà chỉ sửa SĐT, CCCD, ghi chú.
          if (ci !== curCi || co !== curCo) return bad("Đơn của sàn — báo sàn để đổi ngày.");
          if (has("total") && int(body.total) !== Number(s.row.total)) return bad("Đơn của sàn — giá do sàn quyết, không sửa ở đây.");
          if (has("name") && str(body.name, 80) !== s.row.customerName) return bad("Đơn của sàn — tên khách theo đơn, báo sàn nếu cần đổi.");
          if (has("guests") && int(body.guests) !== s.row.guests) return bad("Đơn của sàn — số khách theo đơn, báo sàn nếu cần đổi.");
          await prisma.$transaction(async (tx) => {
            await lockHome(tx, serviceId);
            await tx.roomStay.update({ where: { id: s.row.id }, data: { phone, note, guestList: gl as unknown as Prisma.InputJsonValue } });
            if (phone !== s.row.phone) {
              // SĐT một nguồn: ghi luôn lên đơn (đồng bộ sau đó không đổi ngược lại).
              await tx.roomStay.updateMany({ where: { bookingId: s.row.bookingId! }, data: { phone } });
              await tx.bookingRequest.update({ where: { id: s.row.bookingId! }, data: { phone } });
              await tx.bookingLog.create({ data: { bookingId: s.row.bookingId!, kind: "SUPPLIER", title: `Chủ nhà cập nhật SĐT khách: ${s.row.phone} → ${phone}`, by: who } });
            }
          });
          return done(`Đã lưu thông tin ${s.row.code}`);
        }

        const name = has("name") ? str(body.name, 80) : s.row.customerName;
        if (name.length < 2) return bad("Nhập tên khách.");
        const guests = has("guests") || has("adults") ? Math.max(1, Math.min(200, has("guests") ? int(body.guests) : int(body.adults) + int(body.children))) : s.row.guests;
        const src = has("src") ? ((STAY_SOURCES as readonly string[]).includes(str(body.src, 20)) ? str(body.src, 20) : s.row.source) : s.row.source;
        const datesChanged = ci !== curCi || co !== curCo;
        if (co <= ci) return bad("Ngày trả phải sau ngày nhận.");
        if (diffDays(ci, co) > 60) return bad("Tối đa 60 đêm một lần đặt.");
        if (s.row.checkedInAt) {
          if (ci !== curCi) return bad("Khách đã nhận phòng — chỉ đổi được ngày trả.");
          if (co !== curCo && co < T) return bad("Ngày trả không được trước hôm nay.");
        } else if (ci !== curCi && ci < addDaysKey(T, -1)) return bad("Không đổi ngày nhận về ngày đã qua.");
        // Tiền phòng: sửa tay ⇒ theo số nhập; đổi ngày / số khách ⇒ báo giá lại ở server (lịch lễ chung + giá phòng + phụ thu ở ghép).
        const override = int(body.total);
        let total = Number(s.row.total);
        if (override > 0) total = override;
        else if (datesChanged || guests !== s.row.guests) total = quoteStay([room], ci, co, guests, await holKeysFor(ci, co), extraFee).total;
        const gl2 = gl.length && gl[0].name === s.row.customerName ? [{ ...gl[0], name }, ...gl.slice(1)] : gl;
        await prisma.$transaction(async (tx) => {
          await lockHome(tx, serviceId);
          const cur = await tx.roomStay.findUnique({ where: { id: s.row.id }, select: { state: true, checkedOutAt: true, checkedInAt: true, checkIn: true, checkOut: true } });
          if (!cur || !isLive(cur) || cur.checkedOutAt || toDateKey(cur.checkIn) !== curCi || toDateKey(cur.checkOut) !== curCo || !!cur.checkedInAt !== !!s.row.checkedInAt)
            throw new StayError("Lượt ở vừa thay đổi — tải lại trang.");
          if (datesChanged) {
            await assertRoomsFree(tx, [room], ci, co, { stayId: s.row.id });
            const status = (await tx.roomDayStatus.findFirst({ where: { stayId: s.row.id }, select: { status: true } }))?.status === "BOOKED" ? "BOOKED" : s.row.holdUntil ? "PENDING" : "BOOKED";
            await releaseStayCells(tx, s.row.id);
            await writeStayCells(tx, { id: s.row.id, roomId: room.id, ci, co }, status);
          }
          await tx.roomStay.update({
            where: { id: s.row.id },
            data: {
              customerName: name, phone, note, guests, source: src, total,
              guestList: gl2 as unknown as Prisma.InputJsonValue,
              ...(datesChanged ? { checkIn: parseDateOnly(ci), checkOut: parseDateOnly(co) } : {}),
            },
          });
        }, { timeout: 20_000 });
        return done(`Đã lưu ${s.row.code}${datesChanged ? ` · ${dm(ci)} → ${dm(co)}` : ""} · tiền phòng ${vnd(total)}`);
      }

      // ===================== NHẬN / TRẢ PHÒNG =====================
      case "checkIn": {
        const s = await ownStay(str(body.id, 40));
        if (!s) return bad("Không tìm thấy lượt ở.");
        if (!isLive(s.row) || s.row.checkedInAt) return bad("Lượt ở đã nhận phòng hoặc đã kết thúc.");
        if (toDateKey(s.row.checkIn) > T) return bad(`Chưa tới ngày nhận phòng (${dm(toDateKey(s.row.checkIn))}).`);
        if (toDateKey(s.row.checkOut) <= T) return bad(`Lượt ở đã qua ngày trả phòng (${dm(toDateKey(s.row.checkOut))}).`);
        const time = TIME_RE.test(str(body.time, 5)) ? str(body.time, 5) : NOW;
        const guests = Array.isArray(body.guests)
          ? (body.guests as unknown[]).slice(0, 40).map((g) => {
              const o = (g && typeof g === "object" ? g : {}) as Record<string, unknown>;
              return { name: str(o.name, 80), cccd: str(o.cccd, 12).replace(/\D/g, "") };
            }).filter((g) => g.name || g.cccd)
          : [];
        const fees = (Array.isArray(s.row.fees) ? s.row.fees : []) as unknown as StayFee[];
        const early = time < hh(cfg.ci) && time < "12:00" && cfg.early > 0;
        // Điều kiện checkedInAt = null ngay trong câu lệnh: bấm 2 lần không cộng phí nhận sớm 2 lần.
        const upd = await prisma.roomStay.updateMany({
          where: { id: s.row.id, checkedInAt: null, state: null },
          data: {
            checkedInAt: vnTimeToday(T, time),
            guestList: guests as unknown as Prisma.InputJsonValue,
            holdUntil: null,
            ...(early ? { fees: [...fees, { name: "Nhận phòng sớm", amt: cfg.early }] as unknown as Prisma.InputJsonValue } : {}),
          },
        });
        if (!upd.count) return bad("Lượt ở đã nhận phòng hoặc vừa thay đổi — tải lại trang.");
        return done(`Đã nhận phòng ${roomById.get(s.row.roomId)?.name ?? ""} lúc ${time}`);
      }
      case "checkOut": {
        const s = await ownStay(str(body.id, 40));
        if (!s) return bad("Không tìm thấy lượt ở.");
        if (!s.row.checkedInAt || s.row.checkedOutAt || !isLive(s.row)) return bad("Lượt ở chưa nhận phòng hoặc đã trả.");
        const method = (PAY_METHODS as readonly string[]).includes(str(body.method, 20)) ? str(body.method, 20) : "Tiền mặt";
        // Trả sớm: KHÔNG phạt, vẫn tính đủ tiền phòng như đã đặt (không hoàn đêm chưa ở — muốn bớt thì "Sửa" lượt ở).
        const add: StayFee[] = [
          ...(body.late === true && cfg.late ? [{ name: "Trả muộn", amt: cfg.late }] : []),
          ...(int(body.dmg) ? [{ name: "Hư hỏng", amt: int(body.dmg) }] : []),
        ];
        const fees = [...s.vm.fees, ...add];
        const me = { ...s.vm, fees };
        const group = await groupOf(s.row.groupId, s.row.id);
        const due = billOf(me) - paidOf(me, [me, ...group]);
        const canPay = !s.vm.payBlock;
        const room = roomById.get(s.row.roomId);
        const co = toDateKey(s.row.checkOut);
        // Trả trước ngày dự kiến (lượt chủ tạo): rút ngày trả về hôm nay (ít nhất giữ đêm nhận phòng) và nhả các đêm sau để web bán lại.
        // Tiền phòng (total) giữ nguyên như đã đặt.
        const ci0 = toDateKey(s.row.checkIn);
        const newCo = T > ci0 ? T : addDaysKey(ci0, 1);
        const shorten = !s.row.bookingId && newCo < co;
        await prisma.$transaction(async (tx) => {
          await lockHome(tx, serviceId);
          // Điều kiện checkedOutAt = null trong câu lệnh: bấm "Thu & trả phòng" 2 lần không ghi thu 2 lần.
          const upd = await tx.roomStay.updateMany({
            where: { id: s.row.id, checkedOutAt: null, state: null },
            data: {
              checkedOutAt: new Date(),
              fees: fees as unknown as Prisma.InputJsonValue,
              ...(shorten ? { checkOut: parseDateOnly(newCo) } : {}),
            },
          });
          if (!upd.count) throw new StayError("Lượt ở đã trả phòng — tải lại trang.");
          if (shorten) await releaseStayCells(tx, s.row.id, newCo);
          if (due && canPay) {
            await tx.stayPayment.create({ data: { stayId: s.row.id, amount: due, method, kind: due > 0 ? "Thu khi trả" : "Hoàn khi trả", by: who } });
            if (s.row.bookingId) await pushStayPayments(tx, s.row.bookingId, who, `Trả phòng ${room?.name ?? ""} · ${due > 0 ? "thu" : "hoàn"} ${vnd(Math.abs(due))} (${method})`);
          }
          await tx.room.update({ where: { id: s.row.roomId }, data: { hkStatus: "dirty", hkAt: new Date() } });
        });
        return done(`Đã trả phòng ${room?.name ?? ""} · phòng chuyển "Chưa dọn"${due && !canPay ? ` · còn ${vnd(due)} chưa ghi thu (đơn sàn)` : ""}`);
      }
      case "charge": {
        const s = await ownStay(str(body.id, 40));
        if (!s) return bad("Không tìm thấy lượt ở.");
        const st = stayStatus(s.vm, [s.vm], T, NOW, cfg);
        if (!["inhouse", "dueout", "overdue"].includes(st)) return bad("Chỉ ghi dịch vụ cho phòng đang có khách.");
        const name = str(body.name, 40);
        const amt = int(body.amt);
        if (!name || !amt) return bad("Thiếu tên hoặc giá dịch vụ.");
        await prisma.roomStay.update({ where: { id: s.row.id }, data: { fees: [...s.vm.fees, { name, amt }] as unknown as Prisma.InputJsonValue } });
        return done(`Đã ghi ${name} vào phòng ${roomById.get(s.row.roomId)?.name ?? ""}`);
      }

      // ===================== ĐÓNG / MỞ PHÒNG =====================
      case "close": {
        const ids = Array.isArray(body.rooms) ? [...new Set((body.rooms as unknown[]).map((x) => str(x, 40)))] : [];
        const picked = ids.map((id) => roomById.get(id)).filter((r): r is NonNullable<typeof r> => !!r);
        const from = str(body.from, 10), to = str(body.to, 10);
        const reason = (CLOSE_REASONS as readonly string[]).includes(str(body.reason, 20)) ? str(body.reason, 20) : "Khác";
        if (!picked.length) return bad("Chọn phòng.");
        if (!DATE_RE.test(from) || !DATE_RE.test(to) || to < from) return bad("Ngày kết thúc phải sau ngày bắt đầu.");
        if (diffDays(from, to) > 366) return bad("Tối đa 1 năm mỗi lần đóng.");
        await prisma.$transaction(async (tx) => {
          await lockHome(tx, serviceId);
          await assertRoomsFree(tx, picked, from, addDaysKey(to, 1));
          const c = await tx.homeClose.create({ data: { serviceId, roomIds: picked.map((r) => r.id), fromDate: parseDateOnly(from), toDate: parseDateOnly(to), reason, createdBy: who } });
          const dates: string[] = [];
          for (let d = from; d <= to; d = addDaysKey(d, 1)) dates.push(d);
          // Dòng "Trống" (AVAILABLE) còn sót trong DB sẽ làm createMany bỏ qua ⇒ xoá trước.
          await tx.roomDayStatus.deleteMany({ where: { roomId: { in: picked.map((r) => r.id) }, date: { in: dates.map(parseDateOnly) }, status: "AVAILABLE" } });
          await tx.roomDayStatus.createMany({
            data: picked.flatMap((r) => dates.map((d) => ({ roomId: r.id, date: parseDateOnly(d), status: "CLOSED" as const, note: closeTag(c.id) }))),
            skipDuplicates: true,
          });
          await resyncCells(tx, picked.map((r) => r.id), dates);
        }, { timeout: 30_000 });
        return done(`Đã đóng ${picked.map((r) => r.name).join(", ")} · ${dm(from)} → ${dm(to)}`);
      }
      case "reopen": {
        const c = await prisma.homeClose.findFirst({ where: { id: str(body.id, 40), serviceId } });
        if (!c) return bad("Không tìm thấy lần đóng phòng.");
        await prisma.$transaction(async (tx) => {
          await lockHome(tx, serviceId);
          const cells = await tx.roomDayStatus.findMany({ where: { note: closeTag(c.id) }, select: { roomId: true, date: true } });
          await tx.roomDayStatus.deleteMany({ where: { note: closeTag(c.id) } });
          await tx.homeClose.delete({ where: { id: c.id } });
          await resyncCells(tx, [...new Set(cells.map((x) => x.roomId))], cells.map((x) => toDateKey(x.date)));
        }, { timeout: 30_000 });
        return done(`Đã mở lại ${c.roomIds.map((id) => roomById.get(id)?.name ?? "").join(", ")}`);
      }

      // ===================== ĐƠN WEB =====================
      case "webConfirm": {
        const b = await prisma.bookingRequest.findUnique({ where: { id: str(body.bookingId, 40) } });
        if (!b || b.status === "CANCELLED") return bad("Đơn không còn hiệu lực.");
        if (b.heldRoom) return bad("Đơn đã được xác nhận.");
        const list = b.roomIds.length ? b.roomIds : b.roomId ? [b.roomId] : [];
        const mine = list.filter((id) => roomById.has(id));
        if (!mine.length) return bad("Đơn không thuộc homestay này.", 403);
        const toId = str(body.roomId, 40);
        const ci = toDateKey(b.useDate), co = toDateKey(b.endDate ?? parseDateOnly(addDaysKey(ci, 1)));
        let changed: { from: string; to: string } | null = null;
        if (toId && mine.length === 1 && toId !== mine[0]) {
          const to = roomById.get(toId);
          if (!to || to.typeId !== roomById.get(mine[0])!.typeId) return bad("Chỉ đổi sang phòng cùng hạng.");
          changed = { from: mine[0], to: toId };
        }
        await prisma.$transaction(async (tx) => {
          await lockHome(tx, serviceId);
          const finalRooms = changed ? list.map((id) => (id === changed!.from ? changed!.to : id)) : list;
          const ownRooms = finalRooms.filter((id) => roomById.has(id)).map((id) => roomById.get(id)!);
          await assertRoomsFree(tx, ownRooms, ci, co, { bookingId: b.id });
          const holdsPlatform = b.status === "CONFIRMED" || b.status === "COMPLETED";
          if (changed) {
            if (holdsPlatform) await assignRoomsForBooking(tx, b, false);
          }
          const nb = await tx.bookingRequest.update({ where: { id: b.id }, data: { heldRoom: true, ...(changed ? { roomIds: finalRooms, roomId: finalRooms[0] ?? null } : {}) } });
          if (changed && holdsPlatform) await assignRoomsForBooking(tx, nb, true);
          // Đơn chưa chốt: giữ ô PENDING ngay trong transaction này (đã khoá + kiểm trống) — không để khe hở cho lượt khác chen vào.
          if (!holdsPlatform) await holdPendingCellsTx(tx, b.id, ownRooms.map((r) => r.id), [...roomById.keys()]);
          await tx.bookingLog.create({
            data: {
              bookingId: b.id, kind: "SUPPLIER", by: who,
              title: `Chủ nhà xác nhận còn phòng ${ownRooms.map((r) => r.name).join(", ")}`,
              body: changed ? `Đổi phòng ${roomById.get(changed.from)?.name} → ${roomById.get(changed.to)?.name}. ` + "Phòng đã giữ trên lịch." : "Phòng đã giữ trên lịch.",
            },
          });
        }, { timeout: 20_000 });
        await syncStaysForBooking(b.id).catch((e) => console.error("[stay] đồng bộ sau xác nhận", e));
        return done(`Đã xác nhận ${b.code} · phòng hiện trên sơ đồ`);
      }
      case "webReject": {
        const b = await prisma.bookingRequest.findUnique({ where: { id: str(body.bookingId, 40) } });
        if (!b) return bad("Không tìm thấy đơn.");
        const reason = str(body.reason, 120) || "Khác";
        const list = (b.roomIds.length ? b.roomIds : b.roomId ? [b.roomId] : []).filter((id) => roomById.has(id));
        if (!list.length) return bad("Đơn không thuộc homestay này.", 403);
        if (b.heldRoom) return bad("Đơn đã xác nhận — báo sàn nếu cần huỷ.");
        const ci = toDateKey(b.useDate), co = toDateKey(b.endDate ?? parseDateOnly(addDaysKey(ci, 1)));
        await prisma.$transaction(async (tx) => {
          await lockHome(tx, serviceId);
          // Lượt ở "từ chối" chỉ để đánh dấu (không giữ phòng) — đơn không hiện lại ở tab Đơn web.
          const has = await tx.roomStay.findFirst({ where: { bookingId: b.id, serviceId } });
          if (has) await tx.roomStay.updateMany({ where: { bookingId: b.id, serviceId, checkedInAt: null }, data: { state: "reject" } });
          else await createWithCode(tx, { serviceId, roomId: list[0], bookingId: b.id, customerName: b.customerName, phone: b.phone, checkIn: parseDateOnly(ci), checkOut: parseDateOnly(co), total: 0, source: "Web sàn", state: "reject", note: `Từ chối: ${reason}`, createdBy: who });
          await tx.bookingLog.create({ data: { bookingId: b.id, kind: "SUPPLIER", title: `Chủ nhà từ chối đơn: ${reason}`, body: "Sàn cần tìm phòng khác cho khách.", by: who } });
        });
        return done(`Đã từ chối ${b.code} · lý do: ${reason}`);
      }

      // ===================== BUỒNG PHÒNG / SỰ CỐ / CHI PHÍ =====================
      case "setHk": {
        const r = roomById.get(str(body.roomId, 40));
        const hk = str(body.hk, 10);
        if (!r || !(HK_KEYS as string[]).includes(hk)) return bad("Thiếu phòng hoặc tình trạng.");
        await prisma.room.update({ where: { id: r.id }, data: { hkStatus: hk, hkAt: new Date() } });
        return done(`Phòng ${r.name}: ${({ clean: "Sạch", dirty: "Chưa dọn", cleaning: "Đang dọn", maint: "Bảo trì" } as Record<string, string>)[hk]}`);
      }
      case "svcLog": {
        const r = roomById.get(str(body.roomId, 40));
        const what = str(body.what, 160);
        const cost = int(body.cost);
        if (!r) return bad("Chọn phòng.");
        if (!what) return bad("Ghi nội dung sự cố.");
        await prisma.$transaction([
          prisma.roomServiceLog.create({ data: { roomId: r.id, date: parseDateOnly(T), what, cost, by: who } }),
          ...(cost ? [prisma.homeExpense.create({ data: { serviceId, date: parseDateOnly(T), category: "Sửa chữa", amount: cost, note: `${r.name} · ${what}`, by: who } })] : []),
        ]);
        return done(`Đã ghi sự cố${cost ? ` và cộng ${vnd(cost)} vào chi phí` : ""}`);
      }
      case "expense": {
        const cat = (EXP_CATS as readonly string[]).includes(str(body.cat, 20)) ? str(body.cat, 20) : "Khác";
        if (str(body.deleteId, 40)) {
          const n = await prisma.homeExpense.deleteMany({ where: { id: str(body.deleteId, 40), serviceId } });
          return n.count ? done("Đã xoá khoản chi") : bad("Không tìm thấy khoản chi.");
        }
        const amt = int(body.amt);
        if (!amt) return bad("Nhập số tiền.");
        await prisma.homeExpense.create({ data: { serviceId, date: parseDateOnly(DATE_RE.test(str(body.date, 10)) ? str(body.date, 10) : T), category: cat, amount: amt, note: str(body.note, 160) || null, by: who } });
        return done(`Đã ghi khoản chi ${vnd(amt)}`);
      }

      // ===================== KHÁCH / CẤU HÌNH =====================
      case "flag": {
        const phone = normPhone(str(body.phone, 20));
        if (!PHONE_RE.test(phone)) return bad("Số điện thoại không hợp lệ.");
        const f = str(body.flag, 10);
        const flags = { ...cfg.flags };
        if (f === "vip" || f === "black") flags[phone] = f;
        else delete flags[phone];
        await saveHomeConfig(serviceId, { ...cfg, flags });
        return done(f === "vip" ? "Đã đánh dấu khách quen" : f === "black" ? "Đã thêm vào danh sách đen" : "Đã bỏ đánh dấu");
      }
      case "saveCfg": {
        const p = (body.patch ?? {}) as Partial<HomeConfig>;
        // Không cho ghi đè khách quen / DS đen qua đường này.
        const next: HomeConfig = { ...cfg, ...p, flags: cfg.flags };
        await saveHomeConfig(serviceId, next);
        return done("Đã lưu cài đặt");
      }

      // ===================== TÀI KHOẢN LỄ TÂN =====================
      case "staffCreate":
      case "staffToggle":
      case "staffReset":
      case "staffDelete": {
        if (!svc.ownerId) return bad("Homestay chưa gắn tài khoản chủ — admin gắn chủ dịch vụ trước khi tạo nhân viên.");
        if (op === "staffCreate") {
          const name = str(body.name, 60);
          const username = str(body.username, 40).toLowerCase();
          const phone = normPhone(str(body.phone, 15));
          const password = typeof body.password === "string" ? body.password : "";
          if (name.length < 2) return bad("Nhập tên nhân viên.");
          if (!/^[a-z0-9._-]{3,40}$/.test(username)) return bad("Tên đăng nhập 3–40 ký tự: chữ thường, số, dấu . _ -");
          if (phone && !PHONE_RE.test(phone)) return bad("Số điện thoại chưa đúng (10 số).");
          if (password.length < 6) return bad("Mật khẩu tối thiểu 6 ký tự.");
          if (await prisma.adminUser.findUnique({ where: { username } })) return bad("Tên đăng nhập đã có người dùng.");
          await prisma.adminUser.create({ data: { username, name, phone: phone || null, role: "STAFF", staffArea: STAFF_AREA, providerId: svc.ownerId, passwordHash: await hashPassword(password) } });
          return done(`Đã tạo tài khoản ${username} — gửi tên đăng nhập + mật khẩu cho nhân viên`);
        }
        // Chỉ tài khoản lễ tân Quản lý phòng — không đụng nhân viên giao xe của cùng chủ.
        const u = await prisma.adminUser.findFirst({ where: { id: str(body.id, 40), role: "STAFF", staffArea: STAFF_AREA, providerId: svc.ownerId } });
        if (!u) return bad("Không tìm thấy nhân viên.");
        if (op === "staffToggle") {
          await prisma.adminUser.update({ where: { id: u.id }, data: { active: !u.active } });
          return done(u.active ? `Đã khoá ${u.username}` : `Đã mở khoá ${u.username}`);
        }
        if (op === "staffReset") {
          const password = typeof body.password === "string" ? body.password : "";
          if (password.length < 6) return bad("Mật khẩu tối thiểu 6 ký tự.");
          await prisma.adminUser.update({ where: { id: u.id }, data: { passwordHash: await hashPassword(password) } });
          return done(`Đã đổi mật khẩu ${u.username}`);
        }
        await prisma.adminUser.delete({ where: { id: u.id } });
        return done(`Đã xoá tài khoản ${u.username}`);
      }
      default:
        return bad("Thao tác không hợp lệ.");
    }
  } catch (err) {
    if (err instanceof RoomConflictError) return bad(err.message.split("\n")[0]);
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return bad("Dữ liệu bị trùng, thử lại.");
    if (!(err instanceof StayError)) console.error("[stay api]", op, err);
    return bad(err instanceof Error ? err.message : "Có lỗi xảy ra.");
  }
}
