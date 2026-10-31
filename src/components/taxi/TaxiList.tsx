"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { DateField } from "@/components/DateField";

export interface TaxiRouteCard {
  id: string;
  slug: string;
  title: string;
  from: string;
  to: string;
  desc: string;
  vehicleType: string | null;
  price: number | null;
  priceNote: string | null;
  kind: "Đưa đón Bắc Yên" | "Đường dài" | "Tham quan";
  image: string | null;
  featured: boolean;
}

// Theme "Rừng núi Tây Bắc"
const TH = {
  sky: "linear-gradient(180deg, oklch(0.34 0.045 240) 0%, oklch(0.55 0.04 220) 36%, oklch(0.8 0.05 120) 66%, oklch(0.9 0.06 95) 86%, oklch(0.95 0.03 95) 100%)",
  r1: "linear-gradient(180deg, oklch(0.45 0.04 200), oklch(0.52 0.04 190))",
  r2: "linear-gradient(180deg, oklch(0.3 0.045 170), oklch(0.36 0.05 160))",
  cloud: ["oklch(0.92 0.01 220 / .75)", "oklch(0.95 0.008 210 / .88)", "oklch(0.97 0.012 85)"],
  blur: ["20px", "26px", "30px"],
  page: "oklch(0.975 0.01 150)",
  mote: "oklch(0.98 0.05 95)",
  G: "oklch(0.29 0.055 160)",
};

function vnd(n: number) {
  return n.toLocaleString("vi-VN") + "đ";
}
function rnd(i: number, kk: number) {
  const x = Math.sin(i * 12.9898 + kk * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

export function TaxiList({ routes }: { routes: TaxiRouteCard[] }) {
  const [w, setW] = useState(1280);
  const [type, setType] = useState<"all" | TaxiRouteCard["kind"]>("all");
  const [mode, setMode] = useState<"one" | "round">("one");
  const [pick, setPick] = useState("");
  const [day, setDay] = useState("");
  const [time, setTime] = useState("04:30");
  const [qty, setQty] = useState(2);
  const [sort, setSort] = useState<"feat" | "price">("feat");

  const sunRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const heroTextRef = useRef<HTMLDivElement>(null);
  const ridgeBackRef = useRef<HTMLDivElement>(null);
  const ridgeFrontRef = useRef<HTMLDivElement>(null);
  const busRef = useRef<HTMLDivElement>(null);
  const doorRef = useRef<HTMLDivElement>(null);
  const personRef = useRef<HTMLDivElement>(null);
  const bagRef = useRef<HTMLDivElement>(null);
  const custRef = useRef<HTMLDivElement>(null);
  const brakeLightRef = useRef<HTMLDivElement>(null);
  const skidRef = useRef<HTMLDivElement>(null);
  const smokeEls = useRef<(HTMLSpanElement | null)[]>([]);
  const listRef = useRef<HTMLDivElement>(null);
  const layerEls = useRef<(HTMLDivElement | null)[]>([]);
  const starEls = useRef<(HTMLSpanElement | null)[]>([]);
  const birdEls = useRef<(HTMLDivElement | null)[]>([]);
  const moteEls = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    const onR = () => setW(window.innerWidth);
    onR();
    window.addEventListener("resize", onR);
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

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
    document.querySelectorAll<HTMLElement>("[data-reveal]").forEach((el) => (io && !reduce ? io.observe(el) : ((el.style.opacity = "1"), (el.style.transform = "none"))));
    document.querySelectorAll<HTMLElement>("[data-in]").forEach((el) => {
      const kk = Number(el.dataset.in);
      setTimeout(() => { el.style.opacity = "1"; el.style.transform = "none"; }, reduce ? 0 : 250 + kk * 160);
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
          const x = ((i * 0.137) % 1) * W + Math.sin(t * 0.7 + i) * 24;
          const y = H * 0.92 - pr * span;
          el.style.transform = `translate(${x}px, ${y}px)`;
          el.style.opacity = String(Math.sin(pr * Math.PI) * 0.75);
        });
        if (busRef.current) {
          const P = 12, kk = t % P;
          const cl = (v: number) => Math.max(0, Math.min(1, v));
          const seg = (a: number, b: number) => cl((kk - a) / (b - a));
          const eo = (v: number) => 1 - Math.pow(1 - v, 3);
          const ei = (v: number) => v * v * v;
          const lr = (a: number, b: number, v: number) => a + (b - a) * v;
          const lift = -sy * 0.12;
          const Xcar = Math.max(140, W * 0.4), Dz = Xcar + 36, Cz = Xcar + 150;
          // Xe: lao vào (0-2) → dừng (2-6.6) → chạy đi (6.6-8.6)
          const cx = kk < 2 ? lr(-280, Xcar, eo(seg(0, 2))) : kk < 6.6 ? Xcar : lr(Xcar, W + 340, ei(seg(6.6, 8.6)));
          const moving = kk < 2 || (kk > 6.6 && kk < 8.6);
          busRef.current.style.transform = `translate(${cx}px, ${(moving ? Math.abs(Math.sin(t * 7)) * -1.2 : 0) + lift}px)`;
          // Cửa: mở sau khi dừng, đóng trước khi đi
          const open = seg(2.3, 2.9) - seg(6.0, 6.5);
          if (doorRef.current) doorRef.current.style.transform = `perspective(140px) rotateY(${-78 * open}deg)`;

          const pose = (el: HTMLDivElement | null, x: number, flip: number, mode: string, sc: number, ph: number) => {
            if (!el) return;
            el.style.transform = `translate(${x}px, ${lift}px) scaleX(${flip}) scale(${sc})`;
            const l = el.querySelectorAll<HTMLElement>("[data-leg]");
            const sw = mode === "walk" ? Math.sin(t * 13 + ph) * 24 : 0;
            if (l[0]) l[0].style.transform = `rotate(${sw}deg)`;
            if (l[1]) l[1].style.transform = `rotate(${-sw}deg)`;
          };
          const setArm = (el: HTMLDivElement | null, deg: number) => { const a = el && el.querySelector<HTMLElement>("[data-arm]"); if (a) a.style.transform = `rotate(${deg}deg)`; };

          // Tài xế: trong xe → xuống → tới khách lấy hành lý → mang về xe → lên xe
          const pe = personRef.current;
          if (pe) {
            let x = Dz, mode = "stand", sc = 1, op = 1;
            if (kk < 2.3) { op = 0; }
            else if (kk < 3.1) { x = lr(Dz, Cz - 24, seg(2.3, 3.1)); mode = "walk"; }
            else if (kk < 4.0) { x = Cz - 24; }
            else if (kk < 5.0) { x = lr(Cz - 24, Dz, seg(4.0, 5.0)); mode = "walk"; }
            else if (kk < 5.7) { sc = 1 - seg(5.0, 5.7) * 0.35; op = 1 - seg(5.0, 5.7); }
            else op = 0;
            const df = kk >= 4.0 && kk < 5.7 ? -1 : 1;
            pe.style.opacity = String(op);
            pe.style.zIndex = kk > 5 ? "1" : "3";
            pose(pe, x, df, mode, sc, 0);
            setArm(pe, kk >= 3.1 && kk < 4.0 ? -30 - seg(3.1, 4.0) * 45 : kk >= 4.0 && kk < 5.0 ? -120 : mode === "walk" ? Math.sin(t * 13) * 16 : 0);
          }

          // Hành lý: cạnh khách → tài xế bê về xe → vào cốp
          const bg = bagRef.current;
          if (bg) {
            let op = 1, bx = Cz - 30, by = -4, rot = 0;
            if (kk < 3.2) { bx = Cz - 30; by = -4; }
            else if (kk < 5.0) { const q = seg(3.2, 5.0); bx = lr(Cz - 30, Xcar + 18, q); by = -4 - Math.sin(Math.PI * q) * 16 - 20 * q; rot = -q * 14; }
            else if (kk < 5.4) { bx = Xcar + 18; by = -24; op = 1 - seg(5.0, 5.4); }
            else op = 0;
            bg.style.opacity = String(op);
            bg.style.transform = `translate(${bx}px, ${by + lift}px) rotate(${rot}deg)`;
          }

          // Khách: đứng chờ sẵn → đi tới xe → lên xe
          const cu = custRef.current;
          if (cu) {
            let x = Cz, mode = "stand", op = 1, sc = 1;
            if (kk < 4.8) { x = Cz; }
            else if (kk < 5.6) { x = lr(Cz, Dz + 10, seg(4.8, 5.6)); mode = "walk"; }
            else if (kk < 6.1) { x = Dz + 10; sc = 1 - seg(5.6, 6.1) * 0.35; op = 1 - seg(5.6, 6.1); }
            else if (kk < 10.4) op = 0;
            else { op = seg(10.4, 11.2); x = Cz; }
            cu.style.opacity = String(op);
            cu.style.zIndex = "3";
            pose(cu, x, -1, mode, sc, 1.6);
            setArm(cu, mode === "walk" ? Math.sin(t * 13 + 1.6) * 16 : Math.sin(t * 1.5) * 5);
          }

          // Phanh nhả khói + đèn phanh loé + vệt phanh (khi lao tới)
          const brake = kk >= 1.2 && kk <= 2.3 ? Math.sin(((kk - 1.2) / 1.1) * Math.PI) : 0;
          if (brakeLightRef.current) {
            brakeLightRef.current.style.boxShadow = `0 0 ${5 + brake * 11}px ${1 + brake * 4}px oklch(0.63 0.24 27 / ${0.25 + brake * 0.65})`;
            brakeLightRef.current.style.background = brake > 0.1 ? "oklch(0.66 0.26 27)" : "oklch(0.6 0.2 27)";
          }
          if (skidRef.current) skidRef.current.style.opacity = String(brake * 0.5);
          smokeEls.current.forEach((el, i) => {
            if (!el) return;
            const spd = 0.9 + (i % 3) * 0.3;
            const ph = (t * spd + i * 0.37) % 1;
            const grow = 7 + ph * (22 + (i % 3) * 8);
            const driftX = -ph * (24 + (i % 3) * 12) - (i % 2) * 5;
            const driftY = -ph * (12 + (i % 2) * 10) - (i % 3) * 2;
            el.style.width = `${grow}px`;
            el.style.height = `${grow}px`;
            el.style.transform = `translate(${driftX}px, ${driftY}px)`;
            el.style.opacity = String(Math.sin(ph * Math.PI) * brake * 0.85);
          });
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { window.removeEventListener("resize", onR); cancelAnimationFrame(raf); io?.disconnect(); };
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
        x: `${c.x - 6}%`, y: `${c.y}%`, w: `${c.w / 2}%`, h: `${c.h}px`, bg: L.bg, blur: L.blur,
      }));
      return { bottom: L.bottom, h: L.h, op: L.op, clouds };
    });
  }, []);
  const stars = useMemo(() => Array.from({ length: 14 }, (_, i) => ({ x: `${rnd(i, 21) * 100}%`, y: `${rnd(i, 22) * 34}%`, s: `${1.5 + rnd(i, 23) * 2}px` })), []);

  const wide = w >= 980;
  const heroH = w < 640 ? 520 : 600;
  const round = mode === "round";
  const seats = qty <= 3 ? 4 : 7;
  const cars = qty > 6 ? Math.ceil(qty / 6) : 1;
  const timeTip = qty > 6 ? `${qty} người cần ${cars} xe 7 chỗ.` : `${qty} người, gợi ý xe ${seats} chỗ.`;

  const goList = () => { const el = listRef.current; if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 12, behavior: "smooth" }); };

  const items = useMemo(() => {
    let arr = routes.filter((r) => type === "all" || r.kind === type);
    arr = [...arr].sort((a, b) =>
      sort === "price"
        ? (a.price ?? Infinity) - (b.price ?? Infinity)
        : (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || (a.price ?? Infinity) - (b.price ?? Infinity),
    );
    return arr;
  }, [routes, type, sort]);

  const detailTail = (() => { const p = new URLSearchParams(); if (day) p.set("from", day); const s = p.toString(); return s ? `?${s}` : ""; })();

  const cell = "flex min-w-0 flex-col gap-0.5 rounded-[14px] bg-[oklch(0.965_0.01_200)] px-3.5 py-2.5";
  const inp = "min-w-0 border-0 bg-transparent p-0 text-[15px] font-semibold text-ink outline-none";

  return (
    <div style={{ background: TH.page }}>
      {/* HERO */}
      <section className="relative overflow-hidden" style={{ height: heroH, background: TH.sky }}>
        <div ref={sunRef} className="absolute left-[74%] top-0 -ml-[75px] h-[150px] w-[150px] rounded-full will-change-transform" style={{ background: "radial-gradient(circle, oklch(0.98 0.07 90) 0%, oklch(0.93 0.13 75) 45%, oklch(0.85 0.15 60 / 0) 72%)" }} />
        <div ref={glowRef} className="pointer-events-none absolute left-0 right-0 top-[30%] h-[60%]" style={{ background: "radial-gradient(ellipse 60% 50% at 74% 60%, oklch(0.92 0.12 70 / .55), transparent 70%)" }} />
        <div className="pointer-events-none absolute inset-0">
          {stars.map((st, i) => (
            <span key={i} ref={(el) => { starEls.current[i] = el; }} className="absolute rounded-full bg-white opacity-70" style={{ left: st.x, top: st.y, width: st.s, height: st.s }} />
          ))}
        </div>
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} ref={(el) => { birdEls.current[i] = el; }} className="pointer-events-none absolute left-0 top-0 z-[2] h-[10px] will-change-transform" style={{ width: `${14 + (i % 3) * 5}px` }}>
            <span data-wl="1" className="absolute right-1/2 top-1 h-[2px] w-[52%] rounded-[2px]" style={{ background: "oklch(0.26 0.04 200)", transformOrigin: "right center" }} />
            <span data-wr="1" className="absolute left-1/2 top-1 h-[2px] w-[52%] rounded-[2px]" style={{ background: "oklch(0.26 0.04 200)", transformOrigin: "left center" }} />
          </div>
        ))}
        <div ref={ridgeBackRef} className="absolute -left-[5%] -right-[5%] bottom-[22%] h-[38%] opacity-75 will-change-transform" style={{ background: TH.r1, clipPath: "polygon(0 100%,0 62%,9% 48%,17% 58%,27% 30%,36% 50%,44% 40%,55% 12%,63% 38%,72% 28%,82% 52%,91% 36%,100% 50%,100% 100%)" }} />
        <div ref={ridgeFrontRef} className="absolute -left-[5%] -right-[5%] bottom-[12%] h-[34%] will-change-transform" style={{ background: TH.r2, clipPath: "polygon(0 100%,0 55%,8% 62%,18% 40%,24% 52%,33% 22%,40% 44%,50% 34%,58% 56%,68% 26%,76% 46%,86% 30%,94% 54%,100% 44%,100% 100%)" }} />
        <div className="pointer-events-none absolute -left-[5%] -right-[5%] bottom-[14%] h-[96px]" style={{ WebkitMaskImage: "linear-gradient(180deg, black 45%, transparent 92%)", maskImage: "linear-gradient(180deg, black 45%, transparent 92%)" }}>
          <div className="absolute inset-0" style={{ background: "linear-gradient(-45deg, oklch(0.27 0.05 165) 50%, transparent 50%) 0px 100% / 29px 86px repeat-x, linear-gradient(45deg, oklch(0.27 0.05 165) 50%, transparent 50%) 0px 100% / 29px 86px repeat-x" }} />
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
        {/* taxi: phi vào giữa, mở cửa, tài xế xuống vác hành lý */}
        <div ref={busRef} className="pointer-events-none absolute bottom-[16%] left-0 z-[2] h-[60px] w-[120px] will-change-transform">
          <div className="absolute left-[112px] top-[30px] h-[18px] w-[130px]" style={{ background: "linear-gradient(90deg, oklch(0.97 0.1 90 / .55), transparent)", clipPath: "polygon(0 35%,100% 0,100% 100%,0 65%)", filter: "blur(2px)" }} />
          <div className="absolute left-[30px] top-[-1px] h-[11px] w-[60px] text-center" style={{ borderRadius: "3px 3px 1px 1px", background: "oklch(0.88 0.16 95)", border: "1px solid oklch(0.5 0.1 70)", fontSize: "6px", fontWeight: 900, lineHeight: "11px", color: "oklch(0.25 0.05 60)", whiteSpace: "nowrap" }}>TAXI TÀ XÙA</div>
          <div className="absolute left-[22px] top-[10px] h-5 w-[76px]" style={{ borderRadius: "12px 18px 2px 2px", background: "oklch(0.96 0.005 200)" }} />
          <div className="absolute left-[30px] top-[14px] h-3 w-[26px]" style={{ borderRadius: "6px 2px 1px 1px", background: "oklch(0.55 0.05 230)" }} />
          <div className="absolute left-[59px] top-[14px] h-3 w-[30px]" style={{ borderRadius: "2px 10px 1px 1px", background: "oklch(0.55 0.05 230)" }} />
          <div className="absolute left-[6px] top-[28px] h-5 w-[110px]" style={{ borderRadius: "8px 12px 6px 6px", background: "oklch(0.96 0.005 200)", boxShadow: "0 6px 14px oklch(0.15 0.03 200 / .45)" }} />
          <div className="absolute left-[6px] top-[35px] h-1 w-[110px]" style={{ background: "oklch(0.45 0.1 160)" }} />
          <div className="absolute left-[58px] top-[30px] h-4 w-px" style={{ background: "oklch(0.8 0.01 200)" }} />
          <div className="absolute right-[2px] top-[31px] h-[5px] w-[7px]" style={{ borderRadius: "2px 4px 2px 2px", background: "oklch(0.98 0.1 95)", boxShadow: "0 0 12px 5px oklch(0.96 0.12 95 / .6)" }} />
          <div ref={brakeLightRef} className="absolute left-[6px] top-[31px] h-1 w-[5px] rounded-[1px] will-change-transform" style={{ background: "oklch(0.6 0.2 27)" }} />
          {/* vệt phanh dưới bánh */}
          <div ref={skidRef} className="absolute left-[-22px] top-[58px] h-[3px] w-[46px] opacity-0" style={{ background: "linear-gradient(90deg, transparent, oklch(0.2 0.01 160 / .55) 40%, oklch(0.2 0.01 160 / .7))", borderRadius: "2px", filter: "blur(.5px)" }} />
          {/* khói phanh (bánh sau) */}
          {Array.from({ length: 6 }, (_, i) => (
            <span
              key={i}
              ref={(el) => { smokeEls.current[i] = el; }}
              className="absolute rounded-full opacity-0 will-change-transform"
              style={{ left: `${8 + (i % 3) * 6}px`, top: `${44 - (i % 2) * 4}px`, width: "10px", height: "10px", background: "radial-gradient(circle, oklch(0.9 0.006 160 / .95), oklch(0.82 0.008 160 / 0) 70%)", pointerEvents: "none" }}
            />
          ))}
          {/* khoang cửa (tối) + cánh cửa mở */}
          <div className="absolute left-[30px] top-[15px] h-7 w-[26px]" style={{ borderRadius: "6px 2px 2px 2px", background: "oklch(0.22 0.02 200)" }} />
          <div ref={doorRef} className="absolute left-[30px] top-[14px] h-[30px] w-[27px] will-change-transform" style={{ transformOrigin: "right center" }}>
            <div className="absolute inset-0" style={{ borderRadius: "6px 2px 3px 3px", background: "oklch(0.95 0.005 200)", border: "1px solid oklch(0.82 0.01 200)" }} />
            <div className="absolute left-[3px] top-[2px] h-[10px] w-[21px]" style={{ borderRadius: "5px 2px 1px 1px", background: "oklch(0.55 0.05 230)" }} />
            <div className="absolute left-0 top-[19px] h-1 w-[27px]" style={{ background: "oklch(0.45 0.1 160)" }} />
            <div className="absolute left-[19px] top-[16px] h-[2px] w-[5px] rounded-[1px]" style={{ background: "oklch(0.5 0.01 200)" }} />
          </div>
          <div className="absolute left-4 top-10 h-5 w-5 rounded-full" style={{ background: "oklch(0.18 0.01 160)", border: "4px solid oklch(0.3 0.01 160)" }} />
          <div className="absolute left-[84px] top-10 h-5 w-5 rounded-full" style={{ background: "oklch(0.18 0.01 160)", border: "4px solid oklch(0.3 0.01 160)" }} />
          <div className="absolute left-[23px] top-[47px] h-1.5 w-1.5 rounded-full" style={{ background: "oklch(0.8 0.01 200)" }} />
          <div className="absolute left-[91px] top-[47px] h-1.5 w-1.5 rounded-full" style={{ background: "oklch(0.8 0.01 200)" }} />
        </div>
        {/* tài xế */}
        <div ref={personRef} className="pointer-events-none absolute bottom-[16%] left-0 z-[3] h-[60px] w-7 opacity-0 will-change-transform" style={{ transformOrigin: "center bottom" }}>
          <div className="absolute left-px top-[3px] h-[9px] w-[26px]" style={{ background: "oklch(0.8 0.09 85)", clipPath: "polygon(50% 0, 100% 100%, 0 100%)" }} />
          <div className="absolute left-[9px] top-[11px] h-[10px] w-[10px] rounded-full" style={{ background: "oklch(0.72 0.07 55)" }} />
          <div data-leg="1" className="absolute left-[9px] top-[38px] h-[22px] w-[5px] rounded-[2px]" style={{ background: "oklch(0.25 0.03 260)", transformOrigin: "top center" }} />
          <div data-leg="2" className="absolute left-[15px] top-[38px] h-[22px] w-[5px] rounded-[2px]" style={{ background: "oklch(0.25 0.03 260)", transformOrigin: "top center" }} />
          <div className="absolute left-[6px] top-5 h-5 w-4" style={{ borderRadius: "6px 6px 3px 3px", background: "oklch(0.42 0.09 160)" }} />
          <div data-arm="1" className="absolute left-[18px] top-[22px] h-[14px] w-1 rounded-[2px]" style={{ background: "oklch(0.42 0.09 160)", transformOrigin: "top center" }} />
        </div>
        {/* hành lý */}
        <div ref={bagRef} className="pointer-events-none absolute bottom-[16%] left-0 z-[4] h-4 w-[34px] opacity-0 will-change-transform" style={{ transformOrigin: "center" }}>
          <div className="absolute left-0 top-2 h-1 w-[10px] rounded-[2px]" style={{ background: "oklch(0.3 0.03 260)", transform: "rotate(25deg)", transformOrigin: "right center" }} />
          <div className="absolute left-[-2px] top-3 h-[3px] w-[5px] rounded-[1px]" style={{ background: "oklch(0.95 0.01 90)" }} />
          <div className="absolute left-2 top-1 h-[9px] w-[17px]" style={{ borderRadius: "4px 5px 4px 4px", background: "oklch(0.62 0.13 250)" }} />
          <div className="absolute left-3 top-px h-[5px] w-2" style={{ borderRadius: "2px", background: "oklch(0.55 0.1 50)" }} />
          <div className="absolute left-[23px] top-[2px] h-[10px] w-[10px] rounded-full" style={{ background: "oklch(0.85 0.05 60)" }} />
          <div className="absolute left-6 top-[-1px] h-[5px] w-[10px]" style={{ borderRadius: "5px 5px 1px 1px", background: "oklch(0.68 0.18 45)" }} />
          <div className="absolute left-8 top-[2px] h-[2px] w-1 rounded-[1px]" style={{ background: "oklch(0.68 0.18 45)" }} />
        </div>
        {/* khách đứng chờ */}
        <div ref={custRef} className="pointer-events-none absolute bottom-[16%] left-0 z-[3] h-[60px] w-7 will-change-transform" style={{ transformOrigin: "center bottom" }}>
          <div data-leg="1" className="absolute left-[9px] top-[38px] h-[22px] w-[5px] rounded-[2px]" style={{ background: "oklch(0.25 0.03 260)", transformOrigin: "top center" }} />
          <div data-leg="2" className="absolute left-[15px] top-[38px] h-[22px] w-[5px] rounded-[2px]" style={{ background: "oklch(0.25 0.03 260)", transformOrigin: "top center" }} />
          <div className="absolute left-[6px] top-5 h-5 w-4" style={{ borderRadius: "6px 6px 3px 3px", background: "oklch(0.62 0.13 250)" }} />
          <div className="absolute left-[9px] top-[11px] h-[10px] w-[10px] rounded-full" style={{ background: "oklch(0.74 0.07 55)" }} />
          <div className="absolute left-[6px] top-[8px] h-[5px] w-[15px]" style={{ borderRadius: "6px 6px 1px 1px", background: "oklch(0.68 0.18 45)" }} />
          <div className="absolute left-[19px] top-[10px] h-[2px] w-[6px] rounded-[1px]" style={{ background: "oklch(0.68 0.18 45)" }} />
          <div data-arm="1" className="absolute left-[18px] top-[22px] h-[14px] w-1 rounded-[2px]" style={{ background: "oklch(0.62 0.13 250)", transformOrigin: "top center" }} />
        </div>
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-[90px]" style={{ background: `linear-gradient(180deg, transparent, ${TH.page})` }} />

        <div ref={heroTextRef} className="container-page relative z-[3] text-white will-change-transform" style={{ paddingTop: w < 640 ? 64 : 92 }}>
          <div data-in="0" className="flex gap-2 text-sm opacity-0" style={{ transform: "translateY(22px)", transition: "opacity .9s ease, transform .9s cubic-bezier(.2,.7,.2,1)", color: "oklch(0.9 0.02 220)" }}>
            <Link href="/" className="!text-[oklch(0.9_0.02_220)] hover:!text-white">Trang chủ</Link><span>/</span><span className="font-bold text-white">Taxi</span>
          </div>
          <div data-in="1" className="mt-4 text-[13px] font-bold uppercase tracking-[0.14em] opacity-0" style={{ transform: "translateY(22px)", transition: "opacity .9s ease .1s, transform .9s cubic-bezier(.2,.7,.2,1) .1s", color: "oklch(0.88 0.12 80)" }}>Tà Xùa · 2.865m · Bắc Yên, Sơn La</div>
          <h1 data-in="2" className="mt-3.5 max-w-[760px] text-[clamp(32px,6vw,60px)] font-extrabold leading-[1.02] tracking-[-0.035em] opacity-0" style={{ transform: "translateY(22px)", transition: "opacity .9s ease .2s, transform .9s cubic-bezier(.2,.7,.2,1) .2s", textShadow: "0 2px 24px oklch(0.2 0.05 260 / .4)" }}>Xe riêng cho cả nhóm, qua đèo tới biển mây</h1>
          <p data-in="3" className="mt-3.5 max-w-[520px] text-[clamp(15px,1.7vw,18px)] leading-[1.5] opacity-0" style={{ transform: "translateY(22px)", transition: "opacity .9s ease .3s, transform .9s cubic-bezier(.2,.7,.2,1) .3s", color: "oklch(0.97 0.02 80)" }}>Taxi 4 và 7 chỗ gầm cao, tài xế quen đường đèo Tà Xùa. Chọn tuyến, ngày và số người để gửi yêu cầu.</p>
        </div>
      </section>

      {/* SEARCH */}
      <div data-in="4" className="container-page relative z-[4] -mt-[70px] opacity-0" style={{ transform: "translateY(22px)", transition: "opacity .9s ease .4s, transform .9s cubic-bezier(.2,.7,.2,1) .4s" }}>
        <div className="flex flex-col gap-2 rounded-[22px] border border-white/80 p-2.5 shadow-[0_24px_60px_-24px_oklch(0.25_0.06_220_/.45)]" style={{ background: "oklch(1 0 0 / .9)", backdropFilter: "blur(14px)" }}>
          <div className="flex flex-wrap items-center justify-between gap-2 p-0.5">
            <div className="flex flex-wrap gap-1">
              {(["all", "Đưa đón Bắc Yên", "Đường dài", "Tham quan"] as const).map((kk) => (
                <button key={kk} type="button" onClick={() => setType(kk)} className="rounded-full px-3.5 py-2 text-sm font-bold transition" style={{ background: type === kk ? TH.G : "oklch(0.95 0.01 200)", color: type === kk ? "white" : "oklch(0.35 0.02 160)" }}>{kk === "all" ? "Tất cả" : kk}</button>
              ))}
            </div>
            <div className="inline-flex gap-[3px] rounded-full bg-[oklch(0.95_0.01_200)] p-[3px]">
              {([["one", "Một chiều"], ["round", "Khứ hồi"]] as const).map(([kk, n]) => (
                <button key={kk} type="button" onClick={() => setMode(kk)} className="rounded-full px-3 py-1.5 text-[13px] font-bold transition" style={{ background: mode === kk ? "white" : "transparent", color: mode === kk ? TH.G : "oklch(0.42 0.02 160)", boxShadow: mode === kk ? "0 1px 3px oklch(0.2 0.03 160 / .15)" : "none" }}>{n}</button>
              ))}
            </div>
          </div>
          <div className="grid gap-1.5" style={{ gridTemplateColumns: wide ? "1.4fr 1fr 0.8fr 150px auto" : "repeat(auto-fit,minmax(min(100%,150px),1fr))" }}>
            <label className={cell}>
              <span className="text-xs font-semibold text-gray-500">Đón tại</span>
              <input value={pick} onChange={(e) => setPick(e.target.value)} placeholder="Tên homestay hoặc điểm đón" className={inp} />
            </label>
            <label className={cell}>
              <span className="text-xs font-semibold text-gray-500">Ngày</span>
              <DateField value={day} onChange={setDay} className={inp} displayClassName="text-[15px] font-semibold text-ink" ariaLabel="Ngày" />
            </label>
            <label className={cell}>
              <span className="text-xs font-semibold text-gray-500">Giờ đón</span>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={inp} />
            </label>
            <div className={cell}>
              <span className="text-xs font-semibold text-gray-500">Số người</span>
              <div className="flex items-center gap-2.5 pt-0.5">
                <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} className="flex h-7 w-7 items-center justify-center rounded-lg bg-white font-bold">−</button>
                <span className="min-w-[14px] text-center text-[15px] font-extrabold">{qty}</span>
                <button type="button" onClick={() => setQty((q) => Math.min(16, q + 1))} className="flex h-7 w-7 items-center justify-center rounded-lg bg-white font-bold">+</button>
              </div>
            </div>
            <button type="button" onClick={goList} className="flex items-center justify-center gap-2 whitespace-nowrap rounded-[14px] px-6 py-3.5 text-base font-extrabold text-white transition hover:bg-sunset-500" style={{ background: "oklch(0.68 0.18 45)" }}>Xem tuyến →</button>
          </div>
          <div className="px-1.5 pb-1 text-[13px] font-semibold" style={{ color: "oklch(0.45 0.1 155)" }}>{timeTip}</div>
        </div>
      </div>

      {/* LIST */}
      <main ref={listRef} className="container-page flex flex-col gap-[18px] pb-14 pt-9">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-[clamp(22px,2.6vw,28px)] font-extrabold tracking-[-0.02em] text-ink">Tuyến taxi Tà Xùa</div>
            <div className="mt-1 text-sm text-gray-500">{items.length} tuyến · xe 4 và 7 chỗ gầm cao · giá theo chuyến, xác nhận qua điện thoại</div>
          </div>
          {items.length > 0 && (
            <div className="inline-flex gap-1 rounded-xl bg-[oklch(0.93_0.01_200)] p-1">
              {([["feat", "Nổi bật"], ["price", "Giá thấp"]] as const).map(([kk, n]) => (
                <button key={kk} type="button" onClick={() => setSort(kk)} className="rounded-[9px] px-3 py-1.5 text-[13px] font-bold transition" style={{ background: sort === kk ? "white" : "transparent", color: sort === kk ? TH.G : "oklch(0.42 0.02 160)", boxShadow: sort === kk ? "0 1px 3px oklch(0.2 0.03 160 / .15)" : "none" }}>{n}</button>
              ))}
            </div>
          )}
        </div>

        {items.length === 0 ? (
          <div className="rounded-[22px] border border-dashed border-[oklch(0.85_0.02_200)] bg-white py-14 text-center text-[15px] text-gray-500">
            Chưa có tuyến này. Gọi 0397 943 155, tụi mình báo giá xe cho bạn.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))] sm:gap-[22px]">
            {items.map((r, j) => {
              const noPrice = r.price == null;
              const note = noPrice
                ? r.priceNote || "Báo giá khi gọi lại"
                : round
                  ? "Khứ hồi: liên hệ xác nhận giá"
                  : r.priceNote || "Giá cả xe, không tính theo người";
              return (
                <Link
                  key={r.id}
                  href={`/taxi/${r.slug}${detailTail}`}
                  data-reveal="1"
                  className="group flex flex-col overflow-hidden rounded-[22px] border border-[oklch(0.92_0.01_200)] bg-white opacity-0 transition hover:shadow-[0_24px_50px_-24px_oklch(0.25_0.06_220_/.4)]"
                  style={{ transform: "translateY(24px)", transitionProperty: "opacity, transform, box-shadow", transitionDuration: ".6s", transitionDelay: `${(j % 3) * 0.08}s` }}
                >
                  <div className="relative aspect-[16/10] overflow-hidden bg-gray-100">
                    {r.image ? (
                      <Image src={r.image} alt={r.to} fill sizes="(max-width:640px) 50vw, 360px" className="object-cover transition duration-700 group-hover:scale-[1.04]" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-4xl">🚕</div>
                    )}
                    <div className="pointer-events-none absolute left-3 right-3 top-3 flex items-start justify-between gap-1.5">
                      <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-[oklch(0.3_0.04_160)]">{r.kind}</span>
                      {r.featured && <span className="rounded-full bg-sunset-500 px-2.5 py-1 text-xs font-bold text-white">Nổi bật</span>}
                    </div>
                  </div>
                  <div className="flex flex-1 flex-col gap-2 p-3 sm:gap-3 sm:p-5 sm:pt-[18px]">
                    <div className="grid items-center gap-x-2.5 gap-y-0.5" style={{ gridTemplateColumns: "14px minmax(0,1fr)" }}>
                      <span className="h-2.5 w-2.5 rounded-full border-2" style={{ borderColor: TH.G }} />
                      <div className="truncate text-[13px] font-semibold text-gray-500">Đón: {pick || r.from}</div>
                      <span className="mx-auto h-3 w-[2px]" style={{ background: "repeating-linear-gradient(180deg, oklch(0.75 0.02 200) 0 3px, transparent 3px 6px)" }} />
                      <span />
                      <span className="h-2.5 w-2.5 rounded-full bg-sunset-500" />
                      <div className="line-clamp-1 text-[15px] font-extrabold leading-[1.25] tracking-[-0.015em] text-ink sm:text-[18px]">{r.to}</div>
                    </div>
                    <div className="line-clamp-2 text-[12px] leading-[1.5] text-gray-500 sm:text-sm">{r.desc}</div>
                    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[14px] bg-[oklch(0.92_0.01_200)]">
                      <div className="bg-[oklch(0.975_0.006_200)] px-3 py-2.5">
                        <div className="text-[11px] font-semibold text-gray-500">Phương tiện</div>
                        <div className="mt-0.5 truncate text-[15px] font-extrabold text-ink">{r.vehicleType || `Xe ${seats} chỗ`}</div>
                      </div>
                      <div className="bg-[oklch(0.975_0.006_200)] px-3 py-2.5">
                        <div className="text-[11px] font-semibold text-gray-500">Chiều</div>
                        <div className="mt-0.5 text-[15px] font-extrabold text-ink">{round ? "Khứ hồi" : "Một chiều"}</div>
                      </div>
                    </div>
                    <div className="flex-1" />
                    <div className="flex items-end justify-between gap-2.5 border-t border-[oklch(0.94_0.01_200)] pt-3">
                      <div>
                        <div className="text-xs text-gray-500">{noPrice ? "Giá" : "Một chiều / chuyến"}</div>
                        <div className="font-extrabold tracking-[-0.02em]" style={{ fontSize: noPrice ? 16 : 22, color: noPrice ? "oklch(0.42 0.1 250)" : "oklch(0.6 0.18 45)" }}>{noPrice ? "Liên hệ xác nhận giá" : vnd(r.price!)}</div>
                        <div className="text-xs font-semibold text-gray-500">{note}</div>
                      </div>
                      <span className="whitespace-nowrap rounded-full px-4 py-2.5 text-sm font-bold text-white transition group-hover:bg-sunset-500" style={{ background: TH.G }}>Gửi yêu cầu →</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-[oklch(0.92_0.01_200)] bg-white px-[18px] py-4">
          <div className="max-w-[640px] text-sm leading-[1.5] text-gray-600">Giá theo chuyến, đã gồm cầu đường. Sau khi bạn gửi yêu cầu, tụi mình gọi lại xác nhận xe, tài xế và giờ đón.</div>
          <a href="https://zalo.me/0397943155" target="_blank" rel="noopener noreferrer" className="whitespace-nowrap rounded-full px-4 py-2.5 text-sm font-bold text-white" style={{ background: "oklch(0.68 0.18 45)" }}>Hỏi nhanh qua Zalo</a>
        </div>

        <div className="mt-6 flex flex-col gap-3 border-t border-[oklch(0.91_0.01_200)] pt-6">
          <div className="text-[15px] font-bold text-gray-500">Dịch vụ khác tại Tà Xùa</div>
          <div className="flex flex-wrap gap-2">
            {[["/xe-cabin", "Xe cabin đi Tà Xùa"], ["/homestay", "Homestay & Bungalow"], ["/thue-xe-may", "Thuê xe máy"], ["/xe-om", "Xe ôm"], ["/combo", "Combo du lịch"]].map(([href, label]) => (
              <Link key={href} href={href} className="whitespace-nowrap rounded-full border border-[oklch(0.88_0.02_160)] bg-white px-4 py-2.5 text-[15px] font-semibold text-[oklch(0.3_0.05_160)]">{label}</Link>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
