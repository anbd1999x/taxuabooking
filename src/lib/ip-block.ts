/**
 * Chặn IP (chống spam đơn). Dùng ở proxy.ts (chặn toàn web công khai) + API đặt đơn.
 * KHÔNG import "server-only" vì proxy cũng dùng.
 *
 * Danh sách IP bị chặn được nạp từ DB và giữ trong bộ nhớ mỗi tiến trình ~30 giây
 * (không truy vấn DB mỗi request). Chặn/bỏ chặn có hiệu lực trên toàn site trong ≤30s.
 */
import { prisma } from "./prisma";

const TTL_MS = 30_000;
let cache: { set: Set<string>; at: number } | null = null;
let loading: Promise<Set<string>> | null = null;

/** Chuẩn hoá IP: bỏ tiền tố IPv4-mapped "::ffff:", khoảng trắng, chữ hoa (IPv6). */
export function normalizeIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  let s = ip.trim().toLowerCase();
  if (s.startsWith("::ffff:") && s.includes(".")) s = s.slice(7);
  return s && s !== "unknown" ? s : null;
}

/** IP hợp lệ (IPv4 hoặc IPv6) — dùng khi admin nhập tay. */
export function isValidIp(ip: string): boolean {
  if (/^(\d{1,3})(\.\d{1,3}){3}$/.test(ip)) return ip.split(".").every((n) => Number(n) <= 255);
  return /^[0-9a-f:]+$/i.test(ip) && ip.includes(":") && ip.length <= 45;
}

/**
 * IP thật của khách. Caddy (proxy ngoài cùng) GHI ĐÈ X-Forwarded-For bằng IP kết nối
 * thật (không tin header khách gửi) → phần tử đầu là IP khách. KHÔNG dùng
 * CF-Connecting-IP / X-Real-IP: site không qua Cloudflare nên header đó giả mạo được,
 * còn X-Real-IP bị nginx đặt lại thành IP của Caddy.
 */
export function requestIp(headers: Headers): string | null {
  return normalizeIp(headers.get("x-forwarded-for")?.split(",")[0]);
}

async function load(): Promise<Set<string>> {
  const rows = await prisma.blockedIp.findMany({ select: { ip: true } });
  return new Set(rows.map((r) => r.ip));
}

/** Danh sách IP bị chặn (cache ~30s). Lỗi DB → dùng bản cũ / rỗng (không làm sập site). */
export async function blockedIps(): Promise<Set<string>> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.set;
  if (!loading) {
    loading = load()
      .then((set) => {
        cache = { set, at: Date.now() };
        return set;
      })
      .catch(() => {
        // Thử lại sau 5s thay vì mỗi request.
        const set = cache?.set ?? new Set<string>();
        cache = { set, at: Date.now() - TTL_MS + 5_000 };
        return set;
      })
      .finally(() => {
        loading = null;
      });
  }
  return loading;
}

export async function isIpBlocked(ip: string | null | undefined): Promise<boolean> {
  const n = normalizeIp(ip);
  if (!n) return false;
  return (await blockedIps()).has(n);
}

/** Ghi IP + trình duyệt đã gửi đơn (để admin truy ra & chặn nếu spam). Lỗi → bỏ qua. */
export async function recordBookingSource(code: string, headers: Headers): Promise<void> {
  await prisma.bookingRequest
    .update({
      where: { code },
      data: { clientIp: requestIp(headers), clientUa: headers.get("user-agent")?.slice(0, 300) ?? null },
    })
    .catch(() => {});
}

/** Gọi sau khi admin chặn/bỏ chặn để tiến trình hiện tại áp dụng ngay. */
export function invalidateBlockedIps(): void {
  cache = null;
}
