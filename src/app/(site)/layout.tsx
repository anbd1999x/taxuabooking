import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { getSettings } from "@/lib/queries";
import { SITE } from "@/lib/site";

export default async function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const settings = await getSettings();
  const phone = settings.contactPhone || SITE.defaultPhone;

  return (
    <>
      <Header phone={phone} />
      <main className="flex-1">{children}</main>
      <Footer settings={settings} />
    </>
  );
}
