import { NextResponse } from "next/server";
import { ensureServiceSheetFresh } from "@/lib/sheet-sync";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Làm tươi tình trạng phòng của MỘT homestay ngay trước khi khách đặt.
 * Có chốt chặn 60s trong ensureServiceSheetFresh (vừa đồng bộ thì bỏ qua) nên
 * gọi nhiều lần cũng không cào Google liên tục; thêm rate-limit nhẹ theo IP.
 */
export async function POST(request: Request) {
  if (!rateLimit(`sheet-ensure:${clientIp(request)}`, 20, 60_000)) {
    return NextResponse.json({ skipped: true, reason: "rate-limited" });
  }
  const body = (await request.json().catch(() => null)) as { serviceId?: string } | null;
  const serviceId = body?.serviceId;
  if (!serviceId) return NextResponse.json({ error: "Thiếu serviceId." }, { status: 400 });
  try {
    const r = await ensureServiceSheetFresh(serviceId, 60_000);
    return NextResponse.json(r);
  } catch {
    // Lỗi đồng bộ không được chặn luồng đặt.
    return NextResponse.json({ synced: false, skipped: true, reason: "error" });
  }
}
