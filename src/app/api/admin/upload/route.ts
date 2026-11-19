import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { guard, isSelfSignupProvider, serviceIdOfRoom, serviceIdOfRoomType } from "@/lib/partner-access";
import { MAX_VIDEO_BYTES, processAndSaveMedia, resolveMediaType } from "@/lib/media";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
  }
  // Chủ homestay tự đăng ký: được tải ảnh cho homestay CỦA MÌNH (kiểm sở hữu sau khi đọc form).
  const partner = session.role !== "ADMIN" && (await isSelfSignupProvider(session));
  if (session.role !== "ADMIN" && !partner) {
    return NextResponse.json({ error: "Không có quyền." }, { status: 403 });
  }

  // Chặn body quá lớn trước khi đọc formData (Node đệm cả body vào RAM).
  // Thiếu Content-Length (body chunked) ⇒ 411, không đọc body không biết trước kích thước.
  if (!Number(request.headers.get("content-length") || "")) return NextResponse.json({ error: "Thiếu kích thước tệp — tải lại." }, { status: 411 });
  if (Number(request.headers.get("content-length")) > MAX_VIDEO_BYTES + 1024 * 1024) {
    return NextResponse.json({ error: "Tệp quá lớn." }, { status: 413 });
  }
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Tệp quá lớn hoặc tải lên bị gián đoạn." }, { status: 400 });
  }
  const serviceId = form.get("serviceId");
  const roomTypeId = form.get("roomTypeId");
  const roomId = form.get("roomId");
  const file = form.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Thiếu tệp." }, { status: 400 });
  }
  if (partner) {
    const str = (v: FormDataEntryValue | null) => (typeof v === "string" && v ? v : null);
    const sid = str(serviceId), rtId = str(roomTypeId), rmId = str(roomId);
    // Phải gắn vào homestay / hạng / phòng của mình; không cho tải tệp lẻ (standalone).
    if (form.get("standalone") === "1" || (!sid && !rtId && !rmId)) return NextResponse.json({ error: "Không có quyền." }, { status: 403 });
    try {
      const ids: (string | null)[] = [];
      if (sid) ids.push(sid);
      if (rtId) ids.push(await serviceIdOfRoomType(rtId));
      if (rmId) ids.push(await serviceIdOfRoom(rmId));
      await guard(...ids);
    } catch {
      return NextResponse.json({ error: "Không có quyền." }, { status: 403 });
    }
  }

  const result = await processAndSaveMedia({
    buf: Buffer.from(await file.arrayBuffer()),
    mime: resolveMediaType(file.type, file.name),
    filename: file.name,
    serviceId: typeof serviceId === "string" ? serviceId : null,
    roomTypeId: typeof roomTypeId === "string" ? roomTypeId : null,
    roomId: typeof roomId === "string" ? roomId : null,
    // standalone=1: chỉ lưu file & trả url (vd ảnh bìa bài viết), không gắn DB.
    standalone: form.get("standalone") === "1",
  });

  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ url: result.url }, { status: 201 });
}
