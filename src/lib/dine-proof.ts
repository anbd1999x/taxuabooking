import "server-only";
import { createHmac } from "node:crypto";
import { readdir, stat, unlink } from "node:fs/promises";
import path from "node:path";

/**
 * Ảnh bill chuyển khoản của khách gọi món QR: tên tệp mang tiền tố riêng THEO BÀN (HMAC id bàn bằng AUTH_SECRET —
 * khách không biết id bàn nên không dựng được tiền tố của bàn khác). Op `claim` chỉ nhận url do /api/qr/proof vừa
 * cấp cho đúng bàn đó, còn trong hạn và tệp còn tồn tại — không nhận ảnh /uploads bất kỳ (ảnh dịch vụ, bill cũ bàn khác).
 */
const PROOF_TTL_MS = 12 * 60 * 60_000;

export function dineBillPrefix(tableId: string): string {
  // Thiếu khoá ⇒ ném lỗi (giống auth-token), không dùng khoá mặc định ai cũng dựng được.
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) throw new Error("AUTH_SECRET chưa được cấu hình (cần >= 16 ký tự).");
  const tag = createHmac("sha256", secret).update(`dinebill:${tableId}`).digest("hex").slice(0, 12);
  return `dinebill-${tag}`;
}

export async function isValidDineProof(tableId: string, url: string): Promise<boolean> {
  const m = /^\/uploads\/(dinebill-[0-9a-f]{12})-(\d{13})-[0-9a-f]{12}\.(?:jpg|png|webp|avif)$/.exec(url);
  if (!m || m[1] !== dineBillPrefix(tableId)) return false;
  const age = Date.now() - Number(m[2]);
  if (age < -60_000 || age > PROOF_TTL_MS) return false;
  try {
    const s = await stat(path.join(process.cwd(), "public", "uploads", path.basename(url)));
    return s.isFile();
  } catch {
    return false;
  }
}

const DINE_BILL_KEEP_MS = 30 * 24 * 60 * 60_000;

/** Xoá ảnh bill gọi món (public/uploads/dinebill-<tag>-<timestamp ms>-<hex>.<đuôi>) cũ hơn 30 ngày — theo mốc trong tên tệp. */
export async function cleanupOldDineProofs(): Promise<number> {
  const dir = path.join(process.cwd(), "public", "uploads");
  let names: string[];
  try {
    names = await readdir(dir);
  } catch {
    return 0;
  }
  const now = Date.now();
  let n = 0;
  for (const name of names) {
    const m = /^dinebill-[0-9a-f]{12}-(\d{13})-[0-9a-f]{12}\.(?:jpg|png|webp|avif)$/.exec(name);
    if (!m || now - Number(m[1]) <= DINE_BILL_KEEP_MS) continue;
    try {
      await unlink(path.join(dir, name));
      n++;
    } catch {
      /* tệp đã bị xoá / không có quyền ⇒ bỏ qua */
    }
  }
  return n;
}
