import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { BOOKING_STATUS_META } from "@/lib/constants";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const [
    totalServices,
    publishedServices,
    featuredServices,
    newBookings,
    processingBookings,
    recentBookings,
  ] = await Promise.all([
    prisma.service.count(),
    prisma.service.count({ where: { published: true } }),
    prisma.service.count({ where: { featured: true } }),
    prisma.bookingRequest.count({ where: { status: "NEW" } }),
    prisma.bookingRequest.count({ where: { status: "CONTACTING" } }),
    prisma.bookingRequest.findMany({ orderBy: { createdAt: "desc" }, take: 6 }),
  ]);

  const stats = [
    { label: "Tổng bài đăng", value: totalServices, href: "/admin/services" },
    { label: "Đang hiển thị", value: publishedServices, href: "/admin/services" },
    { label: "Yêu cầu mới", value: newBookings, href: "/admin/bookings?status=NEW", accent: true },
    { label: "Đang xử lý", value: processingBookings, href: "/admin/bookings?status=CONTACTING" },
    { label: "Dịch vụ nổi bật", value: featuredServices, href: "/admin/services" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-ink">Tổng quan</h1>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className={`rounded-2xl p-4 shadow-sm ring-1 transition hover:shadow-md ${
              s.accent ? "bg-sunset-50 ring-sunset-200" : "bg-white ring-black/5"
            }`}
          >
            <p className="text-3xl font-extrabold text-forest-700">{s.value}</p>
            <p className="mt-1 text-xs text-gray-500">{s.label}</p>
          </Link>
        ))}
      </div>

      <div className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-ink">Yêu cầu gần đây</h2>
          <Link href="/admin/bookings" className="text-sm font-medium text-forest-700 hover:underline">
            Xem tất cả →
          </Link>
        </div>

        <div className="mt-3 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
          {recentBookings.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-500">Chưa có yêu cầu nào.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3">Mã</th>
                  <th className="px-4 py-3">Khách</th>
                  <th className="px-4 py-3 hidden sm:table-cell">Dịch vụ</th>
                  <th className="px-4 py-3 hidden md:table-cell">Ngày gửi</th>
                  <th className="px-4 py-3">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recentBookings.map((b) => {
                  const meta = BOOKING_STATUS_META[b.status];
                  return (
                    <tr key={b.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <Link href={`/admin/bookings/${b.id}`} className="font-semibold text-forest-700 hover:underline">
                          {b.code}
                        </Link>
                      </td>
                      <td className="px-4 py-3">{b.customerName}<br /><span className="text-xs text-gray-400">{b.phone}</span></td>
                      <td className="px-4 py-3 hidden sm:table-cell">{b.serviceTitle}</td>
                      <td className="px-4 py-3 hidden md:table-cell text-gray-500">{formatDate(b.createdAt)}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${toneClass(meta.tone)}`}>{meta.label}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function toneClass(tone: string) {
  switch (tone) {
    case "ok": return "bg-forest-100 text-forest-700";
    case "warn": return "bg-amber-100 text-amber-700";
    case "danger": return "bg-red-100 text-red-700";
    case "info": return "bg-sky-100 text-sky-700";
    default: return "bg-gray-100 text-gray-600";
  }
}
