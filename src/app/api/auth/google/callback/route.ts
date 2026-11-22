import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { loginWithOAuth } from "@/lib/customer";
import { loginPartnerWithGoogle } from "@/lib/partner-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function originOf(req: Request): string {
  const h = req.headers;
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "taxuabooking.com";
  return `${proto}://${host}`;
}

function safeNext(n: string): string {
  return n.startsWith("/") && !n.startsWith("//") ? n : "/";
}

export async function GET(req: Request) {
  const origin = originOf(req);
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const returnedState = url.searchParams.get("state");

  const store = await cookies();
  const raw = store.get("g_oauth")?.value ?? "";
  store.delete("g_oauth");
  const [savedState, next = "/"] = raw.split("|");
  // Chủ homestay đăng nhập khu quản trị (route.ts ?mode=partner) ⇒ lỗi quay về trang dùng thử.
  const partner = next === "partner";
  const fail = (code: string) => NextResponse.redirect(new URL(partner ? `/hop-tac/dang-ky?err=${code}` : `/tai-khoan?err=${code}`, origin));

  if (!code || !returnedState || !savedState || returnedState !== savedState) {
    return fail("oauth");
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return fail("google_off");
  }

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: `${origin}/api/auth/google/callback`,
        grant_type: "authorization_code",
      }),
    });
    if (!tokenRes.ok) return fail("token");
    const tokens = (await tokenRes.json()) as { access_token?: string };
    if (!tokens.access_token) return fail("token");

    const uRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (!uRes.ok) return fail("userinfo");
    const info = (await uRes.json()) as { sub?: string; email?: string; name?: string; email_verified?: boolean; picture?: string };
    if (!info.sub) return fail("userinfo");

    if (partner) {
      // Khu quản trị: chỉ nhận email Google ĐÃ XÁC MINH (email là khoá khớp tài khoản).
      if (!info.email || info.email_verified === false) return fail("email");
      const r = await loginPartnerWithGoogle({ email: info.email, name: info.name || "" });
      if ("error" in r) return fail(r.error);
      return NextResponse.redirect(new URL(r.next, origin));
    }

    await loginWithOAuth({
      provider: "google",
      providerId: String(info.sub),
      email: info.email ?? null,
      name: info.name || info.email || "Khách",
      avatar: info.picture ?? null,
    });
    return NextResponse.redirect(new URL(safeNext(next), origin));
  } catch {
    return fail("oauth");
  }
}
