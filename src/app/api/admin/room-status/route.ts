import { NextResponse } from "next/server";
import type { RoomStatus } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseDateOnly, isValidDateKey } from "@/lib/dates";
import { syncRoomTypeAvailability } from "@/lib/room-availability";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const STATUSES: RoomStatus[] = ["AVAILABLE", "BOOKED", "PENDING", "CLOSED"];
const STATUS_LABEL: Record<RoomStatus, string> = {
  AVAILABLE: "Trống",
  BOOKED: "Đã đặt",
  PENDING: "Chờ xác nhận",
  CLOSED: "Đóng",
};

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
  // ADMIN toàn quyền; PROVIDER chỉ thao tác phòng thuộc dịch vụ của mình (kiểm tra bên dưới).
  if (session.role !== "ADMIN" && session.role !== "PROVIDER") {
    return NextResponse.json({ error: "Không có quyền." }, { status: 403 });
  }

  let body: { roomId?: string; date?: string; status?: string; force?: boolean };
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

  // Ngày đang được GIỮ bởi một đơn thật → KHÔNG khoá, nhưng phải cảnh báo tình trạng hiện tại;
  // client hỏi lại, đồng ý thì gửi kèm force=true để ghi đè (ô thành khoá tay, đơn vẫn giữ nguyên).
  const existing = await prisma.roomDayStatus.findUnique({
    where: { roomId_date: { roomId, date: d } },
  });
  if (existing?.bookingId) {
    const bk = await prisma.bookingRequest.findUnique({
      where: { id: existing.bookingId },
      select: { id: true, code: true, customerName: true, phone: true },
    });
    if (bk && body.force !== true) {
      const dmy = `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}`;
      return NextResponse.json(
        {
          needConfirm: true,
          error:
            `Phòng ${room.name} ngày ${dmy} hiện đang "${STATUS_LABEL[existing.status]}" — ` +
            `do đơn ${bk.code} (${bk.customerName} · ${bk.phone}) giữ chỗ.\n\n` +
            `Đổi sang "${STATUS_LABEL[status as RoomStatus]}" sẽ ghi đè lên tình trạng này; đơn ${bk.code} vẫn giữ nguyên trạng thái ` +
            `(nếu khách không ở nữa, hãy huỷ/sửa đơn ở mục "Yêu cầu đặt").\n\nVẫn ghi đè?`,
        },
        { status: 409 },
      );
    }
    if (bk) {
      // Để lại dấu vết trong nhật ký đơn: ai đã sửa tay ô đang do đơn giữ.
      await prisma.bookingLog.create({
        data: {
          bookingId: bk.id,
          kind: "SYSTEM",
          title: "Sửa tay tình trạng phòng",
          body: `Phòng ${room.name} ngày ${date}: ${STATUS_LABEL[existing.status]} → ${STATUS_LABEL[status as RoomStatus]} (ghi đè ô do đơn giữ chỗ)`,
          by: session.name || session.username || "Admin",
        },
      });
    }
  }

  if (status === "AVAILABLE") {
    // Trống = xoá bản ghi (mặc định không có bản ghi là trống).
    await prisma.roomDayStatus.deleteMany({ where: { roomId, date: d } });
  } else {
    await prisma.roomDayStatus.upsert({
      where: { roomId_date: { roomId, date: d } },
      create: { roomId, date: d, status: status as RoomStatus },
      // note: null → ô thành KHOÁ TAY. LƯU Ý: homestay có link sheet/API thì SHEET LÀ CHUẨN —
      // lần đồng bộ sau sẽ ghi đè khoá tay ở những ngày sheet có phủ (muốn khoá lâu dài: ghi vào sheet).
      update: { status: status as RoomStatus, bookingId: null, note: null },
    });
  }

  await syncRoomTypeAvailability(room.roomTypeId, d);
  return NextResponse.json({ ok: true });
}
