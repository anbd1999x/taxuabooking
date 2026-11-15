import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { SITE } from "@/lib/site";
import { getSettings } from "@/lib/queries";
import { bookingMessagesById } from "@/lib/booking-messages";
import { renderBookingEmail, type BookingEmailKind } from "@/lib/booking-email";

export const dynamic = "force-dynamic";

/**
 * Xem trước email gửi khách (HTML) — chỉ ADMIN. `?code=TX-XXXX` (mặc định: đơn mới nhất),
 * `?kind=received|confirmed`. Không gửi thư, chỉ dựng nội dung để kiểm tra trình bày.
 */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return NextResponse.json({ error: "Không có quyền." }, { status: 403 });
  const url = new URL(request.url);
  const code = url.searchParams.get("code")?.trim();
  const kind: BookingEmailKind = url.searchParams.get("kind") === "confirmed" ? "confirmed" : "received";
  const b = code
    ? await prisma.bookingRequest.findUnique({ where: { code }, select: { id: true } })
    : await prisma.bookingRequest.findFirst({ orderBy: { createdAt: "desc" }, select: { id: true } });
  const m = b ? await bookingMessagesById(b.id) : null;
  if (!m) return NextResponse.json({ error: "Không tìm thấy đơn." }, { status: 404 });
  const s = await getSettings();
  const mail = renderBookingEmail(kind, m.facts, {
    legalName: s.legalName || SITE.legalName,
    taxCode: s.taxCode || SITE.taxCode,
    legalAddress: s.legalAddress || SITE.legalAddress,
    siteUrl: SITE.url.includes("localhost") ? "https://taxuabooking.com" : SITE.url.replace(/\/$/, ""),
  });
  return new NextResponse(mail.html, { headers: { "Content-Type": "text/html; charset=utf-8", "X-Robots-Tag": "noindex" } });
}
