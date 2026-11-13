"use client";

import { useState } from "react";
import type { RoomStatus } from "@prisma/client";

export interface RoomGroup {
  typeId: string;
  typeName: string;
  rooms: { id: string; name: string }[];
}

const CYCLE: RoomStatus[] = ["AVAILABLE", "BOOKED", "PENDING", "CLOSED"];

const CELL: Record<RoomStatus, { label: string; cls: string }> = {
  AVAILABLE: { label: "", cls: "bg-gray-100 text-gray-400 hover:bg-gray-200" },
  BOOKED: { label: "Đã đặt", cls: "bg-red-600 text-white hover:bg-red-700" },
  PENDING: { label: "Chờ", cls: "bg-amber-300 text-amber-900 hover:bg-amber-400" },
  CLOSED: { label: "Đóng", cls: "bg-stone-700 text-white hover:bg-stone-800" },
};

const WD = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];

function keyOf(roomId: string, date: string) {
  return `${roomId}|${date}`;
}
function isWeekend(dateKey: string) {
  const dow = new Date(dateKey + "T00:00:00Z").getUTCDay();
  return dow === 0 || dow === 6;
}

export function RoomGrid({
  groups,
  days,
  initial,
}: {
  groups: RoomGroup[];
  days: string[];
  initial: Record<string, RoomStatus>;
}) {
  const [statuses, setStatuses] = useState<Record<string, RoomStatus>>(initial);
  const [saving, setSaving] = useState(false);
  const flatRooms = groups.flatMap((g) => g.rooms);

  function get(roomId: string, date: string): RoomStatus {
    return statuses[keyOf(roomId, date)] ?? "AVAILABLE";
  }

  async function cycle(roomId: string, date: string) {
    const cur = get(roomId, date);
    const next = CYCLE[(CYCLE.indexOf(cur) + 1) % CYCLE.length];
    const key = keyOf(roomId, date);
    setStatuses((s) => ({ ...s, [key]: next }));
    setSaving(true);
    const post = (force: boolean) =>
      fetch("/api/admin/room-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId, date, status: next, force }),
      });
    try {
      let res = await post(false);
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string; needConfirm?: boolean } | null;
        if (res.status === 409 && data?.needConfirm) {
          // Ô đang do một đơn thật giữ chỗ → cảnh báo tình trạng hiện tại, đồng ý mới ghi đè.
          if (!confirm(data.error || "Phòng đang có đơn giữ chỗ. Vẫn ghi đè?")) {
            setStatuses((s) => ({ ...s, [key]: cur }));
            return;
          }
          res = await post(true);
          if (res.ok) return;
          const d2 = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(d2?.error || "Lưu không thành công, vui lòng thử lại.");
        }
        throw new Error(data?.error || "Lưu không thành công, vui lòng thử lại.");
      }
    } catch (e) {
      // revert
      setStatuses((s) => ({ ...s, [key]: cur }));
      alert(e instanceof Error ? e.message : "Lưu không thành công, vui lòng thử lại.");
    } finally {
      setSaving(false);
    }
  }

  const bookedPerDay = (date: string) =>
    flatRooms.reduce((n, r) => n + (get(r.id, date) === "BOOKED" ? 1 : 0), 0);
  const totalBooked = days.reduce((n, d) => n + bookedPerDay(d), 0);
  const capacity = flatRooms.length * days.length;
  const rate = capacity > 0 ? ((totalBooked / capacity) * 100).toFixed(1) : "0";

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="text-gray-500">Bấm vào ô để đổi:</span>
        {(["AVAILABLE", "BOOKED", "PENDING", "CLOSED"] as RoomStatus[]).map((s) => (
          <span key={s} className={`rounded px-2 py-1 font-medium ${CELL[s].cls}`}>
            {s === "AVAILABLE" ? "Trống" : CELL[s].label}
          </span>
        ))}
        {saving && <span className="text-forest-600">đang lưu…</span>}
      </div>

      <div className="overflow-x-auto rounded-2xl ring-1 ring-black/5">
        <table className="min-w-max border-collapse bg-white text-center text-xs">
          <thead>
            <tr className="bg-forest-50">
              <th rowSpan={2} className="sticky left-0 z-10 border border-gray-200 bg-forest-50 px-2 py-1 text-left">Ngày</th>
              {groups.map((g) => (
                <th key={g.typeId} colSpan={g.rooms.length} className="border border-gray-200 px-2 py-1 font-semibold text-forest-800">
                  {g.typeName}
                </th>
              ))}
              <th rowSpan={2} className="border border-gray-200 px-2 py-1">SL đã đặt</th>
            </tr>
            <tr className="bg-forest-50/60">
              {flatRooms.map((r) => (
                <th key={r.id} className="border border-gray-200 px-2 py-1 font-medium text-gray-600" style={{ minWidth: 70 }}>
                  {r.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {days.map((date) => {
              const wk = isWeekend(date);
              const dow = new Date(date + "T00:00:00Z").getUTCDay();
              return (
                <tr key={date} className={wk ? "bg-sunset-50" : ""}>
                  <td className={`sticky left-0 z-10 whitespace-nowrap border border-gray-200 px-2 py-1 text-left ${wk ? "bg-sunset-50" : "bg-white"}`}>
                    <span className="font-semibold">{date.slice(8, 10)}/{date.slice(5, 7)}</span>
                    <span className="ml-1 text-gray-400">{WD[dow]}</span>
                  </td>
                  {flatRooms.map((r) => {
                    const st = get(r.id, date);
                    const c = CELL[st];
                    return (
                      <td key={r.id} className="border border-gray-200 p-0.5">
                        <button
                          type="button"
                          onClick={() => cycle(r.id, date)}
                          className={`h-7 w-full rounded ${c.cls} text-[11px] font-medium transition`}
                          title={`${r.name} · ${date}`}
                        >
                          {c.label}
                        </button>
                      </td>
                    );
                  })}
                  <td className="border border-gray-200 px-2 py-1 font-bold text-forest-700">{bookedPerDay(date)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-forest-50 font-semibold">
              <td className="sticky left-0 z-10 border border-gray-200 bg-forest-50 px-2 py-1 text-left">Tổng</td>
              <td colSpan={flatRooms.length} className="border border-gray-200 px-2 py-1 text-right">
                Tổng số phòng đã đặt: <span className="text-forest-700">{totalBooked}</span> · Tỷ lệ lấp đầy: <span className="text-sunset-600">{rate}%</span>
              </td>
              <td className="border border-gray-200 px-2 py-1 text-forest-700">{totalBooked}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
