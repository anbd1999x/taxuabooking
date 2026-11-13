"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Mode = "range" | "month" | "year";

const pad = (n: number) => String(n).padStart(2, "0");
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate(); // m: 1..12

/** Khoảng from–to đang xem là trọn 1 tháng / trọn 1 năm / khoảng tự chọn? */
function detect(from: string, to: string): Mode {
  const y = Number(from.slice(0, 4));
  const m = Number(from.slice(5, 7));
  if (from === `${y}-01-01` && to === `${y}-12-31`) return "year";
  if (from.slice(8) === "01" && to === `${from.slice(0, 7)}-${pad(lastDay(y, m))}`) return "month";
  return "range";
}

/**
 * Bộ lọc thời gian của trang thống kê: Từ ngày – đến ngày / theo Tháng / theo Năm.
 * Mọi chế độ đều quy về ?from=&to= nên trang server không cần đổi.
 */
export function StatsRangeFilter({ action, fromKey, toKey }: { action: string; fromKey: string; toKey: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(detect(fromKey, toKey));
  const [from, setFrom] = useState(fromKey);
  const [to, setTo] = useState(toKey);
  const thisYear = new Date().getFullYear();
  const years = Array.from({ length: Math.max(1, thisYear - 2024) + 1 }, (_, i) => thisYear - i);

  const go = (f: string, t: string) => router.push(`${action}?${new URLSearchParams({ from: f, to: t }).toString()}`);
  const goMonth = (ym: string) => {
    if (!/^\d{4}-\d{2}$/.test(ym)) return;
    go(`${ym}-01`, `${ym}-${pad(lastDay(Number(ym.slice(0, 4)), Number(ym.slice(5, 7))))}`);
  };
  const goYear = (y: number) => go(`${y}-01-01`, `${y}-12-31`);

  const field = "rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm";
  const tabs: [Mode, string][] = [
    ["range", "Từ ngày – đến ngày"],
    ["month", "Theo tháng"],
    ["year", "Theo năm"],
  ];

  return (
    <div className="mt-4 flex flex-wrap items-end gap-3">
      <div className="inline-flex gap-1 rounded-[14px] bg-gray-200/70 p-1">
        {tabs.map(([k, name]) => (
          <button
            key={k}
            type="button"
            onClick={() => setMode(k)}
            className={`whitespace-nowrap rounded-[11px] px-3 py-2 text-sm font-bold transition ${
              mode === k ? "bg-white text-forest-800 shadow-sm" : "text-gray-600 hover:text-ink"
            }`}
          >
            {name}
          </button>
        ))}
      </div>

      {mode === "range" && (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (from && to) go(from, to);
          }}
        >
          <label className="block">
            <span className="text-xs font-medium text-gray-500">Từ ngày</span>
            <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className={`mt-1 block ${field}`} />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-500">Đến ngày</span>
            <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className={`mt-1 block ${field}`} />
          </label>
          <button className="rounded-xl bg-forest-600 px-4 py-2 text-sm font-semibold text-white">Xem</button>
        </form>
      )}

      {mode === "month" && (
        <label className="block">
          <span className="text-xs font-medium text-gray-500">Tháng</span>
          <input
            type="month"
            defaultValue={fromKey.slice(0, 7)}
            onChange={(e) => goMonth(e.target.value)}
            className={`mt-1 block ${field}`}
          />
        </label>
      )}

      {mode === "year" && (
        <label className="block">
          <span className="text-xs font-medium text-gray-500">Năm</span>
          <select
            defaultValue={detect(fromKey, toKey) === "year" ? fromKey.slice(0, 4) : ""}
            onChange={(e) => e.target.value && goYear(Number(e.target.value))}
            className={`mt-1 block ${field} font-semibold`}
          >
            <option value="">Chọn năm…</option>
            {years.map((y) => (
              <option key={y} value={y}>Năm {y}</option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}
