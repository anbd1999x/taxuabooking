import { NextResponse } from "next/server";
import { createSessionToken } from "@/lib/auth-token";
import { DEMO_COOKIE, DEMO_USERNAME, ensureFleetDemo } from "@/lib/fleet-demo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEMO_MAX_AGE = 60 * 60 * 12; // phiên demo 12 giờ

/** Chuyển hướng tương đối (sau proxy/Docker, request.url có thể mang host nội bộ). */
const go = (path: string) => new NextResponse(null, { status: 303, headers: { Location: path, "Cache-Control": "no-store" } });

/**
 * Nút "Mở bản demo" (/hop-tac/xe-may): dựng nhà xe demo (nếu cũ) → cấp cookie demo RIÊNG → mở /demo/quan-ly-xe
 * (trang độc lập, chỉ có màn hình quản lý xe; không đụng phiên đăng nhập quản trị).
 * ?reset=1 = làm mới dữ liệu mẫu · ?exit=1 = thoát demo về trang giới thiệu.
 */
export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  if (sp.get("exit")) {
    const res = go("/hop-tac/xe-may");
    res.cookies.delete(DEMO_COOKIE);
    return res;
  }
  const demo = await ensureFleetDemo(!!sp.get("reset"));
  const jwt = await createSessionToken({ sub: demo.ownerId, username: DEMO_USERNAME, name: demo.ownerName, role: "DEMO" });
  const res = go("/demo/quan-ly-xe");
  res.cookies.set(DEMO_COOKIE, jwt, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: DEMO_MAX_AGE });
  return res;
}
