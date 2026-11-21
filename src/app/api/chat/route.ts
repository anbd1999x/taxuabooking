import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { CHAT_COOKIE, cleanBody, cleanLine, guestProfile, guestSeen, guestSend, guestThread, validToken } from "@/lib/chat";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { isIpBlocked } from "@/lib/ip-block";

export const dynamic = "force-dynamic";

/**
 * Chat trực tiếp với admin — phía KHÁCH (khung chat desktop).
 *   GET  /api/chat?after=<ISO>  → { thread, messages } của cookie tx_chat (chưa nhắn gì ⇒ thread null)
 *   POST { op: "send", body, page?, locale?, name?, phone? }  → tạo cuộc chat nếu chưa có (đặt cookie) + gửi tin
 *   POST { op: "profile", name, phone }  ·  POST { op: "seen" }
 */

const COOKIE_MAX_AGE = 180 * 24 * 3600;

async function tokenOf(): Promise<string | null> {
  const v = (await cookies()).get(CHAT_COOKIE)?.value;
  return validToken(v) ? v : null;
}

export async function GET(request: Request) {
  const token = await tokenOf();
  if (!token) return NextResponse.json({ thread: null, messages: [] }, { headers: { "Cache-Control": "no-store" } });
  if (!rateLimit(`chat-get:${clientIp(request)}`, 120, 60_000)) return NextResponse.json({ error: "Thử lại sau ít phút." }, { status: 429 });
  const after = new URL(request.url).searchParams.get("after");
  const t = await guestThread(token, after);
  if (!t) return NextResponse.json({ thread: null, messages: [] }, { headers: { "Cache-Control": "no-store" } });
  const { messages, ...thread } = t;
  return NextResponse.json({ thread, messages }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const ip = clientIp(request);
  let data: Record<string, unknown>;
  try {
    data = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
  }
  const token = await tokenOf();
  const op = data.op;

  if (op === "seen") {
    if (token) await guestSeen(token);
    return NextResponse.json({ ok: true });
  }

  if (op === "profile") {
    if (!token) return NextResponse.json({ error: "Chưa có cuộc trò chuyện." }, { status: 400 });
    if (!rateLimit(`chat-profile:${ip}`, 10, 10 * 60_000)) return NextResponse.json({ error: "Thử lại sau ít phút." }, { status: 429 });
    const phone = cleanLine(data.phone, 20);
    if (phone && !/^[+0-9 .()-]{8,20}$/.test(phone)) return NextResponse.json({ error: "Số điện thoại chưa đúng." }, { status: 400 });
    await guestProfile(token, cleanLine(data.name, 60), phone);
    return NextResponse.json({ ok: true });
  }

  if (op !== "send") return NextResponse.json({ error: "Thao tác không hợp lệ." }, { status: 400 });
  const body = cleanBody(data.body);
  if (!body) return NextResponse.json({ error: "Tin nhắn trống." }, { status: 400 });
  if (await isIpBlocked(ip)) return NextResponse.json({ error: "Không gửi được tin nhắn." }, { status: 403 });
  // 15 tin / 5 phút / IP và mới tạo tối đa 5 cuộc chat / giờ / IP (chống spam).
  if (!rateLimit(`chat-send:${ip}`, 15, 5 * 60_000)) return NextResponse.json({ error: "Bạn nhắn hơi nhanh — đợi chút rồi gửi tiếp nhé." }, { status: 429 });
  if (!token && !rateLimit(`chat-new:${ip}`, 5, 60 * 60_000)) return NextResponse.json({ error: "Bạn nhắn hơi nhanh — đợi chút rồi gửi tiếp nhé." }, { status: 429 });

  const page = cleanLine(data.page, 300);
  const vid = /(?:^|;\s*)tx_vid=([0-9a-f-]{36})/i.exec(request.headers.get("cookie") ?? "")?.[1] ?? null;
  const phone = cleanLine(data.phone, 20);
  const r = await guestSend({
    token,
    body,
    page: page && page.startsWith("/") ? page : null,
    locale: cleanLine(data.locale, 5),
    ip,
    visitorId: vid,
    name: cleanLine(data.name, 60),
    phone: phone && /^[+0-9 .()-]{8,20}$/.test(phone) ? phone : null,
  });
  const res = NextResponse.json({ ok: true, message: r.message });
  if (r.created || r.token !== token) {
    res.cookies.set(CHAT_COOKIE, r.token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: COOKIE_MAX_AGE });
  }
  return res;
}
