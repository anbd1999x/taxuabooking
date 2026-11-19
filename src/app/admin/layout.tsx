import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AdminShell } from "@/components/admin/AdminShell";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  // Trang đăng nhập (chưa có phiên) hiển thị không có sidebar.
  if (!session) {
    return <>{children}</>;
  }

  // Số đơn yêu cầu chưa xử lý (trạng thái NEW) để hiển thị badge trên menu.
  const badges: Record<string, number> = {};
  const hideNav: string[] = [];
  if (session.role === "ADMIN") {
    const [count, fbCount] = await Promise.all([
      prisma.bookingRequest.count({ where: { status: "NEW" } }),
      prisma.feedback.count({ where: { status: "NEW", hidden: false } }),
    ]);
    if (count > 0) badges["/admin/bookings"] = count;
    if (fbCount > 0) badges["/admin/feedback"] = fbCount;
  } else if (session.role === "PROVIDER") {
    const sub = session.sub;
    // Nhà xe cabin cũng thấy đơn COMBO đi qua chuyến của mình (như trang Đơn).
    const myTrips = await prisma.cabinTrip.findMany({
      where: { service: { ownerId: sub, category: "CABIN" } },
      select: { id: true },
    });
    const tripIds = myTrips.map((t) => t.id);
    const count = await prisma.bookingRequest.count({
      where: {
        status: "NEW",
        ...(tripIds.length
          ? {
              OR: [
                { service: { ownerId: sub } },
                { cabinTripId: { in: tripIds } },
                { cabinReturnTripId: { in: tripIds } },
              ],
            }
          : { service: { ownerId: sub } }),
      },
    });
    if (count > 0) badges["/admin/provider/don"] = count;
    // Menu "Quản lý xe máy" chỉ hiện cho chủ có dịch vụ thuê xe máy.
    if (!(await prisma.service.count({ where: { ownerId: sub, category: "MOTORBIKE" } }))) hideNav.push("/admin/provider/xe");
    // Menu "Vé & đặt bàn" chỉ hiện cho chủ có địa điểm bán vé / nhận đặt bàn.
    if (!(await prisma.ticketVenue.count({ where: { ownerId: sub } }))) hideNav.push("/admin/provider/ve");
    // Menu "Quản lý phòng" chỉ hiện cho chủ có homestay.
    if (!(await prisma.service.count({ where: { ownerId: sub, category: { in: ["HOMESTAY", "BUNGALOW"] } } }))) hideNav.push("/admin/provider/phong");
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
