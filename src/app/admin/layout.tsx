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
  if (session.role === "ADMIN") {
    const count = await prisma.bookingRequest.count({ where: { status: "NEW" } });
    if (count > 0) badges["/admin/bookings"] = count;
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
  }

  return (
    <AdminShell
      adminName={session.name}
      role={session.role}
      badges={badges}
      vapidKey={process.env.VAPID_PUBLIC_KEY ?? ""}
    >
      {children}
    </AdminShell>
  );
}
