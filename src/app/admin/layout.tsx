import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AdminShell } from "@/components/admin/AdminShell";

export const dynamic = "force-dynamic";

/** Header đường dẫn thật của request /admin — proxy (src/proxy.ts) phải GHI ĐÈ (không tin header client tự gửi). */
const ADMIN_PATH_HEADER = "x-admin-path";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  // Trang đăng nhập (chưa có phiên) hiển thị không có sidebar.
  if (!session) {
    // JWT còn hạn nhưng tài khoản bị khoá / xoá / đổi vai trò (proxy cho qua, getSession trả null) ⇒ về đăng nhập.
    // Layout không biết đường dẫn: đọc header ADMIN_PATH_HEADER do proxy ghi đè; chưa có header thì giữ hành vi cũ.
    const p = (await headers()).get(ADMIN_PATH_HEADER);
    if (p && p !== "/admin/login") redirect("/admin/login");
    return <>{children}</>;
  }

  // Số đơn yêu cầu chưa xử lý (trạng thái NEW) để hiển thị badge trên menu.
  const badges: Record<string, number> = {};
  const hideNav: string[] = [];
  if (session.role === "ADMIN") {
    const [count, fbCount, venueReview] = await Promise.all([
      prisma.bookingRequest.count({ where: { status: "NEW" } }),
      prisma.feedback.count({ where: { status: "NEW", hidden: false } }),
      prisma.ticketVenue.count({ where: { review: "pending" } }),
    ]);
    if (count > 0) badges["/admin/bookings"] = count;
    if (fbCount > 0) badges["/admin/feedback"] = fbCount;
    // Địa điểm vé / đặt bàn đối tác gửi duyệt.
    if (venueReview > 0) badges["/admin/provider/ve"] = venueReview;
    // Homestay của chủ tự đăng ký đang chờ duyệt hiển thị.
    const pendingSvc = await prisma.service.count({ where: { published: false, category: { in: ["HOMESTAY", "BUNGALOW"] }, owner: { selfSignup: true } } });
    if (pendingSvc > 0) badges["/admin/services"] = pendingSvc;
  } else if (session.role === "PROVIDER") {
    const sub = session.sub;
    // Nhà xe cabin cũng thấy đơn COMBO đi qua chuyến của mình (như trang Đơn).
    // Đếm bằng subquery trong DB (PERF-2): trước đây nạp TOÀN BỘ id chuyến rồi IN(...) hàng nghìn tham số
    // ở mỗi lần điều hướng. BookingRequest.cabinTripId không có relation Prisma nên dùng SQL thô.
    const [{ n }] = await prisma.$queryRaw<{ n: number }[]>`
      SELECT COUNT(*)::int AS n FROM "BookingRequest" b
      WHERE b."status" = 'NEW' AND (
        b."serviceId" IN (SELECT s.id FROM "Service" s WHERE s."ownerId" = ${sub})
        OR b."cabinTripId" IN (SELECT t.id FROM "CabinTrip" t JOIN "Service" s ON s.id = t."serviceId" WHERE s."ownerId" = ${sub} AND s."category" = 'CABIN')
        OR b."cabinReturnTripId" IN (SELECT t.id FROM "CabinTrip" t JOIN "Service" s ON s.id = t."serviceId" WHERE s."ownerId" = ${sub} AND s."category" = 'CABIN')
      )`;
    const count = Number(n);
    if (count > 0) badges["/admin/provider/don"] = count;
    // Đối tác TỰ ĐĂNG KÝ (/hop-tac/dang-ky): luôn có đủ 4 chức năng — Quản lý xe máy, Quản lý phòng, Vé & đặt bàn,
    // Gọi món QR (tab trong Vé & đặt bàn); chưa có dịch vụ thì trang của từng chức năng cho tự tạo. Không có tài khoản CTV.
    // Chủ do admin tạo: xe máy / phòng chỉ hiện khi có dịch vụ tương ứng, không tự sửa dịch vụ.
    // Menu "Vé & đặt bàn" luôn hiện cho chủ: chưa có địa điểm thì tự tạo (vé cổng / show / nhà hàng) rồi gửi admin duyệt.
    const me = await prisma.adminUser.findUnique({ where: { id: sub }, select: { selfSignup: true } });
    if (me?.selfSignup) hideNav.push("/admin/provider/ctv");
    else {
      hideNav.push("/admin/services");
      if (!(await prisma.service.count({ where: { ownerId: sub, category: "MOTORBIKE" } }))) hideNav.push("/admin/provider/xe");
      if (!(await prisma.service.count({ where: { ownerId: sub, category: { in: ["HOMESTAY", "BUNGALOW"] } } }))) hideNav.push("/admin/provider/phong");
    }
  } else if (session.role === "STAFF") {
    // Nhân viên: chỉ hiện việc mà chủ của mình có (giao xe / soát vé).
    const me = await prisma.adminUser.findUnique({ where: { id: session.sub }, select: { providerId: true, staffArea: true } });
    const ownerId = me?.providerId ?? "-";
    // Lễ tân (staffArea "phong") chỉ vào Quản lý phòng; nhân viên xe (xe/null) vào đội xe + soát vé, không vào phòng.
    if (me?.staffArea === "phong") {
      hideNav.push("/admin/provider/xe", "/admin/provider/soat-ve");
    } else {
      hideNav.push("/admin/provider/phong");
      const [venues, motos] = await Promise.all([
        prisma.ticketVenue.count({ where: { ownerId, kind: { not: "RESTAURANT" } } }),
        prisma.service.count({ where: { ownerId, category: "MOTORBIKE" } }),
      ]);
      if (!venues) hideNav.push("/admin/provider/soat-ve");
      if (!motos && venues) hideNav.push("/admin/provider/xe");
    }
  }

  return (
    <AdminShell
      adminName={session.name}
      role={session.role}
      badges={badges}
      hideNav={hideNav}
      vapidKey={process.env.VAPID_PUBLIC_KEY ?? ""}
    >
      {children}
    </AdminShell>
  );
}
