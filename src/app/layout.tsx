import type { Metadata } from "next";
import { getSettings } from "@/lib/queries";
import { Be_Vietnam_Pro } from "next/font/google";
import "./globals.css";
import { SITE } from "@/lib/site";

const beVietnam = Be_Vietnam_Pro({
  variable: "--font-be-vietnam",
  subsets: ["latin", "vietnamese"],
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.name} — Đặt xe cabin, homestay, tour Tà Xùa`,
    template: `%s | ${SITE.name}`,
  },
  description: SITE.description,
  keywords: [
    "Tà Xùa",
    "xe cabin Tà Xùa",
    "homestay Tà Xùa",
    "bungalow Tà Xùa",
    "thuê xe máy Tà Xùa",
    "taxi Tà Xùa",
    "combo du lịch Tà Xùa",
    "săn mây Tà Xùa",
  ],
  openGraph: {
    type: "website",
    locale: "vi_VN",
    siteName: SITE.name,
    title: `${SITE.name} — Săn mây Tà Xùa dễ dàng`,
    description: SITE.description,
  },
  robots: { index: true, follow: true },
  // Mã xác minh Google Search Console (đặt GOOGLE_SITE_VERIFICATION trong .env server).
  verification: process.env.GOOGLE_SITE_VERIFICATION
    ? { google: process.env.GOOGLE_SITE_VERIFICATION }
    : undefined,
};

// Dữ liệu có cấu trúc (JSON-LD) cho Google: doanh nghiệp du lịch + website.
const jsonLd = (phone: string) => ({
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "TravelAgency",
      "@id": `${SITE.url}/#organization`,
      name: SITE.name,
      url: SITE.url,
      description: SITE.description,
      telephone: phone.replace(/\D/g, ""),
      areaServed: "Tà Xùa, Bắc Yên, Sơn La, Việt Nam",
      address: {
        "@type": "PostalAddress",
        addressLocality: "Tà Xùa, Bắc Yên",
        addressRegion: "Sơn La",
        addressCountry: "VN",
      },
    },
    {
      "@type": "WebSite",
      "@id": `${SITE.url}/#website`,
      name: SITE.name,
      url: SITE.url,
      inLanguage: "vi",
      publisher: { "@id": `${SITE.url}/#organization` },
    },
  ],
});

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // SĐT chung toàn web (theo chủ sở hữu được chọn ở /admin/popup); DB lỗi thì dùng số mặc định.
  const phone = (await getSettings().catch(() => ({}) as Record<string, string>)).contactPhone || SITE.defaultPhone;
  return (
    <html lang="vi" className={`${beVietnam.variable} h-full`}>
      <body className="min-h-full flex flex-col bg-cloud text-ink">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd(phone)) }} />
        {children}
      </body>
    </html>
  );
}
