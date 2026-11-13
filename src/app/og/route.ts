import path from "node:path";
import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { OG_HEIGHT, OG_WIDTH } from "@/lib/og";

export const runtime = "nodejs";

const PUBLIC_DIR = path.join(process.cwd(), "public");
const FALLBACK = "/hero-taxua.jpg";

/** Chỉ đọc file ảnh nằm trong thư mục public (chặn "../" và đường dẫn lạ). */
function resolvePublic(u: string): string | null {
  if (!u.startsWith("/") || u.includes("\0") || !/\.(jpe?g|png|webp|avif|gif)$/i.test(u)) return null;
  const abs = path.normalize(path.join(PUBLIC_DIR, u));
  return abs.startsWith(PUBLIC_DIR + path.sep) ? abs : null;
}

async function render(u: string): Promise<Buffer | null> {
  const abs = resolvePublic(u);
  if (!abs) return null;
  try {
    return await sharp(await readFile(abs), { failOn: "none" })
      .rotate()
      .resize(OG_WIDTH, OG_HEIGHT, { fit: "cover", position: "attention" })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 80, mozjpeg: true })
      .toBuffer();
  } catch {
    return null;
  }
}

/**
 * Ảnh xem trước khi chia sẻ link (og:image): `/og?u=/uploads/x.webp` → JPEG 1200×630 nhẹ.
 * Không nằm dưới /api vì robots.txt chặn /api (Facebook tuân theo robots khi tải ảnh).
 */
export async function GET(req: Request) {
  const u = new URL(req.url).searchParams.get("u") || FALLBACK;
  const buf = (await render(u)) ?? (u === FALLBACK ? null : await render(FALLBACK));
  if (!buf) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "image/jpeg",
      "Content-Length": String(buf.length),
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    },
  });
}
