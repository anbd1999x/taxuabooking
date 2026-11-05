import "server-only";
import { requestIp } from "./ip-block";

/**
 * Giới hạn tần suất đơn giản trong bộ nhớ (per-process) — chống spam gửi đơn.
 * Đủ dùng cho 1–vài instance; nếu scale lớn hơn thì chuyển sang Redis.
 */
const hits = new Map<string, number[]>();

/** true = cho qua; false = vượt giới hạn trong cửa sổ thời gian. */
export function rateLimit(key: string, limit = 5, windowMs = 60_000): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  // Dọn rác định kỳ để Map không phình vô hạn.
  if (hits.size > 10_000) {
    for (const [k, v] of hits) {
      if (v.every((t) => now - t >= windowMs)) hits.delete(k);
    }
  }
  return true;
}

/** Lấy IP khách (X-Forwarded-For do Caddy đặt — xem `requestIp` trong ip-block.ts). */
export function clientIp(request: Request): string {
  return requestIp(request.headers) ?? "unknown";
}
