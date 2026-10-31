import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { loginWithOAuth } from "@/lib/customer";

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

  if (!code || !returnedState || !savedState || returnedState !== savedState) {
    return NextResponse.redirect(new URL("/tai-khoan?err=oauth", origin));
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(new URL("/tai-khoan?err=google_off", origin));
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
    if (!tokenRes.ok) return NextResponse.redirect(new URL("/tai-khoan?err=token", origin));
    const tokens = (await tokenRes.json()) as { access_token?: string };
    if (!tokens.access_token) return NextResponse.redirect(new URL("/tai-khoan?err=token", origin));

    const uRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (!uRes.ok) return NextResponse.redirect(new URL("/tai-khoan?err=userinfo", origin));
    const info = (await uRes.json()) as { sub?: string; email?: string; name?: string };
    if (!info.sub) return NextResponse.redirect(new URL("/tai-khoan?err=userinfo", origin));

    await loginWithOAuth({
      provider: "google",
      providerId: String(info.sub),
      email: info.email ?? null,
      name: info.name || info.email || "Khách",
    });
    return NextResponse.redirect(new URL(safeNext(next), origin));
  } catch {
    return NextResponse.redirect(new URL("/tai-khoan?err=oauth", origin));
  }
}
