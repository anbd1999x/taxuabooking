import "server-only";
import { requestIp } from "./ip-block";

/**
 * Giới hạn tần suất đơn giản trong bộ nhớ (per-process) — chống spam gửi đơn.
 * Đủ dùng cho 1–vài instance; nếu scale lớn hơn thì chuyển sang Redis.
 * Mỗi khoá nhớ cửa sổ của chính nó (`w`) ⇒ dọn rác theo cửa sổ từng khoá, cuộc gọi cửa sổ ngắn
 * không xoá nhầm bộ đếm cửa sổ dài (vd đăng nhập sai 15 phút, tra cứu 1 giờ).
 */
const hits = new Map<string, { w: number; ts: number[] }>();

function recentOf(key: string, windowMs: number, now: number): number[] {
  return (hits.get(key)?.ts ?? []).filter((t) => now - t < windowMs);
}

/** true = cho qua (đã ghi 1 lượt); false = vượt giới hạn trong cửa sổ thời gian (không ghi). */
export function rateLimit(key: string, limit = 5, windowMs = 60_000): boolean {
  const now = Date.now();
  const recent = recentOf(key, windowMs, now);
  const w = Math.max(windowMs, hits.get(key)?.w ?? 0);
  if (recent.length >= limit) {
    hits.set(key, { w, ts: recent });
    return false;
  }
  recent.push(now);
  hits.set(key, { w, ts: recent });
  // Dọn rác định kỳ để Map không phình vô hạn — theo cửa sổ của TỪNG khoá.
  if (hits.size > 10_000) {
    for (const [k, v] of hits) {
      if (v.ts.every((t) => now - t >= v.w)) hits.delete(k);
    }
  }
  return true;
}

/**
 * Chỉ XEM (không ghi lượt): true = còn dưới giới hạn. Dùng khi chỉ muốn đếm lượt THẤT BẠI (vd tra cứu không ra
 * kết quả) — kiểm trước bằng hàm này, thất bại mới gọi `rateLimit` để ghi lượt.
 */
export function underLimit(key: string, limit: number, windowMs: number): boolean {
  return recentOf(key, windowMs, Date.now()).length < limit;
}

/** Xoá bộ đếm của một khoá (vd đăng nhập đúng ⇒ bỏ các lần sai trước đó). */
export function resetLimit(key: string): void {
  hits.delete(key);
}

/** Hoàn lại lượt ghi gần nhất của một khoá (vd lượt đăng nhập đã ghi trước nhưng hoá ra đúng mật khẩu). */
export function refundLimit(key: string): void {
  const e = hits.get(key);
  if (!e) return;
  e.ts.pop();
  if (!e.ts.length) hits.delete(key);
}

/** Lấy IP khách (X-Forwarded-For do Caddy đặt — xem `requestIp` trong ip-block.ts). */
export function clientIp(request: Request): string {
  return requestIp(request.headers) ?? "unknown";
}
