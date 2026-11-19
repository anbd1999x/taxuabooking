import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDemoSession } from "@/lib/fleet-demo";
import { prisma } from "@/lib/prisma";
import { TicketError, canManageVenue, deleteTable } from "@/lib/ticket";
import { DINE_MAX_IMAGES } from "@/lib/dine-core";
import { addDineTable, advanceDineOrder, cancelDineOrder, closeDineRequest, loadDine, payDineTable, rotateDineQr } from "@/lib/dine";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });
const str = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const int = (v: unknown) => {
  const n = parseInt(String(v ?? "").replace(/[^\d-]/g, ""), 10);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Màn hình quán của "Gọi món QR" (tab trong /admin/provider/ve) — theo mẫu "Nha hang QR Order".
 * Mọi op trả lại toàn bộ dữ liệu (`loadDine`); giao diện gọi `load` vài giây một lần để thấy đơn mới.
 * op: load | advance | cancelOrder | reqDone | pay | menuPatch | menuAdd | menuDelete | tableAdd | rotateQr | tableDelete
 */
export async function POST(request: Request) {
  let session = await getSession();
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return bad("Thiếu dữ liệu.");
  }
  const venueId = str(body.venueId, 40);
  let venue = session && session.role !== "STAFF" ? await canManageVenue(session, venueId) : null;
  // Bản demo (/demo/goi-mon): phiên demo nằm ở cookie riêng.
  if (!venue) {
    const demo = await getDemoSession();
    if (demo) {
      session = demo;
      venue = await canManageVenue(demo, venueId);
    }
  }
  if (!venue || venue.kind !== "RESTAURANT" || !session) return bad("Không có quyền.", 403);
  const op = str(body.op, 20);
  const who = session.name || session.username;
  const done = async (message = "") => NextResponse.json({ ...(await loadDine(venueId)), message });
  const id = str(body.id, 40);

  try {
    switch (op) {
      case "load":
        return done();
      case "advance":
        await advanceDineOrder(venueId, id);
        return done();
      case "cancelOrder":
        await cancelDineOrder(venueId, id);
        return done("Đã huỷ lần gọi.");
      case "reqDone":
        await closeDineRequest(venueId, id);
        return done();
      case "pay": {
        const expect = Array.isArray(body.orderIds) ? body.orderIds.slice(0, 200).map((x) => str(x, 40)) : undefined;
        const total = await payDineTable(venueId, str(body.tableId, 40), body.method === "Chuyển khoản" ? "Chuyển khoản" : "Tiền mặt", who, expect);
        return done(`Đã thu ${total.toLocaleString("vi-VN")}đ · bàn trống lại.`);
      }

      // ---------- Thực đơn ----------
      case "menuPatch": {
        if (!(await prisma.ticketMenuItem.findFirst({ where: { id, venueId } }))) return bad("Món không tồn tại.");
        const data: Record<string, unknown> = {};
        if ("price" in body) data.price = Math.max(0, int(body.price));
        if ("hot" in body) data.hot = body.hot === true;
        if ("avail" in body) data.active = body.avail === true;
        if ("name" in body && str(body.name, 80)) data.name = str(body.name, 80);
        if ("group" in body) data.group = str(body.group, 40) || null;
        if ("desc" in body) data.description = str(body.desc, 160) || null;
        // Ảnh của món: danh sách (ảnh đầu là bìa), chỉ nhận tệp đã tải lên /uploads.
        if ("images" in body) {
          const list = Array.isArray(body.images) ? [...new Set(body.images.map((u) => str(u, 300)).filter(Boolean))] : [];
          // Nhận tệp đã tải lên (/uploads) và ảnh minh hoạ của dữ liệu mẫu (/hop-tac/demo/mon).
          if (list.some((u) => !/^\/(uploads|hop-tac\/demo\/mon)\/[\w.-]+$/.test(u))) return bad("Ảnh không hợp lệ.");
          if (list.length > DINE_MAX_IMAGES) return bad(`Mỗi món tối đa ${DINE_MAX_IMAGES} ảnh.`);
          data.images = list;
          data.imageUrl = list[0] ?? null;
        }
        await prisma.ticketMenuItem.update({ where: { id }, data });
        return done();
      }
      case "menuAdd": {
        const name = str(body.name, 80);
        const price = int(body.price);
        if (!name || price <= 0) return bad("Nhập tên món và giá.");
        await prisma.ticketMenuItem.create({ data: { venueId, name, price, group: str(body.group, 40) || null, description: str(body.desc, 160) || null } });
        return done("Đã thêm món.");
      }
      case "menuDelete":
        await prisma.ticketMenuItem.deleteMany({ where: { id, venueId } });
        return done("Đã xoá món.");

      // ---------- Bàn & mã QR ----------
      case "tableAdd": {
        const name = await addDineTable(venueId, str(body.zone, 40));
        return done(`Đã thêm bàn ${name}.`);
      }
      case "rotateQr": {
        // Chỉ chủ / quản trị; canManageVenue đã kiểm địa điểm thuộc chủ, rotateDineQr kiểm bàn thuộc địa điểm.
        if (session.role === "STAFF") return bad("Chỉ chủ quán đổi được mã QR.", 403);
        const r = await rotateDineQr(venueId, id);
        return NextResponse.json({ ...(await loadDine(venueId)), message: `Đã đổi mã QR bàn ${r.name} — in lại thẻ mới, thẻ cũ không dùng được nữa.`, rotated: id });
      }
      case "tableDelete": {
        if (await prisma.dineOrder.count({ where: { tableId: id, status: { in: ["new", "cooking", "served"] } } })) return bad("Bàn đang có món chưa thu tiền — thu tiền / dọn bàn trước khi xoá.");
        await deleteTable(venueId, id);
        return done("Đã xoá bàn.");
      }
      default:
        return bad("Thao tác không hợp lệ.");
    }
  } catch (e) {
    if (e instanceof TicketError) return bad(e.message);
    console.error("[dine]", op, e);
    return bad("Có lỗi khi xử lý, thử lại.", 500);
  }
}
