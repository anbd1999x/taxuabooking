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
  const raw = store.get("fb_oauth")?.value ?? "";
  store.delete("fb_oauth");
  const [savedState, next = "/"] = raw.split("|");

  if (!code || !returnedState || !savedState || returnedState !== savedState) {
    return NextResponse.redirect(new URL("/tai-khoan?err=oauth", origin));
  }

  const appId = process.env.FACEBOOK_APP_ID;
  const appSecret = process.env.FACEBOOK_APP_SECRET;
  if (!appId || !appSecret) {
    return NextResponse.redirect(new URL("/tai-khoan?err=facebook_off", origin));
  }

  try {
    const redirectUri = `${origin}/api/auth/facebook/callback`;
    const tokenUrl = new URL("https://graph.facebook.com/v19.0/oauth/access_token");
    tokenUrl.searchParams.set("client_id", appId);
    tokenUrl.searchParams.set("client_secret", appSecret);
    tokenUrl.searchParams.set("redirect_uri", redirectUri);
    tokenUrl.searchParams.set("code", code);
    const tokenRes = await fetch(tokenUrl, { method: "GET" });
    if (!tokenRes.ok) return NextResponse.redirect(new URL("/tai-khoan?err=token", origin));
    const tokens = (await tokenRes.json()) as { access_token?: string };
    if (!tokens.access_token) return NextResponse.redirect(new URL("/tai-khoan?err=token", origin));

    const meUrl = new URL("https://graph.facebook.com/v19.0/me");
    meUrl.searchParams.set("fields", "id,name,email");
    meUrl.searchParams.set("access_token", tokens.access_token);
    const meRes = await fetch(meUrl, { method: "GET" });
    if (!meRes.ok) return NextResponse.redirect(new URL("/tai-khoan?err=userinfo", origin));
    const info = (await meRes.json()) as { id?: string; name?: string; email?: string };
    if (!info.id) return NextResponse.redirect(new URL("/tai-khoan?err=userinfo", origin));

    await loginWithOAuth({
      provider: "facebook",
      providerId: String(info.id),
      email: info.email ?? null,
      name: info.name || info.email || "Khách",
    });
    return NextResponse.redirect(new URL(safeNext(next), origin));
  } catch {
    return NextResponse.redirect(new URL("/tai-khoan?err=oauth", origin));
  }
}
