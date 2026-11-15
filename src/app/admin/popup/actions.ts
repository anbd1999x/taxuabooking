"use server";

import { revalidatePath, updateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import type { FormResult } from "@/components/admin/ActionForm";
import { TRUST_POPUP_KEY, type TrustPopupConfig } from "@/lib/trust-popup";
import { mailConfigured, SMTP_PASS_KEY } from "@/lib/mail";
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
  const kind: BookingEmailKind = fd.get("kind") === "confirmed" ? "confirmed" : "received";
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
 * Lưu MẬT KHẨU HỘP THƯ GỬI (SMTP) vào SiteSetting `smtpPass` để bật gửi email ngay mà không cần sửa
 * .env trên máy chủ. Không bao giờ hiển thị lại giá trị đã lưu. Để trống + tick "xoá" ⇒ gỡ mật khẩu.
 */
export async function saveSmtpPass(_prev: FormResult, fd: FormData): Promise<FormResult> {
  await requireAdmin();
  const pass = String(fd.get("smtpPass") ?? "");
  if (fd.get("clear") === "on") {
    await prisma.siteSetting.deleteMany({ where: { key: SMTP_PASS_KEY } });
    revalidatePath("/admin/popup", "page");
    return { ok: true, message: "Đã xoá mật khẩu hộp thư. Web sẽ ngừng gửi email." };
  }
  if (pass.length < 4) return { error: "Nhập mật khẩu hộp thư lienhe@taxuabooking.com." };
  await prisma.siteSetting.upsert({
    where: { key: SMTP_PASS_KEY },
    create: { key: SMTP_PASS_KEY, value: pass },
    update: { value: pass },
  });
  revalidatePath("/admin/popup", "page");
  return { ok: true, message: "Đã lưu mật khẩu hộp thư. Bấm “Gửi thư thử” để kiểm tra." };
}
