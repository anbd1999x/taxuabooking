import { NextResponse } from "next/server";
import crypto from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function originOf(req: Request): string {
  const h = req.headers;
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "taxuabooking.com";
  return `${proto}://${host}`;
}

export async function GET(req: Request) {
  const origin = originOf(req);
  const appId = process.env.FACEBOOK_APP_ID;
  if (!appId) return NextResponse.redirect(new URL("/tai-khoan?err=facebook_off", origin));

  const next = new URL(req.url).searchParams.get("next") || "/";
  const redirectUri = `${origin}/api/auth/facebook/callback`;
  const state = crypto.randomBytes(16).toString("hex");

  const auth = new URL("https://www.facebook.com/v19.0/dialog/oauth");
  auth.searchParams.set("client_id", appId);
  auth.searchParams.set("redirect_uri", redirectUri);
  auth.searchParams.set("response_type", "code");
  auth.searchParams.set("scope", "public_profile,email");
  auth.searchParams.set("state", state);

  const res = NextResponse.redirect(auth.toString());
  res.cookies.set("fb_oauth", `${state}|${next}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });
  return res;
}
