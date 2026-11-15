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

function Globe({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z" />
    </svg>
  );
}

/**
 * Nút đổi ngôn ngữ. Dùng <a> thường (tải lại cả trang) để layout nạp đúng từ điển của ngôn ngữ mới.
 * - `dropdown` (desktop): chữ mã ngôn ngữ, màu theo header (`onDark` = đang nằm trên ảnh hero).
 * - `pill` (mobile, cạnh nút menu): viên kính mờ có quả địa cầu + mã + ▼.
 * - `segment` (trong drawer menu tối): 4 ô chia đều.
 */
export function LanguageSwitcher({ variant = "dropdown", onDark = false }: { variant?: "dropdown" | "pill" | "segment"; onDark?: boolean }) {
  const locale = useLocale();
  const pathname = usePathname() || "/";
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onScroll = () => setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("touchstart", close);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("touchstart", close);
      window.removeEventListener("scroll", onScroll);
    };
  }, [open]);

  if (variant === "segment") {
    return (
      <div className="grid grid-cols-4 gap-1 rounded-[14px] bg-black/20 p-1" aria-label="Language">
        {LOCALES.map((l) => (
          <a
            key={l}
            href={hrefFor(pathname, l)}
            hrefLang={LOCALE_META[l].htmlLang}
            onClick={keepQuery}
            className={cn(
              "whitespace-nowrap rounded-[10px] px-1 py-2.5 text-center text-[13px] font-extrabold transition",
              l === locale ? "bg-[oklch(0.96_0.015_90)] text-[oklch(0.25_0.05_160)]" : "text-[oklch(0.9_0.015_90)] hover:bg-white/10",
            )}
          >
            {LOCALE_META[l].label}
          </a>
        ))}
      </div>
    );
  }

  const pill = variant === "pill";
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="Language"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex items-center whitespace-nowrap font-extrabold transition",
          pill
            ? cn(
                "h-8 gap-1 rounded-full border px-2.5 text-xs backdrop-blur-md",
                onDark ? "border-white/25 bg-white/15 text-white" : "border-black/10 bg-[oklch(0.96_0.015_155)] text-forest-800",
              )
            : cn("gap-1 rounded-full px-2 py-1.5 text-[13px]", onDark ? "text-white hover:bg-white/10" : "text-forest-700 hover:bg-forest-50"),
        )}
      >
        <Globe className="h-3.5 w-3.5" />
        {LOCALE_META[locale].short}
        <span className={cn("text-[8px] opacity-80 transition-transform duration-200", open && "rotate-180")}>▼</span>
      </button>
      <div
        className={cn(
          "absolute right-0 top-[calc(100%+8px)] z-50 min-w-[180px] origin-top-right rounded-2xl bg-white p-1.5 text-[oklch(0.25_0.03_160)] shadow-[0_20px_40px_-14px_oklch(0.15_0.04_165/.45),0_0_0_1px_oklch(0.92_0.01_160)] transition duration-200",
          open ? "scale-100 opacity-100" : "pointer-events-none -translate-y-1.5 scale-95 opacity-0",
        )}
      >
        {LOCALES.map((l) => (
          <a
            key={l}
            href={hrefFor(pathname, l)}
            hrefLang={LOCALE_META[l].htmlLang}
            onClick={keepQuery}
            className={cn(
              "flex items-center justify-between gap-3 rounded-[11px] px-3 py-2.5 text-sm font-bold transition hover:bg-[oklch(0.96_0.015_155)]",
              l === locale && "bg-[oklch(0.95_0.025_155)]",
            )}
          >
            <span>{LOCALE_META[l].label}</span>
            <span className={cn("text-xs font-extrabold", l === locale ? "text-forest-700" : "text-gray-400")}>
              {l === locale ? "✓" : LOCALE_META[l].short}
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}
