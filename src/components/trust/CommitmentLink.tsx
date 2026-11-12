"use client";

import { createContext, useContext } from "react";
import Link from "next/link";

/** Công tắc "Hiển thị" phần cam kết (ở /admin/popup). Ngoài provider (vd trang admin) coi như đang bật. */
const CommitmentEnabledContext = createContext(true);

export function CommitmentEnabledProvider({ enabled, children }: { enabled: boolean; children: React.ReactNode }) {
  return <CommitmentEnabledContext.Provider value={enabled}>{children}</CommitmentEnabledContext.Provider>;
}

/** Link "Cam kết uy tín" đặt dưới nút gửi yêu cầu đặt dịch vụ (mọi form đặt). Ẩn khi phần cam kết bị tắt. */
export function CommitmentLink({ className }: { className?: string }) {
  const enabled = useContext(CommitmentEnabledContext);
  if (!enabled) return null;
  return (
    <Link
      href="/cam-ket"
      className={
        className ??
        "mt-2 flex items-center justify-center gap-1.5 text-center text-xs font-semibold text-forest-700 transition hover:text-forest-900"
      }
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="m9 12 2 2 4-4" />
      </svg>
      Xem cam kết uy tín →
    </Link>
  );
}
