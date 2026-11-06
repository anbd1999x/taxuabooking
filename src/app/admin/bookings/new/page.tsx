import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { CATEGORY_LIST } from "@/lib/constants";
import { toDateKey, today } from "@/lib/dates";
import AdminCreateBooking from "@/components/admin/AdminCreateBooking";

export const dynamic = "force-dynamic";

export default async function NewAdminBookingPage() {
  await requireAdmin();
  const [services, ctvs] = await Promise.all([
    prisma.service.findMany({
      select: { id: true, title: true, category: true, published: true },
      orderBy: [{ published: "desc" }, { priorityOrder: "desc" }, { title: "asc" }],
    }),
    prisma.adminUser.findMany({
      where: { role: "CTV" },
      select: { id: true, name: true, username: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href="/admin/bookings" className="text-sm font-semibold text-gray-500 hover:text-ink">
          ← Yêu cầu đặt
        </Link>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-ink">Tạo đơn hộ khách</h1>
        <p className="mt-1 text-sm text-gray-500">
          Nhập đơn khách gọi/nhắn trực tiếp. Chọn trạng thái <b>Đã xác nhận</b> sẽ giữ chỗ (trừ phòng/vé/xe) ngay.
        </p>
      </div>
      <AdminCreateBooking
        categories={CATEGORY_LIST.map((c) => ({ key: c.key, label: c.shortLabel, kind: c.availabilityKind }))}
        services={services.map((s) => ({
          id: s.id,
          title: s.title,
          // Bungalow đã gộp vào Homestay.
          category: s.category === "BUNGALOW" ? "HOMESTAY" : s.category,
          published: s.published,
        }))}
        ctvs={ctvs.map((c) => ({ id: c.id, name: c.name || c.username }))}
        todayKey={toDateKey(today())}
      />
    </div>
  );
}
