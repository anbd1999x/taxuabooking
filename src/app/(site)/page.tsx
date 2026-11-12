import Link from "next/link";
import Image from "next/image";
import { HeroSearch } from "@/components/home/HeroSearch";
import { HeroPhoto } from "@/components/home/HeroPhoto";
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

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [services, articles, settings, cabinPrices, route, comboOrigins] = await Promise.all([
    getHomeServices(8),
    getArticles(3),
    getSettings(),
    getCabinPriceRows(),
    getHomeCabinRoute(),
    getComboOrigins(),
  ]);

  const heroTitle = settings.heroTitle || "Lên Tà Xùa săn mây, mọi thứ có ở đây.";
  // Tách tiêu đề ở dấu phẩy đầu tiên: vế sau tô màu nắng bình minh.
  const cut = heroTitle.indexOf(",");
  const heroLead = cut > 0 ? heroTitle.slice(0, cut + 1) : heroTitle;
  const heroRest = cut > 0 ? heroTitle.slice(cut + 1).trim() : "";
  const phone = settings.contactPhone || "0357452952";
  const zalo = settings.contactZalo || "0357452952";

  const combo = {
    title: settings.cabinComboTitle || "Xe cabin + home view kính trung tâm",
    sub: settings.cabinComboSub || "Combo 2 ngày 1 đêm",
    price: Number(settings.cabinComboPrice || "700000"),
  };

  return (
    <>
      {/* HERO — ảnh thật đồi hoa Tà Xùa (bản hoạt hình cũ: components/home/HeroScene) + chữ kiểu tạp chí */}
      <header className="relative isolate flex min-h-[400px] flex-col justify-end overflow-hidden sm:min-h-[720px]">
        <HeroPhoto />
        <div className="container-page flex flex-col gap-3 pb-28 pt-10 text-white sm:gap-5 sm:pb-36 sm:pt-12">
          {/* dòng định vị: địa danh + toạ độ */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] font-bold uppercase tracking-[.22em] sm:text-xs" style={{ textShadow: "0 1px 10px oklch(0.15 0.05 270 / .6)" }}>
            <span>Tà Xùa · Bắc Yên · Sơn La</span>
            <span aria-hidden className="hidden h-px w-10 bg-white/50 sm:block" />
            <span className="font-mono text-[11px] font-semibold tracking-[.1em] text-white/80">21°16′B · 104°26′Đ · 2.865 m</span>
          </div>
          <h1 className="max-w-[980px] text-balance text-[clamp(40px,7.4vw,96px)] font-extrabold leading-[.98] tracking-[-.04em]" style={{ textShadow: "0 2px 30px oklch(0.15 0.06 270 / .45)" }}>
            {heroLead}
            {heroRest && (
              <>
                {" "}
                <span className="bg-clip-text text-transparent" style={{ backgroundImage: "linear-gradient(100deg, oklch(0.93 0.1 88) 0%, oklch(0.86 0.15 72) 45%, oklch(0.8 0.16 48) 100%)", textShadow: "none" }}>{heroRest}</span>
              </>
            )}
          </h1>
          <p className="hidden max-w-[580px] text-pretty text-base leading-relaxed text-white/90 sm:block sm:text-[19px]" style={{ textShadow: "0 1px 14px oklch(0.15 0.05 270 / .6)" }}>
            Xe cabin, homestay, xe máy, xe ôm, taxi. Chọn ngày là thấy giá và chỗ trống, gửi yêu cầu là có người gọi lại xác nhận.
          </p>
          <div className="hidden flex-wrap items-center gap-x-4 gap-y-2 text-[13px] font-semibold text-white/85 sm:flex">
            <span className="rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[.08em] text-white backdrop-blur">Mùa mây T10 – T4</span>
            <span>Xe cabin đêm từ Hà Nội</span>
            <span aria-hidden className="h-1 w-1 rounded-full bg-white/60" />
            <span>Homestay view biển mây</span>
            <span aria-hidden className="hidden h-1 w-1 rounded-full bg-white/60 sm:block" />
            <span className="hidden sm:inline">Combo trọn gói</span>
          </div>
        </div>
      </header>

      {/* SEARCH (đè lên hero) */}
      <div className="container-page relative z-10 -mt-24 mb-12 sm:-mt-20 sm:mb-16">
        <HeroSearch comboOrigins={comboOrigins} />
      </div>

      {/* CABIN */}
      <HomeCabin
        fares={cabinPrices.map((r) => ({ pickupPoint: r.pickupPoint, price: r.price }))}
        combo={combo}
        homeFrom={Number(settings.cabinHomeFrom || "500000")}
        bikeFrom={Number(settings.cabinBikeFrom || "150000")}
        footnote={settings.cabinFareFootnote || "Giá có thể thay đổi theo thời điểm. Vui lòng liên hệ trước để giữ chỗ."}
        routes={{ di: route.di, ve: route.ve }}
        phone={phone}
        zalo={zalo}
        startInfo={route.startInfo}
        pickupInfo={route.pickupInfo}
      />

      {/* FEATURED */}
      <FeaturedGrid services={services} />

      {/* EXPERIENCE */}
      {articles.length > 0 && (
        <section className="container-page mb-20 mt-16 flex flex-col gap-6">
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div>
              <h2 className="text-3xl font-extrabold leading-tight tracking-tight text-ink sm:text-4xl">Kinh nghiệm du lịch Tà Xùa</h2>
              <p className="mt-2 text-sm text-gray-500">Mẹo và lịch trình cho chuyến săn mây trọn vẹn.</p>
            </div>
            <Link href="/kinh-nghiem" className="text-[15px] font-bold text-forest-700 hover:underline">Tất cả bài viết →</Link>
          </div>
          <div className="grid gap-6 sm:grid-cols-[repeat(auto-fit,minmax(300px,1fr))]">
            {articles.map((a) => (
              <Link key={a.id} href={`/kinh-nghiem/${a.slug}`} className="group flex flex-col gap-3.5">
                {a.coverImage && (
                  <div className="relative aspect-[16/10] overflow-hidden rounded-[18px]">
                    <Image src={a.coverImage} alt={a.title} fill sizes="(max-width:640px) 100vw, 380px" className="object-cover transition duration-500 group-hover:scale-105" />
                  </div>
                )}
                <div className="text-xl font-bold leading-snug tracking-tight text-ink group-hover:text-forest-700">{a.title}</div>
                {a.excerpt && <p className="text-[15px] leading-relaxed text-gray-600">{a.excerpt}</p>}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Thanh liên hệ cố định (mobile) */}
      <div className="fixed inset-x-3 bottom-3 z-20 grid grid-cols-2 gap-2 rounded-[20px] bg-white p-2 shadow-[0_10px_30px_-8px_rgba(30,60,45,0.35)] sm:hidden">
        <a href={`tel:${phone.replace(/\s/g, "")}`} className="rounded-2xl bg-forest-700 py-3.5 text-center text-sm font-bold text-white">Gọi ngay</a>
        <a href={`https://zalo.me/${zalo}`} target="_blank" rel="noopener noreferrer" className="rounded-2xl py-3.5 text-center text-sm font-bold text-white" style={{ background: "oklch(0.68 0.18 45)" }}>Chat Zalo</a>
      </div>
    </>
  );
}
