import { NextResponse } from "next/server";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { TicketError } from "@/lib/ticket";
import { createDineOrder, createDineRequest, dineCustomerState, tableForQrGuarded } from "@/lib/dine";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });
const str = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const BAD_MSG = "Mã QR không hợp lệ. Quét lại mã dán trên bàn.";

/** Trạng thái bàn cho điện thoại khách (thực đơn, món đã gọi, hoá đơn) — trang /qr tự nạp lại vài giây một lần. */
export async function GET(request: Request) {
  const p = new URL(request.url).searchParams;
  const q = await tableForQrGuarded(clientIp(request), p.get("v") ?? "", p.get("t") ?? "", p.get("k") ?? "");
  return q ? NextResponse.json(await dineCustomerState(q)) : bad(BAD_MSG, 404);
}

/**
 * Khách tại bàn: op `order` (gửi món cho bếp) · `staff` (gọi nhân viên) · `pay` (xin thanh toán, method Tiền mặt | Chuyển khoản).
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
      const o = await createDineOrder({ venueId: q.venueId, tableId: q.table.id, items, note: str(body.note, 300) });
      message = `Đã gửi ${o.qty} món tới bếp`;
    } else if (op === "staff") {
      await createDineRequest({ venueId: q.venueId, tableId: q.table.id, kind: "staff" });
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
