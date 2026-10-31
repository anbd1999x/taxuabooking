"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export function CabinSearch({
  initialFrom = "",
  initialTo = "",
}: {
  initialFrom?: string;
  initialTo?: string;
}) {
  const router = useRouter();
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);

  function submit() {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    // Không chọn gì → mặc định tìm chiều đi hôm nay.
    if (!from && !to) params.set("from", todayKey());
    router.push(`/xe-cabin?${params.toString()}`);
  }

  const cell = "flex flex-col gap-1 rounded-2xl bg-[oklch(0.965_0.01_150)] px-4 py-3";

  return (
    <div className="rounded-[22px] bg-white p-2.5 shadow-[0_20px_50px_-24px_rgba(30,70,45,0.4)] ring-1 ring-black/[0.05]">
      <div className="grid gap-1.5 sm:grid-cols-[1fr_1fr_auto]">
        <label className={cell}>
          <span className="text-xs font-medium text-gray-500">Ngày đi</span>
          <input
            type="date"
            value={from}
            min={todayKey()}
            onChange={(e) => setFrom(e.target.value)}
            className="bg-transparent text-[15px] font-bold text-ink outline-none"
          />
        </label>
        <label className={cell}>
          <span className="text-xs font-medium text-gray-500">Ngày về (tuỳ chọn)</span>
          <input
            type="date"
            value={to}
            min={from || todayKey()}
            onChange={(e) => setTo(e.target.value)}
            className="bg-transparent text-[15px] font-bold text-ink outline-none"
          />
        </label>
        <button
          type="button"
          onClick={submit}
          className="flex items-center justify-center gap-2 rounded-2xl bg-sunset-500 px-6 py-4 text-base font-bold text-white transition hover:bg-sunset-600 active:scale-[0.98]"
        >
          Tìm vé <span>→</span>
        </button>
      </div>
    </div>
  );
}
