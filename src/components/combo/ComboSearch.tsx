"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DateField } from "@/components/DateField";

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export const COMBO_FILTER_OPTIONS: { key: string; label: string; icon: string }[] = [
  { key: "cloudView", label: "View săn mây", icon: "⛅" },
  { key: "bathtub", label: "Bồn tắm", icon: "🛁" },
  { key: "breakfast", label: "Ăn sáng", icon: "🍳" },
  { key: "airCon", label: "Điều hòa", icon: "❄️" },
  { key: "heating", label: "Đêm sưởi", icon: "🔥" },
  { key: "pool", label: "Hồ bơi", icon: "🏊" },
  { key: "easyRoad", label: "Đường dễ đi", icon: "🛣️" },
];

const ROOM_KIND_OPTIONS: { key: string; label: string }[] = [
  { key: "all", label: "Mọi loại phòng" },
  { key: "single", label: "Phòng đơn" },
  { key: "double", label: "Phòng đôi" },
  { key: "dorm", label: "Phòng tập thể" },
];

/** Mức giá mỗi khách: "ltX" = dưới X, "gtX" = trên X; "" = không lọc. */
const PRICE_OPTIONS: [string, string][] = [
  ["", "Mọi mức giá"],
  ["lt800000", "Dưới 800k"],
  ["lt900000", "Dưới 900k"],
  ["lt1000000", "Dưới 1.000k"],
  ["lt1100000", "Dưới 1.100k"],
  ["lt1200000", "Dưới 1.200k"],
  ["lt1500000", "Dưới 1.500k"],
  ["lt2000000", "Dưới 2.000k"],
  ["gt2000000", "Trên 2.000k"],
];

export function ComboSearch({
  initialFrom = "",
  initialTo = "",
  initialPeople = 2,
  initialPrice = "",
  initialFilters = [],
  initialKind = "all",
  initialOrigin = "",
  origins = [],
}: {
  initialFrom?: string;
  initialTo?: string;
  initialPeople?: number;
  initialPrice?: string;
  initialFilters?: string[];
  initialKind?: string;
  initialOrigin?: string;
  /** Điểm xuất phát đã khai trong bảng giá chặng (server truyền xuống). */
  origins?: string[];
}) {
  const router = useRouter();
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [origin, setOrigin] = useState(initialOrigin);
  const [people, setPeople] = useState(initialPeople);
  const [price, setPrice] = useState(initialPrice);
  const [filters, setFilters] = useState<Set<string>>(new Set(initialFilters));
  const [kind, setKind] = useState(initialKind);

  function toggle(key: string) {
    setFilters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function submit() {
    const p = new URLSearchParams();
    p.set("from", from || todayKey());
    p.set("to", to || "");
    p.set("people", String(Math.max(1, people)));
    if (origin) p.set("origin", origin);
    if (price) p.set("price", price);
    if (filters.size) p.set("f", [...filters].join(","));
    if (kind && kind !== "all") p.set("kind", kind);
    router.push(`/combo?${p.toString()}`, { scroll: false });
    router.refresh();
  }

  const cell = "flex flex-col gap-1 rounded-2xl bg-[oklch(0.965_0.01_150)] px-4 py-3";
  const inp = "mt-0.5 w-full bg-transparent text-[15px] font-bold text-ink outline-none";

  return (
    <div className="rounded-[22px] bg-white p-3 shadow-[0_20px_50px_-24px_rgba(30,70,45,0.4)] ring-1 ring-black/[0.05]">
      <div className={`grid gap-1.5 sm:grid-cols-2 ${origins.length > 0 ? "lg:grid-cols-5" : "lg:grid-cols-4"}`}>
        {origins.length > 0 && (
          <label className={cell}>
            <span className="text-xs font-medium text-gray-500">Điểm xuất phát</span>
            <select value={origin} onChange={(e) => setOrigin(e.target.value)} className={inp}>
              <option value="">Chọn điểm đón</option>
              {origins.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
              {origin && !origins.includes(origin) && <option value={origin}>{origin}</option>}
            </select>
          </label>
        )}
        <label className={cell}>
          <span className="text-xs font-medium text-gray-500">Ngày đi (lên xe)</span>
          <DateField value={from} min={todayKey()} onChange={setFrom} className={inp} displayClassName="text-[15px] font-bold text-ink" ariaLabel="Ngày đi" />
        </label>
        <label className={cell}>
          <span className="text-xs font-medium text-gray-500">Ngày về (xe chạy về)</span>
          <DateField value={to} min={from || todayKey()} onChange={setTo} className={inp} displayClassName="text-[15px] font-bold text-ink" ariaLabel="Ngày về" />
        </label>
        <label className={cell}>
          <span className="text-xs font-medium text-gray-500">Số người</span>
          <input type="number" min={1} max={20} value={people} onChange={(e) => setPeople(Math.max(1, Number(e.target.value)))} className={inp} />
        </label>
        <label className={cell}>
          <span className="text-xs font-medium text-gray-500">Giá mong muốn / khách</span>
          <select value={price} onChange={(e) => setPrice(e.target.value)} className={inp}>
            {PRICE_OPTIONS.map(([v, n]) => (
              <option key={v} value={v}>{n}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-gray-500">Loại phòng:</span>
        {ROOM_KIND_OPTIONS.map((o) => {
          const on = kind === o.key;
          return (
            <button
              key={o.key}
              type="button"
              onClick={() => setKind(o.key)}
              className={`rounded-full border px-3 py-1.5 text-[13px] font-semibold transition ${
                on ? "border-forest-600 bg-forest-50 text-forest-700" : "border-gray-200 bg-white text-gray-500 hover:border-forest-300"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>

      <div className="mt-2.5 flex flex-wrap gap-2">
        {COMBO_FILTER_OPTIONS.map((o) => {
          const on = filters.has(o.key);
          return (
            <button
              key={o.key}
              type="button"
              onClick={() => toggle(o.key)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-semibold transition ${
                on ? "border-forest-600 bg-forest-50 text-forest-700" : "border-gray-200 bg-white text-gray-500 hover:border-forest-300"
              }`}
            >
              <span>{o.icon}</span>
              {o.label}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={submit}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-sunset-500 px-6 py-3.5 text-base font-bold text-white transition hover:bg-sunset-600 active:scale-[0.99]"
      >
        Tìm combo khớp giá <span>→</span>
      </button>
    </div>
  );
}
