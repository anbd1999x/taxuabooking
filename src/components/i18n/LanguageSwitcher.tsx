"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { LOCALES, LOCALE_META, localePath, splitLocale, type Locale } from "@/lib/i18n/config";
import { useLocale } from "./I18nProvider";
import { cn } from "@/lib/utils";

/** Đường dẫn trang hiện tại ở ngôn ngữ khác. */
function hrefFor(pathname: string, target: Locale): string {
  const base = splitLocale(pathname).pathname;
  return target === "vi" ? base : localePath(base, target);
}
/** Lúc bấm mới nối query hiện tại (ngày đã chọn, bộ lọc…) — tránh lệch HTML server/client. */
function keepQuery(e: React.MouseEvent<HTMLAnchorElement>) {
  const a = e.currentTarget;
  if (!a.search && window.location.search) a.search = window.location.search;
}

/**
 * Nút đổi ngôn ngữ. Dùng <a> thường (tải lại cả trang) để layout nạp đúng từ điển của ngôn ngữ mới.
 * `variant="menu"` = dạng hàng nút trong drawer mobile.
 */
export function LanguageSwitcher({ variant = "dropdown" }: { variant?: "dropdown" | "menu" }) {
  const locale = useLocale();
  const pathname = usePathname() || "/";
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  if (variant === "menu") {
    return (
      <div className="flex flex-wrap gap-1.5 px-1.5 py-2" aria-label="Language">
        {LOCALES.map((l) => (
          <a
            key={l}
            href={hrefFor(pathname, l)}
            hrefLang={LOCALE_META[l].htmlLang}
            onClick={keepQuery}
            className={cn(
              "rounded-full px-3 py-1.5 text-[13px] font-bold ring-1 transition",
              l === locale ? "bg-forest-600 text-white ring-forest-600" : "bg-white text-gray-700 ring-black/10 hover:bg-forest-50",
            )}
          >
            {LOCALE_META[l].label}
          </a>
        ))}
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="Language"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 whitespace-nowrap rounded-lg px-1.5 py-1 text-[12px] font-bold text-forest-700 transition hover:bg-forest-50 sm:px-2 sm:py-2 sm:text-sm"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.500 5.600 12 3z" />
        </svg>
        {LOCALE_META[locale].short}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-40 rounded-xl bg-white p-1.5 shadow-lg ring-1 ring-black/5">
          {LOCALES.map((l) => (
            <a
              key={l}
              href={hrefFor(pathname, l)}
              hrefLang={LOCALE_META[l].htmlLang}
              onClick={keepQuery}
              className={cn(
                "flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition hover:bg-forest-50",
                l === locale ? "font-bold text-forest-700" : "text-gray-700",
              )}
            >
              {LOCALE_META[l].label}
              {l === locale && <span aria-hidden>✓</span>}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
