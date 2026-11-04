"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AVAILABILITY_META } from "@/lib/constants";
import { MoneyInput } from "@/components/admin/MoneyInput";
import type { AvailabilityStatus } from "@prisma/client";
import { applyCabinSchedule, type ActionState } from "@/app/admin/services/actions";

const STATUSES: AvailabilityStatus[] = ["AVAILABLE", "LIMITED", "SOLD_OUT", "NOT_UPDATED", "PENDING_CONFIRM"];
const inp = "mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-forest-500 focus:outline-none focus:ring-2 focus:ring-forest-200";

export function CabinScheduleEditor({
  serviceId,
  defaultStart,
  defaultEnd,
  defaultTime = "21:00",
  defaultSeats = 22,
  defaultPrice = 0,
}: {
  serviceId: string;
  defaultStart: string;
  defaultEnd: string;
  defaultTime?: string;
  defaultSeats?: number;
  defaultPrice?: number;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState<ActionState, FormData>(applyCabinSchedule, {});

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state, router]);

  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="serviceId" value={serviceId} />

      <label className="block">
        <span className="text-sm font-medium text-gray-600">Từ ngày</span>
        <input name="startDate" type="date" required defaultValue={defaultStart} className={inp} />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-gray-600">Đến ngày</span>
        <input name="endDate" type="date" required defaultValue={defaultEnd} className={inp} />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-gray-600">Chiều</span>
        <select name="direction" defaultValue="OUTBOUND" className={inp}>
          <option value="OUTBOUND">Chiều đi</option>
          <option value="RETURN">Chiều về</option>
        </select>
      </label>
      <label className="block">
        <span className="text-sm font-medium text-gray-600">Giờ khởi hành</span>
        <input name="departureTime" defaultValue={defaultTime} placeholder="21:00" className={inp} />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-gray-600">Tình trạng</span>
        <select name="status" defaultValue="AVAILABLE" className={inp}>
          {STATUSES.map((st) => (
            <option key={st} value={st}>{AVAILABILITY_META[st].label}</option>
          ))}
        </select>
      </label>

      <div className="rounded-xl bg-[oklch(0.97_0.006_150)] p-3 sm:col-span-2">
        <div className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">Cabin đơn</div>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="text-sm font-medium text-gray-600">Giá vé đơn (đ)</span>
            <MoneyInput name="price" defaultValue={defaultPrice || ""} placeholder="VD: 350.000" className={inp} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-600">Tổng chỗ đơn</span>
            <input name="seatsTotal" type="number" min={0} defaultValue={defaultSeats} className={inp} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-600">Còn trống (trống = bằng tổng)</span>
            <input name="seatsAvailable" type="number" min={0} placeholder={String(defaultSeats)} className={inp} />
          </label>
        </div>
      </div>

      <div className="rounded-xl bg-[oklch(0.97_0.006_150)] p-3 sm:col-span-2">
        <div className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">Cabin đôi (để trống giá nếu không bán)</div>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="text-sm font-medium text-gray-600">Giá vé đôi (đ)</span>
            <MoneyInput name="priceDouble" placeholder="VD: 600.000" className={inp} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-600">Tổng chỗ đôi</span>
            <input name="seatsDoubleTotal" type="number" min={0} defaultValue={0} className={inp} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-600">Còn trống đôi</span>
            <input name="seatsDoubleAvailable" type="number" min={0} placeholder="0" className={inp} />
          </label>
        </div>
      </div>

      <div className="flex flex-wrap gap-5 sm:col-span-2">
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" name="weekdaysOnly" className="h-4 w-4 accent-forest-600" /> Chỉ ngày thường
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" name="weekendsOnly" className="h-4 w-4 accent-forest-600" /> Chỉ cuối tuần
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" name="overwrite" className="h-4 w-4 accent-forest-600" /> Ghi đè chuyến đã có (cùng ngày &amp; chiều — cập nhật cả giờ)
        </label>
      </div>

      {state.error && <p className="text-sm text-red-600 sm:col-span-2">{state.error}</p>}
      {state.ok && <p className="text-sm text-forest-700 sm:col-span-2">✓ {state.message ?? "Đã cập nhật lịch chuyến."}</p>}

      <div className="sm:col-span-2">
        <button type="submit" disabled={pending} className="rounded-xl bg-forest-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-forest-700 disabled:opacity-50">
          {pending ? "Đang mở chuyến..." : "Mở chuyến cho khoảng ngày"}
        </button>
      </div>
    </form>
  );
}
