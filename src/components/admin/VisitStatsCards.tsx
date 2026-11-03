"use client";

import { useEffect, useState } from "react";
import type { VisitStats } from "@/lib/visits";

const fmt = (n: number) => n.toLocaleString("vi-VN");

/**
 * 3 thẻ thống kê truy cập website trên dashboard: đang truy cập (live, poll 30s),
 * tổng lượt xem trang và tổng khách truy cập từ trước tới giờ.
 */
export function VisitStatsCards({ initial }: { initial: VisitStats }) {
  const [stats, setStats] = useState(initial);

  useEffect(() => {
    const tick = async () => {
      try {
        const res = await fetch("/api/admin/visits", { cache: "no-store" });
        if (res.ok) setStats(await res.json());
      } catch {
        /* mất mạng tạm thời ⇒ giữ số cũ */
      }
    };
    const t = setInterval(tick, 30_000);
    return () => clearInterval(t);
  }, []);

  const cards = [
    {
      label: "Đang truy cập",
      value: fmt(stats.online),
      hint: "hoạt động 5 phút qua",
      live: true,
    },
    { label: "Lượt truy cập (từ trước tới giờ)", value: fmt(stats.totalViews), hint: "lượt xem trang" },
    { label: "Khách truy cập", value: fmt(stats.totalVisitors), hint: "thiết bị duy nhất" },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {cards.map((c) => (
        <div key={c.label} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
          <div className="flex items-center gap-2">
            {c.live && (
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-forest-400 opacity-60" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-forest-500" />
              </span>
            )}
            <p className="text-3xl font-extrabold text-forest-700">{c.value}</p>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            {c.label} <span className="text-gray-400">· {c.hint}</span>
          </p>
        </div>
      ))}
    </div>
  );
}
