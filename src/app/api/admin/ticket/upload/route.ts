import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { canManageVenue } from "@/lib/ticket";
import { MAX_IMAGE_BYTES, processAndSaveMedia, resolveMediaType } from "@/lib/media";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Tải ảnh bìa địa điểm bán vé → { url }. Không gắn DB: tab Thiết lập tự lưu url khi bấm "Lưu thông tin". */
export async function POST(request: Request) {
  const session = await getSession();
  // Kiểm phiên + kích thước TRƯỚC khi đọc formData (Node đệm cả body vào RAM — người lạ gửi body lớn làm cạn RAM).
  if (!session || session.role === "STAFF" || session.role === "CTV") return NextResponse.json({ error: "Không có quyền." }, { status: 403 });
  // Thiếu Content-Length (body chunked) ⇒ 411, không đọc body không biết trước kích thước.
  if (!Number(request.headers.get("content-length") || "")) return NextResponse.json({ error: "Thiếu kích thước tệp — tải lại." }, { status: 411 });
  if (Number(request.headers.get("content-length")) > MAX_IMAGE_BYTES + 1024 * 1024) return NextResponse.json({ error: "Ảnh vượt quá 25MB." }, { status: 413 });
  let fd: FormData;
  try {
    fd = await request.formData();
  } catch {
    return NextResponse.json({ error: "Tệp quá lớn hoặc tải lên bị gián đoạn." }, { status: 400 });
  }
  if (!(await canManageVenue(session, String(fd.get("venueId") ?? "")))) return NextResponse.json({ error: "Không có quyền." }, { status: 403 });
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: "Chưa chọn tệp." }, { status: 400 });
  const mime = resolveMediaType(file.type, file.name);
  if (!mime.startsWith("image/")) return NextResponse.json({ error: "Chỉ nhận ảnh." }, { status: 400 });
  const res = await processAndSaveMedia({ buf: Buffer.from(await file.arrayBuffer()), mime, filename: file.name, standalone: true });
  if ("error" in res) return NextResponse.json({ error: res.error }, { status: res.status });
  return NextResponse.json({ url: res.url });
}
