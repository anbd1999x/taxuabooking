import { NextResponse } from "next/server";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { isValidDineProof } from "@/lib/dine-proof";
import { TicketError } from "@/lib/ticket";
import { cleanGuest } from "@/lib/dine-core";
import { isLocale } from "@/lib/i18n/config";
import { dineTrMap } from "@/lib/dine-tr";
import { cancelDineOrderByGuest, claimDinePaid, createDineOrder, createDineRequest, dineCustomerState, tableForQrGuarded } from "@/lib/dine";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });
const str = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const BAD_MSG = "Mã QR không hợp lệ. Quét lại mã dán trên bàn.";

/** Trạng thái bàn cho điện thoại khách (thực đơn, món đã gọi, hoá đơn) — trang /qr tự nạp lại vài giây một lần. */
export async function GET(request: Request) {
  const p = new URL(request.url).searchParams;
  const q = await tableForQrGuarded(clientIp(request), p.get("v") ?? "", p.get("t") ?? "", p.get("k") ?? "");
  if (!q) return bad(BAD_MSG, 404);
  const state = await dineCustomerState(q);
  // `l=<en|zh|ko>&tr=1`: kèm bản dịch (bảng Translation, tra theo chuỗi gốc) của tên quán / nhóm món / tên món / mô tả /
  // món đã gọi — trang khách gọi khi đổi ngôn ngữ hoặc thực đơn đổi, lần nạp lại 5 giây thường KHÔNG kèm.
  const l = p.get("l");
  if (!p.get("tr") || !isLocale(l) || l === "vi") return NextResponse.json(state);
  // Bản dịch chủ quán tự nhập ở tab Thực đơn đè lên kho dịch chung của web (dineTrMap).
  const tr = await dineTrMap(q.venueId, l, [state.venue, ...state.menu.flatMap((m) => [m.name, m.group, m.desc]), ...state.orders.flatMap((o) => o.items.map((it) => it.name))]);
  return NextResponse.json({ ...state, tr });
}

/**
 * Khách tại bàn: op `order` (gửi món cho bếp) · `cancel` (huỷ lần gọi khi bếp chưa bắt đầu làm) · `staff` (gọi nhân viên) ·
 * `pay` (xin thanh toán, method Tiền mặt | Chuyển khoản) · `claim` (báo ĐÃ chuyển khoản, kèm `proof` = url ảnh bill từ /api/qr/proof).
 * Chỉ nhận khi có đúng khoá của mã QR dán ở bàn; giới hạn tần suất theo IP + bàn. Trả lại trạng thái mới của bàn.
 */
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return bad("Thiếu dữ liệu.");
  }
  const q = await tableForQrGuarded(clientIp(request), str(body.v, 120), str(body.t, 20), str(body.k, 16));
  if (!q) return bad(BAD_MSG, 404);
  const op = str(body.op, 10);
  if (!rateLimit(`qr-${op}:${clientIp(request)}:${q.table.id}`, op === "order" ? 6 : 4, 60_000)) return bad("Bạn thao tác hơi nhanh. Chờ một chút rồi thử lại.", 429);
  try {
    let message = "";
    if (op === "order") {
      const items = Array.isArray(body.items)
        ? body.items.slice(0, 60).map((x) => {
            const r = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
            return { menuId: str(r.menuId, 40), qty: Math.round(Number(r.qty)) || 0, note: str(r.note, 120) };
          })
        : [];
      const o = await createDineOrder({ venueId: q.venueId, tableId: q.table.id, items, note: str(body.note, 300), guest: cleanGuest(body.guest) });
      message = `Đã gửi ${o.qty} món tới bếp`;
    } else if (op === "cancel") {
      await cancelDineOrderByGuest(q.venueId, q.table.id, str(body.orderId, 40));
      message = "Đã huỷ lần gọi món";
    } else if (op === "claim") {
      const proof = str(body.proof, 200);
      // Chỉ nhận ảnh do /api/qr/proof vừa cấp cho CHÍNH bàn này (không nhận tệp /uploads bất kỳ).
      if (proof && !(await isValidDineProof(q.table.id, proof))) return bad("Ảnh bill không hợp lệ — tải lại ảnh.");
      await claimDinePaid(q, proof || null);
      message = "Đã gửi xác nhận chuyển khoản · chờ quán kiểm tra";
    } else if (op === "staff") {
      await createDineRequest({ venueId: q.venueId, tableId: q.table.id, kind: "staff", note: str(body.need, 80) });
      message = `Đã gọi nhân viên tới bàn ${q.table.name}`;
    } else if (op === "pay") {
      await createDineRequest({ venueId: q.venueId, tableId: q.table.id, kind: "pay", method: str(body.method, 20) });
    } else return bad("Thao tác không hợp lệ.");
    return NextResponse.json({ ...(await dineCustomerState(q)), message });
  } catch (e) {
    if (e instanceof TicketError) return bad(e.message, 409);
    console.error("[qr]", op, e);
    return bad("Có lỗi khi xử lý, thử lại giúp mình.", 500);
  }
}
