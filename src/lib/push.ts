import "server-only";
import webpush from "web-push";
import { prisma } from "./prisma";

/**
 * Web Push cho admin: bắn thông báo "đơn mới" tới các trình duyệt đã đăng ký
 * (iPhone cần thêm trang vào Màn hình chính rồi bật thông báo trong /admin).
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

/** Gửi thông báo ĐƠN MỚI tới mọi thiết bị admin đã bật; dọn subscription chết (404/410). */
export async function notifyNewBooking(info: {
  code: string;
  customerName: string;
  phone: string;
  summary?: string | null;
}): Promise<void> {
  try {
    if (!ensureConfigured()) return;
    const subs = await prisma.pushSubscription.findMany({ where: { role: "ADMIN" } });
    if (subs.length === 0) return;
    const payload = JSON.stringify({
      title: `🔔 Đơn mới ${info.code}`,
      body: `${info.customerName} · ${info.phone}${info.summary ? ` · ${info.summary}` : ""}`,
      url: "/admin/bookings",
    });
    await Promise.allSettled(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            payload,
            { TTL: 3600 },
          );
        } catch (err) {
          const status = (err as { statusCode?: number }).statusCode;
          // Subscription hết hạn / người dùng tắt → xoá để lần sau không gửi nữa.
          if (status === 404 || status === 410) {
            await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
          }
        }
      }),
    );
  } catch (err) {
    console.error("notifyNewBooking", err);
  }
}
