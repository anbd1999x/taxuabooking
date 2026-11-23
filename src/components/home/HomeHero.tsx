"use client";

import { useEffect, useRef, useState } from "react";
import { WeatherBadge } from "@/components/weather/WeatherBadge";

/**
 * HERO trang chủ — thiết kế "Trang chủ v5" (claude.ai/design project 4ec052fe…, file "Trang chu v5").
 * Ảnh biển mây Tà Xùa + màn mây mở sang hai bên khi vào trang, sương trôi, vệt nắng, biển mây cuộn dưới đáy,
 * chữ hiện từng dòng; cuộn trang ⇒ ảnh trôi chậm (parallax), chữ mờ dần. Tôn trọng prefers-reduced-motion.
 */

const blob = (arr: number[][]) => arr.map(([x, y, w, h]) => ({ left: `${x}%`, bottom: `${y}%`, top: `${y}%`, width: `${w}%`, height: `${h}%` }));
const SEA = blob([[-8, 6, 30, 70], [14, 20, 28, 60], [34, 0, 32, 80], [56, 16, 26, 62], [74, 2, 32, 78], [90, 18, 26, 60], [4, -14, 40, 70], [44, -18, 40, 70], [80, -16, 40, 70], [60, 40, 18, 36]]);
const CURTAIN_L = blob([[10, 0, 70, 40], [30, 25, 75, 45], [0, 45, 80, 45], [35, 65, 70, 45], [55, 10, 50, 35], [60, 45, 45, 35], [15, 80, 70, 30]]);
const CURTAIN_R = blob([[20, 0, 70, 40], [-5, 25, 75, 45], [20, 45, 80, 45], [-5, 65, 70, 45], [-5, 10, 50, 35], [-5, 45, 45, 35], [15, 80, 70, 30]]);
const MISTS = [["38%", "22%", 0.35], ["54%", "20%", 0.45], ["70%", "24%", 0.55]] as const;
/** Mây lửng lơ phần dưới banner: [top %, rộng px, thời gian trôi s, lệch pha s, độ đậm]. Lệch pha âm ⇒ vào trang đã có mây rải khắp khung. */
const FLOATS = [
  [56, 220, 78, -10, 0.75],
  [63, 150, 62, -38, 0.6],
  [70, 260, 95, -62, 0.85],
  [60, 120, 54, -24, 0.5],
  [74, 190, 84, -5, 0.8],
  [67, 170, 70, -50, 0.65],
] as const;
const PUFF = "radial-gradient(closest-side, oklch(1 0 0 / .95), oklch(0.98 0.01 210 / .75) 55%, oklch(0.97 0.01 210 / 0))";
const CURTAIN_BG = "radial-gradient(ellipse at 50% 45%, oklch(1 0 0) 34%, oklch(0.97 0.01 200 / .9) 58%, oklch(0.96 0.01 200 / 0) 72%)";

export function HomeHero({
  eyebrow,
  coords,
  lead,
  rest,
  sub,
  season,
  chips,
  alt,
  cue,
}: {
  eyebrow: string;
  coords: string;
  lead: string;
  rest: string;
  sub: string;
  season: string;
  chips: string[];
  alt: string;
  cue: string;
}) {
  const heroRef = useRef<HTMLElement>(null);
  const bgRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const cloudL = useRef<HTMLDivElement>(null);
  const cloudR = useRef<HTMLDivElement>(null);
  const cloudC = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  // Chữ tiêu đề trồi lên xong ⇒ bỏ overflow-hidden của từng dòng (giữ lại sẽ cắt bóng chữ thành mảng tối hình chữ nhật).
  const [titleDone, setTitleDone] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setTitleDone(true), 3200);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return;
    const R = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const id = requestAnimationFrame(() => setShown(true));
    const cl = (v: number) => Math.max(0, Math.min(1, v));
    const io = (v: number) => (v < 0.5 ? 4 * v * v * v : 1 - Math.pow(-2 * v + 2, 3) / 2);
    const mists = hero.querySelectorAll<HTMLElement>("[data-mist]");
    const seas = hero.querySelectorAll<HTMLElement>("[data-sea]");
    const glare = hero.querySelector<HTMLElement>("[data-glare]");
    const cueEl = hero.querySelector<HTMLElement>("[data-cue]");
    const t0 = performance.now();
    let raf = 0;

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const t = (now - t0) / 1000;
      const sy = window.scrollY || 0;
      const hh = hero.offsetHeight;
      if (sy > hh * 1.2 && t > 4) return; // đã cuộn qua hero ⇒ nghỉ cho nhẹ máy
      const intro = R ? 1 : io(cl((t - 0.15) / 3.2));
      const p = cl(sy / (hh * 0.85));
      if (cloudC.current) cloudC.current.style.opacity = String(R ? 0 : 1 - io(cl((t - 0.05) / 1.8)));
      // Màn mây: từ giữa tách ra 2 bên, trôi hẳn khỏi khung và mờ hết — không đọng lại ở mép.
      const open = intro * 1.2;
      const cOp = 1 - cl((intro - 0.35) / 0.65);
      const sc = 1.08 + intro * 0.12;
      [cloudL.current, cloudR.current].forEach((el, i) => {
        if (!el) return;
        if (cOp <= 0) {
          el.style.display = "none";
          return;
        }
        el.style.transform = `translate3d(${(i ? 1 : -1) * open * 80}%, 0, 0) scale(${sc})`;
        el.style.opacity = String(cOp);
      });
      const kb = R ? 0 : 0.5 + 0.5 * Math.sin(t * 0.09);
      if (bgRef.current)
        bgRef.current.style.transform = `translate3d(${R ? 0 : Math.sin(t * 0.05) * 1.6}%, ${sy * 0.4}px, 0) scale(${1.08 - intro * 0.08 + p * 0.06 + kb * 0.04})`;
      mists.forEach((m, i) => {
        m.style.transform = `translate3d(${R ? 0 : Math.sin(t * 0.06 + i * 2.1) * 10}%, ${-sy * 0.12 * (i + 1)}px, 0)`;
        m.style.opacity = String(R ? 0.6 : 0.55 + 0.35 * Math.sin(t * 0.25 + i * 1.7));
      });
      if (glare) glare.style.opacity = String(R ? 0.6 : 0.55 + 0.25 * Math.sin(t * 0.4));
      if (cueEl) cueEl.style.transform = `translateY(${((t * 0.8) % 1) * 60 - 16}px)`;
      if (textRef.current) {
        textRef.current.style.transform = `translate3d(0, ${sy * 0.25}px, 0)`;
        textRef.current.style.opacity = String(1 - cl(p * 1.3));
      }
      if (!R) {
        seas.forEach((c, i) => {
          c.style.transform = `translate3d(${Math.sin(t * 0.18 + i * 1.3) * 30}px, ${Math.sin(t * 0.3 + i) * 5 - sy * 0.1}px, 0)`;
        });
      }
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      cancelAnimationFrame(id);
    };
  }, []);

  const fadeIn = (delay: number, dy = 16): React.CSSProperties => ({
    opacity: shown ? 1 : 0,
    transform: shown ? "none" : `translateY(${dy}px)`,
    transition: `opacity 1s ${delay}s, transform 1s ${delay}s`,
  });
  const lines = [
    { t: lead, c: "white" },
    ...(rest ? [{ t: rest, c: "oklch(0.86 0.12 78)" }] : []),
  ];

  return (
    <section
      ref={heroRef}
      className="relative h-[88vh] min-h-[640px] overflow-hidden min-[760px]:h-[92vh]"
      style={{ background: "oklch(0.35 0.04 200)" }}
    >
      {/* Ảnh nền */}
      <div ref={bgRef} className="absolute -inset-x-[4%] -inset-y-[8%] will-change-transform">
        <picture>
          <source media="(max-width: 759px)" srcSet="/hero-taxua-v5-m.jpg?v=1" />
          <img src="/hero-taxua-v5.jpg?v=1" alt={alt} fetchPriority="high" decoding="async" className="h-full w-full object-cover object-[50%_60%]" />
        </picture>
      </div>
      {/* lớp phủ cho chữ dễ đọc */}
      <div
        className="pointer-events-none absolute inset-0 max-[1079px]:hidden"
        style={{
          background:
            "linear-gradient(90deg, oklch(0.18 0.03 180 / .72) 0%, oklch(0.18 0.03 180 / .4) 45%, oklch(0.18 0.03 180 / .05) 75%), linear-gradient(180deg, oklch(0.15 0.03 180 / .45) 0%, transparent 25%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 min-[1080px]:hidden"
        style={{
          background:
            "linear-gradient(180deg, oklch(0.15 0.03 180 / .5) 0%, oklch(0.15 0.03 180 / .05) 30%, oklch(0.15 0.03 180 / .25) 55%, oklch(0.15 0.03 180 / .7) 100%)",
        }}
      />
      {/* vệt nắng */}
      <div
        data-glare
        className="pointer-events-none absolute -right-[10%] -top-[20%] h-[70%] w-[70%] mix-blend-screen"
        // closest-side: mờ hết TRƯỚC mép khung (khung cao trên mobile từng lộ mép trái thành sọc thẳng ~40% chiều ngang)
        style={{ background: "radial-gradient(closest-side, oklch(0.97 0.08 85 / .55), oklch(0.95 0.1 75 / 0) 100%)" }}
      />
      {/* sương trôi ngang */}
      {MISTS.map(([top, h, a], i) => (
        <div
          key={i}
          data-mist
          className="pointer-events-none absolute -left-[30%] w-[160%] rounded-full blur-[18px] will-change-transform"
          style={{ top, height: h, background: `radial-gradient(ellipse at 50% 50%, oklch(1 0 0 / ${a}), transparent 68%)` }}
        />
      ))}
      {/* biển mây cuộn dưới đáy */}
      <div className="pointer-events-none absolute inset-x-0 -bottom-[6%] h-[38%]">
        {SEA.map((c, i) => (
          <div
            key={i}
            data-sea
            className="absolute rounded-full blur-[12px]"
            style={{
              left: c.left,
              bottom: c.bottom,
              width: c.width,
              height: c.height,
              background: "radial-gradient(ellipse at 50% 42%, oklch(1 0 0 / .9) 28%, oklch(0.97 0.01 200 / .6) 56%, oklch(0.96 0.01 200 / 0) 72%)",
            }}
          />
        ))}
      </div>

      {/* mây lửng lơ trôi ngang phần dưới banner (CSS animation, nhẹ máy) */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        {FLOATS.map(([top, w, dur, delay, a], i) => (
          <div
            key={i}
            className="tx-cloud-drift absolute left-0"
            style={{ top: `${top}%`, width: w, height: w * 0.42, ["--dur" as string]: `${dur}s`, animationDelay: `${delay}s` }}
          >
            <div className="tx-cloud-bob relative h-full w-full blur-[5px]" style={{ ["--bob" as string]: `${6 + (i % 3) * 1.5}s`, animationDelay: `${-i * 1.3}s`, opacity: a }}>
              <span className="absolute bottom-0 left-0 h-[55%] w-full" style={{ background: PUFF }} />
              <span className="absolute bottom-[22%] left-[12%] h-[62%] w-[34%]" style={{ background: PUFF }} />
              <span className="absolute bottom-[25%] left-[34%] h-[78%] w-[40%]" style={{ background: PUFF }} />
              <span className="absolute bottom-[18%] left-[60%] h-[55%] w-[30%]" style={{ background: PUFF }} />
            </div>
          </div>
        ))}
      </div>

      {/* Chữ */}
      <div ref={textRef} className="pointer-events-none absolute inset-0 will-change-transform">
        <div className="mx-auto flex h-full max-w-[1240px] flex-col justify-end px-[clamp(16px,4vw,40px)] pb-[150px] pt-[110px] text-white min-[760px]:pb-[120px] min-[1080px]:justify-center">
          <div className="flex flex-wrap items-center gap-3.5 text-xs font-extrabold uppercase tracking-[.2em]" style={{ ...fadeIn(1.3), textShadow: "0 1px 10px oklch(0.15 0.03 180 / .6)" }}>
            <h1 className="m-0 text-[length:inherit] font-[inherit] tracking-[inherit]">{eyebrow}</h1>
            <span className="hidden items-center gap-2.5 font-mono font-medium tracking-[.1em] opacity-70 min-[1080px]:flex">
              <span className="h-px w-[60px] bg-current" />
              {coords}
            </span>
          </div>
          <p
            className="mt-4 max-w-[820px] text-[clamp(42px,6.6vw,84px)] font-extrabold leading-[1.02] tracking-[-.035em]"
            style={{ textShadow: "0 4px 30px oklch(0.15 0.03 180 / .45)" }}
          >
            {lines.map((l, i) => (
              <span key={i} className={`-mb-[.1em] block pb-[.1em] ${titleDone ? "overflow-visible" : "overflow-hidden"}`}>
                <span
                  className="block origin-[0_100%] text-balance"
                  style={{
                    color: l.c,
                    transform: shown ? "none" : "translateY(110%) rotate(3deg)",
                    transition: `transform 1.2s cubic-bezier(.2,.8,.2,1) ${1.45 + i * 0.14}s`,
                  }}
                >
                  {l.t}
                </span>
              </span>
            ))}
          </p>
          <p className="mt-[18px] max-w-[500px] text-[clamp(15px,1.4vw,17px)] leading-relaxed" style={{ ...fadeIn(1.8), color: "oklch(0.96 0.01 160)", textShadow: "0 1px 12px oklch(0.15 0.03 180 / .6)" }}>
            {sub}
          </p>
          <div className="mt-[18px] flex flex-wrap items-center gap-x-3.5 gap-y-2 text-xs font-bold" style={{ ...fadeIn(2, 12), textShadow: "0 1px 8px oklch(0.15 0.03 180 / .6)" }}>
            <span className="rounded-full border border-white/50 px-3 py-1.5 uppercase tracking-[.08em]">{season}</span>
            {chips.map((c) => (
              <span key={c} className="flex items-center gap-2 whitespace-nowrap">
                <span className="h-1 w-1 rounded-full" style={{ background: "oklch(0.86 0.12 78)" }} />
                {c}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Màn mây mở ra khi vào trang */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div ref={cloudL} className="absolute -left-[12%] -top-[10%] h-[130%] w-[62%] will-change-transform" style={{ transform: "scale(1.08)" }}>
          {CURTAIN_L.map((c, i) => (
            <div key={i} data-cb className="absolute rounded-full blur-[14px]" style={{ left: c.left, top: c.top, width: c.width, height: c.height, background: CURTAIN_BG }} />
          ))}
        </div>
        <div ref={cloudR} className="absolute -right-[12%] -top-[10%] h-[130%] w-[62%] will-change-transform" style={{ transform: "scale(1.08)" }}>
          {CURTAIN_R.map((c, i) => (
            <div key={i} data-cb className="absolute rounded-full blur-[14px]" style={{ left: c.left, top: c.top, width: c.width, height: c.height, background: CURTAIN_BG }} />
          ))}
        </div>
        <div
          ref={cloudC}
          className="absolute inset-0"
          style={{ background: "radial-gradient(ellipse 70% 60% at 50% 50%, oklch(0.99 0.005 200), oklch(0.97 0.01 200 / .92) 60%, oklch(0.96 0.01 200 / .5))" }}
        />
      </div>
      {/* hoà vào nền trời phía dưới */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-[34%]"
        style={{ background: "linear-gradient(180deg, oklch(0.955 0.022 225 / 0) 0%, oklch(0.955 0.022 225 / .55) 55%, oklch(0.955 0.022 225) 100%)" }}
      />
      {/* Thời tiết: mặt trời cười (ngày) / trăng ngủ (đêm) — bấm xem dự báo */}
      <div className="absolute right-[clamp(16px,4vw,40px)] top-[68px] z-[5] origin-top-right max-sm:scale-[.67] lg:top-[88px]">
        <WeatherBadge />
      </div>
      {/* gợi ý cuộn (màn hẹp) */}
      <div className="pointer-events-none absolute bottom-[118px] right-[clamp(16px,4vw,40px)] z-[3] flex flex-col items-center gap-2 text-white min-[1080px]:hidden" aria-hidden>
        <span className="text-[10px] font-extrabold tracking-[.3em] [writing-mode:vertical-rl]">{cue}</span>
        <span className="relative h-11 w-px overflow-hidden bg-white/30">
          <span data-cue className="absolute left-0 top-0 h-4 w-px bg-white" />
        </span>
      </div>
    </section>
  );
}
