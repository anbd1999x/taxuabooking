import "server-only";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { prisma } from "./prisma";
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

/**
 * JWT sống 7 ngày ⇒ phải kiểm lại tài khoản ở server: bị khoá / xoá / đổi vai trò thì phiên cũ hết hiệu lực ngay
 * (trước đây CTV / chủ cơ sở bị khoá vẫn thao tác được tới khi cookie hết hạn). Cache trong bộ nhớ ~60 giây để
 * không query DB mỗi request. Không kiểm ở proxy (edge, không có Prisma).
 */
const ACCOUNT_TTL_MS = 60_000;
const accountCache = new Map<string, { at: number; active: boolean; role: string }>();

/** Bỏ cache của một tài khoản (gọi sau khi khoá / xoá / đổi vai trò để có hiệu lực ngay, không chờ 60 giây). */
export function invalidateSessionCache(userId?: string): void {
  if (userId) accountCache.delete(userId);
  else accountCache.clear();
}

async function accountStillValid(s: SessionPayload): Promise<boolean> {
  // Phiên DEMO không ứng với đăng nhập thật (cookie demo riêng, vai trò không có trong DB) ⇒ giữ như cũ.
  if (s.role === "DEMO") return true;
  const now = Date.now();
  let c = accountCache.get(s.sub);
  if (!c || now - c.at > ACCOUNT_TTL_MS) {
    try {
      const u = await prisma.adminUser.findUnique({ where: { id: s.sub }, select: { active: true, role: true } });
      c = { at: now, active: !!u?.active, role: u?.role ?? "" };
      accountCache.set(s.sub, c);
      if (accountCache.size > 5_000) for (const [k, v] of accountCache) if (now - v.at > ACCOUNT_TTL_MS) accountCache.delete(k);
    } catch (e) {
      // DB lỗi tạm thời: dùng kết quả cache cũ nếu có, không thì cho qua (không đá văng mọi người khi DB chập chờn).
      console.error("[auth] kiểm tài khoản lỗi", e);
      return c ? c.active && c.role === s.role : true;
    }
  }
  return c.active && c.role === s.role;
}

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return null;
  const s = await verifySessionToken(token);
  if (!s) return null;
  return (await accountStillValid(s)) ? s : null;
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
