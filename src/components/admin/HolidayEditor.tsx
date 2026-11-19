"use client";

import { useState } from "react";
import type { Holiday } from "@/lib/holidays";

/** Lễ dương lịch cố định (lặp hằng năm) — bấm "Thêm lễ dương lịch" để điền nhanh. */
const SOLAR_PRESETS: Holiday[] = [
  { name: "Tết Dương lịch", from: "2026-12-31", to: "2027-01-01", yearly: true },
  { name: "Giải phóng miền Nam & Quốc tế Lao động", from: "2026-04-29", to: "2026-05-02", yearly: true },
  { name: "Quốc khánh", from: "2026-08-31", to: "2026-09-02", yearly: true },
];

type Row = Holiday & { k: number };

const inp = "rounded-lg border border-gray-200 px-2.5 py-2 text-sm";

/**
 * Sửa lịch ngày lễ (giá lễ của phòng homestay áp cho các ĐÊM trong khoảng). Gửi cả danh sách
 * dưới dạng JSON qua ô ẩn `holidays` — action `saveHolidays` chuẩn hoá & lưu SiteSetting.
 */
export function HolidayEditor({ initial }: { initial: Holiday[] }) {
  const [seq, setSeq] = useState(initial.length);
  const [rows, setRows] = useState<Row[]>(() => initial.map((h, k) => ({ ...h, k })));
  const set = (k: number, patch: Partial<Holiday>) => setRows((rs) => rs.map((r) => (r.k === k ? { ...r, ...patch } : r)));
  const add = (...hs: Holiday[]) => {
    setRows((rs) => [...rs, ...hs.map((h, i) => ({ ...h, k: seq + i }))]);
    setSeq((n) => n + hs.length);
  };
  const missingPresets = SOLAR_PRESETS.filter((p) => !rows.some((r) => r.yearly && r.name === p.name));
  const payload = rows.map(({ name, from, to, yearly }) => ({ name, from, to: to || from, yearly }));

  return (
    <div className="flex flex-col gap-2">
      <input type="hidden" name="holidays" value={JSON.stringify(payload)} />
      {rows.length === 0 && <p className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-500">Chưa có ngày lễ nào.</p>}
      {rows.map((r) => (
        <div key={r.k} className="grid grid-cols-2 items-end gap-2 rounded-xl bg-gray-50 p-2.5 sm:grid-cols-[minmax(0,1.6fr)_repeat(2,minmax(0,1fr))_auto_auto]">
          <label className="col-span-2 flex flex-col gap-1 sm:col-span-1">
            <span className="text-[11px] font-semibold text-gray-500">Tên ngày lễ</span>
            <input value={r.name} maxLength={80} onChange={(e) => set(r.k, { name: e.target.value })} placeholder="VD: Tết Nguyên đán 2027" className={inp} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-gray-500">Từ đêm</span>
            <input type="date" value={r.from} required onChange={(e) => set(r.k, { from: e.target.value, to: r.to && r.to >= e.target.value ? r.to : e.target.value })} className={inp} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-gray-500">Đến đêm</span>
            <input type="date" value={r.to} min={r.yearly ? undefined : r.from} onChange={(e) => set(r.k, { to: e.target.value })} className={inp} />
          </label>
          <label className="flex items-center gap-1.5 pb-2 text-[13px] text-gray-700">
            <input type="checkbox" checked={r.yearly} onChange={(e) => set(r.k, { yearly: e.target.checked })} className="h-4 w-4 accent-forest-600" />
            Lặp hằng năm
          </label>
          <button
            type="button"
            onClick={() => setRows((rs) => rs.filter((x) => x.k !== r.k))}
            className="rounded-lg px-3 py-2 text-sm font-bold text-red-600 hover:bg-red-50"
            aria-label="Xoá ngày lễ"
          >
            ✕
          </button>
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            const d = new Date().toISOString().slice(0, 10);
            add({ name: "", from: d, to: d, yearly: false });
          }}
          className="rounded-lg border border-forest-300 px-3 py-2 text-sm font-semibold text-forest-700 hover:bg-forest-50"
        >
          + Thêm ngày lễ
        </button>
        {missingPresets.length > 0 && (
          <button
            type="button"
            onClick={() => add(...missingPresets)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50"
          >
            + Thêm lễ dương lịch (1/1, 30/4–1/5, 2/9)
          </button>
        )}
      </div>
    </div>
  );
}
