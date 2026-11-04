import { toNumber, formatPrice, formatDate } from "@/lib/format";
import { BOOKING_STATUS_META } from "@/lib/constants";
import { MoneyInput } from "@/components/admin/MoneyInput";
import {
  advanceBookingStatus,
  setBookingPaymentStep,
  setBookingCommissionPaid,
} from "@/app/admin/bookings/actions";

export interface ManageBooking {
  id: string;
  code: string;
  serviceTitle: string;
  customerName: string;
  phone: string;
  useDate: Date;
  endDate: Date | null;
  selectionLabel: string | null;
  quantity: number;
  status: keyof typeof BOOKING_STATUS_META;
  referencePrice: unknown;
  amountCollected: unknown;
  paymentStatus: "UNPAID" | "DEPOSITED" | "PAID";
  paidAt: Date | null;
  ctvName?: string | null;
  commissionAmount?: unknown;
  commissionPaid?: boolean;
  service?: { title: string } | null;
  /** Đơn combo xem từ phía 1 bên: giá hiển thị = phần tiền của bên đó. */
  displayPrice?: number | null;
  /** Chú thích cạnh giá (vd "Phần tiền phòng của combo"). */
  priceNote?: string | null;
  /** Chiết khấu từng căn (đ) — tiền thực nhận = giá bán − chiết khấu. */
  roomCommission?: unknown;
}

const PAY_LABEL = { UNPAID: "Chưa thu", DEPOSITED: "Đã cọc", PAID: "Đã thanh toán đủ" } as const;
const PAY_TONE = {
  UNPAID: "bg-amber-100 text-amber-700",
  DEPOSITED: "bg-sky-100 text-sky-700",
  PAID: "bg-forest-100 text-forest-700",
} as const;

/**
 * Thẻ quản lý 1 đơn: xác nhận từng bước (giữ phòng → cọc → thanh toán) + trả hoa hồng CTV.
 * viewOnly (đơn combo phía chủ dịch vụ): chỉ hiển thị thông tin + phần tiền của bên đó,
 * không có nút đổi trạng thái/thu tiền — combo do Tà Xùa Booking điều phối.
 */
export function OrderManageCard({ b, viewOnly = false }: { b: ManageBooking; viewOnly?: boolean }) {
  const price = b.displayPrice ?? toNumber(b.referencePrice as never) ?? 0;
  const collected = toNumber(b.amountCollected as never) ?? 0;
  const owed = Math.max(0, price - collected);
  const meta = BOOKING_STATUS_META[b.status];
  const comm = toNumber(b.commissionAmount as never) ?? 0;
  const discount = toNumber(b.roomCommission as never) ?? 0; // chiết khấu từng căn
  const net = Math.max(0, price - discount); // tiền thực nhận

  // Các bước vòng đời còn có thể chuyển tới.
  const steps: { status: string; label: string; cls: string }[] = [];
  if (b.status === "NEW") {
    steps.push({ status: "CONFIRMED", label: "✓ Xác nhận giữ phòng", cls: "bg-forest-600 text-white hover:bg-forest-700" });
    steps.push({ status: "CANCELLED", label: "Huỷ", cls: "border border-gray-200 text-gray-600 hover:bg-gray-50" });
  } else if (b.status === "CONFIRMED") {
    steps.push({ status: "COMPLETED", label: "✓ Hoàn thành", cls: "bg-forest-600 text-white hover:bg-forest-700" });
    steps.push({ status: "CANCELLED", label: "Huỷ", cls: "border border-gray-200 text-gray-600 hover:bg-gray-50" });
  } else if (b.status === "CANCELLED") {
    steps.push({ status: "NEW", label: "↩ Mở lại", cls: "border border-gray-200 text-gray-600 hover:bg-gray-50" });
  } else if (b.status === "COMPLETED") {
    steps.push({ status: "CANCELLED", label: "Huỷ", cls: "border border-gray-200 text-gray-600 hover:bg-gray-50" });
  }

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
      {/* Đầu thẻ */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-forest-700">{b.code}</p>
          <p className="text-sm font-medium text-ink">{b.service?.title ?? b.serviceTitle}</p>
          {b.selectionLabel && <p className="text-xs text-gray-500">{b.selectionLabel}</p>}
        </div>
        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">{meta.label}</span>
      </div>

      <div className="mt-2 text-sm text-gray-600">
        <span className="font-medium text-ink">{b.customerName}</span> · <a href={`tel:${b.phone}`} className="text-forest-700">{b.phone}</a>
        <span className="text-gray-400"> · {formatDate(b.useDate)}{b.endDate ? ` → ${formatDate(b.endDate)}` : ""} · {b.quantity} </span>
        {b.ctvName && <span className="ml-1 rounded bg-sky-50 px-1.5 py-0.5 text-xs text-sky-700">CTV: {b.ctvName}</span>}
      </div>

      {/* Bước 1: vòng đời đơn */}
      {!viewOnly && steps.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {steps.map((s) => (
            <form action={advanceBookingStatus} key={s.status}>
              <input type="hidden" name="id" value={b.id} />
              <input type="hidden" name="status" value={s.status} />
              <button className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${s.cls}`}>{s.label}</button>
            </form>
          ))}
        </div>
      )}

      {/* Bước 2: thanh toán của khách */}
      <div className="mt-3 rounded-xl bg-gray-50 p-3">
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-gray-500">Thanh toán khách:</span>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${PAY_TONE[b.paymentStatus]}`}>{PAY_LABEL[b.paymentStatus]}</span>
          {b.priceNote && <span className="rounded-full bg-sunset-50 px-2.5 py-0.5 text-xs font-medium text-sunset-700">{b.priceNote}</span>}
        </p>
        {viewOnly ? (
          <div className="mt-2 text-center text-xs">
            <div className="text-gray-400">{b.priceNote ? "Tiền của bạn trong đơn này" : "Giá đơn"}</div>
            <div className="text-base font-bold text-ink">{formatPrice(discount > 0 ? net : price)}</div>
            {discount > 0 && (
              <div className="mt-0.5 text-[11px] text-gray-400">Giá bán {formatPrice(price)} − chiết khấu {formatPrice(discount)}</div>
            )}
          </div>
        ) : (
          <>
            <div className="mt-2 grid grid-cols-3 gap-2 text-center text-xs">
              <div><div className="text-gray-400">Giá bán</div><div className="font-semibold text-ink">{formatPrice(price)}</div></div>
              <div><div className="text-gray-400">Đã thu</div><div className="font-semibold text-forest-700">{formatPrice(collected)}</div></div>
              <div><div className="text-gray-400">Còn thiếu</div><div className="font-semibold text-amber-700">{formatPrice(owed)}</div></div>
            </div>
            {discount > 0 && (
              <div className="mt-2 flex items-center justify-between rounded-lg bg-forest-50 px-2.5 py-1.5 text-xs">
                <span className="text-gray-500">Chiết khấu từng căn <b className="text-amber-700">−{formatPrice(discount)}</b></span>
                <span className="font-bold text-forest-700">Thực nhận {formatPrice(net)}</span>
              </div>
            )}
            <form action={setBookingPaymentStep} className="mt-2 flex flex-wrap items-end gap-1.5">
              <input type="hidden" name="id" value={b.id} />
              <label className="text-xs text-gray-500">Số tiền đã thu
                <MoneyInput name="amountCollected" defaultValue={collected || ""} placeholder="VD 500.000" className="mt-0.5 w-32 rounded-lg border border-gray-200 px-2 py-1.5 text-sm" />
              </label>
              <button name="status" value="DEPOSITED" className="rounded-lg bg-sky-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-sky-700">Đã cọc</button>
              <button name="status" value="PAID" className="rounded-lg bg-forest-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-forest-700">Thanh toán đủ</button>
              <button name="status" value="UNPAID" className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-white">Về chưa thu</button>
            </form>
          </>
        )}
      </div>

      {/* Bước 3: hoa hồng CTV */}
      {!viewOnly && b.ctvName && comm > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-gray-500">Hoa hồng CTV:</span>
          <span className="font-semibold text-forest-700">{formatPrice(comm)}</span>
          <form action={setBookingCommissionPaid}>
            <input type="hidden" name="id" value={b.id} />
            <input type="hidden" name="paid" value={b.commissionPaid ? "false" : "true"} />
            <button className={`rounded-full px-2.5 py-1 text-xs font-medium ${b.commissionPaid ? "bg-forest-100 text-forest-700" : "bg-amber-100 text-amber-700"}`}>
              {b.commissionPaid ? "Đã trả HH ✓" : "Chưa trả HH"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
