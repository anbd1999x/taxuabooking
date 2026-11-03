import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { recordVisit } from "@/lib/visits";

export const dynamic = "force-dynamic";

const VISITOR_COOKIE = "tx_vid";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365 * 2; // 2 năm

/** Bỏ qua bot/crawler phổ biến để số liệu gần với người thật. */
const BOT_RE = /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|whatsapp|telegram|curl|wget|python-requests|headless/i;

/** Ghi nhận 1 lượt xem trang từ website công khai (gọi bởi VisitTracker). */
export async function POST(request: NextRequest) {
  const ua = request.headers.get("user-agent") ?? "";
  if (!ua || BOT_RE.test(ua)) return new NextResponse(null, { status: 204 });

  let vid = request.cookies.get(VISITOR_COOKIE)?.value;
  const isNew = !vid || !/^[0-9a-f-]{36}$/i.test(vid);
  if (isNew) vid = randomUUID();

  try {
    await recordVisit(vid!);
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
