"use client";

import { useEffect, useRef } from "react";

// ── Dữ liệu trang trí cố định (sinh 1 lần, giống nhau ở server & client) ──────
const STARS = Array.from({ length: 34 }, (_, i) => ({ x: `${(i * 53 + 17) % 99}%`, y: `${(i * 29 + 5) % 44}%`, s: 1 + (i % 4) * 0.6 }));
const BIRDS = Array.from({ length: 5 }, (_, i) => 12 + (i % 3) * 5);
const round = (v: number) => Math.round(v * 100) / 100;
/** 3 dải biển mây (xa → gần); mỗi dải lặp 2 nửa giống nhau để trôi vòng liền mạch. */
const CLOUD_BANDS = [0, 1, 2].map((li) => {
  const n = [8, 9, 11][li];
  const half = Array.from({ length: n }, (_, i) => {
    const r = (k: number) => { const x = Math.sin((i + 1) * 12.9898 + (li + k) * 78.233) * 43758.5453; return x - Math.floor(x); };
    return { x: (i / n) * 50 + r(1) * 3, y: r(2) * 30, w: [16, 20, 26][li] + r(3) * 12, h: [60, 90, 130][li] + r(4) * 50 };
  });
  return [...half, ...half.map((c) => ({ ...c, x: c.x + 50 }))].map((c) => ({ x: `${round(c.x - 6)}%`, y: `${round(c.y)}%`, w: `${round(c.w / 2)}%`, h: Math.round(c.h) }));
});
const BAND_STYLE = [
  { bottom: "50%", height: "12%", opacity: 0.5, blur: 18 },
  { bottom: "31%", height: "14%", opacity: 0.66, blur: 14 },
  { bottom: "-7%", height: "26%", opacity: 0.96, blur: 10 },
];
const ROAD = "M 520 680 C 650 624, 760 560, 900 550 S 1100 510, 1200 482 S 1380 442, 1500 448";

// Bảng màu: CHÀM (màu nhuộm của người Mông) cho núi, nắng bình minh cho trời, sắc thổ cẩm làm điểm nhấn.
const CHAM = ["oklch(0.8 0.05 288)", "oklch(0.66 0.075 282)", "oklch(0.5 0.09 276)", "oklch(0.34 0.085 270)", "oklch(0.29 0.07 262)"];
// chân mỗi lớp núi nhạt dần thành sương (lớp càng gần càng ít sương)
const CHAM_FOOT = ["oklch(0.92 0.035 70)", "oklch(0.85 0.045 310)", "oklch(0.68 0.065 288)", "oklch(0.3 0.07 266)", "oklch(0.2 0.05 258)"];
const BROCADE = { bg: "oklch(0.2 0.06 272)", red: "oklch(0.6 0.21 25)", pink: "oklch(0.66 0.22 355)", gold: "oklch(0.84 0.15 88)", green: "oklch(0.66 0.15 150)", white: "oklch(0.97 0.01 90)" };

/** Dải hoa văn thổ cẩm (quả trám lồng nhau + chữ thập + răng cưa) — lặp vô hạn theo chiều ngang. */
export function BrocadeStrip({ id, height = 12, className }: { id: string; height?: number; className?: string }) {
  return (
    <svg aria-hidden className={className} width="100%" height={height} preserveAspectRatio="none" style={{ display: "block" }}>
      <defs>
        <pattern id={id} width="48" height="12" patternUnits="userSpaceOnUse" patternTransform={`scale(${height / 12})`}>
          <rect width="48" height="12" fill={BROCADE.bg} />
          {/* răng cưa viền trên/dưới */}
          <path d="M0 0 L3 3 L6 0 L9 3 L12 0 L15 3 L18 0 L21 3 L24 0 L27 3 L30 0 L33 3 L36 0 L39 3 L42 0 L45 3 L48 0" fill="none" stroke={BROCADE.gold} strokeWidth="0.9" />
          <path d="M0 12 L3 9 L6 12 L9 9 L12 12 L15 9 L18 12 L21 9 L24 12 L27 9 L30 12 L33 9 L36 12 L39 9 L42 12 L45 9 L48 12" fill="none" stroke={BROCADE.gold} strokeWidth="0.9" />
          {/* quả trám lớn + lõi */}
          <path d="M12 1.6 L16.4 6 L12 10.4 L7.6 6 Z" fill={BROCADE.red} />
          <path d="M12 3.6 L14.4 6 L12 8.4 L9.6 6 Z" fill={BROCADE.gold} />
          <rect x="11.3" y="5.3" width="1.4" height="1.4" fill={BROCADE.bg} />
          <path d="M36 1.6 L40.4 6 L36 10.4 L31.6 6 Z" fill={BROCADE.pink} />
          <path d="M36 3.6 L38.4 6 L36 8.4 L33.6 6 Z" fill={BROCADE.white} />
          <rect x="35.3" y="5.3" width="1.4" height="1.4" fill={BROCADE.green} />
          {/* chữ thập nhỏ xen giữa */}
          <path d="M24 4 V8 M22 6 H26" stroke={BROCADE.green} strokeWidth="1.1" />
          <path d="M0 4.6 V7.4 M-1.4 6 H1.4 M48 4.6 V7.4 M46.6 6 H49.4" stroke={BROCADE.white} strokeWidth="0.9" />
        </pattern>
      </defs>
      <rect width="100%" height={height} fill={`url(#${id})`} />
    </svg>
  );
}

/**
 * Nền banner trang chủ: "Bình minh chàm trên Tà Xùa" — tranh hoạt hình nhiều lớp thay cho ảnh.
 *  - Trời đổi theo chu kỳ ngày → hoàng hôn → đêm sao → bình minh (48 giây, mở trang là ban ngày).
 *  - 5 lớp núi màu chàm chìm dần trong sương, 3 dải biển mây trôi, cây cô đơn, nhà sàn lên đèn khi tối,
 *    ruộng bậc thang, đường đèo có xe cabin & xe máy kéo cờ "ĐI TÀ XÙA THÔI!".
 *  - Dải thổ cẩm ở mép trên, thước độ cao bên phải, đồng hồ "giờ Tà Xùa" theo màu trời, hạt nhiễu phim.
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
    const clock = host.querySelector<HTMLElement>("[data-clock]");
    const clockLabel = host.querySelector<HTMLElement>("[data-clock-label]");
    const lamps = [...host.querySelectorAll<SVGElement>("[data-lamp]")];
    const svg = host.querySelector<SVGSVGElement>("svg[data-scene]");
    // Màn hẹp: neo cảnh về góc phải-dưới để vẫn thấy đường đèo và xe.
    const fit = () => svg?.setAttribute("preserveAspectRatio", window.innerWidth < 760 ? "xMaxYMax slice" : "xMidYMax slice");
    fit();
    window.addEventListener("resize", fit);
    const stars = [...host.querySelectorAll<HTMLElement>("[data-star]")];
    const layers = [...host.querySelectorAll<SVGGElement>("[data-layer]")];
    const bands = [...host.querySelectorAll<HTMLElement>("[data-band]")];
    const birds = [...host.querySelectorAll<HTMLElement>("[data-bird]")];
    const road = host.querySelector<SVGPathElement>("[data-road]");
    const bus = host.querySelector<SVGGElement>("[data-bus]");
    const bike = host.querySelector<SVGGElement>("[data-bike]");
    const SP = [0.45, 0.8, 1.3];
    const t0 = performance.now();
    let raf = 0;
    let lastClock = "";

    // Một vòng ngày → hoàng hôn → đêm → bình minh dài 48 giây; mở trang là BAN NGÀY (pha 0.44),
    // giữ ngày ~7 giây rồi mặt trời lặn chậm rãi (~14 giây).
    const CYCLE = 48;
    const START_PHASE = 0.44;
    // Màn hẹp chỉ thấy nửa phải của cảnh → cho xe cabin & xe máy xuất phát ngay trong khung nhìn.
    const narrow = window.innerWidth < 760;
    const BUS_START = narrow ? 0.5 : 0.18;
    const BIKE_START = narrow ? 0.1 : 0.4; // xe máy chạy ngược chiều: vị trí = 1 − (…)
    const VEHICLE_SCALE = narrow ? 3 : 1; // màn hẹp cảnh bị thu nhỏ → phóng to xe + cờ cho đọc được chữ
    const sm = (x: number) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };

    const tick = (t: number) => {
      const sy = window.scrollY || 0;
      const H = host.offsetHeight, W = host.offsetWidth;
      const ph = reduce ? 0.5 : (START_PHASE + t / CYCLE) % 1; // pha trong ngày (0.5 = giữa trưa)
      const band = (p: number, q: number, r: number, u: number) => sm((ph - p) / (q - p)) * (1 - sm((ph - r) / (u - r)));
      const light = band(0.12, 0.42, 0.6, 0.88);
      const dawn = band(0.08, 0.22, 0.3, 0.42) + band(0.58, 0.7, 0.78, 0.9);
      const day = band(0.28, 0.42, 0.58, 0.7);
      if (dawnEl) dawnEl.style.opacity = String(Math.min(1, dawn));
      if (dayEl) dayEl.style.opacity = String(day);
      if (tint) tint.style.opacity = String(0.5 * (1 - light));
      const arc = Math.sin(Math.PI * Math.max(0, Math.min(1, (ph - 0.1) / 0.8)));
      if (sun) {
        sun.style.transform = `translate(${(ph - 0.5) * W * 0.46}px, ${H * (0.6 - 0.44 * arc) + sy * 0.3}px) scale(${1 - 0.16 * day})`;
        sun.style.opacity = String(sm(arc * 4));
      }
      if (glow) glow.style.opacity = String(Math.min(1, dawn * 1.1 + day * 0.3));
      stars.forEach((el, i) => { el.style.opacity = String(Math.max(0, (1 - sm(light * 2.2)) * (0.7 + 0.25 * Math.sin(t * 2 + i)))); });
      const lampOn = String(sm((0.55 - light) * 3)); // nhà sàn lên đèn khi trời tối
      lamps.forEach((el) => { el.style.opacity = lampOn; });
      layers.forEach((g, i) => { g.style.transform = `translateY(${sy * (0.24 - i * 0.04)}px)`; });
      bands.forEach((el, i) => { el.style.transform = `translate3d(${reduce ? 0 : -((t * SP[i]) % 50)}%, ${Math.sin(t * 0.4 + i) * 3 - sy * (0.05 + i * 0.03)}px, 0)`; });
      // Đồng hồ "giờ Tà Xùa": mặt trời trên trời ứng với 5:30–18:30, phần còn lại là đêm.
      if (clock && clockLabel) {
        const hour = ph >= 0.1 && ph <= 0.9 ? 5.5 + ((ph - 0.1) / 0.8) * 13 : (18.5 + ((((ph - 0.9) % 1) + 1) % 1 / 0.2) * 11) % 24;
        const hh = Math.floor(hour), mm = Math.floor(((hour - hh) * 60) / 10) * 10;
        const text = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
        if (text !== lastClock) {
          lastClock = text;
          clock.textContent = text;
          clockLabel.textContent = hour < 5 || hour >= 19.5 ? "đêm sao" : hour < 7.5 ? "bình minh" : hour < 16.5 ? "nắng trên mây" : hour < 19.5 ? "hoàng hôn" : "đêm sao";
        }
      }
      if (reduce) return;
      birds.forEach((el, i) => {
        const f = ((t * (0.028 + i * 0.005) + i * 0.21) % 1.3) - 0.15;
        el.style.transform = `translate(${f * W}px, ${H * (0.16 + (i % 3) * 0.06) + Math.sin(t * 0.9 + i) * 8}px) scaleY(${0.7 + Math.abs(Math.sin(t * 6 + i)) * 0.6})`;
      });
      if (!road) return;
      const L = road.getTotalLength();
      const place = (g: SVGGElement | null, pos: number, flip: boolean) => {
        if (!g) return;
        const d = L * pos;
        const p0 = road.getPointAtLength(Math.max(0, d - 6)), p1 = road.getPointAtLength(Math.min(L, d + 6)), p = road.getPointAtLength(d);
        const ang = (Math.atan2(p1.y - p0.y, p1.x - p0.x) * 180) / Math.PI;
        g.setAttribute("transform", `translate(${p.x} ${p.y + Math.sin(t * 20) * 0.5}) rotate(${ang}) scale(${flip ? -VEHICLE_SCALE : VEHICLE_SCALE} ${VEHICLE_SCALE})`);
        g.style.opacity = pos < 0.02 || pos > 0.98 ? "0" : "1";
        // lá cờ "ĐI TÀ XÙA THÔI!" phấp phới sau xe
        const flag = g.querySelector("[data-flag]");
        if (flag) flag.setAttribute("transform", `rotate(${Math.sin(t * 6 + (flip ? 1.5 : 0)) * 2.2} ${flip ? -11 : -33} -18)`);
      };
      place(bus, (t * 0.045 + BUS_START) % 1, false);
      place(bike, 1 - ((t * 0.07 + BIKE_START) % 1), true);
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

  const CLOUD_BG = "radial-gradient(ellipse at 50% 40%, oklch(1 0 0) 30%, oklch(0.97 0.02 50 / .85) 60%, oklch(0.96 0.03 50 / 0) 72%)";

  return (
    <div ref={root} aria-hidden className="absolute inset-0 -z-10 overflow-hidden">
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ background: "linear-gradient(180deg, oklch(0.14 0.045 272) 0%, oklch(0.2 0.06 270) 45%, oklch(0.3 0.07 285) 100%)" }}
      >
        {/* trời bình minh / hoàng hôn và trời ban ngày — hiện dần theo chu kỳ ngày đêm */}
        <div data-dawn className="absolute inset-0" style={{ opacity: 0, background: "linear-gradient(180deg, oklch(0.3 0.08 280) 0%, oklch(0.46 0.12 322) 16%, oklch(0.68 0.16 22) 32%, oklch(0.84 0.14 62) 46%, oklch(0.94 0.08 88) 62%, oklch(0.96 0.05 90) 100%)" }} />
        <div data-day className="absolute inset-0" style={{ opacity: 1, background: "linear-gradient(180deg, oklch(0.52 0.12 258) 0%, oklch(0.7 0.09 245) 38%, oklch(0.87 0.045 225) 68%, oklch(0.95 0.025 95) 100%)" }} />
        {STARS.map((s, i) => (
          <span key={i} data-star className="absolute rounded-full bg-white" style={{ left: s.x, top: s.y, width: s.s, height: s.s, opacity: 0 }} />
        ))}
        <div
          data-glow
          className="pointer-events-none absolute left-1/2 top-[18%] h-[92%] w-[110%]"
          style={{ transform: "translateX(-30%)", opacity: 0.3, background: "radial-gradient(ellipse 46% 40% at 62% 60%, oklch(0.95 0.13 72 / .8), oklch(0.9 0.12 55 / 0) 70%)" }}
        />
        <div
          data-sun
          className="absolute left-[66%] top-0 -ml-[58px] h-[116px] w-[116px] rounded-full will-change-transform"
          style={{
            transform: "translateY(120px)",
            background: "radial-gradient(circle at 50% 45%, oklch(0.995 0.03 95) 0%, oklch(0.985 0.07 92) 55%, oklch(0.95 0.12 84) 100%)",
            boxShadow: "0 0 0 10px oklch(0.97 0.1 85 / .18), 0 0 70px 26px oklch(0.96 0.12 80 / .5), 0 0 180px 80px oklch(0.94 0.13 72 / .28)",
          }}
        />
        {BIRDS.map((w, i) => (
          <div key={i} data-bird className="absolute left-0 top-0 h-2 will-change-transform" style={{ width: w, transform: "translate(-200px, 0)" }}>
            <span className="absolute left-0 top-[3px] h-[1.6px] w-[52%] rounded-sm" style={{ background: "oklch(0.24 0.05 275)", transform: "rotate(18deg)", transformOrigin: "right center" }} />
            <span className="absolute right-0 top-[3px] h-[1.6px] w-[52%] rounded-sm" style={{ background: "oklch(0.24 0.05 275)", transform: "rotate(-18deg)", transformOrigin: "left center" }} />
          </div>
        ))}

        <svg data-scene viewBox="0 0 1440 720" preserveAspectRatio="xMidYMax slice" className="pointer-events-none absolute inset-x-0 top-0 h-full w-full max-[759px]:h-[42%]">
          <defs>
            {/* mỗi lớp núi: màu chàm ở đỉnh, nhạt dần thành sương ở chân */}
            {CHAM.map((c, i) => (
              <linearGradient key={i} id={`hsR${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={c} />
                <stop offset="1" stopColor={CHAM_FOOT[i]} />
              </linearGradient>
            ))}
            <linearGradient id="hsFront" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="oklch(0.3 0.06 195)" /><stop offset="1" stopColor="oklch(0.16 0.04 215)" /></linearGradient>
            <linearGradient id="hsTerrace" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="oklch(0.25 0.06 215)" /><stop offset="1" stopColor="oklch(0.14 0.04 240)" /></linearGradient>
            <filter id="hsHaze" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation="1.4" /></filter>
          </defs>

          {/* 1–3: ba dãy núi xa, mờ dần trong sương */}
          <g data-layer><path filter="url(#hsHaze)" d="M 0 720 L 0 318 C 70 300, 120 250, 190 246 C 260 242, 290 300, 360 296 C 440 291, 470 196, 545 190 C 620 184, 650 262, 720 258 C 800 253, 830 214, 900 216 C 970 218, 1000 284, 1075 280 C 1150 276, 1190 176, 1262 172 C 1330 168, 1360 236, 1410 238 L 1440 232 L 1440 720 Z" fill="url(#hsR0)" /></g>
          <g data-layer><path filter="url(#hsHaze)" d="M 0 720 L 0 392 C 80 366, 150 330, 225 334 C 305 338, 335 388, 415 384 C 495 380, 535 318, 615 316 C 695 314, 725 372, 805 370 C 885 368, 925 326, 1005 328 C 1085 330, 1115 384, 1195 380 C 1275 376, 1315 322, 1385 320 C 1415 319, 1432 328, 1440 332 L 1440 720 Z" fill="url(#hsR1)" /></g>
          <g data-layer><path d="M 0 720 L 0 452 C 90 428, 170 406, 250 412 C 340 419, 380 462, 460 466 C 540 470, 590 420, 670 420 C 750 420, 790 474, 870 476 C 950 478, 990 430, 1070 428 C 1150 426, 1190 470, 1270 466 C 1340 462, 1390 430, 1440 424 L 1440 720 Z" fill="url(#hsR2)" /></g>

          {/* 4: sống núi răng cưa (dáng "sống lưng khủng long") + cây cô đơn + nhà sàn */}
          <g data-layer>
            <path d="M 0 720 L 0 548 C 60 540, 96 520, 130 524 L 150 512 L 172 526 C 220 530, 250 506, 290 508 L 312 494 L 336 510 C 380 512, 420 494, 460 496 L 486 478 L 512 498 C 560 500, 600 478, 646 476 L 668 458 L 694 478 C 740 476, 790 452, 836 452 L 860 432 L 888 454 C 930 452, 980 430, 1020 430 L 1046 408 L 1076 432 C 1120 430, 1170 404, 1214 404 L 1240 382 L 1270 406 C 1320 404, 1380 378, 1440 372 L 1440 720 Z" fill="url(#hsR3)" />
            {/* cây cô đơn */}
            <g transform="translate(1046 408)">
              <path d="M 0 0 C -1 -10, 1 -18, 0 -30 M 0 -16 C -6 -20, -9 -24, -12 -30 M 0 -20 C 5 -24, 8 -27, 11 -33" fill="none" stroke="oklch(0.2 0.05 265)" strokeWidth="2.2" strokeLinecap="round" />
              <ellipse cx="-11" cy="-36" rx="13" ry="9" fill="oklch(0.22 0.055 262)" /><ellipse cx="6" cy="-42" rx="16" ry="11" fill="oklch(0.2 0.05 265)" /><ellipse cx="14" cy="-33" rx="10" ry="7" fill="oklch(0.22 0.055 262)" />
            </g>
            {/* hai nếp nhà sàn — cửa sổ sáng đèn khi trời tối */}
            {[[452, 500, 1], [512, 504, 0.82]].map(([x, y, k], i) => (
              <g key={i} transform={`translate(${x} ${y}) scale(${k})`}>
                <path d="M -26 -18 L 0 -38 L 26 -18 Z" fill="oklch(0.17 0.045 265)" />
                <rect x="-20" y="-18" width="40" height="13" fill="oklch(0.21 0.05 262)" />
                <path d="M -18 -5 V 4 M -6 -5 V 4 M 6 -5 V 4 M 18 -5 V 4" stroke="oklch(0.17 0.045 265)" strokeWidth="2" />
                <rect data-lamp x="-9" y="-15" width="7" height="7" rx="1" fill="oklch(0.9 0.15 82)" style={{ opacity: 0, filter: "drop-shadow(0 0 5px oklch(0.88 0.16 75))" }} />
                <rect data-lamp x="4" y="-15" width="5" height="7" rx="1" fill="oklch(0.86 0.15 70)" style={{ opacity: 0 }} />
              </g>
            ))}
          </g>

          {/* 5: sườn đồi trước mặt + đường đèo + xe */}
          <g data-layer>
            <path d="M 380 720 C 470 690, 560 650, 660 608 C 760 566, 820 540, 920 536 C 1020 532, 1080 506, 1180 478 C 1280 450, 1360 432, 1440 436 L 1440 720 Z" fill="url(#hsFront)" />
            {/* hàng thông trên sườn đồi */}
            <path d="M 700 600 l 7 -20 l 7 20 Z M 730 590 l 8 -24 l 8 24 Z M 764 578 l 6 -18 l 6 18 Z M 1040 528 l 7 -22 l 7 22 Z M 1070 520 l 6 -18 l 6 18 Z M 1300 462 l 8 -24 l 8 24 Z M 1332 454 l 6 -18 l 6 18 Z" fill="oklch(0.2 0.05 200)" />
            <path d={ROAD} fill="none" stroke="oklch(0.16 0.03 240)" strokeWidth={15} strokeLinecap="round" transform="translate(0,14)" />
            <path d={ROAD} fill="none" stroke="oklch(0.66 0.045 70)" strokeWidth={10} strokeLinecap="round" transform="translate(0,12)" />
            <path d={ROAD} fill="none" stroke="oklch(0.9 0.06 90 / .6)" strokeWidth={1} strokeDasharray="8 14" transform="translate(0,12)" />
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

          {/* 6: đồi ruộng bậc thang ở góc trái (nét đồng mức bắt nắng) */}
          <g data-layer>
            <path d="M 0 720 L 0 566 C 110 548, 230 552, 330 584 C 430 616, 520 664, 610 720 Z" fill="url(#hsTerrace)" />
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <path
                key={i}
                d={`M 0 ${586 + i * 22} C 100 ${570 + i * 22}, 210 ${574 + i * 23}, ${300 + i * 26} ${602 + i * 21} S ${470 + i * 22} ${672 + i * 12}, ${540 + i * 16} ${716 + i * 4}`}
                fill="none"
                stroke={i % 2 ? "oklch(0.56 0.09 190 / .7)" : "oklch(0.8 0.12 92 / .7)"}
                strokeWidth={1.3}
              />
            ))}
          </g>
        </svg>

        {/* màn hẹp: nối tiếp sườn đồi phía trước xuống hết banner (cảnh chỉ cao 42%) */}
        <div
          className="absolute inset-x-0 bottom-0 h-[58.5%] overflow-hidden min-[760px]:hidden"
          style={{ background: "linear-gradient(180deg, oklch(0.16 0.04 215) 0%, oklch(0.24 0.06 235) 14%, oklch(0.33 0.085 262) 48%, oklch(0.42 0.1 278) 100%)" }}
        >
          <svg viewBox="0 0 400 400" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
              <path key={i} d={`M -10 ${70 + i * 52} C 80 ${40 + i * 52}, 150 ${96 + i * 50}, 230 ${72 + i * 52} S 350 ${44 + i * 54}, 410 ${78 + i * 52}`} fill="none" stroke={i % 2 ? "oklch(0.85 0.1 85 / .13)" : "oklch(1 0 0 / .1)"} strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
            ))}
          </svg>
        </div>
        {CLOUD_BANDS.map((blobs, li) => (
          <div key={li} className={"pointer-events-none absolute inset-x-0 overflow-visible" + (li <= 1 ? " max-[759px]:hidden" : "")} style={{ bottom: BAND_STYLE[li].bottom, height: BAND_STYLE[li].height, opacity: BAND_STYLE[li].opacity }}>
            <div data-band className="absolute inset-y-0 left-0 w-[200%] will-change-transform">
              {blobs.map((c, i) => (
                <div key={i} className="absolute rounded-full" style={{ left: c.x, top: c.y, width: c.w, height: c.h, background: CLOUD_BG, filter: `blur(${BAND_STYLE[li].blur}px)` }} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* lớp phủ đêm: đậm khi trời tối, tan khi trời sáng */}
      <div className="pointer-events-none absolute inset-0 max-[759px]:bottom-[58%]"><div data-tint className="absolute inset-0" style={{ background: "oklch(0.13 0.05 270)", opacity: 0 }} /></div>
      {/* lớp phủ để chữ dễ đọc: tối dần xuống đáy + tối dần về bên trái */}
      <div
        className="pointer-events-none absolute inset-0 max-[759px]:hidden"
        style={{ background: "linear-gradient(180deg,oklch(0.18 0.06 270 / .5) 0%,oklch(0.18 0.06 270 / 0) 24%,oklch(0.16 0.05 250 / 0) 46%,oklch(0.13 0.045 250 / .86) 100%),linear-gradient(90deg,oklch(0.15 0.05 265 / .62) 0%,oklch(0.15 0.05 265 / .18) 46%,oklch(0.15 0.05 265 / 0) 66%)" }}
      />
      <div
        className="pointer-events-none absolute inset-0 min-[760px]:hidden"
        style={{ background: "linear-gradient(180deg,oklch(0.18 0.06 270 / .38) 0%,oklch(0.18 0.06 270 / 0) 16%,oklch(0.18 0.06 270 / 0) 70%,oklch(0.2 0.07 272 / .35) 100%)" }}
      />
      {/* hạt nhiễu phim rất nhẹ cho bề mặt đỡ "phẳng" */}
      <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-[.11] mix-blend-overlay">
        <filter id="hsGrain"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" /><feColorMatrix type="saturate" values="0" /></filter>
        <rect width="100%" height="100%" filter="url(#hsGrain)" />
      </svg>

      {/* dải thổ cẩm ở mép trên */}
      <BrocadeStrip id="hsBrocadeTop" height={12} className="absolute inset-x-0 top-0" />

      {/* thước độ cao (chỉ màn rộng) */}
      <div className="absolute bottom-[26%] right-5 top-[13%] hidden w-[150px] text-white lg:block xl:right-8">
        <div className="absolute bottom-0 right-0 top-0 w-px bg-white/45" />
        {[
          { top: "0%", alt: "2.865 m", label: "đỉnh Tà Xùa" },
          { top: "38%", alt: "2.100 m", label: "sống lưng khủng long" },
          { top: "68%", alt: "1.500 m", label: "trung tâm · biển mây" },
          { top: "100%", alt: "1.000 m", label: "Bắc Yên" },
        ].map((m) => (
          <div key={m.alt} className="absolute right-0 flex -translate-y-1/2 items-center gap-2" style={{ top: m.top }}>
            <div className="text-right leading-tight" style={{ textShadow: "0 1px 8px oklch(0.15 0.05 270 / .7)" }}>
              <div className="text-[12px] font-extrabold tracking-[.06em]">{m.alt}</div>
              <div className="text-[10.5px] font-medium opacity-75">{m.label}</div>
            </div>
            <span className="h-px w-3.5 bg-white/80" />
          </div>
        ))}
      </div>

      {/* đồng hồ "giờ Tà Xùa" đổi theo màu trời */}
      <div className="absolute right-5 top-6 hidden items-baseline gap-2 text-white sm:flex xl:right-8" style={{ textShadow: "0 1px 10px oklch(0.15 0.05 270 / .7)" }}>
        <span data-clock className="font-mono text-[15px] font-bold tabular-nums tracking-[.04em]">11:00</span>
        <span data-clock-label className="text-[11px] font-semibold uppercase tracking-[.16em] opacity-80">nắng trên mây</span>
      </div>
    </div>
  );
}
