"use client";

import { createContext, useContext } from "react";
import Link from "@/components/Link";
import { useT } from "@/components/i18n/I18nProvider";

/** Công tắc "Hiển thị" phần cam kết (ở /admin/popup). Ngoài provider (vd trang admin) coi như đang bật. */
const CommitmentEnabledContext = createContext(true);

export function CommitmentEnabledProvider({ enabled, children }: { enabled: boolean; children: React.ReactNode }) {
  return <CommitmentEnabledContext.Provider value={enabled}>{children}</CommitmentEnabledContext.Provider>;
}


/**
 * Link dưới nút gửi yêu cầu của mọi form đặt: CHỈ còn "Hướng dẫn đặt dịch vụ" (link "Cam kết uy tín" đã dời lên đầu
 * trang /huong-dan — xem `CommitmentHeroLink` — để dưới bill không quá nhiều link). Mở tab mới để không mất thông tin đang điền.
 */
export function CommitmentLink({ className }: { className?: string }) {
  const t = useT();
  const cls = className ?? "mt-2 flex items-center justify-center gap-1.5 text-center text-xs font-semibold text-forest-700 transition hover:text-forest-900";
  return (
    <Link href="/huong-dan" target="_blank" className={cls}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3" />
        <path d="M12 17h.01" />
      </svg>
      {t("Hướng dẫn check legit và đặt dịch vụ 6 bước")}
    </Link>
  );
}

/** Nút "Cam kết dịch vụ" ở hero trang /huong-dan. Ẩn khi phần cam kết bị tắt ở /admin/popup. */
export function CommitmentHeroLink({ className }: { className?: string }) {
  const t = useT();
  const enabled = useContext(CommitmentEnabledContext);
  if (!enabled) return null;
  return (
    <Link href="/cam-ket" className={className} style={{ background: "oklch(0.29 0.055 160)" }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6zM8.5 12l2.5 2.5 4.5-5" />
      </svg>
      {t("Cam kết dịch vụ")}
    </Link>
  );
}
