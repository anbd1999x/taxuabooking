import type { Metadata } from "next";
import { getSettings } from "@/lib/queries";
import { Be_Vietnam_Pro } from "next/font/google";
import "./globals.css";
import { SITE } from "@/lib/site";
import { ogImages } from "@/lib/og";
import { getContentVersion, getLocale, getT } from "@/lib/i18n/server";
import { contentScriptUrl } from "@/lib/i18n/content-store";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import Script from "next/script";
import { LOCALE_META } from "@/lib/i18n/config";

const beVietnam = Be_Vietnam_Pro({
  variable: "--font-be-vietnam",
  subsets: ["latin", "vietnamese"],
  // Chỉ các độ đậm đang dùng thật (300 không dùng ở đâu): mỗi độ đậm = 2 file font bị preload trên MỌI trang.
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

/** Mã vùng chứa thẻ Google (Google Ads cấp). Để chuỗi rỗng = tắt. */
const GOOGLE_TAG_ID = "GTM-T89KS5CM";

export async function generateMetadata(): Promise<Metadata> {
  const [t, locale] = await Promise.all([getT(), getLocale()]);
  return {
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.name} — ${t("Đặt xe cabin, homestay, tour Tà Xùa")}`,
    template: `%s | ${SITE.name}`,
  },
  description: t(SITE.description),
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
    locale: LOCALE_META[locale].og,
    siteName: SITE.name,
    title: `${SITE.name} - ${t("Đặt xe - Đặt phòng Tà Xùa chỉ với một chạm")}`,
    description: t(SITE.description),
    images: ogImages(undefined, t("Biển mây Tà Xùa")),
  },
  // max-image-preview:large ⇒ cho phép Google hiện ảnh xem trước cỡ lớn cạnh kết quả tìm kiếm / Discover.
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 },
  },
  // Mã xác minh Google Search Console (đặt GOOGLE_SITE_VERIFICATION trong .env server).
  verification: process.env.GOOGLE_SITE_VERIFICATION
    ? { google: process.env.GOOGLE_SITE_VERIFICATION }
    : undefined,
  };
}

// Dữ liệu có cấu trúc (JSON-LD) cho Google: doanh nghiệp du lịch + website.
const jsonLd = (phone: string, t: (s: string) => string) => ({
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "TravelAgency",
      "@id": `${SITE.url}/#organization`,
      name: SITE.name,
      url: SITE.url,
      alternateName: ["Ta Xua Booking", "taxuabooking.com"],
      legalName: SITE.legalName,
      taxID: SITE.taxCode,
      description: t(SITE.about), // câu mô tả thương hiệu chuẩn (một câu duy nhất ở mọi nơi)
      // Logo + ảnh đại diện + kênh liên hệ: Google dùng cho bảng thông tin thương hiệu, công cụ AI dùng để nhận diện thực thể.
      logo: { "@type": "ImageObject", url: `${SITE.url}/icons/icon-512.png`, width: 512, height: 512 },
      image: `${SITE.url}/og?u=${encodeURIComponent("/hero-taxua-v5.jpg")}`,
      email: SITE.email,
      telephone: "+84" + phone.replace(/\D/g, "").replace(/^0/, ""),
      contactPoint: {
        "@type": "ContactPoint",
        contactType: "customer service",
        telephone: "+84" + phone.replace(/\D/g, "").replace(/^0/, ""),
        email: SITE.email,
        areaServed: "VN",
        availableLanguage: ["vi", "en", "zh", "ko"],
      },
      openingHoursSpecification: {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
        opens: `${String(SITE.supportOpenHour).padStart(2, "0")}:00`,
        closes: `${String(SITE.supportCloseHour).padStart(2, "0")}:00`,
      },
      knowsAbout: ["Tà Xùa", "xe cabin Hà Nội – Tà Xùa", "homestay Tà Xùa", "săn mây Tà Xùa", "thuê xe máy Tà Xùa"],
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
      alternateName: ["Ta Xua Booking", "taxuabooking.com"],
      url: SITE.url,
      description: t(SITE.description),
      // Cùng một @id trên mọi bản ngôn ngữ ⇒ khai đủ 4 ngôn ngữ, không đổi theo trang.
      inLanguage: ["vi", "en", "zh-CN", "ko"],
      publisher: { "@id": `${SITE.url}/#organization` },
    },
  ],
});

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // SĐT chung toàn web (theo chủ sở hữu được chọn ở /admin/popup); DB lỗi thì dùng số mặc định.
  const phone = (await getSettings().catch(() => ({}) as Record<string, string>)).contactPhone || SITE.defaultPhone;
  const locale = await getLocale();
  const lang = LOCALE_META[locale].htmlLang;
  // Bản en / zh / ko: map bản dịch nội dung nạp bằng script chạy TRƯỚC khi hydrate (xem contentScriptUrl).
  const i18nScript = locale === DEFAULT_LOCALE ? null : contentScriptUrl(locale, await getContentVersion(locale));
  const ldT = await getT();
  return (
    <html lang={lang} className={`${beVietnam.variable} h-full`}>
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
        {i18nScript && <Script id="tx-i18n-content" src={i18nScript} strategy="beforeInteractive" />}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd(phone, ldT)) }} />
        {children}
      </body>
    </html>
  );
}
