import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE_NAME, verifySessionToken } from "@/lib/auth-token";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  const isLogin = pathname === "/admin/login";
  const home = (r?: string) => (r === "CTV" ? "/admin/ctv" : r === "PROVIDER" ? "/admin/provider" : "/admin");

  if (isLogin) {
    if (session) return NextResponse.redirect(new URL(home(session.role), request.url));
    return NextResponse.next();
  }

  if (!session) {
    const url = new URL("/admin/login", request.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  const role = session.role;
  const isCtvArea = pathname.startsWith("/admin/ctv");
  const isProviderArea = pathname.startsWith("/admin/provider");
  // Chủ dịch vụ được vào "Lịch giá & tình trạng" (dữ liệu đã lọc theo ownerId trong trang/API).
  const isAvailability = pathname.startsWith("/admin/availability");

  if (isCtvArea) {
    if (role !== "CTV" && role !== "ADMIN") return NextResponse.redirect(new URL(home(role), request.url));
  } else if (isProviderArea) {
    if (role !== "PROVIDER" && role !== "ADMIN") return NextResponse.redirect(new URL(home(role), request.url));
  } else if (isAvailability) {
    if (role !== "ADMIN" && role !== "PROVIDER") return NextResponse.redirect(new URL(home(role), request.url));
  } else {
    // Khu vực quản trị đầy đủ: chỉ ADMIN.
    if (role !== "ADMIN") return NextResponse.redirect(new URL(home(role), request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
