"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const TH = {
  sky: "linear-gradient(180deg, oklch(0.34 0.045 240) 0%, oklch(0.55 0.04 220) 36%, oklch(0.8 0.05 120) 66%, oklch(0.9 0.06 95) 86%, oklch(0.95 0.03 95) 100%)",
  r1: "linear-gradient(180deg, oklch(0.45 0.04 200), oklch(0.52 0.04 190))",
  r2: "linear-gradient(180deg, oklch(0.3 0.045 170), oklch(0.36 0.05 160))",
  cloud: ["oklch(0.92 0.01 220 / .75)", "oklch(0.95 0.008 210 / .88)", "oklch(0.97 0.012 85)"],
  blur: ["20px", "26px", "30px"],
  page: "oklch(0.975 0.01 150)",
  mote: "oklch(0.98 0.05 95)",
};
function rnd(i: number, k: number) {
  const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/** Hero "biển mây" + hoạt ảnh combo: xe cabin phanh đón khách → khách vào homestay, chủ nhà ra đón. */
export function ComboHero() {
  const [w, setW] = useState(1280);
  const sunRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const heroTextRef = useRef<HTMLDivElement>(null);
  const ridgeBackRef = useRef<HTMLDivElement>(null);
  const ridgeFrontRef = useRef<HTMLDivElement>(null);
  const busRef = useRef<HTMLDivElement>(null);
  const doorRef = useRef<HTMLDivElement>(null);
  const houseRef = useRef<HTMLDivElement>(null);
  const hDoorRef = useRef<HTMLDivElement>(null);
  const winRef = useRef<HTMLDivElement>(null);
  const win2Ref = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const dadRef = useRef<HTMLDivElement>(null);
  const momRef = useRef<HTMLDivElement>(null);
  const kidRef = useRef<HTMLDivElement>(null);
  const layerEls = useRef<(HTMLDivElement | null)[]>([]);
  const starEls = useRef<(HTMLSpanElement | null)[]>([]);
  const birdEls = useRef<(HTMLDivElement | null)[]>([]);
  const moteEls = useRef<(HTMLSpanElement | null)[]>([]);
  const smokeEls = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    const onR = () => setW(window.innerWidth);
    onR();
    window.addEventListener("resize", onR);
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    document.querySelectorAll<HTMLElement>("[data-in-combo]").forEach((el) => {
      const k = Number(el.dataset.inCombo);
      setTimeout(() => { el.style.opacity = "1"; el.style.transform = "none"; }, reduce ? 0 : 250 + k * 160);
    });
    const t0 = performance.now();
    const SP = [0.35, 0.7, 1.25];
    let raf = 0;
    const loop = (now: number) => {
      const t = (now - t0) / 1000;
      const sy = window.scrollY || 0;
      const rise = reduce ? 1 : Math.min(1, t / 5);
      const e = 1 - Math.pow(1 - rise, 3);
      const hero = sunRef.current?.parentElement;
      const H = hero?.offsetHeight ?? 560;
      const W = hero?.offsetWidth ?? 1200;
      if (sunRef.current) sunRef.current.style.transform = `translateY(${H * (0.62 - 0.34 * e) + sy * 0.35}px) scale(${1 + Math.sin(t * 1.2) * 0.02})`;
      if (glowRef.current) glowRef.current.style.opacity = String(0.35 + 0.65 * e);
      starEls.current.forEach((el, i) => { if (el) el.style.opacity = String(Math.max(0, (1 - e) * 0.8 + 0.12 * Math.sin(t * 2 + i))); });
      if (heroTextRef.current) { heroTextRef.current.style.transform = `translateY(${sy * 0.25}px)`; heroTextRef.current.style.opacity = String(Math.max(0, 1 - sy / 420)); }
      layerEls.current.forEach((el, i) => { if (!el) return; const x = reduce ? 0 : (t * SP[i]) % 50; el.style.transform = `translate3d(${-x}%, ${-sy * (0.04 + i * 0.03) + Math.sin(t * 0.5 + i) * 4}px, 0)`; });
      if (ridgeBackRef.current) ridgeBackRef.current.style.transform = `translateY(${sy * 0.18}px)`;
      if (ridgeFrontRef.current) ridgeFrontRef.current.style.transform = `translateY(${sy * 0.1}px)`;
      if (!reduce) {
        birdEls.current.forEach((el, i) => {
          if (!el) return;
          const sp = 0.035 + i * 0.006, f = ((t * sp + i * 0.23) % 1.3) - 0.15;
          const x = f * W, y = H * (0.16 + (i % 3) * 0.07) + Math.sin(t * 0.8 + i * 2) * 14 - sy * 0.2;
          el.style.transform = `translate(${x}px, ${y}px)`;
          const a = Math.sin(t * (7 + i) + i) * 30;
          const l = el.querySelector<HTMLElement>("[data-wl]"), r = el.querySelector<HTMLElement>("[data-wr]");
          if (l) l.style.transform = `rotate(${a}deg)`;
          if (r) r.style.transform = `rotate(${-a}deg)`;
        });
        moteEls.current.forEach((el, i) => {
          if (!el) return;
          const sp = 14 + (i % 5) * 6, span = H * 0.7, pr = ((t * sp + i * 97) % span) / span;
          const x = ((i * 0.137) % 1) * W + Math.sin(t * 0.7 + i) * 24, y = H * 0.92 - pr * span;
          el.style.transform = `translate(${x}px, ${y}px)`;
          el.style.opacity = String(Math.sin(pr * Math.PI) * 0.75);
        });

        // ===== Combo: xe phanh đón → khách vào homestay, chủ nhà ra đón =====
        const P = 16, k = t % P;
        const cl = (v: number) => Math.max(0, Math.min(1, v));
        const seg = (a: number, b: number) => cl((k - a) / (b - a));
        const eo = (v: number) => 1 - Math.pow(1 - v, 3);
        const ei = (v: number) => v * v * v;
        const lr = (a: number, b: number, v: number) => a + (b - a) * v;
        const lift = -sy * 0.12;
        const Xh = Math.max(240, W * (W < 640 ? 0.6 : 0.62));
        const Xb = Xh - 240, Dx = Xh + 51, bd = Xb + 110;
        const e2 = seg(0, 2.0), prog = e2 < 0.55 ? (e2 / 0.55) * 0.88 : 0.88 + 0.12 * eo((e2 - 0.55) / 0.45);
        const bx = k < 2.0 ? -260 + (Xb + 260) * prog : k < 7.4 ? Xb : Xb + (W + 260 - Xb) * ei(seg(7.4, 9.6));
        const dip = k > 1.1 && k < 2.6 ? Math.sin(seg(1.1, 2.6) * Math.PI * 2.2) * Math.exp(-seg(1.1, 2.6) * 3) * 3.2 : 0;
        const moving = k < 1.1 || (k > 7.4 && k < 9.6);
        if (busRef.current) busRef.current.style.transform = `translate(${bx}px, ${(moving ? Math.sin(t * 14) * 0.9 : 0) + lift}px) rotate(${dip}deg)`;
        smokeEls.current.forEach((el, i) => {
          if (!el) return;
          const ts = 1.05 + (i % 5) * 0.16, a = seg(ts, ts + 1.6), rear = i < 5, wx = Xb + (rear ? 22 : 106);
          el.style.opacity = a > 0 && a < 1 ? String((1 - a) * (rear ? 0.95 : 0.7)) : "0";
          el.style.transform = `translate(${wx - a * (40 + i * 7)}px, ${lift + 6 - a * (22 + (i % 3) * 10)}px) scale(${0.5 + a * (2.2 + (i % 3) * 0.5)})`;
        });
        const bo = seg(2.3, 2.7) - seg(6.6, 7.0);
        if (doorRef.current) doorRef.current.style.transform = `translateX(${-17 * bo}px) scaleX(${1 - bo * 0.15})`;
        if (houseRef.current) houseRef.current.style.transform = `translate(${Xh}px, ${lift}px)`;
        const ho = Math.max(seg(5.9, 6.3) - seg(9.8, 10.2), seg(12.2, 12.5) - seg(13.2, 13.6));
        if (hDoorRef.current) hDoorRef.current.style.transform = `perspective(120px) rotateY(${-75 * ho}deg)`;
        const litv = seg(9.9, 10.6) - seg(14.4, 15.2);
        const wl = litv > 0 ? `oklch(${0.32 + litv * 0.56} ${0.03 + litv * 0.12} ${230 - litv * 150})` : "oklch(0.32 0.03 230)";
        const gl = `0 0 ${litv * 16}px ${litv * 4}px oklch(0.9 0.15 85 / ${litv * 0.7})`;
        [winRef.current, win2Ref.current].forEach((el) => { if (el) { el.style.background = wl; el.style.boxShadow = gl; } });

        const pose = (el: HTMLElement | null, x: number, y: number, f: number, mode: string, ph: number, sc: number) => {
          if (!el) return;
          const sw = mode === "walk" ? Math.sin(t * 12 + ph) * 24 : 0;
          el.style.transform = `translate(${x}px, ${y + lift}px) scale(${f * sc}, ${sc})`;
          const l = el.querySelectorAll<HTMLElement>("[data-leg]");
          if (l[0]) l[0].style.transform = `rotate(${sw}deg)`;
          if (l[1]) l[1].style.transform = `rotate(${-sw}deg)`;
        };
        const arm = (el: HTMLElement | null, d: number) => { const a = el?.querySelector<HTMLElement>("[data-arm]"); if (a) a.style.transform = `rotate(${d}deg)`; };
        const shake = k > 4.6 && k < 5.6, shk = Math.sin(t * 16) * 9;

        const H0 = hostRef.current;
        if (H0) {
          let x = Xh - 30, f = -1, mode = "stand", op = 1, sc = 1;
          if (k >= 5.7 && k < 6.3) f = 1;
          else if (k >= 6.3 && k < 7.7) { const wv = seg(6.3, 7.3); x = lr(Xh - 30, Dx, wv); f = 1; mode = wv < 1 ? "walk" : "stand"; const fd = seg(7.3, 7.7); op = 1 - fd; sc = 1 - fd * 0.15; }
          else if (k >= 7.7 && k < 12.4) op = 0;
          else if (k >= 12.4) { const v = seg(12.4, 12.8), wv = seg(12.8, 14); op = v; x = lr(Dx, Xh - 30, wv); mode = wv > 0 && wv < 1 ? "walk" : "stand"; }
          H0.style.opacity = String(op);
          pose(H0, x, 0, f, mode, 0, sc);
          arm(H0, shake ? -78 + shk : k > 2.8 && k < 4.5 ? -150 + Math.sin(t * 10) * 22 : k >= 5.7 && k < 6.3 ? -95 : mode === "walk" ? Math.sin(t * 12) * 18 : 0);
        }
        ([[dadRef.current, Xh - 58, 2.7, 6.6, 1], [momRef.current, Xh - 84, 3.2, 6.95, 1], [kidRef.current, Xh - 106, 3.7, 7.3, 0.72]] as const).forEach(([el, stop, s0, w0, sc], i) => {
          if (!el) return;
          const step = seg(s0, s0 + 0.3), wa = (stop - bd) / 70, wk = seg(s0 + 0.3, s0 + 0.3 + wa), wt = (Dx - stop) / 80, wv = seg(w0, w0 + wt), fd = seg(w0 + wt, w0 + wt + 0.4);
          let x: number, y = 0, mode = "stand";
          if (k < w0) { x = lr(bd, stop, wk); y = -8 * (1 - step); mode = wk > 0 && wk < 1 ? "walk" : "stand"; }
          else { x = lr(stop, Dx, wv); mode = wv < 1 ? "walk" : "stand"; }
          const hop = i === 2 && k > 4.6 && k < 5.8 ? -Math.abs(Math.sin(t * 9)) * 7 : 0;
          el.style.opacity = String(k < s0 ? 0 : k < w0 + wt + 0.4 ? Math.min(step * 1.5, 1) * (1 - fd) : 0);
          pose(el, x, y + hop, 1, mode, i * 1.3, sc * (1 - fd * 0.15));
          arm(el, i === 0 && shake ? -78 - shk : i === 2 && k > 4.6 && k < 5.8 ? -150 + Math.sin(t * 9) * 25 : mode === "walk" ? Math.sin(t * 12 + i) * 18 : 0);
        });
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { window.removeEventListener("resize", onR); cancelAnimationFrame(raf); };
  }, []);

  const layers = useMemo(() => {
    const LAY = [
      { bottom: "30%", h: "22%", op: 0.55, n: 8, wMin: 18, wMax: 30, hh: [40, 70], blur: TH.blur[0], bg: TH.cloud[0] },
      { bottom: "12%", h: "26%", op: 0.8, n: 9, wMin: 22, wMax: 36, hh: [60, 100], blur: TH.blur[1], bg: TH.cloud[1] },
      { bottom: "-4%", h: "30%", op: 1, n: 10, wMin: 26, wMax: 40, hh: [90, 150], blur: TH.blur[2], bg: TH.cloud[2] },
    ];
    return LAY.map((L, li) => {
      const half = Array.from({ length: L.n }, (_, i) => ({ x: (i / L.n) * 50 + rnd(i, li) * 3, y: rnd(i, li + 5) * 30, w: L.wMin + rnd(i, li + 9) * (L.wMax - L.wMin), h: L.hh[0] + rnd(i, li + 13) * (L.hh[1] - L.hh[0]) }));
      const clouds = half.concat(half.map((c) => ({ ...c, x: c.x + 50 }))).map((c) => ({ x: `${c.x - 6}%`, y: `${c.y}%`, w: `${c.w / 2}%`, h: `${c.h}px`, bg: L.bg, blur: L.blur }));
      return { bottom: L.bottom, h: L.h, op: L.op, clouds };
    });
  }, []);
  const stars = useMemo(() => Array.from({ length: 14 }, (_, i) => ({ x: `${rnd(i, 21) * 100}%`, y: `${rnd(i, 22) * 34}%`, s: `${1.5 + rnd(i, 23) * 2}px` })), []);
  const heroH = w < 640 ? 500 : 560;

  // Figure: head + hat + body + 2 legs + 1 arm.
  const Person = ({ innerRef, body, hat }: { innerRef: React.RefObject<HTMLDivElement | null>; body: string; hat: string }) => (
    <div ref={innerRef} className="pointer-events-none absolute bottom-[17%] left-0 z-[3] h-[46px] w-[22px] will-change-transform" style={{ transformOrigin: "50% 100%", opacity: 0 }}>
      <div data-leg="1" className="absolute left-[6px] top-[28px] h-[18px] w-1 rounded-sm" style={{ background: "oklch(0.25 0.03 260)", transformOrigin: "top center" }} />
      <div data-leg="2" className="absolute left-[12px] top-[28px] h-[18px] w-1 rounded-sm" style={{ background: "oklch(0.25 0.03 260)", transformOrigin: "top center" }} />
      <div className="absolute left-[5px] top-[11px] h-[19px] w-3" style={{ borderRadius: "5px 5px 2px 2px", background: body }} />
      <div className="absolute left-[6px] top-[1px] h-2.5 w-2.5 rounded-full" style={{ background: "oklch(0.76 0.07 55)" }} />
      <div className="absolute left-[5px] top-[-1px] h-[5px] w-3" style={{ borderRadius: "6px 6px 1px 1px", background: hat }} />
      <div data-arm="1" className="absolute left-3 top-3 h-[14px] w-1 rounded-sm" style={{ background: body, transformOrigin: "2px 2px" }}>
        <div className="absolute bottom-[-3px] left-0 h-1 w-1 rounded-full" style={{ background: "oklch(0.76 0.07 55)" }} />
      </div>
    </div>
  );

  return (
    <section className="relative overflow-hidden" style={{ height: heroH, background: TH.sky }}>
      <div ref={sunRef} className="absolute left-[74%] top-0 -ml-[75px] h-[150px] w-[150px] rounded-full will-change-transform" style={{ background: "radial-gradient(circle, oklch(0.98 0.07 90) 0%, oklch(0.93 0.13 75) 45%, oklch(0.85 0.15 60 / 0) 72%)" }} />
      <div ref={glowRef} className="pointer-events-none absolute left-0 right-0 top-[30%] h-[60%]" style={{ background: "radial-gradient(ellipse 60% 50% at 74% 60%, oklch(0.92 0.12 70 / .55), transparent 70%)" }} />
      <div className="pointer-events-none absolute inset-0">
        {stars.map((st, i) => <span key={i} ref={(el) => { starEls.current[i] = el; }} className="absolute rounded-full bg-white opacity-70" style={{ left: st.x, top: st.y, width: st.s, height: st.s }} />)}
      </div>
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} ref={(el) => { birdEls.current[i] = el; }} className="pointer-events-none absolute left-0 top-0 z-[2] h-[10px] will-change-transform" style={{ width: `${14 + (i % 3) * 5}px` }}>
          <span data-wl="1" className="absolute right-1/2 top-1 h-[2px] w-[52%] rounded-[2px]" style={{ background: "oklch(0.26 0.04 200)", transformOrigin: "right center" }} />
          <span data-wr="1" className="absolute left-1/2 top-1 h-[2px] w-[52%] rounded-[2px]" style={{ background: "oklch(0.26 0.04 200)", transformOrigin: "left center" }} />
        </div>
      ))}
      <div ref={ridgeBackRef} className="absolute -left-[5%] -right-[5%] bottom-[22%] h-[38%] opacity-75 will-change-transform" style={{ background: TH.r1, clipPath: "polygon(0 100%,0 62%,9% 48%,17% 58%,27% 30%,36% 50%,44% 40%,55% 12%,63% 38%,72% 28%,82% 52%,91% 36%,100% 50%,100% 100%)" }} />
      <div ref={ridgeFrontRef} className="absolute -left-[5%] -right-[5%] bottom-[12%] h-[34%] will-change-transform" style={{ background: TH.r2, clipPath: "polygon(0 100%,0 55%,8% 62%,18% 40%,24% 52%,33% 22%,40% 44%,50% 34%,58% 56%,68% 26%,76% 46%,86% 30%,94% 54%,100% 44%,100% 100%)" }} />
      {layers.map((L, li) => (
        <div key={li} className="pointer-events-none absolute left-0 right-0" style={{ bottom: L.bottom, height: L.h, opacity: L.op }}>
          <div ref={(el) => { layerEls.current[li] = el; }} className="absolute bottom-0 left-0 top-0 w-[200%] will-change-transform">
            {L.clouds.map((c, i) => <span key={i} className="absolute rounded-full" style={{ left: c.x, bottom: c.y, width: c.w, height: c.h, background: c.bg, filter: `blur(${c.blur})` }} />)}
          </div>
        </div>
      ))}
      {Array.from({ length: 18 }, (_, i) => <span key={i} ref={(el) => { moteEls.current[i] = el; }} className="pointer-events-none absolute left-0 top-0 z-[2] rounded-full opacity-0 will-change-transform" style={{ width: `${2 + (i % 4)}px`, height: `${2 + (i % 4)}px`, background: TH.mote, boxShadow: `0 0 8px ${TH.mote}` }} />)}

      {/* khói phanh */}
      {Array.from({ length: 10 }, (_, i) => <span key={i} ref={(el) => { smokeEls.current[i] = el; }} className="pointer-events-none absolute bottom-[17%] left-0 z-[3] h-[26px] w-[26px] rounded-full opacity-0 will-change-transform" style={{ background: "radial-gradient(circle, oklch(0.92 0.005 200 / .95), oklch(0.8 0.01 200 / .6) 55%, transparent 72%)", filter: "blur(1.5px)" }} />)}

      {/* homestay */}
      <div ref={houseRef} className="pointer-events-none absolute bottom-[17%] left-0 z-[1] h-24 w-[130px] will-change-transform">
        <div className="absolute left-0 top-0 h-[38px] w-[130px]" style={{ background: "oklch(0.36 0.06 45)", clipPath: "polygon(4% 100%, 50% 0, 96% 100%)" }} />
        <div className="absolute left-3 top-9 h-[60px] w-[106px]" style={{ background: "oklch(0.6 0.08 60)" }} />
        <div className="absolute left-3 top-9 h-[60px] w-[106px]" style={{ background: "repeating-linear-gradient(90deg, transparent 0 9px, oklch(0.5 0.07 55 / .5) 9px 10px)" }} />
        <div className="absolute left-[34px] top-10 h-[11px] w-[62px] rounded-sm text-center text-[6.5px] font-black leading-[11px] tracking-wide" style={{ background: "oklch(0.3 0.05 45)", color: "oklch(0.95 0.03 90)" }}>HOMESTAY</div>
        <div ref={winRef} className="absolute left-5 top-14 h-4 w-5 rounded-sm" style={{ border: "2px solid oklch(0.35 0.05 45)", background: "oklch(0.32 0.03 230)" }} />
        <div ref={win2Ref} className="absolute left-[88px] top-14 h-4 w-5 rounded-sm" style={{ border: "2px solid oklch(0.35 0.05 45)", background: "oklch(0.32 0.03 230)" }} />
        <div className="absolute left-[50px] top-[58px] h-[38px] w-6" style={{ borderRadius: "3px 3px 0 0", background: "oklch(0.85 0.12 80)", boxShadow: "inset 0 0 10px oklch(0.6 0.14 60)" }} />
        <div ref={hDoorRef} className="absolute left-[50px] top-[58px] h-[38px] w-6 will-change-transform" style={{ borderRadius: "3px 3px 0 0", background: "oklch(0.42 0.07 45)", border: "2px solid oklch(0.32 0.05 45)", transformOrigin: "left center" }}>
          <div className="absolute right-[3px] top-[18px] h-[3px] w-[3px] rounded-full" style={{ background: "oklch(0.85 0.12 85)" }} />
        </div>
        <div className="absolute left-1.5 top-[93px] h-[3px] w-[118px]" style={{ background: "oklch(0.3 0.04 45)" }} />
      </div>

      {/* xe cabin */}
      <div ref={busRef} className="pointer-events-none absolute bottom-[17%] left-0 z-[2] h-[58px] w-[150px] will-change-transform" style={{ transformOrigin: "70% 100%" }}>
        <div className="absolute left-[146px] top-[26px] h-5 w-[140px] blur-[2px]" style={{ background: "linear-gradient(90deg, oklch(0.97 0.1 90 / .55), transparent)", clipPath: "polygon(0 35%,100% 0,100% 100%,0 65%)" }} />
        <div className="absolute left-0 top-0 h-12 w-[150px]" style={{ borderRadius: "9px 22px 7px 7px", background: "oklch(0.68 0.17 50)", boxShadow: "0 8px 18px oklch(0.15 0.03 200 / .45)" }} />
        <div className="absolute left-2 top-[7px] h-[13px] w-24 rounded" style={{ background: "repeating-linear-gradient(90deg, oklch(0.93 0.04 90) 0 14px, oklch(0.5 0.08 50) 14px 17px)" }} />
        <div className="absolute left-2 top-6 h-[11px] w-24 rounded-sm" style={{ background: "repeating-linear-gradient(90deg, oklch(0.4 0.05 230) 0 14px, oklch(0.5 0.08 50) 14px 17px)" }} />
        <div className="absolute left-[132px] top-[6px] h-5 w-[14px]" style={{ borderRadius: "2px 14px 2px 2px", background: "oklch(0.9 0.03 230)" }} />
        <div className="absolute left-[110px] top-[5px] h-[39px] w-5 rounded" style={{ background: "oklch(0.2 0.02 200)" }} />
        <div ref={doorRef} className="absolute left-[110px] top-[5px] h-[39px] w-5 rounded will-change-transform" style={{ background: "oklch(0.86 0.04 230)", border: "2px solid oklch(0.5 0.08 50)" }} />
        <div className="absolute left-[6px] top-[39px] h-0.5 w-[100px]" style={{ background: "oklch(0.35 0.05 160)" }} />
        <div className="absolute right-[-1px] top-8 h-1.5 w-1.5 rounded-full" style={{ background: "oklch(0.98 0.1 95)", boxShadow: "0 0 12px 5px oklch(0.96 0.12 95 / .6)" }} />
        <div className="absolute left-5 top-10 h-[18px] w-[18px] rounded-full" style={{ background: "oklch(0.16 0.01 160)", border: "4px solid oklch(0.8 0.01 160)" }} />
        <div className="absolute left-[100px] top-10 h-[18px] w-[18px] rounded-full" style={{ background: "oklch(0.16 0.01 160)", border: "4px solid oklch(0.8 0.01 160)" }} />
      </div>

      {/* người: chủ nhà + khách (bố, mẹ, bé) */}
      <Person innerRef={hostRef} body="oklch(0.33 0.08 270)" hat="oklch(0.3 0.07 270)" />
      <Person innerRef={dadRef} body="oklch(0.55 0.12 155)" hat="oklch(0.68 0.18 45)" />
      <Person innerRef={momRef} body="oklch(0.62 0.15 15)" hat="oklch(0.9 0.02 90)" />
      <Person innerRef={kidRef} body="oklch(0.6 0.13 250)" hat="oklch(0.68 0.18 45)" />

      <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-[90px]" style={{ background: `linear-gradient(180deg, transparent, ${TH.page})` }} />

      <div ref={heroTextRef} className="container-page relative z-[3] text-white will-change-transform" style={{ paddingTop: w < 640 ? 48 : 72 }}>
        <div data-in-combo="0" className="flex gap-2 text-sm opacity-0" style={{ transform: "translateY(22px)", transition: "opacity .9s ease, transform .9s cubic-bezier(.2,.7,.2,1)", color: "oklch(0.9 0.02 220)" }}><span>Trang chủ</span><span>/</span><span className="font-bold text-white">Combo</span></div>
        <div data-in-combo="1" className="mt-4 text-[13px] font-bold uppercase tracking-[0.14em] opacity-0" style={{ transform: "translateY(22px)", transition: "opacity .9s ease .1s, transform .9s cubic-bezier(.2,.7,.2,1) .1s", color: "oklch(0.88 0.12 80)" }}>Xe cabin + Homestay · trọn gói</div>
        <h1 data-in-combo="2" className="mt-3.5 max-w-[760px] text-[clamp(32px,6vw,60px)] font-extrabold leading-[1.02] tracking-[-0.035em] opacity-0" style={{ transform: "translateY(22px)", transition: "opacity .9s ease .2s, transform .9s cubic-bezier(.2,.7,.2,1) .2s", textShadow: "0 2px 24px oklch(0.2 0.05 260 / .4)" }}>Xe đón tận nơi, homestay đợi sẵn trên mây</h1>
        <p data-in-combo="3" className="mt-3.5 max-w-[520px] text-[clamp(15px,1.7vw,18px)] leading-[1.5] opacity-0" style={{ transform: "translateY(22px)", transition: "opacity .9s ease .3s, transform .9s cubic-bezier(.2,.7,.2,1) .3s", color: "oklch(0.97 0.02 80)" }}>Combo xe cabin khứ hồi + phòng homestay. Chọn ngày, số người và giá mong muốn — tụi mình ghép xe & phòng khớp nhất.</p>
      </div>
    </section>
  );
}
