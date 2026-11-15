import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { prisma } from "@/lib/prisma";
import { SITE } from "@/lib/site";

/**
 * Gửi email qua SMTP (nodemailer).
 * Cấu hình: biến môi trường `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`
 * — thiếu thì dùng mặc định bên dưới (máy chủ thư của lienhe@taxuabooking.com).
 * MẬT KHẨU: ưu tiên env `SMTP_PASS`; không có thì đọc SiteSetting `smtpPass` do admin nhập ở
 * /admin/popup (để bật gửi thư trên production mà không cần sửa .env trên máy chủ). Khoá này bị loại
 * khỏi `getSettings()` nên không bao giờ lọt ra giao diện. KHÔNG commit mật khẩu vào mã nguồn.
 * Chưa có mật khẩu ⇒ `mailConfigured()` = false, mọi lệnh gửi bỏ qua êm (đơn vẫn tạo bình thường).
 */
export const SMTP_PASS_KEY = "smtpPass";

const DEFAULTS = { host: "mail9234.maychuemail.com", port: 587, user: SITE.email };

type SmtpConfig = { host: string; port: number; secure: boolean; user: string; pass: string; from: string };

async function smtpConfig(): Promise<SmtpConfig | null> {
  let pass = process.env.SMTP_PASS || "";
  if (!pass) {
    const row = await prisma.siteSetting.findUnique({ where: { key: SMTP_PASS_KEY } }).catch(() => null);
    pass = row?.value ?? "";
  }
  if (!pass) return null;
  const host = process.env.SMTP_HOST || DEFAULTS.host;
  const port = Number(process.env.SMTP_PORT || DEFAULTS.port);
  const user = process.env.SMTP_USER || DEFAULTS.user;
  return {
    host,
    port,
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : port === 465,
    user,
    pass,
    from: process.env.MAIL_FROM || `${SITE.name} <${user}>`,
  };
}

export async function mailConfigured(): Promise<boolean> {
  return (await smtpConfig()) != null;
}

// Giữ kết nối theo cấu hình hiện tại; đổi mật khẩu/máy chủ ⇒ tạo transporter mới.
let cached: { key: string; t: Transporter } | null = null;
function transporterFor(c: SmtpConfig): Transporter {
  const key = `${c.host}|${c.port}|${c.secure}|${c.user}|${c.pass}`;
  if (cached?.key === key) return cached.t;
  const t = nodemailer.createTransport({
    host: c.host,
    port: c.port,
    secure: c.secure,
    auth: { user: c.user, pass: c.pass },
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000,
  });
  cached = { key, t };
  return t;
}

export type MailResult = { ok: true } | { ok: false; error: string };

export async function sendMail(opts: { to: string; subject: string; html: string; text: string }): Promise<MailResult> {
  const c = await smtpConfig();
  if (!c) return { ok: false, error: "Chưa có mật khẩu hộp thư gửi (nhập ở /admin/popup hoặc đặt SMTP_PASS)." };
  try {
    await transporterFor(c).sendMail({
      from: c.from,
      replyTo: SITE.email,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    });
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("sendMail error", msg);
    return { ok: false, error: msg };
  }
}
