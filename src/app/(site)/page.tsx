import Link from "next/link";
import Image from "next/image";
import { HeroSearch } from "@/components/home/HeroSearch";
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

const HERO_IMAGE = "/banner.jpg";

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
  const phone = settings.contactPhone || "0357452952";
  const zalo = settings.contactZalo || "0357452952";

  const combo = {
    title: settings.cabinComboTitle || "Xe cabin + home view kính trung tâm",
    sub: settings.cabinComboSub || "Combo 2 ngày 1 đêm",
    price: Number(settings.cabinComboPrice || "700000"),
  };

  return (
    <>
      {/* HERO */}
      <header className="relative isolate flex min-h-[560px] flex-col justify-end overflow-hidden sm:min-h-[640px]">
        <Image src={HERO_IMAGE} alt="Biển mây Tà Xùa" fill priority className="-z-10 object-cover" />
        <div className="-z-10 absolute inset-0" style={{ background: "linear-gradient(180deg,oklch(0.18 0.04 160 / .5) 0%,transparent 30%,transparent 48%,oklch(0.18 0.04 160 / .82) 100%)" }} />
        <div className="container-page flex flex-col gap-4 pb-28 pt-10 text-white sm:pb-32">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.06em] backdrop-blur">Bắc Yên · Sơn La · 2.865m</span>
            <span className="rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.06em] backdrop-blur">Mùa mây T10 – T4</span>
          </div>
          <h1 className="max-w-3xl text-4xl font-extrabold leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl">{heroTitle}</h1>
          <p className="max-w-xl text-base leading-relaxed text-white/90 sm:text-lg">
            Xe cabin, homestay, xe máy, xe ôm, taxi. Chọn ngày là thấy giá và chỗ trống, gửi yêu cầu là có người gọi lại xác nhận.
          </p>
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
        <section className="container-page mt-16 flex flex-col gap-6">
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

      {/* CTA */}
      <section className="container-page mt-16 mb-20">
        <div className="grid overflow-hidden rounded-[28px] text-white sm:grid-cols-2" style={{ background: "oklch(0.68 0.18 45)" }}>
          <div className="flex flex-col justify-center gap-4 p-8 sm:p-14">
            <h2 className="text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl">Cần tư vấn lịch trình?</h2>
            <p className="max-w-md text-[17px] leading-relaxed">Nhắn cho tụi mình ngày bạn muốn đi, số người và ngân sách. Tụi mình lên giúp xe, phòng và combo phù hợp.</p>
            <div className="mt-2 flex flex-wrap gap-2.5">
              <a href={`https://zalo.me/${zalo}`} target="_blank" rel="noopener noreferrer" className="rounded-full bg-white px-5 py-3.5 text-base font-bold" style={{ color: "oklch(0.45 0.15 45)" }}>Chat Zalo</a>
              <a href={`tel:${phone.replace(/\s/g, "")}`} className="rounded-full px-5 py-3.5 text-base font-bold text-white" style={{ background: "oklch(0.27 0.05 160)" }}>Gọi {phone}</a>
            </div>
          </div>
          <div className="relative min-h-[260px]">
            <Image src={HERO_IMAGE} alt="Tà Xùa" fill sizes="(max-width:640px) 100vw, 600px" className="object-cover" />
          </div>
        </div>
      </section>

      {/* Thanh liên hệ cố định (mobile) */}
      <div className="fixed inset-x-3 bottom-3 z-20 grid grid-cols-2 gap-2 rounded-[20px] bg-white p-2 shadow-[0_10px_30px_-8px_rgba(30,60,45,0.35)] sm:hidden">
        <a href={`tel:${phone.replace(/\s/g, "")}`} className="rounded-2xl bg-forest-700 py-3.5 text-center text-sm font-bold text-white">Gọi ngay</a>
        <a href={`https://zalo.me/${zalo}`} target="_blank" rel="noopener noreferrer" className="rounded-2xl py-3.5 text-center text-sm font-bold text-white" style={{ background: "oklch(0.68 0.18 45)" }}>Chat Zalo</a>
      </div>
    </>
  );
}
