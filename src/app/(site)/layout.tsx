import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { VisitTracker } from "@/components/VisitTracker";
import { SearchLoadingOverlay } from "@/components/useSearchNav";
import { getSettings } from "@/lib/queries";
import { getCustomer } from "@/lib/customer";

export default async function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [settings, customer] = await Promise.all([getSettings(), getCustomer()]);

  return (
    <>
      <VisitTracker />
      <SearchLoadingOverlay />
      <Header customerName={customer?.name ?? null} />
      <main className="flex-1">{children}</main>
      <Footer settings={settings} />
    </>
  );
}
