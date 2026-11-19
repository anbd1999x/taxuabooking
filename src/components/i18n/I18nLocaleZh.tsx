"use client";

import dict from "@/lib/i18n/dict/zh.json";
import type { Dict } from "@/lib/i18n/config";
import { I18nProvider } from "./I18nProvider";

/** Provider riêng cho "zh": từ điển nằm trong chunk này, chỉ tải khi khách xem ngôn ngữ đó. */
export function I18nLocaleZh({ content, contentVersion, children }: { content?: Dict; contentVersion?: string; children: React.ReactNode }) {
  return (
    <I18nProvider locale="zh" dict={dict as Dict} content={content} contentVersion={contentVersion}>
      {children}
    </I18nProvider>
  );
}
