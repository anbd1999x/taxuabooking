"use client";

import { createContext, useContext } from "react";
import { SITE } from "@/lib/site";
import { soloVoice } from "@/lib/trust-popup";

/**
 * Thông tin dùng chung cho toàn bộ trang khách, lấy theo cấu hình ở /admin/popup:
 * - `phone`: SĐT/Zalo của chủ sở hữu được chọn ("Dùng SĐT này cho toàn bộ trang web").
 * - `solo`: chỉ còn 1 chủ sở hữu hiện ⇒ web xưng "mình" thay cho "tụi mình".
 * Bọc ở layout trang khách; component nào cần thì dùng <SitePhone />, <SiteZaloLink>, <We />, <VoiceText>
 * thay vì gõ cứng số / chữ "tụi mình".
 */
const SiteContactContext = createContext<{ phone: string; solo: boolean }>({ phone: SITE.defaultPhone, solo: false });

export function SiteContactProvider({ phone, solo = false, children }: { phone: string; solo?: boolean; children: React.ReactNode }) {
  return <SiteContactContext.Provider value={{ phone: phone || SITE.defaultPhone, solo }}>{children}</SiteContactContext.Provider>;
}

export function useSitePhone(): string {
  return useContext(SiteContactContext).phone;
}

/** Hàm đổi "tụi mình" → "mình" trong một chuỗi khi web chỉ còn 1 chủ sở hữu. */
export function useVoice(): (text: string) => string {
  const { solo } = useContext(SiteContactContext);
  return (text) => soloVoice(text, solo);
}

/** Số điện thoại chung của web (dạng chữ). */
export function SitePhone() {
  return <>{useSitePhone()}</>;
}

/** Link Zalo tới số chung của web. */
export function SiteZaloLink({ children, ...rest }: Omit<React.ComponentProps<"a">, "href" | "target" | "rel">) {
  return (
    <a href={`https://zalo.me/${useSitePhone().replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" {...rest}>
      {children}
    </a>
  );
}

/** Đại từ xưng hô của web: "tụi mình" (2 chủ sở hữu) hoặc "mình" (1 người). `cap` = viết hoa đầu câu. */
export function We({ cap }: { cap?: boolean }) {
  const { solo } = useContext(SiteContactContext);
  return <>{solo ? (cap ? "Mình" : "mình") : cap ? "Tụi mình" : "tụi mình"}</>;
}

/** Hiện một chuỗi có sẵn (hằng số, câu ghép) với cách xưng hô đúng. */
export function VoiceText({ text }: { text: string }) {
  return <>{useVoice()(text)}</>;
}
