import { SignJWT, jwtVerify } from "jose";

// Dùng được cả ở middleware (edge) lẫn server — KHÔNG import next/headers hay bcrypt ở đây.
export const AUTH_COOKIE_NAME = "taxua_admin";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 ngày

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("AUTH_SECRET chưa được cấu hình (cần >= 16 ký tự).");
  }
  return new TextEncoder().encode(secret);
}

export type Role = "ADMIN" | "CTV" | "PROVIDER";

export interface SessionPayload {
  sub: string;
  username: string;
  name: string;
  role: Role;
}

export async function createSessionToken(
  payload: SessionPayload,
): Promise<string> {
  return new SignJWT({ username: payload.username, name: payload.name, role: payload.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(getSecret());
}

export async function verifySessionToken(
  token: string,
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (!payload.sub) return null;
    const role = String(payload.role ?? "ADMIN");
    return {
      sub: payload.sub,
      username: String(payload.username ?? ""),
      name: String(payload.name ?? ""),
      role: (role === "CTV" || role === "PROVIDER" ? role : "ADMIN") as Role,
    };
  } catch {
    return null;
  }
}
