import "server-only";
import { prisma } from "./prisma";

/** Khách có lastSeen trong khoảng này được tính là "đang truy cập". */
export const ONLINE_WINDOW_MS = 5 * 60 * 1000;

export interface VisitInfo {
  visitorId: string;
  path: string;
  referrer?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  customerId?: string | null;
  customerName?: string | null;
}

/**
 * Ghi nhận 1 lượt xem trang: cập nhật tổng (Visitor/SiteCounter) và ghi 1 dòng
 * nhật ký chi tiết (PageView) để xem lịch sử truy cập.
 */
export async function recordVisit(info: VisitInfo): Promise<void> {
  const now = new Date();
  await prisma.$transaction([
    prisma.visitor.upsert({
      where: { id: info.visitorId },
      create: { id: info.visitorId, views: 1, firstSeen: now, lastSeen: now },
      update: { views: { increment: 1 }, lastSeen: now },
    }),
    prisma.siteCounter.upsert({
      where: { id: "main" },
      create: { id: "main", totalViews: 1 },
      update: { totalViews: { increment: 1 } },
    }),
    prisma.pageView.create({
      data: {
        visitorId: info.visitorId,
        path: info.path.slice(0, 512),
        referrer: info.referrer ? info.referrer.slice(0, 512) : null,
        customerId: info.customerId ?? null,
        customerName: info.customerName ?? null,
        ip: info.ip ?? null,
        userAgent: info.userAgent ? info.userAgent.slice(0, 512) : null,
      },
    }),
  ]);
}

export interface VisitStats {
  totalViews: number; // tổng lượt xem trang từ trước tới giờ
  totalVisitors: number; // tổng khách truy cập (cookie duy nhất)
  online: number; // đang truy cập (hoạt động trong 5 phút gần nhất)
}

export async function getVisitStats(): Promise<VisitStats> {
  const since = new Date(Date.now() - ONLINE_WINDOW_MS);
  const [counter, totalVisitors, online] = await Promise.all([
    prisma.siteCounter.findUnique({ where: { id: "main" } }),
    prisma.visitor.count(),
    prisma.visitor.count({ where: { lastSeen: { gte: since } } }),
  ]);
  return { totalViews: counter?.totalViews ?? 0, totalVisitors, online };
}

// ---- Tra cứu khu vực theo IP (geo-IP, có cache trong bảng IpGeo) ----

/** IP công khai (bỏ qua localhost / mạng nội bộ / IPv6 nội bộ). */
export function isPublicIp(ip: string | null | undefined): boolean {
  if (!ip) return false;
  const v = ip.trim();
  if (!v || v === "::1" || v === "127.0.0.1") return false;
  if (v.startsWith("10.") || v.startsWith("192.168.") || v.startsWith("169.254.")) return false;
  const m = /^172\.(\d+)\./.exec(v);
  if (m && Number(m[1]) >= 16 && Number(m[1]) <= 31) return false;
  if (v.startsWith("fe80:") || v.startsWith("fc") || v.startsWith("fd")) return false; // IPv6 link-local / ULA
  return true;
}

const inflight = new Set<string>();

/**
 * Nếu IP chưa có trong cache khu vực thì tra cứu qua ip-api.com (miễn phí, HTTP)
 * và lưu lại. Gọi "bắn rồi quên" (không await ở hot path) để không làm chậm khách.
 */
export async function ensureGeo(ip: string | null | undefined): Promise<void> {
  if (!isPublicIp(ip)) return;
  const addr = ip!.trim();
  if (inflight.has(addr)) return;
  try {
    const existing = await prisma.ipGeo.findUnique({ where: { ip: addr }, select: { ip: true } });
    if (existing) return;
    inflight.add(addr);
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(addr)}?lang=vi&fields=status,country,countryCode,regionName,city,isp`,
      { signal: ctrl.signal, cache: "no-store" },
    ).finally(() => clearTimeout(t));
    const data = (await res.json()) as {
      status?: string;
      country?: string;
      countryCode?: string;
      regionName?: string;
      city?: string;
      isp?: string;
    };
    if (data.status !== "success") return;
    await prisma.ipGeo.upsert({
      where: { ip: addr },
      create: {
        ip: addr,
        country: data.country ?? null,
        countryCode: data.countryCode ?? null,
        region: data.regionName ?? null,
        city: data.city ?? null,
        isp: data.isp ?? null,
      },
      update: {
        country: data.country ?? null,
        countryCode: data.countryCode ?? null,
        region: data.regionName ?? null,
        city: data.city ?? null,
        isp: data.isp ?? null,
      },
    });
  } catch {
    // Lỗi mạng / quá hạn mức ⇒ bỏ qua, lần sau thử lại.
  } finally {
    inflight.delete(addr);
  }
}

export interface GeoInfo {
  country: string | null;
  region: string | null;
  city: string | null;
  isp: string | null;
}

/** Lấy khu vực đã cache cho nhiều IP (để hiển thị ở trang quản trị). */
export async function geoForIps(ips: string[]): Promise<Map<string, GeoInfo>> {
  const uniq = [...new Set(ips.filter(Boolean))];
  if (uniq.length === 0) return new Map();
  const rows = await prisma.ipGeo.findMany({ where: { ip: { in: uniq } } });
  return new Map(rows.map((r) => [r.ip, { country: r.country, region: r.region, city: r.city, isp: r.isp }]));
}
