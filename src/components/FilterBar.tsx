"use client";

import { useRouter, usePathname } from "next/navigation";
import { useState } from "react";
import type { AvailabilityKind } from "@/lib/constants";
import { DateField } from "@/components/DateField";

const PRICE_RANGES = [
  { label: "Mọi mức giá", min: "", max: "" },
  { label: "Dưới 200.000đ", min: "", max: "200000" },
  { label: "200.000 - 500.000đ", min: "200000", max: "500000" },
  { label: "500.000 - 1 triệu", min: "500000", max: "1000000" },
  { label: "Trên 1 triệu", min: "1000000", max: "" },
];

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export function FilterBar({
  kind,
  initial,
}: {
  kind: AvailabilityKind;
  initial: { q?: string; from?: string; to?: string; priceMin?: string; priceMax?: string };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [q, setQ] = useState(initial.q ?? "");
  const [from, setFrom] = useState(initial.from ?? "");
  const [to, setTo] = useState(initial.to ?? "");
  const [priceIdx, setPriceIdx] = useState(() => {
    const i = PRICE_RANGES.findIndex(
      (r) => r.min === (initial.priceMin ?? "") && r.max === (initial.priceMax ?? ""),
    );
    return i < 0 ? 0 : i;
  });

  const needsRange = kind === "stay" || kind === "rental";

  function apply(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (from) params.set("from", from);
    if (to && needsRange) params.set("to", to);
    const range = PRICE_RANGES[priceIdx];
    if (range.min) params.set("priceMin", range.min);
    if (range.max) params.set("priceMax", range.max);
    const qs = params.toString();
    router.push(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
  }

  function reset() {
    setQ(""); setFrom(""); setTo(""); setPriceIdx(0);
    router.push(pathname);
  }

  return (
    <form
      onSubmit={apply}
      className="grid gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 md:grid-cols-2 lg:grid-cols-6"
    >
      <label className="flex flex-col gap-1 lg:col-span-2">
        <span className="text-xs font-medium text-gray-500">Tìm kiếm</span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Tên dịch vụ, khu vực..."
          className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-forest-500 focus:outline-none focus:ring-2 focus:ring-forest-200"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-gray-500">
          {kind === "trip" ? "Ngày đi" : needsRange ? "Nhận" : "Ngày"}
        </span>
        <DateField
          value={from}
          min={todayKey()}
          onChange={setFrom}
          className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-forest-500 focus:outline-none focus:ring-2 focus:ring-forest-200"
          displayClassName="px-3 text-sm text-gray-900"
          ariaLabel={kind === "trip" ? "Ngày đi" : needsRange ? "Ngày nhận" : "Ngày"}
        />
      </label>

      {needsRange && (
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-gray-500">Trả</span>
          <DateField
            value={to}
            min={from || todayKey()}
            onChange={setTo}
            className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-forest-500 focus:outline-none focus:ring-2 focus:ring-forest-200"
            displayClassName="px-3 text-sm text-gray-900"
            ariaLabel="Ngày trả"
          />
        </label>
      )}

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-gray-500">Khoảng giá</span>
        <select
          value={priceIdx}
          onChange={(e) => setPriceIdx(Number(e.target.value))}
          className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-forest-500 focus:outline-none focus:ring-2 focus:ring-forest-200"
        >
          {PRICE_RANGES.map((r, i) => (
            <option key={i} value={i}>{r.label}</option>
          ))}
        </select>
      </label>

      <div className={`flex items-end gap-2 ${needsRange ? "" : "lg:col-span-2"}`}>
        <button
          type="submit"
          className="flex-1 rounded-xl bg-forest-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-forest-700"
        >
          Lọc
        </button>
        <button
          type="button"
          onClick={reset}
          className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
        >
          Xoá
        </button>
      </div>
    </form>
  );
}
