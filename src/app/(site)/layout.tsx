import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { VisitTracker } from "@/components/VisitTracker";
import { LocationPrompt } from "@/components/LocationPrompt";
import { SearchLoadingOverlay } from "@/components/useSearchNav";
import { TrustPopup } from "@/components/TrustPopup";
import { CommitmentEnabledProvider } from "@/components/trust/CommitmentLink";
import { BackgroundMusic } from "@/components/BackgroundMusic";
import { getSettings } from "@/lib/queries";
import { prisma } from "@/lib/prisma";
import { getCustomer } from "@/lib/customer";
import { parseTrustPopup, TRUST_POPUP_KEY, visiblePeople } from "@/lib/trust-popup";
import { SiteContactProvider } from "@/components/SiteContact";
import { SITE } from "@/lib/site";
import { getContentMap, getLocale } from "@/lib/i18n/server";
import { I18nProvider } from "@/components/i18n/I18nProvider";
import { I18nLocaleEn } from "@/components/i18n/I18nLocaleEn";
import { I18nLocaleZh } from "@/components/i18n/I18nLocaleZh";
import { I18nLocaleKo } from "@/components/i18n/I18nLocaleKo";

/** Provider ngôn ngữ cho Client Component: mỗi ngôn ngữ 1 chunk từ điển riêng (tiếng Việt không tải gì thêm). */
async function LocaleProvider({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  if (locale === "vi") return <I18nProvider locale="vi" dict={{}}>{children}</I18nProvider>;
  const content = await getContentMap(locale);
  const P = locale === "en" ? I18nLocaleEn : locale === "zh" ? I18nLocaleZh : I18nLocaleKo;
  return <P content={content}>{children}</P>;
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
    prisma.ticketVenue.count({ where: { published: true } }).then((n) => n > 0, () => false),
  ]);
  const trustConfig = parseTrustPopup(settings[TRUST_POPUP_KEY]);
  const trustPopup = { ...trustConfig, people: visiblePeople(trustConfig) }; // người bị ẩn không hiện ở popup

  return (
    <LocaleProvider>
    <SiteContactProvider phone={settings.contactPhone || SITE.defaultPhone} solo={trustPopup.people.length === 1}>
      <VisitTracker />
      <TrustPopup config={trustPopup} />
      <SearchLoadingOverlay />
      <Header customerName={customer?.name ?? null} showCommitment={trustPopup.showLinks} showTickets={hasTickets} />
      <main className="flex-1">
        <CommitmentEnabledProvider enabled={trustPopup.showLinks}>{children}</CommitmentEnabledProvider>
      </main>
      <Footer settings={settings} />
      <BackgroundMusic />
      <LocationPrompt />
    </SiteContactProvider>
    </LocaleProvider>
  );
}
