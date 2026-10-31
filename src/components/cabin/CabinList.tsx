"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DateField } from "@/components/DateField";

interface TripAvail {
  id: string;
  departureTime: string;
  priceSingle: number;
  priceDouble: number | null;
  pickupPoint: string;
  dropoffPoint: string;
}
export interface CabinOperator {
  id: string;
  slug: string;
  title: string;
  area: string | null;
  coverImage: string | null;
  outbound: TripAvail | null;
  ret: TripAvail | null;
  fromPrice: number | null;
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

const ST: Record<CabinOperator["state"], { bg: string; fg: string; text: string }> = {
  ok: { bg: "oklch(0.95 0.05 155)", fg: "oklch(0.38 0.1 155)", text: "Còn chỗ" },
  low: { bg: "oklch(0.95 0.06 70)", fg: "oklch(0.48 0.15 50)", text: "Còn ít chỗ" },
  full: { bg: "oklch(0.93 0 0)", fg: "oklch(0.42 0 0)", text: "Hết chỗ" },
  unk: { bg: "oklch(0.95 0.03 250)", fg: "oklch(0.42 0.1 250)", text: "Chưa cập nhật" },
};

// Các tỉnh có thể đón khách đi Tà Xùa.
const FROMS = ["Hà Nội", "Bắc Ninh", "Bắc Giang", "Thái Nguyên", "Vĩnh Phúc", "Hưng Yên", "Hải Dương", "Hải Phòng", "Nam Định", "Ninh Bình", "Hà Nam", "Phú Thọ"];

function vnd(n: number) {
  return n.toLocaleString("vi-VN") + "đ";
}
function rnd(i: number, k: number) {
  const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return x - Math.floor(x);
}
function fmtD(ds: string) {
  if (!ds) return "";
  const [y, m, d] = ds.split("-").map(Number);
  const wd = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"][new Date(y, m - 1, d).getDay()];
  return `${wd}, ${d}/${m}`;
}

export function CabinList({
  operators,
  from,
  to,
  pickup: initialPickup = "",
}: {
  operators: CabinOperator[];
  from: string;
  to: string;
  pickup?: string;
}) {
  const router = useRouter();
  const [w, setW] = useState(1280);
  const [trip, setTrip] = useState<"one" | "round">(to ? "round" : "one");
  const [pickup, setPickup] = useState(initialPickup && FROMS.includes(initialPickup) ? initialPickup : "Hà Nội");
  const [di, setDi] = useState(from);
  const [ve, setVe] = useState(to);
  const [pax, setPax] = useState(2);
  const [sort, setSort] = useState<"time" | "price">("time");

  const sunRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const heroTextRef = useRef<HTMLDivElement>(null);
  const ridgeBackRef = useRef<HTMLDivElement>(null);
  const ridgeFrontRef = useRef<HTMLDivElement>(null);
  const busRef = useRef<HTMLDivElement>(null);
  const doorRef = useRef<HTMLDivElement>(null);
  const stopRef = useRef<HTMLDivElement>(null);
  const pax1Ref = useRef<HTMLDivElement>(null);
  const pax2Ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
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
      const k = Number(el.dataset.in);
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
        // Xe cabin: chạy nhanh vào → phanh gấp (khói) → mở cửa → khách lên → chạy đi.
        if (busRef.current) {
          const P = 13, k = t % P;
          const cl = (v: number) => Math.max(0, Math.min(1, v));
          const seg = (a: number, b: number) => cl((k - a) / (b - a));
          const eo = (v: number) => 1 - Math.pow(1 - v, 3);
          const ei = (v: number) => v * v * v;
          const lift = -sy * 0.12;
          const Xb = Math.max(60, W * 0.42 - 75);
          const doorX = Xb + 112;
          const e2 = seg(0, 2.0), brk = e2 < 0.55 ? 0 : (e2 - 0.55) / 0.45;
          const prog = e2 < 0.55 ? (e2 / 0.55) * 0.88 : 0.88 + 0.12 * eo(brk);
          const bx = k < 2.0 ? -260 + (Xb + 260) * prog : k < 7.4 ? Xb : Xb + (W + 260 - Xb) * ei(seg(7.4, 9.6));
          const dip = k > 1.1 && k < 2.6 ? Math.sin(seg(1.1, 2.6) * Math.PI * 2.2) * Math.exp(-seg(1.1, 2.6) * 3) * 3.2 : 0;
          const moving = k < 1.1 || (k > 7.4 && k < 9.6);
          busRef.current.style.transform = `translate(${bx}px, ${(moving ? Math.sin(t * 14) * 0.9 : 0) + lift}px) rotate(${dip}deg)`;
          smokeEls.current.forEach((el, i) => {
            if (!el) return;
            const ts = 1.05 + (i % 5) * 0.16, a = seg(ts, ts + 1.6), rear = i < 5, wx = Xb + (rear ? 22 : 102);
            el.style.opacity = a > 0 && a < 1 ? String((1 - a) * (rear ? 0.95 : 0.7)) : "0";
            el.style.transform = `translate(${wx - a * (40 + i * 7)}px, ${lift + 6 - a * (22 + (i % 3) * 10)}px) scale(${0.5 + a * (2.2 + (i % 3) * 0.5)})`;
          });
          if (stopRef.current) stopRef.current.style.transform = `translate(${doorX + 34}px, ${lift}px)`;
          const open = seg(2.6, 3.0) - seg(6.6, 7.0);
          if (doorRef.current) doorRef.current.style.transform = `translateX(${-17 * open}px) scaleX(${1 - open * 0.15})`;
          [pax1Ref.current, pax2Ref.current].forEach((el, i) => {
            if (!el) return;
            const s0 = 3.1 + i * 1.5, walk = seg(s0, s0 + 1.1), up = seg(s0 + 1.1, s0 + 1.6);
            const x0 = doorX + 60 + i * 26, x = x0 + (doorX - x0) * walk;
            el.style.opacity = String(k < 2.4 || k > s0 + 1.6 ? (k < 2.4 && k > 0.2 ? 1 : 0) : 1 - up);
            el.style.transform = `translate(${x}px, ${lift - up * 8}px) scale(${1 - up * 0.2})`;
            const sw = walk > 0 && walk < 1 ? Math.sin(t * 12 + i) * 24 : up > 0 && up < 1 ? Math.sin(t * 8) * 12 : 0;
            const legs = el.querySelectorAll<HTMLElement>("[data-leg]");
            if (legs[0]) legs[0].style.transform = `rotate(${sw}deg)`;
            if (legs[1]) legs[1].style.transform = `rotate(${-sw}deg)`;
          });
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { window.removeEventListener("resize", onR); cancelAnimationFrame(raf); io?.disconnect(); };
  }, []);

  // Sau khi tìm vé (hoặc mở trang đã có sẵn ngày), cuộn xuống danh sách nhà xe —
  // trên mobile hero + ô tìm kiếm che hết kết quả. Chạy sau khi kết quả mới render.
  useEffect(() => {
    if (!(from || to)) return;
    const el = listRef.current;
    if (!el) return;
    const id = window.setTimeout(() => {
      window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 12, behavior: "smooth" });
    }, 90);
    return () => window.clearTimeout(id);
  }, [from, to, operators]);

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
  const round = trip === "round";
  const dateErr = round && di && ve && ve < di ? "Ngày về phải sau hoặc trùng ngày đi." : "";

  function search() {
    if (dateErr) return;
    const p = new URLSearchParams();
    if (di) p.set("from", di);
    if (round && ve) p.set("to", ve);
    if (pickup && pickup !== "Hà Nội") p.set("pickup", pickup);
    router.push(`/xe-cabin${p.toString() ? `?${p.toString()}` : ""}`, { scroll: false });
  }

  const sorted = useMemo(() => {
    const arr = [...operators];
    arr.sort((a, b) =>
      sort === "price"
        ? (a.fromPrice ?? Infinity) - (b.fromPrice ?? Infinity)
        : (a.outbound?.departureTime ?? "99").localeCompare(b.outbound?.departureTime ?? "99"),
    );
    return arr;
  }, [operators, sort]);

  const searched = Boolean(from || to);
  const listTitle = from ? `Chuyến ${fmtD(from)}${round && to ? ` · về ${fmtD(to)}` : ""}` : "Nhà xe đi Tà Xùa";
  const listSub = searched
    ? `${operators.length} nhà xe${round ? " có khứ hồi" : ""} · đón tại ${pickup} → Tà Xùa · chọn nhà xe để đặt vé`
    : `Đón tại ${pickup} → Tà Xùa. Chọn ngày đi (và ngày về nếu khứ hồi) để xem nhà xe còn chỗ.`;

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
        {/* pine silhouette */}
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
        {/* biển "ĐÓN" */}
        <div ref={stopRef} className="pointer-events-none absolute bottom-[17%] left-0 z-[1] h-16 w-[26px] will-change-transform">
          <div className="absolute left-3 top-3.5 h-[50px] w-[3px]" style={{ background: "oklch(0.55 0.01 200)" }} />
          <div className="absolute left-0 top-0 flex h-[18px] w-[26px] items-center justify-center rounded border-2 border-white text-[7px] font-black tracking-wide text-white" style={{ background: "oklch(0.45 0.1 160)" }}>ĐÓN</div>
        </div>
        {/* khói phanh gấp */}
        {Array.from({ length: 10 }, (_, i) => (
          <span key={i} ref={(el) => { smokeEls.current[i] = el; }} className="pointer-events-none absolute bottom-[17%] left-0 z-[3] h-[26px] w-[26px] rounded-full opacity-0 will-change-transform" style={{ background: "radial-gradient(circle, oklch(0.92 0.005 200 / .95), oklch(0.8 0.01 200 / .6) 55%, transparent 72%)", filter: "blur(1.5px)" }} />
        ))}
        {/* xe cabin: chạy vào → phanh → mở cửa → đón khách → chạy đi */}
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
        {[pax1Ref, pax2Ref].map((ref, idx) => (
          <div key={idx} ref={ref} className="pointer-events-none absolute bottom-[17%] left-0 z-[3] h-11 w-5 opacity-0 will-change-transform" style={{ transformOrigin: "center bottom" }}>
            <div className="absolute left-[5px] top-0 h-2.5 w-2.5 rounded-full" style={{ background: "oklch(0.82 0.06 60)" }} />
            <div className="absolute left-1 top-[-2px] h-[5px] w-3" style={{ borderRadius: "6px 6px 1px 1px", background: idx === 0 ? "oklch(0.68 0.18 45)" : "oklch(0.9 0.02 90)" }} />
            <div className="absolute left-[-1px] top-3 h-3.5 w-2 rounded" style={{ background: "oklch(0.5 0.1 50)" }} />
            <div data-leg="1" className="absolute left-[5px] top-[27px] h-[17px] w-1 rounded-sm" style={{ background: "oklch(0.28 0.03 260)", transformOrigin: "top center" }} />
            <div data-leg="2" className="absolute left-[11px] top-[27px] h-[17px] w-1 rounded-sm" style={{ background: "oklch(0.28 0.03 260)", transformOrigin: "top center" }} />
            <div className="absolute left-1 top-2.5 h-[18px] w-3" style={{ borderRadius: "5px 5px 2px 2px", background: idx === 0 ? "oklch(0.6 0.13 250)" : "oklch(0.62 0.15 15)" }} />
          </div>
        ))}
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-[90px]" style={{ background: `linear-gradient(180deg, transparent, ${TH.page})` }} />

        <div ref={heroTextRef} className="container-page relative z-[3] text-white will-change-transform" style={{ paddingTop: w < 640 ? 64 : 92 }}>
          <div data-in="0" className="flex gap-2 text-sm opacity-0" style={{ transform: "translateY(22px)", transition: "opacity .9s ease, transform .9s cubic-bezier(.2,.7,.2,1)", color: "oklch(0.9 0.02 220)" }}>
            <Link href="/" className="!text-[oklch(0.9_0.02_220)] hover:!text-white">Trang chủ</Link><span>/</span><span className="font-bold text-white">Xe cabin</span>
          </div>
          <div data-in="1" className="mt-4 text-[13px] font-bold uppercase tracking-[0.14em] opacity-0" style={{ transform: "translateY(22px)", transition: "opacity .9s ease .1s, transform .9s cubic-bezier(.2,.7,.2,1) .1s", color: "oklch(0.88 0.12 80)" }}>Tà Xùa · 2.865m · Bắc Yên, Sơn La</div>
          <h1 data-in="2" className="mt-3.5 max-w-[760px] text-[clamp(32px,6vw,60px)] font-extrabold leading-[1.02] tracking-[-0.035em] opacity-0" style={{ transform: "translateY(22px)", transition: "opacity .9s ease .2s, transform .9s cubic-bezier(.2,.7,.2,1) .2s", textShadow: "0 2px 24px oklch(0.2 0.05 260 / .4)" }}>Ngủ một giấc trên xe, mở mắt là biển mây</h1>
          <p data-in="3" className="mt-3.5 max-w-[520px] text-[clamp(15px,1.7vw,18px)] leading-[1.5] opacity-0" style={{ transform: "translateY(22px)", transition: "opacity .9s ease .3s, transform .9s cubic-bezier(.2,.7,.2,1) .3s", color: "oklch(0.97 0.02 80)" }}>Xe cabin giường nằm Hà Nội ⇄ Tà Xùa, chạy đêm, có trung chuyển lên đỉnh. Chọn ngày để xem nhà xe còn chỗ.</p>
        </div>
      </section>

      {/* SEARCH */}
      <div data-in="4" className="container-page relative z-[4] -mt-[70px] opacity-0" style={{ transform: "translateY(22px)", transition: "opacity .9s ease .4s, transform .9s cubic-bezier(.2,.7,.2,1) .4s" }}>
        <div className="flex flex-col gap-2 rounded-[22px] border border-white/80 p-2.5 shadow-[0_24px_60px_-24px_oklch(0.25_0.06_220_/.45)]" style={{ background: "oklch(1 0 0 / .9)", backdropFilter: "blur(14px)" }}>
          <div className="flex gap-1 p-0.5">
            {([["one", "Một chiều"], ["round", "Khứ hồi"]] as const).map(([k, n]) => (
              <button key={k} type="button" onClick={() => setTrip(k)} className="rounded-full px-3.5 py-2 text-sm font-bold transition" style={{ background: trip === k ? TH.G : "oklch(0.95 0.01 200)", color: trip === k ? "white" : "oklch(0.35 0.02 160)" }}>{n}</button>
            ))}
          </div>
          <div className="grid gap-1.5" style={{ gridTemplateColumns: wide ? (round ? "1.1fr 1fr 1fr 150px auto" : "1.1fr 1fr 150px auto") : "repeat(auto-fit,minmax(min(100%,150px),1fr))" }}>
            <label className={cell}>
              <span className="text-xs font-semibold text-gray-500">Điểm đón</span>
              <select value={pickup} onChange={(e) => setPickup(e.target.value)} className={inp}>
                {FROMS.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </label>
            <label className={cell}>
              <span className="text-xs font-semibold text-gray-500">Ngày đi</span>
              <DateField value={di} onChange={setDi} className={inp} displayClassName="text-[15px] font-semibold text-ink" ariaLabel="Ngày đi" />
            </label>
            {round && (
              <label className={cell}>
                <span className="text-xs font-semibold text-gray-500">Ngày về</span>
                <DateField value={ve} min={di || undefined} onChange={setVe} className={inp} displayClassName="text-[15px] font-semibold text-ink" ariaLabel="Ngày về" />
              </label>
            )}
            <div className={cell}>
              <span className="text-xs font-semibold text-gray-500">Số khách</span>
              <div className="flex items-center gap-2.5 pt-0.5">
                <button type="button" onClick={() => setPax((p) => Math.max(1, p - 1))} className="flex h-7 w-7 items-center justify-center rounded-lg bg-white font-bold">−</button>
                <span className="min-w-[14px] text-center text-[15px] font-extrabold">{pax}</span>
                <button type="button" onClick={() => setPax((p) => Math.min(20, p + 1))} className="flex h-7 w-7 items-center justify-center rounded-lg bg-white font-bold">+</button>
              </div>
            </div>
            <button type="button" onClick={search} className="flex items-center justify-center gap-2 whitespace-nowrap rounded-[14px] px-6 py-3.5 text-base font-extrabold text-white transition hover:bg-sunset-500" style={{ background: "oklch(0.68 0.18 45)" }}>Tìm vé →</button>
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
          {operators.length > 0 && (
            <div className="inline-flex gap-1 rounded-xl bg-[oklch(0.93_0.01_200)] p-1">
              {([["time", "Giờ đi sớm"], ["price", "Giá thấp"]] as const).map(([k, n]) => (
                <button key={k} type="button" onClick={() => setSort(k)} className="rounded-[9px] px-3 py-1.5 text-[13px] font-bold transition" style={{ background: sort === k ? "white" : "transparent", color: sort === k ? TH.G : "oklch(0.42 0.02 160)", boxShadow: sort === k ? "0 1px 3px oklch(0.2 0.03 160 / .15)" : "none" }}>{n}</button>
              ))}
            </div>
          )}
        </div>

        {!searched ? (
          <div className="rounded-[22px] border border-dashed border-[oklch(0.85_0.02_200)] bg-white py-14 text-center text-[15px] text-gray-500">
            Chọn ngày đi (và ngày về nếu khứ hồi) rồi bấm “Tìm vé”.
          </div>
        ) : operators.length === 0 ? (
          <div className="rounded-[22px] border border-dashed border-[oklch(0.85_0.02_200)] bg-white py-14 text-center">
            <div className="text-[19px] font-extrabold text-ink">Không có nhà xe phù hợp</div>
            <div className="mt-1 text-[15px] text-gray-500">Thử đổi ngày, hoặc gọi 0397 943 155 để được hỗ trợ.</div>
          </div>
        ) : (
          <div className="grid gap-[22px]" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(min(100%,330px),1fr))" }}>
            {sorted.map((op, j) => {
              const sm = ST[op.state];
              const full = op.state === "full";
              const unit = op.fromPrice;
              const tail = (() => { const p = new URLSearchParams(); if (from) p.set("from", from); if (to) p.set("to", to); if (pickup && pickup !== "Hà Nội") p.set("pickup", pickup); const s = p.toString(); return s ? `?${s}` : ""; })();
              const amen: string[] = [];
              const anyTrip = op.outbound ?? op.ret;
              if (anyTrip) amen.push("Cabin đơn");
              if (anyTrip?.priceDouble != null) amen.push("Cabin đôi");
              if (op.ret) amen.push("Khứ hồi");
              const cta = full ? "Chọn ngày khác →" : op.state === "unk" ? "Gửi yêu cầu →" : "Xem & đặt vé →";
              return (
                <Link
                  key={op.id}
                  href={`/xe-cabin/${op.slug}${tail}`}
                  data-reveal="1"
                  className="group flex flex-col overflow-hidden rounded-[22px] border border-[oklch(0.92_0.01_200)] bg-white opacity-0 transition hover:shadow-[0_24px_50px_-24px_oklch(0.25_0.06_220_/.4)]"
                  style={{ transform: "translateY(24px)", transitionProperty: "opacity, transform, box-shadow", transitionDuration: ".6s", transitionDelay: `${(j % 3) * 0.08}s` }}
                >
                  <div className="relative aspect-[16/10] overflow-hidden bg-gray-100">
                    {op.coverImage ? (
                      <Image src={op.coverImage} alt={op.title} fill sizes="(max-width:640px) 100vw, 360px" className="object-cover transition duration-700 group-hover:scale-[1.04]" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-4xl">🚐</div>
                    )}
                    <div className="pointer-events-none absolute left-3 right-3 top-3 flex items-start justify-between gap-1.5">
                      {op.ret ? <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-[oklch(0.3_0.04_160)]">Có khứ hồi</span> : <span />}
                      <span className="whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold" style={{ background: sm.bg, color: sm.fg }}>{sm.text}</span>
                    </div>
                  </div>
                  <div className="flex flex-1 flex-col gap-3 p-5 pt-[18px]">
                    <div>
                      <div className="text-[18px] font-extrabold leading-[1.3] tracking-[-0.015em] text-ink">{op.title}</div>
                      <div className="mt-[3px] text-[13px] font-semibold text-gray-500">{op.area ?? (anyTrip ? `${anyTrip.pickupPoint} → ${anyTrip.dropoffPoint}` : "Hà Nội → Tà Xùa")}</div>
                    </div>
                    <div className="grid items-center gap-3 rounded-[14px] bg-[oklch(0.97_0.008_200)] px-3.5 py-3" style={{ gridTemplateColumns: "auto minmax(0,1fr) auto" }}>
                      <div>
                        <div className="text-[22px] font-extrabold leading-none tracking-[-0.02em]">{op.outbound?.departureTime ?? "—"}</div>
                        <div className="mt-[3px] text-xs text-gray-500">{op.outbound?.pickupPoint ?? "Hà Nội"}</div>
                      </div>
                      <div className="flex flex-col items-center gap-1">
                        <div className="whitespace-nowrap text-[11px] font-bold text-gray-500">Xe đêm</div>
                        <div className="flex w-full items-center gap-1">
                          <span className="h-2 w-2 flex-none rounded-full border-2" style={{ borderColor: TH.G }} />
                          <span className="h-[2px] flex-1" style={{ background: "repeating-linear-gradient(90deg, oklch(0.75 0.02 200) 0 5px, transparent 5px 9px)" }} />
                          <span className="h-2 w-2 flex-none rounded-full bg-sunset-500" />
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[22px] font-extrabold leading-none tracking-[-0.02em]">Tà Xùa</div>
                        <div className="mt-[3px] text-xs text-gray-500">{op.outbound?.dropoffPoint ?? "Trung tâm"}</div>
                      </div>
                    </div>
                    {amen.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {amen.map((a, i) => (
                          <span key={i} className="whitespace-nowrap rounded-full bg-[oklch(0.95_0.025_155)] px-2.5 py-1 text-xs font-semibold" style={{ color: "oklch(0.36 0.08 155)" }}>{a}</span>
                        ))}
                      </div>
                    )}
                    {round && op.ret && (
                      <div className="flex items-center justify-between gap-2 rounded-xl border border-dashed border-[oklch(0.85_0.02_200)] px-3 py-2.5 text-[13px]">
                        <span><b>Chiều về {op.ret.departureTime}</b>{to ? ` · ${fmtD(to)}` : ""}</span>
                      </div>
                    )}
                    <div className="flex-1" />
                    <div className="flex items-end justify-between gap-2.5 border-t border-[oklch(0.94_0.01_200)] pt-3">
                      <div>
                        <div className="text-xs text-gray-500">{round ? "Khứ hồi từ" : "Một chiều từ"}</div>
                        {unit != null ? (
                          <>
                            <div className="text-[22px] font-extrabold tracking-[-0.02em]" style={{ color: "oklch(0.6 0.18 45)" }}>{vnd(unit)}</div>
                            {!full && <div className="text-xs font-semibold text-gray-500">{pax} khách · tạm tính {vnd(unit * pax)}</div>}
                          </>
                        ) : (
                          <div className="text-[15px] font-bold text-gray-500">Liên hệ xác nhận giá</div>
                        )}
                      </div>
                      <span className="whitespace-nowrap rounded-full px-4 py-2.5 text-sm font-bold text-white transition group-hover:bg-sunset-500" style={{ background: full ? "oklch(0.6 0.01 160)" : TH.G }}>{cta}</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* dịch vụ khác */}
        <div className="mt-6 flex flex-col gap-3 border-t border-[oklch(0.91_0.01_200)] pt-6">
          <div className="text-[15px] font-bold text-gray-500">Dịch vụ khác tại Tà Xùa</div>
          <div className="flex flex-wrap gap-2">
            {[["/homestay", "Homestay & Bungalow"], ["/thue-xe-may", "Thuê xe máy"], ["/xe-om", "Xe ôm"], ["/taxi", "Taxi"], ["/combo", "Combo du lịch"]].map(([href, label]) => (
              <Link key={href} href={href} className="whitespace-nowrap rounded-full border border-[oklch(0.88_0.02_160)] bg-white px-4 py-2.5 text-[15px] font-semibold text-[oklch(0.3_0.05_160)]">{label}</Link>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
