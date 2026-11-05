import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE_NAME, verifySessionToken } from "@/lib/auth-token";
import { isIpBlocked, requestIp } from "@/lib/ip-block";

const BLOCKED_HTML = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Truy cập bị chặn</title></head><body style="font-family:system-ui,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;background:#f5f7f5;color:#1f2a24"><div style="max-width:420px;padding:24px;text-align:center"><h1 style="font-size:20px">Truy cập bị từ chối</h1><p style="color:#5b6660;line-height:1.6">Địa chỉ mạng của bạn đã bị chặn do phát hiện hoạt động bất thường. Nếu đây là nhầm lẫn, vui lòng liên hệ Tà Xùa Booking.</p></div></body></html>`;

/** Khu quản trị: đăng nhập + phân quyền theo vai trò (giữ nguyên logic middleware cũ). */
async function adminGuard(request: NextRequest) {
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

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // /admin + API quản trị KHÔNG bị chặn IP (tránh admin tự khoá mình; đã có đăng nhập).
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return adminGuard(request);
  if (pathname.startsWith("/api/admin")) return NextResponse.next();

  // Chặn IP trong danh sách đen (lỗi tra cứu → cho qua, không làm sập site).
  try {
    if (await isIpBlocked(requestIp(request.headers))) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Truy cập bị từ chối." }, { status: 403 });
      }
      return new NextResponse(BLOCKED_HTML, {
        status: 403,
        headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
      });
    }
  } catch {
    /* fail-open */
  }
  return NextResponse.next();
}

export const config = {
  // Mọi trang + API, trừ file tĩnh build (_next/static, _next/image), ảnh upload & icon.
  matcher: ["/((?!_next/static|_next/image|uploads/|favicon.ico|icon|apple-icon|manifest).*)"],
};
