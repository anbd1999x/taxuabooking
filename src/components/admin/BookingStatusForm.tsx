"use client";

import { useActionState } from "react";
import type { BookingStatus } from "@prisma/client";
import { BOOKING_STATUS_LIST, BOOKING_STATUS_META } from "@/lib/constants";
import { updateBookingStatus, type BookingActionState } from "@/app/admin/bookings/actions";

export function BookingStatusForm({
  id,
  status,
  adminNote,
}: {
  id: string;
  status: BookingStatus;
  adminNote: string | null;
}) {
  const [state, action, pending] = useActionState<BookingActionState, FormData>(
    updateBookingStatus,
    {},
  );

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <label className="block">
        <span className="text-sm font-medium text-gray-600">Trạng thái</span>
        <select name="status" defaultValue={status} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm">
          {BOOKING_STATUS_LIST.map((st) => (
            <option key={st} value={st}>{BOOKING_STATUS_META[st].label}</option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="text-sm font-medium text-gray-600">Ghi chú nội bộ</span>
        <textarea name="adminNote" defaultValue={adminNote ?? ""} rows={3} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm" />
      </label>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.ok && <p className="text-sm text-forest-700">Đã cập nhật.</p>}
      <button type="submit" disabled={pending} className="w-full rounded-xl bg-forest-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-forest-700 disabled:opacity-50">
        {pending ? "Đang lưu..." : "Cập nhật"}
      </button>
    </form>
  );
}
