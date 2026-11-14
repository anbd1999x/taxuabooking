import type { Metadata } from "next";
import { getSettings } from "@/lib/queries";
import { Be_Vietnam_Pro } from "next/font/google";
import "./globals.css";
import { SITE } from "@/lib/site";
import { ogImages } from "@/lib/og";

const beVietnam = Be_Vietnam_Pro({
  variable: "--font-be-vietnam",
  subsets: ["latin", "vietnamese"],
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
});

/** Mã vùng chứa thẻ Google (Google Ads cấp). Để chuỗi rỗng = tắt. */
const GOOGLE_TAG_ID = "GTM-T89KS5CM";

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
    title: `${SITE.name} - Đặt xe - Đặt phòng Tà Xùa chỉ với một chạm`,
    description: SITE.description,
    images: ogImages(),
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
      <head>
        {/* Thẻ Google (Google Ads — đo lượt chuyển đổi), vùng chứa GTM-T89KS5CM. Chỉ nạp ở bản
            production để lúc dev không bắn dữ liệu đo lường. Mỗi trang chỉ 1 thẻ Google. */}
        {GOOGLE_TAG_ID && process.env.NODE_ENV === "production" && (
          <>
            <script async src={`https://www.googletagmanager.com/gtm.js?id=${GOOGLE_TAG_ID}`} />
            <script
              dangerouslySetInnerHTML={{
                __html: "window.dataLayer = window.dataLayer || [];function gtag(){dataLayer.push(arguments);}gtag('js', new Date());",
              }}
            />
          </>
        )}
      </head>
      <body className="min-h-full flex flex-col bg-cloud text-ink">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd(phone)) }} />
        {children}
      </body>
    </html>
  );
}
