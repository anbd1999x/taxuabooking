"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import AdminCreateBooking from "./AdminCreateBooking";
import { showToast } from "./Toast";
import { fetchBookingEdit } from "@/app/admin/bookings/new/actions";
import type { BookingEditProps } from "@/lib/booking-edit";

/**
 * Nút "✎ Sửa đơn" mở POPUP sửa ngay trên trang đang xem (chi tiết đơn / danh sách yêu cầu đặt) —
 * không chuyển sang trang /sua. Dữ liệu đơn nạp khi bấm; lưu xong popup tự đóng và trang làm tươi.
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

  // Khoá cuộn trang nền + Esc để đóng khi popup đang mở.
  useEffect(() => {
    if (!data) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setData(null);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [data]);

  return (
    <>
      <button type="button" onClick={open} disabled={loading} title={title} className={className}>
        {loading ? "Đang mở…" : children ?? "✎ Sửa đơn"}
      </button>
      {data &&
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
              <div className="p-3 sm:p-5">
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
          </div>,
          document.body,
        )}
    </>
  );
}
