import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CATEGORIES } from "@/lib/constants";
import { formatPrice, formatDate, formatDateTime } from "@/lib/format";
import { BookingStatusForm } from "@/components/admin/BookingStatusForm";
import { toNumber } from "@/lib/format";
import { MoneyInput } from "@/components/admin/MoneyInput";
import { setBookingPaymentStep, setBookingCommissionPaid } from "../actions";

export const dynamic = "force-dynamic";

export default async function BookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const b = await prisma.bookingRequest.findUnique({
    where: { id },
    include: { service: { include: { owner: true } }, ctv: true },
  });
  if (!b) notFound();

  const cat = CATEGORIES[b.category];

  return (
    <div className="max-w-3xl">
      <nav className="mb-3 text-sm text-gray-500">
        <Link href="/admin/bookings" className="hover:text-forest-700">Yêu cầu đặt</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-700">{b.code}</span>
      </nav>

      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-ink">Mã {b.code}</h1>
            {b.needsConfirmation && (
              <span className="rounded-full bg-sky-100 px-2.5 py-1 text-xs font-medium text-sky-700">Cần xác nhận lại</span>
            )}
          </div>
          <p className="mt-1 text-sm text-gray-400">Gửi lúc {formatDateTime(b.createdAt)}</p>

          <dl className="mt-5 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 text-sm">
            <Row label="Khách hàng" value={b.customerName} />
            <Row label="Số điện thoại" value={<a href={`tel:${b.phone}`} className="text-forest-700">{b.phone}</a>} />
            <Row label="Dịch vụ" value={
              b.service ? (
                <Link href={`/admin/services/${b.service.id}`} className="text-forest-700 hover:underline">{b.serviceTitle}</Link>
              ) : b.serviceTitle
            } />
            <Row label="Danh mục" value={cat.shortLabel} />
            {b.selectionLabel && <Row label="Lựa chọn" value={b.selectionLabel} />}
            <Row label="Ngày dùng" value={`${formatDate(b.useDate)}${b.endDate ? ` → ${formatDate(b.endDate)}` : ""}`} />
            {b.nights != null && <Row label="Số đêm/ngày" value={String(b.nights)} />}
            <Row label="Số lượng" value={String(b.quantity)} />
            <Row label="Giá tham khảo" value={formatPrice(b.referencePrice)} />
          </dl>

          {b.note && (
            <div className="mt-4 rounded-xl bg-gray-50 p-3 text-sm">
              <p className="text-xs font-medium text-gray-500">Ghi chú của khách</p>
              <p className="mt-1 text-gray-700">{b.note}</p>
            </div>
          )}

          <div className="mt-5 flex gap-2">
            <a href={`tel:${b.phone}`} className="rounded-xl bg-forest-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-forest-700">📞 Gọi khách</a>
            <a href={`https://zalo.me/${b.phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="rounded-xl bg-sunset-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sunset-600">💬 Zalo</a>
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
            <h2 className="mb-3 text-lg font-semibold text-ink">Xử lý</h2>
            <BookingStatusForm id={b.id} status={b.status} adminNote={b.adminNote} />
          </div>

          {/* CTV & thanh toán */}
          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
            <h2 className="mb-3 text-lg font-semibold text-ink">CTV & thanh toán</h2>
            <div className="space-y-2 text-sm">
              <p><span className="text-gray-500">CTV đặt: </span>{b.ctv ? `${b.ctv.name}${b.ctv.phone ? ` · ${b.ctv.phone}` : ""}` : "Khách tự đặt (không qua CTV)"}</p>
              {b.ctvId && (
                <div className="rounded-xl bg-gray-50 p-3">
                  <p>
                    <span className="text-gray-500">Hoa hồng CTV: </span>
                    <span className="font-semibold text-forest-700">{formatPrice(toNumber(b.commissionAmount) ?? 0)}</span>
                    <span className={`ml-2 rounded-full px-2.5 py-0.5 text-xs font-medium ${b.commissionPaid ? "bg-forest-100 text-forest-700" : "bg-amber-100 text-amber-700"}`}>
                      {b.commissionPaid ? `Đã trả${b.commissionPaidAt ? ` · ${formatDate(b.commissionPaidAt)}` : ""}` : "Chưa trả"}
                    </span>
                  </p>
                  <form action={setBookingCommissionPaid} className="pt-2">
                    <input type="hidden" name="id" value={b.id} />
                    <input type="hidden" name="paid" value={b.commissionPaid ? "false" : "true"} />
                    {b.commissionPaid ? (
                      <button className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50">↩ Đánh dấu CHƯA trả HH</button>
                    ) : (
                      <button className="rounded-lg bg-forest-600 px-3 py-2 text-xs font-semibold text-white hover:bg-forest-700">✓ Đã trả hoa hồng cho CTV</button>
                    )}
                  </form>
                </div>
              )}
              <p>
                <span className="text-gray-500">Chủ dịch vụ: </span>
                {b.service?.owner ? b.service.owner.name : "Chưa gán"}
              </p>
              <PaymentBox
                id={b.id}
                price={toNumber(b.referencePrice) ?? 0}
                collected={toNumber(b.amountCollected) ?? 0}
                status={b.paymentStatus}
                paidAt={b.paidAt}
              />
            </div>
          </div>

          {/* Nhà cung cấp (homestay / nhà xe) */}
          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
            <h2 className="mb-3 text-lg font-semibold text-ink">Nhà cung cấp</h2>
            {b.service ? (
              <div className="space-y-2 text-sm">
                <p className="text-xs text-gray-500">{cat.label}</p>
                <p className="font-semibold text-ink">{b.service.title}</p>
                {b.service.contactName && (
                  <p><span className="text-gray-500">Chủ / phụ trách: </span>{b.service.contactName}</p>
                )}
                {b.service.contactPhone && (
                  <p><span className="text-gray-500">Điện thoại: </span><a href={`tel:${b.service.contactPhone.replace(/\s/g, "")}`} className="font-medium text-forest-700">{b.service.contactPhone}</a></p>
                )}
                <div className="flex flex-wrap gap-2 pt-2">
                  {b.service.contactPhone && (
                    <a href={`tel:${b.service.contactPhone.replace(/\s/g, "")}`} className="rounded-lg bg-forest-600 px-3 py-2 text-xs font-semibold text-white hover:bg-forest-700">📞 Gọi nhà cung cấp</a>
                  )}
                  {b.service.contactZalo && (
                    <a href={`https://zalo.me/${b.service.contactZalo}`} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-sunset-500 px-3 py-2 text-xs font-semibold text-white hover:bg-sunset-600">💬 Zalo</a>
                  )}
                  <Link href={`/admin/services/${b.service.id}`} className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50">Quản lý bài đăng</Link>
                  <Link href={`/${cat.slug}/${b.service.slug}`} target="_blank" className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50">Xem website ↗</Link>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500">Bài đăng đã bị xoá. Tên lúc đặt: {b.serviceTitle}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PaymentBox({
  id,
  price,
  collected,
  status,
  paidAt,
}: {
  id: string;
  price: number;
  collected: number;
  status: "UNPAID" | "DEPOSITED" | "PAID";
  paidAt: Date | null;
}) {
  const owed = Math.max(0, price - collected);
  const label = status === "PAID" ? "Đã thanh toán đủ" : status === "DEPOSITED" ? "Đã cọc" : "Chưa thu";
  const tone = status === "PAID" ? "bg-forest-100 text-forest-700" : status === "DEPOSITED" ? "bg-sky-100 text-sky-700" : "bg-amber-100 text-amber-700";
  return (
    <div className="rounded-xl bg-gray-50 p-3">
      <p className="flex flex-wrap items-center gap-2">
        <span className="text-gray-500">Thanh toán khách:</span>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${tone}`}>{label}</span>
        {status === "PAID" && paidAt && <span className="text-xs text-gray-400">· {formatDate(paidAt)}</span>}
      </p>
      <div className="mt-2 grid grid-cols-3 gap-2 text-center text-xs">
        <div><div className="text-gray-400">Giá đơn</div><div className="font-semibold text-ink">{formatPrice(price)}</div></div>
        <div><div className="text-gray-400">Đã thu</div><div className="font-semibold text-forest-700">{formatPrice(collected)}</div></div>
        <div><div className="text-gray-400">Còn thiếu</div><div className="font-semibold text-amber-700">{formatPrice(owed)}</div></div>
      </div>
      <form action={setBookingPaymentStep} className="mt-3 space-y-2">
        <input type="hidden" name="id" value={id} />
        <label className="block text-xs text-gray-500">Số tiền đã thu (cho bước Đã cọc)
          <MoneyInput name="amountCollected" defaultValue={collected || ""} placeholder="VD 500.000" className="mt-1 w-full rounded-lg border border-gray-200 px-2.5 py-2 text-sm" />
        </label>
        <div className="flex flex-wrap gap-1.5">
          <button name="status" value="DEPOSITED" className="rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-700">Đánh dấu Đã cọc</button>
          <button name="status" value="PAID" className="rounded-lg bg-forest-600 px-3 py-2 text-xs font-semibold text-white hover:bg-forest-700">Thanh toán đủ</button>
          <button name="status" value="UNPAID" className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50">Về Chưa thu</button>
        </div>
      </form>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="mt-0.5 font-medium text-ink">{value}</dd>
    </div>
  );
}
