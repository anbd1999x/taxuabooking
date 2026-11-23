"use client";

import Link from "@/components/Link";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/components/i18n/I18nProvider";

export interface FareRow { pickupPoint: string; price: number | null }
export interface CabinStop { time: string; place: string; note: string | null; gap?: string | null }

function vnd(n: number | null): string {
  if (n == null) return "Liên hệ";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n % 1_000_000 ? 1 : 0) + "tr";
  return Math.round(n / 1000) + "k";
}

const ORANGE = "oklch(0.68 0.18 45)";
const GOLD = "oklch(0.8 0.14 70)";
const STARS = Array.from({ length: 24 }, (_, i) => ({ x: ((i * 37 + 7) % 97) + "%", y: ((i * 17 + 3) % 30) + "%", s: 1 + (i % 3), d: 2 + (i % 5) * 0.7 }));
const BAND = [[-5, 0, 34, 60], [18, 10, 30, 55], [40, -4, 34, 66], [62, 8, 30, 58], [82, -2, 32, 64], [8, 36, 22, 40], [50, 40, 22, 38]];

/** Khối "Cabin Tà Xùa" trang chủ — thiết kế v5 (trời đêm có sao, lộ trình sáng dần + xe chạy theo tiến độ cuộn). */
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
  const t = useT();
  const [dir, setDir] = useState<"di" | "ve">("di");
  const legsRef = useRef<HTMLDivElement>(null);
  const busRef = useRef<HTMLDivElement>(null);
  const comboRef = useRef<HTMLSpanElement>(null);
  const comboStartRef = useRef<number | null>(null); // mốc bắt đầu đếm số (giữ qua lần đổi chiều)
  const stops = dir === "ve" ? routes.ve : routes.di;
  const hasRoute = routes.di.length > 0 || routes.ve.length > 0;

  // Lộ trình: cuộn tới vùng lộ trình thì xe TỰ chạy dần theo thời gian (không bám theo vuốt), điểm dừng sáng dần theo xe;
  // đổi chiều Đi/Về thì chạy lại từ đầu. Số giá combo đếm lên khi cuộn tới.
  useEffect(() => {
    const R = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const cl = (v: number) => Math.max(0, Math.min(1, v));
    const eo = (v: number) => 1 - Math.pow(1 - v, 3);
    const t0 = performance.now();
    let raf = 0;
    let legStart: number | null = null; // mốc (giây) xe bắt đầu chạy
    const RUN = 3.2; // thời gian xe chạy hết lộ trình (giây)
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const sec = (now - t0) / 1000;
      const vh = window.innerHeight;
      const lg = legsRef.current;
      if (lg) {
        const r = lg.getBoundingClientRect();
        if (r.bottom > -100 && r.top < vh + 100) {
          if (legStart == null && r.top < vh * 0.8) legStart = sec;
          const p = legStart == null ? 0 : cl((sec - legStart) / RUN);
          // ease-in-out: xe lăn bánh từ từ rồi chậm lại khi tới nơi
          const f = R ? 1 : p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
          const dots = lg.querySelectorAll<HTMLElement>("[data-stop]");
          const n = dots.length;
          dots.forEach((d, i) => {
            const on = f >= (n > 1 ? i / (n - 1) : 0) - 0.02;
            const last = i === n - 1;
            d.style.background = on ? (last ? ORANGE : "oklch(0.86 0.12 78)") : "transparent";
            d.style.boxShadow = on ? "0 0 0 5px oklch(0.8 0.14 70 / .22), 0 0 14px oklch(0.86 0.12 78 / .7)" : "none";
            d.style.transform = on ? "scale(1.15)" : "scale(1)";
          });
          const bus = busRef.current;
          if (bus?.parentElement) {
            const W = bus.parentElement.offsetWidth;
            const x = f * (W - 70) + (R ? 0 : Math.sin(sec * 2) * 3);
            bus.style.transform = `translate3d(${dir === "ve" ? W - 70 - x : x}px, ${R ? 0 : Math.sin(sec * 9) * 0.6}px, 0) scaleX(${dir === "ve" ? -1 : 1})`;
          }
        }
      }
      const cn = comboRef.current;
      if (cn && combo?.price) {
        const r = cn.getBoundingClientRect();
        if (comboStartRef.current == null && r.top < vh * 0.92) comboStartRef.current = now / 1000;
        if (comboStartRef.current != null) {
          const k = R ? 1 : eo(cl((now / 1000 - comboStartRef.current) / 1.6));
          cn.textContent = t(vnd(Math.round((combo.price * k) / 1000) * 1000));
        }
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [dir, combo, t]);

  return (
    <section className="mx-auto max-w-[1240px] px-[clamp(16px,4vw,40px)] pt-[clamp(40px,6vw,64px)]">
      <div
        data-rv
        className="relative flex flex-col gap-[clamp(18px,2.4vw,26px)] overflow-hidden rounded-[28px] p-[clamp(20px,3vw,32px)] text-white"
        style={{ background: "linear-gradient(180deg, oklch(0.22 0.05 240) 0%, oklch(0.25 0.05 162) 45%)" }}
      >
        {/* trời đêm: sao, trăng, dải mây */}
        {STARS.map((s, i) => (
          <span
            key={i}
            data-tw
            aria-hidden
            className="pointer-events-none absolute rounded-full bg-white"
            style={{ left: s.x, top: s.y, width: s.s, height: s.s, boxShadow: "0 0 6px white", ["--tw" as string]: `${s.d}s`, animationDelay: `${-i * 0.37}s` }}
          />
        ))}
        {/* trăng lưỡi liềm: hình tròn bị khoét một hình tròn lệch (mask); quầng sáng dùng drop-shadow để ôm theo hình liềm */}
        <div
          aria-hidden
          // Màn hẹp: khối cabin rất cao ⇒ top theo % bị trôi xuống giữa ⇒ ghim góc trên-phải bằng px, thu nhỏ để không đè chữ.
          className="pointer-events-none absolute right-2 top-2 h-[70px] w-[70px] origin-top-right scale-[.7] opacity-90 min-[900px]:right-[42%] min-[900px]:top-[3%] min-[900px]:scale-100"
          style={{ filter: "drop-shadow(0 0 10px oklch(0.95 0.06 85 / .55)) drop-shadow(0 0 28px oklch(0.95 0.06 85 / .3))" }}
        >
          <div
            className="h-full w-full rounded-full"
            style={{
              background: "radial-gradient(circle at 30% 45%, oklch(0.99 0.03 90), oklch(0.9 0.06 85) 70%)",
              WebkitMaskImage: "radial-gradient(circle at 70% 36%, transparent 0 27px, #000 28px)",
              maskImage: "radial-gradient(circle at 70% 36%, transparent 0 27px, #000 28px)",
              transform: "rotate(-12deg)",
            }}
          />
        </div>
        <div data-px="-0.08" aria-hidden className="pointer-events-none absolute -left-[10%] -right-[10%] -top-[20%] h-[60%] opacity-[.12] will-change-transform">
          {BAND.map(([x, y, w, h], i) => (
            <div key={i} className="absolute rounded-full blur-[16px]" style={{ left: `${x}%`, bottom: `${y}%`, width: `${w}%`, height: `${h}%`, background: "radial-gradient(ellipse, white 30%, transparent 70%)" }} />
          ))}
        </div>

        {/* Tiêu đề */}
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-xs font-extrabold uppercase tracking-[.16em]" style={{ color: GOLD }}>{t("Xe cabin giường nằm · khứ hồi")}</div>
            <h2 className="mt-2 text-[clamp(32px,4.4vw,48px)] font-extrabold leading-none tracking-[-.03em]">{t("Cabin Tà Xùa")}</h2>
            <div className="mt-2 text-[15px] italic" style={{ color: "oklch(0.85 0.02 160)" }}>{t("Đồng hành cùng bạn trên mọi nẻo đường.")}</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Fact label={t("Xuất phát")} value={t(startInfo)} />
            <Fact label={t("Điểm đón Hà Nội")} value={t(pickupInfo)} />
          </div>
        </div>

        {/* Bảng giá + combo */}
        <div className="relative grid items-stretch gap-3 min-[900px]:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
          <div className="flex flex-col gap-3 rounded-[20px] p-[clamp(16px,2vw,24px)]" style={{ background: "oklch(0.97 0.012 85)", color: "oklch(0.22 0.03 160)" }}>
            <div className="flex flex-wrap items-baseline justify-between gap-2.5">
              <span className="text-lg font-extrabold">{t("Bảng giá vé theo nơi đón")}</span>
              <span className="text-[11px] font-semibold" style={{ color: "oklch(0.5 0.02 160)" }}>{t("Giá khứ hồi / khách")}</span>
            </div>
            <div className="grid gap-x-7 min-[560px]:grid-cols-2">
              {fares.map((f, i) => (
                <div key={i} className="flex items-center justify-between gap-2.5 border-b py-2.5 text-sm" style={{ borderColor: "oklch(0.92 0.015 85)" }}>
                  <span>{t(f.pickupPoint)}</span>
                  <b className="text-[15px]" style={{ color: i === 0 ? ORANGE : "oklch(0.22 0.03 160)" }}>{t(vnd(f.price))}</b>
                </div>
              ))}
            </div>
            <div className="text-xs" style={{ color: "oklch(0.5 0.02 160)" }}>{t(footnote)}</div>
          </div>

          <div className="flex flex-col gap-2.5">
            {combo && (
              <div className="relative flex flex-1 flex-col gap-1.5 overflow-hidden rounded-[20px] p-[18px]" style={{ background: "oklch(0.66 0.18 45)" }}>
                <span className="self-start rounded-full bg-white/[.22] px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[.12em]">{t(combo.sub)}</span>
                <span className="mt-1 text-base font-extrabold leading-snug">{t(combo.title)}</span>
                <span className="flex-1" />
                <span ref={comboRef} className="text-[clamp(48px,5vw,60px)] font-extrabold leading-none tracking-[-.04em]">{t(vnd(combo.price))}</span>
                <span className="text-xs" style={{ color: "oklch(0.97 0.03 70)" }}>{t("Giá từ Hà Nội, gồm vé xe và phòng")}</span>
                <Link href="/combo" className="mt-2 self-start rounded-full bg-white px-4 py-2 text-[13px] font-extrabold" style={{ color: "oklch(0.45 0.15 45)" }}>{t("Đặt combo")}</Link>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2.5">
              <Mini label={t("Home lẻ view kính")} prefix={t("từ ")} value={t(vnd(homeFrom))} unit={t("/đêm")} href="/homestay" />
              <Mini label={t("Thuê xe máy")} value={t(vnd(bikeFrom))} unit={t("/ngày")} href="/thue-xe-may" />
            </div>
          </div>
        </div>

        {/* Lộ trình */}
        {hasRoute && (
          <div ref={legsRef} className="relative overflow-hidden rounded-[20px] px-[clamp(16px,2vw,24px)] pt-[clamp(16px,2vw,24px)]" style={{ background: "oklch(0.2 0.045 162)" }}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-[clamp(17px,1.8vw,20px)] font-extrabold">{dir === "ve" ? t("Ăn trưa trên núi, tối đã về phố.") : t("Ngủ một giấc, mở mắt là tới mây.")}</div>
                <div className="mt-1 text-xs" style={{ color: "oklch(0.78 0.02 160)" }}>
                  {dir === "ve" ? t("Chiều về · Tà Xùa → Hà Nội · khoảng 7 tiếng") : t("Chiều đi · Hà Nội → Tà Xùa · khoảng 8 tiếng")}
                </div>
              </div>
              <div className="inline-flex gap-[3px] rounded-full bg-white/[.08] p-[3px]">
                {(["di", "ve"] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setDir(k)}
                    className="whitespace-nowrap rounded-full px-3.5 py-[7px] text-xs font-extrabold transition"
                    style={dir === k ? { background: "white", color: "oklch(0.25 0.05 162)" } : { color: "oklch(0.88 0.02 160)" }}
                  >
                    {k === "di" ? t("Chiều đi") : t("Chiều về")}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5 grid pb-[26px] min-[720px]:[grid-template-columns:repeat(var(--n),minmax(0,1fr))]" style={{ ["--n" as string]: stops.length }}>
              {stops.map((s, i) => {
                const last = i === stops.length - 1;
                return (
                  <div key={`${dir}-${i}`} className="flex min-w-0 gap-3.5 min-[720px]:flex-col min-[720px]:gap-3">
                    <div className="flex flex-none flex-col items-center gap-1.5 min-[720px]:flex-row">
                      <span
                        data-stop
                        className="h-3 w-3 flex-none rounded-full border-2 transition-all duration-400"
                        style={{ borderColor: last ? "oklch(0.8 0.14 60)" : "oklch(1 0 0 / .5)" }}
                      />
                      <span
                        className="min-h-[18px] w-0.5 flex-1 min-[720px]:mr-2.5 min-[720px]:h-0.5 min-[720px]:min-h-0 min-[720px]:w-auto"
                        style={{ background: last ? "transparent" : "oklch(1 0 0 / .25)" }}
                      />
                    </div>
                    <div className="pb-3.5 min-[720px]:pb-0 min-[720px]:pr-3">
                      <div className="text-[clamp(22px,2.6vw,28px)] font-extrabold tracking-[-.02em]" style={{ color: last ? "oklch(0.8 0.15 65)" : "white" }}>{t(s.time)}</div>
                      <div className="mt-0.5 text-[13px] font-bold" style={{ color: "oklch(0.88 0.02 160)" }}>{t(s.place)}</div>
                      {s.note && <div className="mt-0.5 text-xs leading-snug" style={{ color: "oklch(0.75 0.02 160)" }}>{t(s.note)}</div>}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* đường + xe */}
            <div className="absolute inset-x-0 bottom-0 h-[22px]" style={{ background: "oklch(0.17 0.04 162)" }} aria-hidden>
              <div className="absolute inset-x-0 top-2.5 h-0.5" style={{ background: "repeating-linear-gradient(90deg, oklch(1 0 0 / .3) 0 14px, transparent 14px 26px)" }} />
              <div ref={busRef} className="absolute bottom-1.5 left-0 h-5 w-[58px] origin-center will-change-transform">
                <div className="absolute left-[52px] top-1.5 h-2.5 w-[70px]" style={{ background: "linear-gradient(90deg, oklch(0.97 0.1 90 / .5), transparent)", clipPath: "polygon(0 30%, 100% 0, 100% 100%, 0 70%)" }} />
                <div className="absolute left-0 top-0 h-[15px] w-[58px]" style={{ borderRadius: "5px 10px 4px 4px", background: "oklch(0.68 0.17 50)" }} />
                <div className="absolute left-[5px] top-[3px] h-[5px] w-[38px] rounded-[1px]" style={{ background: "repeating-linear-gradient(90deg, oklch(0.93 0.04 90) 0 7px, oklch(0.5 0.08 50) 7px 9px)" }} />
                <div className="absolute left-2 top-3 h-[9px] w-[9px] rounded-full border-2" style={{ background: "oklch(0.15 0.01 160)", borderColor: "oklch(0.75 0.01 160)" }} />
                <div className="absolute left-10 top-3 h-[9px] w-[9px] rounded-full border-2" style={{ background: "oklch(0.15 0.01 160)", borderColor: "oklch(0.75 0.01 160)" }} />
              </div>
            </div>
          </div>
        )}

        {/* Hàng cuối */}
        <div className="relative flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs font-extrabold uppercase tracking-[.16em]" style={{ color: GOLD }}>{t("An toàn · Tiện lợi · Đúng giờ")}</span>
          <div className="flex flex-wrap gap-2">
            <a href={`tel:${phone.replace(/\s/g, "")}`} className="whitespace-nowrap rounded-full bg-white px-[18px] py-[11px] text-sm font-extrabold" style={{ color: "oklch(0.25 0.05 162)" }}>
              {t("Gọi {0}", [t(phone)])}
            </a>
            {zalo && (
              <a href={`https://zalo.me/${zalo}`} target="_blank" rel="noopener noreferrer" className="whitespace-nowrap rounded-full px-[18px] py-[11px] text-sm font-extrabold text-white" style={{ background: ORANGE }}>
                {t("Đặt vé qua Zalo")}
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[14px] border border-white/[.14] bg-white/[.07] px-3.5 py-2.5">
      <div className="text-[11px]" style={{ color: "oklch(0.8 0.02 160)" }}>{label}</div>
      <div className="mt-0.5 whitespace-nowrap text-base font-extrabold">{value}</div>
    </div>
  );
}

function Mini({ label, value, unit, prefix = "", href }: { label: string; value: string; unit: string; prefix?: string; href: string }) {
  return (
    <Link href={href} className="rounded-[14px] border border-white/[.14] bg-white/[.06] p-3 text-white">
      <div className="text-[11px]" style={{ color: "oklch(0.8 0.02 160)" }}>{label}</div>
      <div className="mt-1 text-xs">
        {prefix}
        <b className="text-[19px]" style={{ color: "oklch(0.8 0.15 65)" }}>{value}</b>
        {unit}
      </div>
    </Link>
  );
}
