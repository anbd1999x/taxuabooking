"use server";

import { revalidatePath, updateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import type { FormResult } from "@/components/admin/ActionForm";
import { TRUST_POPUP_KEY, type TrustPopupConfig } from "@/lib/trust-popup";
import { COMBO_DISCOUNT_KEY } from "@/lib/combo-pricing";
import { HOLIDAYS_KEY, normalizeHolidays } from "@/lib/holidays";
import { mailConfigured, verifySmtp, sendMail, SMTP_PASS_KEY } from "@/lib/mail";
import { sendBookingEmail, type BookingEmailKind } from "@/lib/booking-email";

async function requireAdmin(): Promise<void> {
  const s = await getSession();
  if (!s || s.role !== "ADMIN") throw new Error("Không có quyền.");
}

/** Khoá SiteSettings của thông tin pháp lý (hiện ở chân trang, /gioi-thieu, /lien-he, điều khoản). */
const LEGAL_KEYS = ["legalName", "taxCode", "legalAddress"] as const;

export async function saveLegalInfo(_prev: FormResult, fd: FormData): Promise<FormResult> {
  await requireAdmin();
  const v = Object.fromEntries(LEGAL_KEYS.map((k) => [k, String(fd.get(k) ?? "").trim()])) as Record<(typeof LEGAL_KEYS)[number], string>;
  if (!v.legalName) return { error: "Cần nhập tên đơn vị kinh doanh." };
  if (!v.legalAddress) return { error: "Cần nhập địa chỉ đăng ký." };

  await prisma.$transaction(
    LEGAL_KEYS.map((key) =>
      prisma.siteSetting.upsert({ where: { key }, create: { key, value: v[key] }, update: { value: v[key] } }),
    ),
  );

  updateTag("settings");
  revalidatePath("/", "layout");
  revalidatePath("/admin/popup", "page");
  return { ok: true, message: "Đã lưu thông tin pháp lý. Tải lại trang web để thấy." };
}

/** Mức giảm combo / khách (SiteSetting `comboDiscount`) — đọc ở getComboDiscount() (combo.ts). */
export async function saveComboDiscount(_prev: FormResult, fd: FormData): Promise<FormResult> {
  await requireAdmin();
  const raw = String(fd.get("comboDiscount") ?? "").replace(/[^\d]/g, "");
  if (!raw) return { error: "Nhập số tiền giảm (0 = tắt giảm combo)." };
  const value = Math.round(Number(raw));
  if (!Number.isFinite(value) || value < 0) return { error: "Số tiền không hợp lệ." };
  if (value > 5_000_000) return { error: "Mức giảm quá lớn (tối đa 5.000.000đ / khách)." };

  await prisma.siteSetting.upsert({
    where: { key: COMBO_DISCOUNT_KEY },
    create: { key: COMBO_DISCOUNT_KEY, value: String(value) },
    update: { value: String(value) },
  });
  updateTag("settings");
  revalidatePath("/combo", "page");
  revalidatePath("/admin/popup", "page");
  return { ok: true, message: `Đã lưu: giảm ${value.toLocaleString("vi-VN")}đ / khách khi đặt combo.` };
}

/** Lịch ngày lễ (SiteSetting `holidays`) — đêm trong khoảng ⇒ phòng có giá lễ tính giá lễ. */
export async function saveHolidays(_prev: FormResult, fd: FormData): Promise<FormResult> {
  await requireAdmin();
  let raw: unknown;
  try {
    raw = JSON.parse(String(fd.get("holidays") ?? "[]"));
  } catch {
    return { error: "Dữ liệu ngày lễ không hợp lệ." };
  }
  const list = normalizeHolidays(raw);
  if (Array.isArray(raw) && list.length < raw.length) return { error: "Có ngày lễ thiếu ngày bắt đầu — điền đủ hoặc xoá dòng đó." };
  if (list.length > 100) return { error: "Tối đa 100 ngày lễ." };
  const tooLong = list.find((h) => !h.yearly && (Date.parse(h.to) - Date.parse(h.from)) / 86400000 > 31);
  if (tooLong) return { error: `“${tooLong.name}” dài hơn 31 ngày — kiểm tra lại ngày bắt đầu/kết thúc.` };

  await prisma.siteSetting.upsert({
    where: { key: HOLIDAYS_KEY },
    create: { key: HOLIDAYS_KEY, value: JSON.stringify(list) },
    update: { value: JSON.stringify(list) },
  });
  updateTag("settings");
  revalidatePath("/", "layout"); // trang homestay / combo / danh sách phòng tính lại giá lễ
  revalidatePath("/admin/popup", "page");
  return { ok: true, message: list.length ? `Đã lưu ${list.length} ngày lễ.` : "Đã xoá hết ngày lễ." };
}

export async function saveTrustPopup(_prev: FormResult, fd: FormData): Promise<FormResult> {
  await requireAdmin();

  const person = (i: number) => ({
    name: String(fd.get(`name${i}`) ?? "").trim(),
    phone: String(fd.get(`phone${i}`) ?? "").trim(),
    facebook: String(fd.get(`facebook${i}`) ?? "").trim(),
    zalo: String(fd.get(`zalo${i}`) ?? "").trim(),
    avatar: String(fd.get(`avatar${i}`) ?? "").trim(),
    hidden: fd.get(`show${i}`) !== "on",
  });

  const fiveRules = String(fd.get("fiveRules") ?? "")
    .split("\n")
    .map((r) => r.trim())
    .filter(Boolean);

  const config: TrustPopupConfig = {
    enabled: fd.get("enabled") === "on",
    showLinks: fd.get("showLinks") === "on",
    sitePhoneOwner: fd.get("sitePhone") === "2" ? 1 : 0,
    people: [person(1), person(2)],
    fiveRules,
  };

  if (!config.people[0].name || !config.people[1].name) {
    return { error: "Cần nhập tên cho cả 2 người." };
  }
  if (config.people.every((p) => p.hidden)) return { error: "Phải hiện ít nhất 1 người." };
  const owner = config.people[config.sitePhoneOwner ?? 0];
  if (owner.phone.replace(/\D/g, "").length < 9) return { error: `Nhập số điện thoại hợp lệ cho ${owner.name} (số dùng cho toàn bộ trang web).` };
  if (owner.hidden) return { error: `Số điện thoại toàn web đang chọn của ${owner.name} nhưng người này bị ẩn — chọn số của người đang hiện.` };

  await prisma.siteSetting.upsert({
    where: { key: TRUST_POPUP_KEY },
    create: { key: TRUST_POPUP_KEY, value: JSON.stringify(config) },
    update: { value: JSON.stringify(config) },
  });

  // Cài đặt được cache 60 giây (tag "settings") — xoá ngay để menu, popup, SĐT đổi liền sau khi lưu.
  updateTag("settings");
  revalidatePath("/", "layout");
  revalidatePath("/admin/popup", "page");
  return { ok: true, message: "Đã lưu. Trang web cập nhật ngay (tải lại trang để thấy)." };
}

/**
 * Gửi EMAIL THỬ tới một địa chỉ bất kỳ, dùng nội dung của một đơn thật (mã đơn, trống = đơn mới nhất)
 * để kiểm tra cấu hình SMTP và trình bày thư. Không đổi dữ liệu đơn.
 */
export async function sendTestEmail(_prev: FormResult, fd: FormData): Promise<FormResult> {
  await requireAdmin();
  const to = String(fd.get("to") ?? "").trim();
  const code = String(fd.get("code") ?? "").trim();
  const k = fd.get("kind");
  const kind: BookingEmailKind = k === "confirmed" || k === "cancelled" ? k : "received";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return { error: "Nhập địa chỉ email nhận thư thử." };
  if (!(await mailConfigured())) return { error: "Chưa có mật khẩu hộp thư gửi — nhập ở ô “Mật khẩu hộp thư” bên dưới rồi lưu trước." };
  const b = code
    ? await prisma.bookingRequest.findUnique({ where: { code }, select: { id: true } })
    : await prisma.bookingRequest.findFirst({ orderBy: { createdAt: "desc" }, select: { id: true } });
  if (!b) return { error: "Không tìm thấy đơn để lấy nội dung mẫu." };
  const r = await sendBookingEmail(b.id, kind, to);
  return r.ok ? { ok: true, message: `Đã gửi thư thử tới ${to}.` } : { error: `Gửi thất bại: ${r.error}` };
}

/**
 * Lưu CẤU HÌNH MÁY CHỦ THƯ (SMTP) vào SiteSetting: máy chủ, cổng, kiểu bảo mật, tài khoản, tên người gửi
 * và mật khẩu. Ô mật khẩu để trống = giữ mật khẩu đang lưu (không bao giờ hiển thị lại giá trị cũ).
 */
export async function saveSmtpConfig(_prev: FormResult, fd: FormData): Promise<FormResult> {
  await requireAdmin();
  const get = (k: string) => String(fd.get(k) ?? "").trim();
  const host = get("smtpHost");
  const port = Number(get("smtpPort"));
  const user = get("smtpUser");
  const from = get("mailFrom");
  const pass = String(fd.get("smtpPass") ?? "");
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(host)) return { error: "Máy chủ SMTP không hợp lệ (vd: mail9234.maychuemail.com)." };
  if (port !== 587 && port !== 465) return { error: "Cổng phải là 587 (STARTTLS) hoặc 465 (SSL/TLS)." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user)) return { error: "Tài khoản đăng nhập phải là địa chỉ email đầy đủ." };
  if (!from) return { error: "Nhập tên người gửi (vd: Tà Xùa Booking <lienhe@taxuabooking.com>)." };

  const entries: [string, string][] = [
    ["smtpHost", host],
    ["smtpPort", String(port)],
    ["smtpUser", user],
    ["mailFrom", from],
    ...(pass ? ([[SMTP_PASS_KEY, pass]] as [string, string][]) : []),
  ];
  await prisma.$transaction(
    entries.map(([key, value]) => prisma.siteSetting.upsert({ where: { key }, create: { key, value }, update: { value } })),
  );
  updateTag("settings");
  revalidatePath("/admin/popup", "page");
  return { ok: true, message: "Đã lưu cấu hình máy chủ thư. Bấm “Kiểm tra kết nối” để thử." };
}

/** Thử kết nối + đăng nhập máy chủ thư bằng cấu hình ĐÃ LƯU (không gửi thư). */
export async function checkSmtp(_prev: FormResult, _fd: FormData): Promise<FormResult> {
  await requireAdmin();
  const r = await verifySmtp();
  const where = `${r.view.host}:${r.view.port} (${r.view.secure ? "SSL/TLS" : "STARTTLS"}) · ${r.view.user}`;
  revalidatePath("/admin/popup", "page");
  return r.ok
    ? { ok: true, message: `Kết nối & đăng nhập thành công: ${where}` }
    : { error: `Kiểm tra thất bại — ${where}: ${r.error}` };
}

/** Gửi một THƯ NHÁP ngắn (không dùng dữ liệu đơn) tới địa chỉ nhập vào, để kiểm tra thư có tới hộp thư không. */
export async function sendDraftEmail(_prev: FormResult, fd: FormData): Promise<FormResult> {
  await requireAdmin();
  const to = String(fd.get("to") ?? "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return { error: "Nhập địa chỉ email nhận thư nháp." };
  const when = new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "short", timeStyle: "medium" }).format(new Date());
  const text = `Đây là thư nháp kiểm tra cấu hình gửi mail của Tà Xùa Booking.\nGửi lúc: ${when} (giờ Việt Nam).\nNếu bạn đọc được thư này thì máy chủ web đã gửi mail thành công.`;
  const r = await sendMail({
    to,
    subject: `Thư nháp kiểm tra gửi mail – Tà Xùa Booking (${when})`,
    text,
    html: `<div style="font:15px/24px Arial,Helvetica,sans-serif;color:#1a2620;">${text.replace(/\n/g, "<br>")}</div>`,
  });
  revalidatePath("/admin/popup", "page");
  return r.ok ? { ok: true, message: `Đã gửi thư nháp tới ${to}. Kiểm tra cả mục Spam.` } : { error: `Gửi thất bại: ${r.error}` };
}
