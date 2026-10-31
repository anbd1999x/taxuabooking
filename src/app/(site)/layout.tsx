import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { getSettings } from "@/lib/queries";
import { getCustomer } from "@/lib/customer";
import { SITE } from "@/lib/site";

export default async function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [settings, customer] = await Promise.all([getSettings(), getCustomer()]);
  const phone = settings.contactPhone || SITE.defaultPhone;

  return (
    <>
      <Header phone={phone} customerName={customer?.name ?? null} />
      <main className="flex-1">{children}</main>
      <Footer settings={settings} />
    </>
  );
}
