"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CATEGORY_LIST } from "@/lib/constants";
import { DateField } from "@/components/DateField";

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export function SearchBar() {
  const router = useRouter();
  const [categorySlug, setCategorySlug] = useState("homestay");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [guests, setGuests] = useState(2);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const qs = params.toString();
    router.push(`/${categorySlug}${qs ? `?${qs}` : ""}`);
  }

  const cell = "flex flex-col gap-0.5 px-4 py-2.5";
  const label = "text-xs font-medium text-gray-500";
  const control =
    "bg-transparent text-[15px] font-semibold text-ink outline-none";

  return (
    <form
      onSubmit={submit}
      className="grid grid-cols-1 gap-1 rounded-2xl bg-white p-2 shadow-[0_16px_40px_-12px_rgba(20,60,45,0.25)] ring-1 ring-black/5 sm:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_0.8fr_auto]"
    >
      <label className={`${cell} rounded-xl bg-forest-50`}>
        <span className={label}>Dịch vụ</span>
        <select value={categorySlug} onChange={(e) => setCategorySlug(e.target.value)} className={control}>
          {CATEGORY_LIST.map((c) => (
            <option key={c.slug} value={c.slug}>{c.shortLabel}</option>
          ))}
        </select>
      </label>

      <label className={`${cell} lg:border-l lg:border-gray-100`}>
        <span className={label}>Nhận phòng</span>
        <DateField value={from} min={todayKey()} onChange={setFrom} className={control} displayClassName="text-[15px] font-semibold text-ink" ariaLabel="Nhận phòng" />
      </label>

      <label className={`${cell} lg:border-l lg:border-gray-100`}>
        <span className={label}>Trả phòng</span>
        <DateField value={to} min={from || todayKey()} onChange={setTo} className={control} displayClassName="text-[15px] font-semibold text-ink" ariaLabel="Trả phòng" />
      </label>

      <label className={`${cell} lg:border-l lg:border-gray-100`}>
        <span className={label}>Số khách</span>
        <input type="number" min={1} max={20} value={guests} onChange={(e) => setGuests(Math.max(1, Number(e.target.value)))} className={control} />
      </label>

      <button
        type="submit"
        className="m-1 rounded-xl bg-sunset-500 px-7 text-[15px] font-bold text-white transition hover:bg-sunset-600"
      >
        Xem chỗ trống
      </button>
    </form>
  );
}
