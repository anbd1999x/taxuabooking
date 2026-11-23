import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { VisitTracker } from "@/components/VisitTracker";
import { SearchPrefsSaver } from "@/components/SearchPrefsSaver";
import { Suspense } from "react";
import { LocationPrompt } from "@/components/LocationPrompt";
import { SearchLoadingOverlay } from "@/components/useSearchNav";
import { TrustPopup } from "@/components/TrustPopup";
import { CommitmentEnabledProvider } from "@/components/trust/CommitmentLink";
import { BackgroundMusic } from "@/components/BackgroundMusic";
import { FloatingContact } from "@/components/FloatingContact";
import { getSettings } from "@/lib/queries";
import { prisma } from "@/lib/prisma";
import { PUBLIC_VENUE } from "@/lib/ticket-core";
import { getCustomer } from "@/lib/customer";
import { parseTrustPopup, TRUST_POPUP_KEY, visiblePeople } from "@/lib/trust-popup";
import { SiteContactProvider } from "@/components/SiteContact";
import { SITE } from "@/lib/site";
import { preload } from "react-dom";
import { getContentMap, getContentVersion, getLocale } from "@/lib/i18n/server";
import { contentUrl, ssrContentStore } from "@/lib/i18n/content-store";
import { I18nProvider } from "@/components/i18n/I18nProvider";
import { I18nLocaleEn } from "@/components/i18n/I18nLocaleEn";
import { I18nLocaleZh } from "@/components/i18n/I18nLocaleZh";
import { I18nLocaleKo } from "@/components/i18n/I18nLocaleKo";

/** Provider ngôn ngữ cho Client Component: mỗi ngôn ngữ 1 chunk từ điển riêng (tiếng Việt không tải gì thêm). */
async function LocaleProvider({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  if (locale === "vi") return <I18nProvider locale="vi" dict={{}}>{children}</I18nProvider>;
  // KHÔNG truyền cả map bản dịch nội dung làm prop (bị nhúng vào RSC payload MỌI trang, ≈270KB):
  // ghi map vào bộ nhớ tiến trình cho SSR, client tải 1 file JSON cache theo phiên bản (preload sớm).
  const [content, v] = await Promise.all([getContentMap(locale), getContentVersion(locale)]);
  ssrContentStore()[locale] = content;
  preload(contentUrl(locale, v), { as: "fetch", crossOrigin: "anonymous" });
  const P = locale === "en" ? I18nLocaleEn : locale === "zh" ? I18nLocaleZh : I18nLocaleKo;
  return <P contentVersion={v}>{children}</P>;
}

export default async function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [settings, customer, hasTickets] = await Promise.all([
    getSettings(),
    getCustomer(),
    // Mục "Vé & đặt bàn" trên menu chỉ hiện khi có địa điểm ĐANG MỞ BÁN (dữ liệu demo / mẫu chưa mở bán thì không lộ ra ngoài).
    prisma.ticketVenue.count({ where: PUBLIC_VENUE }).then((n) => n > 0, () => false),
  ]);
  const trustConfig = parseTrustPopup(settings[TRUST_POPUP_KEY]);
  const trustPopup = { ...trustConfig, people: visiblePeople(trustConfig) }; // người bị ẩn không hiện ở popup
  // Facebook cho nút nổi: chủ sở hữu đầu tiên đang hiện (cùng quy tắc với Footer — link chưa nhập ⇒ link mặc định).
  const FB_DEFAULT = ["https://www.facebook.com/an.danh.bui.2025", "https://www.facebook.com/tanglinhvxhg"];
  const fbIdx = trustConfig.people.findIndex((p) => !p.hidden);
  const fbPerson = trustConfig.people[fbIdx];
  const facebook = fbPerson && /facebook\.com\/.+/.test(fbPerson.facebook) ? fbPerson.facebook : FB_DEFAULT[Math.max(0, fbIdx)] ?? FB_DEFAULT[0];

  return (
    <LocaleProvider>
    <SiteContactProvider phone={settings.contactPhone || SITE.defaultPhone} solo={trustPopup.people.length === 1}>
      <VisitTracker />
      <Suspense fallback={null}><SearchPrefsSaver /></Suspense>
      <TrustPopup config={trustPopup} />
      <SearchLoadingOverlay />
      <Header customerName={customer?.name ?? null} showCommitment={trustPopup.showMenu} showTickets={hasTickets} />
      <main className="flex-1">
        <CommitmentEnabledProvider enabled={trustPopup.showFormLink}>{children}</CommitmentEnabledProvider>
      </main>
      <Footer settings={settings} />
      <BackgroundMusic />
      <FloatingContact facebook={facebook} />
      <LocationPrompt />
    </SiteContactProvider>
    </LocaleProvider>
  );
}
