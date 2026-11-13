"use client";

import { SiteZaloLink } from "@/components/SiteContact";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";

export interface CafeCard {
  id: string;
  slug: string;
  name: string;
  area: string;
  dist: string;
  desc: string;
  tags: string[];
  open: number; // giờ mở (số thập phân, vd 5.5 = 5h30)
  close: number; // giờ đóng
  slots: string[]; // dawn | day | sunset | night
  am: string[]; // view | food | stay | outdoor | late
  priceText: string | null; // chuỗi giá (vd "Từ 40.000đ"); null = theo menu
  mapUrl: string;
  image: string | null;
  feat: boolean;
}

// Theme "Rừng núi Tây Bắc" (mặc định của thiết kế Cafe).
const TH = {
  sky: "linear-gradient(180deg, oklch(0.34 0.045 240) 0%, oklch(0.55 0.04 220) 36%, oklch(0.8 0.05 120) 66%, oklch(0.9 0.06 95) 86%, oklch(0.95 0.03 95) 100%)",
  r1: "linear-gradient(180deg, oklch(0.45 0.04 200), oklch(0.52 0.04 190))",
  r2: "linear-gradient(180deg, oklch(0.3 0.045 170), oklch(0.36 0.05 160))",
  cloud: ["oklch(0.92 0.01 220 / .75)", "oklch(0.95 0.008 210 / .88)", "oklch(0.97 0.012 85)"],
  blur: ["20px", "26px", "30px"],
  page: "oklch(0.975 0.01 150)",
  mote: "oklch(0.98 0.05 95)",
  bird: "oklch(0.26 0.04 200)",
  G: "oklch(0.29 0.055 160)",
  btn: "oklch(0.29 0.055 160)",
  btnHover: "oklch(0.68 0.18 45)",
  price: "oklch(0.34 0.07 160)",
};

const MEALS: [string, string][] = [
  ["all", "Mọi khung giờ"],
  ["dawn", "Bình minh 5h30–9h"],
  ["day", "Trong ngày"],
  ["sunset", "Hoàng hôn 16h30–18h"],
  ["night", "Tối muộn"],
];
const GRPS: [string, string][] = [
  ["all", "Tất cả"],
  ["view", "View săn mây"],
  ["food", "Có đồ ăn"],
  ["stay", "Có homestay"],
  ["outdoor", "Ngồi ngoài trời"],
  ["late", "Mở khuya"],
];

function rnd(i: number, k: number) {
  const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return x - Math.floor(x);
}
// Làm tròn 2 chữ số cho giá trị CSS — số thập phân dài bị CSSOM rút gọn khi đọc lại,
// gây cảnh báo hydration mismatch (React dev) và re-render xoá hiệu ứng reveal.
const r2 = (v: number) => Math.round(v * 100) / 100;
function fmtH(v: number) {
  const hh = Math.floor(v);
  const mm = Math.round((v - hh) * 60);
  return (hh === 24 ? "0" : hh) + ":" + String(mm).padStart(2, "0");
}

export function CafeList({ cafes }: { cafes: CafeCard[] }) {
  const [w, setW] = useState(1280);
  const [q, setQ] = useState("");
  const [meal, setMeal] = useState("all");
  const [grp, setGrp] = useState("all");
  const [di, setDi] = useState("");
  const [area, setArea] = useState("all");
  const [sort, setSort] = useState<"rec" | "early" | "late">("rec");

  const sunRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const heroTextRef = useRef<HTMLDivElement>(null);
  const ridgeBackRef = useRef<HTMLDivElement>(null);
  const ridgeFrontRef = useRef<HTMLDivElement>(null);
  const houseRef = useRef<HTMLDivElement>(null);
  const doorRef = useRef<HTMLDivElement>(null);
  const winRef = useRef<HTMLDivElement>(null);
  const win2Ref = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const dadRef = useRef<HTMLDivElement>(null);
  const momRef = useRef<HTMLDivElement>(null);
  const kidRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const layerEls = useRef<(HTMLDivElement | null)[]>([]);
  const starEls = useRef<(HTMLSpanElement | null)[]>([]);
  const birdEls = useRef<(HTMLDivElement | null)[]>([]);
  const moteEls = useRef<(HTMLSpanElement | null)[]>([]);
  const mx = useRef(0);
  const tmx = useRef(0);

  useEffect(() => {
    const onR = () => setW(window.innerWidth);
    onR();
    window.addEventListener("resize", onR);
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const onM = (e: MouseEvent) => { tmx.current = (e.clientX / window.innerWidth) * 2 - 1; };
    window.addEventListener("mousemove", onM);

    const io =
      "IntersectionObserver" in window
        ? new IntersectionObserver(
            (es) =>
              es.forEach((e) => {
                if (e.isIntersecting) {
                  (e.target as HTMLElement).style.opacity = "1";
                  (e.target as HTMLElement).style.transform = "none";
                  io!.unobserve(e.target);
                }
              }),
            { threshold: 0.12 },
          )
        : null;
    const reveal = () =>
      document.querySelectorAll<HTMLElement>("[data-reveal]").forEach((el) =>
        io && !reduce ? io.observe(el) : ((el.style.opacity = "1"), (el.style.transform = "none")),
      );
    reveal();
    document.querySelectorAll<HTMLElement>("[data-in]").forEach((el) => {
      const kk = Number(el.dataset.in);
      setTimeout(() => { el.style.opacity = "1"; el.style.transform = "none"; }, reduce ? 0 : 250 + kk * 160);
    });

    const t0 = performance.now();
    const SP = [0.35, 0.7, 1.25];
    let raf = 0;
    let lastRv = 0;
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
      mx.current += (tmx.current - mx.current) * 0.05;
      const m = reduce ? 0 : mx.current;
      layerEls.current.forEach((el, i) => { if (!el) return; const x = reduce ? 0 : (t * SP[i]) % 50; el.style.transform = `translate3d(${-x}%, ${-sy * (0.04 + i * 0.03) + Math.sin(t * 0.5 + i) * 4}px, 0) translateX(${m * (6 + i * 10)}px)`; });
      if (ridgeBackRef.current) ridgeBackRef.current.style.transform = `translate(${m * -8}px, ${sy * 0.18}px)`;
      if (ridgeFrontRef.current) ridgeFrontRef.current.style.transform = `translate(${m * -16}px, ${sy * 0.1}px)`;
      if (!reduce) {
        birdEls.current.forEach((el, i) => {
          if (!el) return;
          const sp = 0.035 + i * 0.006;
          const f = ((t * sp + i * 0.23) % 1.3) - 0.15;
          const x = f * W;
          const y = H * (0.16 + (i % 3) * 0.07) + Math.sin(t * 0.8 + i * 2) * 14 - sy * 0.2;
          el.style.transform = `translate(${x}px, ${y}px)`;
          const a = Math.sin(t * (7 + i) + i) * 30;
          const l = el.querySelector<HTMLElement>("[data-wl]");
          const r = el.querySelector<HTMLElement>("[data-wr]");
          if (l) l.style.transform = `rotate(${a}deg)`;
          if (r) r.style.transform = `rotate(${-a}deg)`;
        });
        moteEls.current.forEach((el, i) => {
          if (!el) return;
          const sp = 14 + (i % 5) * 6;
          const span = H * 0.7;
          const pr = ((t * sp + i * 97) % span) / span;
          const x = ((i * 0.137) % 1) * W + Math.sin(t * 0.7 + i) * 24 + m * 20;
          const y = H * 0.92 - pr * span;
          el.style.transform = `translate(${x}px, ${y}px)`;
          el.style.opacity = String(Math.sin(pr * Math.PI) * 0.75);
        });
        if (houseRef.current) {
          const P = 14, k = t % P;
          const cl = (v: number) => Math.max(0, Math.min(1, v));
          const seg = (a: number, b: number) => cl((k - a) / (b - a));
          const eo = (v: number) => 1 - Math.pow(1 - v, 3);
          const lr = (a: number, b: number, v: number) => a + (b - a) * v;
          const lift = -sy * 0.12;
          const Xh = Math.max(150, W * (W < 640 ? 0.52 : 0.6));
          const Dx = Xh + 51;
          houseRef.current.style.transform = `translate(${Xh}px, ${lift}px)`;
          const open = Math.max(seg(4.5, 5.0) - seg(8.2, 8.6), seg(10.8, 11.1) - seg(11.8, 12.2));
          if (doorRef.current) doorRef.current.style.transform = `perspective(120px) rotateY(${-75 * open}deg)`;
          const lit = seg(8.3, 9.0) - seg(12.6, 13.4);
          const wl = lit > 0 ? `oklch(${0.32 + lit * 0.56} ${0.03 + lit * 0.12} ${230 - lit * 150})` : "oklch(0.32 0.03 230)";
          const gl = `0 0 ${lit * 16}px ${lit * 4}px oklch(0.9 0.15 85 / ${lit * 0.7})`;
          [winRef.current, win2Ref.current].forEach((el) => { if (el) { el.style.background = wl; el.style.boxShadow = gl; } });
          const pose = (el: HTMLElement | null, x: number, y: number, f: number, mode: string, ph: number, sc: number) => {
            if (!el) return;
            const run = mode === "run";
            const sw = run ? Math.sin(t * 18 + ph) * 34 : mode === "walk" ? Math.sin(t * 12 + ph) * 24 : 0;
            const bob = run ? -Math.abs(Math.sin(t * 18 + ph)) * 2.5 : 0;
            el.style.transform = `translate(${x}px, ${y + bob + lift}px) scale(${f * sc}, ${sc})`;
            const l = el.querySelectorAll<HTMLElement>("[data-leg]");
            if (l[0]) l[0].style.transform = `rotate(${sw}deg)`;
            if (l[1]) l[1].style.transform = `rotate(${-sw}deg)`;
          };
          const arm = (el: HTMLElement | null, d: number) => { const a = el?.querySelector<HTMLElement>("[data-arm]"); if (a) a.style.transform = `rotate(${d}deg)`; };
          const shake = k > 3.3 && k < 4.3, shk = Math.sin(t * 16) * 9;
          const H0 = hostRef.current;
          if (H0) {
            let x = Xh - 30, f = -1, mode = "stand", op = 1, sc = 1;
            if (k >= 4.4 && k < 5.0) f = 1;
            else if (k >= 5.0 && k < 6.4) { const wv = seg(5.0, 6.0); x = lr(Xh - 30, Dx, wv); f = 1; mode = wv < 1 ? "walk" : "stand"; const fd = seg(6.0, 6.4); op = 1 - fd; sc = 1 - fd * 0.15; }
            else if (k >= 6.4 && k < 11.0) op = 0;
            else if (k >= 11.0) { const v = seg(11.0, 11.4), wv = seg(11.4, 12.6); op = v; x = lr(Dx, Xh - 30, wv); mode = wv > 0 && wv < 1 ? "walk" : "stand"; }
            H0.style.opacity = String(op);
            pose(H0, x, 0, f, mode, 0, sc);
            arm(H0, shake ? -78 + shk : k > 1.4 && k < 3.2 ? -150 + Math.sin(t * 10) * 22 : k >= 4.4 && k < 5.0 ? -95 : mode === "walk" ? Math.sin(t * 12) * 18 : 0);
          }
          const fam: [HTMLDivElement | null, number, number, number, number][] = [
            [dadRef.current, Xh - 58, 0.6, 5.3, 1],
            [momRef.current, Xh - 84, 0.8, 5.65, 1],
            [kidRef.current, Xh - 104, 0.7, 6.0, 0.72],
          ];
          fam.forEach(([el, stop, s0, w0, sc], i) => {
            if (!el) return;
            const r = seg(s0, s0 + 2.5);
            const wd = Dx - stop;
            const wt = wd / 80;
            const wv = seg(w0, w0 + wt);
            const fd = seg(w0 + wt, w0 + wt + 0.4);
            const x = k < w0 ? lr(-80 - i * 30, stop, eo(r)) : lr(stop, Dx, wv);
            const mode = k < w0 ? (r > 0 && r < 0.96 ? "run" : "stand") : wv < 1 ? "walk" : "stand";
            const hop = i === 2 && k > 3.2 && k < 4.6 ? -Math.abs(Math.sin(t * 9)) * 7 : 0;
            el.style.opacity = String(k < w0 + wt + 0.4 ? 1 - fd : 0);
            pose(el, x, hop, 1, mode, i * 1.3, sc * (1 - fd * 0.15));
            arm(el, i === 0 && shake ? -78 - shk : i === 2 && k > 3.2 && k < 4.6 ? -150 + Math.sin(t * 9) * 25 : mode === "run" ? Math.sin(t * 18 + i * 1.3) * 40 : mode === "walk" ? Math.sin(t * 12 + i) * 18 : 0);
          });
        }
      }
      if (now - lastRv > 300) {
        lastRv = now;
        document.querySelectorAll<HTMLElement>("[data-reveal]").forEach((el) => {
          if (el.style.opacity !== "1" && el.getBoundingClientRect().top < window.innerHeight * 0.95) { el.style.opacity = "1"; el.style.transform = "none"; }
        });
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      window.removeEventListener("resize", onR);
      window.removeEventListener("mousemove", onM);
      cancelAnimationFrame(raf);
      io?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const layers = useMemo(() => {
    const LAY = [
      { bottom: "30%", h: "22%", op: 0.55, n: 8, wMin: 18, wMax: 30, hh: [40, 70], blur: TH.blur[0], bg: TH.cloud[0] },
      { bottom: "12%", h: "26%", op: 0.8, n: 9, wMin: 22, wMax: 36, hh: [60, 100], blur: TH.blur[1], bg: TH.cloud[1] },
      { bottom: "-4%", h: "30%", op: 1, n: 10, wMin: 26, wMax: 40, hh: [90, 150], blur: TH.blur[2], bg: TH.cloud[2] },
    ];
    return LAY.map((L, li) => {
      const half = Array.from({ length: L.n }, (_, i) => ({
        x: (i / L.n) * 50 + rnd(i, li) * 3,
        y: rnd(i, li + 5) * 30,
        w: L.wMin + rnd(i, li + 9) * (L.wMax - L.wMin),
        h: L.hh[0] + rnd(i, li + 13) * (L.hh[1] - L.hh[0]),
      }));
      const clouds = half.concat(half.map((c) => ({ ...c, x: c.x + 50 }))).map((c) => ({
        x: `${r2(c.x - 6)}%`, y: `${r2(c.y)}%`, w: `${r2(c.w / 2)}%`, h: `${Math.round(c.h)}px`, bg: L.bg, blur: L.blur,
      }));
      return { bottom: L.bottom, h: L.h, op: L.op, clouds };
    });
  }, []);
  const stars = useMemo(() => Array.from({ length: 14 }, (_, i) => ({ x: `${r2(rnd(i, 21) * 100)}%`, y: `${r2(rnd(i, 22) * 34)}%`, s: `${r2(1.5 + rnd(i, 23) * 2)}px` })), []);

  const wide = w >= 980;
  const heroH = w < 640 ? 520 : 600;
  const sunLeft = w < 640 ? "72%" : "74%";

  // Khu vực (chip) dựng từ dữ liệu thật.
  const areaList = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of cafes) counts.set(c.area, (counts.get(c.area) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [cafes]);

  const dow = di ? new Date(di + "T00:00").getDay() : -1;
  const wk = dow === 0 || dow === 6;

  const items = useMemo(() => {
    const qq = q.trim().toLowerCase();
    const list = cafes.filter(
      (x) =>
        (area === "all" || x.area === area) &&
        (meal === "all" || x.slots.includes(meal)) &&
        (grp === "all" || x.am.includes(grp)) &&
        (!qq || (x.name + " " + x.desc + " " + x.tags.join(" ")).toLowerCase().includes(qq)),
    );
    list.sort((a, b) => (sort === "early" ? a.open - b.open : sort === "late" ? b.close - a.close : (b.feat ? 1 : 0) - (a.feat ? 1 : 0)));
    return list;
  }, [cafes, area, meal, grp, q, sort]);

  const hasFilter = Boolean(q || di || meal !== "all" || grp !== "all" || area !== "all");
  const clearAll = () => { setQ(""); setMeal("all"); setGrp("all"); setDi(""); setArea("all"); };

  const listTitle = area === "all" ? "Cafe săn mây quanh Tà Xùa" : "Cafe khu " + area;
  const listSub =
    items.length +
    " quán" +
    (meal !== "all" ? " · " + (MEALS.find((mm) => mm[0] === meal)?.[1].toLowerCase() ?? "") : "") +
    (grp !== "all" ? " · " + (GRPS.find((g) => g[0] === grp)?.[1].toLowerCase() ?? "") : "") +
    (di ? (wk ? " · cuối tuần, đi sớm để có bàn view" : " · ngày thường, thoải mái chọn bàn") : "");

  const cell = "flex min-w-0 flex-col gap-0.5 rounded-[14px] bg-[oklch(0.965_0.01_200)] px-3.5 py-2.5";
  const inp = "min-w-0 border-0 bg-transparent p-0 text-[15px] font-bold text-ink outline-none";

  const tips = [
    { k: "5h30", t: "Giờ mây dày nhất", d: "Từ 5h30 tới 9h mây dâng tới lan can; tới quán trước 6h để có bàn mép ban công." },
    { k: "16h", t: "Giờ hoàng hôn", d: "Chọn quán hướng tây ở Sống lưng khủng long hoặc Khe Cải, đẹp nhất 16h30–18h." },
    { k: "T7", t: "Cuối tuần đông", d: "Bàn view hết rất nhanh; muốn ngồi chậm hãy đi ngày thường hoặc chọn quán xa trung tâm." },
  ];
  const others: [string, string][] = [
    ["/nha-hang", "Nhà hàng & quán ăn Tà Xùa"],
    ["/homestay", "Homestay & Bungalow Tà Xùa"],
    ["/xe-cabin", "Xe cabin đi Tà Xùa"],
    ["/thue-xe-may", "Thuê xe máy Tà Xùa"],
    ["/combo", "Combo du lịch Tà Xùa"],
  ];

  return (
    <div style={{ background: TH.page }}>
      {/* HERO */}
      <section className="relative overflow-hidden" style={{ height: heroH, background: TH.sky }}>
        <div ref={sunRef} className="absolute top-0 -ml-[75px] h-[150px] w-[150px] rounded-full will-change-transform" style={{ left: sunLeft, background: "radial-gradient(circle, oklch(0.98 0.07 90) 0%, oklch(0.93 0.13 75) 45%, oklch(0.85 0.15 60 / 0) 72%)" }} />
        <div ref={glowRef} className="pointer-events-none absolute left-0 right-0 top-[30%] h-[60%]" style={{ background: `radial-gradient(ellipse 60% 50% at ${sunLeft} 60%, oklch(0.92 0.12 70 / .55), transparent 70%)` }} />
        <div className="pointer-events-none absolute inset-0">
          {stars.map((st, i) => (
            <span key={i} ref={(el) => { starEls.current[i] = el; }} className="absolute rounded-full bg-white opacity-70" style={{ left: st.x, top: st.y, width: st.s, height: st.s }} />
          ))}
        </div>
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} ref={(el) => { birdEls.current[i] = el; }} className="pointer-events-none absolute left-0 top-0 z-[2] h-[10px] will-change-transform" style={{ width: `${14 + (i % 3) * 5}px` }}>
            <span data-wl="1" className="absolute right-1/2 top-1 h-[2px] w-[52%] rounded-[2px]" style={{ background: TH.bird, transformOrigin: "right center" }} />
            <span data-wr="1" className="absolute left-1/2 top-1 h-[2px] w-[52%] rounded-[2px]" style={{ background: TH.bird, transformOrigin: "left center" }} />
          </div>
        ))}
        <div ref={ridgeBackRef} className="absolute -left-[5%] -right-[5%] bottom-[22%] h-[38%] opacity-75 will-change-transform" style={{ background: TH.r1, clipPath: "polygon(0 100%,0 62%,9% 48%,17% 58%,27% 30%,36% 50%,44% 40%,55% 12%,63% 38%,72% 28%,82% 52%,91% 36%,100% 50%,100% 100%)" }} />
        <div ref={ridgeFrontRef} className="absolute -left-[5%] -right-[5%] bottom-[12%] h-[34%] will-change-transform" style={{ background: TH.r2, clipPath: "polygon(0 100%,0 55%,8% 62%,18% 40%,24% 52%,33% 22%,40% 44%,50% 34%,58% 56%,68% 26%,76% 46%,86% 30%,94% 54%,100% 44%,100% 100%)" }} />
        {/* Hàng thông (pine) */}
        <div className="pointer-events-none absolute -left-[5%] -right-[5%] bottom-[14%] h-[96px]" style={{ WebkitMaskImage: "linear-gradient(180deg, black 45%, transparent 92%)", maskImage: "linear-gradient(180deg, black 45%, transparent 92%)" }}>
          <div className="absolute inset-0 opacity-80" style={{ background: "linear-gradient(-45deg, oklch(0.33 0.05 170) 50%, transparent 50%) 5px 100% / 17px 58px repeat-x, linear-gradient(45deg, oklch(0.33 0.05 170) 50%, transparent 50%) 5px 100% / 17px 58px repeat-x" }} />
          <div className="absolute inset-0" style={{ background: "linear-gradient(-45deg, oklch(0.27 0.05 165) 50%, transparent 50%) 0px 100% / 29px 86px repeat-x, linear-gradient(45deg, oklch(0.27 0.05 165) 50%, transparent 50%) 0px 100% / 29px 86px repeat-x, linear-gradient(-45deg, oklch(0.27 0.05 165) 50%, transparent 50%) 9px 100% / 13px 44px repeat-x, linear-gradient(45deg, oklch(0.27 0.05 165) 50%, transparent 50%) 9px 100% / 13px 44px repeat-x" }} />
          <div className="absolute inset-x-0 bottom-0 h-[62px]" style={{ background: "linear-gradient(-45deg, oklch(0.24 0.05 160) 50%, transparent 50%) 14px 100% / 23px 62px repeat-x, linear-gradient(45deg, oklch(0.24 0.05 160) 50%, transparent 50%) 14px 100% / 23px 62px repeat-x, linear-gradient(-45deg, oklch(0.24 0.05 160) 50%, transparent 50%) 3px 100% / 37px 52px repeat-x, linear-gradient(45deg, oklch(0.24 0.05 160) 50%, transparent 50%) 3px 100% / 37px 52px repeat-x" }} />
        </div>
        {layers.map((L, li) => (
          <div key={li} className="pointer-events-none absolute left-0 right-0" style={{ bottom: L.bottom, height: L.h, opacity: L.op }}>
            <div ref={(el) => { layerEls.current[li] = el; }} className="absolute bottom-0 left-0 top-0 w-[200%] will-change-transform">
              {L.clouds.map((c, i) => (
                <span key={i} className="absolute rounded-full" style={{ left: c.x, bottom: c.y, width: c.w, height: c.h, background: c.bg, filter: `blur(${c.blur})` }} />
              ))}
            </div>
          </div>
        ))}
        {Array.from({ length: 18 }, (_, i) => (
          <span key={i} ref={(el) => { moteEls.current[i] = el; }} className="pointer-events-none absolute left-0 top-0 z-[2] rounded-full opacity-0 will-change-transform" style={{ width: `${2 + (i % 4)}px`, height: `${2 + (i % 4)}px`, background: TH.mote, boxShadow: `0 0 8px ${TH.mote}` }} />
        ))}

        {/* Quán cafe + chủ quán đón gia đình khách ghé */}
        <div ref={houseRef} className="pointer-events-none absolute bottom-[17%] left-0 z-[2] h-[96px] w-[130px] will-change-transform">
          <div className="absolute left-0 top-0 h-[38px] w-[130px]" style={{ background: "oklch(0.36 0.06 45)", clipPath: "polygon(4% 100%, 50% 0, 96% 100%)" }} />
          <div className="absolute left-3 top-[36px] h-[60px] w-[106px]" style={{ background: "oklch(0.6 0.08 60)" }} />
          <div className="absolute left-3 top-[36px] h-[60px] w-[106px]" style={{ background: "repeating-linear-gradient(90deg, transparent 0 9px, oklch(0.5 0.07 55 / .5) 9px 10px)" }} />
          <div className="absolute left-[34px] top-10 h-[11px] w-[62px] rounded-[2px] text-center" style={{ background: "oklch(0.3 0.05 45)", color: "oklch(0.95 0.03 90)", fontSize: "6.5px", fontWeight: 900, lineHeight: "11px", letterSpacing: ".8px" }}>CAFE</div>
          <div ref={winRef} className="absolute left-5 top-[56px] h-4 w-5 rounded-[2px]" style={{ border: "2px solid oklch(0.35 0.05 45)", background: "oklch(0.32 0.03 230)" }} />
          <div ref={win2Ref} className="absolute left-[88px] top-[56px] h-4 w-5 rounded-[2px]" style={{ border: "2px solid oklch(0.35 0.05 45)", background: "oklch(0.32 0.03 230)" }} />
          <div className="absolute left-[50px] top-[58px] h-[38px] w-6" style={{ borderRadius: "3px 3px 0 0", background: "oklch(0.85 0.12 80)", boxShadow: "inset 0 0 10px oklch(0.6 0.14 60)" }} />
          <div ref={doorRef} className="absolute left-[50px] top-[58px] h-[38px] w-6 will-change-transform" style={{ borderRadius: "3px 3px 0 0", background: "oklch(0.42 0.07 45)", border: "2px solid oklch(0.32 0.05 45)", transformOrigin: "left center" }}>
            <div className="absolute right-[3px] top-[18px] h-[3px] w-[3px] rounded-full" style={{ background: "oklch(0.85 0.12 85)" }} />
          </div>
          <div className="absolute left-[6px] top-[93px] h-[3px] w-[118px]" style={{ background: "oklch(0.3 0.04 45)" }} />
        </div>
        {/* chủ quán */}
        <div ref={hostRef} className="pointer-events-none absolute bottom-[17%] left-0 z-[3] h-[46px] w-[22px] will-change-transform" style={{ transformOrigin: "50% 100%" }}>
          <div className="absolute left-[5px] top-6 h-[3px] w-3" style={{ background: "oklch(0.6 0.18 28)" }} />
          <div data-leg="1" className="absolute left-[6px] top-7 h-[18px] w-1 rounded-[2px]" style={{ background: "oklch(0.25 0.03 260)", transformOrigin: "top center" }} />
          <div data-leg="2" className="absolute left-3 top-7 h-[18px] w-1 rounded-[2px]" style={{ background: "oklch(0.25 0.03 260)", transformOrigin: "top center" }} />
          <div className="absolute left-[5px] top-[11px] h-[19px] w-3" style={{ borderRadius: "5px 5px 2px 2px", background: "oklch(0.33 0.08 270)" }} />
          <div className="absolute left-[6px] top-px h-[10px] w-[10px] rounded-full" style={{ background: "oklch(0.76 0.07 55)" }} />
          <div className="absolute left-[5px] -top-px h-[5px] w-3" style={{ borderRadius: "5px 5px 1px 1px", background: "oklch(0.3 0.07 270)" }} />
          <div className="absolute left-1 top-[3px] h-[2px] w-[14px]" style={{ background: "oklch(0.6 0.18 28)" }} />
          <div data-arm="1" className="absolute left-3 top-3 h-[14px] w-1 rounded-[2px]" style={{ background: "oklch(0.33 0.08 270)", transformOrigin: "2px 2px" }}>
            <div className="absolute left-0 -bottom-[3px] h-1 w-1 rounded-full" style={{ background: "oklch(0.76 0.07 55)" }} />
          </div>
        </div>
        {/* bố */}
        <div ref={dadRef} className="pointer-events-none absolute bottom-[17%] left-0 z-[3] h-[46px] w-[22px] will-change-transform" style={{ transformOrigin: "50% 100%" }}>
          <div className="absolute left-0 top-3 h-[14px] w-[7px] rounded-[3px]" style={{ background: "oklch(0.5 0.1 50)" }} />
          <div data-leg="1" className="absolute left-[6px] top-7 h-[18px] w-1 rounded-[2px]" style={{ background: "oklch(0.25 0.03 260)", transformOrigin: "top center" }} />
          <div data-leg="2" className="absolute left-3 top-7 h-[18px] w-1 rounded-[2px]" style={{ background: "oklch(0.25 0.03 260)", transformOrigin: "top center" }} />
          <div className="absolute left-[5px] top-[11px] h-[19px] w-3" style={{ borderRadius: "5px 5px 2px 2px", background: "oklch(0.55 0.12 155)" }} />
          <div className="absolute left-[6px] top-px h-[10px] w-[10px] rounded-full" style={{ background: "oklch(0.76 0.07 55)" }} />
          <div className="absolute left-[5px] -top-px h-[5px] w-[11px]" style={{ borderRadius: "6px 6px 1px 1px", background: "oklch(0.68 0.18 45)" }} />
          <div className="absolute left-[14px] top-[2px] h-[2px] w-[5px] rounded-[1px]" style={{ background: "oklch(0.68 0.18 45)" }} />
          <div data-arm="1" className="absolute left-3 top-3 h-[14px] w-1 rounded-[2px]" style={{ background: "oklch(0.55 0.12 155)", transformOrigin: "2px 2px" }}>
            <div className="absolute left-0 -bottom-[3px] h-1 w-1 rounded-full" style={{ background: "oklch(0.76 0.07 55)" }} />
          </div>
        </div>
        {/* mẹ */}
        <div ref={momRef} className="pointer-events-none absolute bottom-[17%] left-0 z-[3] h-[46px] w-[22px] will-change-transform" style={{ transformOrigin: "50% 100%" }}>
          <div data-leg="1" className="absolute left-[6px] top-7 h-[18px] w-1 rounded-[2px]" style={{ background: "oklch(0.94 0.01 90)", transformOrigin: "top center" }} />
          <div data-leg="2" className="absolute left-3 top-7 h-[18px] w-1 rounded-[2px]" style={{ background: "oklch(0.94 0.01 90)", transformOrigin: "top center" }} />
          <div className="absolute left-[5px] top-[11px] h-[19px] w-3" style={{ borderRadius: "5px 5px 2px 2px", background: "oklch(0.68 0.13 10)" }} />
          <div className="absolute left-[6px] top-px h-[10px] w-[10px] rounded-full" style={{ background: "oklch(0.76 0.07 55)" }} />
          <div className="absolute left-[3px] top-0 h-4 w-2" style={{ borderRadius: "5px 2px 4px 4px", background: "oklch(0.22 0.02 50)" }} />
          <div className="absolute left-[2px] -top-[2px] h-1 w-[18px] rounded-full" style={{ background: "oklch(0.88 0.07 90)" }} />
          <div data-arm="1" className="absolute left-3 top-3 h-[14px] w-1 rounded-[2px]" style={{ background: "oklch(0.68 0.13 10)", transformOrigin: "2px 2px" }}>
            <div className="absolute left-0 -bottom-[3px] h-1 w-1 rounded-full" style={{ background: "oklch(0.76 0.07 55)" }} />
          </div>
        </div>
        {/* bé */}
        <div ref={kidRef} className="pointer-events-none absolute bottom-[17%] left-0 z-[3] h-[46px] w-[22px] will-change-transform" style={{ transformOrigin: "50% 100%" }}>
          <div data-leg="1" className="absolute left-[6px] top-7 h-[18px] w-1 rounded-[2px]" style={{ background: "oklch(0.55 0.1 250)", transformOrigin: "top center" }} />
          <div data-leg="2" className="absolute left-3 top-7 h-[18px] w-1 rounded-[2px]" style={{ background: "oklch(0.55 0.1 250)", transformOrigin: "top center" }} />
          <div className="absolute left-[5px] top-[11px] h-[19px] w-3" style={{ borderRadius: "5px 5px 2px 2px", background: "oklch(0.85 0.15 95)" }} />
          <div className="absolute left-[6px] top-px h-[10px] w-[10px] rounded-full" style={{ background: "oklch(0.76 0.07 55)" }} />
          <div className="absolute left-[5px] -top-px h-[6px] w-3" style={{ borderRadius: "6px 6px 1px 1px", background: "oklch(0.4 0.03 50)" }} />
          <div data-arm="1" className="absolute left-3 top-3 h-[14px] w-1 rounded-[2px]" style={{ background: "oklch(0.85 0.15 95)", transformOrigin: "2px 2px" }}>
            <div className="absolute left-0 -bottom-[3px] h-1 w-1 rounded-full" style={{ background: "oklch(0.76 0.07 55)" }} />
          </div>
        </div>

        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-[90px]" style={{ background: `linear-gradient(180deg, transparent, ${TH.page})` }} />

        <div ref={heroTextRef} className="container-page relative z-[3] text-white will-change-transform" style={{ paddingTop: w < 640 ? 64 : 92 }}>
          <div data-in="0" className="flex gap-2 text-sm opacity-0" style={{ transform: "translateY(22px)", transition: "opacity .9s ease, transform .9s cubic-bezier(.2,.7,.2,1)", color: "oklch(0.9 0.02 220)" }}>
            <Link href="/" className="!text-[oklch(0.9_0.02_220)] hover:!text-white">Trang chủ</Link><span>/</span><span className="font-bold text-white">Cafe săn mây</span>
          </div>
          <h1 data-in="1" className="mt-4 text-[13px] font-bold uppercase tracking-[0.14em] opacity-0" style={{ transform: "translateY(22px)", transition: "opacity .9s ease .1s, transform .9s cubic-bezier(.2,.7,.2,1) .1s", color: "oklch(0.88 0.12 80)" }}>Quán cafe Tà Xùa · cà phê săn mây theo khu</h1>
          <p data-in="2" className="mt-3.5 max-w-[760px] text-[clamp(32px,6vw,60px)] font-extrabold leading-[1.02] tracking-[-0.035em] opacity-0" style={{ transform: "translateY(22px)", transition: "opacity .9s ease .2s, transform .9s cubic-bezier(.2,.7,.2,1) .2s", textShadow: "0 2px 24px oklch(0.2 0.05 260 / .4)" }}>Một ly nóng, mây dâng tới lan can</p>
          <p data-in="3" className="mt-3.5 max-w-[520px] text-[clamp(15px,1.7vw,18px)] leading-[1.5] opacity-0" style={{ transform: "translateY(22px)", transition: "opacity .9s ease .3s, transform .9s cubic-bezier(.2,.7,.2,1) .3s", color: "oklch(0.97 0.02 80)" }}>Cafe săn mây quanh Tà Xùa: quán mở sớm đón mây dày 5h30–9h, quán hướng tây cho hoàng hôn 16h30–18h. Cuối tuần bàn mép ban công hết rất nhanh.</p>
        </div>
      </section>

      {/* SEARCH */}
      <div data-in="4" className="container-page relative z-[4] -mt-[70px] opacity-0" style={{ transform: "translateY(22px)", transition: "opacity .9s ease .4s, transform .9s cubic-bezier(.2,.7,.2,1) .4s" }}>
        <div className="flex flex-col gap-2 rounded-[22px] border border-white/80 p-2.5 shadow-[0_24px_60px_-24px_oklch(0.25_0.06_220_/.45)]" style={{ background: "oklch(1 0 0 / .9)", backdropFilter: "blur(14px)" }}>
          <div className="grid gap-1.5" style={{ gridTemplateColumns: wide ? "1.4fr 1.2fr 1fr 1fr" : "repeat(auto-fit,minmax(min(100%,150px),1fr))" }}>
            <label className={cell}>
              <span className="text-xs font-semibold text-gray-500">Tìm quán</span>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tên quán, đặc điểm…" className={inp} />
            </label>
            <label className={cell}>
              <span className="text-xs font-semibold text-gray-500">Khung giờ</span>
              <select value={meal} onChange={(e) => setMeal(e.target.value)} className={inp}>
                {MEALS.map(([v, n]) => <option key={v} value={v}>{n}</option>)}
              </select>
            </label>
            <label className={cell}>
              <span className="text-xs font-semibold text-gray-500">Tiện ích</span>
              <select value={grp} onChange={(e) => setGrp(e.target.value)} className={inp}>
                {GRPS.map(([v, n]) => <option key={v} value={v}>{n}</option>)}
              </select>
            </label>
            <label className={cell}>
              <span className="text-xs font-semibold text-gray-500">Ngày</span>
              <input type="date" value={di} onChange={(e) => setDi(e.target.value)} className={inp} />
            </label>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 px-1 py-0.5">
            <div className="flex flex-wrap gap-1.5">
              {([["all", `Tất cả (${cafes.length})`], ...areaList.map(([a, n]) => [a, `${a} (${n})`] as [string, string])] as [string, string][]).map(([k, label]) => (
                <button key={k} type="button" onClick={() => setArea(k)} className="cursor-pointer whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-bold transition" style={{ background: area === k ? TH.G : "oklch(0.95 0.01 200)", color: area === k ? "white" : "oklch(0.35 0.02 160)" }}>{label}</button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              {hasFilter && <button type="button" onClick={clearAll} className="cursor-pointer px-3 py-2 text-sm font-bold" style={{ color: "oklch(0.45 0.02 160)" }}>Xoá lọc</button>}
              <span className="text-sm font-semibold" style={{ color: "oklch(0.45 0.02 160)" }}>{items.length} quán</span>
            </div>
          </div>
        </div>
      </div>

      {/* LIST */}
      <main ref={listRef} className="container-page flex flex-col gap-[22px] pb-16 pt-9">
        {/* Tips */}
        <div className="grid gap-3 sm:grid-cols-3">
          {tips.map((tp) => (
            <div key={tp.k} className="flex items-start gap-3 rounded-2xl border border-[oklch(0.92_0.01_200)] bg-white px-4 py-3.5">
              <div className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[10px] text-[13px] font-extrabold" style={{ background: "oklch(0.95 0.025 155)", color: "oklch(0.36 0.08 155)" }}>{tp.k}</div>
              <div>
                <div className="text-sm font-extrabold text-ink">{tp.t}</div>
                <div className="mt-0.5 text-[13px] leading-[1.5]" style={{ color: "oklch(0.45 0.02 160)" }}>{tp.d}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-[clamp(22px,2.6vw,28px)] font-extrabold tracking-[-0.02em] text-ink">{listTitle}</div>
            <div className="mt-1 text-sm" style={{ color: "oklch(0.48 0.02 160)" }}>{listSub}</div>
          </div>
          <div className="inline-flex gap-1 rounded-xl bg-[oklch(0.93_0.01_200)] p-1">
            {([["rec", "Gợi ý"], ["early", "Mở sớm"], ["late", "Đóng muộn"]] as const).map(([k, n]) => (
              <button key={k} type="button" onClick={() => setSort(k)} className="rounded-[9px] px-3 py-1.5 text-[13px] font-bold transition" style={{ background: sort === k ? "white" : "transparent", color: sort === k ? TH.G : "oklch(0.42 0.02 160)", boxShadow: sort === k ? "0 1px 3px oklch(0.2 0.03 160 / .15)" : "none" }}>{n}</button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))] sm:gap-[22px]">
          {items.map((s, j) => {
            const dawn = s.open <= 5.5;
            const sun = s.slots.includes("sunset") && s.close >= 18;
            const st: [string, string, string] =
              meal === "dawn" || (meal === "all" && dawn)
                ? ["Mở " + fmtH(s.open), "oklch(0.95 0.06 70)", "oklch(0.48 0.15 50)"]
                : meal === "sunset" && sun
                  ? ["Hướng hoàng hôn", "oklch(0.95 0.06 70)", "oklch(0.48 0.15 50)"]
                  : di && wk && s.am.includes("view")
                    ? ["Cuối tuần đông", "oklch(0.95 0.03 250)", "oklch(0.42 0.1 250)"]
                    : ["Đang mở", "oklch(0.95 0.05 155)", "oklch(0.38 0.1 155)"];
            const kind = s.am.includes("stay") ? "Homestay & cafe" : s.am.includes("food") ? "Cafe & ăn" : /bar|cocktail/i.test(s.name + " " + s.tags.join(" ")) ? "Bar" : "Cafe";
            const cta = s.am.includes("stay") ? "Xem homestay" : "Xem quán";
            return (
              <article
                key={s.id}
                data-reveal="1"
                className="group flex flex-col overflow-hidden rounded-[22px] border border-[oklch(0.92_0.01_200)] bg-white opacity-0 transition hover:shadow-[0_24px_50px_-24px_oklch(0.25_0.06_220_/.4)]"
                style={{ transform: "translateY(24px)", transitionProperty: "opacity, transform, box-shadow", transitionDuration: ".6s", transitionDelay: `${(j % 3) * 0.08}s` }}
              >
                <div className="relative aspect-[16/11] overflow-hidden sm:aspect-[4/3]">
                  {s.image ? (
                    <Image src={s.image} alt={s.name} fill sizes="(max-width:640px) 50vw, 360px" className="object-cover transition duration-700 group-hover:scale-[1.04]" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-5xl" style={{ background: "linear-gradient(160deg, oklch(0.9 0.04 150), oklch(0.82 0.05 120))" }}>☕</div>
                  )}
                  <div className="pointer-events-none absolute inset-x-2.5 top-2.5 flex justify-between gap-1.5 sm:inset-x-3 sm:top-3">
                    <div className="flex min-w-0 gap-1.5">
                      <span className="truncate rounded-full bg-white px-2 py-0.5 text-[11px] font-bold sm:px-2.5 sm:py-1 sm:text-xs" style={{ color: "oklch(0.3 0.04 160)" }}>{kind}</span>
                      {s.feat && <span className="rounded-full px-2 py-0.5 text-[11px] font-bold text-white sm:px-2.5 sm:py-1 sm:text-xs" style={{ background: "oklch(0.68 0.18 45)" }}>Gợi ý</span>}
                    </div>
                    <span className="hidden whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold sm:inline-block" style={{ background: st[1], color: st[2] }}>{st[0]}</span>
                  </div>
                  <div className="pointer-events-none absolute bottom-2.5 left-2.5 sm:bottom-3 sm:left-3">
                    <span className="rounded-full px-2 py-0.5 text-[11px] font-bold text-white sm:px-2.5 sm:py-1 sm:text-xs" style={{ background: "oklch(0.15 0.03 200 / .55)", backdropFilter: "blur(6px)" }}>{fmtH(s.open)}–{fmtH(s.close)}</span>
                  </div>
                </div>
                <div className="flex flex-1 flex-col gap-1.5 p-3 pt-2.5 sm:gap-2 sm:p-5 sm:pt-[18px]">
                  <div className="flex justify-between gap-2 text-[11px] font-semibold sm:text-[13px]" style={{ color: "oklch(0.5 0.02 160)" }}>
                    <span>{s.area}</span>
                    {s.dist && <span className="hidden whitespace-nowrap sm:inline">{s.dist}</span>}
                  </div>
                  <div className="line-clamp-2 text-[15px] font-extrabold leading-[1.25] tracking-[-0.015em] text-ink sm:line-clamp-none sm:text-[19px]">{s.name}</div>
                  {s.desc && <div className="line-clamp-2 text-[13px] leading-[1.5] sm:line-clamp-3 sm:text-sm sm:leading-[1.55]" style={{ color: "oklch(0.42 0.02 160)" }}>{s.desc}</div>}
                  <div className="mt-0.5 hidden flex-wrap gap-1.5 sm:flex">
                    {s.tags.map((a) => (
                      <span key={a} className="whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: "oklch(0.95 0.025 155)", color: "oklch(0.36 0.08 155)" }}>{a}</span>
                    ))}
                  </div>
                  <div className="flex-1" />
                  <div className="mt-1 flex items-end justify-between gap-2 border-t border-[oklch(0.94_0.01_200)] pt-2.5 sm:mt-0 sm:gap-2.5 sm:pt-3">
                    <div className="min-w-0">
                      <div className="text-[11px] sm:text-xs" style={{ color: "oklch(0.5 0.02 160)" }}>{s.priceText ? "Đồ uống từ" : "Giá"}</div>
                      <div className="font-extrabold leading-[1.2] tracking-[-0.02em]" style={{ color: s.priceText ? TH.price : "oklch(0.42 0.02 160)" }}>
                        <span className={s.priceText ? "text-[17px] sm:text-[21px]" : "text-[13px] sm:text-[15px]"}>{s.priceText || "Theo menu quán"}</span>
                      </div>
                    </div>
                    <div className="flex flex-none gap-1.5">
                      <a href={s.mapUrl} target="_blank" rel="noopener noreferrer" className="hidden whitespace-nowrap rounded-full border-[1.5px] px-3.5 py-2.5 text-sm font-bold sm:inline-flex" style={{ borderColor: "oklch(0.88 0.02 160)", color: "oklch(0.3 0.05 160)" }}>Bản đồ</a>
                      <Link href={`/cafe/${s.slug}`} className="whitespace-nowrap rounded-full px-3 py-2 text-xs font-bold text-white transition group-hover:bg-sunset-500 sm:px-4 sm:py-2.5 sm:text-sm" style={{ background: TH.btn }}>{cta}</Link>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        {items.length === 0 && (
          <div className="rounded-[22px] border-[1.5px] border-dashed border-[oklch(0.85_0.02_200)] bg-white px-6 py-12 text-center text-[15px]" style={{ color: "oklch(0.45 0.02 160)" }}>
            Chưa có quán phù hợp. Thử đổi khung giờ hoặc khu vực, hoặc <SiteZaloLink className="font-bold text-forest-700">nhắn Zalo</SiteZaloLink> để được gợi ý.
          </div>
        )}

        <div className="mt-2.5 rounded-[18px] border border-[oklch(0.9_0.04_155)] bg-[oklch(0.95_0.025_155)] px-5 py-4 text-sm leading-[1.6]" style={{ color: "oklch(0.3 0.05 160)" }}>
          <b>Lưu ý:</b> giá và giờ mở cửa do từng quán quy định, có thể đổi theo mùa, nên xác nhận trực tiếp. Muốn "săn mây tại giường" thay vì ra quán? Chọn{" "}
          <Link href="/homestay" className="font-bold text-forest-700 underline underline-offset-2">homestay view mây</Link> khu Đỉnh Gió. Đói bụng? Xem{" "}
          <Link href="/nha-hang" className="font-bold text-forest-700 underline underline-offset-2">danh sách nhà hàng Tà Xùa</Link>.
        </div>

        <div className="mt-3.5 flex flex-col gap-3 border-t border-[oklch(0.91_0.01_200)] pt-6">
          <div className="text-[15px] font-bold" style={{ color: "oklch(0.45 0.02 160)" }}>Dịch vụ khác tại Tà Xùa</div>
          <div className="flex flex-wrap gap-2">
            {others.map(([href, label]) => (
              <Link key={href} href={href} className="whitespace-nowrap rounded-full border border-[oklch(0.88_0.02_160)] bg-white px-4 py-2.5 text-[15px] font-semibold text-[oklch(0.3_0.05_160)]">{label}</Link>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
