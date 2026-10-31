import { NextResponse } from "next/server";
import type { RoomStatus } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseDateOnly, isValidDateKey } from "@/lib/dates";
import { syncRoomTypeAvailability } from "@/lib/room-availability";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const STATUSES: RoomStatus[] = ["AVAILABLE", "BOOKED", "PENDING", "CLOSED"];

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
  // ADMIN toàn quyền; PROVIDER chỉ thao tác phòng thuộc dịch vụ của mình (kiểm tra bên dưới).
  if (session.role !== "ADMIN" && session.role !== "PROVIDER") {
    return NextResponse.json({ error: "Không có quyền." }, { status: 403 });
  }

  let body: { roomId?: string; date?: string; status?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
  }
  const { roomId, date, status } = body;
  if (!roomId || !date || !isValidDateKey(date) || !status || !STATUSES.includes(status as RoomStatus)) {
    return NextResponse.json({ error: "Thiếu hoặc sai tham số." }, { status: 400 });
  }

  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: { roomType: { select: { service: { select: { ownerId: true } } } } },
  });
  if (!room) return NextResponse.json({ error: "Phòng không tồn tại." }, { status: 404 });
  if (session.role === "PROVIDER" && room.roomType.service.ownerId !== session.sub) {
    return NextResponse.json({ error: "Phòng không thuộc dịch vụ của bạn." }, { status: 403 });
  }

  const d = parseDateOnly(date);

  // Ngày đang được GIỮ bởi một đơn thật → không cho sửa tay (dễ gây lệch tồn kho).
  // Muốn đổi, hãy huỷ / sửa đơn ở mục "Yêu cầu đặt".
  const existing = await prisma.roomDayStatus.findUnique({
    where: { roomId_date: { roomId, date: d } },
  });
  if (existing?.bookingId) {
    const bk = await prisma.bookingRequest.findUnique({
      where: { id: existing.bookingId },
      select: { code: true },
    });
    return NextResponse.json(
      { error: `Ngày này do đơn ${bk?.code ?? "đã đặt"} giữ chỗ — hãy huỷ/sửa đơn đó thay vì sửa tay.` },
      { status: 409 },
    );
  }

  if (status === "AVAILABLE") {
    // Trống = xoá bản ghi (mặc định không có bản ghi là trống).
    await prisma.roomDayStatus.deleteMany({ where: { roomId, date: d } });
  } else {
    await prisma.roomDayStatus.upsert({
      where: { roomId_date: { roomId, date: d } },
      create: { roomId, date: d, status: status as RoomStatus },
      update: { status: status as RoomStatus, bookingId: null },
    });
  }

  await syncRoomTypeAvailability(room.roomTypeId, d);
  return NextResponse.json({ ok: true });
}
