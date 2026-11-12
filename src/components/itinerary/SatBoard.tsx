"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import type { Map as LMap, Marker, LayerGroup } from "leaflet";

type Pt = [number, number]; // [vĩ độ, kinh độ]
export type BoardCat = "cam" | "cafe" | "start" | "center";

export interface BoardSpot {
  id: string;
  cat: BoardCat;
  name: string;
  lat: number;
  lng: number;
  sub: string;
  desc: string;
  tip: string;
  best: string;
  image: string | null;
  mapUrl: string;
  href: string | null; // trang chi tiết (quán cafe / nhà hàng)
}

export interface BoardPlan {
  id: string;
  name: string;
  sub: string;
  days: { title: string; path: Pt[]; stops: { time: string; name: string; note: string; spotId: string; own: boolean }[] }[];
}

const G = "oklch(0.29 0.055 160)";
const CAT: Record<BoardCat, [string, string]> = {
  cam: ["Điểm check-in", "oklch(0.58 0.2 300)"],
  cafe: ["Cafe & ăn", "oklch(0.68 0.18 50)"],
  start: ["Bến xe cabin", "oklch(0.35 0.08 160)"],
  center: ["Trung tâm", "oklch(0.55 0.16 250)"],
};
const DAYC = ["oklch(0.7 0.18 50)", "oklch(0.65 0.16 155)", "oklch(0.62 0.16 250)", "oklch(0.62 0.17 330)", "oklch(0.68 0.15 90)"];
const FREEC = ["oklch(0.75 0.18 60)", "oklch(0.75 0.15 200)"];

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

// Hình vẽ nhỏ trong ghim (theo thiết kế): máy ảnh / tách cà phê / xe / ngôi sao.
const GLYPH: Record<BoardCat, string> = {
  cam: `<div style="position:relative;width:18px;height:13px;border-radius:3px;background:#fff"><div style="position:absolute;left:5px;top:3px;width:8px;height:8px;border-radius:50%;background:var(--c);border:1.5px solid #fff"></div><div style="position:absolute;left:4px;top:-3px;width:7px;height:3px;border-radius:1px 1px 0 0;background:#fff"></div></div>`,
  cafe: `<div style="position:relative;width:14px;height:12px;border-radius:0 0 5px 5px;background:#fff;margin-right:4px"><div style="position:absolute;right:-6px;top:2px;width:6px;height:6px;border-radius:50%;border:2px solid #fff"></div></div>`,
  start: `<div style="position:relative;width:19px;height:12px;border-radius:4px 4px 2px 2px;background:#fff"><div style="position:absolute;left:2px;bottom:-3px;width:5px;height:5px;border-radius:50%;background:#fff;border:1.5px solid var(--c)"></div><div style="position:absolute;right:2px;bottom:-3px;width:5px;height:5px;border-radius:50%;background:#fff;border:1.5px solid var(--c)"></div></div>`,
  center: `<div style="width:20px;height:9px;background:#fff;clip-path:polygon(50% 0,100% 100%,0 100%);margin-top:-8px"></div><div style="position:absolute;top:17px;width:14px;height:9px;background:#fff"></div>`,
};
const pinHtml = (s: BoardSpot, i: number) =>
  `<div class="sb-pin" data-id="${esc(s.id)}" style="--c:${CAT[s.cat][1]}"><div class="sb-ping"></div><div class="sb-ico" data-icon style="animation-duration:${(2.2 + (i % 5) * 0.25).toFixed(2)}s"><div class="sb-drop"></div><div class="sb-glyph">${GLYPH[s.cat]}</div></div><div class="sb-num"></div><div class="sb-lbl">${esc(s.name)}</div></div>`;
const bikeHtml = (c: string) =>
  `<div class="sb-bike" data-flip><i style="left:3px;bottom:18px;width:2px;height:36px;border-radius:1px;background:#fff;box-shadow:0 0 0 1px oklch(0.2 0.02 160 / .35)"></i><i class="sb-flag" style="right:42px;bottom:36px"><b data-unflip>Đi Tà Xùa thôi!</b></i><i style="left:1px;bottom:0;width:14px;height:14px;border-radius:50%;background:oklch(0.2 0.01 160);border:3px solid oklch(0.85 0.01 160)"></i><i style="left:31px;bottom:0;width:14px;height:14px;border-radius:50%;background:oklch(0.2 0.01 160);border:3px solid oklch(0.85 0.01 160)"></i><i style="left:7px;bottom:8px;width:30px;height:9px;border-radius:6px 10px 3px 3px;background:${c};box-shadow:0 0 0 2px #fff"></i><i style="left:38px;bottom:12px;width:5px;height:4px;border-radius:2px;background:oklch(0.97 0.1 95);box-shadow:0 0 10px 4px oklch(0.96 0.12 95 / .7)"></i><i style="left:6px;bottom:15px;width:10px;height:14px;border-radius:5px 5px 2px 2px;background:oklch(0.65 0.13 250);transform:rotate(-10deg)"></i><i style="left:5px;bottom:28px;width:11px;height:10px;border-radius:50%;background:oklch(0.78 0.13 350);border:2px solid #fff"></i><i style="left:17px;bottom:15px;width:11px;height:15px;border-radius:5px 5px 2px 2px;background:oklch(0.45 0.1 160);transform:rotate(-14deg)"></i><i style="left:19px;bottom:29px;width:12px;height:11px;border-radius:50%;background:oklch(0.7 0.18 45);border:2px solid #fff"></i></div>`;

const CSS = `
@keyframes sb-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
@keyframes sb-ping{0%{transform:translate(-50%,-50%) scale(.5);opacity:.9}100%{transform:translate(-50%,-50%) scale(2.6);opacity:0}}
@keyframes sb-rise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
.sb-rise{animation:sb-rise .3s ease both}
.sb-pin{position:absolute;left:0;top:0;width:0;height:0;font-family:inherit}
.sb-pin.sb-hide{display:none}
.sb-ico{position:absolute;left:-19px;top:-46px;width:38px;height:46px;cursor:pointer;animation:sb-bob 2.6s ease-in-out infinite;transform-origin:bottom center;transition:opacity .3s}
.sb-dim .sb-ico{opacity:.4}
.sb-drop{position:absolute;left:2px;top:0;width:34px;height:34px;border-radius:50% 50% 50% 4px;transform:rotate(-45deg);background:var(--c);border:3px solid #fff;box-shadow:0 6px 12px -4px oklch(0.1 0.02 160 / .6)}
.sb-glyph{position:absolute;left:0;top:0;width:38px;height:36px;display:flex;flex-direction:column;align-items:center;justify-content:center}
.sb-ping{display:none;position:absolute;left:0;top:0;width:44px;height:44px;border-radius:50%;border:3px solid var(--c);animation:sb-ping 1.4s ease-out infinite;pointer-events:none}
.sb-sel .sb-ping{display:block}
.sb-lbl{display:none;position:absolute;left:24px;top:-40px;white-space:nowrap;font:800 12px/1.2 'Be Vietnam Pro',system-ui,sans-serif;padding:4px 9px;border-radius:999px;background:oklch(1 0 0 / .94);color:oklch(0.22 0.03 160);box-shadow:0 4px 10px -4px oklch(0.1 0.02 160 / .5);cursor:pointer}
.sb-lbl-on .sb-lbl{display:block}
.sb-sel .sb-lbl{background:var(--c);color:#fff}
.sb-num{display:none;position:absolute;left:8px;top:-62px;min-width:22px;height:22px;padding:0 6px;border-radius:999px;background:var(--n,${G});color:#fff;font:800 12px/18px 'Be Vietnam Pro',system-ui,sans-serif;text-align:center;border:2px solid #fff;box-shadow:0 3px 8px -2px oklch(0.1 0.02 160 / .6);pointer-events:none}
.sb-num:not(:empty){display:block}
.sb-bike{position:absolute;left:-23px;top:-40px;width:46px;height:40px;pointer-events:none}
.sb-bike i{position:absolute;display:block}
@keyframes sb-wave{0%,100%{transform:skewY(-4deg) scaleX(1)}50%{transform:skewY(4deg) scaleX(.96)}}
.sb-flag{white-space:nowrap;padding:3px 7px 3px 8px;border-radius:3px 0 0 3px;background:oklch(0.58 0.22 27);color:oklch(0.93 0.16 95);font:800 11px/1.25 'Be Vietnam Pro',system-ui,sans-serif;box-shadow:0 3px 8px -2px oklch(0.1 0.02 160 / .6);clip-path:polygon(0 0,100% 0,100% 100%,0 100%,7px 50%);transform-origin:right center;animation:sb-wave 1.1s ease-in-out infinite}
.sb-flag b{display:block;font-weight:800}
.sb-map .leaflet-control-attribution{font-size:10px}
@media (prefers-reduced-motion:reduce){.sb-ico,.sb-ping,.sb-flag{animation:none}}
`;

interface Prepared { pts: Pt[]; seg: number[]; L: number }
/** Độ dài từng đoạn (mét, xấp xỉ) để xe chạy đều trên đường. */
function prep(pts: Pt[]): Prepared {
  const seg: number[] = [];
  let L = 0;
  for (let i = 1; i < pts.length; i++) {
    const dy = (pts[i][0] - pts[i - 1][0]) * 110570;
    const dx = (pts[i][1] - pts[i - 1][1]) * 111320 * Math.cos((pts[i][0] * Math.PI) / 180);
    const d = Math.hypot(dx, dy);
    seg.push(d);
    L += d;
  }
  return { pts, seg, L };
}

export function SatBoard({ spots, plans, freeRoads, initialPlan }: { spots: BoardSpot[]; plans: BoardPlan[]; freeRoads: Pt[][]; initialPlan?: string }) {
  const [planId, setPlanId] = useState(initialPlan && plans.some((p) => p.id === initialPlan) ? initialPlan : "free");
  const [day, setDay] = useState(0); // -1 = cả lịch trình
  const [cat, setCat] = useState<"all" | "cam" | "cafe">("all");
  const [sel, setSel] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const box = useRef<HTMLDivElement>(null);
  const ctx = useRef<{ L: typeof import("leaflet"); map: LMap; markers: Map<string, Marker>; routes: LayerGroup; bikes: Marker[] } | null>(null);
  const live = useRef<{ paths: Prepared[]; loop: boolean; onPick: (id: string) => void }>({ paths: [], loop: false, onPick: () => {} });

  const P = plans.find((p) => p.id === planId) ?? null;
  const byId = useMemo(() => new Map(spots.map((s) => [s.id, s])), [spots]);

  // Lịch trình đang xem ⇒ đường từng ngày, điểm nào thuộc ngày nào, số thứ tự ghé.
  const view = useMemo(() => {
    const inPlan = new Map<string, string>();
    const nums = new Map<string, string>();
    const lines: { pts: Pt[]; c: string; on: boolean }[] = [];
    let bike: Pt[] | null = null;
    if (P) {
      P.days.forEach((d, di) => {
        const on = day < 0 || day === di;
        const c = DAYC[di % DAYC.length];
        if (d.path.length > 1) lines.push({ pts: d.path, c, on });
        if (!on) return;
        if (!bike && d.path.length > 1) bike = d.path;
        d.stops.forEach((s, si) => {
          if (!inPlan.has(s.spotId)) inPlan.set(s.spotId, c);
          if (s.own && !nums.has(s.spotId)) nums.set(s.spotId, (day < 0 ? `${di + 1}.` : "") + (si + 1));
        });
      });
    } else {
      freeRoads.forEach((pts, i) => { if (pts.length > 1) lines.push({ pts, c: FREEC[i % FREEC.length], on: true }); });
    }
    return { inPlan, nums, lines, bike: bike as Pt[] | null };
  }, [P, day, freeRoads]);

  const visible = (s: BoardSpot) => !!P || cat === "all" || s.cat === cat || s.cat === "start" || s.cat === "center";

  // Xếp nhãn: nhãn nào đè lên nhãn/ghim khác thì ẩn bớt (ưu tiên điểm đang chọn, rồi điểm trong lịch trình).
  const declutter = () => {
    const root = box.current;
    if (!root) return;
    const ls = [...root.querySelectorAll<HTMLElement>(".sb-lbl-on .sb-lbl")];
    ls.forEach((l) => { l.style.visibility = "visible"; });
    const icons = [...root.querySelectorAll<HTMLElement>(".sb-pin:not(.sb-hide) [data-icon]")].map((n) => ({ k: n.parentElement?.dataset.id, r: n.getBoundingClientRect() }));
    const ov = (a: DOMRect, b: DOMRect, pad: number) => a.left < b.right + pad && a.right > b.left - pad && a.top < b.bottom + pad && a.bottom > b.top - pad;
    const items = ls
      .map((l) => { const pin = l.parentElement!; return { l, own: pin.dataset.id, p: pin.classList.contains("sb-sel") ? 3 : pin.dataset.prio === "2" ? 2 : 1, r: l.getBoundingClientRect() }; })
      .sort((a, b) => b.p - a.p);
    const kept: DOMRect[] = [];
    for (const it of items) {
      const hit = kept.some((k) => ov(it.r, k, 4)) || icons.some((ic) => ic.k !== it.own && ov(it.r, ic.r, 0));
      if (hit && it.p < 3) it.l.style.visibility = "hidden";
      else kept.push(it.r);
    }
  };

  // Dựng bản đồ một lần.
  useEffect(() => {
    let dead = false;
    let map: LMap | null = null;
    let raf = 0;
    (async () => {
      const L = (await import("leaflet")).default;
      if (dead || !box.current) return;
      map = L.map(box.current, { zoomControl: true, attributionControl: true, scrollWheelZoom: true, zoomSnap: 0.25 });
      L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { maxZoom: 19, attribution: "Ảnh vệ tinh © Esri, Maxar, Earthstar Geographics" }).addTo(map);
      L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}", { maxZoom: 19, opacity: 0.85 }).addTo(map);
      const routes = L.layerGroup().addTo(map);
      const markers = new Map<string, Marker>();
      spots.forEach((s, i) => {
        const m = L.marker([s.lat, s.lng], { icon: L.divIcon({ className: "", iconSize: [0, 0], html: pinHtml(s, i) }), title: s.name, keyboard: false }).addTo(map!);
        m.on("click", () => live.current.onPick(s.id));
        markers.set(s.id, m);
      });
      const bikes = [0, 1].map((k) => L.marker([spots[0]?.lat ?? 21.2754, spots[0]?.lng ?? 104.4343], { icon: L.divIcon({ className: "", iconSize: [0, 0], html: bikeHtml(k ? "oklch(0.6 0.15 220)" : "oklch(0.62 0.19 30)") }), interactive: false, keyboard: false, zIndexOffset: 500 }).addTo(map!));
      map.fitBounds(L.latLngBounds(spots.map((s) => [s.lat, s.lng] as Pt)).pad(0.12));
      map.on("moveend zoomend", declutter);
      ctx.current = { L, map, markers, routes, bikes };
      setReady(true);

      // Xe máy chạy theo cung đường (đổi vị trí qua Leaflet, không setState mỗi khung hình).
      const reduce = !!window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const t0 = performance.now();
      const loop = (now: number) => {
        const t = (now - t0) / 1000;
        bikes.forEach((b, k) => {
          const el = b.getElement();
          const r = live.current.paths[k];
          if (el) el.style.display = r && r.L > 0 ? "" : "none";
          if (!r || !r.L) return;
          const speed = Math.max(250, r.L / 40); // một lượt ~40 giây, đường ngắn thì chạy chậm lại
          const cyc = live.current.loop ? (t * speed) % r.L : (t * speed + k * r.L * 0.6) % (r.L * 2);
          const fwd = live.current.loop || cyc < r.L;
          let d = fwd ? cyc : r.L * 2 - cyc;
          let i = 0;
          while (i < r.seg.length - 1 && d > r.seg[i]) { d -= r.seg[i]; i++; }
          const A = r.pts[i], B = r.pts[i + 1], f = r.seg[i] ? d / r.seg[i] : 0;
          b.setLatLng([A[0] + (B[0] - A[0]) * f, A[1] + (B[1] - A[1]) * f]);
          const dir = (B[1] - A[1]) * (fwd ? 1 : -1);
          const fl = el?.querySelector<HTMLElement>("[data-flip]");
          if (fl) fl.style.transform = `translateY(${-Math.abs(Math.sin(t * 14 + k)) * 2}px) scaleX(${dir < 0 ? -1 : 1})`;
          // chữ trên cờ lật ngược lại để luôn đọc xuôi khi xe quay đầu
          const tx = el?.querySelector<HTMLElement>("[data-unflip]");
          if (tx) tx.style.transform = `scaleX(${dir < 0 ? -1 : 1})`;
        });
        if (!reduce) raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    })();
    return () => { dead = true; cancelAnimationFrame(raf); ctx.current = null; map?.remove(); };
  }, [spots]);

  useEffect(() => { live.current.onPick = (id) => setSel((cur) => (cur === id ? null : id)); }, []);

  // Trạng thái ⇒ ghim (ẩn/mờ/nhãn/số), đường, xe.
  useEffect(() => {
    const c = ctx.current;
    if (!ready || !c) return;
    spots.forEach((s) => {
      const el = c.markers.get(s.id)?.getElement()?.querySelector<HTMLElement>(".sb-pin");
      if (!el) return;
      const on = sel === s.id;
      const inP = view.inPlan.has(s.id);
      el.classList.toggle("sb-hide", !visible(s));
      el.classList.toggle("sb-dim", !!P && !inP && !on);
      el.classList.toggle("sb-sel", on);
      el.classList.toggle("sb-lbl-on", on || (P ? inP : true));
      el.dataset.prio = inP || s.cat === "center" || s.cat === "start" ? "2" : "1";
      const num = el.querySelector<HTMLElement>(".sb-num");
      if (num) { num.textContent = view.nums.get(s.id) ?? ""; num.style.setProperty("--n", view.inPlan.get(s.id) ?? G); }
      c.markers.get(s.id)?.setZIndexOffset(on ? 1000 : inP ? 200 : 0);
    });
    c.routes.clearLayers();
    for (const r of view.lines) {
      c.L.polyline(r.pts, { color: "#fff", weight: r.on ? 9 : 6, opacity: r.on ? 0.55 : 0.15, lineCap: "round", lineJoin: "round", interactive: false }).addTo(c.routes);
      c.L.polyline(r.pts, { color: r.c, weight: r.on ? 5 : 3.5, opacity: r.on ? 1 : 0.35, dashArray: r.on ? "12 9" : "5 9", lineCap: "round", lineJoin: "round", interactive: false }).addTo(c.routes);
    }
    live.current.paths = P ? (view.bike ? [prep(view.bike)] : []) : freeRoads.filter((p) => p.length > 1).map(prep);
    live.current.loop = !!P;
    const t = setTimeout(declutter, 80);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, spots, view, sel, cat, P, freeRoads]);

  // Đổi lịch trình / ngày / nhóm ⇒ đưa khung nhìn về vùng liên quan.
  useEffect(() => {
    const c = ctx.current;
    if (!ready || !c) return;
    const on = view.lines.filter((l) => l.on).flatMap((l) => l.pts);
    const pts: Pt[] = P && on.length > 1 ? on : spots.filter(visible).map((s) => [s.lat, s.lng]);
    if (pts.length > 1) c.map.flyToBounds(c.L.latLngBounds(pts).pad(0.12), { duration: 0.7 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, planId, day, cat]);

  // Chọn một điểm ⇒ đưa điểm đó vào giữa khung nhìn (phóng gần nếu đang xem quá xa).
  useEffect(() => {
    const c = ctx.current;
    const s = sel ? byId.get(sel) : null;
    if (!ready || !c || !s) return;
    c.map.flyTo([s.lat, s.lng], Math.max(c.map.getZoom(), 14.5), { duration: 0.6 });
  }, [ready, sel, byId]);

  const spot = sel ? byId.get(sel) ?? null : null;
  const count = (k: "all" | "cam" | "cafe") => spots.filter((s) => (k === "all" ? s.cat === "cam" || s.cat === "cafe" : s.cat === k)).length;
  const chips = ([["all", "Tất cả", G], ["cam", "Check-in & săn mây", CAT.cam[1]], ["cafe", "Cafe & ăn", CAT.cafe[1]]] as const).filter(([k]) => k === "all" || count(k) > 0);
  const list = spots.filter(visible);

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-3.5 px-3 pb-12 pt-5 sm:px-8">
      <style>{CSS}</style>
      <div className="flex flex-wrap items-end justify-between gap-3.5">
        <div>
          <h1 className="text-[clamp(24px,3.4vw,36px)] font-extrabold tracking-[-.03em]">Bản đồ vệ tinh Tà Xùa</h1>
          <p className="mt-1 text-sm text-[oklch(0.45_0.02_160)]">Ảnh vệ tinh thật, đánh dấu các điểm check-in quanh Tà Xùa. Chọn lịch trình để xem đường đi từng ngày.</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {!P && chips.length > 2 && chips.map(([k, name, dot]) => (
            <button key={k} type="button" onClick={() => { setCat(k); setSel(null); }} className="flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-full border-[1.5px] px-3.5 py-2 text-[13px] font-extrabold" style={{ background: cat === k ? G : "white", color: cat === k ? "white" : "oklch(0.3 0.03 160)", borderColor: cat === k ? G : "oklch(0.88 0.015 160)" }}>
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: dot }} />
              {name} <span className="opacity-70">{count(k)}</span>
            </button>
          ))}
          <Link href="/ban-do?view=3d" className="whitespace-nowrap rounded-full border-[1.5px] border-[oklch(0.88_0.015_160)] bg-white px-3.5 py-2 text-[13px] font-bold text-[oklch(0.4_0.08_160)] hover:text-[oklch(0.66_0.18_45)]">Xem bản đồ 3D</Link>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[oklch(0.92_0.01_160)] bg-white p-2">
        <span className="px-1.5 text-[13px] font-extrabold text-[oklch(0.45_0.02_160)]">Lịch trình</span>
        {[{ id: "free", name: "Khám phá tự do" }, ...plans].map((t) => (
          <button key={t.id} type="button" onClick={() => { setPlanId(t.id); setDay(0); setSel(null); }} className="cursor-pointer whitespace-nowrap rounded-xl px-4 py-2 text-sm font-extrabold transition-colors" style={{ background: planId === t.id ? G : "oklch(0.96 0.005 160)", color: planId === t.id ? "white" : "oklch(0.3 0.03 160)" }}>{t.name}</button>
        ))}
        {P && (
          <>
            <span className="mx-1 h-6 w-px bg-[oklch(0.9_0.01_160)]" />
            {[{ k: -1, name: "Cả lịch trình", c: G }, ...P.days.map((_, i) => ({ k: i, name: `Ngày ${i + 1}`, c: DAYC[i % DAYC.length] }))].map((d) => (
              <button key={d.k} type="button" onClick={() => setDay(d.k)} className="flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full border-[1.5px] px-3 py-[7px] text-[13px] font-bold" style={{ borderColor: day === d.k ? d.c : "oklch(0.9 0.01 160)", background: day === d.k ? "oklch(0.97 0.02 155)" : "white" }}>
                <span className="h-[9px] w-[9px] rounded-full" style={{ background: d.c }} />
                {d.name}
              </button>
            ))}
          </>
        )}
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="overflow-hidden rounded-[22px] border border-[oklch(0.88_0.02_160)] bg-[oklch(0.3_0.04_150)]">
          <div ref={box} className="sb-map relative z-0 isolate h-[70vh] min-h-[420px] w-full lg:h-[78vh]" />
          <div className="flex flex-wrap justify-between gap-2 bg-white px-3.5 py-2 text-xs text-[oklch(0.45_0.02_160)]">
            <span>Kéo để di chuyển, chụm hai ngón hoặc bấm + − để phóng to. Bấm vào ghim để xem chi tiết.</span>
            <span>Đường xe vẽ theo dữ liệu OpenStreetMap</span>
          </div>
        </div>

        <aside className="flex flex-col gap-3">
          {spot && (
            <div className="sb-rise flex flex-col gap-2 rounded-[20px] border-2 bg-white px-[18px] py-4" style={{ borderColor: CAT[spot.cat][1] }}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-[11px] font-extrabold uppercase tracking-[.06em]" style={{ color: CAT[spot.cat][1] }}>{CAT[spot.cat][0]}{spot.sub ? ` · ${spot.sub}` : ""}</div>
                  <div className="text-lg font-extrabold leading-[1.3]">{spot.name}</div>
                </div>
                <button type="button" aria-label="Đóng" onClick={() => setSel(null)} className="flex h-[30px] w-[30px] flex-none cursor-pointer items-center justify-center rounded-full bg-[oklch(0.95_0.005_160)] font-extrabold">×</button>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {spot.image && <img src={spot.image} alt={spot.name} loading="lazy" className="h-36 w-full rounded-xl object-cover" />}
              {spot.desc && <p className="text-sm leading-[1.55] text-[oklch(0.38_0.02_160)]">{spot.desc}</p>}
              {spot.best && <p className="text-[13px] font-bold text-[oklch(0.4_0.08_160)]">Đẹp nhất: {spot.best}</p>}
              {spot.tip && <p className="rounded-xl bg-[oklch(0.97_0.03_85)] px-3 py-2 text-[13px] leading-[1.5] text-[oklch(0.4_0.06_70)]">Mẹo: {spot.tip}</p>}
              <div className="flex flex-wrap gap-2">
                <a href={spot.mapUrl} target="_blank" rel="noopener noreferrer" className="rounded-full px-3.5 py-[9px] text-[13px] font-extrabold text-white" style={{ background: G }}>Chỉ đường ↗</a>
                {spot.href && <Link href={spot.href} className="rounded-full bg-[oklch(0.68_0.18_45)] px-3.5 py-[9px] text-[13px] font-extrabold text-white">Xem chi tiết</Link>}
              </div>
            </div>
          )}

          {P ? (
            <div className="flex max-h-[360px] flex-col gap-3 overflow-y-auto rounded-[20px] border border-[oklch(0.92_0.01_160)] bg-white px-[18px] py-4 lg:max-h-[60vh]">
              <div>
                <div className="text-lg font-extrabold">Lịch trình {P.name}</div>
                {P.sub && <div className="mt-0.5 text-[13px] leading-[1.5] text-[oklch(0.45_0.02_160)]">{P.sub}</div>}
              </div>
              {P.days.map((d, di) => (
                <div key={di} className="flex flex-col gap-0.5" style={{ opacity: day < 0 || day === di ? 1 : 0.45 }}>
                  <button type="button" onClick={() => setDay(di)} className="mb-1 flex cursor-pointer items-center gap-2 text-left">
                    <span className="rounded-full px-[9px] py-[3px] text-[11px] font-extrabold text-white" style={{ background: DAYC[di % DAYC.length] }}>Ngày {di + 1}</span>
                    <span className="text-sm font-extrabold">{d.title}</span>
                  </button>
                  {d.stops.map((s, si) => (
                    <button key={si} type="button" onClick={() => { setDay((cur) => (cur < 0 ? cur : di)); setSel(s.spotId); }} className="grid cursor-pointer grid-cols-[44px_22px_minmax(0,1fr)] items-start gap-1.5 rounded-[10px] px-1 py-[5px] text-left hover:bg-[oklch(0.97_0.01_155)]" style={{ background: sel === s.spotId && s.own ? "oklch(0.96 0.025 155)" : undefined }}>
                      <span className="text-xs font-extrabold text-[oklch(0.45_0.02_160)]">{s.time}</span>
                      <span className="flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-extrabold text-white" style={{ background: DAYC[di % DAYC.length] }}>{si + 1}</span>
                      <span className="min-w-0">
                        <span className="block text-[13px] font-bold leading-[1.35]">{s.name}</span>
                        {s.note && <span className="block text-xs text-[oklch(0.5_0.02_160)]">{s.note}</span>}
                      </span>
                    </button>
                  ))}
                </div>
              ))}
              <Link href="/combo" className="rounded-full bg-[oklch(0.68_0.18_45)] p-3 text-center text-sm font-extrabold text-white">Đặt combo {P.name} →</Link>
            </div>
          ) : (
            <div className="flex max-h-[360px] flex-col gap-1 overflow-y-auto rounded-[20px] border border-[oklch(0.92_0.01_160)] bg-white p-3 lg:max-h-[60vh]">
              {list.map((s) => (
                <button key={s.id} type="button" onClick={() => setSel(sel === s.id ? null : s.id)} className="flex cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2 text-left hover:bg-[oklch(0.97_0.01_155)]" style={{ background: sel === s.id ? "oklch(0.96 0.025 155)" : undefined }}>
                  <span className="h-[26px] w-[26px] flex-none -rotate-45 rounded-[50%_50%_50%_3px] border-2 border-white shadow-[0_2px_6px_-2px_oklch(0.1_0.02_160/.5)]" style={{ background: CAT[s.cat][1] }} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold">{s.name}</span>
                    <span className="block text-xs text-[oklch(0.5_0.02_160)]">{CAT[s.cat][0]}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
