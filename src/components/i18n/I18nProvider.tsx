"use client";

import { createContext, useContext, useMemo } from "react";
import { useRouter } from "next/navigation";
import { DEFAULT_LOCALE, identityT, localePath, makeT, type Dict, type Locale, type TFunc } from "@/lib/i18n/config";

interface I18nValue {
  locale: Locale;
  t: TFunc;
}

const I18nContext = createContext<I18nValue>({ locale: DEFAULT_LOCALE, t: identityT });

/**
 * Cấp ngôn ngữ + hàm dịch cho Client Component. Không bọc provider (khu /admin) ⇒ tiếng Việt.
 * `dict` = từ điển giao diện (mỗi ngôn ngữ 1 chunk riêng — xem I18nLocale*.tsx), `content` = bản dịch
 * nội dung ngắn admin nhập (truyền từ layout).
 */
export function I18nProvider({
  locale,
  dict,
  content,
  children,
}: {
  locale: Locale;
  dict: Dict;
  content?: Dict;
  children: React.ReactNode;
}) {
  const value = useMemo<I18nValue>(
    () => ({ locale, t: locale === DEFAULT_LOCALE ? identityT : makeT(dict, content) }),
    [locale, dict, content],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** Hàm dịch trong Client Component: `const t = useT()` → `t("Đặt phòng")`, `t("Còn {0} phòng", [n])`. */
export function useT(): TFunc {
  return useContext(I18nContext).t;
}

export function useLocale(): Locale {
  return useContext(I18nContext).locale;
}

/** Trả hàm gắn tiền tố ngôn ngữ hiện tại cho đường dẫn nội bộ (router.push, window.location…). */
export function useLocalePath(): (href: string) => string {
  const locale = useLocale();
  return useMemo(() => (href: string) => localePath(href, locale), [locale]);
}

/** `useRouter` có sẵn tiền tố ngôn ngữ cho push/replace. */
export function useLocaleRouter() {
  const router = useRouter();
  const lp = useLocalePath();
  return useMemo(
    () => ({
      ...router,
      push: (href: string, opts?: Parameters<typeof router.push>[1]) => router.push(lp(href), opts),
      replace: (href: string, opts?: Parameters<typeof router.replace>[1]) => router.replace(lp(href), opts),
    }),
    [router, lp],
  );
}
