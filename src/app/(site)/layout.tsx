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
import { parseTrustPopup, TRUST_POPUP_KEY } from "@/lib/trust-popup";

export default async function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [settings, customer] = await Promise.all([getSettings(), getCustomer()]);
  const trustPopup = parseTrustPopup(settings[TRUST_POPUP_KEY]);

  return (
    <>
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
    </>
  );
}
