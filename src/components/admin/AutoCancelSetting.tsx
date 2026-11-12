"use client";

import { ActionForm } from "@/components/admin/ActionForm";
import { saveAutoCancelHours } from "@/app/admin/bookings/actions";
import { MAX_AUTO_CANCEL_HOURS } from "@/lib/auto-cancel-config";

/** Thiết lập số giờ tự huỷ đơn chưa thanh toán (đặt ở đầu trang /admin/bookings). */
export function AutoCancelSetting({ hours }: { hours: number }) {
  return (
    <details className="mb-4 rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
      <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold text-ink">
        Tự huỷ đơn chưa thanh toán:{" "}
        <span className={hours > 0 ? "text-forest-700" : "text-gray-500"}>
          {hours > 0 ? `sau ${String(hours).replace(".", ",")} giờ` : "đang tắt"}
        </span>
        <span className="ml-2 text-xs font-normal text-gray-400">(bấm để sửa)</span>
      </summary>
      <ActionForm action={saveAutoCancelHours} className="flex flex-col gap-2.5 border-t border-gray-100 px-4 py-3.5" success="Đã lưu thời gian tự huỷ.">
        <label className="flex flex-wrap items-center gap-2 text-sm text-gray-700">
          Đơn “Mới / Đang liên hệ” chưa ghi nhận thanh toán sẽ tự huỷ sau
          <input
            type="number"
            name="hours"
            min={0}
            max={MAX_AUTO_CANCEL_HOURS}
            step={0.5}
            defaultValue={hours}
            className="w-24 rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold"
          />
          giờ kể từ lúc đặt.
          <button className="rounded-xl bg-forest-600 px-4 py-2 text-sm font-semibold text-white hover:bg-forest-700">Lưu</button>
        </label>
        <p className="text-xs leading-relaxed text-gray-500">
          Nhập 0 để tắt tự huỷ theo thời gian. Số giờ này cũng được dùng trong tin nhắn “Chép tin nhắn cho khách” và trên trang
          tra cứu đơn. Áp dụng cho cả đơn đang chờ hiện có (tính từ lúc đặt), trừ đơn tạo trước khi bật tính năng. Việc tự
          huỷ khi lịch đồng bộ báo phòng đã có khách không phụ thuộc vào số giờ này.
        </p>
      </ActionForm>
    </details>
  );
}
