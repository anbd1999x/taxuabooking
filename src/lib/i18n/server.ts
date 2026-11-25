import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_LOCALE,
  LOCALE_HEADER,
  identityT,
  isLocale,
  localePath,
  makeT,
  normSource,
  type Dict,
  type Locale,
  type TFunc,
} from "./config";

/** Chuỗi gốc dài hơn ngưỡng này (mô tả, bài viết, chính sách…) không nạp vào map chung — tra riêng theo hash. */
export const SHORT_TEXT_MAX = 600;
export const TRANSLATIONS_TAG = "translations";

export function hashSource(s: string): string {
  return createHash("sha1").update(s).digest("hex");
}

/** Ngôn ngữ của request hiện tại (proxy gắn header `x-locale` theo tiền tố URL). */
export const getLocale = cache(async (): Promise<Locale> => {
  try {
    const v = (await headers()).get(LOCALE_HEADER);
    return isLocale(v) ? v : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE; // ngoài phạm vi request (script, cron)
  }
});

/** Từ điển giao diện cố định (dịch sẵn trong mã nguồn). */
export async function loadDict(locale: Locale): Promise<Dict> {
  switch (locale) {
    case "en":
      return (await import("./dict/en.json")).default as Dict;
    case "zh":
      return (await import("./dict/zh.json")).default as Dict;
    case "ko":
      return (await import("./dict/ko.json")).default as Dict;
    default:
      return {};
  }
}

/** Bản dịch nội dung NGẮN admin nhập (tên, khu vực, tiện ích…): map chuỗi gốc → bản dịch. */
const contentMapCached = unstable_cache(
  async (locale: string): Promise<Dict> => {
    // Bản dịch thực đơn gọi món QR do chủ quán tự nhập (entity DineMenu) KHÔNG vào kho chung — xem src/lib/dine-tr.ts.
    const rows = await prisma.translation.findMany({ where: { locale, entity: { not: "DineMenu" } }, select: { source: true, value: true } });
    const out: Dict = {};
    for (const r of rows) {
      const key = normSource(r.source); // khớp cách makeT chuẩn hoá khoá khi tra
      if (key.length <= SHORT_TEXT_MAX && r.value.trim()) out[key] = r.value;
    }
    return out;
  },
  ["i18n-content-map"],
  { revalidate: 300, tags: [TRANSLATIONS_TAG] },
);

export async function getContentMap(locale: Locale): Promise<Dict> {
  if (locale === DEFAULT_LOCALE) return {};
  return contentMapCached(locale).catch(() => ({}));
}

/** Phiên bản của map bản dịch (hash nội dung) — đổi khi admin sửa bản dịch; dùng làm khoá cache phía trình duyệt. */
export function contentVersionOf(map: Dict): string {
  return hashSource(JSON.stringify(map)).slice(0, 12);
}

const contentVersionCached = unstable_cache(
  async (locale: string): Promise<string> => contentVersionOf(await contentMapCached(locale)),
  ["i18n-content-version"],
  { revalidate: 300, tags: [TRANSLATIONS_TAG] },
);

/** Phiên bản map bản dịch nội dung (cache, không hash lại mỗi request). Lỗi DB ⇒ phiên bản của map rỗng. */
export async function getContentVersion(locale: Locale): Promise<string> {
  if (locale === DEFAULT_LOCALE) return "";
  return contentVersionCached(locale).catch(() => contentVersionOf({}));
}

/** Hàm dịch cho Server Component / generateMetadata / server action: `const t = await getT()`. */
export const getT = cache(async (): Promise<TFunc> => {
  const locale = await getLocale();
  if (locale === DEFAULT_LOCALE) return identityT;
  const [dict, content] = await Promise.all([loadDict(locale), getContentMap(locale)]);
  return makeT(dict, content);
});

/** Gắn tiền tố ngôn ngữ hiện tại cho đường dẫn nội bộ (dùng cho redirect() phía server). */
export async function lp(href: string): Promise<string> {
  return localePath(href, await getLocale());
}

const longLookup = cache(async (locale: string, hash: string): Promise<string | null> => {
  const row = await prisma.translation
    .findFirst({ where: { locale, sourceHash: hash, entity: { not: "DineMenu" } }, select: { value: true }, orderBy: { updatedAt: "desc" } })
    .catch(() => null);
  return row?.value?.trim() ? row.value : null;
});

/**
 * Dịch nội dung DÀI do admin nhập (mô tả dịch vụ, bài viết, chính sách…): tra theo hash chuỗi gốc.
 * Chưa có bản dịch (hoặc nội dung gốc đã đổi) ⇒ trả nguyên tiếng Việt.
 */
export async function tLong<T extends string | null | undefined>(text: T): Promise<T> {
  if (!text) return text;
  const locale = await getLocale();
  if (locale === DEFAULT_LOCALE) return text;
  // Chuẩn hoá xuống dòng Windows (CR LF) như lúc lưu bản dịch — hash tính trên chuỗi đã bỏ CR, xem normSource.
  const norm = normSource(text);
  if (norm.length <= SHORT_TEXT_MAX) return (await getT())(text) as T;
  return ((await longLookup(locale, hashSource(norm))) ?? text) as T;
}
