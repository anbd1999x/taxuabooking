import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Địa chỉ từ toạ độ qua OpenStreetMap Nominatim (miễn phí, ≤1 req/s — đủ cho lượng khách hiện tại). */
async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&accept-language=vi`,
      {
        headers: { "User-Agent": "TaXuaBooking/1.0 (+https://taxuabooking.com)" },
        signal: AbortSignal.timeout(8000),
        cache: "no-store",
      },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { display_name?: string };
    return data.display_name?.slice(0, 500) ?? null;
  } catch {
    return null;
  }
}

/**
 * Ghi VỊ TRÍ THẬT của khách (GPS trình duyệt) — chỉ được gọi sau khi khách bấm
 * "Cho phép" chia sẻ vị trí (`LocationPrompt`). Gắn vào khách theo cookie tx_vid.
 */
export async function POST(request: NextRequest) {
  if (!rateLimit(`loc:${clientIp(request)}`, 10, 60_000)) return new NextResponse(null, { status: 429 });
  const vid = request.cookies.get("tx_vid")?.value;
  if (!vid || !/^[0-9a-f-]{36}$/i.test(vid)) return new NextResponse(null, { status: 204 });

  let body: { lat?: unknown; lng?: unknown; accuracy?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  const lat = Number(body.lat);
  const lng = Number(body.lng);
  const acc = Number(body.accuracy);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return new NextResponse(null, { status: 400 });
  }
  const accuracy = Number.isFinite(acc) && acc >= 0 ? Math.min(acc, 1_000_000) : null;

  const visitor = await prisma.visitor.findUnique({ where: { id: vid }, select: { lat: true, lng: true, locAddress: true } });
  if (!visitor) return new NextResponse(null, { status: 204 });

  // Chỉ dịch lại địa chỉ khi vị trí đổi đáng kể (~>100m) để tiết kiệm lượt gọi Nominatim.
  const moved =
    visitor.lat == null || visitor.lng == null || Math.abs(visitor.lat - lat) > 0.001 || Math.abs(visitor.lng - lng) > 0.001;
  const address = moved || !visitor.locAddress ? await reverseGeocode(lat, lng) : visitor.locAddress;

  await prisma.visitor
    .update({
      where: { id: vid },
      data: { lat, lng, locAccuracy: accuracy, locAddress: address, locAt: new Date() },
    })
    .catch(() => {});
  return new NextResponse(null, { status: 204 });
}
