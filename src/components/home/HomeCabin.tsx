"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export interface FareRow { pickupPoint: string; price: number | null }
export interface CabinStop { time: string; place: string; note: string | null; gap?: string | null }

function vnd(n: number | null): string {
  if (n == null) return "Liên hệ";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n % 1_000_000 ? 1 : 0) + "tr";
  return Math.round(n / 1000) + "k";
}
function full(n: number | null): string {
  if (n == null) return "Liên hệ";
  return new Intl.NumberFormat("vi-VN").format(n) + "đ";
}

const GREEN = "oklch(0.27 0.05 160)";
const GREEN_DEEP = "oklch(0.23 0.045 160)";

export function HomeCabin({
  fares,
  combo,
  homeFrom,
  bikeFrom,
  footnote,
  routes,
  phone,
  zalo,
  startInfo,
  pickupInfo,
}: {
  fares: FareRow[];
  combo: { title: string; sub: string; price: number | null } | null;
  homeFrom: number | null;
  bikeFrom: number | null;
  footnote: string;
  routes: { di: CabinStop[]; ve: CabinStop[] };
  phone: string;
  zalo?: string | null;
  startInfo: string;
  pickupInfo: string;
}) {
  const [dir, setDir] = useState<"di" | "ve">("di");
  const carRef = useRef<HTMLDivElement>(null);
  const laneRef = useRef<HTMLDivElement>(null);
  const stops = dir === "ve" ? routes.ve : routes.di;
  const hasRoute = routes.di.length > 0 || routes.ve.length > 0;

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const t0 = performance.now();
    let raf = 0;
    const loop = (now: number) => {
      const car = carRef.current, lane = laneRef.current;
      if (car && car.parentElement) {
        const W = car.parentElement.offsetWidth, D = 9000;
        const f = ((now - t0) % D) / D;
        const back = dir === "ve";
        const x = back ? W - f * (W + 80) : -80 + f * (W + 80);
        const bob = Math.sin(now / 80) * 0.8;
        car.style.transform = `translate(${x}px,${bob}px) scaleX(${back ? -1 : 1})`;
        if (lane) lane.style.backgroundPosition = `${(back ? 1 : -1) * (((now - t0) / 25) % 36)}px 0`;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [dir]);

  const tabOn = { background: "white", color: GREEN };
  const tabOff = { background: "transparent", color: "oklch(0.9 0.02 160)" };

  return (
    <section className="container-page">
      <div className="flex flex-col gap-9 overflow-hidden rounded-[28px] p-6 text-white sm:p-10" style={{ background: GREEN }}>
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="flex max-w-2xl flex-col gap-3">
            <div className="text-[13px] font-bold uppercase tracking-[0.1em]" style={{ color: "oklch(0.82 0.13 60)" }}>Xe cabin giường nằm · khứ hồi</div>
            <h2 className="text-4xl font-extrabold leading-none tracking-tight sm:text-6xl">Cabin Tà Xùa</h2>
            <div className="text-lg font-medium italic" style={{ color: "oklch(0.88 0.03 160)" }}>Đồng hành cùng bạn trên mọi nẻo đường.</div>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <Chip label="Xuất phát" value={startInfo} />
            <Chip label="Điểm đón Hà Nội" value={pickupInfo} />
          </div>
        </div>

        {/* Giá + combo */}
        <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="rounded-[22px] p-6 text-ink sm:p-8" style={{ background: "oklch(0.975 0.012 95)" }}>
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div className="text-2xl font-extrabold tracking-tight">Bảng giá vé theo nơi đón</div>
              <div className="text-[13px] font-semibold text-gray-500">Giá khứ hồi / khách</div>
            </div>
            <div className="mt-4 grid gap-x-8 sm:grid-cols-2">
              {fares.map((f, i) => (
                <div key={i} className="flex items-baseline gap-2.5 border-b border-gray-200 py-3">
                  <span className="text-base font-medium">{f.pickupPoint}</span>
                  <span className="flex-1" />
                  <span className="text-xl font-extrabold tracking-tight" style={{ color: i === 0 ? "oklch(0.6 0.18 45)" : "oklch(0.22 0.03 160)" }}>{vnd(f.price)}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 text-[13px] text-gray-500">{footnote}</div>
          </div>

          <div className="flex flex-col gap-3">
            {combo && (
              <div className="flex flex-1 flex-col gap-2 rounded-[22px] p-6" style={{ background: "oklch(0.68 0.18 45)" }}>
                <span className="self-start rounded-full bg-white/20 px-2.5 py-1.5 text-xs font-bold uppercase tracking-wider">{combo.sub}</span>
                <div className="mt-1.5 text-xl font-extrabold leading-snug">{combo.title}</div>
                <div className="flex-1" />
                <div className="text-6xl font-extrabold leading-none tracking-tight sm:text-7xl">{vnd(combo.price)}</div>
                <div className="text-sm">Giá từ Hà Nội, gồm vé xe và phòng</div>
                <Link href="/combo" className="mt-2 self-start rounded-full bg-white px-4 py-2.5 text-[15px] font-bold" style={{ color: "oklch(0.45 0.15 45)" }}>Đặt combo</Link>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <MiniCard label="Home lẻ view kính" value={vnd(homeFrom)} unit="/đêm" prefix="từ " href="/homestay" />
              <MiniCard label="Thuê xe máy" value={vnd(bikeFrom)} unit="/ngày" href="/thue-xe-may" />
            </div>
          </div>
        </div>

        {/* Lộ trình + xe chạy */}
        {hasRoute && (
          <div className="flex flex-col gap-7 overflow-hidden rounded-[22px] p-6 sm:p-8" style={{ background: GREEN_DEEP, border: "1px solid oklch(1 0 0 / .1)" }}>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-2xl font-extrabold tracking-tight">{dir === "ve" ? "Ăn trưa trên núi, tối đã về phố." : "Ngủ một giấc, mở mắt là tới mây."}</div>
                <div className="mt-1 text-[15px]" style={{ color: "oklch(0.82 0.03 160)" }}>{dir === "ve" ? "Chiều về · Tà Xùa → Hà Nội · khoảng 7 tiếng" : "Chiều đi · Hà Nội → Tà Xùa · khoảng 8 tiếng"}</div>
              </div>
              <div className="inline-flex gap-1 rounded-full p-1" style={{ background: "oklch(1 0 0 / .08)" }}>
                <button type="button" onClick={() => setDir("di")} className="rounded-full px-4 py-2 text-sm font-bold transition" style={dir === "di" ? tabOn : tabOff}>Chiều đi</button>
                <button type="button" onClick={() => setDir("ve")} className="rounded-full px-4 py-2 text-sm font-bold transition" style={dir === "ve" ? tabOn : tabOff}>Chiều về</button>
              </div>
            </div>

            <div className="grid gap-0 sm:grid-cols-2 lg:grid-cols-4">
              {stops.map((s, i) => {
                const last = i === stops.length - 1;
                return (
                  <div key={i} className="flex min-w-0 flex-col gap-2.5 pb-2 pr-5">
                    <div className="flex items-center gap-2.5">
                      <span className="h-3.5 w-3.5 flex-none rounded-full" style={{ background: last ? "oklch(0.72 0.17 50)" : "oklch(0.97 0.01 160)", boxShadow: `0 0 0 5px ${last ? "oklch(0.72 0.17 50 / .3)" : "oklch(1 0 0 / .12)"}` }} />
                      {!last && <span className="h-0.5 flex-1" style={{ background: "oklch(1 0 0 / .22)" }} />}
                      {!last && s.gap && <span className="whitespace-nowrap text-xs font-semibold" style={{ color: "oklch(0.8 0.03 160)" }}>{s.gap}</span>}
                    </div>
                    <div className="mt-1.5 text-4xl font-extrabold leading-none tracking-tight" style={{ color: last ? "oklch(0.85 0.13 65)" : "white" }}>{s.time}</div>
                    <div className="text-[17px] font-bold">{s.place}</div>
                    {s.note && <div className="text-sm leading-normal" style={{ color: "oklch(0.82 0.02 160)" }}>{s.note}</div>}
                  </div>
                );
              })}
            </div>

            {/* Lane + car */}
            <div className="relative -mx-6 -mb-6 h-14 overflow-hidden sm:-mx-8 sm:-mb-8">
              <div className="absolute inset-x-0 bottom-0 h-7" style={{ background: "oklch(0.2 0.035 160)" }} />
              <div ref={laneRef} className="absolute inset-x-0 bottom-3 h-0.5" style={{ backgroundImage: "repeating-linear-gradient(90deg,oklch(1 0 0 / .28) 0 18px,transparent 18px 36px)" }} />
              <div ref={carRef} className="absolute bottom-3.5 left-0 h-[30px] w-16 will-change-transform">
                <div className="absolute left-0 top-0 h-[22px] w-16" style={{ borderRadius: "8px 14px 5px 5px", background: "oklch(0.7 0.18 48)", boxShadow: "0 6px 14px oklch(0.1 0.02 160 / .45)" }} />
                <div className="absolute" style={{ left: 8, top: 5, width: 30, height: 7, borderRadius: 2, background: "oklch(0.92 0.03 230)" }} />
                <div className="absolute" style={{ left: 43, top: 4, width: 15, height: 8, borderRadius: "2px 7px 2px 2px", background: "oklch(0.92 0.03 230)" }} />
                <div className="absolute" style={{ right: -3, top: 13, width: 5, height: 5, borderRadius: "50%", background: "oklch(0.97 0.1 95)", boxShadow: "0 0 14px 6px oklch(0.95 0.12 95 / .5)" }} />
                <div className="absolute" style={{ left: 9, top: 17, width: 13, height: 13, borderRadius: "50%", background: "oklch(0.16 0.01 160)", border: "3px solid oklch(0.82 0.01 160)" }} />
                <div className="absolute" style={{ left: 42, top: 17, width: 13, height: 13, borderRadius: "50%", background: "oklch(0.16 0.01 160)", border: "3px solid oklch(0.82 0.01 160)" }} />
              </div>
            </div>
          </div>
        )}

        {/* Footer row */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="text-[13px] font-bold uppercase tracking-[0.14em]" style={{ color: "oklch(0.82 0.13 60)" }}>An toàn · Tiện lợi · Đúng giờ</div>
          <div className="flex flex-wrap gap-2.5">
            <a href={`tel:${phone.replace(/\s/g, "")}`} className="rounded-full bg-white px-5 py-3 text-[15px] font-bold" style={{ color: GREEN }}>Gọi {phone}</a>
            {zalo && <a href={`https://zalo.me/${zalo}`} target="_blank" rel="noopener noreferrer" className="rounded-full px-5 py-3 text-[15px] font-bold text-white" style={{ background: "oklch(0.68 0.18 45)" }}>Đặt vé qua Zalo</a>}
          </div>
        </div>
      </div>
    </section>
  );
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl px-4 py-3" style={{ background: "oklch(1 0 0 / .08)", border: "1px solid oklch(1 0 0 / .12)" }}>
      <div className="text-xs opacity-70">{label}</div>
      <div className="mt-0.5 text-xl font-extrabold">{value}</div>
    </div>
  );
}

function MiniCard({ label, value, unit, prefix, href }: { label: string; value: string; unit: string; prefix?: string; href: string }) {
  return (
    <Link href={href} className="rounded-[18px] p-4" style={{ background: "oklch(1 0 0 / .08)", border: "1px solid oklch(1 0 0 / .12)" }}>
      <div className="text-[13px] opacity-75">{label}</div>
      <div className="mt-1 text-sm">{prefix}<span className="text-2xl font-extrabold" style={{ color: "oklch(0.85 0.13 65)" }}>{value}</span>{unit}</div>
    </Link>
  );
}
