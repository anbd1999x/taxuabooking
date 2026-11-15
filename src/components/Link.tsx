"use client";

import NextLink from "next/link";
import type { ComponentProps } from "react";
import { localePath } from "@/lib/i18n/config";
import { useLocale } from "@/components/i18n/I18nProvider";

/**
 * Thay cho `next/link` ở trang khách: tự gắn tiền tố ngôn ngữ hiện tại (/en, /zh, /ko) vào
 * đường dẫn nội bộ. Tiếng Việt (và khu /admin, không có provider) ⇒ giữ nguyên href.
 */
export default function Link({ href, ...rest }: ComponentProps<typeof NextLink>) {
  const locale = useLocale();
  return <NextLink href={typeof href === "string" ? localePath(href, locale) : href} {...rest} />;
}
