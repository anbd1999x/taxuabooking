"use client";

import { useEffect, useRef } from "react";
import type { StopKind } from "@/lib/itinerary";

/** Một cảnh của "phim lịch trình" = một điểm dừng (đã trải phẳng qua các ngày). */
export interface SceneStop {
  di: number; // chỉ số ngày (0-based)
  si: number; // chỉ số điểm trong ngày
  time: string; // HH:MM
  name: string;
  note: string;
  kind: StopKind;
  mode: "arrive" | "leave" | "spot";
  sit: boolean; // ngồi quán (cafe/ăn uống) thay vì nhảy chụp ảnh
  prop: "stop" | "tree" | "tea" | "hut" | "flag" | "none";
}

// [nhãn, nền chip, chữ chip]
const TYPE: Record<StopKind, [string, string, string]> = {
  checkin: ["Check-in", "oklch(0.95 0.03 250)", "oklch(0.42 0.1 250)"],
  cafe: ["Cafe", "oklch(0.95 0.05 70)", "oklch(0.46 0.13 55)"],
  food: ["Ăn uống", "oklch(0.95 0.04 28)", "oklch(0.5 0.15 28)"],
  move: ["Di chuyển", "oklch(0.95 0.005 160)", "oklch(0.45 0.02 160)"],
};
const DAY_COLORS = ["oklch(0.66 0.17 45)", "oklch(0.52 0.13 155)", "oklch(0.52 0.13 250)"];
const STARS = Array.from({ length: 16 }, (_, i) => ({ x: (i * 37 + 11) % 97, y: (i * 23 + 7) % 46, s: 1 + (i % 3), o: 0.5 + (i % 4) * 0.12 }));
// [áo, mũ, da, balo]
const PEOPLE = [
  ["oklch(0.5 0.08 250)", "oklch(0.62 0.14 45)", "oklch(0.78 0.05 60)", "oklch(0.38 0.04 60)"],
  ["oklch(0.55 0.13 28)", "oklch(0.3 0.02 260)", "oklch(0.75 0.05 55)", "oklch(0.4 0.06 150)"],
  ["oklch(0.62 0.1 150)", "oklch(0.85 0.02 90)", "oklch(0.8 0.045 65)", "oklch(0.42 0.05 250)"],
  ["oklch(0.7 0.1 80)", "oklch(0.45 0.08 160)", "oklch(0.76 0.05 58)", "oklch(0.38 0.04 60)"],
];
const durOf = (f: SceneStop | undefined) => (f && f.mode === "spot" ? 7.5 : 6.5);

/**
 * Phim lịch trình: cảnh hoạt hình tự chạy qua từng điểm dừng (xe cabin tới bến, xe máy lên dốc,
 * cả đoàn chụp ảnh / ngồi quán, xe về). Vị trí các nhân vật vẽ bằng requestAnimationFrame qua ref
 * (không setState mỗi khung hình); nền trời/đạo cụ đổi theo giờ & loại điểm bằng CSS transition.
 */
export function ItineraryScene({
  flat, cur, playing, onAdvance, onPrev, onNext, onToggle, onJump,
}: {
  flat: SceneStop[];
  cur: number;
  playing: boolean;
  onAdvance: () => void;
  onPrev: () => void;
  onNext: () => void;
  onToggle: () => void;
  onJump: (i: number) => void;
}) {
  const sceneRef = useRef<HTMLDivElement>(null);
  const busRef = useRef<HTMLDivElement>(null);
  const carRef = useRef<HTMLDivElement>(null);
  const groupRef = useRef<HTMLDivElement>(null);
  const cloudRef = useRef<HTMLDivElement>(null);
  const steamRef = useRef<HTMLDivElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const dayRef = useRef<HTMLDivElement>(null);
  const dynRef = useRef<HTMLDivElement>(null);
  const roadRef = useRef<SVGPathElement>(null);
  const bike1Ref = useRef<HTMLDivElement>(null);
  const bike2Ref = useRef<HTMLDivElement>(null);
  // trạng thái vòng lặp vẽ (đồng bộ từ props trong effect, đọc trong rAF)
  const live = useRef({ flat, cur, playing, onAdvance, el: 0, reduce: false });

  useEffect(() => {
    const L = live.current;
    const changed = L.cur !== cur || L.flat !== flat;
    L.flat = flat; L.cur = cur; L.playing = playing; L.onAdvance = onAdvance;
    if (changed) L.el = L.reduce ? 3.8 : 0; // đổi cảnh ⇒ chạy lại từ đầu cảnh
  });

  useEffect(() => {
    const L = live.current;
    L.reduce = !!window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (L.reduce) L.el = 3.8; // khung tĩnh: cả đoàn đã tới điểm
    let last = performance.now();
    let t = 0;
    let pt = 0;
    let bikeEnd = 0;
    const angs = [0, 0];
    let raf = 0;

    const paint = (k: number) => {
      const box = sceneRef.current;
      const f = L.flat[L.cur];
      if (!box || !f) return;
      const W = box.clientWidth;
      const cl = (v: number) => Math.max(0, Math.min(1, v));
      const seg = (a: number, b: number) => cl((k - a) / (b - a));
      const eo = (v: number) => 1 - Math.pow(1 - v, 3);
      const ei = (v: number) => v * v * v;
      const dur = durOf(f);
      let busX = -500, carX = -500, gx = 0, gop = 0, walk = false, bounce = 0, flash = 0, sit = 0, busMov = false, carMov = false;
      if (f.mode === "arrive") {
        busX = -170 + (W * 0.1 + 170) * eo(seg(0, 2)); busMov = k < 2;
        const park = W * 0.56; carX = k < 4.4 ? park : park + (W + 200 - park) * ei(seg(4.4, 6.2)); carMov = k > 4.4;
        const door = busX + 120; gop = k > 2.1 ? 1 - seg(4.0, 4.3) : 0; gx = door + (park + 30 - door) * eo(seg(2.2, 4.0)); walk = k > 2.2 && k < 4.0;
      } else if (f.mode === "leave") {
        const park = W * 0.5; busX = k < 2.6 ? park : park + (W + 300 - park) * ei(seg(2.6, 5)); busMov = k > 2.6;
        gop = 1 - seg(2.1, 2.4); gx = W * 0.08 + (park + 110 - W * 0.08) * eo(seg(0, 2.1)); walk = k < 2.1;
      }
      const road = roadRef.current;
      const H = box.clientHeight, sx = W / 1000, sy = H / 340;
      const dt0 = Math.min(0.05, t - (pt || t)); pt = t;
      [bike1Ref.current, bike2Ref.current].forEach((b, i) => {
        if (!b) return;
        if (f.mode !== "spot" || !road) { b.style.transform = "translate(-300px,0)"; return; }
        const len = road.getTotalLength(), q = eo(seg(i * 0.45, 3.0 + i * 0.3)), d = Math.max(0, len * q - i * 46);
        const p0 = road.getPointAtLength(d), pa = road.getPointAtLength(Math.max(0, d - 14)), p1 = road.getPointAtLength(Math.min(len, d + 14));
        const mov = q > 0 && q < 1;
        const tgt = Math.max(-18, Math.min(18, (Math.atan2((p1.y - pa.y) * sy, (p1.x - pa.x) * sx) * 180) / Math.PI));
        angs[i] += (tgt - angs[i]) * Math.min(1, dt0 * 8);
        const ang = mov ? angs[i] : (angs[i] *= 0.85);
        const bump = mov ? Math.sin(t * 31 + i * 2) * 1.4 + Math.max(0, Math.sin(d * 0.09)) * -2 : 0;
        const wob = mov ? Math.sin(t * 23 + i) * 2 : 0;
        b.style.transform = `translate(${p0.x * sx - 35}px, ${p0.y * sy - 52 + bump}px) rotate(${ang + wob}deg)`;
        const r = b.querySelector<HTMLElement>("[data-riders]");
        if (r) r.style.opacity = k < 3.3 ? "1" : "0";
        if (i === 0) bikeEnd = p0.x * sx;
      });
      if (f.mode === "spot") {
        gop = k > 3.3 ? 1 : 0;
        const bx = (bikeEnd || W * 0.5) - 20, ex = Math.max(bx + 30, W * 0.68 - 90);
        gx = bx + (ex - bx) * eo(seg(3.4, 4.4)); walk = k > 3.4 && k < 4.4;
        if (f.sit) sit = seg(4.4, 4.8);
        else { bounce = k > 4.6 && k < 6.8 ? 1 : 0; flash = Math.max(0, 1 - Math.abs(k - 5.3) * 7) + Math.max(0, 1 - Math.abs(k - 6.2) * 7); }
      }
      const bob = (m: boolean) => (m ? Math.abs(Math.sin(t * 14)) * -1.6 : 0);
      if (busRef.current) busRef.current.style.transform = `translate(${busX}px, ${bob(busMov)}px)`;
      if (carRef.current) carRef.current.style.transform = `translate(${carX}px, ${bob(carMov)}px)`;
      const g = groupRef.current;
      if (g) {
        g.style.opacity = String(gop);
        g.style.transform = `translateX(${gx}px)`;
        g.querySelectorAll<HTMLElement>("[data-p]").forEach((pe, i) => {
          const sw = walk ? Math.sin(t * 13 + i) * 26 : 0;
          const jy = bounce ? -Math.abs(Math.sin(t * 7 + i * 0.9)) * 14 : 0;
          const scaleY = sit ? 1 - sit * 0.14 : 1;
          const sway = sit ? Math.sin(t * 2 + i) * 1.5 : 0;
          pe.style.transform = `translate(${sway}px, ${jy + (walk ? Math.abs(Math.sin(t * 13 + i)) * -1.5 : 0)}px) scaleY(${scaleY})`;
          pe.style.transformOrigin = "bottom center";
          const legs = pe.querySelectorAll<HTMLElement>("[data-leg]");
          if (legs[0]) legs[0].style.transform = `rotate(${sw}deg)`;
          if (legs[1]) legs[1].style.transform = `rotate(${-sw}deg)`;
        });
      }
      if (flashRef.current) flashRef.current.style.opacity = String(L.reduce ? 0 : Math.min(0.75, flash));
      if (dynRef.current) dynRef.current.style.opacity = String(Math.min(seg(0, 0.3), 1 - seg(dur - 0.35, dur)));
      if (dayRef.current) dayRef.current.style.opacity = String(f.si === 0 && !L.reduce ? (k < 0.2 ? seg(0, 0.2) : 1 - seg(1.1, 1.6)) : 0);
      const cr = cloudRef.current;
      if (cr) cr.querySelectorAll<HTMLElement>("[data-cloud]").forEach((c, i) => { c.style.transform = `translateX(${((t * (8 + i * 4) + i * 300) % (W + 400)) - 200}px)`; });
      box.querySelectorAll<HTMLElement>("[data-sea]").forEach((c, i) => { c.style.transform = `translate(${Math.sin(t * 0.25 + i * 1.3) * 26}px, ${Math.sin(t * 0.4 + i) * 4}px)`; });
      const st = steamRef.current;
      if (st) st.querySelectorAll<HTMLElement>("[data-steam]").forEach((s, i) => {
        const q = (t * 0.6 + i / 3) % 1;
        s.style.transform = `translate(${Math.sin(q * 6 + i) * 5}px, ${-q * 34}px) scale(${0.6 + q})`;
        s.style.opacity = String(f.sit ? (1 - q) * 0.9 : 0);
      });
    };

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!L.reduce) t += dt;
      // tab ẩn / cảnh ngoài màn hình vẫn chạy nhẹ: rAF tự dừng khi tab ẩn
      if (L.playing && !L.reduce) {
        L.el += dt;
        if (L.el >= durOf(L.flat[L.cur])) { L.el = 0; L.onAdvance(); }
      }
      paint(L.el);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const f = flat[cur] ?? flat[0];
  if (!f) return null;
  const hr = +f.time.slice(0, 2) + +f.time.slice(3, 5) / 60;
  const night = hr < 4.8 || hr >= 19.2 ? 1 : hr < 5.6 ? 0.55 : hr >= 18.4 ? 0.5 : 0;
  const dawn = (hr >= 4.8 && hr < 7.3) || (hr >= 16.3 && hr < 19.2) ? 0.85 : 0;
  const warm = dawn > 0;
  const sunUp = hr >= 5 && hr < 19;
  const spot = f.mode === "spot";
  const TT = TYPE[f.kind];
  const sc = {
    dawnOp: dawn, nightOp: night, tintOp: night * 0.4,
    sunX: Math.max(6, Math.min(94, 8 + ((hr - 5) / 14) * 84)).toFixed(1),
    sunY: sunUp ? (72 - Math.sin((Math.PI * (hr - 5)) / 14) * 56).toFixed(1) : "120",
    sunC: warm ? "oklch(0.86 0.15 62)" : "oklch(0.97 0.12 95)",
    sunGlow: warm ? "oklch(0.85 0.16 55 / .55)" : "oklch(0.97 0.12 95 / .5)",
    seaOp: spot ? 0 : hr < 10 ? 0.95 : hr < 16 ? 0.4 : 0.7,
    farOp: spot ? 0 : 0.8,
    propB: spot ? "26.5%" : "16%",
    grpB: spot ? "26.5%" : "12%",
    spotOp: spot ? 1 : 0, flatOp: spot ? 0 : 1,
    pTree: f.prop === "tree" ? 1 : 0, pTea: f.prop === "tea" ? 1 : 0, pFlag: f.prop === "flag" ? 1 : 0, pHut: f.prop === "hut" ? 1 : 0, pStop: f.prop === "stop" ? 1 : 0,
    hutLabel: f.kind === "cafe" ? "CAFE" : f.kind === "food" ? "QUÁN ĂN" : "BẢN MÔNG",
    stopLabel: f.mode === "leave" ? "TÀ XÙA → HÀ NỘI" : "BẾN XE BẮC YÊN",
    dayLabel: `Ngày ${f.di + 1}`, dayC: DAY_COLORS[f.di % DAY_COLORS.length], time: f.time, name: f.name,
    note: f.mode === "arrive" ? "Cả đoàn xuống xe cabin, lên xe con trung chuyển lên Tà Xùa." : f.mode === "leave" ? "Cả đoàn lên xe cabin, về Hà Nội." : f.note,
    type: TT[0], tBg: TT[1], tFg: TT[2],
  };
  const prevStop = onPrev;
  const nextStop = onNext;
  const togglePlay = onToggle;
  const playIcon = playing ? "❚❚" : "▶";
  const playTitle = playing ? "Tạm dừng" : "Chạy tiếp";

  return (
    <div ref={sceneRef} id="lt-scene" className="h-[260px] sm:h-[300px] lg:h-[340px]" style={{ position: "relative", borderRadius: "24px", overflow: "hidden", isolation: "isolate", background: "linear-gradient(180deg, oklch(0.76 0.09 232), oklch(0.89 0.05 215) 62%, oklch(0.93 0.04 190))" }}>
      <div style={{ position: "absolute", inset: "0", background: "linear-gradient(180deg, oklch(0.6 0.12 25), oklch(0.8 0.13 55) 55%, oklch(0.9 0.08 85))", opacity: `${sc.dawnOp}`, transition: "opacity 1.2s" }}></div>
      <div style={{ position: "absolute", inset: "0", background: "linear-gradient(180deg, oklch(0.2 0.05 265), oklch(0.34 0.06 250))", opacity: `${sc.nightOp}`, transition: "opacity 1.2s" }}>
        {STARS.map((st, i) => (
          <span key={i} style={{ position: "absolute", left: `${st.x}%`, top: `${st.y}%`, width: st.s, height: st.s, borderRadius: "50%", background: "white", opacity: st.o }} />
        ))}
      </div>
      <div style={{ position: "absolute", left: `${sc.sunX}%`, top: `${sc.sunY}%`, width: "50px", height: "50px", margin: "-25px 0 0 -25px", borderRadius: "50%", background: `${sc.sunC}`, boxShadow: `0 0 50px 18px ${sc.sunGlow}`, transition: "left 1.2s ease, top 1.2s ease, background 1.2s, box-shadow 1.2s" }}></div>
      <svg viewBox="0 0 1000 200" preserveAspectRatio="none" style={{ position: "absolute", left: "-5%", width: "110%", bottom: "30%", height: "54%", opacity: `${sc.farOp}`, transition: "opacity .4s", pointerEvents: "none" }}><defs><linearGradient id="ltFarF" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="oklch(0.66 0.045 230)"></stop><stop offset="1" stopColor="oklch(0.84 0.02 225)"></stop></linearGradient></defs><path d="M 0 200 L 0 120 C 40 96, 70 80, 100 82 C 140 84, 160 112, 200 108 C 240 104, 260 40, 310 36 C 360 32, 380 96, 420 94 C 460 92, 480 58, 520 56 C 560 54, 590 104, 630 100 C 670 96, 700 30, 750 26 C 800 22, 820 90, 860 88 C 900 86, 930 60, 970 58 C 990 57, 1000 62, 1000 64 L 1000 200 Z" fill="url(#ltFarF)"></path></svg>
      <div style={{ position: "absolute", left: "-10%", right: "-10%", bottom: "27%", height: "20%", opacity: `${sc.seaOp}`, transition: "opacity 1.2s", filter: "blur(10px)" }}>
        <div style={{ position: "absolute", left: "0", right: "0", top: "20%", height: "70%", borderRadius: "50%", background: "oklch(0.99 0.005 230)" }}></div>
        <div style={{ position: "absolute", left: "20%", width: "40%", top: "0", height: "60%", borderRadius: "50%", background: "oklch(0.99 0.005 230)" }}></div>
        <div style={{ position: "absolute", left: "62%", width: "30%", top: "5%", height: "55%", borderRadius: "50%", background: "oklch(0.99 0.005 230)" }}></div>
      </div>
      <svg viewBox="0 0 1000 200" preserveAspectRatio="none" style={{ position: "absolute", left: "-5%", width: "110%", bottom: "20%", height: "36%", opacity: `${sc.flatOp}`, transition: "opacity .4s", pointerEvents: "none" }}><defs><linearGradient id="ltHillF" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="oklch(0.54 0.08 152)"></stop><stop offset="1" stopColor="oklch(0.42 0.075 155)"></stop></linearGradient></defs><path d="M 0 200 L 0 100 C 60 70, 100 60, 140 64 C 190 68, 210 104, 260 100 C 310 96, 340 46, 390 44 C 440 42, 470 98, 520 96 C 570 94, 600 62, 650 60 C 700 58, 730 110, 780 106 C 830 102, 860 52, 910 52 C 950 52, 980 80, 1000 88 L 1000 200 Z" fill="url(#ltHillF)"></path></svg>
      <div ref={cloudRef} style={{ position: "absolute", inset: "0", pointerEvents: "none" }}>
        <div data-cloud="1" style={{ position: "absolute", left: "10%", top: "12%", width: "110px", height: "44px", opacity: ".9", filter: "blur(1.5px)" }}><div style={{ position: "absolute", left: "0", top: "16.72px", width: "110px", height: "27.28px", borderRadius: "44px", background: "linear-gradient(180deg, white 40%, oklch(0.9 0.015 240))" }}></div><div style={{ position: "absolute", left: "17.6px", top: "3.52px", width: "39.6px", height: "39.6px", borderRadius: "50%", background: "radial-gradient(circle at 50% 30%, oklch(1 0 0) 45%, oklch(0.92 0.015 240))" }}></div><div style={{ position: "absolute", left: "48.4px", top: "0", width: "33px", height: "33px", borderRadius: "50%", background: "radial-gradient(circle at 50% 30%, oklch(1 0 0) 45%, oklch(0.92 0.015 240))" }}></div></div>
        <div data-cloud="2" style={{ position: "absolute", left: "55%", top: "6%", width: "140px", height: "54px", opacity: ".9", filter: "blur(1.5px)" }}><div style={{ position: "absolute", left: "0", top: "20.52px", width: "140px", height: "33.48px", borderRadius: "54px", background: "linear-gradient(180deg, white 40%, oklch(0.9 0.015 240))" }}></div><div style={{ position: "absolute", left: "22.400000000000002px", top: "4.32px", width: "50.4px", height: "50.4px", borderRadius: "50%", background: "radial-gradient(circle at 50% 30%, oklch(1 0 0) 45%, oklch(0.92 0.015 240))" }}></div><div style={{ position: "absolute", left: "61.6px", top: "0", width: "42px", height: "42px", borderRadius: "50%", background: "radial-gradient(circle at 50% 30%, oklch(1 0 0) 45%, oklch(0.92 0.015 240))" }}></div></div>
        <div data-cloud="3" style={{ position: "absolute", left: "80%", top: "22%", width: "90px", height: "36px", opacity: ".9", filter: "blur(1.5px)" }}><div style={{ position: "absolute", left: "0", top: "13.68px", width: "90px", height: "22.32px", borderRadius: "36px", background: "linear-gradient(180deg, white 40%, oklch(0.9 0.015 240))" }}></div><div style={{ position: "absolute", left: "14.4px", top: "2.88px", width: "32.4px", height: "32.4px", borderRadius: "50%", background: "radial-gradient(circle at 50% 30%, oklch(1 0 0) 45%, oklch(0.92 0.015 240))" }}></div><div style={{ position: "absolute", left: "39.6px", top: "0", width: "27px", height: "27px", borderRadius: "50%", background: "radial-gradient(circle at 50% 30%, oklch(1 0 0) 45%, oklch(0.92 0.015 240))" }}></div></div>
      </div>
      <div style={{ position: "absolute", left: "0", right: "0", bottom: "0", height: "24%", background: "oklch(0.42 0.08 152)", opacity: `${sc.flatOp}`, transition: "opacity .4s" }}></div>
      <div style={{ position: "absolute", left: "0", right: "0", bottom: "6%", height: "10%", background: "oklch(0.35 0.015 160)", opacity: `${sc.flatOp}`, transition: "opacity .4s" }}><div style={{ position: "absolute", left: "0", right: "0", top: "46%", height: "3px", background: "repeating-linear-gradient(90deg, oklch(0.9 0.1 90) 0 22px, transparent 22px 44px)" }}></div></div>

      <svg viewBox="0 0 1000 340" preserveAspectRatio="none" style={{ position: "absolute", inset: "0", width: "100%", height: "100%", opacity: `${sc.spotOp}`, transition: "opacity .4s", pointerEvents: "none" }}>
        <defs><filter id="ltSoft" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="7"></feGaussianBlur></filter><linearGradient id="ltFar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="oklch(0.76 0.035 245)"></stop><stop offset="1" stopColor="oklch(0.92 0.012 235)"></stop></linearGradient><linearGradient id="ltMid" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="oklch(0.6 0.045 238)"></stop><stop offset="1" stopColor="oklch(0.84 0.02 230)"></stop></linearGradient><linearGradient id="ltWall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="oklch(0.5 0.075 150)"></stop><stop offset="1" stopColor="oklch(0.34 0.055 160)"></stop></linearGradient><linearGradient id="ltCliff" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="oklch(0.48 0.03 60)"></stop><stop offset="1" stopColor="oklch(0.32 0.02 55)"></stop></linearGradient><linearGradient id="ltBand" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="oklch(1 0 0 / 0)"></stop><stop offset="1" stopColor="oklch(1 0 0 / .95)"></stop></linearGradient></defs>
        <path d="M -40 270 L -40 196 C 20 176, 50 150, 80 150 C 120 150, 140 182, 180 176 C 220 170, 230 120, 270 118 C 310 116, 320 168, 360 166 C 400 164, 410 128, 450 128 C 500 128, 510 176, 560 172 C 600 168, 610 112, 650 112 C 700 112, 710 160, 760 158 C 800 156, 810 104, 850 104 C 900 104, 910 150, 950 148 C 990 146, 1010 126, 1040 126 L 1040 270 Z" fill="url(#ltFar)"></path>
        <g filter="url(#ltSoft)" opacity=".9"><ellipse cx="60" cy="200" rx="140" ry="14" fill="white"></ellipse><ellipse cx="260" cy="196" rx="170" ry="18" fill="white"></ellipse><ellipse cx="480" cy="202" rx="150" ry="13" fill="white"></ellipse><ellipse cx="700" cy="197" rx="180" ry="17" fill="white"></ellipse><ellipse cx="930" cy="200" rx="150" ry="14" fill="white"></ellipse></g>
        <path d="M -40 280 L -40 230 C 10 214, 50 196, 90 196 C 130 196, 150 222, 190 220 C 240 218, 270 176, 320 176 C 370 176, 390 214, 430 212 C 480 210, 510 186, 560 186 C 610 186, 640 222, 680 220 C 720 218, 750 168, 790 168 C 840 168, 860 204, 900 202 C 950 200, 990 178, 1040 178 L 1040 280 Z" fill="url(#ltMid)"></path>
        <path d="M 760 236 L 830 220 L 800 210 L 862 196 L 836 186 L 890 176" fill="none" stroke="oklch(0.92 0.02 80)" strokeOpacity=".7" strokeWidth="1.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke"></path>
        <g filter="url(#ltSoft)" opacity=".9"><ellipse cx="100" cy="230" rx="180" ry="16" fill="white"></ellipse><ellipse cx="360" cy="227" rx="200" ry="20" fill="white"></ellipse><ellipse cx="620" cy="232" rx="190" ry="17" fill="white"></ellipse><ellipse cx="880" cy="228" rx="200" ry="19" fill="white"></ellipse></g>
        <path d="M -40 30 C 80 24, 160 100, 260 112 S 380 160, 470 182 S 600 212, 700 226 L 1040 238 L 1040 252 L 700 248 S 640 250, 560 246 S 500 238, 400 257 S 320 264, 200 242 S 60 262, -40 262 Z" fill="url(#ltWall)"></path>
        <path d="M 40 120 L 52 92 L 64 120 Z M 120 150 L 134 118 L 148 150 Z M 210 178 L 222 150 L 234 178 Z M 300 196 L 312 170 L 324 196 Z M 90 210 L 104 178 L 118 210 Z M 420 214 L 431 192 L 442 214 Z M 520 224 L 530 204 L 540 224 Z M 160 214 L 170 192 L 180 214 Z M 360 210 L 369 190 L 378 210 Z" fill="oklch(0.28 0.05 165)" fillOpacity=".85"></path>
        <path d="M -40 262 C 60 262, 120 240, 200 242 S 320 264, 400 257 S 500 238, 560 246 S 640 250, 700 248 L 1040 252 L 1040 300 L -40 310 Z" fill="url(#ltCliff)"></path>
        <path d="M -40 300 L 60 286 L 120 306 L 200 284 L 280 304 L 360 290 L 440 308 L 540 288 L 620 302 L 720 286 L 820 304 L 920 290 L 1040 300 L 1040 340 L -40 340 Z" fill="oklch(0.3 0.02 55)"></path>
        <path d="M -40 262 C 60 262, 120 240, 200 242 S 320 264, 400 257 S 500 238, 560 246 S 640 250, 700 248 L 1040 252" fill="none" stroke="oklch(0.3 0.02 60)" strokeWidth="26" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"></path>
        <path d="M -40 262 C 60 262, 120 240, 200 242 S 320 264, 400 257 S 500 238, 560 246 S 640 250, 700 248 L 1040 252" fill="none" stroke="oklch(0.6 0.03 70)" strokeWidth="20" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"></path>
        <path d="M -40 262 C 60 262, 120 240, 200 242 S 320 264, 400 257 S 500 238, 560 246 S 640 250, 700 248 L 1040 252" fill="none" stroke="oklch(0.52 0.03 65)" strokeWidth="3" strokeDasharray="2 10" strokeLinecap="round" vectorEffect="non-scaling-stroke"></path>
        <path d="M -40 262 C 60 262, 120 240, 200 242 S 320 264, 400 257 S 500 238, 560 246 S 640 250, 700 248 L 1040 252" fill="none" stroke="oklch(0.95 0.005 90)" strokeWidth="8" strokeDasharray="2.5 34" vectorEffect="non-scaling-stroke" transform="translate(0,12)"></path>
        <path d="M -40 262 C 60 262, 120 240, 200 242 S 320 264, 400 257 S 500 238, 560 246 S 640 250, 700 248 L 1040 252" fill="none" stroke="oklch(0.55 0.17 27)" strokeWidth="2.5" strokeDasharray="2.5 34" vectorEffect="non-scaling-stroke" transform="translate(0,9.5)"></path>
        <path ref={roadRef} d="M -40 262 C 60 262, 120 240, 200 242 S 320 264, 400 257 S 500 238, 560 246" fill="none" stroke="none"></path>
      </svg>
      <div style={{ position: "absolute", left: "-6%", right: "-6%", bottom: "-6%", height: "34%", opacity: `${sc.spotOp}`, transition: "opacity .4s", pointerEvents: "none", filter: "blur(3px)" }}>
        <div data-sea="0" style={{ position: "absolute", left: "-4%", top: "18%", width: "16%", aspectRatio: "1", borderRadius: "50%", background: "radial-gradient(circle at 50% 28%, oklch(1 0 0) 48%, oklch(0.91 0.018 240))" }}></div><div data-sea="1" style={{ position: "absolute", left: "6.5%", top: "4%", width: "20%", aspectRatio: "1", borderRadius: "50%", background: "radial-gradient(circle at 50% 28%, oklch(1 0 0) 48%, oklch(0.91 0.018 240))" }}></div><div data-sea="2" style={{ position: "absolute", left: "17%", top: "22%", width: "15%", aspectRatio: "1", borderRadius: "50%", background: "radial-gradient(circle at 50% 28%, oklch(1 0 0) 48%, oklch(0.91 0.018 240))" }}></div><div data-sea="3" style={{ position: "absolute", left: "27.5%", top: "8%", width: "19%", aspectRatio: "1", borderRadius: "50%", background: "radial-gradient(circle at 50% 28%, oklch(1 0 0) 48%, oklch(0.91 0.018 240))" }}></div><div data-sea="4" style={{ position: "absolute", left: "38%", top: "26%", width: "14%", aspectRatio: "1", borderRadius: "50%", background: "radial-gradient(circle at 50% 28%, oklch(1 0 0) 48%, oklch(0.91 0.018 240))" }}></div><div data-sea="5" style={{ position: "absolute", left: "48.5%", top: "2%", width: "21%", aspectRatio: "1", borderRadius: "50%", background: "radial-gradient(circle at 50% 28%, oklch(1 0 0) 48%, oklch(0.91 0.018 240))" }}></div><div data-sea="6" style={{ position: "absolute", left: "59%", top: "20%", width: "16%", aspectRatio: "1", borderRadius: "50%", background: "radial-gradient(circle at 50% 28%, oklch(1 0 0) 48%, oklch(0.91 0.018 240))" }}></div><div data-sea="7" style={{ position: "absolute", left: "69.5%", top: "10%", width: "18%", aspectRatio: "1", borderRadius: "50%", background: "radial-gradient(circle at 50% 28%, oklch(1 0 0) 48%, oklch(0.91 0.018 240))" }}></div><div data-sea="8" style={{ position: "absolute", left: "80%", top: "24%", width: "15%", aspectRatio: "1", borderRadius: "50%", background: "radial-gradient(circle at 50% 28%, oklch(1 0 0) 48%, oklch(0.91 0.018 240))" }}></div><div data-sea="9" style={{ position: "absolute", left: "90.5%", top: "6%", width: "20%", aspectRatio: "1", borderRadius: "50%", background: "radial-gradient(circle at 50% 28%, oklch(1 0 0) 48%, oklch(0.91 0.018 240))" }}></div><div data-sea="10" style={{ position: "absolute", left: "101%", top: "16%", width: "17%", aspectRatio: "1", borderRadius: "50%", background: "radial-gradient(circle at 50% 28%, oklch(1 0 0) 48%, oklch(0.91 0.018 240))" }}></div><div style={{ position: "absolute", left: "0", right: "0", top: "46%", bottom: "0", background: "white" }}></div>
      </div>
      <div style={{ position: "absolute", left: "68%", bottom: `${sc.propB}`, width: "0", height: "0" }}>
        <div style={{ position: "absolute", left: "-4px", bottom: "0", width: "8px", height: "44px", borderRadius: "2px", background: "oklch(0.38 0.05 50)", opacity: `${sc.pTree}`, transition: "opacity .4s" }}></div>
        <div style={{ position: "absolute", left: "-38px", bottom: "36px", width: "76px", height: "60px", borderRadius: "50%", background: "radial-gradient(circle at 38% 30%, oklch(0.6 0.1 145), oklch(0.38 0.07 155))", opacity: `${sc.pTree}`, transition: "opacity .4s" }}></div>
        <div style={{ position: "absolute", left: "-80px", bottom: "0", width: "160px", height: "40px", opacity: `${sc.pTea}`, transition: "opacity .4s" }}>
          <div style={{ position: "absolute", left: "0", bottom: "0", width: "60px", height: "30px", borderRadius: "30px 30px 6px 6px", background: "oklch(0.52 0.1 145)" }}></div>
          <div style={{ position: "absolute", left: "50px", bottom: "0", width: "66px", height: "40px", borderRadius: "33px 33px 6px 6px", background: "oklch(0.46 0.09 150)" }}></div>
          <div style={{ position: "absolute", left: "106px", bottom: "0", width: "54px", height: "28px", borderRadius: "27px 27px 6px 6px", background: "oklch(0.55 0.1 140)" }}></div>
        </div>
        <div style={{ opacity: `${sc.pFlag}`, transition: "opacity .4s" }}>
          <div style={{ position: "absolute", left: "-44px", bottom: "0", width: "88px", height: "30px", borderRadius: "40px 46px 8px 8px", background: "linear-gradient(180deg, oklch(0.62 0.015 240), oklch(0.45 0.015 240))" }}></div>
          <div style={{ position: "absolute", left: "0", bottom: "24px", width: "3px", height: "70px", background: "oklch(0.3 0.02 160)" }}></div>
          <div style={{ position: "absolute", left: "3px", bottom: "70px", width: "36px", height: "22px", background: "oklch(0.74 0.17 45)", clipPath: "polygon(0 0,100% 50%,0 100%)" }}></div>
        </div>
        <div style={{ opacity: `${sc.pHut}`, transition: "opacity .4s" }}>
          <div style={{ position: "absolute", left: "-48px", bottom: "0", width: "96px", height: "50px", borderRadius: "4px", background: "linear-gradient(180deg, oklch(0.62 0.06 60), oklch(0.5 0.05 55))" }}></div>
          <div style={{ position: "absolute", left: "-60px", bottom: "46px", width: "120px", height: "40px", background: "oklch(0.36 0.04 40)", clipPath: "polygon(50% 0,100% 100%,0 100%)" }}></div>
          <div style={{ position: "absolute", left: "-12px", bottom: "0", width: "24px", height: "32px", borderRadius: "12px 12px 0 0", background: "oklch(0.3 0.03 45)" }}></div>
          <div style={{ position: "absolute", left: "-40px", bottom: "38px", width: "80px", height: "16px", borderRadius: "4px", background: "oklch(0.97 0.02 90)", fontSize: "9px", fontWeight: "900", letterSpacing: ".06em", lineHeight: "16px", textAlign: "center", color: "oklch(0.35 0.06 45)", whiteSpace: "nowrap" }}>{sc.hutLabel}</div>
          <div ref={steamRef} style={{ position: "absolute", left: "18px", bottom: "86px", width: "0", height: "0" }}>
            <div data-steam="1" style={{ position: "absolute", left: "0", top: "0", width: "12px", height: "12px", borderRadius: "50%", background: "oklch(1 0 0 / .8)", filter: "blur(2px)" }}></div>
            <div data-steam="2" style={{ position: "absolute", left: "6px", top: "0", width: "10px", height: "10px", borderRadius: "50%", background: "oklch(1 0 0 / .8)", filter: "blur(2px)" }}></div>
            <div data-steam="3" style={{ position: "absolute", left: "-4px", top: "0", width: "9px", height: "9px", borderRadius: "50%", background: "oklch(1 0 0 / .8)", filter: "blur(2px)" }}></div>
          </div>
        </div>
        <div style={{ opacity: `${sc.pStop}`, transition: "opacity .4s" }}>
          <div style={{ position: "absolute", left: "-2px", bottom: "0", width: "4px", height: "62px", background: "oklch(0.35 0.02 160)" }}></div>
          <div style={{ position: "absolute", left: "-56px", bottom: "56px", width: "112px", height: "22px", borderRadius: "5px", background: "oklch(0.45 0.12 250)", border: "2px solid white", fontSize: "10px", fontWeight: "900", lineHeight: "18px", textAlign: "center", color: "white", whiteSpace: "nowrap" }}>{sc.stopLabel}</div>
        </div>
      </div>

      <div ref={dynRef} style={{ position: "absolute", inset: "0", pointerEvents: "none" }}>
        <div ref={carRef} style={{ position: "absolute", left: "0", bottom: "9%", width: "116px", height: "56px", willChange: "transform" }}>
          <div style={{ position: "absolute", left: "6%", bottom: "-4px", width: "88%", height: "7px", borderRadius: "50%", background: "oklch(0.15 0.02 200 / .28)", filter: "blur(2px)" }}></div>
          <div style={{ position: "absolute", left: "20px", top: "2px", width: "70px", height: "26px", borderRadius: "14px 22px 3px 3px", background: "linear-gradient(180deg, oklch(0.62 0.07 170), oklch(0.5 0.07 170))" }}></div>
          <div style={{ position: "absolute", left: "28px", top: "7px", width: "24px", height: "15px", borderRadius: "8px 2px 1px 1px", background: "linear-gradient(160deg, oklch(0.88 0.03 220), oklch(0.6 0.04 230))" }}></div>
          <div style={{ position: "absolute", left: "56px", top: "7px", width: "27px", height: "15px", borderRadius: "2px 12px 1px 1px", background: "linear-gradient(160deg, oklch(0.88 0.03 220), oklch(0.6 0.04 230))" }}></div>
          <div style={{ position: "absolute", left: "3px", top: "24px", width: "110px", height: "20px", borderRadius: "9px 14px 7px 7px", background: "linear-gradient(180deg, oklch(0.58 0.07 170), oklch(0.44 0.06 170))" }}></div>
          <div style={{ position: "absolute", left: "6px", top: "31px", width: "104px", height: "1px", background: "oklch(1 0 0 / .25)" }}></div>
          <div style={{ position: "absolute", right: "3px", top: "28px", width: "8px", height: "5px", borderRadius: "2px", background: "oklch(0.97 0.08 95)", boxShadow: "0 0 10px 3px oklch(0.96 0.1 95 / .4)" }}></div>
          <div style={{ position: "absolute", left: "13px", top: "35px", width: "21px", height: "21px", borderRadius: "50%", background: "radial-gradient(circle, oklch(0.75 0.005 250) 0 28%, oklch(0.4 0.005 250) 30% 36%, oklch(0.22 0.01 250) 38%)" }}></div><div style={{ position: "absolute", left: "80px", top: "35px", width: "21px", height: "21px", borderRadius: "50%", background: "radial-gradient(circle, oklch(0.75 0.005 250) 0 28%, oklch(0.4 0.005 250) 30% 36%, oklch(0.22 0.01 250) 38%)" }}></div>
        </div>
        <div ref={busRef} style={{ position: "absolute", left: "0", bottom: "9%", width: "160px", height: "64px", willChange: "transform" }}>
          <div style={{ position: "absolute", left: "6%", bottom: "-4px", width: "88%", height: "7px", borderRadius: "50%", background: "oklch(0.15 0.02 200 / .28)", filter: "blur(2px)" }}></div>
          <div style={{ position: "absolute", left: "0", top: "0", width: "160px", height: "48px", borderRadius: "10px 22px 8px 8px", background: "linear-gradient(180deg, oklch(0.97 0.005 90), oklch(0.88 0.01 90))" }}></div>
          <div style={{ position: "absolute", left: "0", top: "30px", width: "160px", height: "6px", background: "oklch(0.6 0.13 45)" }}></div>
          <div style={{ position: "absolute", left: "0", top: "37px", width: "160px", height: "2px", background: "oklch(0.36 0.06 160)" }}></div>
          <div style={{ position: "absolute", left: "8px", top: "7px", width: "110px", height: "17px", borderRadius: "4px", background: "linear-gradient(180deg, oklch(0.4 0.03 240), oklch(0.26 0.03 240))" }}></div>
          <div style={{ position: "absolute", left: "122px", top: "6px", width: "32px", height: "21px", borderRadius: "4px 16px 3px 3px", background: "linear-gradient(160deg, oklch(0.6 0.04 230), oklch(0.3 0.03 240))" }}></div>
          <div style={{ position: "absolute", left: "12px", top: "11px", fontSize: "9px", fontWeight: "800", letterSpacing: ".14em", color: "oklch(1 0 0 / .8)" }}>TÀ XÙA CABIN</div>
          <div style={{ position: "absolute", right: "2px", top: "38px", width: "8px", height: "5px", borderRadius: "2px", background: "oklch(0.97 0.08 95)", boxShadow: "0 0 10px 3px oklch(0.96 0.1 95 / .4)" }}></div>
          <div style={{ position: "absolute", left: "18px", top: "40px", width: "24px", height: "24px", borderRadius: "50%", background: "radial-gradient(circle, oklch(0.75 0.005 250) 0 28%, oklch(0.4 0.005 250) 30% 36%, oklch(0.22 0.01 250) 38%)" }}></div><div style={{ position: "absolute", left: "116px", top: "40px", width: "24px", height: "24px", borderRadius: "50%", background: "radial-gradient(circle, oklch(0.75 0.005 250) 0 28%, oklch(0.4 0.005 250) 30% 36%, oklch(0.22 0.01 250) 38%)" }}></div>
        </div>
        <div ref={bike1Ref} style={{ position: "absolute", left: "0", top: "0", width: "70px", height: "52px", transformOrigin: "35px 52px", willChange: "transform" }}>
          <div style={{ position: "absolute", left: "6%", bottom: "-4px", width: "88%", height: "7px", borderRadius: "50%", background: "oklch(0.15 0.02 200 / .28)", filter: "blur(2px)" }}></div>
          <div data-riders="1">
            <div style={{ position: "absolute", left: "18px", top: "14px", width: "11px", height: "18px", borderRadius: "4px 4px 2px 2px", background: "oklch(0.55 0.08 250)" }}></div>
            <div style={{ position: "absolute", left: "19px", top: "4px", width: "9px", height: "10px", borderRadius: "50%", background: "oklch(0.76 0.05 58)" }}></div>
            <div style={{ position: "absolute", left: "18px", top: "2px", width: "11px", height: "8px", borderRadius: "6px 6px 2px 2px", background: "oklch(0.4 0.03 260)" }}></div>
            <div style={{ position: "absolute", left: "34px", top: "11px", width: "11px", height: "18px", borderRadius: "4px 4px 2px 2px", background: "oklch(0.45 0.07 160)" }}></div>
            <div style={{ position: "absolute", left: "35px", top: "1px", width: "9px", height: "10px", borderRadius: "50%", background: "oklch(0.76 0.05 58)" }}></div>
            <div style={{ position: "absolute", left: "34px", top: "-1px", width: "11px", height: "8px", borderRadius: "6px 6px 2px 2px", background: "oklch(0.9 0.02 90)" }}></div>
            <div style={{ position: "absolute", left: "42px", top: "14px", width: "12px", height: "3px", borderRadius: "2px", background: "oklch(0.45 0.07 160)", transform: "rotate(22deg)" }}></div>
            <div style={{ position: "absolute", left: "24px", top: "26px", width: "16px", height: "4px", borderRadius: "2px", background: "oklch(0.28 0.03 255)" }}></div>
          </div>
          <div style={{ position: "absolute", left: "50px", top: "16px", width: "3px", height: "20px", borderRadius: "2px", background: "oklch(0.3 0.01 250)", transform: "rotate(18deg)" }}></div>
          <div style={{ position: "absolute", left: "12px", top: "28px", width: "46px", height: "11px", borderRadius: "7px 12px 4px 4px", background: "linear-gradient(180deg, color-mix(in oklch, oklch(0.5 0.13 25) 80%, white), oklch(0.5 0.13 25))" }}></div>
          <div style={{ position: "absolute", left: "55px", top: "25px", width: "6px", height: "5px", borderRadius: "2px 3px 3px 2px", background: "oklch(0.97 0.08 95)", boxShadow: "0 0 10px 3px oklch(0.96 0.1 95 / .45)" }}></div>
          <div style={{ position: "absolute", left: "3px", top: "34px", width: "18px", height: "18px", borderRadius: "50%", background: "radial-gradient(circle, oklch(0.75 0.005 250) 0 28%, oklch(0.4 0.005 250) 30% 36%, oklch(0.22 0.01 250) 38%)" }}></div><div style={{ position: "absolute", left: "47px", top: "34px", width: "18px", height: "18px", borderRadius: "50%", background: "radial-gradient(circle, oklch(0.75 0.005 250) 0 28%, oklch(0.4 0.005 250) 30% 36%, oklch(0.22 0.01 250) 38%)" }}></div>
        </div>
        <div ref={bike2Ref} style={{ position: "absolute", left: "0", top: "0", width: "70px", height: "52px", transformOrigin: "35px 52px", willChange: "transform" }}>
          <div style={{ position: "absolute", left: "6%", bottom: "-4px", width: "88%", height: "7px", borderRadius: "50%", background: "oklch(0.15 0.02 200 / .28)", filter: "blur(2px)" }}></div>
          <div data-riders="1">
            <div style={{ position: "absolute", left: "18px", top: "14px", width: "11px", height: "18px", borderRadius: "4px 4px 2px 2px", background: "oklch(0.5 0.12 28)" }}></div>
            <div style={{ position: "absolute", left: "19px", top: "4px", width: "9px", height: "10px", borderRadius: "50%", background: "oklch(0.76 0.05 58)" }}></div>
            <div style={{ position: "absolute", left: "18px", top: "2px", width: "11px", height: "8px", borderRadius: "6px 6px 2px 2px", background: "oklch(0.88 0.02 90)" }}></div>
            <div style={{ position: "absolute", left: "34px", top: "11px", width: "11px", height: "18px", borderRadius: "4px 4px 2px 2px", background: "oklch(0.6 0.1 80)" }}></div>
            <div style={{ position: "absolute", left: "35px", top: "1px", width: "9px", height: "10px", borderRadius: "50%", background: "oklch(0.76 0.05 58)" }}></div>
            <div style={{ position: "absolute", left: "34px", top: "-1px", width: "11px", height: "8px", borderRadius: "6px 6px 2px 2px", background: "oklch(0.62 0.14 45)" }}></div>
            <div style={{ position: "absolute", left: "42px", top: "14px", width: "12px", height: "3px", borderRadius: "2px", background: "oklch(0.6 0.1 80)", transform: "rotate(22deg)" }}></div>
            <div style={{ position: "absolute", left: "24px", top: "26px", width: "16px", height: "4px", borderRadius: "2px", background: "oklch(0.28 0.03 255)" }}></div>
          </div>
          <div style={{ position: "absolute", left: "50px", top: "16px", width: "3px", height: "20px", borderRadius: "2px", background: "oklch(0.3 0.01 250)", transform: "rotate(18deg)" }}></div>
          <div style={{ position: "absolute", left: "12px", top: "28px", width: "46px", height: "11px", borderRadius: "7px 12px 4px 4px", background: "linear-gradient(180deg, color-mix(in oklch, oklch(0.38 0.06 250) 80%, white), oklch(0.38 0.06 250))" }}></div>
          <div style={{ position: "absolute", left: "55px", top: "25px", width: "6px", height: "5px", borderRadius: "2px 3px 3px 2px", background: "oklch(0.97 0.08 95)", boxShadow: "0 0 10px 3px oklch(0.96 0.1 95 / .45)" }}></div>
          <div style={{ position: "absolute", left: "3px", top: "34px", width: "18px", height: "18px", borderRadius: "50%", background: "radial-gradient(circle, oklch(0.75 0.005 250) 0 28%, oklch(0.4 0.005 250) 30% 36%, oklch(0.22 0.01 250) 38%)" }}></div><div style={{ position: "absolute", left: "47px", top: "34px", width: "18px", height: "18px", borderRadius: "50%", background: "radial-gradient(circle, oklch(0.75 0.005 250) 0 28%, oklch(0.4 0.005 250) 30% 36%, oklch(0.22 0.01 250) 38%)" }}></div>
        </div>
        <div ref={groupRef} style={{ position: "absolute", left: "0", bottom: `${sc.grpB}`, width: "80px", height: "46px", willChange: "transform,opacity", opacity: "0" }}>
        {PEOPLE.map(([c, hat, skin, bag], i) => (
          <div key={i} data-p="1" style={{ position: "absolute", left: i * 19, bottom: 0, width: 16, height: 46 }}>
            <div data-leg="1" style={{ position: "absolute", left: 4, top: 30, width: 4, height: 16, borderRadius: 2, background: "oklch(0.28 0.03 255)", transformOrigin: "top center" }} />
            <div data-leg="2" style={{ position: "absolute", left: 9, top: 30, width: 4, height: 16, borderRadius: 2, background: "oklch(0.32 0.03 255)", transformOrigin: "top center" }} />
            <div style={{ position: "absolute", left: -3, top: 14, width: 6, height: 12, borderRadius: 3, background: bag }} />
            <div style={{ position: "absolute", left: 2, top: 12, width: 12, height: 20, borderRadius: "5px 5px 3px 3px", background: `linear-gradient(90deg, ${c}, color-mix(in oklch, ${c} 78%, black))` }} />
            <div style={{ position: "absolute", left: 4, top: 3, width: 9, height: 10, borderRadius: "50%", background: skin }} />
            <div style={{ position: "absolute", left: 3.5, top: 1, width: 10, height: 6, borderRadius: "5px 5px 2px 2px", background: hat }} />
          </div>
        ))}
        </div>
      </div>
      <div style={{ position: "absolute", inset: "0", background: "oklch(0.2 0.06 265)", opacity: `${sc.tintOp}`, transition: "opacity 1.2s", pointerEvents: "none" }}></div>
      <div ref={flashRef} style={{ position: "absolute", inset: "0", background: "white", opacity: "0", pointerEvents: "none" }}></div>
      <div ref={dayRef} style={{ position: "absolute", left: "50%", top: "42%", transform: "translate(-50%,-50%)", fontSize: "clamp(28px,5vw,44px)", fontWeight: "800", letterSpacing: "-.02em", color: "white", padding: "10px 26px", borderRadius: "999px", background: "oklch(0.25 0.05 160 / .75)", opacity: "0", pointerEvents: "none", whiteSpace: "nowrap" }}>{sc.dayLabel}</div>

      <div style={{ position: "absolute", left: "14px", top: "14px", maxWidth: "min(380px,calc(100% - 150px))", padding: "10px 14px", borderRadius: "16px", background: "oklch(1 0 0 / .94)", boxShadow: "0 8px 20px -10px oklch(0.2 0.04 160 / .4)", display: "flex", flexDirection: "column", gap: "3px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}><span style={{ fontSize: "11px", fontWeight: "800", padding: "2px 8px", borderRadius: "999px", background: `${sc.dayC}`, color: "white", whiteSpace: "nowrap" }}>{sc.dayLabel} · {sc.time}</span><span style={{ fontSize: "11px", fontWeight: "800", padding: "2px 8px", borderRadius: "999px", background: `${sc.tBg}`, color: `${sc.tFg}`, whiteSpace: "nowrap" }}>{sc.type}</span></div>
        <div style={{ fontSize: "16px", fontWeight: "800", lineHeight: "1.3" }}>{sc.name}</div>
        <div className="hidden sm:block" style={{ fontSize: "13px", lineHeight: "1.45", color: "oklch(0.42 0.02 160)" }}>{sc.note}</div>
      </div>
      <div style={{ position: "absolute", right: "14px", top: "14px", display: "flex", gap: "6px" }}>
        <button type="button" onClick={prevStop} title="Cảnh trước" aria-label="Cảnh trước" style={{ cursor: "pointer", width: "38px", height: "38px", borderRadius: "50%", background: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", fontWeight: "800", boxShadow: "0 4px 12px -4px oklch(0.2 0.04 150 / .35)" }}>‹</button>
        <button type="button" onClick={togglePlay} title={playTitle} aria-label={playTitle} style={{ cursor: "pointer", width: "38px", height: "38px", borderRadius: "50%", background: "oklch(0.68 0.18 45)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: "800", boxShadow: "0 4px 12px -4px oklch(0.2 0.04 150 / .35)" }}>{playIcon}</button>
        <button type="button" onClick={nextStop} title="Cảnh sau" aria-label="Cảnh sau" style={{ cursor: "pointer", width: "38px", height: "38px", borderRadius: "50%", background: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", fontWeight: "800", boxShadow: "0 4px 12px -4px oklch(0.2 0.04 150 / .35)" }}>›</button>
      </div>
      <div style={{ position: "absolute", left: "14px", right: "14px", bottom: "8px", display: "flex", gap: "3px" }}>
        {flat.map((x, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onJump(i)}
            title={`Ngày ${x.di + 1} · ${x.time} · ${x.name}`}
            aria-label={`Ngày ${x.di + 1} · ${x.time} · ${x.name}`}
            style={{ cursor: "pointer", flex: 1, padding: "6px 0", marginLeft: x.si === 0 && x.di > 0 ? 8 : 0 }}
          >
            <div style={{ height: 5, borderRadius: 3, background: i === cur ? "oklch(0.68 0.18 45)" : i < cur ? "oklch(1 0 0 / .95)" : "oklch(1 0 0 / .45)", transition: "background .3s" }} />
          </button>
        ))}
      </div>
    </div>
  );
}
