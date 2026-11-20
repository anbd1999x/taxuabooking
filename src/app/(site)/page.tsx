import type { Metadata } from "next";
import { ogBlock } from "@/lib/og";
import { SITE } from "@/lib/site";
import Link from "@/components/Link";
import Image from "next/image";
import { HeroSearch } from "@/components/home/HeroSearch";
import { HomeHero } from "@/components/home/HomeHero";
import { HomeSky, HomeReveal, HomeMobileBar } from "@/components/home/HomeMotion";
import { REVEAL_CSS } from "@/components/home/reveal-css";
import { HomeCabin } from "@/components/home/HomeCabin";
import { FeaturedGrid } from "@/components/home/FeaturedGrid";
import {
  getHomeServices,
  getArticles,
  getSettings,
  getCabinPriceRows,
  getHomeCabinRoute,
} from "@/lib/queries";
import { getComboOrigins } from "@/lib/combo";
import { getT } from "@/lib/i18n/server";
import { i18nAlternates, i18nOg } from "@/lib/i18n/meta";

export const dynamic = "force-dynamic";

// Đường dẫn chính thức của trang chủ (tránh trùng nội dung khi có tham số trên URL).
// Thẻ chia sẻ mạng xã hội của trang chủ (dán taxuabooking.com): dòng giới thiệu chung + ảnh biển mây.
export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  const title = `${SITE.name} — ${t("Đặt xe cabin, homestay, tour Tà Xùa")}`;
  const description = t(SITE.description);
  return {
    title: { absolute: title },
    description,
    alternates: await i18nAlternates("/"),
    openGraph: await i18nOg({
      title: `${SITE.name} - ${t("Đặt xe - Đặt phòng Tà Xùa chỉ với một chạm")}`,
      description,
      path: "/",
      alt: t("Biển mây Tà Xùa"),
    }),
  };
}

export default async function HomePage() {
  const t = await getT();
  const [services, articles, settings, cabinPrices, route, comboOrigins] = await Promise.all([
    getHomeServices(8),
    getArticles(3),
    getSettings(),
    getCabinPriceRows(),
    getHomeCabinRoute(),
    getComboOrigins(),
  ]);

  const heroTitle = t(settings.heroTitle || "Lên Tà Xùa săn mây, mọi thứ có ở đây.");
  // Tách tiêu đề ở dấu phẩy đầu tiên: vế sau tô màu nắng bình minh.
  // Điểm cắt: dấu phẩy, hoặc gạch dài " — " (bản dịch tiếng Anh) — vế trước giữ luôn dấu đó.
  const m = heroTitle.match(/[,，、]|\s[–—](?=\s)/);
  const cut = m?.index != null ? m.index + m[0].length : -1;
  const heroLead = cut > 0 ? heroTitle.slice(0, cut).trim() : heroTitle;
  const heroRest = cut > 0 ? heroTitle.slice(cut).trim() : "";
  const phone = settings.contactPhone || "0357452952";
  const zalo = settings.contactZalo || "0357452952";

  const combo = {
    title: t(settings.cabinComboTitle || "Xe cabin + home view kính trung tâm"),
    sub: t(settings.cabinComboSub || "Combo 2 ngày 1 đêm"),
    price: Number(settings.cabinComboPrice || "700000"),
  };

  return (
    <>
      {/* Trang chủ v5 (claude.ai/design project 4ec052fe…, "Trang chu v5"): nền trời mây trôi + các lớp chuyển động */}
      <style>{REVEAL_CSS + "@keyframes homeIn{from{opacity:0;transform:translateY(20px)}}@media (prefers-reduced-motion: reduce){.home-in{animation:none!important}}"}</style>
      <noscript>
        <style>{"[data-rv],[data-clip]{opacity:1!important;transform:none!important;clip-path:none!important}"}</style>
      </noscript>
      <HomeSky />

      <HomeHero
        eyebrow={t("Đặt xe cabin, homestay Tà Xùa · Sơn La")}
        coords={t("21°16′B · 104°26′Đ · 2.865 m")}
        lead={heroLead}
        rest={heroRest}
        sub={t("Xe cabin, homestay, xe máy, xe ôm, taxi. Chọn ngày là thấy giá và chỗ trống, gửi yêu cầu là có người gọi lại xác nhận.")}
        season={t("Mùa mây T10 – T4")}
        chips={[t("Xe cabin đêm từ Hà Nội"), t("Homestay view biển mây"), t("Combo trọn gói")]}
        alt={t("Biển mây Tà Xùa nhìn từ sống núi, du khách đứng trên đỉnh")}
        cue={t("CUỘN")}
      />

      {/* SEARCH (đè lên hero) */}
      <div className="home-in relative z-[5] mx-auto -mt-[92px] max-w-[1240px] px-[clamp(16px,4vw,40px)]" style={{ animation: "homeIn 1s 2.2s both" }}>
        <HeroSearch comboOrigins={comboOrigins} />
      </div>

      {/* CABIN */}
      <HomeCabin
        fares={cabinPrices.map((r) => ({ pickupPoint: r.pickupPoint, price: r.price }))}
        combo={combo}
        homeFrom={Number(settings.cabinHomeFrom || "500000")}
        bikeFrom={Number(settings.cabinBikeFrom || "180000")}
        footnote={t(settings.cabinFareFootnote || "Giá có thể thay đổi theo thời điểm. Vui lòng liên hệ trước để giữ chỗ.")}
        routes={{ di: route.di, ve: route.ve }}
        phone={phone}
        zalo={zalo}
        startInfo={route.startInfo}
        pickupInfo={route.pickupInfo}
      />

      {/* FEATURED */}
      <FeaturedGrid services={services} />

      {/* KINH NGHIỆM */}
      {articles.length > 0 && (
        <section className="mx-auto max-w-[1240px] px-[clamp(16px,4vw,40px)] pb-[clamp(64px,8vw,96px)] pt-[clamp(56px,7vw,84px)]">
          <div data-rv className="mb-5 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-[clamp(26px,3vw,34px)] font-extrabold tracking-[-.025em] text-ink">{t("Kinh nghiệm du lịch Tà Xùa")}</h2>
              <p className="mt-1.5 text-sm" style={{ color: "oklch(0.48 0.02 160)" }}>{t("Mẹo và lịch trình cho chuyến săn mây trọn vẹn.")}</p>
            </div>
            <Link href="/kinh-nghiem" className="whitespace-nowrap text-sm font-extrabold" style={{ color: "oklch(0.35 0.08 158)" }}>{t("Tất cả bài viết →")}</Link>
          </div>
          <div className="grid gap-[18px] [grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr))]">
            {articles.map((a, i) => (
              <Link key={a.id} href={`/kinh-nghiem/${a.slug}`} data-rv className="group flex flex-col gap-3" style={{ ["--d" as string]: `${i * 0.1}s` }}>
                <div data-clip data-clip-up className="relative aspect-[16/10] overflow-hidden rounded-[18px] bg-forest-50" style={{ ["--d" as string]: `${i * 0.1}s` }}>
                  <span className="pointer-events-none absolute left-3.5 top-3 z-[1] text-[13px] font-extrabold text-white" style={{ textShadow: "0 1px 8px oklch(0.15 0.03 180 / .6)" }}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {a.coverImage && (
                    <div data-px="0.05" className="absolute -inset-y-[8%] inset-x-0 will-change-transform">
                      <Image src={a.coverImage} alt={t(a.title)} fill sizes="(max-width:640px) 100vw, 400px" className="object-cover transition duration-700 group-hover:scale-105" />
                    </div>
                  )}
                </div>
                <div className="text-lg font-extrabold leading-snug tracking-[-.015em] text-ink group-hover:text-forest-700">{t(a.title)}</div>
                {a.excerpt && <p className="text-sm leading-relaxed" style={{ color: "oklch(0.45 0.02 160)" }}>{t(a.excerpt)}</p>}
              </Link>
            ))}
          </div>
        </section>
      )}

      <HomeMobileBar />
      <HomeReveal />
    </>
  );
}
