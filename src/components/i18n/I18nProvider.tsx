"use client";

import { createContext, Suspense, use, useContext, useMemo } from "react";
import { useRouter } from "next/navigation";
import { DEFAULT_LOCALE, identityT, localePath, makeT, type Dict, type Locale, type TFunc } from "@/lib/i18n/config";
import { contentUrl, ssrContentStore } from "@/lib/i18n/content-store";

interface I18nValue {
  locale: Locale;
  t: TFunc;
}

const I18nContext = createContext<I18nValue>({ locale: DEFAULT_LOCALE, t: identityT });

/** Promise tải bản dịch nội dung theo (ngôn ngữ, phiên bản) — giữ cố định để `use()` không treo lại khi chuyển trang. */
const remote = new Map<string, Promise<Dict>>();
const RETRY_MS = [1500, 4000];
async function fetchContent(locale: Locale, v: string): Promise<Dict | null> {
  for (let i = 0; ; i++) {
    try {
      const r = await fetch(contentUrl(locale, v));
      if (r.ok) return (await r.json()) as Dict;
    } catch {
      /* lỗi mạng ⇒ thử lại */
    }
    // Đang chờ thì HTML server (đã dịch) vẫn hiển thị nhờ Suspense — thử lại vài lần rồi mới rơi về map rỗng.
    if (i >= RETRY_MS.length) return null; // báo lỗi để loadContent không ghi nhớ kết quả rỗng
    await new Promise((res) => setTimeout(res, RETRY_MS[i]));
  }
}
function loadContent(locale: Locale, v: string): Promise<Dict> {
  const key = `${locale}:${v}`;
  let p = remote.get(key);
  if (!p) {
    // Tải lỗi hẳn ⇒ bỏ khỏi bộ nhớ đệm để lần render / chuyển trang sau thử lại (không kẹt tiếng Việt tới khi F5).
    p = fetchContent(locale, v).then((d) => {
      if (d) return d;
      remote.delete(key);
      return {};
    });
    remote.set(key, p);
  }
  return p;
}

/**
 * Bản dịch nội dung DB theo phiên bản `v` (xem lib/i18n/content-store.ts): SSR đọc map layout vừa ghi trong
 * tiến trình; trình duyệt tải file JSON cache được.
 */
function useRemoteContent(locale: Locale, v: string): Dict {
  if (typeof window === "undefined") return ssrContentStore()[locale] ?? {};
  return use(loadContent(locale, v));
}

/**
 * Context có map nội dung tải riêng — nằm TRONG Suspense: lúc hydrate mà JSON chưa về thì React giữ nguyên
 * HTML server (đã dịch) thay vì hydrate lại cả root; chuyển trang (transition) thì giữ giao diện cũ.
 */
function RemoteContentProvider({
  locale,
  dict,
  v,
  children,
}: {
  locale: Locale;
  dict: Dict;
  v: string;
  children: React.ReactNode;
}) {
  const content = useRemoteContent(locale, v);
  const value = useMemo<I18nValue>(() => ({ locale, t: makeT(dict, content) }), [locale, dict, content]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/**
 * Cấp ngôn ngữ + hàm dịch cho Client Component. Không bọc provider (khu /admin) ⇒ tiếng Việt.
 * `dict` = từ điển giao diện (mỗi ngôn ngữ 1 chunk riêng — xem I18nLocale*.tsx), `content` = bản dịch
 * nội dung ngắn admin nhập — layout chỉ truyền `contentVersion`, map tải riêng (RemoteContentProvider).
 */
export function I18nProvider({
  locale,
  dict,
  content: contentProp,
  contentVersion,
  children,
}: {
  locale: Locale;
  dict: Dict;
  content?: Dict;
  /** Phiên bản bản dịch nội dung — có thì tự tải map (không nhúng map vào RSC payload). */
  contentVersion?: string;
  children: React.ReactNode;
}) {
  const value = useMemo<I18nValue>(
    () => ({ locale, t: locale === DEFAULT_LOCALE ? identityT : makeT(dict, contentProp) }),
    [locale, dict, contentProp],
  );
  if (contentVersion && !contentProp && locale !== DEFAULT_LOCALE) {
    return (
      <Suspense fallback={null}>
        <RemoteContentProvider locale={locale} dict={dict} v={contentVersion}>
          {children}
        </RemoteContentProvider>
      </Suspense>
    );
  }
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
