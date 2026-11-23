import path from "node:path";
import crypto from "node:crypto";
import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import sharp from "sharp";
import { THUMB_WIDTHS } from "@/lib/image-loader";

export const runtime = "nodejs";

const PUBLIC_DIR = path.join(process.cwd(), "public");
/** Bản thu nhỏ lưu chung trong volume uploads ⇒ mọi replica dùng lại, không mất khi deploy. */
const CACHE_DIR = path.join(PUBLIC_DIR, "uploads", ".thumbs");
const ALLOWED = new Set(THUMB_WIDTHS);
const HEADERS = {
  "Content-Type": "image/webp",
  // Tên file ảnh là duy nhất (mốc thời gian + chuỗi ngẫu nhiên) ⇒ cache vĩnh viễn; ảnh public đổi nội dung thì khoá cache đổi theo mtime.
  "Cache-Control": "public, max-age=31536000, immutable",
  "X-Content-Type-Options": "nosniff",
};

/** Chỉ đọc file ảnh nằm trong thư mục public (chặn "../" và đường dẫn lạ). */
function resolvePublic(u: string): string | null {
  if (!u.startsWith("/") || u.includes("\0") || !/\.(jpe?g|png|webp|avif)$/i.test(u)) return null;
  const abs = path.normalize(path.join(PUBLIC_DIR, u));
  if (!abs.startsWith(PUBLIC_DIR + path.sep) || abs.startsWith(CACHE_DIR + path.sep)) return null;
  return abs;
}

const send = (buf: Buffer) => new Response(new Uint8Array(buf), { headers: { ...HEADERS, "Content-Length": String(buf.length) } });

/**
 * Ảnh thu nhỏ theo bề rộng: `/thumb?u=/uploads/x.jpg&w=640` → WebP rộng tối đa 640px (không phóng to ảnh nhỏ).
 * next/image gọi route này qua `src/lib/image-loader.ts`. Bề rộng chỉ nhận các mức trong THUMB_WIDTHS
 * ⇒ số bản lưu đệm có giới hạn (số ảnh × 10). Không nằm dưới /api vì robots.txt chặn /api (Google Hình ảnh cần tải được).
 */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const u = sp.get("u") ?? "";
  const w = Number(sp.get("w"));
  const abs = resolvePublic(u);
  if (!abs || !ALLOWED.has(w)) return new Response("Bad request", { status: 400 });

  let mtime: number;
  try {
    mtime = Math.floor((await stat(abs)).mtimeMs);
  } catch {
    return new Response("Not found", { status: 404 });
  }
  const key = crypto.createHash("sha1").update(`${u}|${w}|${mtime}`).digest("hex");
  const cached = path.join(CACHE_DIR, `${key}.webp`);
  try {
    return send(await readFile(/*turbopackIgnore: true*/ cached));
  } catch {
    /* chưa có bản lưu ⇒ dựng mới */
  }

  let out: Buffer;
  try {
    // turbopackIgnore: đường dẫn động khiến Turbopack trace cả public/uploads vào bản standalone (xem app/og/route.ts).
    out = await sharp(await readFile(/*turbopackIgnore: true*/ abs), { failOn: "none" })
      .rotate()
      .resize({ width: w, withoutEnlargement: true })
      .webp({ quality: 74, effort: 4 })
      .toBuffer();
  } catch {
    // Ảnh hỏng / sharp không đọc được ⇒ trả về ảnh gốc thay vì ô trống.
    return Response.redirect(new URL(u, req.url), 302);
  }
  // Ghi tạm rồi đổi tên: replica khác không bao giờ đọc phải file dở. Ghi lỗi (đĩa đầy, chỉ đọc) thì bỏ qua.
  try {
    await mkdir(CACHE_DIR, { recursive: true });
    const tmp = `${cached}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(tmp, out);
    await rename(tmp, cached);
  } catch {
    /* không lưu được cũng không sao */
  }
  return send(out);
}
