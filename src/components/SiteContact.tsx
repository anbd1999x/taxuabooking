"use client";

import { createContext, useContext } from "react";
import { SITE } from "@/lib/site";

/**
 * Số điện thoại / Zalo dùng chung cho toàn bộ trang khách — lấy theo chủ sở hữu được chọn ở
 * /admin/popup ("Dùng SĐT này cho toàn bộ trang web"). Bọc ở layout trang khách; component client
 * nào cần hiện số thì dùng <SitePhone /> / <SiteZaloLink> thay vì gõ cứng số.
 */
const SitePhoneContext = createContext<string>(SITE.defaultPhone);

export function SiteContactProvider({ phone, children }: { phone: string; children: React.ReactNode }) {
  return <SitePhoneContext.Provider value={phone || SITE.defaultPhone}>{children}</SitePhoneContext.Provider>;
}

export function useSitePhone(): string {
  return useContext(SitePhoneContext);
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
