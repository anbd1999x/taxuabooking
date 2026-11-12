"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { SatelliteMap } from "./SatelliteMap";
import { cn } from "@/lib/utils";

export interface MapSpot {
  id: string; // id Place, hoặc "tt"/"by" cho 2 mốc cố định
  pos: [number, number] | null; // vị trí trên bản đồ hoạt hình, chiếu từ toạ độ thật (null = chưa có toạ độ)
  lat: number | null; // toạ độ thật (lấy từ link Google Maps)
  lng: number | null;
  name: string;
  km: number | null; // khoảng cách đường xe máy từ trung tâm
  sub: string;
  desc: string;
  tip: string;
  best: string; // khung giờ đẹp nhất
  image: string | null;
  mapUrl: string;
}

export interface MapPlan {
  id: string;
  name: string;
  sub: string;
  days: { title: string; stops: { time: string; name: string; note: string; pos: [number, number]; spotId: string; checkin: boolean }[] }[];
}

const G = "oklch(0.29 0.055 160)";
const DAYC = ["oklch(0.66 0.17 45)", "oklch(0.56 0.14 155)", "oklch(0.56 0.14 250)", "oklch(0.56 0.14 320)"];
const YS = 0.8; // mặt phẳng có tỉ lệ 1.25 ⇒ trục y của SVG (viewBox 100×80) = y% × 0.8
const poly = (pts: [number, number][]) => pts.map((p) => `${p[0]},${p[1] * YS}`).join(" ");
const fmtKm = (k: number | null) => (k == null || k === 0 ? "" : `${String(k).replace(".", ",")} km`);
const minsOf = (k: number) => `~${Math.max(5, Math.round(k * 3.2))} phút xe máy`;

// ── Địa hình trang trí (cố định, sinh 1 lần) ────────────────────────────────
const T = (a: string, b: string) => `repeating-radial-gradient(ellipse at 50% 60%, ${a} 0 7px, ${b} 7px 11px)`;
const R = (a: string, b: string) => `radial-gradient(circle at 40% 35%, ${a}, ${b} 70%)`;
const HILLS: [number, number, number, string][] = [
  [32, 28, 20, R("oklch(0.72 0.12 140)", "oklch(0.55 0.1 150)")],
  [70, 52, 16, T("oklch(0.8 0.12 125)", "oklch(0.7 0.11 135)")],
  [40, 70, 18, T("oklch(0.82 0.13 115)", "oklch(0.72 0.12 130)")],
  [82, 70, 16, R("oklch(0.75 0.12 135)", "oklch(0.58 0.1 145)")],
  [66, 26, 14, R("oklch(0.7 0.12 145)", "oklch(0.52 0.1 150)")],
  [22, 44, 14, T("oklch(0.78 0.12 130)", "oklch(0.68 0.11 140)")],
  [48, 84, 14, R("oklch(0.72 0.1 140)", "oklch(0.55 0.09 150)")],
];
const rr = (i: number, k: number) => { const v = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return v - Math.floor(v); };
const TREES = Array.from({ length: 34 }, (_, i) => {
  const h = 16 + Math.round(rr(i, 3) * 12);
  return { x: (4 + rr(i, 1) * 92).toFixed(1), y: (6 + rr(i, 2) * 88).toFixed(1), h, w: Math.round(h * 0.6), hw: Math.round(h * 0.3) };
});
const PK = "polygon(0 100%, 14% 58%, 24% 66%, 42% 18%, 52% 30%, 62% 0, 74% 40%, 86% 30%, 100% 100%)";
const PK2 = "polygon(0 100%, 20% 50%, 34% 62%, 55% 10%, 70% 44%, 82% 34%, 100% 100%)";
const PK3 = "polygon(0 100%, 30% 30%, 45% 45%, 60% 15%, 100% 100%)";
const MOUNTAINS: [number, number, number, number, string, string][] = [
  [62, 4, 340, 190, PK, "Đỉnh Tà Xùa 2.865m"], [26, 6, 260, 140, PK2, ""], [90, 10, 220, 130, PK3, ""], [4, 30, 180, 120, PK3, ""],
  [96, 48, 170, 110, PK2, ""], [8, 82, 150, 80, PK3, ""], [92, 86, 150, 76, PK2, ""],
];
const SEAS: [number, number, number][] = [[36, 74, 18], [72, 62, 16], [24, 40, 16], [84, 46, 14], [56, 30, 12]];
const CLOUDS: [number, number, number][] = [[20, 40, 20], [60, 22, 24], [75, 70, 18], [40, 80, 22], [10, 60, 16]];

const CTRL = "flex h-[38px] w-[38px] cursor-pointer items-center justify-center rounded-xl bg-white font-extrabold shadow-[0_4px_12px_-4px_oklch(0.2_0.04_150/.3)]";

export function CheckinMap({ spots, plans, initialPlan, initialView }: { spots: MapSpot[]; plans: MapPlan[]; initialPlan?: string; initialView?: "3d" | "sat" }) {
  const [view, setView] = useState<"3d" | "sat">(initialView ?? "3d");
  const [planId, setPlanId] = useState(initialPlan && plans.some((p) => p.id === initialPlan) ? initialPlan : "all");
  const [day, setDay] = useState(0); // 0 = cả lịch trình
  const [sel, setSel] = useState<string | null>(null);
  const [rot, setRot] = useState(-12);
  const [tilt, setTilt] = useState(54);
  const [drag, setDrag] = useState<{ x: number; r: number } | null>(null);

  const planeRef = useRef<HTMLDivElement>(null);
  const carRef = useRef<HTMLDivElement>(null);
  const bikeRef = useRef<HTMLDivElement>(null);
  const dustRef = useRef<HTMLDivElement>(null);
  const live = useRef<{ pts: [number, number][] | null; rot: number }>({ pts: null, rot });

  const P = plans.find((p) => p.id === planId) ?? null;
  const byId = useMemo(() => new Map(spots.map((s) => [s.id, s])), [spots]);

  // Cung đường từng ngày + điểm nào thuộc ngày nào + thứ tự ghé.
  const { routes, carPts, inPlan, order, totalKm, dayKm } = useMemo(() => {
    const inPlan = new Map<string, string>(); // spotId → màu ngày
    const order = new Map<string, number>();
    const routes: { pts: string; c: string; on: boolean }[] = [];
    const dayKm: number[] = [];
    let carPts: [number, number][] | null = null;
    let totalKm = 0;
    if (!P) {
      // Chưa chọn lịch trình: xe máy chạy từ trung tâm ra từng điểm rồi quay về.
      const tt = byId.get("tt")?.pos;
      const tour: [number, number][] = [];
      if (tt) for (const s of spots) if (s.pos && s.id !== "tt" && s.id !== "by") tour.push(tt, s.pos);
      if (tt && tour.length) tour.push(tt);
      return { routes, carPts: tour.length > 1 ? tour : null, inPlan, order, totalKm, dayKm };
    }
    let n = 0;
    P.days.forEach((d, di) => {
      const on = day === 0 || day === di + 1;
      const c = DAYC[di % DAYC.length];
      for (const s of d.stops) {
        if (!on) continue;
        if (!inPlan.has(s.spotId)) inPlan.set(s.spotId, c);
        if (s.checkin && !order.has(s.spotId)) order.set(s.spotId, ++n);
      }
      let km = 0;
      for (let i = 1; i < d.stops.length; i++) {
        if (d.stops[i].spotId !== d.stops[i - 1].spotId) km += Math.abs((byId.get(d.stops[i].spotId)?.km ?? 0) - (byId.get(d.stops[i - 1].spotId)?.km ?? 0)) || 1;
      }
      dayKm.push(km);
      totalKm += km;
      // nối thẳng vị trí các điểm dừng (bỏ điểm trùng liên tiếp)
      const pts = d.stops.map((s) => s.pos).filter((p, i, a) => i === 0 || p[0] !== a[i - 1][0] || p[1] !== a[i - 1][1]);
      routes.push({ pts: poly(pts), c, on });
      if (on && !carPts && pts.length > 1) carPts = pts;
    });
    return { routes, carPts, inPlan, order, totalKm, dayKm };
  }, [P, day, byId, spots]);

  useEffect(() => { live.current.pts = carPts; live.current.rot = rot; });

  // Mây trôi + xe máy chạy theo cung đường (vẽ qua ref, không setState mỗi khung hình).
  useEffect(() => {
    const reduce = !!window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t0 = performance.now();
    let raf = 0;
    const loop = (now: number) => {
      const t = (now - t0) / 1000;
      const root = planeRef.current;
      if (root) {
        root.querySelectorAll<HTMLElement>("[data-cloud]").forEach((el, i) => { el.style.transform = `translateZ(${50 + i * 12}px) translateX(${Math.sin(t * 0.15 + i * 1.7) * 30}px)`; });
        root.querySelectorAll<HTMLElement>("[data-sea]").forEach((el, i) => {
          el.style.opacity = (0.55 + Math.sin(t * 0.4 + i) * 0.25).toFixed(2);
          el.style.transform = `translateZ(20px) translateX(${Math.sin(t * 0.2 + i * 2) * 14}px)`;
        });
      }
      const car = carRef.current;
      const pts = live.current.pts;
      if (car) car.style.display = pts && pts.length > 1 ? "block" : "none";
      if (car && pts && pts.length > 1) {
        const seg: number[] = [];
        let L = 0;
        for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], (pts[i][1] - pts[i - 1][1]) * YS); seg.push(d); L += d; }
        let d = (t * 7) % L, i = 0;
        while (i < seg.length - 1 && d > seg[i]) { d -= seg[i]; i++; }
        const f = seg[i] ? d / seg[i] : 0, A = pts[i], B = pts[i + 1];
        car.style.left = `${A[0] + (B[0] - A[0]) * f}%`;
        car.style.top = `${A[1] + (B[1] - A[1]) * f}%`;
        const r = (live.current.rot * Math.PI) / 180, dx = B[0] - A[0], dy = (B[1] - A[1]) * YS, sx = dx * Math.cos(r) - dy * Math.sin(r);
        if (bikeRef.current) bikeRef.current.style.transform = `translateY(${-Math.abs(Math.sin(t * 14)) * 2}px) scaleX(${sx < 0 ? -1 : 1})`;
        if (dustRef.current) { const k = (t * 2) % 1; dustRef.current.style.opacity = (1 - k).toFixed(2); dustRef.current.style.transform = `translate(${-k * 14}px,${-k * 6}px) scale(${0.6 + k})`; }
      }
      if (!reduce) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Nhãn điểm chồng lên nhau ⇒ kéo dài cọc của nhãn phía trên cho tách ra.
  useEffect(() => {
    if (view !== "3d") return;
    const run = () => {
      const root = planeRef.current;
      if (!root) return;
      const pills = [...root.querySelectorAll<HTMLElement>("[data-pill]")]
        .map((pl) => ({ pl, st: pl.parentElement?.querySelector<HTMLElement>("[data-stem]") ?? null }))
        .filter((x): x is { pl: HTMLElement; st: HTMLElement } => !!x.st);
      pills.forEach((x) => { x.st.style.height = `${x.st.dataset.stem}px`; });
      for (let pass = 0; pass < 12; pass++) {
        let moved = false;
        const rs = pills.map((x) => ({ ...x, r: x.pl.getBoundingClientRect() }));
        for (let i = 0; i < rs.length && !moved; i++) for (let j = i + 1; j < rs.length && !moved; j++) {
          const a = rs[i].r, b = rs[j].r, pad = 10;
          const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left) + pad;
          const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) + pad;
          if (ox > 0 && oy > 0) { const up = a.bottom < b.bottom ? rs[i] : rs[j]; up.st.style.height = `${parseFloat(up.st.style.height) + oy}px`; moved = true; }
        }
        if (!moved) break;
      }
    };
    const id = setTimeout(run, 260);
    window.addEventListener("resize", run);
    return () => { clearTimeout(id); window.removeEventListener("resize", run); };
  }, [rot, tilt, planId, day, view, spots]);

  const pickPlan = (k: string) => { setPlanId(k); setDay(0); setSel(null); };
  const stand = { position: "absolute" as const, left: 0, top: 0, transformOrigin: "0 0", transform: `rotateZ(${-rot}deg) rotateX(${-tilt}deg)`, transformStyle: "preserve-3d" as const };

  const pins = spots.filter((s) => s.pos).map((s, i) => {
    const [x, y] = s.pos!;
    const isC = s.id === "tt";
    const c = isC ? G : (inPlan.get(s.id) ?? "oklch(0.45 0.08 160)");
    const num = P ? order.get(s.id) : undefined;
    return { s, x, y, isC, c, num, dim: !!P && !inPlan.has(s.id), on: sel === s.id, bob: (2.4 + (i % 4) * 0.3).toFixed(1), stem: isC ? 22 : Math.round(18 + (1 - y / 100) * 34 + (i % 3) * 16) };
  });

  const sp = sel ? byId.get(sel) : undefined;
  const spFacts = sp ? (sp.id === "tt" ? ["Mốc 0 km", sp.sub] : [sp.km ? `${fmtKm(sp.km)} từ trung tâm` : "", sp.km ? minsOf(sp.km) : "", sp.best ? `Đẹp nhất ${sp.best}` : ""].filter(Boolean)) : [];
  const listed = spots.filter((s) => s.id !== "tt" && s.id !== "by").sort((a, b) => (a.km ?? 99) - (b.km ?? 99));
  const kms = listed.map((s) => s.km).filter((k): k is number => k != null && k > 0);
  const nSpots = P ? [...inPlan.keys()].filter((id) => id !== "tt" && id !== "by").length : listed.length;
  const stats = P
    ? [{ v: P.name, k: "Thời gian" }, { v: String(nSpots), k: "Điểm check-in" }, { v: `~${Math.round(totalKm)} km`, k: "Di chuyển tại chỗ" }]
    : [{ v: String(nSpots), k: "Điểm check-in" }, { v: kms.length ? `${String(Math.min(...kms)).replace(".", ",")}–${String(Math.max(...kms)).replace(".", ",")}` : "—", k: "km từ trung tâm" }, { v: "2.865m", k: "Đỉnh cao nhất" }];
  // Tia nối trung tâm → từng điểm (gợi hướng đi; không phải đường thật).
  const center = byId.get("tt")?.pos ?? null;
  const spokes = center ? spots.filter((s) => s.pos && s.id !== "tt").map((s) => poly([center, s.pos!])) : [];
  const satSpots = spots.filter((s): s is MapSpot & { lat: number; lng: number } => s.lat != null && s.lng != null).map((s) => ({ id: s.id, name: s.name, lat: s.lat, lng: s.lng, mapUrl: s.mapUrl, main: s.id === "tt" }));
  const stop = (e: React.PointerEvent) => e.stopPropagation();

  return (
    <div className="bg-[oklch(0.975_0.01_150)]">
      <style>{`@keyframes cm-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}@keyframes cm-dash{to{stroke-dashoffset:-20}}@keyframes cm-rise{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}@keyframes cm-ping{0%{transform:translate(-50%,-50%) scale(.6);opacity:.8}100%{transform:translate(-50%,-50%) scale(2.4);opacity:0}}.cm-rise{animation:cm-rise .5s ease both}@media (prefers-reduced-motion:reduce){.cm-rise,.cm-anim{animation:none!important}}`}</style>
      <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-4 px-[clamp(16px,3vw,32px)] pb-14 pt-[22px]">
        <div className="cm-rise flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-xs font-extrabold uppercase tracking-[.12em] text-[oklch(0.55_0.1_160)]">Cẩm nang · Bản đồ check-in</div>
            <h1 className="mt-1 text-balance text-[clamp(26px,3.6vw,40px)] font-extrabold leading-[1.08] tracking-[-.03em] text-ink">Các điểm check-in quanh Tà Xùa</h1>
            <p className="mt-1.5 max-w-[640px] text-pretty text-[15px] text-[oklch(0.45_0.02_160)]">Lấy mốc từ chợ trung tâm Tà Xùa. Chọn một lịch trình để xem cung đường đi từng ngày.</p>
          </div>
          <div className="inline-flex gap-1 rounded-[14px] bg-[oklch(0.93_0.01_160)] p-1">
            {[{ id: "all", name: "Tất cả điểm" }, ...plans].map((t) => {
              const on = planId === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => pickPlan(t.id)}
                  className="whitespace-nowrap rounded-[11px] px-4 py-[9px] text-sm font-extrabold transition-all"
                  style={{ background: on ? (t.id === "all" ? "white" : G) : "transparent", color: on ? (t.id === "all" ? G : "white") : "oklch(0.4 0.02 160)", boxShadow: on ? "0 2px 6px oklch(0.2 0.03 160 / .15)" : "none" }}
                >
                  {t.name}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid items-start gap-[18px] min-[1040px]:grid-cols-[minmax(0,1fr)_380px]">
          {/* BẢN ĐỒ */}
          <div
            className="relative h-[460px] touch-none select-none overflow-hidden rounded-[26px] border border-[oklch(0.9_0.02_200)] sm:h-[540px] min-[1040px]:h-[680px]"
            style={{ background: "linear-gradient(180deg, oklch(0.82 0.06 230) 0%, oklch(0.92 0.04 210) 38%, oklch(0.95 0.03 150) 100%)", cursor: view === "sat" ? "default" : drag ? "grabbing" : "grab" }}
            onPointerDown={(e) => view !== "sat" && setDrag({ x: e.clientX, r: rot })}
            onPointerMove={(e) => drag && setRot(drag.r + (e.clientX - drag.x) * 0.25)}
            onPointerUp={() => drag && setDrag(null)}
            onPointerLeave={() => drag && setDrag(null)}
          >
            <div className="pointer-events-none absolute left-[8%] top-[6%] h-[110px] w-[110px] rounded-full" style={{ background: "radial-gradient(circle, oklch(0.97 0.12 90), oklch(0.92 0.14 80 / 0) 70%)" }} />
            <div className="pointer-events-none absolute inset-0" style={{ perspective: 1300, perspectiveOrigin: "50% 20%" }}>
              <div
                ref={planeRef}
                className="absolute left-1/2 top-[54%] aspect-[1.25] w-[108%] sm:w-[88%] min-[1040px]:w-[78%]"
                style={{ transformStyle: "preserve-3d", transform: `translate(-50%,-50%) rotateX(${tilt}deg) rotateZ(${rot}deg)`, transition: drag ? "none" : "transform .15s ease-out" }}
              >
                <div className="absolute inset-0 rounded-[42px]" style={{ background: "radial-gradient(ellipse at 50% 55%, oklch(0.8 0.1 140) 0%, oklch(0.7 0.11 145) 45%, oklch(0.58 0.1 150) 100%)", boxShadow: "inset 0 0 0 6px oklch(0.85 0.08 135 / .6)" }} />
                <div className="absolute inset-x-0 -bottom-[26px] h-[26px] rounded-b-[42px]" style={{ background: "linear-gradient(180deg, oklch(0.5 0.07 60), oklch(0.4 0.06 55))", transformOrigin: "top", transform: "rotateX(-90deg)" }} />
                {HILLS.map(([x, y, s, bg], i) => (
                  <div key={i} className="absolute aspect-[1.3] rounded-full" style={{ left: `${x}%`, top: `${y}%`, width: `${s}%`, transform: "translate(-50%,-50%)", background: bg, boxShadow: "0 10px 20px -8px oklch(0.3 0.06 150 / .5)" }} />
                ))}
                <div className="absolute left-[4%] top-[68%] h-[12%] w-[18%] rounded-full" style={{ background: "linear-gradient(90deg, oklch(0.68 0.09 225), oklch(0.78 0.08 215))", transform: "rotate(-20deg)" }} />
                <svg viewBox="0 0 100 80" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
                  {spokes.map((pts, i) => (
                    <polyline key={i} points={pts} fill="none" stroke="oklch(0.9 0.04 85)" strokeWidth={3} strokeLinecap="round" strokeDasharray="1 7" opacity={P ? 0.35 : 0.9} vectorEffect="non-scaling-stroke" />
                  ))}
                  {routes.map((r, i) => (
                    <polyline key={i} className="cm-anim" points={r.pts} fill="none" stroke={r.c} strokeWidth={r.on ? 4 : 2} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="8 6" opacity={r.on ? 1 : 0.18} vectorEffect="non-scaling-stroke" style={{ animation: "cm-dash 1.2s linear infinite" }} />
                  ))}
                </svg>
                {SEAS.map(([x, y, s], i) => (
                  <div key={i} data-sea="1" className="absolute aspect-[2.2] rounded-full" style={{ left: `${x}%`, top: `${y}%`, width: `${s}%`, marginLeft: `-${s / 2}%`, background: "oklch(1 0 0 / .82)", filter: "blur(12px)", transform: "translateZ(20px)" }} />
                ))}
                {TREES.map((t, i) => (
                  <div key={i} className="absolute" style={{ left: `${t.x}%`, top: `${t.y}%`, transformStyle: "preserve-3d" }}>
                    <div style={stand}>
                      <div className="absolute bottom-0" style={{ left: -t.hw, width: t.w, height: t.h, background: "linear-gradient(180deg, oklch(0.5 0.1 150), oklch(0.32 0.07 155))", clipPath: "polygon(50% 0, 100% 100%, 0 100%)" }} />
                    </div>
                  </div>
                ))}
                {MOUNTAINS.map(([x, y, w, h, clip, label], i) => (
                  <div key={i} className="absolute" style={{ left: `${x}%`, top: `${y}%`, transformStyle: "preserve-3d" }}>
                    <div style={stand}>
                      <div className="absolute" style={{ left: -Math.round(w / 2), bottom: -4, width: w, height: h, background: `linear-gradient(180deg, ${i === 0 ? "oklch(0.62 0.06 200)" : "oklch(0.6 0.08 170)"}, oklch(0.4 0.07 160))`, clipPath: clip }} />
                      {label && <div className="absolute left-0 -translate-x-1/2 whitespace-nowrap rounded-full bg-white/85 px-2 py-[3px] text-[11px] font-extrabold text-ink" style={{ bottom: h }}>{label}</div>}
                    </div>
                  </div>
                ))}
                {CLOUDS.map(([x, y, s], i) => (
                  <div key={i} data-cloud="1" className="absolute aspect-[2.4] rounded-full" style={{ left: `${x}%`, top: `${y}%`, width: `${s}%`, background: "oklch(1 0 0 / .75)", filter: "blur(10px)", transform: "translateZ(90px)" }} />
                ))}
                {/* xe máy */}
                <div ref={carRef} className="absolute left-0 top-0" style={{ transformStyle: "preserve-3d" }}>
                  <div className="absolute left-0 top-0 h-3 w-[30px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[oklch(0.2_0.04_150/.35)]" />
                  <div style={stand}>
                    <div ref={bikeRef} className="absolute bottom-0 left-[-26px] h-[46px] w-[52px]">
                      <div ref={dustRef} className="absolute bottom-0.5 left-[-10px] h-3 w-3 rounded-full bg-[oklch(0.9_0.02_80/.8)]" />
                      <div className="absolute bottom-0 left-0.5 h-[15px] w-[15px] rounded-full border-[3px] border-[oklch(0.55_0.01_160)] bg-[oklch(0.22_0.01_160)]" />
                      <div className="absolute bottom-0 left-[35px] h-[15px] w-[15px] rounded-full border-[3px] border-[oklch(0.55_0.01_160)] bg-[oklch(0.22_0.01_160)]" />
                      <div className="absolute bottom-[9px] left-2 h-[9px] w-8 bg-[oklch(0.62_0.19_30)]" style={{ borderRadius: "6px 10px 3px 3px" }} />
                      <div className="absolute bottom-[7px] left-[39px] h-[18px] w-[3px] bg-[oklch(0.3_0.01_160)]" style={{ transform: "rotate(-22deg)", transformOrigin: "bottom" }} />
                      <div className="absolute bottom-[13px] left-[42px] h-1 w-[5px] rounded-sm bg-[oklch(0.97_0.1_95)]" style={{ boxShadow: "0 0 8px 3px oklch(0.96 0.12 95 / .6)" }} />
                      <div className="absolute bottom-4 left-[7px] h-[15px] w-[11px] bg-[oklch(0.62_0.12_250)]" style={{ borderRadius: "5px 5px 2px 2px", transform: "rotate(-10deg)" }} />
                      <div className="absolute bottom-[30px] left-1.5 h-[11px] w-3 rounded-full bg-[oklch(0.75_0.13_350)]" />
                      <div className="absolute bottom-4 left-[19px] h-4 w-3 bg-[oklch(0.42_0.09_160)]" style={{ borderRadius: "5px 5px 2px 2px", transform: "rotate(-14deg)" }} />
                      <div className="absolute bottom-[31px] left-[21px] h-3 w-[13px] rounded-full bg-[oklch(0.68_0.18_45)]" />
                      <div className="absolute bottom-[34px] left-[29px] h-1 w-1.5 rounded-sm bg-[oklch(0.3_0.03_230)]" />
                      <div className="absolute bottom-6 left-[27px] h-[3px] w-[13px] rounded-sm bg-[oklch(0.42_0.09_160)]" style={{ transform: "rotate(-12deg)" }} />
                      <div className="absolute bottom-3 left-3.5 h-1 w-4 rounded-sm bg-[oklch(0.28_0.04_260)]" />
                    </div>
                  </div>
                </div>
                {/* nhãn điểm */}
                {pins.map((p) => (
                  <div key={p.s.id} className="absolute" style={{ left: `${p.x}%`, top: `${p.y}%`, transformStyle: "preserve-3d" }}>
                    <div className="absolute left-0 top-0 h-2.5 w-[22px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[oklch(0.2_0.04_150/.35)]" />
                    {p.on && <div className="cm-anim absolute left-0 top-0 h-10 w-10 rounded-full border-[3px]" style={{ borderColor: p.c, animation: "cm-ping 1.4s ease-out infinite" }} />}
                    <div style={{ ...stand, opacity: p.dim ? 0.35 : 1, transition: "opacity .3s" }}>
                      <div className="cm-anim absolute bottom-0 left-0 flex -translate-x-1/2 flex-col items-center" style={{ animation: `cm-bob ${p.bob}s ease-in-out infinite` }}>
                        <button
                          type="button"
                          data-pill={p.s.id}
                          onClick={(e) => { e.stopPropagation(); setSel(p.s.id); }}
                          className="pointer-events-auto flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full border-2 font-extrabold shadow-[0_8px_16px_-6px_oklch(0.2_0.04_150/.5)] transition-transform duration-200"
                          style={{
                            padding: p.isC ? "8px 14px" : `5px 10px 5px ${p.num ? "5px" : "10px"}`,
                            background: p.isC ? G : p.on ? p.c : "white",
                            color: p.isC || p.on ? "white" : "oklch(0.22 0.03 160)",
                            borderColor: p.isC ? "white" : p.c,
                            fontSize: p.isC ? 13 : 12,
                            transform: `scale(${p.on ? 1.12 : 1})`,
                          }}
                        >
                          {p.num && <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full text-[11px] text-white" style={{ background: p.on ? "oklch(0.2 0.03 160 / .35)" : p.c }}>{p.num}</span>}
                          <span>{p.s.name}</span>
                          {!P && fmtKm(p.s.km) && <span className="text-[11px] font-semibold opacity-65">{fmtKm(p.s.km)}</span>}
                        </button>
                        <div data-stem={p.stem} className="w-[3px]" style={{ height: p.stem, background: `linear-gradient(180deg, ${p.c}, oklch(0.3 0.04 150))` }} />
                        <div className="-mt-0.5 h-2.5 w-2.5 rounded-full border-2 border-white" style={{ background: p.c }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pointer-events-none absolute left-3.5 top-14 flex flex-wrap gap-1.5 sm:top-3.5">
              {(P ? P.days.map((_, i) => ({ name: `Ngày ${i + 1}`, c: DAYC[i % DAYC.length] })) : [{ name: "Hướng từ trung tâm", c: "oklch(0.88 0.04 85)" }]).map((l) => (
                <span key={l.name} className="flex items-center gap-1.5 whitespace-nowrap rounded-full bg-white/90 px-2.5 py-1.5 text-xs font-bold text-ink">
                  <span className="h-1 w-3.5 rounded-sm" style={{ background: l.c }} />
                  {l.name}
                </span>
              ))}
            </div>
            {view === "3d" && (
              <div className="absolute right-3.5 top-14 flex flex-col gap-1.5 sm:top-3.5" onPointerDown={stop}>
                <button type="button" title="Xoay trái" aria-label="Xoay trái" onClick={() => setRot((r) => r - 20)} className={CTRL}>↺</button>
                <button type="button" title="Xoay phải" aria-label="Xoay phải" onClick={() => setRot((r) => r + 20)} className={CTRL}>↻</button>
                <button type="button" title="Đổi góc nhìn" aria-label="Đổi góc nhìn" onClick={() => setTilt((t) => (t > 45 ? 30 : 54))} className={cn(CTRL, "text-xs")}>{tilt > 45 ? "3D" : "2D"}</button>
              </div>
            )}
            {view === "3d" && !sp && (
              <div className="pointer-events-none absolute bottom-3.5 right-3.5 rounded-full bg-white/85 px-2.5 py-[5px] text-[11px] font-semibold text-[oklch(0.4_0.02_160)]">
                Kéo để xoay · đúng hướng, khoảng cách đã thu gọn · xem chính xác ở tab Vệ tinh
              </div>
            )}

            {view === "sat" && (
              <>
                <div className="absolute inset-0 z-[5] isolate" onPointerDown={stop}>
                  <SatelliteMap spots={satSpots} selected={sel} onSelect={setSel} />
                </div>
                <div className="absolute inset-x-3 bottom-3 z-[6] flex gap-1.5 overflow-x-auto p-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" onPointerDown={stop}>
                  {satSpots.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSel(s.id)}
                      className="flex-none whitespace-nowrap rounded-full px-3 py-2 text-xs font-extrabold shadow-[0_4px_12px_-4px_oklch(0.2_0.04_150/.4)]"
                      style={{ background: sel === s.id ? G : "white", color: sel === s.id ? "white" : "oklch(0.25 0.03 160)" }}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              </>
            )}
            <div className="absolute left-1/2 top-3.5 z-[7] inline-flex -translate-x-1/2 gap-[3px] rounded-full bg-white p-[3px] shadow-[0_6px_16px_-6px_oklch(0.2_0.04_150/.4)]" onPointerDown={stop}>
              {([["3d", "Hoạt hình 3D"], ["sat", "Ảnh vệ tinh"]] as const).map(([k, name]) => (
                <button key={k} type="button" onClick={() => setView(k)} className="whitespace-nowrap rounded-full px-3.5 py-[7px] text-xs font-extrabold" style={{ background: view === k ? G : "transparent", color: view === k ? "white" : "oklch(0.35 0.02 160)" }}>
                  {name}
                </button>
              ))}
            </div>

            {view === "3d" && sp && (
              <div className="absolute bottom-3.5 left-3.5 w-[min(320px,calc(100%-28px))] overflow-hidden rounded-[18px] bg-white shadow-[0_20px_40px_-16px_oklch(0.2_0.04_150/.45)]" style={{ animation: "cm-rise .3s ease both" }} onPointerDown={stop}>
                <div className="relative aspect-[16/8]">
                  {sp.image ? (
                    <Image src={sp.image} alt={sp.name} fill sizes="320px" className="object-cover" />
                  ) : (
                    <div className="h-full w-full" style={{ background: "linear-gradient(160deg, oklch(0.5 0.07 200), oklch(0.34 0.06 165) 60%, oklch(0.27 0.05 160))" }} />
                  )}
                  <button type="button" aria-label="Đóng" onClick={() => setSel(null)} className="absolute right-2 top-2 flex h-[30px] w-[30px] items-center justify-center rounded-full bg-white font-extrabold">×</button>
                </div>
                <div className="flex flex-col gap-1.5 px-3.5 pb-3.5 pt-3">
                  <div className="text-base font-extrabold text-ink">{sp.name}</div>
                  {spFacts.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {spFacts.map((f) => (
                        <span key={f} className="whitespace-nowrap rounded-full bg-[oklch(0.95_0.025_155)] px-2 py-[3px] text-[11px] font-bold text-[oklch(0.36_0.08_155)]">{f}</span>
                      ))}
                    </div>
                  )}
                  {sp.desc && <div className="text-[13px] leading-normal text-[oklch(0.38_0.02_160)]">{sp.desc}</div>}
                  {sp.tip && <div className="text-xs leading-normal text-[oklch(0.48_0.15_50)]"><b>Mẹo:</b> {sp.tip}</div>}
                  <a href={sp.mapUrl} target="_blank" rel="noopener noreferrer" className="text-[13px] font-bold text-[oklch(0.4_0.08_160)] hover:text-sunset-500">Chỉ đường Google Maps ↗</a>
                </div>
              </div>
            )}
          </div>

          {/* BẢNG BÊN */}
          <aside className="cm-rise flex flex-col gap-3" style={{ animationDelay: ".1s" }}>
            <div className="flex flex-col gap-2.5 rounded-[20px] border border-[oklch(0.92_0.01_160)] bg-white px-[18px] py-4">
              <div className="text-lg font-extrabold tracking-[-.01em] text-ink">{P ? `Tà Xùa ${P.name}` : "Điểm check-in nổi tiếng"}</div>
              <div className="text-[13px] leading-normal text-[oklch(0.45_0.02_160)]">
                {P ? P.sub : "Khoảng cách theo đường xe máy từ trung tâm xã Tà Xùa. Bấm một điểm trên bản đồ hoặc trong danh sách để xem chi tiết."}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {stats.map((s) => (
                  <div key={s.k} className="rounded-xl bg-[oklch(0.97_0.008_160)] p-2.5">
                    <div className="text-lg font-extrabold text-ink">{s.v}</div>
                    <div className="text-[11px] font-semibold text-[oklch(0.5_0.02_160)]">{s.k}</div>
                  </div>
                ))}
              </div>
            </div>

            {P ? (
              <>
                <div className="flex flex-wrap gap-1.5">
                  {[{ name: "Cả lịch trình", c: G, k: 0 }, ...P.days.map((_, i) => ({ name: `Ngày ${i + 1}`, c: DAYC[i % DAYC.length], k: i + 1 }))].map((d) => (
                    <button
                      key={d.k}
                      type="button"
                      onClick={() => setDay(d.k)}
                      className="flex items-center gap-1.5 whitespace-nowrap rounded-full border-[1.5px] px-3 py-[7px] text-[13px] font-bold text-[oklch(0.25_0.03_160)]"
                      style={{ background: day === d.k ? "oklch(0.96 0.02 155)" : "white", borderColor: day === d.k ? d.c : "oklch(0.9 0.01 160)" }}
                    >
                      <span className="h-2 w-2 rounded-full" style={{ background: d.c }} />
                      {d.name}
                    </button>
                  ))}
                </div>
                <div className="flex flex-col gap-2.5 pr-0.5 min-[1040px]:max-h-[420px] min-[1040px]:overflow-y-auto">
                  {P.days.map((d, di) => {
                    const c = DAYC[di % DAYC.length];
                    return (
                      <div key={di} className="flex flex-col gap-2.5 rounded-[18px] border border-[oklch(0.92_0.01_160)] bg-white px-4 py-3.5 transition-opacity" style={{ opacity: day === 0 || day === di + 1 ? 1 : 0.45 }}>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="flex-none rounded-full px-[9px] py-[3px] text-[11px] font-extrabold text-white" style={{ background: c }}>Ngày {di + 1}</span>
                            <span className="truncate text-sm font-extrabold text-ink">{d.title}</span>
                          </div>
                          {dayKm[di] > 0 && <span className="whitespace-nowrap text-xs font-semibold text-[oklch(0.5_0.02_160)]">~{Math.round(dayKm[di])} km</span>}
                        </div>
                        <div className="flex flex-col">
                          {d.stops.map((s, si) => (
                            <button
                              key={si}
                              type="button"
                              onClick={() => { setSel(s.spotId); setDay(di + 1); }}
                              className="grid grid-cols-[48px_18px_minmax(0,1fr)] items-start gap-2 rounded-[10px] p-1.5 text-left hover:bg-[oklch(0.97_0.01_155)]"
                              style={{ background: sel === s.spotId ? "oklch(0.96 0.025 155)" : undefined }}
                            >
                              <span className="pt-px text-xs font-extrabold text-[oklch(0.45_0.02_160)]">{s.time}</span>
                              <span className="flex h-full flex-col items-center">
                                <span className="mt-0.5 h-3 w-3 flex-none rounded-full border-[3px] bg-white" style={{ borderColor: c }} />
                                <span className="mt-0.5 w-0.5 flex-1" style={{ background: si === d.stops.length - 1 ? "transparent" : "oklch(0.9 0.01 160)" }} />
                              </span>
                              <span className="min-w-0 pb-1">
                                <span className="block text-sm font-bold leading-[1.35] text-ink">{s.name}</span>
                                {s.note && <span className="block text-xs leading-[1.45] text-[oklch(0.5_0.02_160)]">{s.note}</span>}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <Link href="/combo" className="rounded-full bg-[oklch(0.68_0.18_45)] p-[13px] text-center text-[15px] font-extrabold text-white transition hover:brightness-105">
                  Đặt combo {P.name} theo lịch trình này →
                </Link>
                <Link href="/lich-trinh" className="rounded-full border-[1.5px] border-[oklch(0.88_0.015_160)] bg-white p-[11px] text-center text-sm font-bold text-[oklch(0.4_0.08_160)] transition hover:text-sunset-500">
                  Xem lịch trình chi tiết theo giờ
                </Link>
              </>
            ) : (
              <div className="flex flex-col gap-2">
                {listed.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSel(s.id)}
                    className="grid grid-cols-[56px_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-[oklch(0.92_0.01_160)] py-2 pl-2 pr-2.5 text-left transition hover:border-[oklch(0.75_0.06_155)]"
                    style={{ background: sel === s.id ? "oklch(0.96 0.025 155)" : "white" }}
                  >
                    <div className="relative h-11 w-14 overflow-hidden rounded-[10px]" style={{ background: "linear-gradient(160deg, oklch(0.5 0.07 200), oklch(0.34 0.06 165))" }}>
                      {s.image && <Image src={s.image} alt="" fill sizes="56px" className="object-cover" />}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-extrabold text-ink">{s.name}</div>
                      <div className="truncate text-xs text-[oklch(0.5_0.02_160)]">{s.sub}</div>
                    </div>
                    {s.km != null && s.km > 0 && (
                      <div className="text-right">
                        <div className="text-sm font-extrabold text-ink">{fmtKm(s.km)}</div>
                        <div className="whitespace-nowrap text-[11px] text-[oklch(0.5_0.02_160)]">{minsOf(s.km)}</div>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
