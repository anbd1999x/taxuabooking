import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { toNumber, formatPrice } from "@/lib/format";
import { OrderManageCard } from "@/components/admin/OrderManageCard";

export const dynamic = "force-dynamic";

export default async function ProviderOrders() {
  const session = await getSession();
  const bookings = await prisma.bookingRequest.findMany({
    where: { service: { ownerId: session!.sub } },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { service: { select: { title: true } }, ctv: { select: { name: true } } },
  });

  // Hoa hồng phải trả CTV — chỉ tính đơn đã chốt.
  const settled = bookings.filter((b) => b.ctvId && ["CONFIRMED", "COMPLETED"].includes(b.status));
  const commTotal = settled.reduce((n, b) => n + (toNumber(b.commissionAmount) ?? 0), 0);
  const commPaid = settled.filter((b) => b.commissionPaid).reduce((n, b) => n + (toNumber(b.commissionAmount) ?? 0), 0);

  return (
    <div>
      <h1 className="text-2xl font-bold text-ink">Đơn & xác nhận</h1>
      <p className="mt-1 text-sm text-gray-500">
        Quy trình: <strong>Đặt phòng → Xác nhận giữ phòng → Đã cọc → Thanh toán đủ</strong>. Ghi nhận số tiền đã thu để biết còn thiếu; đánh dấu đã trả hoa hồng cho CTV.
      </p>

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="Hoa hồng CTV (đã chốt)" value={formatPrice(commTotal)} />
        <Stat label="Đã trả CTV" value={formatPrice(commPaid)} tone="ok" />
        <Stat label="Chưa trả CTV" value={formatPrice(commTotal - commPaid)} tone="warn" />
      </div>

      <div className="mt-5 space-y-3">
        {bookings.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-gray-300 bg-white py-12 text-center text-gray-500">Chưa có đơn nào.</p>
        ) : (
          bookings.map((b) => (
            <OrderManageCard
              key={b.id}
              b={{
                id: b.id,
                code: b.code,
                serviceTitle: b.serviceTitle,
                customerName: b.customerName,
                phone: b.phone,
                useDate: b.useDate,
                endDate: b.endDate,
                selectionLabel: b.selectionLabel,
                quantity: b.quantity,
                status: b.status,
                referencePrice: b.referencePrice,
                amountCollected: b.amountCollected,
                paymentStatus: b.paymentStatus,
                paidAt: b.paidAt,
                ctvName: b.ctv?.name ?? null,
                commissionAmount: b.commissionAmount,
                commissionPaid: b.commissionPaid,
                service: b.service,
              }}
            />
          ))
        )}
      </div>
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
