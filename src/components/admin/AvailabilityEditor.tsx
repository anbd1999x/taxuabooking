"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AVAILABILITY_META } from "@/lib/constants";
import type { AvailabilityStatus } from "@prisma/client";
import { applyAvailability, type ActionState } from "@/app/admin/services/actions";

const STATUSES: AvailabilityStatus[] = ["AVAILABLE", "LIMITED", "SOLD_OUT", "NOT_UPDATED", "PENDING_CONFIRM"];
const inp = "mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-forest-500 focus:outline-none focus:ring-2 focus:ring-forest-200";

export function AvailabilityEditor({
  serviceId,
  targetType,
  targets,
  unitLabel,
  defaultStart,
  defaultEnd,
}: {
  serviceId: string;
  targetType: "ROOM" | "RENTAL";
  targets: { id: string; name: string }[];
  unitLabel: string;
  defaultStart: string;
  defaultEnd: string;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState<ActionState, FormData>(applyAvailability, {});

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state, router]);

  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="targetType" value={targetType} />
      <input type="hidden" name="serviceId" value={serviceId} />

      <label className="block sm:col-span-2">
        <span className="text-sm font-medium text-gray-600">Áp dụng cho</span>
        <select name="targetId" defaultValue="__ALL__" className={inp}>
          <option value="__ALL__">★ Tất cả {unitLabel} của homestay này</option>
          {targets.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="text-sm font-medium text-gray-600">Từ ngày</span>
        <input name="startDate" type="date" required defaultValue={defaultStart} className={inp} />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-gray-600">Đến ngày</span>
        <input name="endDate" type="date" required defaultValue={defaultEnd} className={inp} />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-gray-600">Tình trạng</span>
        <select name="status" defaultValue="AVAILABLE" className={inp}>
          {STATUSES.map((st) => (
            <option key={st} value={st}>{AVAILABILITY_META[st].label}</option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="text-sm font-medium text-gray-600">Số {unitLabel} trống</span>
        <input name="availableUnits" type="number" min={0} defaultValue={0} className={inp} />
      </label>

      <label className="block sm:col-span-2">
        <span className="text-sm font-medium text-gray-600">Giá riêng cho ngày (đ) — để trống nếu dùng giá mặc định</span>
        <input name="priceOverride" type="number" min={0} placeholder="VD: 600000" className={inp} />
      </label>

      <div className="flex flex-wrap gap-5 sm:col-span-2">
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" name="weekdaysOnly" className="h-4 w-4 accent-forest-600" /> Chỉ ngày thường
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" name="weekendsOnly" className="h-4 w-4 accent-forest-600" /> Chỉ cuối tuần
        </label>
      </div>

      {state.error && <p className="text-sm text-red-600 sm:col-span-2">{state.error}</p>}
      {state.ok && <p className="text-sm text-forest-700 sm:col-span-2">✓ Đã cập nhật lịch.</p>}

      <div className="sm:col-span-2">
        <button type="submit" disabled={pending} className="rounded-xl bg-forest-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-forest-700 disabled:opacity-50">
          {pending ? "Đang áp dụng..." : "Áp dụng"}
        </button>
      </div>
    </form>
  );
}
