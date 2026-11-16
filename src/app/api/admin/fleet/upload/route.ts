import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { canManageFleet } from "@/lib/fleet";
import { MAX_VIDEO_BYTES, processAndSaveMedia, resolveMediaType } from "@/lib/media";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Tải ảnh / video cho đội xe (ảnh xe, video xe, ảnh biên bản giao xe) → { url, type }.
 * Không gắn DB: giao diện tự lưu url vào xe/biên bản. Đường dẫn này được loại khỏi proxy
 * (src/proxy.ts) để không bị giới hạn kích thước body của proxy khi tải video.
 */
export async function POST(request: Request) {
  const session = await getSession();
  let fd: FormData;
  try {
    fd = await request.formData();
  } catch {
    return NextResponse.json({ error: "Tệp quá lớn hoặc tải lên bị gián đoạn." }, { status: 400 });
  }
  const serviceId = String(fd.get("serviceId") ?? "");
  if (!(await canManageFleet(session, serviceId))) return NextResponse.json({ error: "Không có quyền." }, { status: 403 });
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: "Chưa chọn tệp." }, { status: 400 });
  const mime = resolveMediaType(file.type, file.name);
  const isVideo = mime.startsWith("video/");
  if (!mime.startsWith("image/") && !isVideo) return NextResponse.json({ error: "Chỉ nhận ảnh hoặc video." }, { status: 400 });
  if (isVideo && fd.get("imageOnly")) return NextResponse.json({ error: "Chỗ này chỉ nhận ảnh." }, { status: 400 });
  if (isVideo && file.size > MAX_VIDEO_BYTES) {
    return NextResponse.json({ error: `Video vượt quá ${Math.round(MAX_VIDEO_BYTES / 1048576)}MB.` }, { status: 400 });
  }
  const res = await processAndSaveMedia({ buf: Buffer.from(await file.arrayBuffer()), mime, filename: file.name, standalone: true });
  if ("error" in res) return NextResponse.json({ error: res.error }, { status: res.status });
  return NextResponse.json({ url: res.url, type: isVideo ? "video" : "image" });
}
