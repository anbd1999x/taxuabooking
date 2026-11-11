"use client";

import { useMemo, useState } from "react";

const DAY = 86400000;
const toKey = (t: number) => new Date(t).toISOString().slice(0, 10);
const fmt = (k: string) => `${k.slice(8, 10)}/${k.slice(5, 7)}/${k.slice(0, 4)}`;

/**
 * Chọn các NGÀY HẾT PHÒNG cho homestay "không quản lý lịch": thêm theo khoảng ngày,
 * gộp ngày liền nhau thành dải để hiển thị, bấm ✕ để bỏ. Gửi lên form qua input ẩn
 * `soldOutDates` (danh sách yyyy-mm-dd, cách nhau dấu phẩy) — mỗi ngày = 1 ĐÊM hết phòng.
 */
export function SoldOutDatesField({ initial }: { initial: string[] }) {
  const [dates, setDates] = useState<string[]>(() => [...new Set(initial)].sort());
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [err, setErr] = useState("");

  // Gộp ngày liền nhau thành dải [đầu, cuối] để hiển thị gọn.
  const ranges = useMemo(() => {
    const out: [string, string][] = [];
    for (const k of dates) {
      const last = out[out.length - 1];
      if (last && Date.parse(k) - Date.parse(last[1]) === DAY) last[1] = k;
      else out.push([k, k]);
    }
    return out;
  }, [dates]);

  function add() {
    if (!from) return setErr("Chọn ngày bắt đầu.");
    const end = to || from;
    if (end < from) return setErr("Ngày kết thúc phải từ ngày bắt đầu trở đi.");
    const a = Date.parse(from);
    const b = Date.parse(end);
    if ((b - a) / DAY > 366) return setErr("Mỗi lần thêm tối đa 1 năm.");
    const set = new Set(dates);
    for (let t = a; t <= b; t += DAY) set.add(toKey(t));
    setDates([...set].sort());
    setFrom("");
    setTo("");
    setErr("");
  }

  function removeRange([a, b]: [string, string]) {
    setDates(dates.filter((k) => k < a || k > b));
  }

  return (
    <div className="rounded-xl border border-orange-200 bg-orange-50/60 p-3">
      <input type="hidden" name="soldOutDates" value={dates.join(",")} />
      <div className="text-sm font-semibold text-gray-800">📅 Ngày hết phòng</div>
      <p className="mt-0.5 text-xs text-gray-500">
        Các đêm đã kín phòng — khách tìm homestay trùng những đêm này sẽ KHÔNG thấy cơ sở này. Bấm “Lưu” để áp dụng.
      </p>
      <div className="mt-2 flex flex-wrap items-end gap-2">
        <label className="text-xs text-gray-600">
          Từ ngày
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-0.5 block rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm" />
        </label>
        <label className="text-xs text-gray-600">
          Đến ngày (bỏ trống = 1 ngày)
          <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className="mt-0.5 block rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm" />
        </label>
        <button type="button" onClick={add} className="rounded-lg bg-forest-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-forest-700">
          + Thêm
        </button>
      </div>
      {err && <div className="mt-1 text-xs text-red-600">{err}</div>}
      {ranges.length === 0 ? (
        <div className="mt-2 text-xs text-gray-400">Chưa có ngày hết phòng nào.</div>
      ) : (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {ranges.map((r) => (
            <span key={r[0]} className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-gray-700 ring-1 ring-orange-200">
              {r[0] === r[1] ? fmt(r[0]) : `${fmt(r[0])} → ${fmt(r[1])}`}
              <button type="button" onClick={() => removeRange(r)} aria-label="Bỏ" className="text-gray-400 hover:text-red-600">
                ✕
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
