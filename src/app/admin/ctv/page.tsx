import Link from "next/link";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { toNumber, formatPrice, formatDate } from "@/lib/format";
import { BOOKING_STATUS_META } from "@/lib/constants";
import { setBookingCommissionPaid } from "@/app/admin/bookings/actions";

export const dynamic = "force-dynamic";

export default async function CtvHome() {
  const session = await getSession();
  const ctvId = session!.sub;

  const bookings = await prisma.bookingRequest.findMany({
    where: { ctvId },
    orderBy: { createdAt: "desc" },
    take: 10,
    include: { service: { select: { title: true } } },
  });
  const all = await prisma.bookingRequest.findMany({
    // Hoa hồng chỉ tính đơn đã chốt (xác nhận / hoàn thành).
    where: { ctvId, status: { in: ["CONFIRMED", "COMPLETED"] } },
    select: { commissionAmount: true, commissionPaid: true },
  });
  const commission = all.reduce((n, b) => n + (toNumber(b.commissionAmount) ?? 0), 0);
  const commissionPaid = all
    .filter((b) => b.commissionPaid)
    .reduce((n, b) => n + (toNumber(b.commissionAmount) ?? 0), 0);

  return (
    <div>
      <h1 className="text-2xl font-bold text-ink">Xin chào, {session!.name}</h1>
      <p className="mt-1 text-sm text-gray-500">Trang cộng tác viên — đặt đơn trên website, đơn sẽ tự ghi nhận cho bạn kèm hoa hồng.</p>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Đơn đã chốt" value={String(all.length)} />
        <Stat label="Hoa hồng (đã chốt)" value={formatPrice(commission)} />
        <Stat label="HH đã nhận" value={formatPrice(commissionPaid)} tone="ok" />
        <Stat label="HH chưa nhận" value={formatPrice(commission - commissionPaid)} tone="warn" />
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/" className="rounded-xl bg-sunset-500 px-5 py-3 text-sm font-semibold text-white hover:bg-sunset-600">+ Đặt đơn mới (trang web)</Link>
        <Link href="/admin/ctv/don" className="rounded-xl border border-forest-200 px-5 py-3 text-sm font-semibold text-forest-700 hover:bg-forest-50">Xem tất cả đơn của tôi</Link>
      </div>

      <h2 className="mt-8 text-lg font-semibold text-ink">Đơn gần đây</h2>
      <OrdersTable bookings={bookings} />
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "ok" | "warn" }) {
  return (
    <div className={`rounded-2xl p-4 shadow-sm ring-1 ${tone === "ok" ? "bg-forest-50 ring-forest-200" : tone === "warn" ? "bg-amber-50 ring-amber-200" : "bg-white ring-black/5"}`}>
      <p className="text-xl font-extrabold text-ink">{value}</p>
      <p className="mt-1 text-xs text-gray-500">{label}</p>
    </div>
  );
}

export function OrdersTable({
  bookings,
  settleCommission = false,
}: {
  bookings: {
    id: string;
    code: string;
    serviceTitle: string;
    useDate: Date;
    quantity: number;
    referencePrice: unknown;
    status: keyof typeof BOOKING_STATUS_META;
    paymentStatus: string;
    customerName?: string;
    service?: { title: string } | null;
    commissionAmount?: import("@prisma/client").Prisma.Decimal | number | string | null;
    commissionPaid?: boolean;
    // Đơn COMBO: bill tách từng bên (tiền phòng về homestay, tiền vé về nhà xe).
    category?: string;
    roomAmount?: unknown;
    busAmount?: unknown;
  }[];
  /** true ⇒ hiện nút đánh dấu "đã trả hoa hồng" (admin / chủ dịch vụ). */
  settleCommission?: boolean;
}) {
  return (
    <div className="mt-3 overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
          <tr>
            <th className="px-4 py-3">Mã</th>
            <th className="px-4 py-3">Dịch vụ</th>
            <th className="px-4 py-3 hidden sm:table-cell">Ngày dùng</th>
            <th className="px-4 py-3 text-right">Giá</th>
            <th className="px-4 py-3">Trạng thái</th>
            <th className="px-4 py-3 text-right">Hoa hồng</th>
            <th className="px-4 py-3">Trả HH</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {bookings.length === 0 ? (
            <tr><td colSpan={7} className="py-8 text-center text-gray-500">Chưa có đơn nào.</td></tr>
          ) : (
            bookings.map((b) => {
              const meta = BOOKING_STATUS_META[b.status];
              const comm = toNumber(b.commissionAmount) ?? 0;
              const settled = Boolean(b.commissionPaid);
              return (
                <tr key={b.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-semibold text-forest-700">{b.code}</td>
                  <td className="px-4 py-3">{b.service?.title ?? b.serviceTitle}</td>
                  <td className="px-4 py-3 hidden sm:table-cell text-gray-600">{formatDate(b.useDate)}</td>
                  <td className="px-4 py-3 text-right font-semibold">
                    {formatPrice(b.referencePrice as number)}
                    {b.category === "COMBO" && b.roomAmount != null && (
                      <div className="mt-0.5 whitespace-nowrap text-[11px] font-normal text-gray-500">
                        🛏 phòng {formatPrice(b.roomAmount as number)} · 🚌 xe {formatPrice(b.busAmount as number)}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3"><span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs">{meta.label}</span></td>
                  <td className="px-4 py-3 text-right font-semibold text-forest-700">{comm > 0 ? formatPrice(comm) : "—"}</td>
                  <td className="px-4 py-3">
                    {settleCommission && comm > 0 ? (
                      <form action={setBookingCommissionPaid}>
                        <input type="hidden" name="id" value={b.id} />
                        <input type="hidden" name="paid" value={settled ? "false" : "true"} />
                        <button className={`rounded-full px-2.5 py-1 text-xs font-medium ${settled ? "bg-forest-100 text-forest-700" : "bg-amber-100 text-amber-700"}`}>
                          {settled ? "Đã trả ✓" : "Chưa trả"}
                        </button>
                      </form>
                    ) : (
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${settled ? "bg-forest-100 text-forest-700" : "bg-gray-100 text-gray-500"}`}>
                        {settled ? "Đã trả" : comm > 0 ? "Chưa trả" : "—"}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
