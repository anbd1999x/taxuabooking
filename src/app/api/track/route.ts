import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { ensureGeo, recordVisit } from "@/lib/visits";
import { getCustomer } from "@/lib/customer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const VISITOR_COOKIE = "tx_vid";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365 * 2; // 2 năm

/** Bỏ qua bot/crawler phổ biến để số liệu gần với người thật. */
const BOT_RE = /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|whatsapp|telegram|curl|wget|python-requests|headless/i;

/** IP thật của khách (qua proxy nginx / Cloudflare). */
function clientIp(request: NextRequest): string | null {
  const cf = request.headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const real = request.headers.get("x-real-ip");
  if (real) return real.trim();
  return null;
}

/** Chỉ ghi nhật ký cho trang công khai (bỏ api, _next, admin). */
function trackablePath(p: string): boolean {
  if (!p.startsWith("/")) return false;
  if (p.startsWith("/api") || p.startsWith("/_next") || p.startsWith("/admin")) return false;
  return true;
}

/** Ghi nhận 1 lượt xem trang từ website công khai (gọi bởi VisitTracker). */
export async function POST(request: NextRequest) {
  const ua = request.headers.get("user-agent") ?? "";
  if (!ua || BOT_RE.test(ua)) return new NextResponse(null, { status: 204 });

  let body: { path?: string; referrer?: string } = {};
  try {
    body = await request.json();
  } catch {
    /* body rỗng — bỏ qua, vẫn đếm tổng */
  }
  const path = typeof body.path === "string" && trackablePath(body.path) ? body.path.slice(0, 512) : "/";
  const referrer = typeof body.referrer === "string" ? body.referrer.slice(0, 512) : null;

  let vid = request.cookies.get(VISITOR_COOKIE)?.value;
  const isNew = !vid || !/^[0-9a-f-]{36}$/i.test(vid);
  if (isNew) vid = randomUUID();

  const ip = clientIp(request);
  const customer = await getCustomer().catch(() => null);

  try {
    await recordVisit({
      visitorId: vid!,
      path,
      referrer,
      ip,
      userAgent: ua,
      customerId: customer?.id ?? null,
      customerName: customer?.name ?? null,
    });
    // Tra cứu khu vực theo IP (không chặn phản hồi cho khách).
    void ensureGeo(ip);
  } catch {
    // Lỗi DB không được làm hỏng trải nghiệm khách — bỏ qua.
  }

  const res = new NextResponse(null, { status: 204 });
  if (isNew) {
    res.cookies.set(VISITOR_COOKIE, vid!, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: COOKIE_MAX_AGE,
    });
  }
  return res;
}
