import { NextResponse } from "next/server";
import { createSessionToken } from "@/lib/auth-token";
import { DEMO_COOKIE, DEMO_USERNAME, ensureFleetDemo } from "@/lib/fleet-demo";
import { DEMO_MODULES, DEMO_PATH, ensureStayDemo, ensureTicketDemo } from "@/lib/module-demo";
import { demoGate } from "@/lib/demo-rate";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

const DEMO_MAX_AGE = 60 * 60 * 12; // phiên demo 12 giờ
/** Chuyển hướng tương đối (sau proxy/Docker, request.url có thể mang host nội bộ). */
const go = (path: string) => new NextResponse(null, { status: 303, headers: { Location: path, "Cache-Control": "no-store" } });

/**
 * Nút "Mở bản demo" ở /hop-tac: ?m=xe|home|ticket|qr ⇒ dựng dữ liệu mẫu của module đó (nếu cũ) → cấp cookie demo RIÊNG
 * (vai trò DEMO, không đụng phiên quản trị) → mở trang demo độc lập /demo/….
 * ?reset=1 = làm mới dữ liệu mẫu · ?exit=1 = thoát demo về trang giới thiệu.
 */
export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  const m = DEMO_MODULES.find((k) => k === sp.get("m")) ?? "qr";
  if (sp.get("exit")) {
    const res = go("/hop-tac"); // thoát demo ⇒ về trang giới thiệu, mở sẵn Gọi món QR (module đứng đầu)
    res.cookies.delete(DEMO_COOKIE);
    return res;
  }
  // Giới hạn tần suất theo IP; ?reset=1 chỉ nhận khi đang có cookie demo (chống bot / gọi lặp xoá-dựng dữ liệu prod).
  const gate = demoGate(request, !!sp.get("reset"));
  if ("blocked" in gate) return gate.blocked;
  const force = gate.force;
  const demo = m === "xe" ? await ensureFleetDemo(force) : m === "home" ? await ensureStayDemo(force) : await ensureTicketDemo(force);
  const jwt = await createSessionToken({ sub: demo.ownerId, username: DEMO_USERNAME, name: demo.ownerName, role: "DEMO" });
  const res = go(DEMO_PATH[m]);
  res.cookies.set(DEMO_COOKIE, jwt, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: DEMO_MAX_AGE });
  return res;
}
