"use client";

import { createContext, useContext, useEffect, useMemo, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { DEFAULT_LOCALE, identityT, localePath, makeT, withVoice, type Dict, type Locale, type TFunc } from "@/lib/i18n/config";
import { CONTENT_GLOBAL, contentUrl, ssrContentStore } from "@/lib/i18n/content-store";

interface I18nValue {
  locale: Locale;
  t: TFunc;
}

const I18nContext = createContext<I18nValue>({ locale: DEFAULT_LOCALE, t: identityT });

/**
 * Bản dịch nội dung DB (xem lib/i18n/content-store.ts) — đọc ĐỒNG BỘ, không treo (suspend):
 *  - SSR: map layout vừa ghi trong tiến trình;
 *  - trình duyệt: biến toàn cục do script `beforeInteractive` ở layout gốc gán TRƯỚC khi hydrate ⇒ khớp HTML server.
 * Trường hợp hiếm (script lỗi mạng, hoặc đổi ngôn ngữ bằng điều hướng mềm): tải JSON rồi cập nhật — trong lúc chờ,
 * chuỗi nội dung DB tạm hiện tiếng Việt. KHÔNG dùng `use()` + `<Suspense>` bọc trang: Suspense ở đây làm Next gửi
 * mã 200 trước khi trang gọi notFound() / redirect() (soft 404 + mất 308 trên cả ba bản dịch).
 */
const EMPTY: Dict = {};
const store = new Map<Locale, Dict>();
const pending = new Set<Locale>();
const listeners = new Set<() => void>();
const RETRY_MS = [1500, 4000];

function fromGlobal(locale: Locale): Dict | undefined {
  const g = (globalThis as unknown as Record<string, { l?: string; d?: Dict } | undefined>)[CONTENT_GLOBAL];
  return g && g.l === locale && g.d ? g.d : undefined;
}

async function fetchContent(locale: Locale, v: string): Promise<void> {
  for (let i = 0; ; i++) {
    try {
      const r = await fetch(contentUrl(locale, v));
      if (r.ok) {
        store.set(locale, (await r.json()) as Dict);
        break;
      }
    } catch {
      /* lỗi mạng ⇒ thử lại */
    }
    if (i >= RETRY_MS.length) break; // tải lỗi hẳn ⇒ lần render / chuyển trang sau thử lại
    await new Promise((res) => setTimeout(res, RETRY_MS[i]));
  }
  pending.delete(locale);
  listeners.forEach((fn) => fn());
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function useRemoteContent(locale: Locale, v: string): Dict {
  const content = useSyncExternalStore(
    subscribe,
    () => store.get(locale) ?? fromGlobal(locale) ?? EMPTY,
    // Lúc SSR và lúc hydrate: server đọc map trong tiến trình; trình duyệt đọc biến toàn cục (đã có trước khi hydrate).
    () => (typeof window === "undefined" ? (ssrContentStore()[locale] ?? EMPTY) : (fromGlobal(locale) ?? EMPTY)),
  );
  useEffect(() => {
    if (content !== EMPTY || pending.has(locale)) return;
    pending.add(locale);
    void fetchContent(locale, v);
  }, [content, locale, v]);
  return content;
}

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
  solo = false,
  children,
}: {
  locale: Locale;
  /** Tiếng Việt: web chỉ còn 1 chủ sở hữu ⇒ mọi "tụi mình" thành "mình". */
  solo?: boolean;
  dict: Dict;
  content?: Dict;
  /** Phiên bản bản dịch nội dung — có thì tự tải map (không nhúng map vào RSC payload). */
  contentVersion?: string;
  children: React.ReactNode;
}) {
  const value = useMemo<I18nValue>(
    () => ({ locale, t: locale === DEFAULT_LOCALE ? withVoice(identityT, solo) : makeT(dict, contentProp) }),
    [locale, dict, contentProp, solo],
  );
  if (contentVersion && !contentProp && locale !== DEFAULT_LOCALE) {
    return (
      <RemoteContentProvider locale={locale} dict={dict} v={contentVersion}>
        {children}
      </RemoteContentProvider>
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
