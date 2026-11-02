import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { syncServiceSheet } from "@/lib/sheet-sync";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Đồng bộ lịch phòng từ Google Sheet cho MỘT homestay — gọi lặp từ nút
 * "Đồng bộ tất cả" (SheetSyncAll) để mỗi request ngắn, không vượt timeout proxy.
 * ADMIN đồng bộ mọi homestay; PROVIDER chỉ homestay của mình.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
  if (session.role !== "ADMIN" && session.role !== "PROVIDER") {
    return NextResponse.json({ error: "Không có quyền." }, { status: 403 });
  }

  let body: { serviceId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
  }
  const serviceId = body.serviceId?.trim();
  if (!serviceId) return NextResponse.json({ error: "Thiếu homestay." }, { status: 400 });

  const service = await prisma.service.findUnique({
    where: { id: serviceId },
    select: { ownerId: true, category: true, sheetUrl: true },
  });
  if (!service) return NextResponse.json({ error: "Homestay không tồn tại." }, { status: 404 });
  if (session.role === "PROVIDER" && service.ownerId !== session.sub) {
    return NextResponse.json({ error: "Homestay không thuộc tài khoản của bạn." }, { status: 403 });
  }
  if (service.category !== "HOMESTAY" && service.category !== "BUNGALOW") {
    return NextResponse.json({ error: "Dịch vụ này không phải homestay." }, { status: 400 });
  }
  if (!service.sheetUrl) return NextResponse.json({ error: "Chưa có link Google Sheet." }, { status: 400 });

  const r = await syncServiceSheet(serviceId);
  if (!r.ok) return NextResponse.json({ ok: false, error: r.error || "Đồng bộ thất bại." }, { status: 200 });
  return NextResponse.json({
    ok: true,
    summary: r.summary,
    unmatchedRows: r.unmatchedRows,
    missingRooms: r.missingRooms,
  });
}
