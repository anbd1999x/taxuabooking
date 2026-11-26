import { NextResponse } from "next/server";
import { getCustomer } from "@/lib/customer";
import { processAndSaveMedia, resolveMediaType } from "@/lib/media";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_IMAGE = 10 * 1024 * 1024; // 10MB
const MAX_VIDEO = 50 * 1024 * 1024; // 50MB
const VIDEO_TYPES = new Set(["video/mp4", "video/quicktime", "video/webm", "video/x-m4v"]);

// Giới hạn tần suất theo tài khoản: 12 tệp / 10 phút (bộ nhớ tiến trình — đủ chặn spam ổ đĩa).
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 12;
const hits = new Map<string, number[]>();
function limited(id: string): boolean {
  const now = Date.now();
  const list = (hits.get(id) ?? []).filter((t) => now - t < WINDOW_MS);
  if (list.length >= MAX_PER_WINDOW) {
    hits.set(id, list);
    return true;
  }
  list.push(now);
  hits.set(id, list);
  if (hits.size > 2000) for (const [k, v] of hits) if (!v.some((t) => now - t < WINDOW_MS)) hits.delete(k);
  return false;
}

// Khách đã đăng nhập tải ảnh / video đính kèm góp ý (không gắn DB — url trả về gửi kèm form góp ý).
export async function POST(request: Request) {
  const customer = await getCustomer();
  if (!customer) {
    return NextResponse.json({ error: "Bạn cần đăng nhập." }, { status: 401 });
  }

  // Chặn body quá lớn trước khi đọc formData (Node đệm cả body vào RAM).
  // Thiếu Content-Length (body chunked) ⇒ 411, không đọc body không biết trước kích thước.
  if (!Number(request.headers.get("content-length") || "")) return NextResponse.json({ error: "Thiếu kích thước tệp — tải lại." }, { status: 411 });
  if (Number(request.headers.get("content-length")) > MAX_VIDEO + 64 * 1024) {
    return NextResponse.json({ error: "Tệp vượt quá 50MB." }, { status: 413 });
  }
  if (limited(customer.id)) {
    return NextResponse.json({ error: "Bạn tải lên hơi nhiều — thử lại sau ít phút." }, { status: 429 });
  }
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Tệp quá lớn hoặc tải lên bị gián đoạn." }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Thiếu tệp." }, { status: 400 });
  }
  const mime = resolveMediaType(file.type, file.name);
  const isVideo = VIDEO_TYPES.has(mime);
  if (!isVideo && !mime.startsWith("image/")) {
    return NextResponse.json({ error: "Chỉ nhận ảnh hoặc video (MP4, MOV, WebM)." }, { status: 400 });
  }
  if (isVideo && file.size > MAX_VIDEO) {
    return NextResponse.json({ error: "Video vượt quá 50MB." }, { status: 400 });
  }
  if (!isVideo && file.size > MAX_IMAGE) {
    return NextResponse.json({ error: "Ảnh vượt quá 10MB." }, { status: 400 });
  }

  const result = await processAndSaveMedia({
    buf: Buffer.from(await file.arrayBuffer()),
    mime,
    filename: file.name,
    standalone: true,
    prefix: "gopy",
  });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ url: result.url, kind: isVideo ? "video" : "image" }, { status: 201 });
}
