import "server-only";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "./prisma";
import { vnPhoneError } from "./phone";

const COOKIE = "taxua_customer";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 ngày

function secret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) throw new Error("AUTH_SECRET chưa được cấu hình.");
  return new TextEncoder().encode(s);
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
}

/** Chuẩn hoá SĐT về dạng chỉ số (bỏ khoảng trắng, dấu +...). */
export function normalizePhone(raw: string): string {
  return (raw || "").replace(/\D/g, "");
}

async function setCookie(c: Customer): Promise<void> {
  const token = await new SignJWT({ name: c.name, phone: c.phone, kind: "customer" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(c.id)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());
  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function getCustomer(): Promise<Customer | null> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (!payload.sub || payload.kind !== "customer") return null;
    return { id: payload.sub, name: String(payload.name ?? ""), phone: String(payload.phone ?? "") };
  } catch {
    return null;
  }
}

export async function logoutCustomer(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
}

export async function registerCustomer(name: string, phoneRaw: string, password: string): Promise<{ error?: string }> {
  const phone = normalizePhone(phoneRaw);
  if (name.trim().length < 2) return { error: "Vui lòng nhập họ tên." };
  { const pe = vnPhoneError(phone); if (pe) return { error: pe }; }
  if (password.length < 6) return { error: "Mật khẩu tối thiểu 6 ký tự." };
  const existing = await prisma.customerUser.findUnique({ where: { phone } });
  if (existing) return { error: "Số điện thoại đã đăng ký — hãy đăng nhập." };
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.customerUser.create({ data: { name: name.trim(), phone, passwordHash, provider: "phone" } });
  await setCookie({ id: user.id, name: user.name, phone: user.phone ?? "" });
  return {};
}

export async function loginCustomer(phoneRaw: string, password: string): Promise<{ error?: string }> {
  const phone = normalizePhone(phoneRaw);
  const user = await prisma.customerUser.findUnique({ where: { phone } });
  if (!user || !user.passwordHash) return { error: "Sai số điện thoại hoặc mật khẩu." };
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return { error: "Sai số điện thoại hoặc mật khẩu." };
  await setCookie({ id: user.id, name: user.name, phone: user.phone ?? "" });
  return {};
}

/** Khi khách đã đăng nhập (vd bằng Google) đặt đơn: tự gắn SĐT vừa nhập vào tài
 *  khoản nếu tài khoản chưa có SĐT — để đơn hiện trong trang cá nhân. Lặng lẽ. */
export async function attachPhoneIfMissing(phoneRaw: string): Promise<void> {
  const customer = await getCustomer();
  if (!customer) return;
  const phone = normalizePhone(phoneRaw);
  if (!/^0\d{9}$/.test(phone)) return;
  const me = await prisma.customerUser.findUnique({ where: { id: customer.id } });
  if (!me || me.phone) return; // đã có SĐT → không ghi đè
  const taken = await prisma.customerUser.findUnique({ where: { phone } });
  if (taken && taken.id !== customer.id) return; // SĐT đã thuộc tài khoản khác
  const user = await prisma.customerUser.update({ where: { id: customer.id }, data: { phone } });
  await setCookie({ id: user.id, name: user.name, phone: user.phone ?? "" });
}

/** Cập nhật SĐT tài khoản (từ trang cá nhân) — có kiểm tra & phản hồi lỗi. */
export async function updateCustomerPhone(phoneRaw: string): Promise<{ error?: string }> {
  const customer = await getCustomer();
  if (!customer) return { error: "Bạn chưa đăng nhập." };
  const phone = normalizePhone(phoneRaw);
  { const pe = vnPhoneError(phone); if (pe) return { error: pe }; }
  const taken = await prisma.customerUser.findUnique({ where: { phone } });
  if (taken && taken.id !== customer.id) return { error: "Số điện thoại đã thuộc tài khoản khác." };
  const user = await prisma.customerUser.update({ where: { id: customer.id }, data: { phone } });
  await setCookie({ id: user.id, name: user.name, phone: user.phone ?? "" });
  return {};
}

/** Đăng nhập/đăng ký qua Google/Facebook: khớp theo providerId (hoặc email), tạo mới nếu chưa có. */
export async function loginWithOAuth(input: {
  provider: "google" | "facebook";
  providerId: string;
  email: string | null;
  name: string;
}): Promise<void> {
  let user = await prisma.customerUser.findFirst({
    where: { provider: input.provider, providerId: input.providerId },
  });
  if (!user && input.email) {
    const byEmail = await prisma.customerUser.findUnique({ where: { email: input.email } });
    if (byEmail) {
      user = await prisma.customerUser.update({
        where: { id: byEmail.id },
        data: { provider: input.provider, providerId: input.providerId, name: byEmail.name || input.name },
      });
    }
  }
  if (!user) {
    user = await prisma.customerUser.create({
      data: { provider: input.provider, providerId: input.providerId, email: input.email, name: input.name || "Khách" },
    });
  }
  await setCookie({ id: user.id, name: user.name, phone: user.phone ?? "" });
}
