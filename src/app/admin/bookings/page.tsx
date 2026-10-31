import Link from "next/link";
import type { Prisma, BookingStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { BOOKING_STATUS_META, BOOKING_STATUS_LIST, CATEGORIES } from "@/lib/constants";
import { formatPrice, formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

function str(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

export default async function AdminBookingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const status = str(sp.status) as BookingStatus | undefined;
  const q = str(sp.q);

  const where: Prisma.BookingRequestWhereInput = {};
  if (status && BOOKING_STATUS_LIST.includes(status)) where.status = status;
  if (q) {
    where.OR = [
      { code: { contains: q, mode: "insensitive" } },
      { customerName: { contains: q, mode: "insensitive" } },
      { phone: { contains: q } },
    ];
  }

  const bookings = await prisma.bookingRequest.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-ink">Yêu cầu đặt dịch vụ</h1>

      <form className="mt-4 flex flex-wrap gap-2" action="/admin/bookings">
        <input name="q" defaultValue={q ?? ""} placeholder="Mã, tên hoặc SĐT..." className="rounded-xl border border-gray-200 px-3 py-2 text-sm" />
        <select name="status" defaultValue={status ?? ""} className="rounded-xl border border-gray-200 px-3 py-2 text-sm">
          <option value="">Tất cả trạng thái</option>
          {BOOKING_STATUS_LIST.map((st) => (
            <option key={st} value={st}>{BOOKING_STATUS_META[st].label}</option>
          ))}
        </select>
        <button className="rounded-xl bg-forest-100 px-4 py-2 text-sm font-medium text-forest-700">Lọc</button>
      </form>

      <div className="mt-4 overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">Mã</th>
              <th className="px-4 py-3">Khách</th>
              <th className="px-4 py-3 hidden sm:table-cell">Dịch vụ</th>
              <th className="px-4 py-3 hidden md:table-cell">Ngày dùng</th>
              <th className="px-4 py-3 hidden lg:table-cell">Giá tham khảo</th>
              <th className="px-4 py-3">Trạng thái</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {bookings.length === 0 ? (
              <tr><td colSpan={6} className="py-10 text-center text-gray-500">Không có yêu cầu nào.</td></tr>
            ) : (
              bookings.map((b) => {
                const meta = BOOKING_STATUS_META[b.status];
                return (
                  <tr key={b.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link href={`/admin/bookings/${b.id}`} className="font-semibold text-forest-700 hover:underline">{b.code}</Link>
                      {b.needsConfirmation && <div className="text-[10px] font-medium text-sky-600">cần xác nhận</div>}
                    </td>
                    <td className="px-4 py-3">{b.customerName}<br /><span className="text-xs text-gray-400">{b.phone}</span></td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      {b.serviceId ? (
                        <Link href={`/admin/services/${b.serviceId}`} className="text-forest-700 hover:underline">{b.serviceTitle}</Link>
                      ) : b.serviceTitle}
                      <div className="text-xs text-gray-400">{CATEGORIES[b.category].shortLabel}{b.selectionLabel ? ` · ${b.selectionLabel}` : ""}</div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-gray-600">
                      {formatDate(b.useDate)}{b.endDate ? ` → ${formatDate(b.endDate)}` : ""}
                      <div className="text-xs text-gray-400">SL: {b.quantity}</div>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">{formatPrice(b.referencePrice)}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${toneClass(meta.tone)}`}>{meta.label}</span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
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
