import "server-only";
import webpush from "web-push";
import { prisma } from "./prisma";

/**
 * Web Push cho admin: bắn thông báo (đơn mới, nhắc lịch lên xe/checkout…) tới các trình
 * duyệt đã đăng ký (iPhone cần thêm trang vào Màn hình chính rồi bật thông báo trong /admin).
 * Thiếu VAPID key trong env → bỏ qua êm (không chặn luồng đặt đơn).
 */
let configured = false;
function ensureConfigured(): boolean {
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  if (!configured) {
    // Subject = định danh chủ site với dịch vụ push (URL hoặc mailto:).
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || "https://taxuabooking.com", pub, priv);
    configured = true;
  }
  return true;
}

/**
 * urgency "high": iPhone tắt màn hình / tiết kiệm pin vẫn giao ngay
 * (mặc định "normal" có thể bị APNs hoãn tới khi mở máy).
 */
const PUSH_OPTS = { TTL: 6 * 3600, urgency: "high" as const };

/** Gửi thử tới ĐÚNG 1 thiết bị (nút "Thử" ở header admin). Trả mã HTTP của dịch vụ push. */
export async function pushTest(endpoint: string, userId: string): Promise<{ ok: boolean; status: number | null }> {
  if (!ensureConfigured()) return { ok: false, status: null };
  const s = await prisma.pushSubscription.findUnique({ where: { endpoint } });
  if (!s || s.userId !== userId) return { ok: false, status: 404 };
  try {
    const r = await webpush.sendNotification(
      { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
      JSON.stringify({ title: "🔔 Thông báo thử", body: "Thiết bị này đã nhận được thông báo từ Tà Xùa Booking.", url: "/admin", tag: "push-test" }),
      PUSH_OPTS,
    );
    return { ok: true, status: r.statusCode };
  } catch (err) {
    const status = (err as { statusCode?: number }).statusCode ?? null;
    console.warn("[push] gửi thử lỗi", status, s.endpoint.slice(0, 60));
    if (status === 404 || status === 410) await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
    return { ok: false, status };
  }
}

/**
 * Gửi 1 thông báo tới MỌI thiết bị admin đã bật; dọn subscription chết (404/410).
 * Trả về số thiết bị nhận thành công (-1 = chưa cấu hình VAPID).
 * `tag` trùng thì thông báo mới thay thông báo cũ trên máy.
 */
export async function pushToAdmins(msg: {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}): Promise<number> {
  if (!ensureConfigured()) return -1;
  const subs = await prisma.pushSubscription.findMany({ where: { role: "ADMIN" } });
  if (subs.length === 0) return 0;
  const payload = JSON.stringify({ url: "/admin/bookings", ...msg });
  let ok = 0;
  await Promise.allSettled(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
          PUSH_OPTS,
        );
        ok++;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        console.warn("[push] gửi lỗi", status, s.endpoint.slice(0, 60));
        // Subscription hết hạn / người dùng tắt → xoá để lần sau không gửi nữa.
        if (status === 404 || status === 410) {
          await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
        }
      }
    }),
  );
  return ok;
}

/**
 * Gửi 1 thông báo tới các thiết bị của NHỮNG TÀI KHOẢN chỉ định (chủ dịch vụ) đã bật thông báo.
 * Trả về số thiết bị nhận thành công (-1 = chưa cấu hình VAPID).
 */
export async function pushToUsers(
  userIds: string[],
  msg: { title: string; body: string; url?: string; tag?: string },
): Promise<number> {
  if (!ensureConfigured()) return -1;
  const ids = [...new Set(userIds.filter(Boolean))];
  if (ids.length === 0) return 0;
  const subs = await prisma.pushSubscription.findMany({ where: { userId: { in: ids }, role: "PROVIDER" } });
  if (subs.length === 0) return 0;
  const payload = JSON.stringify({ url: "/admin/provider/don", ...msg });
  let ok = 0;
  await Promise.allSettled(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, PUSH_OPTS);
        ok++;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
      }
    }),
  );
  return ok;
}

/**
 * Báo ĐƠN MỚI cho chủ dịch vụ liên quan: chủ của dịch vụ được đặt, và chủ nhà xe của chuyến (vé cabin / combo).
 * Không kèm SĐT khách (chủ dịch vụ chỉ thấy SĐT sau khi sàn xác nhận đơn).
 */
async function notifyProvidersNewBooking(code: string, summary?: string | null): Promise<void> {
  const b = await prisma.bookingRequest.findUnique({
    where: { code },
    select: { id: true, customerName: true, serviceTitle: true, useDate: true, cabinTripId: true, service: { select: { ownerId: true, title: true } } },
  });
  if (!b) return;
  const owners = new Set<string>();
  if (b.service?.ownerId) owners.add(b.service.ownerId);
  if (b.cabinTripId) {
    const t = await prisma.cabinTrip.findUnique({ where: { id: b.cabinTripId }, select: { service: { select: { ownerId: true } } } });
    if (t?.service.ownerId) owners.add(t.service.ownerId);
  }
  if (owners.size === 0) return;
  const d = b.useDate.toISOString().slice(0, 10);
  await pushToUsers([...owners], {
    title: `🔔 Đơn mới ${code}`,
    body: `${b.customerName} · ${summary || b.service?.title || b.serviceTitle} · ngày ${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}. Tà Xùa Booking đang xác nhận với khách.`,
    url: `/admin/provider/don?open=${b.id}`,
    tag: `new-${code}`,
  });
}

/** Gửi thông báo ĐƠN MỚI tới mọi thiết bị admin đã bật + chủ dịch vụ liên quan. */
export async function notifyNewBooking(info: {
  code: string;
  customerName: string;
  phone: string;
  summary?: string | null;
}): Promise<void> {
  try {
    await pushToAdmins({
      title: `🔔 Đơn mới ${info.code}`,
      body: `${info.customerName} · ${info.phone}${info.summary ? ` · ${info.summary}` : ""}`,
      url: "/admin/bookings",
    });
    await notifyProvidersNewBooking(info.code, info.summary).catch((err) => console.error("notifyProvidersNewBooking", err));
  } catch (err) {
    console.error("notifyNewBooking", err);
  }
}
