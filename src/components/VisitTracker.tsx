"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

// Chống ghi trùng: React StrictMode (dev) chạy effect 2 lần, hoặc re-render cùng path.
let lastKey = "";
let lastAt = 0;

/** Gửi 1 lượt xem trang về /api/track mỗi khi đổi đường dẫn trên website công khai. */
export function VisitTracker() {
  const pathname = usePathname();

  useEffect(() => {
    const now = Date.now();
    if (pathname === lastKey && now - lastAt < 5000) return;
    lastKey = pathname;
    lastAt = now;
    fetch("/api/track", { method: "POST", keepalive: true }).catch(() => {});
  }, [pathname]);

  return null;
}
