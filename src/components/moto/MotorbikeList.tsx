"use client";

import { SitePhone } from "@/components/SiteContact";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { DateField } from "@/components/DateField";
import { useSearchNav } from "@/components/useSearchNav";

export interface RentalBike {
  id: string;
  serviceSlug: string;
  shopTitle: string;
  name: string;
  image: string | null;
  pricePerDay: number;
  totalUnits: number;
  deliveryFee: number | null;
  kind: "Xe số" | "Xe côn tay" | "Xe địa hình";
  featured: boolean;
  available: number | null;
  state: "ok" | "low" | "full" | "unk";
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

const ST: Record<RentalBike["state"], { bg: string; fg: string }> = {
  ok: { bg: "oklch(0.95 0.05 155)", fg: "oklch(0.38 0.1 155)" },
  low: { bg: "oklch(0.95 0.06 70)", fg: "oklch(0.48 0.15 50)" },
  full: { bg: "oklch(0.93 0 0)", fg: "oklch(0.42 0 0)" },
  unk: { bg: "oklch(0.95 0.03 250)", fg: "oklch(0.42 0.1 250)" },
};

function vnd(n: number) {
  return n.toLocaleString("vi-VN") + "đ";
}
function k(n: number) {
  return Math.round(n / 1000) + "k";
}
function rnd(i: number, kk: number) {
  const x = Math.sin(i * 12.9898 + kk * 78.233) * 43758.5453;
  return x - Math.floor(x);
}
function fmtD(ds: string) {
  if (!ds) return "";
  const [y, m, d] = ds.split("-").map(Number);
  const wd = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"][new Date(y, m - 1, d).getDay()];
  return `${wd}, ${d}/${m}`;
}

export function MotorbikeList({ bikes, from, to }: { bikes: RentalBike[]; from: string; to: string }) {
  const { pending: searching, go } = useSearchNav();
  const [w, setW] = useState(1280);
  const [type, setType] = useState<"all" | RentalBike["kind"]>("all");
  const [mode, setMode] = useState<"shop" | "ship">("shop");
  const [ci, setCi] = useState(from);
  const [co, setCo] = useState(to);
  const [qty, setQty] = useState(1);
  const [sort, setSort] = useState<"feat" | "price">("feat");

  const sunRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const heroTextRef = useRef<HTMLDivElement>(null);
  const ridgeBackRef = useRef<HTMLDivElement>(null);
  const ridgeFrontRef = useRef<HTMLDivElement>(null);
  const busRef = useRef<HTMLDivElement>(null);
  const localRef = useRef<HTMLDivElement>(null);
  const custRef = useRef<HTMLDivElement>(null);
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
          const P = 14, kk = t % P;
          const cl = (v: number) => Math.max(0, Math.min(1, v));
          const seg = (a: number, b: number) => cl((kk - a) / (b - a));
          const eo = (v: number) => 1 - Math.pow(1 - v, 3);
          const ei = (v: number) => v * v * v;
          const lr = (a: number, b: number, v: number) => a + (b - a) * v;
          const lift = -sy * 0.12, Xc = Math.max(200, W * 0.5), Xb = Xc - 104;
          const eArr = seg(0, 2.0), prog = eArr < 0.55 ? (eArr / 0.55) * 0.9 : 0.9 + 0.1 * eo((eArr - 0.55) / 0.45);
          const bx = kk < 2.0 ? lr(-240, Xb, prog) : kk < 6.4 ? Xb : lr(Xb, W + 320, ei(seg(6.4, 8.4)));
          const brkDip = kk > 1.1 && kk < 2.5 ? Math.sin(seg(1.1, 2.5) * Math.PI * 2) * Math.exp(-seg(1.1, 2.5) * 3) * 6 : 0;
          const wheelie = kk > 6.4 && kk < 7.4 ? -Math.sin(seg(6.4, 7.4) * Math.PI) * 9 : 0;
          const run = kk < 1.1 || (kk > 6.4 && kk < 8.4);
          busRef.current.style.transform = `translate(${bx}px, ${lift + (run ? Math.sin(t * 16) * 0.8 : 0)}px) rotate(${brkDip + wheelie}deg)`;
          smokeEls.current.forEach((el, i) => {
            if (!el) return;
            const brake = i < 5;
            const t0b = brake ? 1.1 + i * 0.16 : 6.4 + (i - 5) * 0.12;
            const a = seg(t0b, t0b + 1.4);
            const wx = (brake ? Xb : Xb + 8) + 6;
            el.style.opacity = a > 0 && a < 1 ? String((1 - a) * 0.9) : "0";
            el.style.transform = `translate(${wx - a * (36 + i * 6)}px, ${lift + 4 - a * (16 + (i % 3) * 9)}px) scale(${0.5 + a * (2 + (i % 3) * 0.5)})`;
          });
          const pose = (el: HTMLDivElement | null, x: number, y: number, flip: number, mode: string, ph: number) => {
            if (!el) return;
            el.style.transform = `translate(${x}px, ${y + lift}px) scaleX(${flip})`;
            const l = el.querySelectorAll<HTMLElement>("[data-leg]");
            const sw = mode === "walk" ? Math.sin(t * 13 + ph) * 26 : 0;
            const sit = mode === "sit" ? -78 : 0;
            if (l[0]) l[0].style.transform = `rotate(${sit || sw}deg)`;
            if (l[1]) l[1].style.transform = `rotate(${sit ? sit + 8 : -sw}deg)`;
          };
          const arm = (el: HTMLDivElement | null, deg: number) => {
            const a = el && el.querySelector<HTMLElement>("[data-arm]");
            if (a) a.style.transform = `rotate(${deg}deg)`;
          };
          const shake = kk > 3.4 && kk < 5.0, shk = Math.sin(t * 16) * 9;
          const Lp = localRef.current;
          if (Lp) {
            let x: number, y = 0, mode = "stand";
            const f = 1;
            if (kk < 2.0) { x = bx + 22; y = -16; mode = "sit"; }
            else if (kk < 2.6) { const v = seg(2.0, 2.6); x = lr(Xb + 22, Xb + 78, v); y = -16 * (1 - v) - Math.sin(v * Math.PI) * 10; }
            else if (kk < 3.4) { x = lr(Xb + 78, Xc - 22, seg(2.6, 3.4)); mode = "walk"; }
            else if (kk < 5.0) x = Xc - 22;
            else if (kk < 5.8) { x = lr(Xc - 22, Xc + 34, seg(5.0, 5.8)); mode = "walk"; }
            else if (kk < 9.4) x = Xc + 34;
            else { x = lr(Xc + 34, W + 80, seg(9.4, 12)); mode = "walk"; }
            Lp.style.opacity = kk > 11.8 ? "0" : "1";
            Lp.style.zIndex = kk > 5 && kk < 5.8 ? "2" : "3";
            pose(Lp, x, y, f, mode, 0);
            arm(Lp, mode === "sit" ? -70 : shake ? -78 + shk : kk > 6.4 && kk < 9.2 ? -150 + Math.sin(t * 10) * 22 : mode === "walk" ? Math.sin(t * 13) * 18 : 0);
          }
          const Cp = custRef.current;
          if (Cp) {
            let x: number, y = 0, mode = "stand", f = -1;
            if (kk < 5.0) x = Xc;
            else if (kk < 5.9) { x = lr(Xc, Xb + 26, seg(5.0, 5.9)); mode = "walk"; }
            else if (kk < 6.3) { const v = seg(5.9, 6.3); x = Xb + 22; y = -16 * v - Math.sin(v * Math.PI) * 8; f = 1; mode = "sit"; }
            else { x = bx + 22; y = -16; f = 1; mode = "sit"; }
            Cp.style.opacity = kk >= 8.6 && kk < 12.4 ? "0" : kk >= 12.4 ? String(seg(12.4, 13.2)) : "1";
            if (kk >= 12.4) { x = Xc; y = 0; f = -1; mode = "stand"; }
            pose(Cp, x, y, f, mode, 1.5);
            arm(Cp, mode === "sit" ? -70 : shake ? -78 - shk : mode === "walk" ? Math.sin(t * 13 + 1.5) * 18 : kk < 2.2 ? Math.sin(t * 2) * 4 : 0);
          }
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { window.removeEventListener("resize", onR); cancelAnimationFrame(raf); io?.disconnect(); };
  }, []);

  // Sau khi tìm (hoặc mở trang đã có sẵn ngày), cuộn xuống danh sách xe —
  // trên mobile hero + ô tìm kiếm che hết kết quả. Chạy sau khi kết quả mới render.
  useEffect(() => {
    if (!from) return;
    const el = listRef.current;
    if (!el) return;
    const id = window.setTimeout(() => {
      window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 12, behavior: "smooth" });
    }, 90);
    return () => window.clearTimeout(id);
  }, [from, to, bikes]);

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
  const ship = mode === "ship";
  const dateErr = ci && co && co < ci ? "Ngày trả xe phải sau hoặc trùng ngày nhận." : "";
  const days = ci ? (co && co > ci ? Math.round((+new Date(co) - +new Date(ci)) / 864e5) + 1 : 1) : 0;

  function search() {
    if (dateErr) return;
    const p = new URLSearchParams();
    if (ci) p.set("from", ci);
    if (co && co !== ci) p.set("to", co);
    go(`/thue-xe-may${p.toString() ? `?${p.toString()}` : ""}`);
  }

  const items = useMemo(() => {
    let arr = bikes.filter((b) => type === "all" || b.kind === type);
    arr = [...arr].sort((a, b) =>
      sort === "price" ? a.pricePerDay - b.pricePerDay : (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || a.pricePerDay - b.pricePerDay,
    );
    return arr;
  }, [bikes, type, sort]);

  const searched = Boolean(from);
  const FEE = 30000;
  const listTitle = from ? `Xe trống ${fmtD(from)}${to && to !== from ? ` → ${fmtD(to)}` : ""}` : "Xe máy cho thuê tại Tà Xùa";
  const listSub = `${items.length} loại xe · ${ship ? "giao tận nơi, phí 30k" : "nhận tại trung tâm Tà Xùa"} · cần CCCD hoặc bằng lái khi nhận xe`;

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
        {/* khói phanh / khói xả */}
        {Array.from({ length: 10 }, (_, i) => (
          <span key={i} ref={(el) => { smokeEls.current[i] = el; }} className="pointer-events-none absolute bottom-[17%] left-0 z-[4] h-[22px] w-[22px] rounded-full opacity-0 will-change-transform" style={{ background: "radial-gradient(circle, oklch(0.9 0.02 70 / .9), oklch(0.78 0.03 70 / .5) 55%, transparent 72%)", filter: "blur(1.5px)" }} />
        ))}
        {/* xe máy: phi vào, phanh, bàn giao, phóng đi */}
        <div ref={busRef} className="pointer-events-none absolute bottom-[17%] left-0 z-[2] h-[38px] w-[72px] will-change-transform" style={{ transformOrigin: "60% 100%" }}>
          <div className="absolute left-[66px] top-3 h-4 w-[110px]" style={{ background: "linear-gradient(90deg, oklch(0.97 0.1 90 / .55), transparent)", clipPath: "polygon(0 35%,100% 0,100% 100%,0 65%)", filter: "blur(2px)" }} />
          <div className="absolute left-5 top-[14px] h-[9px] w-[30px]" style={{ borderRadius: "8px 3px 4px 6px", background: "oklch(0.68 0.17 50)" }} />
          <div className="absolute left-4 top-[10px] h-[6px] w-6" style={{ borderRadius: "4px 4px 1px 1px", background: "oklch(0.2 0.01 160)" }} />
          <div className="absolute left-[46px] top-[6px] h-[18px] w-1 rounded-[2px]" style={{ background: "oklch(0.35 0.01 160)", transform: "rotate(18deg)" }} />
          <div className="absolute left-[44px] top-1 h-[3px] w-3 rounded-[2px]" style={{ background: "oklch(0.25 0.01 160)" }} />
          <div className="absolute left-14 top-[10px] h-[7px] w-[7px] rounded-full" style={{ background: "oklch(0.98 0.1 95)", boxShadow: "0 0 10px 4px oklch(0.96 0.12 95 / .55)" }} />
          <div className="absolute left-1 top-5 h-[18px] w-[18px] rounded-full" style={{ border: "4px solid oklch(0.18 0.01 160)", background: "oklch(0.6 0.01 200)" }} />
          <div className="absolute left-[50px] top-5 h-[18px] w-[18px] rounded-full" style={{ border: "4px solid oklch(0.18 0.01 160)", background: "oklch(0.6 0.01 200)" }} />
        </div>
        {/* tài xế bản địa */}
        <div ref={localRef} className="pointer-events-none absolute bottom-[17%] left-0 z-[3] h-[46px] w-[22px] will-change-transform" style={{ transformOrigin: "50% 100%" }}>
          <div className="absolute left-[5px] top-6 h-[3px] w-3" style={{ background: "oklch(0.6 0.18 28)" }} />
          <div data-leg="1" className="absolute left-[6px] top-7 h-[18px] w-1 rounded-[2px]" style={{ background: "oklch(0.25 0.03 260)", transformOrigin: "top center" }} />
          <div data-leg="2" className="absolute left-3 top-7 h-[18px] w-1 rounded-[2px]" style={{ background: "oklch(0.25 0.03 260)", transformOrigin: "top center" }} />
          <div className="absolute left-[5px] top-[11px] h-[19px] w-3" style={{ borderRadius: "5px 5px 2px 2px", background: "oklch(0.33 0.08 270)" }} />
          <div className="absolute left-[6px] top-1 h-[10px] w-[10px] rounded-full" style={{ background: "oklch(0.74 0.07 55)" }} />
          <div className="absolute left-[5px] top-[-1px] h-[5px] w-3" style={{ borderRadius: "5px 5px 1px 1px", background: "oklch(0.3 0.07 270)" }} />
          <div className="absolute left-1 top-[3px] h-[2px] w-[14px]" style={{ background: "oklch(0.6 0.18 28)" }} />
          <div data-arm="1" className="absolute left-3 top-3 h-[14px] w-1 rounded-[2px]" style={{ background: "oklch(0.33 0.08 270)", transformOrigin: "2px 2px" }}>
            <div className="absolute left-0 h-1 w-1 rounded-full" style={{ bottom: "-3px", background: "oklch(0.74 0.07 55)" }} />
          </div>
        </div>
        {/* khách thuê xe */}
        <div ref={custRef} className="pointer-events-none absolute bottom-[17%] left-0 z-[3] h-[46px] w-[22px] will-change-transform" style={{ transformOrigin: "50% 100%" }}>
          <div className="absolute left-0 top-3 h-[14px] w-[7px] rounded-[3px]" style={{ background: "oklch(0.5 0.1 50)" }} />
          <div data-leg="1" className="absolute left-[6px] top-7 h-[18px] w-1 rounded-[2px]" style={{ background: "oklch(0.25 0.03 260)", transformOrigin: "top center" }} />
          <div data-leg="2" className="absolute left-3 top-7 h-[18px] w-1 rounded-[2px]" style={{ background: "oklch(0.25 0.03 260)", transformOrigin: "top center" }} />
          <div className="absolute left-[5px] top-[11px] h-[19px] w-3" style={{ borderRadius: "5px 5px 2px 2px", background: "oklch(0.62 0.13 250)" }} />
          <div className="absolute left-[6px] top-1 h-[10px] w-[10px] rounded-full" style={{ background: "oklch(0.74 0.07 55)" }} />
          <div className="absolute left-[5px] top-[-1px] h-[5px] w-[11px]" style={{ borderRadius: "6px 6px 1px 1px", background: "oklch(0.68 0.18 45)" }} />
          <div className="absolute left-[14px] top-[2px] h-[2px] w-[5px] rounded-[1px]" style={{ background: "oklch(0.68 0.18 45)" }} />
          <div data-arm="1" className="absolute left-3 top-3 h-[14px] w-1 rounded-[2px]" style={{ background: "oklch(0.62 0.13 250)", transformOrigin: "2px 2px" }}>
            <div className="absolute left-0 h-1 w-1 rounded-full" style={{ bottom: "-3px", background: "oklch(0.74 0.07 55)" }} />
          </div>
        </div>
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-[90px]" style={{ background: `linear-gradient(180deg, transparent, ${TH.page})` }} />

        <div ref={heroTextRef} className="container-page relative z-[3] text-white will-change-transform" style={{ paddingTop: w < 640 ? 64 : 92 }}>
          <div data-in="0" className="flex gap-2 text-sm opacity-0" style={{ transform: "translateY(22px)", transition: "opacity .9s ease, transform .9s cubic-bezier(.2,.7,.2,1)", color: "oklch(0.9 0.02 220)" }}>
            <Link href="/" className="!text-[oklch(0.9_0.02_220)] hover:!text-white">Trang chủ</Link><span>/</span><span className="font-bold text-white">Thuê xe máy</span>
          </div>
          <h1 data-in="1" className="mt-4 text-[13px] font-bold uppercase tracking-[0.14em] opacity-0" style={{ transform: "translateY(22px)", transition: "opacity .9s ease .1s, transform .9s cubic-bezier(.2,.7,.2,1) .1s", color: "oklch(0.88 0.12 80)" }}>Thuê xe máy Tà Xùa · giá thuê & xe trống theo ngày</h1>
          <p data-in="2" className="mt-3.5 max-w-[760px] text-[clamp(32px,6vw,60px)] font-extrabold leading-[1.02] tracking-[-0.035em] opacity-0" style={{ transform: "translateY(22px)", transition: "opacity .9s ease .2s, transform .9s cubic-bezier(.2,.7,.2,1) .2s", textShadow: "0 2px 24px oklch(0.2 0.05 260 / .4)" }}>Vặn ga qua đèo, đón biển mây trên đỉnh</p>
          <p data-in="3" className="mt-3.5 max-w-[520px] text-[clamp(15px,1.7vw,18px)] leading-[1.5] opacity-0" style={{ transform: "translateY(22px)", transition: "opacity .9s ease .3s, transform .9s cubic-bezier(.2,.7,.2,1) .3s", color: "oklch(0.97 0.02 80)" }}>Thuê xe máy Tà Xùa bền khoẻ, leo đèo tốt. Kèm mũ bảo hiểm, áo mưa, giao tận homestay.</p>
        </div>
      </section>

      {/* SEARCH */}
      <div data-in="4" className="container-page relative z-[4] -mt-[70px] opacity-0" style={{ transform: "translateY(22px)", transition: "opacity .9s ease .4s, transform .9s cubic-bezier(.2,.7,.2,1) .4s" }}>
        <div className="flex flex-col gap-2 rounded-[22px] border border-white/80 p-2.5 shadow-[0_24px_60px_-24px_oklch(0.25_0.06_220_/.45)]" style={{ background: "oklch(1 0 0 / .9)", backdropFilter: "blur(14px)" }}>
          <div className="flex flex-wrap items-center justify-between gap-2 p-0.5">
            <div className="flex flex-wrap gap-1">
              {(["all", "Xe số", "Xe côn tay", "Xe địa hình"] as const).map((kk) => (
                <button key={kk} type="button" onClick={() => setType(kk)} className="rounded-full px-3.5 py-2 text-sm font-bold transition" style={{ background: type === kk ? TH.G : "oklch(0.95 0.01 200)", color: type === kk ? "white" : "oklch(0.35 0.02 160)" }}>{kk === "all" ? "Tất cả" : kk}</button>
              ))}
            </div>
            <div className="inline-flex gap-[3px] rounded-full bg-[oklch(0.95_0.01_200)] p-[3px]">
              {([["shop", "Nhận tại cửa hàng"], ["ship", "Giao tận nơi"]] as const).map(([kk, n]) => (
                <button key={kk} type="button" onClick={() => setMode(kk)} className="rounded-full px-3 py-1.5 text-[13px] font-bold transition" style={{ background: mode === kk ? "white" : "transparent", color: mode === kk ? TH.G : "oklch(0.42 0.02 160)", boxShadow: mode === kk ? "0 1px 3px oklch(0.2 0.03 160 / .15)" : "none" }}>{n}</button>
              ))}
            </div>
          </div>
          <div className="grid gap-1.5" style={{ gridTemplateColumns: wide ? "1fr 1fr 150px auto" : "repeat(auto-fit,minmax(min(100%,150px),1fr))" }}>
            <label className={cell}>
              <span className="text-xs font-semibold text-gray-500">Ngày nhận xe</span>
              <DateField value={ci} onChange={setCi} className={inp} displayClassName="text-[15px] font-semibold text-ink" ariaLabel="Ngày nhận xe" />
            </label>
            <label className={cell}>
              <span className="text-xs font-semibold text-gray-500">Ngày trả xe</span>
              <DateField value={co} min={ci || undefined} onChange={setCo} className={inp} displayClassName="text-[15px] font-semibold text-ink" ariaLabel="Ngày trả xe" />
            </label>
            <div className={cell}>
              <span className="text-xs font-semibold text-gray-500">Số xe</span>
              <div className="flex items-center gap-2.5 pt-0.5">
                <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} className="flex h-7 w-7 items-center justify-center rounded-lg bg-white font-bold">−</button>
                <span className="min-w-[14px] text-center text-[15px] font-extrabold">{qty}</span>
                <button type="button" onClick={() => setQty((q) => Math.min(10, q + 1))} className="flex h-7 w-7 items-center justify-center rounded-lg bg-white font-bold">+</button>
              </div>
            </div>
            <button type="button" onClick={search} disabled={searching} className="flex items-center justify-center gap-2 whitespace-nowrap rounded-[14px] px-6 py-3.5 text-base font-extrabold text-white transition hover:bg-sunset-500 disabled:cursor-wait disabled:opacity-80" style={{ background: "oklch(0.68 0.18 45)" }}>Tìm xe →</button>
          </div>
          {dateErr && <div className="px-1.5 pb-1 text-[13px] font-semibold text-red-600">{dateErr}</div>}
        </div>
      </div>

      {/* LIST */}
      <main ref={listRef} className="container-page flex flex-col gap-[18px] pb-14 pt-9">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-[clamp(22px,2.6vw,28px)] font-extrabold tracking-[-0.02em] text-ink">{listTitle}</div>
            <div className="mt-1 text-sm text-gray-500">{listSub}</div>
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
          <div className="rounded-[22px] border border-dashed border-[oklch(0.85_0.02_200)] bg-white py-14 text-center">
            <div className="text-[19px] font-extrabold text-ink">Không có xe phù hợp</div>
            <div className="mt-1 text-[15px] text-gray-500">Thử đổi loại xe hoặc ngày, hoặc gọi <SitePhone /> để được hỗ trợ.</div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))] sm:gap-[22px]">
            {items.map((b, j) => {
              const stKey: RentalBike["state"] = searched ? (b.available == null ? "unk" : b.available <= 0 || b.available < qty ? "full" : b.available <= 2 ? "low" : "ok") : "unk";
              const sm = ST[stKey];
              const full = searched && (b.available != null && (b.available <= 0 || b.available < qty));
              const status = !searched
                ? "Chọn ngày để xem xe"
                : b.available == null
                  ? "Chưa cập nhật"
                  : b.available <= 0
                    ? "Hết xe"
                    : b.available < qty
                      ? `Chỉ còn ${b.available} xe`
                      : `Còn ${b.available} xe`;
              const total = days ? b.pricePerDay * days * qty + (ship ? (b.deliveryFee ?? FEE) : 0) : 0;
              const tail = (() => { const p = new URLSearchParams(); if (from) p.set("from", from); if (to) p.set("to", to); const s = p.toString(); return s ? `?${s}` : ""; })();
              const stockLabel = searched && b.available != null ? `${b.available} xe` : `${b.totalUnits} xe`;
              const feeText = ship
                ? b.deliveryFee != null
                  ? days ? `Đã gồm phí giao ${k(b.deliveryFee)}` : `Giao tận nơi +${k(b.deliveryFee)}`
                  : days ? `Đã gồm phí giao ${k(FEE)}` : `Giao tận nơi +${k(FEE)}`
                : "Nhận tại trung tâm Tà Xùa, miễn phí";
              return (
                <Link
                  key={b.id}
                  href={`/thue-xe-may/${b.serviceSlug}${tail}`}
                  data-reveal="1"
                  className="group flex flex-col overflow-hidden rounded-[22px] border border-[oklch(0.92_0.01_200)] bg-white opacity-0 transition hover:shadow-[0_24px_50px_-24px_oklch(0.25_0.06_220_/.4)]"
                  style={{ transform: "translateY(24px)", transitionProperty: "opacity, transform, box-shadow", transitionDuration: ".6s", transitionDelay: `${(j % 3) * 0.08}s` }}
                >
                  <div className="relative aspect-[16/10] overflow-hidden bg-gray-100 sm:aspect-[4/3]">
                    {b.image ? (
                      <Image src={b.image} alt={b.name} fill sizes="(max-width:640px) 50vw, 360px" className="object-cover transition duration-700 group-hover:scale-[1.04]" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-4xl">🛵</div>
                    )}
                    <div className="pointer-events-none absolute left-3 right-3 top-3 flex items-start justify-between gap-1.5">
                      <div className="flex gap-1.5">
                        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-[oklch(0.3_0.04_160)]">{b.kind}</span>
                        {b.featured && <span className="rounded-full bg-sunset-500 px-2.5 py-1 text-xs font-bold text-white">Nổi bật</span>}
                      </div>
                      <span className="whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold" style={{ background: sm.bg, color: sm.fg }}>{status}</span>
                    </div>
                  </div>
                  <div className="flex flex-1 flex-col gap-2 p-3 sm:gap-3 sm:p-5 sm:pt-[18px]">
                    <div>
                      <div className="line-clamp-1 text-[15px] font-extrabold leading-[1.3] tracking-[-0.015em] text-ink sm:text-[18px]">{b.name}</div>
                      <div className="mt-0.5 line-clamp-1 text-[12px] leading-[1.5] text-gray-500 sm:mt-1 sm:text-sm">{b.shopTitle}</div>
                    </div>
                    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[14px] bg-[oklch(0.92_0.01_200)]">
                      <div className="bg-[oklch(0.975_0.006_200)] px-2.5 py-2 sm:px-3 sm:py-2.5">
                        <div className="text-[11px] font-semibold text-gray-500">Giá / ngày</div>
                        <div className="mt-0.5 whitespace-nowrap text-[14px] font-extrabold text-ink sm:text-[15px]">{k(b.pricePerDay)}</div>
                      </div>
                      <div className="bg-[oklch(0.975_0.006_200)] px-2.5 py-2 sm:px-3 sm:py-2.5">
                        <div className="text-[11px] font-semibold text-gray-500">Còn trống</div>
                        <div className="mt-0.5 whitespace-nowrap text-[15px] font-extrabold" style={{ color: stKey === "full" ? "oklch(0.52 0.17 28)" : stKey === "low" ? "oklch(0.52 0.15 50)" : "oklch(0.38 0.1 155)" }}>{stockLabel}</div>
                      </div>
                    </div>
                    <div className="flex-1" />
                    <div className="flex items-end justify-between gap-2 border-t border-[oklch(0.94_0.01_200)] pt-2 sm:gap-2.5 sm:pt-3">
                      <div className="min-w-0">
                        <div className="text-[11px] text-gray-500 sm:text-xs">{days ? `${days} ngày × ${qty} xe` : "Giá thuê"}</div>
                        <div>
                          <span className="text-[18px] font-extrabold tracking-[-0.02em] sm:text-[22px]" style={{ color: "oklch(0.34 0.07 160)" }}>{days ? vnd(total) : vnd(b.pricePerDay)}</span>
                          {!days && <span className="text-[12px] text-gray-500 sm:text-[13px]">/ngày</span>}
                        </div>
                        <div className="truncate text-[11px] font-semibold text-gray-500 sm:text-xs">{feeText}</div>
                      </div>
                      <span className="whitespace-nowrap rounded-full px-3 py-2 text-xs font-bold text-white transition group-hover:bg-sunset-500 sm:px-4 sm:py-2.5 sm:text-sm" style={{ background: full ? "oklch(0.6 0.01 160)" : TH.G }}>{full ? "Chọn ngày khác →" : "Đặt xe →"}</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        <div className="mt-6 flex flex-col gap-3 border-t border-[oklch(0.91_0.01_200)] pt-6">
          <div className="text-[15px] font-bold text-gray-500">Dịch vụ khác tại Tà Xùa</div>
          <div className="flex flex-wrap gap-2">
            {[["/xe-cabin", "Xe cabin đi Tà Xùa"], ["/homestay", "Homestay & Bungalow"], ["/xe-om", "Xe ôm"], ["/taxi", "Taxi"], ["/combo", "Combo du lịch"]].map(([href, label]) => (
              <Link key={href} href={href} className="whitespace-nowrap rounded-full border border-[oklch(0.88_0.02_160)] bg-white px-4 py-2.5 text-[15px] font-semibold text-[oklch(0.3_0.05_160)]">{label}</Link>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
