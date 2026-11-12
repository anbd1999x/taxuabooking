"use client";

import { useEffect, useRef } from "react";

// ── Dữ liệu trang trí cố định (sinh 1 lần, giống nhau ở server & client) ──────
const STARS = Array.from({ length: 18 }, (_, i) => ({ x: `${(i * 53 + 17) % 97}%`, y: `${(i * 29 + 5) % 34}%`, s: 1.4 + (i % 3) * 0.8 }));
const BIRDS = Array.from({ length: 5 }, (_, i) => 12 + (i % 3) * 5);
const round = (v: number) => Math.round(v * 100) / 100;
/** 3 dải mây (xa → gần); mỗi dải lặp 2 nửa giống nhau để trôi vòng liền mạch. */
const CLOUD_BANDS = [0, 1, 2].map((li) => {
  const n = [8, 9, 11][li];
  const half = Array.from({ length: n }, (_, i) => {
    const r = (k: number) => { const x = Math.sin((i + 1) * 12.9898 + (li + k) * 78.233) * 43758.5453; return x - Math.floor(x); };
    return { x: (i / n) * 50 + r(1) * 3, y: r(2) * 30, w: [16, 20, 26][li] + r(3) * 12, h: [60, 90, 130][li] + r(4) * 50 };
  });
  return [...half, ...half.map((c) => ({ ...c, x: c.x + 50 }))].map((c) => ({ x: `${round(c.x - 6)}%`, y: `${round(c.y)}%`, w: `${round(c.w / 2)}%`, h: Math.round(c.h) }));
});
const BAND_STYLE = [
  { bottom: "44%", height: "16%", opacity: 0.75, blur: 14 },
  { bottom: "26%", height: "20%", opacity: 0.9, blur: 12 },
  { bottom: "-6%", height: "26%", opacity: 0.95, blur: 10 },
];
const ROAD = "M 520 640 C 650 584, 760 520, 900 510 S 1100 470, 1200 442 S 1380 402, 1500 408";

/**
 * Nền banner trang chủ dạng HOẠT HÌNH (thay ảnh): chu kỳ ngày–đêm (đêm sao → bình minh → ban ngày →
 * hoàng hôn), mặt trời đi theo cung, chim bay, xe cabin & xe máy kéo cờ "ĐI TÀ XÙA THÔI!",
 * 4 lớp núi parallax theo cuộn trang, 3 dải mây trôi, xe cabin & xe máy chạy trên đường đèo.
 * Vẽ bằng requestAnimationFrame qua ref (không setState mỗi khung hình); tôn trọng reduced-motion.
 */
export function HeroScene() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = root.current;
    if (!host) return;
    const reduce = !!window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const sun = host.querySelector<HTMLElement>("[data-sun]");
    const glow = host.querySelector<HTMLElement>("[data-glow]");
    const dawnEl = host.querySelector<HTMLElement>("[data-dawn]");
    const dayEl = host.querySelector<HTMLElement>("[data-day]");
    const tint = host.querySelector<HTMLElement>("[data-tint]");
    const svg = host.querySelector<SVGSVGElement>("svg");
    // Màn hẹp: neo cảnh về bên phải để vẫn thấy đường đèo và xe.
    const fit = () => svg?.setAttribute("preserveAspectRatio", window.innerWidth < 760 ? "xMaxYMid slice" : "xMidYMax slice");
    fit();
    window.addEventListener("resize", fit);
    const stars = [...host.querySelectorAll<HTMLElement>("[data-star]")];
    const layers = [...host.querySelectorAll<SVGGElement>("[data-layer]")];
    const bands = [...host.querySelectorAll<HTMLElement>("[data-band]")];
    const birds = [...host.querySelectorAll<HTMLElement>("[data-bird]")];
    const road = host.querySelector<SVGPathElement>("[data-road]");
    const bus = host.querySelector<SVGGElement>("[data-bus]");
    const bike = host.querySelector<SVGGElement>("[data-bike]");
    const SP = [0.5, 0.9, 1.4];
    const t0 = performance.now();
    let raf = 0;

    const CYCLE = 10; // giây cho một vòng đêm → bình minh → ngày → hoàng hôn
    const sm = (x: number) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };

    const tick = (t: number) => {
      const sy = window.scrollY || 0;
      const H = host.offsetHeight, W = host.offsetWidth;
      const ph = reduce ? 0.5 : (0.5 + t / CYCLE) % 1; // pha trong ngày (0.5 = giữa trưa)
      const band = (p: number, q: number, r: number, u: number) => sm((ph - p) / (q - p)) * (1 - sm((ph - r) / (u - r)));
      const light = band(0.12, 0.42, 0.6, 0.88);
      const dawn = band(0.08, 0.22, 0.3, 0.42) + band(0.58, 0.7, 0.78, 0.9);
      const day = band(0.28, 0.42, 0.58, 0.7);
      if (dawnEl) dawnEl.style.opacity = String(Math.min(1, dawn));
      if (dayEl) dayEl.style.opacity = String(day);
      if (tint) tint.style.opacity = String(0.55 * (1 - light));
      const arc = Math.sin(Math.PI * Math.max(0, Math.min(1, (ph - 0.1) / 0.8)));
      if (sun) {
        sun.style.transform = `translate(${(ph - 0.5) * W * 0.5}px, ${H * (0.62 - 0.46 * arc) + sy * 0.3}px) scale(${1 - 0.18 * day})`;
        sun.style.opacity = String(sm(arc * 4));
      }
      if (glow) glow.style.opacity = String(Math.min(1, dawn * 1.1 + day * 0.35));
      stars.forEach((el, i) => { el.style.opacity = String(Math.max(0, (1 - sm(light * 2.2)) * (0.75 + 0.2 * Math.sin(t * 2 + i)))); });
      layers.forEach((g, i) => { g.style.transform = `translateY(${sy * (0.22 - i * 0.05)}px)`; });
      bands.forEach((el, i) => { el.style.transform = `translate3d(${reduce ? 0 : -((t * SP[i]) % 50)}%, ${Math.sin(t * 0.4 + i) * 3 - sy * (0.05 + i * 0.03)}px, 0)`; });
      if (reduce) return;
      birds.forEach((el, i) => {
        const f = ((t * (0.028 + i * 0.005) + i * 0.21) % 1.3) - 0.15;
        el.style.transform = `translate(${f * W}px, ${H * (0.14 + (i % 3) * 0.06) + Math.sin(t * 0.9 + i) * 8}px) scaleY(${0.7 + Math.abs(Math.sin(t * 6 + i)) * 0.6})`;
      });
      if (!road) return;
      const L = road.getTotalLength();
      const place = (g: SVGGElement | null, pos: number, flip: boolean) => {
        if (!g) return;
        const d = L * pos;
        const p0 = road.getPointAtLength(Math.max(0, d - 6)), p1 = road.getPointAtLength(Math.min(L, d + 6)), p = road.getPointAtLength(d);
        const ang = (Math.atan2(p1.y - p0.y, p1.x - p0.x) * 180) / Math.PI;
        g.setAttribute("transform", `translate(${p.x} ${p.y + Math.sin(t * 20) * 0.5}) rotate(${ang}) scale(${flip ? -1 : 1} 1)`);
        g.style.opacity = pos < 0.02 || pos > 0.98 ? "0" : "1";
        // lá cờ "ĐI TÀ XÙA THÔI!" phấp phới sau xe
        const flag = g.querySelector("[data-flag]");
        if (flag) flag.setAttribute("transform", `rotate(${Math.sin(t * 6 + (flip ? 1.5 : 0)) * 2.2} ${flip ? -11 : -33} -18)`);
      };
      place(bus, (t * 0.045) % 1, false);
      place(bike, 1 - ((t * 0.07 + 0.4) % 1), true);
    };

    const loop = (now: number) => {
      tick((now - t0) / 1000);
      if (!reduce) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    // reduced-motion: không chạy vòng lặp nhưng vẫn cập nhật parallax khi cuộn
    const onScroll = () => { if (reduce) tick(0); };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { cancelAnimationFrame(raf); window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", fit); };
  }, []);

  return (
    <div ref={root} aria-hidden className="absolute inset-0 -z-10 overflow-hidden">
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ background: "linear-gradient(180deg, oklch(0.16 0.04 265) 0%, oklch(0.22 0.05 262) 45%, oklch(0.3 0.05 255) 100%)" }}
      >
        {/* trời bình minh / hoàng hôn và trời ban ngày — hiện dần theo chu kỳ ngày đêm */}
        <div data-dawn className="absolute inset-0" style={{ opacity: 0, background: "linear-gradient(180deg, oklch(0.4 0.07 265) 0%, oklch(0.58 0.09 310) 32%, oklch(0.77 0.12 38) 56%, oklch(0.88 0.1 70) 74%, oklch(0.93 0.05 85) 100%)" }} />
        <div data-day className="absolute inset-0" style={{ opacity: 1, background: "linear-gradient(180deg, oklch(0.6 0.11 240) 0%, oklch(0.75 0.08 230) 40%, oklch(0.88 0.04 215) 70%, oklch(0.95 0.02 200) 100%)" }} />
        {STARS.map((s, i) => (
          <span key={i} data-star className="absolute rounded-full bg-white" style={{ left: s.x, top: s.y, width: s.s, height: s.s, opacity: 0 }} />
        ))}
        <div
          data-glow
          className="pointer-events-none absolute left-1/2 top-[20%] h-[90%] w-[110%]"
          style={{ transform: "translateX(-30%)", background: "radial-gradient(ellipse 45% 40% at 62% 62%, oklch(0.95 0.12 75 / .75), oklch(0.9 0.12 60 / 0) 70%)" }}
        />
        <div
          data-sun
          className="absolute left-[66%] top-0 -ml-[60px] h-[120px] w-[120px] rounded-full will-change-transform"
          style={{
            transform: "translateY(110px)",
            background: "radial-gradient(circle, oklch(0.99 0.05 95) 0 52%, oklch(0.95 0.12 80) 70%, oklch(0.92 0.13 70 / 0) 72%)",
            boxShadow: "0 0 90px 40px oklch(0.95 0.13 75 / .45)",
          }}
        />
        {BIRDS.map((w, i) => (
          <div key={i} data-bird className="absolute left-0 top-0 h-2 will-change-transform" style={{ width: w, transform: "translate(-200px, 0)" }}>
            <span className="absolute left-0 top-[3px] h-[1.6px] w-[52%] rounded-sm" style={{ background: "oklch(0.3 0.04 280)", transform: "rotate(18deg)", transformOrigin: "right center" }} />
            <span className="absolute right-0 top-[3px] h-[1.6px] w-[52%] rounded-sm" style={{ background: "oklch(0.3 0.04 280)", transform: "rotate(-18deg)", transformOrigin: "left center" }} />
          </div>
        ))}
        <svg viewBox="0 0 1440 680" preserveAspectRatio="xMidYMax slice" className="pointer-events-none absolute inset-0 h-full w-full">
          <defs>
            <linearGradient id="hxFar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="oklch(0.62 0.07 300)" /><stop offset="1" stopColor="oklch(0.8 0.07 40)" /></linearGradient>
            <linearGradient id="hxMid" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="oklch(0.5 0.07 285)" /><stop offset="1" stopColor="oklch(0.72 0.07 30)" /></linearGradient>
            <linearGradient id="hxNear" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="oklch(0.42 0.07 175)" /><stop offset="1" stopColor="oklch(0.26 0.045 165)" /></linearGradient>
            <linearGradient id="hxFront" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="oklch(0.34 0.06 165)" /><stop offset="1" stopColor="oklch(0.18 0.035 165)" /></linearGradient>
          </defs>
          <g data-layer><path d="M 0 680 L 0 330 C 60 300, 110 262, 170 264 C 240 266, 270 318, 330 314 C 400 310, 430 230, 500 226 C 570 222, 600 300, 670 296 C 740 292, 770 246, 840 244 C 910 242, 940 304, 1010 300 C 1080 296, 1120 214, 1190 210 C 1260 206, 1290 276, 1350 272 C 1400 268, 1420 250, 1440 248 L 1440 680 Z" fill="url(#hxFar)" /></g>
          <g data-layer><path d="M 0 680 L 0 410 C 80 380, 140 352, 210 356 C 290 360, 320 404, 400 400 C 480 396, 520 342, 600 340 C 680 338, 710 392, 790 390 C 870 388, 910 350, 990 352 C 1070 354, 1100 404, 1180 400 C 1260 396, 1300 350, 1370 348 C 1410 347, 1430 356, 1440 360 L 1440 680 Z" fill="url(#hxMid)" /></g>
          <g data-layer><path d="M 0 680 L 0 480 C 90 460, 170 446, 250 452 C 340 459, 380 500, 460 506 C 540 512, 600 482, 680 486 C 760 490, 800 530, 880 532 L 880 680 Z" fill="url(#hxNear)" /></g>
          <g data-layer>
            <path d="M 380 680 C 470 650, 560 610, 660 568 C 760 526, 820 500, 920 496 C 1020 492, 1080 466, 1180 438 C 1280 410, 1360 392, 1440 396 L 1440 680 Z" fill="url(#hxFront)" />
            <path d={ROAD} fill="none" stroke="oklch(0.2 0.02 60)" strokeWidth={15} strokeLinecap="round" transform="translate(0,14)" />
            <path d={ROAD} fill="none" stroke="oklch(0.62 0.04 65)" strokeWidth={10} strokeLinecap="round" transform="translate(0,12)" />
            <path data-road d={ROAD} fill="none" stroke="none" />
            <g data-bus style={{ opacity: 0 }}>
              <g data-flag>
                <path d="M -33 -19.5 L -44 -25 M -33 -19.5 L -44 -14" stroke="oklch(0.35 0.02 60)" strokeWidth={0.8} fill="none" />
                <rect x="-118" y="-27" width="74" height="15" rx="1.5" fill="oklch(0.68 0.18 45)" />
                <rect x="-118" y="-27" width="74" height="15" rx="1.5" fill="none" stroke="oklch(0.98 0.02 90)" strokeWidth={0.8} />
                <text x="-81" y="-16.764" textAnchor="middle" fontSize="7.6" fontWeight={800} letterSpacing=".3" fill="white">ĐI TÀ XÙA THÔI!</text>
              </g>
              <ellipse cx="0" cy="1" rx="34" ry="3" fill="oklch(0.1 0.02 160 / .35)" />
              <rect x="-32" y="-26" width="64" height="22" rx="6" fill="oklch(0.95 0.008 90)" />
              <rect x="-32" y="-12" width="64" height="4" fill="oklch(0.66 0.17 45)" />
              <rect x="-28" y="-23" width="44" height="8" rx="2" fill="oklch(0.3 0.03 240)" />
              <rect x="19" y="-23" width="11" height="10" rx="2" fill="oklch(0.42 0.04 235)" />
              <circle cx="-20" cy="-3" r="5" fill="oklch(0.2 0.01 250)" /><circle cx="20" cy="-3" r="5" fill="oklch(0.2 0.01 250)" />
              <circle cx="32" cy="-9" r="2" fill="oklch(0.98 0.1 95)" />
            </g>
            <g data-bike style={{ opacity: 0 }}>
              <g data-flag>
                <path d="M -11 -18.5 L -22 -22 M -11 -18.5 L -22 -15" stroke="oklch(0.35 0.02 60)" strokeWidth={0.8} fill="none" />
                <rect x="-78" y="-24" width="56" height="11" rx="1.5" fill="oklch(0.68 0.18 45)" />
                <rect x="-78" y="-24" width="56" height="11" rx="1.5" fill="none" stroke="oklch(0.98 0.02 90)" strokeWidth={0.8} />
                {/* xe máy chạy ngược chiều (lật ngang) → lật chữ lại cho đọc xuôi */}
                <text x="50" y="-16.412" transform="scale(-1 1)" textAnchor="middle" fontSize="5.8" fontWeight={800} letterSpacing=".3" fill="white">ĐI TÀ XÙA THÔI!</text>
              </g>
              <ellipse cx="0" cy="1" rx="13" ry="2" fill="oklch(0.1 0.02 160 / .35)" />
              <rect x="-10" y="-9" width="20" height="5" rx="2.5" fill="oklch(0.55 0.15 28)" />
              <rect x="-5" y="-21" width="6" height="12" rx="2.5" fill="oklch(0.45 0.08 160)" />
              <circle cx="-2" cy="-23" r="3.6" fill="oklch(0.9 0.02 90)" />
              <circle cx="-8" cy="-2" r="3.4" fill="oklch(0.2 0.01 250)" /><circle cx="8" cy="-2" r="3.4" fill="oklch(0.2 0.01 250)" />
            </g>
          </g>
        </svg>
        {CLOUD_BANDS.map((blobs, li) => (
          <div key={li} className="pointer-events-none absolute inset-x-0 overflow-visible" style={{ bottom: BAND_STYLE[li].bottom, height: BAND_STYLE[li].height, opacity: BAND_STYLE[li].opacity }}>
            <div data-band className="absolute inset-y-0 left-0 w-[200%] will-change-transform">
              {blobs.map((c, i) => (
                <div
                  key={i}
                  className="absolute rounded-full"
                  style={{ left: c.x, top: c.y, width: c.w, height: c.h, background: "radial-gradient(ellipse at 50% 40%, oklch(1 0 0) 30%, oklch(0.96 0.02 40 / .85) 60%, oklch(0.95 0.03 40 / 0) 72%)", filter: `blur(${BAND_STYLE[li].blur}px)` }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      {/* lớp phủ đêm: đậm khi trời tối, tan khi trời sáng */}
      <div data-tint className="pointer-events-none absolute inset-0" style={{ background: "oklch(0.14 0.04 265)", opacity: 0 }} />
      {/* lớp phủ tối để chữ dễ đọc */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "linear-gradient(180deg,oklch(0.2 0.05 265 / .45) 0%,oklch(0.2 0.05 265 / 0) 26%,oklch(0.18 0.04 160 / 0) 50%,oklch(0.16 0.04 165 / .82) 100%),linear-gradient(90deg,oklch(0.18 0.04 200 / .5) 0%,oklch(0.18 0.04 200 / 0) 60%)" }}
      />
    </div>
  );
}
