import "server-only";
import { prisma } from "@/lib/prisma";
import { SITE } from "@/lib/site";
import { getSettings } from "@/lib/queries";
import { bookingMessagesById } from "@/lib/booking-messages";
import { renderBookingEmail, type BookingEmailKind, type EmailCompany } from "@/lib/booking-email-template";
import { mailConfigured, sendMail, type MailResult } from "@/lib/mail";

/**
 * Email gửi KHÁCH về đơn đặt:
 *  - "received": ngay khi khách gửi yêu cầu (đã nhận đơn, mời cọc, nhắc hạn tự huỷ).
 *  - "confirmed": khi đơn được xác nhận (kèm số đã thanh toán / còn lại).
 *  - "cancelled": khi đơn bị huỷ (quản trị/chủ dịch vụ huỷ hoặc hệ thống tự huỷ), kèm lý do.
 * Chỉ gửi khi khách có điền email lúc đặt. Lỗi gửi mail KHÔNG làm hỏng luồng đặt/xác nhận.
 */
export { renderBookingEmail, type BookingEmailKind };

async function company(): Promise<EmailCompany> {
  // getSettings() dùng cache của Next; ngoài request (bộ hẹn giờ tự huỷ) có thể lỗi ⇒ dùng mặc định.
  const s = await getSettings().catch(() => ({}) as Record<string, string>);
  // Link trong email luôn dùng tên miền thật (không lấy localhost khi chạy dev).
  const url = SITE.url.includes("localhost") ? "https://taxuabooking.com" : SITE.url.replace(/\/$/, "");
  return {
    legalName: s.legalName || SITE.legalName,
    taxCode: s.taxCode || SITE.taxCode,
    legalAddress: s.legalAddress || SITE.legalAddress,
    siteUrl: url,
  };
}

/** Gửi email về đơn `id` tới `to` (mặc định = email khách đã điền). Không có email / chưa cấu hình SMTP ⇒ bỏ qua. */
export async function sendBookingEmail(id: string, kind: BookingEmailKind, to?: string): Promise<MailResult> {
  if (!(await mailConfigured())) return { ok: false, error: "Chưa có mật khẩu hộp thư gửi." };
  const b = await prisma.bookingRequest.findUnique({ where: { id }, select: { customerEmail: true } });
  if (!b) return { ok: false, error: "Không tìm thấy đơn." };
  const dest = to || b.customerEmail;
  if (!dest) return { ok: false, error: "Đơn không có email khách." };
  const m = await bookingMessagesById(id);
  if (!m) return { ok: false, error: "Không tìm thấy đơn." };
  const mail = renderBookingEmail(kind, m.facts, await company());
  return sendMail({ to: dest, ...mail });
}

/**
 * Sau khi khách gửi đơn thành công: lưu email khách (nếu có) rồi gửi email "đã nhận yêu cầu".
 * Gọi từ các API đặt (homestay / cabin / combo / dịch vụ khác). Không bao giờ ném lỗi.
 */
export async function onBookingCreated(code: string, email: string | null | undefined): Promise<void> {
  try {
    if (!email) return;
    const b = await prisma.bookingRequest.update({ where: { code }, data: { customerEmail: email }, select: { id: true } });
    await sendBookingEmail(b.id, "received");
  } catch (err) {
    console.error("onBookingCreated email error", err);
  }
}

/**
 * Sau mỗi lần đổi trạng thái đơn: đơn vừa sang ĐÃ XÁC NHẬN / HOÀN THÀNH, khách có email và chưa
 * từng gửi ⇒ gửi email xác nhận đúng MỘT lần (đánh dấu `confirmEmailSentAt` trước khi gửi để
 * nhiều luồng xác nhận cùng lúc không gửi trùng). Không bao giờ ném lỗi.
 */
export async function sendConfirmEmailIfDue(id: string): Promise<void> {
  try {
    if (!(await mailConfigured())) return;
    await sendCancelEmailIfDue(id);
    const claimed = await prisma.bookingRequest.updateMany({
      where: { id, customerEmail: { not: null }, confirmEmailSentAt: null, status: { in: ["CONFIRMED", "COMPLETED"] } },
      data: { confirmEmailSentAt: new Date() },
    });
    if (claimed.count === 0) return;
    const r = await sendBookingEmail(id, "confirmed");
    // Gửi lỗi ⇒ trả lại cờ để lần xác nhận/lưu sau gửi lại được.
    if (!r.ok) await prisma.bookingRequest.updateMany({ where: { id }, data: { confirmEmailSentAt: null } });
  } catch (err) {
    console.error("sendConfirmEmailIfDue error", err);
  }
}

/**
 * Đơn vừa sang ĐÃ HUỶ, khách có email và chưa từng gửi ⇒ gửi email báo huỷ đúng MỘT lần
 * (`cancelEmailSentAt`). Gọi từ `sendConfirmEmailIfDue` (mọi luồng đổi trạng thái trong admin) và từ
 * bộ tự huỷ đơn. Không bao giờ ném lỗi.
 */
export async function sendCancelEmailIfDue(id: string): Promise<void> {
  try {
    if (!(await mailConfigured())) return;
    const claimed = await prisma.bookingRequest.updateMany({
      where: { id, customerEmail: { not: null }, cancelEmailSentAt: null, status: "CANCELLED" },
      data: { cancelEmailSentAt: new Date() },
    });
    if (claimed.count === 0) return;
    const r = await sendBookingEmail(id, "cancelled");
    if (!r.ok) await prisma.bookingRequest.updateMany({ where: { id }, data: { cancelEmailSentAt: null } });
  } catch (err) {
    console.error("sendCancelEmailIfDue error", err);
  }
}
