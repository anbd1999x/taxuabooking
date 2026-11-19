import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDemoSession } from "@/lib/fleet-demo";
import { prisma } from "@/lib/prisma";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { TicketError, createTicketOrder, finalizeDraft, publicVenue, releaseDraft, sendTicketEmail } from "@/lib/ticket";
import { DRAFT_HOLD_MIN } from "@/lib/ticket-core";

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
    const v = await prisma.ticketVenue.findFirst({ where: { slug, ...(demo ? { OR: [{ published: true }, { ownerId: demo.sub }] } : { published: true }) }, select: { id: true, kind: true, published: true } });
    if (!v) return bad("Địa điểm này chưa mở bán.", 404);
    const preview = !v.published;
    const date = str(body.date, 10);
    const time = str(body.time, 5);

    if (op === "hold") {
      if (v.kind === "GATE") return bad("Vé cổng không cần giữ chỗ.");
      // Mỗi lần giữ là một lượt chiếm ghế 10 phút ⇒ giới hạn chặt theo IP.
      if (!rateLimit(`tk-hold:${ip}`, 8, 10 * 60_000)) return bad("Bạn giữ chỗ quá nhiều lần liên tiếp. Chờ vài phút rồi thử lại.", 429);
      await releaseDraft(str(body.replace, 40));
      const o = await createTicketOrder({
        venueId: v.id, date, time, name: "", phone: "", source: "Web", mode: "draft", preview, guests: int(body.guests) || undefined,
        seats: Array.isArray(body.seats) ? body.seats.slice(0, 20).map((k) => str(k, 4)) : [],
        tableIds: Array.isArray(body.tableIds) ? body.tableIds.slice(0, 20).map((k) => str(k, 40)) : [],
        tickets: arr(body.tickets).map((t) => ({ tierId: str(t.tierId, 40), qty: int(t.qty) })),
      });
      return NextResponse.json({ hold: o.token, holdUntil: Date.now() + DRAFT_HOLD_MIN * 60_000 });
    }

    if (op === "book") {
      if (!rateLimit(`tk-book:${ip}`, 5, 60_000)) return bad("Bạn gửi quá nhiều yêu cầu. Vui lòng thử lại sau ít phút.", 429);
      const name = str(body.name, 80);
      const phone = str(body.phone, 20).replace(/\s/g, "");
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
      const o =
        v.kind === "GATE"
          ? await createTicketOrder({ ...common, venueId: v.id, date, time: "", mode: "request", preview, tickets: arr(body.tickets).map((t) => ({ tierId: str(t.tierId, 40), qty: int(t.qty) })) })
          : await finalizeDraft({ ...common, token: str(body.hold, 40), slug, guests: int(body.guests) || undefined });
      if (!preview) void sendTicketEmail(o.id, "received"); // đơn đặt thử ở bản demo không gửi thư
      return NextResponse.json({ token: o.token, code: o.code });
    }
    return bad("Thao tác không hợp lệ.");
  } catch (e) {
    if (e instanceof TicketError) return bad(e.message, 409);
    console.error("[ticket-public]", op, e);
    return bad("Có lỗi khi xử lý, thử lại giúp mình.", 500);
  }
}
