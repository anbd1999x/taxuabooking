import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDemoSession } from "@/lib/fleet-demo";
import { prisma } from "@/lib/prisma";
import {
  TicketError, canManageVenue, cancelOrder, confirmOrder, createSessions, createTicketOrder, createVenue, deleteSession, deleteTable,
  loadTicketData, moveSeat, patchSession, patchVenueConfig, payOrder, saveLayout, scanStats, scanTicket, sendTicketEmail, setTableStatus, ticketOwnerOf,
  toggleSeatLock, unpayOrder,
} from "@/lib/ticket";
import { pushToAdmins, pushToUsers } from "@/lib/push";
import { REVIEW_LABEL, TIME_RE, VENUE_KINDS, asReview, type VenueKind } from "@/lib/ticket-core";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });
const str = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const int = (v: unknown) => {
  const n = parseInt(String(v ?? "").replace(/[^\d-]/g, ""), 10);
  return Number.isFinite(n) ? n : 0;
};
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const PAY: Record<string, string> = { cash: "Tiền mặt", qr: "Chuyển khoản" };

/** Địa điểm còn thiếu gì để gửi duyệt (null = đủ). */
async function venueLacks(venueId: string, kind: VenueKind): Promise<string | null> {
  const [tiers, tables] = await Promise.all([
    prisma.ticketTier.count({ where: { venueId, active: true } }),
    prisma.ticketTable.count({ where: { venueId, active: true } }),
  ]);
  if (kind === "RESTAURANT" && !tables) return "Thêm ít nhất một bàn trước khi gửi duyệt.";
  if (kind !== "RESTAURANT" && !tiers) return "Thêm ít nhất một hạng vé trước khi gửi duyệt.";
  return null;
}

/**
 * Vé & đặt bàn (admin / chủ địa điểm / nhân viên soát vé) — theo mẫu "Ban ve - Quan tri".
 * Mọi thao tác trả lại toàn bộ dữ liệu địa điểm để giao diện thay state một lần (riêng `scan` chỉ trả kết quả quét).
 * op: scan | createVenue | saveVenue | deleteVenue | saveTier | deleteTier | saveMenu | deleteMenu | saveTable | deleteTable |
 *     saveLayout | savePolicy | createSessions | setQuota | setPause | deleteSession | gateSell | showSell | seatLock | moveSeat |
 *     tableHold | confirm | paid | unpaid | cancel | tableStatus | reload |
 *     submitReview | withdrawReview (chủ gửi / rút yêu cầu duyệt) | approveVenue | rejectVenue (admin duyệt địa điểm đối tác tự tạo)
 */
export async function POST(request: Request) {
  let session = await getSession();
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return bad("Thiếu dữ liệu.");
  }
  const op = str(body.op, 30);
  const venueId = str(body.venueId, 40);
  // Bản demo (/demo/ve, /demo/goi-mon): phiên demo nằm ở cookie riêng — dùng khi phiên thường không quản lý được địa điểm này.
  if (!(venueId ? await canManageVenue(session, venueId) : await ticketOwnerOf(session))) {
    const demo = await getDemoSession();
    if (demo) session = demo;
  }
  const owner = await ticketOwnerOf(session);
  if (!session || !owner) return bad("Không có quyền.", 403);
  // Bản demo: thử mọi thao tác vận hành, trừ đổi thông tin / mở bán địa điểm (địa điểm demo luôn ẩn với khách thật).
  if (session.role === "DEMO" && ["createVenue", "saveVenue", "deleteVenue", "submitReview", "withdrawReview", "approveVenue", "rejectVenue"].includes(op)) return bad("Bản demo không đổi được thông tin địa điểm. Các thao tác bán vé, đặt bàn, thực đơn… vẫn thử được.", 403);
  const who = session.name || session.username;

  try {
    // ---- Soát vé: nhân viên cũng dùng được; không cần chọn địa điểm ----
    if (op === "scan") {
      if (venueId && !(await canManageVenue(session, venueId))) return bad("Không có quyền.", 403);
      const result = await scanTicket(owner, who, str(body.code, 300), { venueId: venueId || undefined, sessionId: str(body.sessionId, 40) || undefined, deliver: body.deliver === true });
      return NextResponse.json({ result, stats: await scanStats(owner, venueId || undefined) });
    }
    if (session.role === "STAFF") return bad("Tài khoản nhân viên chỉ dùng được trang soát vé.", 403);

    if (op === "createVenue") {
      // Admin tạo cho bất kỳ chủ nào (đã duyệt sẵn). Đối tác (PROVIDER) tự tạo cho mình ⇒ bản nháp, phải gửi admin duyệt mới mở bán.
      if (session.role !== "ADMIN" && session.role !== "PROVIDER") return bad("Tài khoản này không tạo được địa điểm.", 403);
      const kind = str(body.kind, 12) as VenueKind;
      if (!["GATE", "SHOW", "RESTAURANT"].includes(kind)) return bad("Loại địa điểm không hợp lệ.");
      let ownerId: string | null;
      if (session.role === "ADMIN") {
        ownerId = str(body.ownerId, 40) || null;
        if (ownerId && !(await prisma.adminUser.findFirst({ where: { id: ownerId, role: "PROVIDER" } }))) return bad("Chủ địa điểm không hợp lệ.");
      } else {
        ownerId = session.sub;
        const open = await prisma.ticketVenue.count({ where: { ownerId, review: { not: "approved" } } });
        if (open >= 10) return bad("Bạn đang có 10 địa điểm chưa được duyệt — hoàn thiện / xoá bớt rồi tạo thêm.");
      }
      const id = await createVenue({ kind, name: str(body.name, 100), ownerId, placeId: str(body.placeId, 40) || null, review: session.role === "ADMIN" ? "approved" : "draft" });
      return NextResponse.json({ ...(await loadTicketData(id)), message: session.role === "ADMIN" ? "Đã tạo địa điểm." : "Đã tạo bản nháp — thiết lập xong bấm “Gửi duyệt”." });
    }

    const venue = await canManageVenue(session, venueId);
    if (!venue) return bad("Không có quyền.", 403);
    const done = async (message = "") => NextResponse.json({ ...(await loadTicketData(venueId)), message });
    const date = str(body.date, 10);
    const time = venue.kind === "GATE" ? "" : str(body.time, 5);
    const orderId = str(body.orderId, 40);
    const sessionId = str(body.sessionId, 40);

    switch (op) {
      case "reload":
        return done();

      // ===================== THIẾT LẬP =====================
      case "saveVenue": {
        const name = str(body.name, 100);
        if (name.length < 2) return bad("Nhập tên địa điểm.");
        const data: Record<string, unknown> = { name, area: str(body.area, 80) || null, description: str(body.description, 2000) || null };
        // Bật / tắt mở bán: địa điểm đã duyệt thì chủ tự bật tắt; chưa duyệt thì chỉ đi qua Gửi duyệt → admin Duyệt.
        // Admin bật mở bán = duyệt luôn.
        if ("published" in body) {
          const want = body.published === true;
          if (session.role === "ADMIN") {
            data.published = want;
            if (want && venue.review !== "approved") Object.assign(data, { review: "approved", reviewNote: null });
          } else if (venue.review === "approved") data.published = want;
        }
        if ("placeId" in body) {
          const placeId = str(body.placeId, 40) || null;
          if (placeId && !(await prisma.place.findUnique({ where: { id: placeId }, select: { id: true } }))) return bad("Quán ở danh mục không tồn tại.");
          data.placeId = placeId;
        }
        if ("coverImage" in body) {
          const cover = str(body.coverImage, 300);
          if (cover && !/^\/uploads\/[\w.-]+$/.test(cover)) return bad("Ảnh bìa không hợp lệ.");
          data.coverImage = cover || null;
        }
        if (session.role === "ADMIN" && "ownerId" in body) {
          const ownerId = str(body.ownerId, 40) || null;
          if (ownerId && !(await prisma.adminUser.findFirst({ where: { id: ownerId, role: "PROVIDER" } }))) return bad("Chủ địa điểm không hợp lệ.");
          data.ownerId = ownerId;
        }
        await prisma.ticketVenue.update({ where: { id: venueId }, data });
        const cfg: Record<string, unknown> = {};
        if ("quota" in body) cfg.quota = int(body.quota);
        if ("holdMin" in body) cfg.holdMin = int(body.holdMin);
        if ("mealMin" in body) cfg.mealMin = int(body.mealMin);
        if ("slots" in body) cfg.slots = arr(body.slots).map((s) => str(s, 5)).filter((s) => TIME_RE.test(s));
        if ("floors" in body) cfg.floors = arr(body.floors);
        if ("notes" in body) cfg.notes = arr(body.notes).map((s) => str(s, 200));
        for (const k of ["hours", "artist", "bankBin", "bankAcc", "bankHolder", "seatUnit"]) if (k in body) cfg[k] = str(body[k], 120);
        if (Object.keys(cfg).length) await patchVenueConfig(venueId, cfg);
        return done("Đã lưu thông tin địa điểm.");
      }
      // ===================== DUYỆT ĐỊA ĐIỂM =====================
      case "submitReview": {
        if (venue.review === "approved") return bad("Địa điểm đã được duyệt — bật “Hiển thị & mở bán” là xong.");
        if (venue.review === "pending") return bad("Đã gửi duyệt, đang chờ quản trị viên.");
        const lack = await venueLacks(venueId, venue.kind as VenueKind);
        if (lack) return bad(lack);
        await prisma.ticketVenue.update({ where: { id: venueId }, data: { review: "pending", published: true, submittedAt: new Date(), reviewNote: null } });
        await pushToAdmins({ title: "Địa điểm chờ duyệt", body: `${VENUE_KINDS[venue.kind as VenueKind]} · ${venue.name}`, url: `/admin/provider/ve?tab=setup&venue=${venueId}`, tag: `venue-review-${venueId}` }).catch(() => 0);
        return done("Đã gửi duyệt. Quản trị viên duyệt xong địa điểm sẽ tự hiện ở trang Vé & đặt bàn.");
      }
      case "withdrawReview": {
        if (venue.review !== "pending") return bad("Địa điểm không ở trạng thái chờ duyệt.");
        await prisma.ticketVenue.update({ where: { id: venueId }, data: { review: "draft", published: false } });
        return done("Đã rút lại yêu cầu duyệt.");
      }
      case "approveVenue":
      case "rejectVenue": {
        if (session.role !== "ADMIN") return bad("Chỉ quản trị viên duyệt được địa điểm.", 403);
        const ok = op === "approveVenue";
        const note = str(body.note, 300);
        if (!ok && note.length < 3) return bad("Nhập lý do từ chối để đối tác sửa.");
        await prisma.ticketVenue.update({ where: { id: venueId }, data: ok ? { review: "approved", published: true, reviewNote: null } : { review: "rejected", published: false, reviewNote: note } });
        if (venue.ownerId) {
          await pushToUsers([venue.ownerId], {
            title: ok ? "Địa điểm đã được duyệt" : "Địa điểm chưa được duyệt",
            body: ok ? `${venue.name} đã mở bán trên Tà Xùa Booking.` : `${venue.name}: ${note}`,
            url: `/admin/provider/ve?tab=setup&venue=${venueId}`, tag: `venue-review-${venueId}`,
          }).catch(() => 0);
        }
        return done(ok ? "Đã duyệt — địa điểm đang hiện ở trang Vé & đặt bàn." : `Đã từ chối (${REVIEW_LABEL[asReview("rejected")]}).`);
      }

      case "deleteVenue": {
        // Đối tác xoá được bản nháp / bị từ chối / đang chờ duyệt của mình; địa điểm đã duyệt chỉ admin xoá.
        if (session.role !== "ADMIN" && venue.review === "approved") return bad("Địa điểm đã duyệt — liên hệ quản trị viên để xoá, hoặc tắt “Hiển thị & mở bán”.", 403);
        if (await prisma.ticketOrder.count({ where: { venueId } })) return bad("Địa điểm đã có đơn — bỏ 'Hiển thị trên web' thay vì xoá.");
        await prisma.ticketVenue.delete({ where: { id: venueId } });
        return NextResponse.json({ deleted: true, message: "Đã xoá địa điểm." });
      }
      case "savePolicy": {
        const policy = str(body.policy, 10);
        if (!["none", "deposit", "min"].includes(policy)) return bad("Chính sách không hợp lệ.");
        await patchVenueConfig(venueId, { policy, amount: Math.max(0, int(body.amount)) });
        return done("Đã lưu chính sách đặt món & cọc.");
      }
      case "saveTier": {
        const t = (body.tier ?? {}) as Record<string, unknown>;
        const name = str(t.name, 60);
        if (!name) return bad("Nhập tên hạng vé.");
        const seatClass = venue.kind === "SHOW" && (t.seatClass === "vip" || t.seatClass === "norm") ? t.seatClass : null;
        const id = str(t.id, 40);
        if (seatClass && (await prisma.ticketTier.findFirst({ where: { venueId, seatClass, id: { not: id || "-" } } }))) return bad("Mỗi hạng ghế (VIP / Thường) chỉ có một giá.");
        const listPrice = int(t.listPrice);
        const data = {
          name, price: Math.max(0, int(t.price)), listPrice: listPrice > int(t.price) ? listPrice : null, seatClass,
          quota: String(t.quota ?? "").trim() === "" || seatClass ? null : Math.max(0, int(t.quota)), active: t.active !== false, sortOrder: int(t.sortOrder),
        };
        if (id) {
          if (!(await prisma.ticketTier.findFirst({ where: { id, venueId } }))) return bad("Hạng vé không tồn tại.");
          await prisma.ticketTier.update({ where: { id }, data });
        } else await prisma.ticketTier.create({ data: { ...data, venueId } });
        return done("Đã lưu hạng vé.");
      }
      case "deleteTier":
        await prisma.ticketTier.deleteMany({ where: { id: str(body.id, 40), venueId } });
        return done("Đã xoá hạng vé.");
      case "saveMenu": {
        const m = (body.item ?? {}) as Record<string, unknown>;
        const name = str(m.name, 80);
        if (!name) return bad("Nhập tên món.");
        const data = { name, group: str(m.group, 40) || null, price: Math.max(0, int(m.price)), active: m.active !== false, sortOrder: int(m.sortOrder) };
        const id = str(m.id, 40);
        if (id) {
          if (!(await prisma.ticketMenuItem.findFirst({ where: { id, venueId } }))) return bad("Món không tồn tại.");
          await prisma.ticketMenuItem.update({ where: { id }, data });
        } else await prisma.ticketMenuItem.create({ data: { ...data, venueId } });
        return done("Đã lưu món.");
      }
      // Ảnh của món (ảnh đầu là bìa) — tab Thiết lập; cùng quy tắc với tab Gọi món QR.
      case "menuImages": {
        const id = str(body.id, 40);
        if (!(await prisma.ticketMenuItem.findFirst({ where: { id, venueId } }))) return bad("Món không tồn tại.");
        const list = [...new Set(arr(body.images).map((u) => str(u, 300)).filter(Boolean))];
        if (list.some((u) => !/^\/(uploads|hop-tac\/demo\/mon)\/[\w.-]+$/.test(u))) return bad("Ảnh không hợp lệ.");
        if (list.length > 8) return bad("Mỗi món tối đa 8 ảnh.");
        await prisma.ticketMenuItem.update({ where: { id }, data: { images: list, imageUrl: list[0] ?? null } });
        return done();
      }
      case "deleteMenu":
        await prisma.ticketMenuItem.deleteMany({ where: { id: str(body.id, 40), venueId } });
        return done("Đã xoá món.");
      case "saveTable": {
        const t = (body.table ?? {}) as Record<string, unknown>;
        const name = str(t.name, 12);
        if (!name) return bad("Nhập tên bàn (VD: T1, B2).");
        const id = str(t.id, 40);
        if (await prisma.ticketTable.findFirst({ where: { venueId, name, id: { not: id || "-" } } })) return bad(`Đã có bàn tên ${name}.`);
        const data = { name, capacity: Math.min(60, Math.max(1, int(t.cap) || 4)), zone: str(t.zone, 40) || "Trong nhà", floor: Math.min(7, Math.max(0, int(t.floor))), round: t.round === true, active: t.active !== false, sortOrder: int(t.sortOrder) };
        if (id) {
          if (!(await prisma.ticketTable.findFirst({ where: { id, venueId } }))) return bad("Bàn không tồn tại.");
          await prisma.ticketTable.update({ where: { id }, data });
        } else await prisma.ticketTable.create({ data: { ...data, venueId } });
        return done("Đã lưu bàn.");
      }
      case "deleteTable":
        await deleteTable(venueId, str(body.id, 40));
        return done("Đã xoá bàn.");
      case "saveLayout":
        await saveLayout(venueId, body.layout);
        return done("Đã lưu sơ đồ ghế.");

      // ===================== SUẤT =====================
      case "createSessions": {
        const n = await createSessions(venueId, arr(body.dates).map((d) => str(d, 10)), str(body.time, 5));
        return done(n ? `Đã tạo ${n} suất.` : "Các suất này đã có sẵn.");
      }
      case "setQuota":
        await patchSession(venueId, date, time, { quota: Math.max(0, int(body.quota)) });
        return done();
      case "setPause":
        await patchSession(venueId, date, time, { status: body.paused === true ? "paused" : "open" });
        return done(body.paused === true ? "Đã tạm dừng bán." : "Đã mở bán lại.");
      case "deleteSession":
        await deleteSession(venueId, sessionId);
        return done("Đã xoá suất.");

      // ===================== BÁN / GIỮ CHỖ =====================
      case "gateSell": {
        const o = await createTicketOrder({
          venueId, date, time: "", name: str(body.name, 80) || "Khách mua tại cổng", phone: str(body.phone, 15), source: "Quầy", createdBy: who,
          tickets: arr(body.tickets).map((t) => ({ tierId: str((t as Record<string, unknown>)?.tierId, 40), qty: int((t as Record<string, unknown>)?.qty) })),
          food: arr(body.food).map((f) => ({ menuId: str((f as Record<string, unknown>)?.menuId, 40), qty: int((f as Record<string, unknown>)?.qty) })),
          mode: "paid", payMethod: PAY[str(body.pay, 6)] ?? "Tiền mặt", staff: true,
        });
        const d = await loadTicketData(venueId);
        return NextResponse.json({ ...d, message: `Đã bán · mã ${o.code}`, orderId: o.id });
      }
      case "showSell": {
        const pay = str(body.pay, 6);
        const o = await createTicketOrder({
          venueId, date, time, name: str(body.name, 80) || (pay === "none" ? "" : "Khách mua tại quầy"), phone: str(body.phone, 15),
          source: str(body.source, 20) || "Quầy", createdBy: who,
          seats: arr(body.seats).map((k) => str(k, 4)),
          tickets: arr(body.tickets).map((t) => ({ tierId: str((t as Record<string, unknown>)?.tierId, 40), qty: int((t as Record<string, unknown>)?.qty) })),
          food: arr(body.food).map((f) => ({ menuId: str((f as Record<string, unknown>)?.menuId, 40), qty: int((f as Record<string, unknown>)?.qty) })),
          mode: pay === "none" ? "hold" : "paid", payMethod: PAY[pay], staff: true,
        });
        const d = await loadTicketData(venueId);
        return NextResponse.json({ ...d, message: pay === "none" ? `Đã giữ chỗ · mã ${o.code} · chờ thu tiền` : `Đã bán · mã ${o.code}`, orderId: o.id });
      }
      case "seatLock": {
        const locked = await toggleSeatLock(venueId, sessionId, str(body.key, 4));
        return done(locked ? "Đã khoá ghế." : "Đã mở khoá ghế.");
      }
      case "moveSeat":
        await moveSeat(venueId, orderId, str(body.from, 4), str(body.to, 4));
        return done(`Đã đổi sang ghế ${str(body.to, 4)}.`);
      case "tableHold": {
        const o = await createTicketOrder({
          venueId, date, time, name: str(body.name, 80) || "Khách gọi điện", phone: str(body.phone, 15), guests: int(body.guests) || undefined, note: str(body.note, 500),
          source: str(body.source, 20) || "Điện thoại", createdBy: who,
          tableIds: arr(body.tableIds).map((k) => str(k, 40)),
          food: arr(body.food).map((f) => ({ menuId: str((f as Record<string, unknown>)?.menuId, 40), qty: int((f as Record<string, unknown>)?.qty), note: str((f as Record<string, unknown>)?.note, 120) })),
          mode: "confirmed", staff: true,
        });
        return done(`Đã giữ bàn · mã ${o.code}`);
      }

      // ===================== ĐƠN =====================
      case "confirm":
        await confirmOrder(venueId, orderId);
        // Phiên demo không gửi thư (sendTicketEmail cũng tự bỏ qua địa điểm chưa mở bán).
        if (session.role !== "DEMO") void sendTicketEmail(orderId, "confirmed");
        return done(venue.kind === "RESTAURANT" ? "Đã xác nhận bàn." : "Đã xác nhận — vé đã phát.");
      case "paid":
        await payOrder(venueId, orderId, PAY[str(body.pay, 6)] ?? "Chuyển khoản");
        if (session.role !== "DEMO") void sendTicketEmail(orderId, "confirmed");
        return done(venue.kind === "RESTAURANT" ? "Đã ghi thu cọc." : "Đã thu tiền — vé đã phát.");
      case "unpaid":
        await unpayOrder(venueId, orderId);
        return done("Đã hoàn tác.");
      case "cancel":
        await cancelOrder(venueId, orderId);
        return done("Đã huỷ và nhả chỗ.");
      case "tableStatus": {
        const to = str(body.to, 5);
        if (to !== "here" && to !== "eat" && to !== "done") return bad("Trạng thái không hợp lệ.");
        await setTableStatus(venueId, orderId, to);
        return done();
      }
      default:
        return bad("Thao tác không hợp lệ.");
    }
  } catch (e) {
    if (e instanceof TicketError) return bad(e.message);
    console.error("[ticket]", op, e);
    return bad("Có lỗi khi xử lý, thử lại.", 500);
  }
}
