import "server-only";
import type { Metadata } from "next";
import { ogBlock } from "@/lib/og";
import { LOCALE_META, TARGET_LOCALES, localePath } from "./config";
import { getLocale, getT } from "./server";

/**
 * canonical + hreflang cho 1 đường dẫn (truyền đường dẫn GỐC tiếng Việt, vd "/homestay").
 * canonical trỏ về chính bản ngôn ngữ đang xem; `languages` liệt kê đủ 4 bản để Google ghép cặp.
 */
export async function i18nAlternates(path: string): Promise<NonNullable<Metadata["alternates"]>> {
  const locale = await getLocale();
  const languages: Record<string, string> = { [LOCALE_META.vi.htmlLang]: path, "x-default": path };
  for (const l of TARGET_LOCALES) languages[LOCALE_META[l].htmlLang] = localePath(path, l);
  return { canonical: localePath(path, locale), languages };
}

/** Khối openGraph theo ngôn ngữ đang xem (og:locale + og:url có tiền tố). Chuỗi truyền vào đã dịch sẵn. */
export async function i18nOg(o: Parameters<typeof ogBlock>[0]): Promise<NonNullable<Metadata["openGraph"]>> {
  const locale = await getLocale();
  return { ...ogBlock({ ...o, path: localePath(o.path, locale) }), locale: LOCALE_META[locale].og };
}

/**
 * Metadata cho trang tĩnh, có dịch: `title`/`description`/`alt` là chuỗi tiếng Việt gốc (khoá từ điển).
 * Thay cho `pageMeta` ở trang khách.
 */
export async function i18nMeta(o: {
  title: string;
  description: string;
  path: string;
  image?: string | null;
  alt?: string;
}): Promise<Metadata> {
  const t = await getT();
  const title = t(o.title);
  const description = t(o.description);
  return {
    // Dài hơn 43 ký tự thì KHÔNG nối " | Tà Xùa Booking" (17 ký tự) để tiêu đề không vượt 60.
    title: title.length > 43 ? { absolute: title } : title,
    description,
    alternates: await i18nAlternates(o.path),
    openGraph: await i18nOg({ ...o, title, description, alt: o.alt ? t(o.alt) : undefined }),
  };
}
