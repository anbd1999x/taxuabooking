"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

/**
 * Điều hướng TÌM KIẾM có trạng thái loading: push/replace + refresh chạy trong
 * transition nên `pending` = true suốt lúc server render lại kết quả — dùng để
 * hiện vòng xoay/disable nút tìm ở mọi ô tìm kiếm của hệ thống.
 */
export function useSearchNav() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function go(url: string, opts?: { replace?: boolean; refresh?: boolean }) {
    startTransition(() => {
      if (opts?.replace) router.replace(url, { scroll: false });
      else router.push(url, { scroll: false });
      if (opts?.refresh !== false) router.refresh();
    });
  }

  return { pending, go };
}

/** Vòng xoay nhỏ cho nút tìm kiếm khi đang tải. */
export function SearchSpinner({ dark = false }: { dark?: boolean }) {
  return (
    <span
      aria-hidden
      className={`inline-block h-4 w-4 flex-none animate-spin rounded-full border-2 ${
        dark ? "border-forest-700/30 border-t-forest-700" : "border-white/40 border-t-white"
      }`}
    />
  );
}
