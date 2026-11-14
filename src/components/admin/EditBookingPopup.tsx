"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import AdminCreateBooking from "./AdminCreateBooking";
import { StatusPanel, PaymentRecordForm, SupplierPayoutForm } from "./BookingDetailClient";
import { showToast } from "./Toast";
import { fetchBookingEdit } from "@/app/admin/bookings/new/actions";
import type { BookingEditProps } from "@/lib/booking-edit";

const K = (n: number) => n.toLocaleString("vi-VN") + "đ";
const box = "flex min-w-0 flex-col gap-2.5 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5";

/**
 * Nút "✎ Sửa đơn" mở POPUP sửa ngay trên trang đang xem (chi tiết đơn / danh sách / lịch yêu cầu đặt) —
 * không chuyển trang. Trên cùng là phần SỬA NHANH hay dùng nhất: trạng thái đơn, tiền ĐÃ THU của khách,
 * tiền ĐÃ CHI cho từng dịch vụ (homestay / nhà xe) — mỗi mục lưu riêng, số liệu tự cập nhật. Bên dưới là
 * form đầy đủ (dịch vụ, phòng, chuyến, ngày, khách, giá); lưu form xong popup tự đóng.
 */
export function EditBookingPopup({
  bookingId,
  className,
  title,
  children,
}: {
  bookingId: string;
  className?: string;
  title?: string;
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const [data, setData] = useState<BookingEditProps | null>(null);
  const [loading, startLoad] = useTransition();

  const open = () =>
    startLoad(async () => {
      try {
        const d = await fetchBookingEdit(bookingId);
        if (d) setData(d);
        else showToast("Không tìm thấy đơn.", "error");
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Không mở được form sửa.", "error");
      }
    });
  const close = () => setData(null);

  // Sau mỗi lần lưu ở phần sửa nhanh: nạp lại số liệu trong popup + làm tươi trang nền.
  const reload = useCallback(() => {
    fetchBookingEdit(bookingId)
      .then((d) => d && setData((cur) => (cur ? d : cur)))
      .catch(() => {});
    router.refresh();
  }, [bookingId, router]);

  // Khoá cuộn trang nền + Esc để đóng khi popup đang mở.
  const isOpen = data != null;
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setData(null);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [isOpen]);

  const ops = data?.ops;
  const due = ops && ops.price != null ? Math.max(0, ops.price - ops.collected) : null;

  return (
    <>
      <button type="button" onClick={open} disabled={loading} title={title} className={className}>
        {loading ? "Đang mở…" : children ?? "✎ Sửa đơn"}
      </button>
      {data && ops &&
        createPortal(
          <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-slate-900/50 p-2 sm:p-6" onMouseDown={(e) => e.target === e.currentTarget && close()}>
            <div className="w-full max-w-[1180px] rounded-3xl bg-gray-50 shadow-2xl">
              <div className="sticky top-0 z-10 flex items-center gap-3 rounded-t-3xl border-b border-gray-200 bg-white px-5 py-3.5">
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-gray-500">Sửa đơn</div>
                  <div className="font-mono text-[17px] font-extrabold text-ink">{data.code}</div>
                </div>
                <button type="button" onClick={close} className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-gray-100 text-lg hover:bg-gray-200" aria-label="Đóng">
                  ✕
                </button>
              </div>

              <div className="flex flex-col gap-4 p-3 sm:p-5">
                {/* ===== SỬA NHANH: trạng thái · đã thu · đã chi ===== */}
                <div>
                  <div className="mb-2 text-sm font-extrabold text-ink">Trạng thái &amp; tiền <span className="font-semibold text-gray-500">— mỗi mục lưu riêng, lưu xong vẫn ở đây</span></div>
                  <div className="grid gap-3 lg:grid-cols-3">
                    <section className={box}>
                      <h3 className="text-[13px] font-extrabold uppercase tracking-wide text-gray-500">Trạng thái đơn</h3>
                      <StatusPanel key={`st-${ops.status}`} id={bookingId} status={ops.status} cancelReason={ops.cancelReason} onDone={reload} />
                    </section>

                    <section className={box}>
                      <h3 className="text-[13px] font-extrabold uppercase tracking-wide text-gray-500">Đã thu của khách</h3>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <div className="text-[11px] text-gray-500">Tổng đơn</div>
                          <div className="text-sm font-extrabold text-ink">{ops.price != null ? K(ops.price) : "Chờ giá"}</div>
                        </div>
                        <div>
                          <div className="text-[11px] text-gray-500">Đã thu</div>
                          <div className="text-sm font-extrabold text-forest-700">{K(ops.collected)}</div>
                        </div>
                        <div>
                          <div className="text-[11px] text-gray-500">Còn thiếu</div>
                          <div className={`text-sm font-extrabold ${due ? "text-sunset-600" : "text-forest-700"}`}>{due != null ? K(due) : "—"}</div>
                        </div>
                      </div>
                      <PaymentRecordForm id={bookingId} price={ops.price} collected={ops.collected} onDone={reload} />
                    </section>

                    <section className={box}>
                      <h3 className="text-[13px] font-extrabold uppercase tracking-wide text-gray-500">Đã chi cho dịch vụ</h3>
                      {ops.payouts.length === 0 && <p className="text-sm text-gray-500">Đơn này chưa có phần tiền của nhà cung cấp.</p>}
                      {ops.payouts.map((s) => (
                        <div key={s.side} className="flex flex-col gap-2 rounded-xl border border-gray-200 p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-[11px] text-gray-500">{s.kind}</div>
                              <div className="truncate text-sm font-bold text-ink">{s.name}</div>
                            </div>
                            <span
                              className={`whitespace-nowrap rounded-full px-2 py-1 text-[11px] font-bold ${
                                s.payable > 0 && s.remaining === 0 ? "bg-forest-100 text-forest-700" : s.paid > 0 ? "bg-amber-100 text-amber-700" : "bg-red-50 text-red-600"
                              }`}
                            >
                              {s.payable > 0 && s.remaining === 0 ? "Đã trả đủ" : s.paid > 0 ? "Trả một phần" : "Chưa trả"}
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <div className="text-[11px] text-gray-500">Phải trả</div>
                              <div className="text-sm font-extrabold text-ink">{K(s.payable)}</div>
                            </div>
                            <div>
                              <div className="text-[11px] text-gray-500">Đã trả</div>
                              <div className="text-sm font-extrabold text-forest-700">{K(s.paid)}</div>
                            </div>
                            <div>
                              <div className="text-[11px] text-gray-500">Còn lại</div>
                              <div className={`text-sm font-extrabold ${s.remaining > 0 ? "text-sunset-600" : "text-forest-700"}`}>{K(s.remaining)}</div>
                            </div>
                          </div>
                          {s.discount > 0 && <div className="text-[11px] text-gray-500">Bán ra {K(s.gross)} − chiết khấu sàn {K(s.discount)}</div>}
                          <SupplierPayoutForm id={bookingId} side={s.side} label={s.name} payable={s.payable} paid={s.paid} onDone={reload} />
                        </div>
                      ))}
                    </section>
                  </div>
                </div>

                {/* ===== FORM ĐẦY ĐỦ ===== */}
                <div>
                  <div className="mb-2 text-sm font-extrabold text-ink">Thông tin đơn <span className="font-semibold text-gray-500">— dịch vụ, phòng, chuyến, ngày, khách, giá</span></div>
                  <AdminCreateBooking
                    categories={data.categories}
                    services={data.services}
                    ctvs={data.ctvs}
                    todayKey={data.todayKey}
                    comboDiscount={data.comboDiscount}
                    edit={data.edit}
                    onSaved={() => {
                      close();
                      showToast(`Đã lưu thay đổi đơn ${data.code}`);
                      router.refresh();
                    }}
                  />
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
