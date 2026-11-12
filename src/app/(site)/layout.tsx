import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { VisitTracker } from "@/components/VisitTracker";
import { LocationPrompt } from "@/components/LocationPrompt";
import { SearchLoadingOverlay } from "@/components/useSearchNav";
import { TrustPopup } from "@/components/TrustPopup";
import { CommitmentEnabledProvider } from "@/components/trust/CommitmentLink";
import { BackgroundMusic } from "@/components/BackgroundMusic";
import { getSettings } from "@/lib/queries";
import { getCustomer } from "@/lib/customer";
import { parseTrustPopup, TRUST_POPUP_KEY, visiblePeople } from "@/lib/trust-popup";
import { SiteContactProvider } from "@/components/SiteContact";
import { SITE } from "@/lib/site";

export default async function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [settings, customer] = await Promise.all([getSettings(), getCustomer()]);
  const trustConfig = parseTrustPopup(settings[TRUST_POPUP_KEY]);
  const trustPopup = { ...trustConfig, people: visiblePeople(trustConfig) }; // người bị ẩn không hiện ở popup

  return (
    <SiteContactProvider phone={settings.contactPhone || SITE.defaultPhone}>
      <VisitTracker />
      <TrustPopup config={trustPopup} />
      <SearchLoadingOverlay />
      <Header customerName={customer?.name ?? null} showCommitment={trustPopup.enabled} />
      <main className="flex-1">
        <CommitmentEnabledProvider enabled={trustPopup.enabled}>{children}</CommitmentEnabledProvider>
      </main>
      <Footer settings={settings} />
      <BackgroundMusic />
      <LocationPrompt />
    </SiteContactProvider>
  );
}
