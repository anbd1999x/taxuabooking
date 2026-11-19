"use client";

import dict from "@/lib/i18n/dict/en.json";
import type { Dict } from "@/lib/i18n/config";
import { I18nProvider } from "./I18nProvider";

/** Provider riêng cho "en": từ điển nằm trong chunk này, chỉ tải khi khách xem ngôn ngữ đó. */
export function I18nLocaleEn({ content, contentVersion, children }: { content?: Dict; contentVersion?: string; children: React.ReactNode }) {
  return (
    <I18nProvider locale="en" dict={dict as Dict} content={content} contentVersion={contentVersion}>
      {children}
    </I18nProvider>
  );
}
