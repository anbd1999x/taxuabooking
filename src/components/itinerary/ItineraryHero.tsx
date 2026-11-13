"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

export interface HeroPlan {
  id: string;
  name: string; // "2N1Đ"
  title: string; // "2 ngày 1 đêm"
  meta: string; // "13 điểm dừng · 6 điểm check-in"
}

// ── Mây trôi 3 lớp (sinh 1 lần, cố định) ─────────────────────────────────────
const CLOUD_LAYERS = (
  [
    ["16%", "11%", 0.55, 1, 7, 70, 22, 14],
    ["7%", "12%", 0.75, 2, 8, 90, 26, 12],
    ["-3%", "14%", 0.95, 3, 9, 110, 30, 10],
  ] as const
).map(([bottom, h, op, z, n, bw, bh, blur], li) => ({
  bottom,
  h,
  op,
  z,
  blur,
  clouds: Array.from({ length: n * 2 }, (_, i) => ({
    x: `${Math.round(((i * (100 / n)) / 2 + ((li * 7) % 10)) * 100) / 100}%`,
    y: `${(i * 37 + li * 11) % 30}%`,
    w: `${Math.round(Math.min(18, (bw + ((i * 13 + li * 7) % 60)) / 6) * 100) / 100}%`,
    h: `${Math.min(140, (bh + ((i * 17) % 30)) * 2)}%`,
  })),
}));
const BIRDS = [0, 1, 2, 3, 4].map((i) => 14 + (i % 3) * 4);
const IN = (i: number): React.CSSProperties => ({ animation: `lth-in .9s cubic-bezier(.2,.7,.2,1) ${i * 0.12}s both` });

/**
 * Phần đầu trang Lịch trình: cảnh bình minh hoạt hình (mặt trời mọc, 2 lớp núi parallax, rừng thông,
 * mây trôi, chim bay, xe máy chạy trên sống núi) + thẻ chọn lịch trình nổi đè lên mép dưới.
 */
export function ItineraryHero({
  plans, activeId, onPick, onTab,
}: {
  plans: HeroPlan[];
  activeId: string;
  onPick: (id: string) => void;
  onTab: (tab: "checkin" | "cafe") => void;
}) {
  const root = useRef<HTMLElement>(null);
  const wrap = useRef<HTMLDivElement>(null); // khung chung của cảnh + thẻ lịch trình (xe máy chạy trên cả hai)
  const card = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = root.current;
    if (!host) return;
    const reduce = !!window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const sun = host.querySelector<HTMLElement>("[data-sun]");
    const ridgeB = host.querySelector<SVGElement>("[data-ridge='b']");
    const ridgeF = host.querySelector<SVGElement>("[data-ridge='f']");
    const text = host.querySelector<HTMLElement>("[data-text]");
    const bike = wrap.current?.querySelector<HTMLElement>("[data-bike]") ?? null;
    const machine = bike?.querySelector<HTMLElement>("[data-machine]") ?? null;
    const riders = bike?.querySelector<HTMLElement>("[data-riders]") ?? null;
    const flagEl = bike?.querySelector<HTMLElement>("[data-flag]") ?? null;
    const wEl = wrap.current, cEl = card.current;
    const layers = [...host.querySelectorAll<HTMLElement>("[data-clouds]")];
    const birds = [...host.querySelectorAll<HTMLElement>("[data-bird]")];
    const t0 = performance.now();
    let raf = 0;

    // khói phanh: bể hạt tái sử dụng
    const puffs = Array.from(wrap.current?.querySelectorAll<HTMLElement>("[data-smoke]") ?? []);
    const born: number[] = puffs.map(() => -9), px: number[] = puffs.map(() => 0), py: number[] = puffs.map(() => 0);
    let nextPuff = 0, lastEmit = 0;
    const emit = (t: number, x: number, y: number) => {
      if (!puffs.length || t - lastEmit < 0.045) return;
      lastEmit = t; born[nextPuff] = t; px[nextPuff] = x; py[nextPuff] = y; nextPuff = (nextPuff + 1) % puffs.length;
    };
    const tick = (t: number) => {
      const H = host.offsetHeight, W = host.offsetWidth, sy = window.scrollY || 0;
      const e = reduce ? 1 : 1 - Math.pow(1 - Math.min(1, t / 5), 3); // mặt trời mọc trong ~5 giây
      if (sun) sun.style.transform = `translateY(${H * (0.55 - 0.3 * e) + sy * 0.3}px)`;
      if (ridgeB) ridgeB.style.transform = `translateY(${sy * 0.18}px)`;
      if (ridgeF) ridgeF.style.transform = `translateY(${sy * 0.1}px)`;
      if (text) { text.style.transform = `translateY(${sy * 0.25}px)`; text.style.opacity = String(Math.max(0, 1 - sy / (H * 0.7))); }
      if (reduce) return;
      layers.forEach((el, i) => { el.style.transform = `translateX(${-((t * (6 + i * 5)) % W)}px)`; });
      birds.forEach((el, i) => {
        const x = ((t * (26 + i * 5) + i * 230) % (W + 200)) - 100;
        const y = H * (0.18 + i * 0.045) + Math.sin(t * 0.8 + i) * 10;
        el.style.transform = `translate(${x}px, ${y}px)`;
        const f = Math.sin(t * (8 + i)) * 24;
        const l = el.querySelector<HTMLElement>("[data-wl]"), r = el.querySelector<HTMLElement>("[data-wr]");
        if (l) l.style.transform = `rotate(${f}deg)`;
        if (r) r.style.transform = `rotate(${-f}deg)`;
      });
      if (bike && wEl && cEl) {
        const wr = wEl.getBoundingClientRect(), cr = cEl.getBoundingClientRect();
        const cL = cr.left - wr.left, cR = cr.right - wr.left, cT = cr.top - wr.top;
        const BW = 44, BH = 34, V = 300, V2 = 230; // chạy nhanh trên sườn núi / trên mép thẻ
        // mặt đường trên sườn núi (nhấp nhô nhẹ theo chiều ngang)
        const gY = (x: number) => { const q = (x + 60) / (W + 120); return H * 0.85 - BH + Math.sin(q * Math.PI * 4) * -10 - Math.sin(q * Math.PI * 1.3) * 18; };
        const wideL = cL >= 70, wideR = W - cR >= 70; // có chỗ trống bên trái / phải thẻ (màn rộng)
        const xs = wideL ? cL - BW - 6 : cL + 6; // chỗ dừng xe để bê lên
        const xe = cL + 10, xr = cR - BW - 10, topY = cT - BH + 3; // chạy trên mép trên của thẻ
        // quãng phanh: đang phóng thì phanh gấp, trượt thêm một đoạn rồi dừng hẳn (bốc khói)
        const SK1 = wideL ? Math.min(110, xs + 60) : 0, TB1 = wideL ? 0.6 : 0; // phanh trước thẻ
        const SK2 = Math.min(90, Math.max(0, xr - xe - 20)), TB2 = 0.5; // phanh ở cuối mép thẻ
        const t1 = wideL ? Math.max(0, xs - SK1 + 60) / V : 0, t2 = 2.4, t3 = Math.max(0.3, (xr - SK2 - xe) / V2), t4 = wideR ? 0.55 : 0.6, t5 = wideR ? (W + 60 - (cR + 14)) / V : 0;
        let u = t % (t1 + TB1 + 0.35 + t2 + t3 + TB2 + 0.3 + t4 + t5);
        let x = 0, y = 0, rot = 0, z = 2, carry = false, flag = 0, op = 1, smoke = false;
        const skid = (k: number) => 1 - (1 - k) * (1 - k); // giảm tốc đều tới 0
        if (u < t1) {
          x = -60 + u * V; y = gY(x) + Math.sin(t * 40) * 1; rot = (gY(x + 6) - gY(x - 6)) * 2.2 - 4;
        } else if ((u -= t1) < TB1 + 0.35) {
          // phanh gấp: chúi đầu, bánh sau bốc khói; dừng hẳn 0,35s cho khói tan
          const k = Math.min(1, u / (TB1 || 1));
          x = xs - SK1 + SK1 * skid(k); y = gY(x); rot = (gY(x + 6) - gY(x - 6)) * 2.2 + 13 * Math.sin(Math.min(1, k * 1.15) * Math.PI);
          smoke = k < 0.95;
        } else if ((u -= TB1 + 0.35) < t2) {
          // xuống xe (15% đầu) → hai người đội xe đi lên mép thẻ → ngồi lại (cuối)
          const k = u / t2, e0 = Math.min(1, Math.max(0, (k - 0.15) / 0.75)), e = e0 * e0 * (3 - 2 * e0);
          const y0 = wideL ? gY(xs) : cT + 16;
          x = xs + (xe - xs) * e; y = y0 + (topY - y0) * e;
          carry = k < 0.92;
          if (carry && e0 > 0 && e0 < 1) y -= Math.abs(Math.sin(t * 11)) * 2;
          rot = carry ? -8 * Math.sin(e * Math.PI) : 0;
          z = wideL || e > 0.6 ? 6 : 4; // màn hẹp: nhô lên từ sau mép thẻ
        } else if ((u -= t2) < t3) {
          // rồ ga phóng trên mép thẻ (bốc đầu nhẹ lúc xuất phát), băng rôn bung ra
          x = xe + u * V2; y = topY + Math.sin(t * 40) * 1; z = 6; flag = Math.min(1, u / 0.5); rot = -9 * Math.max(0, 1 - u / 0.35);
          smoke = u < 0.25;
        } else if ((u -= t3) < TB2 + 0.3) {
          // phanh cháy khói ở cuối thẻ
          const k = Math.min(1, u / TB2); z = 6; flag = 1;
          x = xr - SK2 + SK2 * skid(k); y = topY; rot = 13 * Math.sin(Math.min(1, k * 1.15) * Math.PI);
          smoke = k < 0.95;
        } else if ((u -= TB2 + 0.3) < t4) {
          const k = u / t4; z = 6; flag = 1;
          if (wideR) { const y1 = gY(cR + 14); x = xr + (cR + 14 - xr) * k; y = topY + (y1 - topY) * k * k - Math.sin(k * Math.PI) * 16; rot = 14 * Math.sin(k * Math.PI); }
          else { x = xr + k * 30; y = topY; op = 1 - k; }
        } else {
          u -= t4; x = cR + 14 + u * V; y = gY(x) + Math.sin(t * 40) * 1; rot = (gY(x + 6) - gY(x - 6)) * 2.2 - 4; flag = 1;
        }
        if (smoke) emit(t, x + 2 + Math.sin(t * 91) * 3, y + BH - 9);
        // khói: phồng to, trôi ngược ra sau và bay lên, mờ dần trong 0,8s
        puffs.forEach((p, i) => {
          const a = (t - born[i]) / 0.8;
          if (a < 0 || a >= 1) { if (p.style.opacity !== "0") p.style.opacity = "0"; return; }
          p.style.transform = `translate(${px[i] - 9 - a * 34 - (i % 3) * 3}px, ${py[i] - a * (16 + (i % 4) * 5)}px) scale(${0.5 + a * 2.1})`;
          p.style.opacity = String((1 - a) * 0.85);
          p.style.zIndex = String(z);
        });
        bike.style.transform = `translate(${x}px, ${y}px) rotate(${rot}deg)`;
        bike.style.zIndex = String(z);
        bike.style.opacity = String(op);
        if (machine) machine.style.transform = carry ? "translateY(-22px)" : "none";
        if (riders) riders.style.transform = carry ? "translateY(13px)" : "none";
        if (flagEl) { flagEl.style.transform = `scaleX(${flag})`; flagEl.style.opacity = String(flag); }
      }
    };
    const loop = (now: number) => {
      tick((now - t0) / 1000);
      if (!reduce) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const onScroll = () => { if (reduce) tick(0); };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { cancelAnimationFrame(raf); window.removeEventListener("scroll", onScroll); };
  }, []);

  const CLOUD_BG = "radial-gradient(ellipse at 50% 40%, oklch(1 0 0) 30%, oklch(0.97 0.02 40 / .85) 60%, oklch(0.96 0.03 40 / 0) 72%)";
  const PINE_A = "oklch(0.33 0.05 170)", PINE_B = "oklch(0.25 0.05 162)";
  const TEXT_SHADOW = "0 1px 2px oklch(0.2 0.05 260 / .55), 0 2px 18px oklch(0.2 0.05 260 / .5)";

  return (
    <div ref={wrap} className="relative" style={{ overflowX: "clip" }}>
      <style>{`@keyframes lth-in{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:none}}@keyframes lth-wave{0%,100%{transform:skewY(-4deg)}50%{transform:skewY(4deg)}}@media (prefers-reduced-motion:reduce){.lth-in,.lth-flag{animation:none!important}}`}</style>
      <section
        ref={root}
        className="relative h-[460px] overflow-hidden min-[600px]:h-[480px] min-[900px]:h-[520px]"
        style={{ background: "linear-gradient(180deg, oklch(0.5 0.09 265) 0%, oklch(0.66 0.1 310) 30%, oklch(0.8 0.11 45) 58%, oklch(0.9 0.08 75) 78%, oklch(0.95 0.04 90) 100%)" }}
      >
        <div
          data-sun
          aria-hidden
          className="absolute left-[78%] top-0 -ml-[85px] h-[170px] w-[170px] rounded-full will-change-transform min-[900px]:left-[74%]"
          style={{ transform: "translateY(130px)", background: "radial-gradient(circle, oklch(0.99 0.06 95) 0%, oklch(0.94 0.13 78) 42%, oklch(0.86 0.15 60 / 0) 72%)" }}
        />
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-[28%] h-[62%]" style={{ background: "radial-gradient(ellipse 60% 50% at 76% 62%, oklch(0.93 0.12 70 / .55), transparent 70%)" }} />
        {BIRDS.map((w, i) => (
          <div key={i} data-bird aria-hidden className="pointer-events-none absolute left-0 top-0 z-[2] h-2.5 will-change-transform" style={{ width: w, transform: "translate(-200px,0)" }}>
            <span data-wl className="absolute right-1/2 top-1 h-0.5 w-[52%] rounded-sm" style={{ background: "oklch(0.3 0.04 280)", transformOrigin: "right center" }} />
            <span data-wr className="absolute left-1/2 top-1 h-0.5 w-[52%] rounded-sm" style={{ background: "oklch(0.3 0.04 280)", transformOrigin: "left center" }} />
          </div>
        ))}
        <svg data-ridge="b" aria-hidden viewBox="0 0 1000 200" preserveAspectRatio="none" className="absolute bottom-[24%] left-[-5%] h-[40%] w-[110%] opacity-80 will-change-transform">
          <path d="M 0 200 L 0 118 C 50 96, 90 80, 130 84 C 180 88, 200 120, 250 112 C 300 104, 330 40, 390 36 C 440 32, 470 98, 520 94 C 570 90, 600 52, 650 50 C 700 48, 730 104, 780 100 C 830 96, 860 30, 910 28 C 950 26, 980 60, 1000 66 L 1000 200 Z" fill="oklch(0.55 0.07 290)" />
        </svg>
        <svg data-ridge="f" aria-hidden viewBox="0 0 1000 200" preserveAspectRatio="none" className="absolute bottom-[12%] left-[-5%] h-[34%] w-[110%] will-change-transform">
          <path d="M 0 200 L 0 104 C 60 76, 100 66, 150 70 C 200 74, 220 110, 270 106 C 320 102, 350 46, 410 44 C 460 42, 490 102, 540 98 C 590 94, 620 64, 670 62 C 720 60, 750 114, 800 110 C 850 106, 880 54, 930 54 C 965 54, 985 76, 1000 84 L 1000 200 Z" fill="oklch(0.38 0.06 220)" />
        </svg>
        {/* rừng thông */}
        <div aria-hidden className="pointer-events-none absolute bottom-[14%] left-[-5%] right-[-5%] h-24" style={{ WebkitMaskImage: "linear-gradient(180deg, black 45%, transparent 92%)", maskImage: "linear-gradient(180deg, black 45%, transparent 92%)" }}>
          <div className="absolute inset-0 opacity-80" style={{ background: `linear-gradient(-45deg, ${PINE_A} 50%, transparent 50%) 5px 100% / 17px 58px repeat-x, linear-gradient(45deg, ${PINE_A} 50%, transparent 50%) 5px 100% / 17px 58px repeat-x` }} />
          <div className="absolute inset-x-0 bottom-0 h-[62px]" style={{ background: `linear-gradient(-45deg, ${PINE_B} 50%, transparent 50%) 14px 100% / 23px 62px repeat-x, linear-gradient(45deg, ${PINE_B} 50%, transparent 50%) 14px 100% / 23px 62px repeat-x, linear-gradient(-45deg, ${PINE_B} 50%, transparent 50%) 3px 100% / 37px 52px repeat-x, linear-gradient(45deg, ${PINE_B} 50%, transparent 50%) 3px 100% / 37px 52px repeat-x` }} />
        </div>
        {CLOUD_LAYERS.map((L, li) => (
          <div key={li} aria-hidden className="pointer-events-none absolute inset-x-0" style={{ bottom: L.bottom, height: L.h, opacity: L.op, zIndex: L.z }}>
            <div data-clouds className="absolute inset-y-0 left-0 w-[200%] will-change-transform">
              {L.clouds.map((c, i) => (
                <span key={i} className="absolute rounded-full" style={{ left: c.x, bottom: c.y, width: c.w, height: c.h, background: CLOUD_BG, filter: `blur(${L.blur}px)` }} />
              ))}
            </div>
          </div>
        ))}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 z-[3] h-[110px]" style={{ background: "linear-gradient(180deg, transparent, oklch(0.975 0.01 150))" }} />
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 z-[3] h-[72%]" style={{ background: "linear-gradient(180deg, oklch(0.25 0.06 270 / .35), transparent)" }} />

        <div data-text className="container-page relative z-[4] pt-9 text-white will-change-transform min-[900px]:pt-12">
          <nav className="lth-in flex gap-2 text-sm text-[oklch(0.97_0.02_80)]" style={{ ...IN(0), textShadow: "0 1px 8px oklch(0.2 0.05 260 / .5)" }}>
            <Link href="/" className="hover:underline">Trang chủ</Link>
            <span>/</span>
            <Link href="/kinh-nghiem" className="hover:underline">Cẩm nang</Link>
            <span>/</span>
            <span className="font-bold text-white">Lịch trình</span>
          </nav>
          <div className="lth-in mt-[18px] text-[13px] font-bold uppercase tracking-[.14em] text-[oklch(0.9_0.12_80)]" style={IN(1)}>Cẩm nang · Lịch trình gợi ý</div>
          <h1 className="lth-in mt-3.5 max-w-[760px] text-balance text-[clamp(36px,6vw,66px)] font-extrabold leading-[1.03] tracking-[-.035em]" style={{ ...IN(2), textShadow: "0 2px 24px oklch(0.2 0.05 260 / .4)" }}>
            Đi Tà Xùa mấy ngày, đi đâu, ăn gì?
          </h1>
          <p className="lth-in mt-3.5 max-w-[540px] text-pretty text-[clamp(16px,1.7vw,19px)] leading-normal text-[oklch(0.99_0.01_80)]" style={{ ...IN(3), textShadow: TEXT_SHADOW }}>
            Lịch trình theo giờ cho chuyến xe cabin đêm từ Hà Nội, kèm điểm check-in, quán cafe và quán ăn nên ghé.
          </p>
        </div>
      </section>

      {/* khói phanh của xe máy */}
      {Array.from({ length: 14 }, (_, i) => (
        <div key={i} data-smoke aria-hidden className="pointer-events-none absolute left-0 top-0 h-[22px] w-[22px] rounded-full will-change-transform" style={{ opacity: 0, background: i % 3 === 0 ? "oklch(0.5 0.015 250 / .9)" : i % 3 === 1 ? "oklch(0.68 0.012 250 / .9)" : "oklch(0.9 0.005 250 / .95)", filter: "blur(2px)" }} />
      ))}
      {/* xe máy 2 người: phóng nhanh trên sườn núi, tới thẻ lịch trình thì phanh cháy khói, bê xe lên mép thẻ chạy tiếp, kéo băng rôn */}
      <div data-bike aria-hidden className="pointer-events-none absolute left-0 top-0 z-[2] h-[34px] w-11 will-change-transform" style={{ transform: "translate(-80px,0)" }}>
        <div data-flag className="absolute right-full top-[3px] flex origin-right items-center" style={{ transform: "scaleX(0)", opacity: 0 }}>
          <span className="lth-flag whitespace-nowrap rounded-[3px] px-2 py-[3px] text-[11px] font-extrabold leading-tight" style={{ background: "oklch(0.58 0.22 27)", color: "oklch(0.93 0.16 95)", boxShadow: "0 3px 8px -2px oklch(0.2 0.04 260 / .5)", animation: "lth-wave 1.1s ease-in-out infinite", transformOrigin: "right center" }}>Đi Tà Xùa thôi!</span>
          <span className="h-px w-3.5" style={{ background: "oklch(0.3 0.03 250)" }} />
        </div>
        <div data-riders className="absolute inset-0 transition-transform duration-300">
          <div className="absolute left-3 top-0.5 h-2 w-2 rounded-full" style={{ background: "oklch(0.62 0.14 45)" }} />
          <div className="absolute left-[11px] top-[9px] h-[13px] w-2.5 rounded" style={{ background: "oklch(0.5 0.08 250)" }} />
          <div className="absolute left-[22px] top-0 h-2 w-2 rounded-full" style={{ background: "oklch(0.9 0.02 90)" }} />
          <div className="absolute left-[21px] top-[7px] h-3.5 w-2.5 rounded" style={{ background: "oklch(0.42 0.07 160)" }} />
        </div>
        <div data-machine className="absolute inset-0 transition-transform duration-300">
          <div className="absolute left-1.5 top-[19px] h-[7px] w-[30px]" style={{ borderRadius: "4px 7px 2px 2px", background: "oklch(0.5 0.13 25)" }} />
          <div className="absolute left-9 top-[18px] h-[3px] w-1 rounded-sm" style={{ background: "oklch(0.97 0.08 95)", boxShadow: "0 0 8px 3px oklch(0.96 0.1 95 / .5)" }} />
          <div className="absolute left-px top-[22px] h-3 w-3 rounded-full" style={{ background: "oklch(0.2 0.01 250)" }} />
          <div className="absolute left-[29px] top-[22px] h-3 w-3 rounded-full" style={{ background: "oklch(0.2 0.01 250)" }} />
        </div>
      </div>

      {/* Thẻ chọn lịch trình nổi đè lên mép dưới cảnh */}
      <div className="lth-in container-page relative z-[5] -mt-[110px] min-[900px]:-mt-[120px]" style={IN(4)}>
        <div
          ref={card}
          className="grid gap-2 rounded-3xl border p-2.5 backdrop-blur-[14px] min-[900px]:[grid-template-columns:var(--cols)]"
          style={{ ["--cols" as string]: `repeat(${Math.max(1, plans.length)}, minmax(0,1fr)) 220px`, background: "oklch(1 0 0 / .92)", borderColor: "oklch(1 0 0 / .8)", boxShadow: "0 24px 60px -24px oklch(0.25 0.06 220 / .45)" }}
        >
          {plans.map((p) => {
            const on = p.id === activeId;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onPick(p.id)}
                className="flex items-center gap-3.5 rounded-[18px] border-[1.5px] px-4 py-3.5 text-left transition-all duration-200 hover:border-[oklch(0.55_0.1_160)]"
                style={{ background: on ? "oklch(0.29 0.055 160)" : "white", color: on ? "white" : "oklch(0.22 0.03 160)", borderColor: on ? "oklch(0.29 0.055 160)" : "oklch(0.92 0.01 160)" }}
              >
                <span
                  className="flex h-[52px] w-[52px] flex-none items-center justify-center rounded-2xl text-[15px] font-extrabold tracking-[-.02em]"
                  style={{ background: on ? "oklch(0.68 0.18 45)" : "oklch(0.95 0.03 155)", color: on ? "white" : "oklch(0.35 0.08 160)" }}
                >
                  {p.name}
                </span>
                <span className="min-w-0">
                  <span className="block text-base font-extrabold">{p.title}</span>
                  <span className="block text-[13px] leading-[1.4] opacity-80">{p.meta}</span>
                </span>
              </button>
            );
          })}
          <div className="flex flex-col gap-1.5">
            {([["Điểm check-in", "checkin"], ["Cafe & quán ăn", "cafe"]] as const).map(([name, k]) => (
              <button
                key={k}
                type="button"
                onClick={() => onTab(k)}
                className="flex flex-1 items-center justify-between gap-2.5 whitespace-nowrap rounded-[14px] bg-[oklch(0.965_0.01_160)] px-3.5 py-2.5 text-sm font-bold text-ink hover:bg-[oklch(0.94_0.02_155)]"
              >
                <span>{name}</span>
                <span className="text-[oklch(0.6_0.18_45)]">↓</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
