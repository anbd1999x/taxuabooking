import "server-only";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "./prisma";

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
  if (!/^0\d{9}$/.test(phone)) return { error: "Số điện thoại chưa đúng (10 số, bắt đầu bằng 0)." };
  if (password.length < 6) return { error: "Mật khẩu tối thiểu 6 ký tự." };
  const existing = await prisma.customerUser.findUnique({ where: { phone } });
  if (existing) return { error: "Số điện thoại đã đăng ký — hãy đăng nhập." };
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.customerUser.create({ data: { name: name.trim(), phone, passwordHash, provider: "phone" } });
  await setCookie({ id: user.id, name: user.name, phone: user.phone });
  return {};
}

export async function loginCustomer(phoneRaw: string, password: string): Promise<{ error?: string }> {
  const phone = normalizePhone(phoneRaw);
  const user = await prisma.customerUser.findUnique({ where: { phone } });
  if (!user || !user.passwordHash) return { error: "Sai số điện thoại hoặc mật khẩu." };
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return { error: "Sai số điện thoại hoặc mật khẩu." };
  await setCookie({ id: user.id, name: user.name, phone: user.phone });
  return {};
}
