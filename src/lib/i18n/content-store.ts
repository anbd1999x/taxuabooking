/**
 * Bản dịch nội dung NGẮN (DB) cho Client Component — KHÔNG nhúng vào RSC payload của từng trang nữa
 * (≈270KB/trang en/zh/ko, kể cả trang không dùng tới). Thay vào đó:
 *  - trình duyệt tải 1 file JSON `/api/i18n/content?l=<locale>&v=<phiên bản>` (cache immutable theo phiên bản,
 *    layout preload sớm) — sang trang khác không tải lại;
 *  - lúc SSR, Client Component đọc map từ bộ nhớ tiến trình do layout (Server Component) ghi vào `globalThis`
 *    (RSC + SSR chạy chung một tiến trình) ⇒ HTML vẫn được dịch sẵn, hydrate khớp.
 * File thuần: dùng được ở cả server lẫn client (không "use client", không "server-only").
 */
import type { Dict, Locale } from "./config";

const STORE_KEY = "__txI18nContent";

/** Map bản dịch theo ngôn ngữ, dùng chung trong tiến trình server (chỉ đọc/ghi phía server). */
export function ssrContentStore(): Partial<Record<Locale, Dict>> {
  const g = globalThis as unknown as Record<string, Partial<Record<Locale, Dict>> | undefined>;
  return (g[STORE_KEY] ??= {});
}

/** URL tải bản dịch nội dung — `v` đổi khi bản dịch đổi ⇒ trình duyệt cache vĩnh viễn từng phiên bản. */
export function contentUrl(locale: Locale, v: string): string {
  return `/api/i18n/content?l=${locale}&v=${encodeURIComponent(v)}`;
}
