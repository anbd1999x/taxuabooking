import type { Metadata } from "next";
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
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="vi" className={`${beVietnam.variable} h-full`}>
      <body className="min-h-full flex flex-col bg-cloud text-ink">
        {children}
      </body>
    </html>
  );
}
