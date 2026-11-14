"use client";

import { useEffect, useState } from "react";
import { SITE } from "@/lib/site";

/** Đang ngoài giờ hỗ trợ (theo giờ Việt Nam)? null = chưa biết (render phía server). */
function useOffHours(): boolean | null {
  const [off, setOff] = useState<boolean | null>(null);
  useEffect(() => {
    const check = () => {
      const h = (new Date().getUTCHours() + 7) % 24; // giờ VN (UTC+7)
      setOff(h < SITE.supportOpenHour || h >= SITE.supportCloseHour);
    };
    check();
    const t = setInterval(check, 60_000);
    return () => clearInterval(t);
  }, []);
  return off;
}

/**
 * Thông báo GIỜ HOẠT ĐỘNG đặt cạnh thông báo "đã gửi yêu cầu": khách biết ngoài giờ làm việc
 * không có người hỗ trợ, đơn được xử lý khi vào giờ. Đang ngoài giờ ⇒ nổi bật màu cam.
 */
export function SupportHoursNote({ className = "" }: { className?: string }) {
  const off = useOffHours();
  const open = `${SITE.supportOpenHour}:00`;
  return (
    <div
      className={`rounded-xl px-3.5 py-2.5 text-left text-[13px] leading-relaxed ${
        off ? "bg-amber-50 text-amber-900 ring-1 ring-amber-200" : "bg-white/80 text-gray-600 ring-1 ring-black/5"
      } ${className}`}
    >
      <b>🕗 Giờ hoạt động: {SITE.supportHours} hằng ngày.</b>{" "}
      {off
        ? `Hiện đã ngoài giờ làm việc nên chưa có người hỗ trợ — đơn của bạn đã được ghi nhận và sẽ được xác nhận từ ${open}.`
        : `Đơn gửi sau giờ làm việc sẽ không có người hỗ trợ ngay, được xác nhận từ ${open} hôm sau.`}
    </div>
  );
}
