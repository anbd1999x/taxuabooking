import { createHash } from "crypto";
import { recordServerAction } from "@/lib/visits";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDemoSession } from "@/lib/fleet-demo";
import { prisma } from "@/lib/prisma";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { TicketError, createTicketOrder, finalizeDraft, publicVenue, releaseDraft, sendTicketEmail } from "@/lib/ticket";
import { DRAFT_HOLD_MIN, PUBLIC_VENUE, isPublicVenue, normPhone } from "@/lib/ticket-core";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });
const str = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const int = (v: unknown) => {
  const n = parseInt(String(v ?? "").replace(/[^\d-]/g, ""), 10);
  return Number.isFinite(n) ? n : 0;
};
const arr = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v.slice(0, 80).map((x) => (x && typeof x === "object" ? (x as Record<string, unknown>) : {})) : []);

/** Tình trạng còn chỗ mới nhất của một địa điểm (trang đặt tự nạp lại ~20 giây/lần). */
export async function GET(request: Request) {
  // Khách đang xem bản demo (cookie demo) thấy được cả địa điểm demo chưa mở bán.
  const data = await publicVenue(new URL(request.url).searchParams.get("slug") ?? "", (await getDemoSession())?.sub);
  return data ? NextResponse.json({ avail: data.avail }) : bad("Không tìm thấy.", 404);
}

/**
 * Đặt vé / đặt bàn của khách — theo mẫu "Ban ve - Khach". Giá, quota và chỗ đều tính lại ở server.
 * - hold    (SHOW / RESTAURANT, bước "Giữ chỗ & tiếp tục"): giữ ghế / bàn 10 phút bằng đơn nháp; trả `hold` = khoá của đơn nháp.
 * - release : khách quay lại bước chọn chỗ ⇒ nhả đơn nháp.
 * - book    : gửi đơn. Có `hold` ⇒ chốt đơn nháp; vé cổng ⇒ tạo đơn chờ gọi xác nhận. Trả `token` để mở /ve/don/<token>.
 */
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return bad("Thiếu dữ liệu.");
  }
  const op = str(body.op, 10);
  const ip = clientIp(request);
  const slug = str(body.slug, 120);
  try {
    if (op === "release") {
      await releaseDraft(str(body.hold, 40));
      return NextResponse.json({ ok: true });
    }
    // Địa điểm đã mở bán — hoặc địa điểm demo (chưa mở bán) khi khách đang trong bản demo: đặt thử được, không gửi email.
    const demo = await getDemoSession();
    const v = await prisma.ticketVenue.findFirst({ where: { slug, ...(demo ? { OR: [{ ...PUBLIC_VENUE }, { ownerId: demo.sub }] } : PUBLIC_VENUE) }, select: { id: true, kind: true, published: true, review: true } });
    if (!v) return bad("Địa điểm này chưa mở bán.", 404);
    const preview = !isPublicVenue(v);
    const date = str(body.date, 10);
    const time = str(body.time, 5);

    if (op === "hold") {
      if (v.kind === "GATE") return bad("Vé cổng không cần giữ chỗ.");
      // Tần suất theo IP (bộ nhớ từng tiến trình) + giới hạn TỔNG chỗ đang giữ của IP tại địa điểm (đếm trong DB, xem capWebHolds):
      // một máy giữ tối đa một đơn tối đa — đổi lựa chọn (replace) hay tải lại trang thì nháp cũ của chính máy đó được nhả.
      if (!rateLimit(`tk-hold:${ip}`, 12, 10 * 60_000)) return bad("Bạn giữ chỗ quá nhiều lần liên tiếp. Chờ vài phút rồi thử lại.", 429);
      await releaseDraft(str(body.replace, 40));
      const holdKey = createHash("sha256").update(`tk-hold:${ip}`).digest("base64url").slice(0, 16);
      const o = await createTicketOrder({
        venueId: v.id, date, time, name: "", phone: "", source: "Web", mode: "draft", preview, holdKey, guests: int(body.guests) || undefined,
        seats: Array.isArray(body.seats) ? body.seats.slice(0, 20).map((k) => str(k, 4)) : [],
        tableIds: Array.isArray(body.tableIds) ? body.tableIds.slice(0, 20).map((k) => str(k, 40)) : [],
        tickets: arr(body.tickets).map((t) => ({ tierId: str(t.tierId, 40), qty: int(t.qty) })),
      });
      return NextResponse.json({ hold: o.token, holdUntil: Date.now() + DRAFT_HOLD_MIN * 60_000 });
    }

    if (op === "book") {
      if (!rateLimit(`tk-book:${ip}`, 5, 60_000)) return bad("Bạn gửi quá nhiều yêu cầu. Vui lòng thử lại sau ít phút.", 429);
      // TK-7: mỗi đơn chờ giữ quota / chỗ WEB_CONFIRM_MIN phút ⇒ thêm trần theo giờ, một IP không ôm hết quota vé cổng.
      if (!rateLimit(`tk-book-h:${ip}`, 12, 60 * 60_000)) return bad("Bạn đã gửi nhiều đơn trong giờ qua. Vui lòng gọi địa điểm hoặc thử lại sau.", 429);
      const name = str(body.name, 80);
      const phone = normPhone(str(body.phone, 24)); // TK-7: 84/+84/dấu chấm ⇒ cùng dạng 0xxxxxxxxx
      const email = str(body.email, 120);
      if (name.length < 2) return bad("Nhập họ tên.");
      if (!/^0\d{9}$/.test(phone)) return bad("Số điện thoại chưa đúng (10 số).");
      if (!/^\S+@\S+\.\S+$/.test(email)) return bad("Email chưa đúng, vé QR sẽ gửi về email này.");
      // CTV đang đăng nhập đặt hộ khách ⇒ gắn đơn cho CTV (như /api/bookings).
      const session = await getSession();
      const ctvId = session?.role === "CTV" ? session.sub : null;
      const arrive = str(body.arrive, 30);
      const note = [arrive ? `Giờ đến: ${arrive}` : "", str(body.note, 400)].filter(Boolean).join(" · ");
      const food = arr(body.food).map((f) => ({ menuId: str(f.menuId, 40), qty: int(f.qty), note: str(f.note, 120) }));
      const expectedTotal = body.expectedTotal == null ? undefined : int(body.expectedTotal);
      const common = { name, phone, email, note, food, expectedTotal, ctvId, source: ctvId ? "CTV" : "Web" };
      // TK-7: một SĐT chỉ có tối đa 2 đơn web đang chờ xác nhận tại một địa điểm (đơn chờ giữ quota / chỗ tới khi hết hạn). Bản demo đặt thử thoải mái.
      if (!ctvId && !preview && (await prisma.ticketOrder.count({ where: { venueId: v.id, phone, status: "wait", createdBy: null, holdUntil: { gt: new Date() } } })) >= 2)
        return bad("Số điện thoại này đang có 2 đơn chờ xác nhận ở đây — đợi địa điểm gọi lại hoặc gọi trực tiếp giúp mình nhé.", 429);
      const o =
        v.kind === "GATE"
          ? await createTicketOrder({ ...common, venueId: v.id, date, time: "", mode: "request", preview, tickets: arr(body.tickets).map((t) => ({ tierId: str(t.tierId, 40), qty: int(t.qty) })) })
          : await finalizeDraft({ ...common, token: str(body.hold, 40), slug, preview, guests: int(body.guests) || undefined });
      if (!preview) void recordServerAction(request, `/ve/${slug}`, `Gửi đơn ${v.kind === "RESTAURANT" ? "đặt bàn" : "mua vé"} thành công — mã ${o.code}`);
      if (!preview) void sendTicketEmail(o.id, "received"); // đơn đặt thử ở bản demo không gửi thư (sendTicketEmail cũng tự chặn địa điểm chưa mở bán)
      return NextResponse.json({ token: o.token, code: o.code });
    }
    return bad("Thao tác không hợp lệ.");
  } catch (e) {
    if (e instanceof TicketError) return bad(e.message, 409);
    console.error("[ticket-public]", op, e);
    return bad("Có lỗi khi xử lý, thử lại giúp mình.", 500);
  }
}
