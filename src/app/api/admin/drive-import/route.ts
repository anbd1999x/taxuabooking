import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { processAndSaveMedia, resolveMediaType, MAX_VIDEO_BYTES } from "@/lib/media";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_FILES = 30; // chặn thư mục quá lớn

/** Trích id từ link Google Drive. Trả {kind} để biết là file hay thư mục. */
function parseDriveUrl(raw: string): { kind: "file" | "folder"; id: string } | null {
  const url = raw.trim();
  let m = url.match(/\/folders\/([a-zA-Z0-9_-]{10,})/);
  if (m) return { kind: "folder", id: m[1] };
  m = url.match(/\/(?:file\/)?d\/([a-zA-Z0-9_-]{10,})/);
  if (m) return { kind: "file", id: m[1] };
  m = url.match(/[?&]id=([a-zA-Z0-9_-]{10,})/);
  if (m) return { kind: "file", id: m[1] };
  return null;
}

/** Liệt kê file trong thư mục Drive công khai qua trang embeddedfolderview. */
async function listFolderFiles(folderId: string): Promise<{ id: string; name: string }[]> {
  const res = await fetch(`https://drive.google.com/embeddedfolderview?id=${folderId}#grid`, {
    headers: { "User-Agent": "Mozilla/5.0 TaXuaBooking drive import" },
    cache: "no-store",
  });
  if (!res.ok) return [];
  const html = await res.text();
  const out: { id: string; name: string }[] = [];
  const seen = new Set<string>();
  // Mỗi ô file: <div class="flip-entry" id="entry-<ID>"> ... <div class="flip-entry-title">tên</div>
  const re = /id="entry-([a-zA-Z0-9_-]{10,})"[\s\S]*?flip-entry-title">([^<]*)</g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    if (!seen.has(m[1])) {
      seen.add(m[1]);
      out.push({ id: m[1], name: m[2].trim() });
    }
  }
  return out;
}

/** Tải 1 file Drive công khai. Trả null nếu không truy cập được. */
async function downloadDriveFile(
  fileId: string,
): Promise<{ buf: Buffer; mime: string; filename: string } | null> {
  const tryUrls = [
    `https://drive.google.com/uc?export=download&id=${fileId}`,
    `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`,
  ];
  for (const u of tryUrls) {
    try {
      const res = await fetch(u, {
        redirect: "follow",
        headers: { "User-Agent": "Mozilla/5.0 TaXuaBooking drive import" },
        cache: "no-store",
      });
      if (!res.ok) continue;
      const ct = (res.headers.get("content-type") || "").toLowerCase();
      if (ct.includes("text/html")) continue; // trang xác nhận / yêu cầu đăng nhập → thử URL sau
      const len = Number(res.headers.get("content-length") || 0);
      if (len > MAX_VIDEO_BYTES) return null;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length === 0 || buf.length > MAX_VIDEO_BYTES) return null;
      // Tên file từ content-disposition (nếu có).
      const cd = res.headers.get("content-disposition") || "";
      const fm = cd.match(/filename\*?=(?:UTF-8''|")?([^";]+)/i);
      const filename = fm ? decodeURIComponent(fm[1].replace(/"$/, "")) : `drive-${fileId}`;
      return { buf, mime: ct.split(";")[0], filename };
    } catch {
      // thử URL tiếp theo
    }
  }
  return null;
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Không có quyền." }, { status: 403 });

  let body: { url?: string; serviceId?: string; roomTypeId?: string; roomId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Thiếu dữ liệu." }, { status: 400 });
  }
  const parsed = parseDriveUrl(body.url ?? "");
  if (!parsed) {
    return NextResponse.json({ error: "Link Google Drive không hợp lệ." }, { status: 400 });
  }
  if (!body.serviceId && !body.roomTypeId && !body.roomId) {
    return NextResponse.json({ error: "Thiếu đối tượng gắn media." }, { status: 400 });
  }

  // Danh sách file cần tải.
  let files: { id: string; name: string }[];
  if (parsed.kind === "folder") {
    files = await listFolderFiles(parsed.id);
    if (files.length === 0) {
      return NextResponse.json(
        { error: "Không đọc được thư mục. Hãy chắc thư mục ở chế độ công khai (Ai có link đều xem được)." },
        { status: 400 },
      );
    }
    files = files.slice(0, MAX_FILES);
  } else {
    files = [{ id: parsed.id, name: "" }];
  }

  let ok = 0;
  const errors: string[] = [];
  for (const f of files) {
    const dl = await downloadDriveFile(f.id);
    const label = f.name || f.id.slice(0, 8);
    if (!dl) {
      errors.push(`${label}: không tải được (file phải công khai)`);
      continue;
    }
    const filename = f.name || dl.filename;
    const mime = resolveMediaType(dl.mime, filename);
    if (!mime.startsWith("image/") && !mime.startsWith("video/")) {
      errors.push(`${label}: không phải ảnh/video`);
      continue;
    }
    const result = await processAndSaveMedia({
      buf: dl.buf,
      mime,
      filename,
      serviceId: body.serviceId ?? null,
      roomTypeId: body.roomTypeId ?? null,
      roomId: body.roomId ?? null,
    });
    if ("error" in result) errors.push(`${label}: ${result.error}`);
    else ok++;
  }

  return NextResponse.json({ ok, total: files.length, errors }, { status: ok > 0 ? 201 : 400 });
}
