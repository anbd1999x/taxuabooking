import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { prisma } from "@/lib/prisma";
import { SITE } from "@/lib/site";

/**
 * Gửi email qua SMTP (nodemailer).
 * Cấu hình lấy theo thứ tự: SiteSetting do admin nhập ở /admin/popup (`smtpHost`, `smtpPort`,
 * `smtpUser`, `smtpPass`, `mailFrom`) → biến môi trường (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`,
 * `SMTP_PASS`, `MAIL_FROM`) → mặc định bên dưới. Kiểu bảo mật suy ra từ cổng (465 = SSL/TLS, còn lại STARTTLS).
 * `smtpPass` là bí mật: bị loại khỏi `getSettings()` và không bao giờ in ra giao diện; KHÔNG commit.
 * Chưa có mật khẩu ⇒ `mailConfigured()` = false, mọi lệnh gửi bỏ qua êm (đơn vẫn tạo bình thường).
 * Mỗi lần gửi ghi kết quả vào SiteSetting `mailLastResult` để admin xem lỗi gần nhất.
 */
export const SMTP_PASS_KEY = "smtpPass";
export const SMTP_KEYS = ["smtpHost", "smtpPort", "smtpUser", "mailFrom"] as const;
export const MAIL_LAST_RESULT_KEY = "mailLastResult";

export const SMTP_DEFAULTS = { host: "mail9234.maychuemail.com", port: 587, user: SITE.email as string };

export type SmtpConfig = { host: string; port: number; secure: boolean; user: string; pass: string; from: string };
/** Cấu hình để hiển thị (không kèm mật khẩu). */
export type SmtpView = Omit<SmtpConfig, "pass"> & { hasPass: boolean };
export type MailLastResult = { at: string; ok: boolean; to: string; subject: string; error?: string };

async function loadConfig(): Promise<SmtpConfig> {
  const rows = await prisma.siteSetting
    .findMany({ where: { key: { in: [...SMTP_KEYS, SMTP_PASS_KEY] } } })
    .catch(() => []);
  const db: Record<string, string> = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const host = db.smtpHost || process.env.SMTP_HOST || SMTP_DEFAULTS.host;
  const port = Number(db.smtpPort || process.env.SMTP_PORT || SMTP_DEFAULTS.port) || SMTP_DEFAULTS.port;
  const user = db.smtpUser || process.env.SMTP_USER || SMTP_DEFAULTS.user;
  return {
    host,
    port,
    // Kiểu bảo mật LUÔN suy ra từ cổng (465 = SSL/TLS ngay từ đầu; 587/25 = STARTTLS). Không cho chọn tay:
    // chọn lệch (vd 587 + SSL/TLS) gây lỗi "wrong version number" và không gửi được thư nào.
    secure: port === 465,
    user,
    pass: db.smtpPass || process.env.SMTP_PASS || "",
    from: db.mailFrom || process.env.MAIL_FROM || `${SITE.name} <${user}>`,
  };
}

export async function getSmtpView(): Promise<SmtpView> {
  const { pass, ...rest } = await loadConfig();
  return { ...rest, hasPass: Boolean(pass) };
}

export async function mailConfigured(): Promise<boolean> {
  return Boolean((await loadConfig()).pass);
}

function createTransport(c: SmtpConfig): Transporter {
  return nodemailer.createTransport({
    host: c.host,
    port: c.port,
    secure: c.secure,
    auth: { user: c.user, pass: c.pass },
    // Máy chủ thư này trả lời chào (banner 220) rất chậm: ~12 giây đo từ máy dev, lâu hơn nữa từ VPS.
    // Hạn 15 giây mặc định làm mọi lần gửi từ production lỗi "Greeting never received" ⇒ nới rộng.
    connectionTimeout: 30_000,
    greetingTimeout: 90_000,
    socketTimeout: 120_000,
  });
}

// Giữ kết nối theo cấu hình hiện tại; đổi mật khẩu/máy chủ ⇒ tạo transporter mới.
let cached: { key: string; t: Transporter } | null = null;
function transporterFor(c: SmtpConfig): Transporter {
  const key = `${c.host}|${c.port}|${c.secure}|${c.user}|${c.pass}`;
  if (cached?.key === key) return cached.t;
  cached = { key, t: createTransport(c) };
  return cached.t;
}

/** Diễn giải lỗi SMTP thường gặp sang tiếng Việt để admin biết sửa ở đâu. */
function explain(err: unknown): string {
  const e = err as { code?: string; responseCode?: number; message?: string };
  const raw = e?.message || String(err);
  const hint =
    /wrong version number/i.test(raw)
      ? "Cổng và kiểu bảo mật không khớp (cổng 587 dùng STARTTLS, cổng 465 dùng SSL/TLS) — kiểm tra lại ô Cổng."
      : e?.code === "EAUTH" || e?.responseCode === 535
      ? "Sai tài khoản hoặc mật khẩu hộp thư."
      : e?.code === "ETIMEDOUT" || e?.code === "ECONNREFUSED" || e?.code === "ESOCKET" || e?.code === "ECONNECTION"
        ? /greeting never received/i.test(raw)
          ? "Đã nối được tới máy chủ thư nhưng không nhận được lời chào trong thời gian chờ (máy chủ thư phản hồi quá chậm)."
          : "Máy chủ web không kết nối được tới máy chủ thư ở cổng này (nhà cung cấp VPS có thể chặn cổng gửi thư) — thử cổng khác (587 ↔ 465) hoặc nhờ nhà cung cấp VPS mở cổng."
        : e?.code === "EDNS" || e?.code === "ENOTFOUND"
          ? "Không tìm thấy tên máy chủ thư — kiểm tra lại ô Máy chủ SMTP."
          : "";
  return hint ? `${hint} (${raw})` : raw;
}

export type MailResult = { ok: true } | { ok: false; error: string };

/** Thử kết nối + đăng nhập SMTP bằng cấu hình hiện tại (không gửi thư). */
export async function verifySmtp(): Promise<MailResult & { view: SmtpView }> {
  const c = await loadConfig();
  const { pass, ...rest } = c;
  const view: SmtpView = { ...rest, hasPass: Boolean(pass) };
  if (!pass) return { ok: false, error: "Chưa nhập mật khẩu hộp thư.", view };
  const t = createTransport(c);
  try {
    await t.verify();
    return { ok: true, view };
  } catch (err) {
    return { ok: false, error: explain(err), view };
  } finally {
    t.close();
  }
}

async function recordResult(r: MailLastResult): Promise<void> {
  const value = JSON.stringify(r);
  await prisma.siteSetting
    .upsert({ where: { key: MAIL_LAST_RESULT_KEY }, create: { key: MAIL_LAST_RESULT_KEY, value }, update: { value } })
    .catch(() => {});
}

export async function getMailLastResult(): Promise<MailLastResult | null> {
  const row = await prisma.siteSetting.findUnique({ where: { key: MAIL_LAST_RESULT_KEY } }).catch(() => null);
  try {
    return row ? (JSON.parse(row.value) as MailLastResult) : null;
  } catch {
    return null;
  }
}

/**
 * Tên miền dành riêng cho thử nghiệm (RFC 2606 / 6761): example.com|net|org, *.test, *.example, *.invalid, *.localhost.
 * Không bao giờ nhận thư ⇒ gửi tới chỉ sinh thư báo lỗi (bounce) về hộp thư lienhe@ và làm xấu uy tín máy chủ gửi.
 * Script kiểm thử / dữ liệu mẫu dùng các địa chỉ này nên chặn ngay ở đây cho mọi luồng gửi.
 */
export function isTestAddress(to: string): boolean {
  const d = to.trim().toLowerCase().split("@").pop()?.replace(/\.$/, "") ?? "";
  return /(^|\.)example\.(com|net|org)$/.test(d) || /\.(test|example|invalid|localhost)$/.test(d) || d === "localhost";
}

export async function sendMail(opts: { to: string; subject: string; html: string; text: string }): Promise<MailResult> {
  if (isTestAddress(opts.to)) return { ok: false, error: "Địa chỉ thử nghiệm (example.com…), không gửi." };
  const c = await loadConfig();
  if (!c.pass) return { ok: false, error: "Chưa có mật khẩu hộp thư gửi (nhập ở /admin/popup)." };
  const base = { at: new Date().toISOString(), to: opts.to, subject: opts.subject };
  try {
    await transporterFor(c).sendMail({
      from: c.from,
      replyTo: SITE.email,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    });
    await recordResult({ ...base, ok: true });
    return { ok: true };
  } catch (err) {
    const error = explain(err);
    console.error("sendMail error", error);
    cached = null; // kết nối hỏng ⇒ lần sau tạo lại
    await recordResult({ ...base, ok: false, error });
    return { ok: false, error };
  }
}
