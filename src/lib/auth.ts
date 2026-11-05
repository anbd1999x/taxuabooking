import "server-only";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import {
  AUTH_COOKIE_NAME,
  SESSION_MAX_AGE,
  verifySessionToken,
  type SessionPayload,
} from "./auth-token";

export { createSessionToken, verifySessionToken } from "./auth-token";
export type { SessionPayload } from "./auth-token";
export { AUTH_COOKIE_NAME } from "./auth-token";

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function setSessionCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(AUTH_COOKIE_NAME);
}

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

/**
 * Chốt quyền cho server action CHỈ DÀNH CHO ADMIN. Server action là endpoint công
 * khai (gọi được bằng action ID từ bất kỳ route nào) — middleware /admin KHÔNG bảo
 * vệ chúng, nên mọi action quản trị phải tự gọi hàm này ở dòng đầu.
 */
export async function requireAdmin(): Promise<SessionPayload> {
  const s = await getSession();
  if (!s || s.role !== "ADMIN") throw new Error("Không có quyền thực hiện thao tác này.");
  return s;
}
