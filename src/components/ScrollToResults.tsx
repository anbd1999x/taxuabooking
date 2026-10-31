"use client";

import { useEffect, useRef } from "react";

/**
 * Sau khi tìm kiếm, tự cuộn tới vùng kết quả (quan trọng trên mobile — hero + ô
 * tìm kiếm chiếm hết màn hình nên kết quả nằm dưới tầm nhìn). Dùng cho các trang
 * render kết quả phía server (combo, danh mục chung): bọc khối kết quả lại,
 * truyền `token` đổi mỗi lần tìm kiếm và `enabled` = đang có tìm kiếm.
 */
export function ScrollToResults({
  token,
  enabled = true,
  offset = 12,
  children,
}: {
  token: string;
  enabled?: boolean;
  offset?: number;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!enabled) return;
    const el = ref.current;
    if (!el) return;
    // Chờ kết quả mới render & trình duyệt bỏ qua auto-scroll của router rồi mới cuộn.
    const id = window.setTimeout(() => {
      const top = el.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: "smooth" });
    }, 90);
    return () => window.clearTimeout(id);
  }, [token, enabled, offset]);

  return (
    <div ref={ref} style={{ scrollMarginTop: offset }}>
      {children}
    </div>
  );
}
