"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { PlaceReviewForm } from "@/components/PlaceReviewForm";

export interface CafeReview {
  id: string;
  name: string;
  rating: number;
  content: string;
  date: string;
}
export interface CafeRelated {
  id: string;
  slug: string;
  name: string;
  area: string;
  hours: string | null;
  price: string | null;
  tags: string[];
  image: string | null;
}
export interface CafeDetailProps {
  placeId: string;
  slug: string;
  basePath: string;
  name: string;
  area: string;
  address: string | null;
  hours: string | null;
  price: string | null;
  phone: string | null;
  feat: boolean;
  openText: string;
  openOpen: boolean;
  gallery: string[];
  contentHtml: string;
  amenities: string[];
  avg: number | null;
  reviewCount: number;
  dist: number[]; // [5★,4★,3★,2★,1★]
  reviews: CafeReview[];
  mapEmbed: string;
  mapOpenUrl: string;
  related: CafeRelated[];
}

const G = "oklch(0.29 0.055 160)";
const AV = ["oklch(0.55 0.12 155)", "oklch(0.5 0.1 250)", "oklch(0.6 0.15 30)", "oklch(0.45 0.08 200)", "oklch(0.55 0.1 320)", "oklch(0.5 0.12 100)"];

const BEST_TIME = [
  { h: "5:30–7:00", t: "Mây dày nhất", d: "Tới trước 6h để có bàn mép ban công.", hot: true },
  { h: "7:00–9:00", t: "Mây tan dần", d: "Nắng lên, ảnh có chiều sâu.", hot: false },
  { h: "9:00–16:00", t: "Vắng khách", d: "Ngồi làm việc, trời trong thấy núi.", hot: false },
  { h: "16:30–18:00", t: "Hoàng hôn", d: "Nắng xiên qua thung lũng, giờ chiều đẹp.", hot: true },
];

function stars(n: number) {
  return "★".repeat(n) + "☆".repeat(5 - n);
}

export function CafeDetailBody(p: CafeDetailProps) {
  const [w, setW] = useState(1280);
  const [desc, setDesc] = useState(false);
  const [saved, setSaved] = useState(false);
  const [lb, setLb] = useState(-1);
  const [writing, setWriting] = useState(false);
  const [filter, setFilter] = useState<"all" | "5" | "4" | "3">("all");
  const [revN, setRevN] = useState(3);
  const mapRef = useRef<HTMLElement>(null);
  const revRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const onR = () => setW(window.innerWidth);
    onR();
    window.addEventListener("resize", onR);
    try { setSaved(localStorage.getItem("cafe-saved-" + p.slug) === "1"); } catch {}
    const onK = (e: KeyboardEvent) => {
      setLb((cur) => {
        if (cur < 0) return cur;
        if (e.key === "Escape") return -1;
        if (e.key === "ArrowRight") return (cur + 1) % p.gallery.length;
        if (e.key === "ArrowLeft") return (cur - 1 + p.gallery.length) % p.gallery.length;
        return cur;
      });
    };
    window.addEventListener("keydown", onK);
    return () => { window.removeEventListener("resize", onR); window.removeEventListener("keydown", onK); };
  }, [p.slug, p.gallery.length]);

  const wide = w >= 980;
  const narrow = w < 760;
  const tel = p.phone ? p.phone.replace(/\s/g, "") : "0397943155";
  const phoneShown = p.phone || "0397 943 155";

  const scrollTo = (el: HTMLElement | null) => { if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 72, behavior: "smooth" }); };
  const toggleSave = () => { setSaved((v) => { const nv = !v; try { localStorage.setItem("cafe-saved-" + p.slug, nv ? "1" : "0"); } catch {} return nv; }); };

  const g = p.gallery;
  const hasGallery = g.length > 0;
  const nThumb = narrow ? 2 : 4;

  const filtered = p.reviews.filter((r) => (filter === "all" ? true : r.rating === Number(filter)));
  const shown = filtered.slice(0, revN);

  const facts = [
    p.hours ? { k: "Giờ mở cửa", v: p.hours, d: "Giờ địa phương" } : null,
    { k: "Giá đồ uống", v: p.price || "Theo menu", d: p.price ? "Giá tham khảo" : "Hỏi tại quán" },
    { k: "Khu vực", v: p.area, d: "Tà Xùa, Bắc Yên" },
    p.phone ? { k: "Điện thoại", v: p.phone, d: "Gọi xác nhận" } : null,
  ].filter(Boolean) as { k: string; v: string; d: string }[];

  const btnPill = "whitespace-nowrap rounded-full border-[1.5px] px-4 py-2.5 text-sm font-bold";

  return (
    <div style={{ background: "oklch(0.975 0.01 150)" }}>
      <main className="container-page flex min-w-0 flex-col gap-[22px] pb-16 pt-5">
        {/* Breadcrumb */}
        <div className="flex flex-wrap gap-2 text-sm" style={{ color: "oklch(0.48 0.02 160)" }}>
          <Link href="/">Trang chủ</Link><span>/</span>
          <Link href={p.basePath}>Cafe săn mây</Link><span>/</span>
          <span className="font-bold" style={{ color: "oklch(0.22 0.03 160)" }}>{p.name}</span>
        </div>

        {/* Title row */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex flex-wrap gap-1.5">
              {p.feat && <span className="rounded-full px-2.5 py-1 text-xs font-bold text-white" style={{ background: "oklch(0.68 0.18 45)" }}>Gợi ý</span>}
              <span className="rounded-full border px-2.5 py-1 text-xs font-bold" style={{ background: "white", borderColor: "oklch(0.9 0.01 160)", color: "oklch(0.3 0.04 160)" }}>{p.feat ? "Cafe" : "Cafe"}</span>
              <span className="rounded-full px-2.5 py-1 text-xs font-bold" style={{ background: p.openOpen ? "oklch(0.95 0.05 155)" : "oklch(0.93 0 0)", color: p.openOpen ? "oklch(0.38 0.1 155)" : "oklch(0.42 0 0)" }}>{p.openText}</span>
            </div>
            <h1 className="text-[clamp(28px,4vw,44px)] font-extrabold leading-[1.05] tracking-[-0.03em]">{p.name}</h1>
            <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-sm font-semibold" style={{ color: "oklch(0.45 0.02 160)" }}>
              {p.avg != null && (
                <span className="inline-flex items-center gap-1.5">
                  <span style={{ color: "oklch(0.75 0.16 70)", letterSpacing: "1px" }}>{stars(Math.round(p.avg))}</span>
                  <b style={{ color: "oklch(0.22 0.03 160)" }}>{p.avg.toFixed(1).replace(".", ",")}</b>
                  <span>· {p.reviewCount} đánh giá</span>
                </span>
              )}
              <span>{p.area}, Tà Xùa</span>
              <span onClick={() => scrollTo(mapRef.current)} className="cursor-pointer underline" style={{ color: "oklch(0.4 0.08 160)", textUnderlineOffset: 3 }}>Xem bản đồ ↓</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={toggleSave} className={btnPill} style={{ borderColor: "oklch(0.88 0.02 160)", background: "white", color: "oklch(0.3 0.05 160)" }}>{saved ? "♥ Đã lưu" : "♡ Lưu quán"}</button>
            <a href={p.mapOpenUrl} target="_blank" rel="noopener noreferrer" className={btnPill} style={{ borderColor: "oklch(0.88 0.02 160)", background: "white", color: "oklch(0.3 0.05 160)" }}>Chỉ đường</a>
            <a href={`tel:${tel}`} className="whitespace-nowrap rounded-full px-[18px] py-2.5 text-sm font-bold text-white transition hover:bg-sunset-500" style={{ background: G }}>Gọi quán</a>
          </div>
        </div>

        {/* Gallery */}
        {hasGallery && (
          <>
            <div className="grid gap-2 overflow-hidden rounded-[22px]" style={{ gridTemplateColumns: narrow ? "minmax(0,1fr) minmax(0,1fr)" : "minmax(0,2fr) minmax(0,1fr) minmax(0,1fr)", gridTemplateRows: "minmax(0,1fr) minmax(0,1fr)", height: narrow ? 300 : w < 980 ? 380 : 460 }}>
              <div onClick={() => setLb(0)} className="relative row-span-2 min-h-0 cursor-zoom-in">
                <Image src={g[0]} alt={p.name} fill priority sizes="(max-width:980px) 100vw, 700px" className="object-cover" />
              </div>
              {g.slice(1, 5).map((src, i) => {
                const hidden = narrow && i >= 2;
                const isMore = i === nThumb - 1 && g.length - 1 > nThumb;
                return (
                  <div key={i} onClick={() => setLb(i + 1)} className="relative min-h-0 cursor-zoom-in" style={{ display: hidden ? "none" : "block" }}>
                    <Image src={src} alt={`${p.name} ${i + 2}`} fill sizes="320px" className="object-cover" />
                    {isMore && (
                      <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-[15px] font-extrabold text-white" style={{ background: "oklch(0.15 0.03 200 / .55)" }}>+{g.length - 1 - nThumb} ảnh</div>
                    )}
                  </div>
                );
              })}
            </div>
            {g.length > 1 && (
              <div className="-mt-2.5 flex gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {g.map((src, i) => (
                  <div key={i} onClick={() => setLb(i)} className="relative h-[68px] w-[92px] flex-none cursor-pointer overflow-hidden rounded-xl border-2" style={{ borderColor: lb === i ? "oklch(0.68 0.18 45)" : "transparent" }}>
                    <Image src={src} alt="" fill sizes="92px" className="object-cover" />
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Body grid */}
        <div className="grid items-start gap-7" style={{ gridTemplateColumns: wide ? "minmax(0,1fr) 340px" : "1fr" }}>
          <div className="flex min-w-0 flex-col gap-7">
            {/* Quick facts */}
            <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,150px),1fr))" }}>
              {facts.map((f) => (
                <div key={f.k} className="rounded-2xl border bg-white px-4 py-3.5" style={{ borderColor: "oklch(0.92 0.01 160)" }}>
                  <div className="text-xs font-semibold" style={{ color: "oklch(0.5 0.02 160)" }}>{f.k}</div>
                  <div className="mt-1 text-base font-extrabold tracking-[-0.01em]">{f.v}</div>
                  <div className="mt-0.5 text-xs" style={{ color: "oklch(0.5 0.02 160)" }}>{f.d}</div>
                </div>
              ))}
            </div>

            {/* Về quán */}
            <section className="flex flex-col gap-3">
              <h2 className="text-[22px] font-extrabold tracking-[-0.02em]">Về quán</h2>
              <div className="relative overflow-hidden transition-[max-height] duration-500" style={{ maxHeight: desc ? 2000 : 150 }}>
                <div
                  className="flex flex-col gap-3 text-[15px] leading-[1.7] [&_a]:font-semibold [&_a]:text-forest-700 [&_a]:underline [&_h2]:mt-5 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-ink [&_h3]:mt-4 [&_h3]:font-bold [&_img]:my-3 [&_img]:w-full [&_img]:rounded-2xl [&_li]:my-1 [&_ul]:list-inside [&_ul]:list-disc"
                  style={{ color: "oklch(0.35 0.02 160)" }}
                  dangerouslySetInnerHTML={{ __html: p.contentHtml }}
                />
                {!desc && <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[70px]" style={{ background: "linear-gradient(180deg, transparent, oklch(0.975 0.01 150))" }} />}
              </div>
              <button type="button" onClick={() => setDesc((v) => !v)} className="self-start rounded-full border-[1.5px] bg-white px-4 py-2.5 text-sm font-bold" style={{ borderColor: "oklch(0.88 0.02 160)", color: "oklch(0.3 0.05 160)" }}>{desc ? "Thu gọn ↑" : "Đọc đầy đủ ↓"}</button>
            </section>

            {/* Tiện ích */}
            {p.amenities.length > 0 && (
              <section className="flex flex-col gap-3">
                <h2 className="text-[22px] font-extrabold tracking-[-0.02em]">Tiện ích</h2>
                <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(min(100%,200px),1fr))" }}>
                  {p.amenities.map((a) => (
                    <div key={a} className="flex items-center gap-2.5 rounded-xl border bg-white px-3.5 py-2.5 text-sm font-semibold" style={{ borderColor: "oklch(0.92 0.01 160)" }}>
                      <span className="h-2 w-2 flex-none rounded-full" style={{ background: "oklch(0.55 0.12 155)" }} />{a}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Giờ đẹp để tới */}
            <section className="flex flex-col gap-3">
              <h2 className="text-[22px] font-extrabold tracking-[-0.02em]">Giờ đẹp để tới</h2>
              <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,160px),1fr))" }}>
                {BEST_TIME.map((t) => (
                  <div key={t.h} className="rounded-2xl border px-4 py-3.5" style={{ background: t.hot ? "oklch(0.95 0.06 70)" : "white", borderColor: "oklch(0.92 0.01 160)" }}>
                    <div className="text-xl font-extrabold tracking-[-0.02em]" style={{ color: t.hot ? "oklch(0.48 0.15 50)" : G }}>{t.h}</div>
                    <div className="mt-1 text-sm font-bold">{t.t}</div>
                    <div className="mt-0.5 text-[13px] leading-[1.5]" style={{ color: "oklch(0.45 0.02 160)" }}>{t.d}</div>
                  </div>
                ))}
              </div>
            </section>

            {/* Đánh giá */}
            <section ref={revRef} className="flex flex-col gap-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <h2 className="text-[22px] font-extrabold tracking-[-0.02em]">Đánh giá từ khách</h2>
                <button type="button" onClick={() => setWriting((v) => !v)} className="whitespace-nowrap rounded-full px-4 py-2.5 text-sm font-bold text-white transition hover:bg-sunset-500" style={{ background: G }}>Viết đánh giá</button>
              </div>

              {p.reviewCount > 0 && (
                <div className="grid gap-5 rounded-[18px] border bg-white p-5" style={{ gridTemplateColumns: w >= 760 ? "auto minmax(0,1fr)" : "1fr", borderColor: "oklch(0.92 0.01 160)" }}>
                  <div className="flex flex-col items-start gap-1">
                    <div className="text-[52px] font-extrabold leading-none tracking-[-0.04em]">{(p.avg ?? 0).toFixed(1).replace(".", ",")}</div>
                    <div className="text-lg" style={{ color: "oklch(0.75 0.16 70)", letterSpacing: "2px" }}>{stars(Math.round(p.avg ?? 0))}</div>
                    <div className="text-[13px]" style={{ color: "oklch(0.48 0.02 160)" }}>{p.reviewCount} đánh giá</div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {p.dist.map((n, i) => {
                      const starN = 5 - i;
                      const pct = p.reviewCount ? Math.round((n / p.reviewCount) * 100) : 0;
                      return (
                        <div key={starN} className="grid items-center gap-2.5 text-[13px] font-semibold" style={{ gridTemplateColumns: "52px minmax(0,1fr) 36px", color: "oklch(0.45 0.02 160)" }}>
                          <span>{starN} sao</span>
                          <div className="h-2 overflow-hidden rounded-full" style={{ background: "oklch(0.93 0.01 160)" }}>
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "oklch(0.55 0.12 155)" }} />
                          </div>
                          <span className="text-right">{n}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {writing && (
                <div className="flex flex-col gap-3 rounded-[18px] border p-5" style={{ background: "oklch(0.95 0.025 155)", borderColor: "oklch(0.9 0.04 155)" }}>
                  <div className="text-base font-extrabold">Bạn thấy quán thế nào?</div>
                  <PlaceReviewForm placeId={p.placeId} />
                </div>
              )}

              {p.reviewCount > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {([["all", `Tất cả (${p.reviewCount})`], ["5", "5 sao"], ["4", "4 sao"], ["3", "3 sao"]] as [typeof filter, string][]).map(([k, name]) => (
                    <button key={k} type="button" onClick={() => { setFilter(k); setRevN(3); }} className="cursor-pointer whitespace-nowrap rounded-full border px-3.5 py-2 text-[13px] font-bold" style={{ background: filter === k ? G : "white", color: filter === k ? "white" : "oklch(0.35 0.02 160)", borderColor: "oklch(0.9 0.01 160)" }}>{name}</button>
                  ))}
                </div>
              )}

              {p.reviewCount === 0 ? (
                <p className="rounded-[18px] border border-dashed bg-white px-5 py-8 text-center text-sm" style={{ borderColor: "oklch(0.88 0.02 160)", color: "oklch(0.45 0.02 160)" }}>
                  Chưa có đánh giá nào — hãy là người đầu tiên chia sẻ trải nghiệm!
                </p>
              ) : (
                <div className="flex flex-col gap-3">
                  {shown.map((r, i) => (
                    <article key={r.id} className="flex flex-col gap-2.5 rounded-[18px] border bg-white px-5 py-[18px]" style={{ borderColor: "oklch(0.92 0.01 160)" }}>
                      <div className="flex flex-wrap justify-between gap-2.5">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full text-[15px] font-extrabold text-white" style={{ background: AV[i % AV.length] }}>{r.name.slice(0, 1).toUpperCase()}</div>
                          <div>
                            <div className="text-[15px] font-extrabold">{r.name}</div>
                            <div className="text-xs" style={{ color: "oklch(0.5 0.02 160)" }}>Khách tại Tà Xùa</div>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-0.5">
                          <span className="text-sm" style={{ color: "oklch(0.75 0.16 70)", letterSpacing: "1px" }}>{stars(r.rating)}</span>
                          <span className="text-xs" style={{ color: "oklch(0.5 0.02 160)" }}>{r.date}</span>
                        </div>
                      </div>
                      <div className="text-[15px] leading-[1.65]" style={{ color: "oklch(0.3 0.02 160)" }}>{r.content}</div>
                    </article>
                  ))}
                  {filtered.length > revN && (
                    <button type="button" onClick={() => setRevN((n) => n + 3)} className="self-center rounded-full border-[1.5px] bg-white px-5 py-2.5 text-sm font-bold" style={{ borderColor: "oklch(0.88 0.02 160)", color: "oklch(0.3 0.05 160)" }}>Xem thêm đánh giá</button>
                  )}
                </div>
              )}
            </section>

            {/* Vị trí */}
            <section ref={mapRef} className="flex flex-col gap-3">
              <h2 className="text-[22px] font-extrabold tracking-[-0.02em]">Vị trí</h2>
              <div className="overflow-hidden rounded-[18px] border bg-white" style={{ borderColor: "oklch(0.92 0.01 160)" }}>
                <div className="aspect-[16/7] w-full">
                  <iframe src={p.mapEmbed} loading="lazy" referrerPolicy="no-referrer-when-downgrade" title={`Bản đồ ${p.name}`} className="h-full w-full border-0" />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 px-[18px] py-3.5">
                  <div className="text-sm leading-[1.5]" style={{ color: "oklch(0.35 0.02 160)" }}>{p.address || `${p.area}, xã Tà Xùa, Bắc Yên, Sơn La`}</div>
                  <a href={p.mapOpenUrl} target="_blank" rel="noopener noreferrer" className="whitespace-nowrap rounded-full px-4 py-2.5 text-sm font-bold text-white" style={{ background: G }}>Mở Google Maps</a>
                </div>
              </div>
            </section>
          </div>

          {/* Sticky aside */}
          <aside className="flex flex-col gap-3.5 rounded-[22px] border bg-white p-5 shadow-[0_24px_50px_-30px_oklch(0.25_0.06_220_/.35)]" style={{ borderColor: "oklch(0.92 0.01 160)", position: wide ? "sticky" : "static", top: 84 }}>
            <div>
              <div className="text-xs font-semibold" style={{ color: "oklch(0.5 0.02 160)" }}>{p.price ? "Đồ uống từ" : "Giá"}</div>
              <div className="text-[30px] font-extrabold leading-[1.1] tracking-[-0.03em]" style={{ color: "oklch(0.6 0.18 45)" }}>{p.price || "Theo menu"}</div>
              <div className="text-[13px]" style={{ color: "oklch(0.48 0.02 160)" }}>Giá tham khảo, xác nhận tại quán</div>
            </div>
            <div className="flex flex-col gap-2 rounded-[14px] p-3.5" style={{ background: "oklch(0.965 0.01 160)" }}>
              {p.hours && <Row k="Giờ mở cửa" v={p.hours} />}
              <Row k="Hôm nay" v={p.openText} vColor={p.openOpen ? "oklch(0.38 0.1 155)" : "oklch(0.55 0.02 160)"} />
              <Row k="Giờ đẹp nhất" v="5:30 – 9:00" />
              <Row k="Đặt bàn" v="Tới sớm giữ chỗ" />
            </div>
            <a href={`tel:${tel}`} className="rounded-full py-3.5 text-center text-[15px] font-extrabold text-white transition hover:opacity-90" style={{ background: "oklch(0.68 0.18 45)" }}>Gọi quán · {phoneShown}</a>
            <a href={`https://zalo.me/${tel}`} target="_blank" rel="noopener noreferrer" className="rounded-full border-[1.5px] py-3 text-center text-sm font-bold" style={{ borderColor: "oklch(0.88 0.02 160)", color: "oklch(0.3 0.05 160)" }}>Hỏi Tà Xùa Booking qua Zalo</a>
            <div className="text-center text-xs leading-[1.5]" style={{ color: "oklch(0.5 0.02 160)" }}>
              Muốn săn mây tại giường? <Link href="/homestay" className="font-bold text-forest-700">Homestay khu {p.area}</Link> gần đó.
            </div>
          </aside>
        </div>

        {/* Suggestions */}
        {p.related.length > 0 && (
          <section className="mt-2.5 flex flex-col gap-3.5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-[22px] font-extrabold tracking-[-0.02em]">Quán khác gần đây</h2>
                <div className="mt-1 text-sm" style={{ color: "oklch(0.48 0.02 160)" }}>Cùng khu {p.area} hoặc gần đó</div>
              </div>
              <Link href={p.basePath} className="text-sm font-bold text-forest-700">Xem tất cả cafe →</Link>
            </div>
            <div className="grid gap-3.5" style={{ gridTemplateColumns: w >= 980 ? "repeat(4,minmax(0,1fr))" : "none", gridAutoFlow: w >= 980 ? "row" : "column", gridAutoColumns: w >= 980 ? "auto" : w >= 640 ? "42%" : "72%", overflowX: w >= 980 ? "visible" : "auto" }}>
              {p.related.map((r) => (
                <Link key={r.id} href={`${p.basePath}/${r.slug}`} className="group flex min-w-0 flex-col overflow-hidden rounded-[18px] border bg-white transition hover:shadow-[0_20px_40px_-24px_oklch(0.25_0.06_220_/.4)]" style={{ borderColor: "oklch(0.92 0.01 160)" }}>
                  <div className="relative aspect-[4/3]">
                    {r.image ? (
                      <Image src={r.image} alt={r.name} fill sizes="320px" className="object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-4xl" style={{ background: "linear-gradient(160deg, oklch(0.9 0.04 150), oklch(0.82 0.05 120))" }}>☕</div>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col gap-1.5 px-4 pb-4 pt-3.5">
                    <div className="text-base font-extrabold leading-[1.3] tracking-[-0.01em]">{r.name}</div>
                    <div className="flex items-center gap-1.5 text-[13px]" style={{ color: "oklch(0.48 0.02 160)" }}>{r.area}{r.hours ? ` · ${r.hours}` : ""}</div>
                    <div className="flex flex-wrap gap-1.5">
                      {r.tags.slice(0, 2).map((t) => (
                        <span key={t} className="whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: "oklch(0.95 0.025 155)", color: "oklch(0.36 0.08 155)" }}>{t}</span>
                      ))}
                    </div>
                    <div className="flex-1" />
                    <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
                      <span className="whitespace-nowrap text-[15px] font-extrabold" style={{ color: "oklch(0.6 0.18 45)" }}>{r.price || "Theo menu"}</span>
                      <span className="whitespace-nowrap text-[13px] font-bold text-forest-700">Xem quán →</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Lightbox */}
      {lb >= 0 && g[lb] && (
        <div onClick={() => setLb(-1)} className="fixed inset-0 z-[60] flex cursor-zoom-out flex-col items-center justify-center gap-3.5 p-5" style={{ background: "oklch(0.12 0.02 200 / .92)" }}>
          <div className="absolute right-5 top-4 text-sm font-bold text-white">{lb + 1} / {g.length}</div>
          <div onClick={(e) => { e.stopPropagation(); setLb((lb - 1 + g.length) % g.length); }} className="absolute left-3.5 top-1/2 flex h-11 w-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-[22px] text-white" style={{ background: "oklch(1 0 0 / .14)" }}>‹</div>
          <div onClick={(e) => { e.stopPropagation(); setLb((lb + 1) % g.length); }} className="absolute right-3.5 top-1/2 flex h-11 w-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-[22px] text-white" style={{ background: "oklch(1 0 0 / .14)" }}>›</div>
          <div onClick={(e) => e.stopPropagation()} className="relative cursor-default overflow-hidden rounded-2xl" style={{ width: "min(1100px,92vw)", height: "min(70vh,720px)" }}>
            <Image src={g[lb]} alt={p.name} fill sizes="92vw" className="object-contain" />
          </div>
        </div>
      )}

      {/* Mobile bottom bar */}
      {narrow && (
        <div className="sticky bottom-0 z-30 flex items-center justify-between gap-3 border-t bg-white px-4 py-2.5" style={{ borderColor: "oklch(0.92 0.01 160)" }}>
          <div>
            <div className="text-xs" style={{ color: "oklch(0.5 0.02 160)" }}>{p.price ? "Đồ uống từ" : "Giá"}</div>
            <div className="text-xl font-extrabold tracking-[-0.02em]" style={{ color: "oklch(0.6 0.18 45)" }}>{p.price || "Theo menu"}</div>
          </div>
          <div className="flex gap-2">
            <a href={p.mapOpenUrl} target="_blank" rel="noopener noreferrer" className="whitespace-nowrap rounded-full border-[1.5px] px-3.5 py-3 text-sm font-bold" style={{ borderColor: "oklch(0.88 0.02 160)", color: "oklch(0.3 0.05 160)" }}>Chỉ đường</a>
            <a href={`tel:${tel}`} className="whitespace-nowrap rounded-full px-[18px] py-3 text-sm font-extrabold text-white" style={{ background: "oklch(0.68 0.18 45)" }}>Gọi quán</a>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ k, v, vColor }: { k: string; v: string; vColor?: string }) {
  return (
    <div className="flex justify-between gap-3 text-sm">
      <span style={{ color: "oklch(0.48 0.02 160)" }}>{k}</span>
      <b style={vColor ? { color: vColor } : undefined}>{v}</b>
    </div>
  );
}
