"use client";

import { useEffect, useRef, useState } from "react";

const PAGE = "oklch(0.975 0.01 150)";
const BORDER = "oklch(0.88 0.02 160)";

/**
 * Bọc nội dung "Về quán" (HTML dựng từ markdown ở server) trong khối thu gọn:
 * cao tối đa ~150px khi đóng + lớp mờ cuối, bấm để mở/thu. Nếu nội dung vốn ngắn
 * thì ẩn luôn nút (không cần thu gọn).
 */
export function ExpandableDescription({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [needsClamp, setNeedsClamp] = useState(true);

  useEffect(() => {
    const el = ref.current;
    if (el) setNeedsClamp(el.scrollHeight > 170);
  }, []);

  return (
    <div className="flex flex-col gap-3">
      <div className="relative overflow-hidden transition-[max-height] duration-500 ease-[cubic-bezier(.2,.7,.2,1)]" style={{ maxHeight: open || !needsClamp ? 2000 : 150 }}>
        <div ref={ref}>{children}</div>
        {needsClamp && !open && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[70px]" style={{ background: `linear-gradient(180deg, transparent, ${PAGE})` }} />
        )}
      </div>
      {needsClamp && (
        <button type="button" onClick={() => setOpen((v) => !v)} className="self-start rounded-full bg-white px-4 py-2.5 text-sm font-bold" style={{ border: `1.5px solid ${BORDER}`, color: "oklch(0.3 0.05 160)" }}>
          {open ? "Thu gọn ↑" : "Đọc đầy đủ ↓"}
        </button>
      )}
    </div>
  );
}
