"use client";

import { useEffect, useRef } from "react";
import type { CabinDirection } from "@prisma/client";

export interface RouteStopView {
  time: string;
  place: string;
  note: string | null;
  tag: string | null;
}
export interface RouteView {
  direction: CabinDirection;
  title: string | null;
  totalTime: string | null;
  startLabel: string | null;
  startInfo: string | null;
  fromPoint: string | null;
  toPoint: string | null;
  price: number | null; // giá vé 1 chiều của chiều này
  stops: RouteStopView[];
}

function vnd(n: number | null): string {
  if (n == null) return "Liên hệ";
  return new Intl.NumberFormat("vi-VN").format(n) + "đ";
}

const DOT_BASE = "oklch(0.97 0.01 160)";
const DOT_BASE_HALO = "oklch(1 0 0 / .12)";
const DOT_LAST = "oklch(0.72 0.17 50)";
const DOT_LAST_HALO = "oklch(0.72 0.17 50 / .3)";

function cfg(dir: CabinDirection) {
  if (dir === "RETURN") {
    return {
      kind: "ve",
      label: "Chiều về",
      skyBase: "linear-gradient(180deg, oklch(0.75 0.08 235), oklch(0.88 0.05 220))",
      skyTop: "linear-gradient(180deg, oklch(0.4 0.1 300), oklch(0.72 0.15 45))",
      glow: "oklch(0.7 0.15 40 / .3)",
      sunInit: 12,
      starsInit: 0,
    };
  }
  return {
    kind: "di",
    label: "Chiều đi",
    skyBase: "linear-gradient(180deg, oklch(0.22 0.05 265), oklch(0.32 0.06 260))",
    skyTop: "linear-gradient(180deg, oklch(0.72 0.1 20), oklch(0.85 0.12 65))",
    glow: "oklch(0.75 0.15 55 / .35)",
    sunInit: 80,
    starsInit: 1,
  };
}

function Sky({ c, mobile }: { c: ReturnType<typeof cfg>; mobile?: boolean }) {
  return (
    <div
      className={mobile ? "relative h-[88px] overflow-hidden rounded-[14px]" : "relative h-[104px] w-[260px] flex-none overflow-hidden rounded-2xl"}
      style={{ background: c.skyBase }}
    >
      <div data-skytop="1" className="absolute inset-0" style={{ background: c.skyTop, opacity: 0 }} />
      <div data-stars="1" className="absolute inset-0" style={{ opacity: c.starsInit }}>
        <span className="absolute h-[3px] w-[3px] rounded-full bg-white" style={{ left: 24, top: 18 }} />
        <span className="absolute h-[2px] w-[2px] rounded-full bg-white" style={{ left: 70, top: 34 }} />
        <span className="absolute h-[3px] w-[3px] rounded-full bg-white" style={{ left: 118, top: 14 }} />
        <span className="absolute h-[2px] w-[2px] rounded-full bg-white" style={{ left: 200, top: 26 }} />
        <span className="absolute h-[3px] w-[3px] rounded-full bg-white" style={{ left: 228, top: 12 }} />
      </div>
      <div
        data-sun="1"
        className="absolute h-11 w-11 rounded-full"
        style={{
          left: mobile ? 190 : 150,
          top: 0,
          background: "oklch(0.9 0.14 85)",
          boxShadow: "0 0 0 9px oklch(0.92 0.13 85 / .22), 0 0 44px 14px oklch(0.85 0.16 60 / .55)",
          transform: `translateY(${c.sunInit}px)`,
        }}
      />
      <div data-cloud="1" className="absolute -bottom-3.5 left-[-20px] right-[-20px] h-12">
        <span className="absolute bottom-0 left-0 h-10 w-[130px] rounded-full" style={{ background: "oklch(0.97 0.01 250 / .92)" }} />
        <span className="absolute left-[90px] h-11 w-[150px] rounded-full" style={{ bottom: -6, background: "oklch(0.99 0.005 250 / .96)" }} />
        <span className="absolute left-[200px] h-[34px] w-[110px] rounded-full" style={{ bottom: 2, background: "oklch(0.95 0.015 250 / .9)" }} />
      </div>
    </div>
  );
}

function Car() {
  return (
    <div data-car="1" className="pointer-events-none absolute left-0 top-0 z-20 h-6 w-[46px]" style={{ opacity: 0 }}>
      <div className="absolute left-0 top-0 h-[18px] w-[46px]" style={{ borderRadius: "6px 10px 4px 4px", background: "oklch(0.7 0.18 48)", boxShadow: "0 4px 10px oklch(0.1 0.02 160 / .4)" }} />
      <div className="absolute" style={{ left: 6, top: 4, width: 22, height: 6, borderRadius: 2, background: "oklch(0.92 0.03 230)" }} />
      <div className="absolute" style={{ left: 31, top: 3, width: 11, height: 7, borderRadius: "2px 5px 2px 2px", background: "oklch(0.92 0.03 230)" }} />
      <div className="absolute" style={{ right: -2, top: 11, width: 4, height: 4, borderRadius: "50%", background: "oklch(0.97 0.1 95)", boxShadow: "0 0 10px 4px oklch(0.95 0.12 95 / .55)" }} />
      <div className="absolute" style={{ left: 6, top: 14, width: 10, height: 10, borderRadius: "50%", background: "oklch(0.18 0.01 160)", border: "2px solid oklch(0.85 0.01 160)" }} />
      <div className="absolute" style={{ left: 30, top: 14, width: 10, height: 10, borderRadius: "50%", background: "oklch(0.18 0.01 160)", border: "2px solid oklch(0.85 0.01 160)" }} />
    </div>
  );
}

function dotProps(isLast: boolean) {
  return {
    "data-dot": "1",
    "data-lit": isLast ? DOT_LAST : DOT_BASE,
    "data-halo": isLast ? DOT_LAST_HALO : DOT_BASE_HALO,
    style: {
      background: isLast ? DOT_LAST : DOT_BASE,
      boxShadow: `0 0 0 5px ${isLast ? DOT_LAST_HALO : DOT_BASE_HALO}`,
    } as React.CSSProperties,
  };
}

export function CabinRoutes({ routes, routeName }: { routes: RouteView[]; routeName?: string | null }) {
  const withStops = routes.filter((r) => r.stops.length > 0);
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const root0 = container.current;
    if (!root0) return;
    const ease = (x: number) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
    const t0 = performance.now();
    let raf = 0;

    const tick = (now: number) => {
      const L = 11, seg = 1.7, pause = 0.5, start = 0.5;
      const t = ((now - t0) / 1000) % L;
      let f = 3, tt = t - start;
      if (tt <= 0) f = 0;
      else {
        for (let i = 0; i < 3; i++) {
          if (tt < seg) { f = i + ease(tt / seg); break; }
          tt -= seg;
          if (i < 2) { if (tt < pause) { f = i + 1; break; } tt -= pause; }
        }
      }
      const arrive = start + 3 * seg + 2 * pause;
      const dawn = ease(Math.min(1, Math.max(0, (t - arrive) / 2)));
      const fade = t > L - 0.5 ? (L - t) / 0.5 : t < 0.4 ? t / 0.4 : 1;

      root0.querySelectorAll<HTMLElement>("[data-route-card]").forEach((root) => {
        const rr = root.getBoundingClientRect();
        if (rr.width === 0) return; // ẩn (display:none)
        const sc = rr.width / (root.offsetWidth || 1);
        const dots = root.querySelectorAll<HTMLElement>("[data-dot]");
        if (dots.length < 2) return;
        const n = dots.length;
        const ff = Math.min(n - 1, (f * (n - 1)) / 3); // scale f(0..3) -> 0..n-1
        const pts = [...dots].map((d) => {
          const b = d.getBoundingClientRect();
          return { x: (b.left + b.width / 2 - rr.left) / sc, y: (b.top + b.height / 2 - rr.top) / sc };
        });
        const i = Math.min(n - 2, Math.floor(ff));
        const fr = ff - i;
        const x = pts[i].x + (pts[i + 1].x - pts[i].x) * fr;
        const y = pts[i].y + (pts[i + 1].y - pts[i].y) * fr;
        const vert = root.dataset.vertical === "1";
        const car = root.querySelector<HTMLElement>("[data-car]");
        const bob = Math.sin(now / 90) * (fr > 0 && fr < 1 ? 0.8 : 0);
        if (car) {
          car.style.transform = vert
            ? `translate(${x - 23}px,${y - 12 + bob}px) rotate(90deg)`
            : `translate(${x - 23}px,${y - 30 + bob}px)`;
          car.style.opacity = String(fade);
        }
        dots.forEach((d, j) => {
          const on = j <= ff + 0.001 && fade > 0.05;
          d.style.background = on ? d.dataset.lit! : "oklch(1 0 0 / .22)";
          d.style.boxShadow = on ? `0 0 0 5px ${d.dataset.halo}` : "0 0 0 5px oklch(1 0 0 / .05)";
        });
        root.querySelectorAll<HTMLElement>("[data-row]").forEach((r, j) => {
          r.style.opacity = j <= ff + 0.001 ? "1" : ".45";
        });
        const ve = root.dataset.kind === "ve";
        const sun = root.querySelector<HTMLElement>("[data-sun]");
        if (sun) sun.style.transform = `translateY(${ve ? 12 + dawn * 70 : 80 - dawn * 70}px)`;
        const skytop = root.querySelector<HTMLElement>("[data-skytop]");
        if (skytop) skytop.style.opacity = String(dawn);
        const stars = root.querySelector<HTMLElement>("[data-stars]");
        if (stars) stars.style.opacity = String(ve ? dawn * 0.9 : 1 - dawn);
        const glow = root.querySelector<HTMLElement>("[data-glow]");
        if (glow) glow.style.opacity = String(dawn);
        const cloud = root.querySelector<HTMLElement>("[data-cloud]");
        if (cloud) cloud.style.transform = `translateX(${Math.sin(now / 1800) * 8}px)`;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [withStops.length]);

  // Xe chạy NGANG trên "đường" ở đáy card mobile (giống trang chủ).
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const root = container.current;
    if (!root) return;
    const t0 = performance.now();
    let raf = 0;
    const loop = (now: number) => {
      root.querySelectorAll<HTMLElement>("[data-lane-wrap]").forEach((wrap) => {
        const W = wrap.offsetWidth;
        if (W === 0) return; // ẩn (đang ở desktop)
        const car = wrap.querySelector<HTMLElement>("[data-lane-car]");
        const lane = wrap.querySelector<HTMLElement>("[data-lane]");
        if (!car) return;
        const back = wrap.dataset.kind === "ve";
        const D = 9000;
        const f = ((now - t0) % D) / D;
        const x = back ? W - f * (W + 70) : -70 + f * (W + 70);
        const bob = Math.sin(now / 80) * 0.8;
        car.style.transform = `translate(${x}px,${bob}px) scaleX(${back ? -1 : 1})`;
        if (lane) lane.style.backgroundPosition = `${(back ? 1 : -1) * (((now - t0) / 25) % 36)}px 0`;
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [withStops.length]);

  if (withStops.length === 0) return null;

  return (
    <section className="mt-8" ref={container}>
      <h2 className="text-lg font-semibold text-ink">Lộ trình</h2>
      {routeName && <p className="mt-1 text-sm text-gray-500">{routeName}</p>}

      <div className="mt-4 space-y-5">
        {withStops.map((r) => {
          const c = cfg(r.direction);
          return (
            <div key={r.direction}>
              {/* DESKTOP */}
              <div
                data-route-card="1"
                data-kind={c.kind}
                className="relative hidden overflow-hidden rounded-[22px] text-white lg:block"
                style={{ background: "oklch(0.27 0.05 160)" }}
              >
                <div data-glow="1" className="pointer-events-none absolute inset-0" style={{ background: `radial-gradient(circle at 88% 12%, ${c.glow}, transparent 55%)`, opacity: 0 }} />
                <div className="relative flex items-center justify-between gap-6 px-8 pt-6">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.08em]" style={{ color: "oklch(0.82 0.12 60)" }}>
                      <span className="h-2 w-2 rounded-full" style={{ background: "oklch(0.72 0.17 50)" }} />
                      {c.label} · {r.fromPoint || ""} {r.toPoint ? `→ ${r.toPoint}` : ""}
                    </div>
                    {r.title && <div className="mt-2 text-3xl font-extrabold leading-tight tracking-tight">{r.title}</div>}
                    <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-sm ring-1 ring-white/15">
                      <span className="opacity-80">Vé 1 chiều</span>
                      <span className="text-base font-extrabold" style={{ color: "oklch(0.82 0.13 60)" }}>{vnd(r.price)}</span>
                    </div>
                  </div>
                  <Sky c={c} />
                </div>

                <div className="relative grid px-8 pb-7 pt-12" style={{ gridTemplateColumns: `repeat(${r.stops.length}, minmax(0,1fr))` }}>
                  {r.stops.map((s, i) => {
                    const last = i === r.stops.length - 1;
                    return (
                      <div key={i} data-row="1" className="relative flex flex-col gap-3 pr-5 transition-opacity">
                        <div className="relative flex h-[22px] items-center">
                          {!last && <div className="absolute" style={{ left: 22, right: -2, top: 10, height: 2, background: "oklch(1 0 0 / .4)" }} />}
                          <div className="relative h-[22px] w-[22px] rounded-full transition-all" {...dotProps(last)} />
                        </div>
                        <div className="text-[38px] font-extrabold leading-none tracking-tight" style={{ color: last ? "oklch(0.82 0.13 60)" : "white" }}>{s.time}</div>
                        <div>
                          <div className="text-[18px] font-bold">{s.place}</div>
                          {s.note && <div className="mt-1 text-[14px] leading-normal" style={{ color: "oklch(0.85 0.02 160)" }}>{s.note}</div>}
                        </div>
                        {s.tag && (
                          <div className="self-start rounded-full px-2.5 py-[5px] text-xs font-semibold" style={last ? { background: "oklch(0.72 0.17 50)", color: "white" } : { background: "oklch(1 0 0 / .1)", color: "oklch(0.92 0.02 160)" }}>
                            {s.tag}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="relative grid gap-px border-t text-[14px]" style={{ gridTemplateColumns: "repeat(4,minmax(0,1fr))", background: "oklch(1 0 0 / .12)", borderColor: "oklch(1 0 0 / .12)" }}>
                  <Foot label="Điểm đón" value={r.fromPoint} />
                  <Foot label="Điểm trả" value={r.toPoint} />
                  <Foot label={r.startLabel || "Khởi hành"} value={r.startInfo} />
                  <Foot label="Tổng thời gian" value={r.totalTime} />
                </div>
                <Car />
              </div>

              {/* MOBILE — xe chạy ngang trên "đường" ở đáy card (giống trang chủ) */}
              <div
                data-kind={c.kind}
                className="relative overflow-hidden rounded-[20px] px-[18px] pb-[18px] pt-[14px] text-white lg:hidden"
                style={{ background: "oklch(0.27 0.05 160)" }}
              >
                <div data-glow="1" className="pointer-events-none absolute inset-0" style={{ background: `radial-gradient(circle at 70% 6%, ${c.glow}, transparent 60%)`, opacity: 0 }} />
                <Sky c={c} mobile />
                <div className="relative mt-4 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.08em]" style={{ color: "oklch(0.82 0.12 60)" }}>
                  <span className="h-[7px] w-[7px] rounded-full" style={{ background: "oklch(0.72 0.17 50)" }} />
                  {c.label}{r.totalTime ? ` · ${r.totalTime}` : ""}
                </div>
                {r.title && <div className="relative mt-1.5 text-[23px] font-extrabold leading-tight tracking-tight">{r.title}</div>}
                <div className="relative mt-2 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[13px] ring-1 ring-white/15">
                  <span className="opacity-80">Vé 1 chiều</span>
                  <span className="font-extrabold" style={{ color: "oklch(0.82 0.13 60)" }}>{vnd(r.price)}</span>
                </div>

                <div className="relative mt-5 flex flex-col">
                  {r.stops.map((s, i) => {
                    const last = i === r.stops.length - 1;
                    return (
                      <div key={i} data-row="1" className="grid transition-opacity" style={{ gridTemplateColumns: "62px 22px minmax(0,1fr)", columnGap: 14 }}>
                        <div className="text-[21px] font-extrabold leading-[22px] tracking-tight" style={{ color: last ? "oklch(0.82 0.13 60)" : "white" }}>{s.time}</div>
                        <div className="flex flex-col items-center">
                          <div className="mt-0.5 h-[18px] w-[18px] flex-none rounded-full transition-all" {...dotProps(last)} />
                          {!last && <div className="my-2 min-h-[24px] w-0.5 flex-1" style={{ background: "oklch(1 0 0 / .4)" }} />}
                        </div>
                        <div className="pb-5">
                          <div className="text-[16px] font-bold leading-[22px]">{s.place}</div>
                          {s.note && <div className="mt-0.5 text-[13px] leading-normal" style={{ color: "oklch(0.85 0.02 160)" }}>{s.note}</div>}
                          {s.tag && (
                            <div className="mt-2 inline-block rounded-full px-[9px] py-1 text-[11px] font-semibold" style={last ? { background: "oklch(0.72 0.17 50)", color: "white" } : { background: "oklch(1 0 0 / .1)", color: "oklch(0.92 0.02 160)" }}>
                              {s.tag}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="relative border-t pt-3 text-[13px]" style={{ borderColor: "oklch(1 0 0 / .14)", color: "oklch(0.85 0.02 160)" }}>
                  Đón: {r.fromPoint || "—"} · Trả: {r.toPoint || "—"}
                </div>
                <RoadLane kind={c.kind} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** Dải "đường" ngang + xe chạy ở đáy card mobile (giống trang chủ). */
function RoadLane({ kind }: { kind: string }) {
  return (
    <div data-lane-wrap="1" data-kind={kind} className="relative -mx-[18px] -mb-[18px] mt-4 h-12 overflow-hidden">
      <div className="absolute inset-x-0 bottom-0 h-6" style={{ background: "oklch(0.2 0.035 160)" }} />
      <div data-lane="1" className="absolute inset-x-0 bottom-2.5 h-0.5" style={{ backgroundImage: "repeating-linear-gradient(90deg,oklch(1 0 0 / .28) 0 18px,transparent 18px 36px)" }} />
      <div data-lane-car="1" className="absolute bottom-3 left-0 h-[26px] w-14 will-change-transform">
        <div className="absolute left-0 top-0 h-5 w-14" style={{ borderRadius: "7px 12px 4px 4px", background: "oklch(0.7 0.18 48)", boxShadow: "0 5px 12px oklch(0.1 0.02 160 / .45)" }} />
        <div className="absolute" style={{ left: 7, top: 4, width: 26, height: 6, borderRadius: 2, background: "oklch(0.92 0.03 230)" }} />
        <div className="absolute" style={{ left: 37, top: 3, width: 13, height: 7, borderRadius: "2px 6px 2px 2px", background: "oklch(0.92 0.03 230)" }} />
        <div className="absolute" style={{ right: -3, top: 11, width: 4, height: 4, borderRadius: "50%", background: "oklch(0.97 0.1 95)", boxShadow: "0 0 12px 5px oklch(0.95 0.12 95 / .5)" }} />
        <div className="absolute" style={{ left: 8, top: 15, width: 11, height: 11, borderRadius: "50%", background: "oklch(0.16 0.01 160)", border: "2px solid oklch(0.82 0.01 160)" }} />
        <div className="absolute" style={{ left: 36, top: 15, width: 11, height: 11, borderRadius: "50%", background: "oklch(0.16 0.01 160)", border: "2px solid oklch(0.82 0.01 160)" }} />
      </div>
    </div>
  );
}

function Foot({ label, value }: { label: string; value: string | null }) {
  return (
    <div style={{ background: "oklch(0.27 0.05 160)" }} className="px-5 py-3.5">
      <span style={{ opacity: 0.7 }}>{label}</span>
      <div className="mt-0.5 font-semibold">{value || "—"}</div>
    </div>
  );
}
