"use client";

/**
 * Bản đồ vệ tinh /ban-do — theo claude.ai/design `Ban do Ve tinh v2.dc.html`:
 * bản đồ tràn khung, bảng nổi bên trái (chế độ Khám phá / lịch trình, tìm kiếm, nhóm, danh sách),
 * thẻ điểm bên phải, điện thoại = hàng chip phía trên + bottom sheet 3 nấc; ghim gần nhau gom thành cụm.
 * Khác bản thiết kế (ảnh tĩnh): nền là ảnh vệ tinh thật (Leaflet + Esri), ghim theo toạ độ thật, đường theo đường xe thật.
 */
import Link from "@/components/Link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import type { Map as LMap, Marker, LayerGroup } from "leaflet";
import { useT } from "@/components/i18n/I18nProvider";

type Pt = [number, number]; // [vĩ độ, kinh độ]
export type BoardCat = "cam" | "home" | "cafe" | "start" | "center";
type CatFilter = "all" | "cam" | "home" | "cafe";
type Sheet = "peek" | "half" | "full";

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
  href: string | null; // trang chi tiết (quán cafe / nhà hàng / homestay)
}

export interface BoardPlan {
  id: string;
  name: string;
  sub: string;
  days: { title: string; path: Pt[]; stops: { time: string; name: string; note: string; spotId: string; own: boolean }[] }[];
}

const G = "oklch(0.29 0.055 160)";
const O = "oklch(0.68 0.18 45)";
const CAT: Record<BoardCat, [string, string]> = {
  cam: ["Điểm check-in", "oklch(0.58 0.2 300)"],
  home: ["Homestay", "oklch(0.6 0.2 350)"],
  cafe: ["Cafe & ăn", "oklch(0.68 0.18 50)"],
  start: ["Bến xe cabin", "oklch(0.35 0.08 160)"],
  center: ["Trung tâm", "oklch(0.55 0.16 250)"],
};
const PRIO: Record<BoardCat, number> = { start: 5, center: 4, cam: 3, home: 2, cafe: 1 };
const DAYC = ["oklch(0.7 0.18 50)", "oklch(0.65 0.16 155)", "oklch(0.62 0.16 250)", "oklch(0.62 0.17 330)", "oklch(0.68 0.15 90)"];
const FREE_ROAD = "oklch(0.85 0.14 75)";
const SHEET_FRAC: Record<Sheet, number> = { peek: 0, half: 0.5, full: 0.88 };
const PEEK = 132;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").toLowerCase();

// Hình vẽ nhỏ trong ghim (theo thiết kế): máy ảnh / nhà / tách cà phê / xe / núi.
const GLYPH: Record<BoardCat, string> = {
  cam: `<div style="position:relative;width:17px;height:12px;border-radius:3px;background:#fff"><div style="position:absolute;left:5px;top:3px;width:7px;height:7px;border-radius:50%;background:var(--c)"></div><div style="position:absolute;left:4px;top:-3px;width:6px;height:3px;border-radius:1px 1px 0 0;background:#fff"></div></div>`,
  home: `<div style="display:flex;flex-direction:column;align-items:center"><div style="width:18px;height:8px;background:#fff;clip-path:polygon(50% 0,100% 100%,0 100%)"></div><div style="width:12px;height:8px;background:#fff"></div></div>`,
  cafe: `<div style="position:relative;width:13px;height:11px;border-radius:0 0 5px 5px;background:#fff;margin-right:4px"><div style="position:absolute;right:-6px;top:2px;width:6px;height:6px;border-radius:50%;border:2px solid #fff"></div></div>`,
  start: `<div style="width:18px;height:12px;border-radius:3px;background:#fff;display:flex;gap:2px;padding:2px"><span style="flex:1;background:var(--c);border-radius:1px"></span><span style="flex:1;background:var(--c);border-radius:1px"></span></div>`,
  center: `<div style="width:20px;height:13px;background:#fff;clip-path:polygon(0 100%,35% 30%,50% 50%,70% 0,100% 100%)"></div>`,
};
const pinHtml = (o: { c: string; cat: BoardCat; num: string; sel: boolean; label: string; pop: boolean; delay: number }) =>
  `<div class="sb-pin${o.sel ? " sb-sel" : ""}" style="--c:${o.c}">${o.sel ? `<div class="sb-ping"></div>` : ""}<div class="sb-ico${o.pop ? " sb-pop" : ""}" style="animation-delay:${o.delay.toFixed(2)}s"><div class="sb-drop"></div><div class="sb-glyph">${o.num ? `<span>${esc(o.num)}</span>` : GLYPH[o.cat]}</div></div>${o.label ? `<div class="sb-lbl">${esc(o.label)}</div>` : ""}</div>`;
const clusterHtml = (n: number, dots: string[], pop: boolean) =>
  `<div class="sb-cl${pop ? " sb-pop" : ""}"><b>${n}</b><span>${dots.map((d) => `<i style="background:${d}"></i>`).join("")}</span></div>`;
const bikeHtml = (c: string) =>
  `<div class="sb-bike" data-flip><i style="left:3px;bottom:18px;width:2px;height:36px;border-radius:1px;background:#fff;box-shadow:0 0 0 1px oklch(0.2 0.02 160 / .35)"></i><i class="sb-flag" style="right:42px;bottom:36px"><b data-unflip>Đi Tà Xùa thôi!</b></i><i style="left:1px;bottom:0;width:14px;height:14px;border-radius:50%;background:oklch(0.2 0.01 160);border:3px solid oklch(0.85 0.01 160)"></i><i style="left:31px;bottom:0;width:14px;height:14px;border-radius:50%;background:oklch(0.2 0.01 160);border:3px solid oklch(0.85 0.01 160)"></i><i style="left:7px;bottom:8px;width:30px;height:9px;border-radius:6px 10px 3px 3px;background:${c};box-shadow:0 0 0 2px #fff"></i><i style="left:38px;bottom:12px;width:5px;height:4px;border-radius:2px;background:oklch(0.97 0.1 95);box-shadow:0 0 10px 4px oklch(0.96 0.12 95 / .7)"></i><i style="left:6px;bottom:15px;width:10px;height:14px;border-radius:5px 5px 2px 2px;background:oklch(0.65 0.13 250);transform:rotate(-10deg)"></i><i style="left:5px;bottom:28px;width:11px;height:10px;border-radius:50%;background:oklch(0.78 0.13 350);border:2px solid #fff"></i><i style="left:17px;bottom:15px;width:11px;height:15px;border-radius:5px 5px 2px 2px;background:oklch(0.45 0.1 160);transform:rotate(-14deg)"></i><i style="left:19px;bottom:29px;width:12px;height:11px;border-radius:50%;background:oklch(0.7 0.18 45);border:2px solid #fff"></i></div>`;

const CSS = `
@keyframes sb-pop{0%{transform:scale(.3);opacity:0}70%{transform:scale(1.08);opacity:1}100%{transform:scale(1)}}
@keyframes sb-ping{0%{transform:translate(-50%,-50%) scale(.6);opacity:.9}100%{transform:translate(-50%,-50%) scale(2.4);opacity:0}}
@keyframes sb-rise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@keyframes sb-wave{0%,100%{transform:skewY(-4deg) scaleX(1)}50%{transform:skewY(4deg) scaleX(.96)}}
.sb-rise{animation:sb-rise .3s ease both}
.sb-noscroll{scrollbar-width:none}.sb-noscroll::-webkit-scrollbar{display:none}
.sb-pin{position:absolute;left:0;top:0;width:0;height:0;font-family:'Be Vietnam Pro',system-ui,sans-serif}
.sb-ico{position:absolute;left:-18px;top:-42px;width:36px;height:42px;cursor:pointer;transform-origin:bottom center;transition:transform .15s}
.sb-ico:hover{transform:scale(1.14)}
.sb-pop{animation:sb-pop .4s ease both}
.sb-drop{position:absolute;left:2px;top:0;width:32px;height:32px;border-radius:50% 50% 50% 4px;transform:rotate(-45deg);background:var(--c);border:2.5px solid #fff;box-shadow:0 6px 12px -4px oklch(0.1 0.02 160 / .65)}
.sb-glyph{position:absolute;left:0;top:0;width:36px;height:34px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:13px;font-weight:800;line-height:1}
.sb-ping{position:absolute;left:0;top:0;width:46px;height:46px;border-radius:50%;border:3px solid var(--c);animation:sb-ping 1.5s ease-out infinite;pointer-events:none}
.sb-lbl{position:absolute;left:22px;top:-36px;white-space:nowrap;font-size:12px;font-weight:800;line-height:1.3;padding:4px 10px;border-radius:999px;background:oklch(1 0 0 / .95);color:oklch(0.22 0.03 160);box-shadow:0 4px 12px -4px oklch(0.1 0.02 160 / .55);cursor:pointer;animation:sb-rise .3s ease both}
.sb-sel .sb-lbl{background:var(--c);color:#fff}
.sb-cl{position:absolute;left:-23px;top:-23px;width:46px;height:46px;border-radius:50%;background:oklch(0.25 0.05 160 / .92);border:3px solid #fff;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 8px 18px -6px oklch(0.1 0.02 160 / .7);font-family:'Be Vietnam Pro',system-ui,sans-serif;transition:transform .15s}
.sb-cl:hover{transform:scale(1.1)}
.sb-cl b{font-size:15px;font-weight:800;line-height:1}
.sb-cl span{display:flex;gap:2px;margin-top:3px}
.sb-cl i{width:5px;height:5px;border-radius:50%}
.sb-bike{position:absolute;left:-23px;top:-40px;width:46px;height:40px;pointer-events:none}
.sb-bike i{position:absolute;display:block}
.sb-flag{white-space:nowrap;padding:3px 7px 3px 8px;border-radius:3px 0 0 3px;background:oklch(0.58 0.22 27);color:oklch(0.93 0.16 95);font:800 11px/1.25 'Be Vietnam Pro',system-ui,sans-serif;box-shadow:0 3px 8px -2px oklch(0.1 0.02 160 / .6);clip-path:polygon(0 0,100% 0,100% 100%,0 100%,7px 50%);transform-origin:right center;animation:sb-wave 1.1s ease-in-out infinite}
.sb-flag b{display:block;font-weight:800}
.sb-map{background:oklch(0.32 0.04 150)}
.sb-map .leaflet-tile-pane{filter:saturate(1.1) contrast(1.03);transition:filter .4s}
.sb-map.sb-shade .leaflet-tile-pane{filter:saturate(1.05) brightness(.8)}
.sb-map .leaflet-control-attribution{font-size:10px}
.sb-map .leaflet-bottom{bottom:var(--sb-b,0px);transition:bottom .35s cubic-bezier(.2,.8,.2,1)}
@media (prefers-reduced-motion:reduce){.sb-ping,.sb-flag,.sb-pop,.sb-lbl{animation:none}}
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
  const tr = useT();
  const [planId, setPlanId] = useState(initialPlan && plans.some((p) => p.id === initialPlan) ? initialPlan : "free");
  const [day, setDay] = useState(-1); // -1 = cả lịch trình
  const [cat, setCat] = useState<CatFilter>("all");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<string | null>(null);
  const [sheet, setSheet] = useState<Sheet>(planId === "free" ? "peek" : "half");
  const [mob, setMob] = useState(false);
  const [ready, setReady] = useState(false);
  const [zoom, setZoom] = useState(0);

  const box = useRef<HTMLDivElement>(null);
  const ctx = useRef<{ L: typeof import("leaflet"); map: LMap; pins: LayerGroup; routes: LayerGroup; bikes: Marker[]; z0: number } | null>(null);
  const live = useRef<{ paths: Prepared[]; loop: boolean; mob: boolean; card: boolean; sheet: Sheet }>({ paths: [], loop: false, mob: false, card: false, sheet: "peek" });
  const popNext = useRef(true); // lần dựng ghim kế tiếp có hiệu ứng "bật lên" (đổi nhóm / lịch trình / mức phóng)

  const P = plans.find((p) => p.id === planId) ?? null;
  const byId = useMemo(() => new Map(spots.map((s) => [s.id, s])), [spots]);

  useEffect(() => {
    const m = window.matchMedia("(max-width: 759px)");
    const on = () => setMob(m.matches);
    on();
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  useEffect(() => {
    live.current.mob = mob;
    live.current.card = sel != null;
    live.current.sheet = sheet;
  }, [mob, sel, sheet]);

  // Lịch trình đang xem ⇒ đường từng ngày, điểm nào thuộc ngày nào, số thứ tự ghé.
  const view = useMemo(() => {
    const stop = new Map<string, { c: string; n: string; time: string; day: number }>();
    const lines: { pts: Pt[]; c: string; on: boolean }[] = [];
    let bike: Pt[] | null = null;
    let nStops = 0;
    if (P) {
      P.days.forEach((d, di) => {
        const on = day < 0 || day === di;
        const c = DAYC[di % DAYC.length];
        if (d.path.length > 1) lines.push({ pts: d.path, c, on });
        if (!on) return;
        if (!bike && d.path.length > 1) bike = d.path;
        d.stops.forEach((s, si) => {
          nStops++;
          const cur = stop.get(s.spotId);
          // điểm tự nhập (về trung tâm / Bắc Yên) chỉ tô màu ngày, không đánh số; địa điểm thật lấy lần ghé đầu tiên
          if (!cur || (!cur.n && s.own)) stop.set(s.spotId, { c: cur?.c ?? c, n: s.own ? (day < 0 && P.days.length > 1 ? `${di + 1}.` : "") + (si + 1) : "", time: s.own ? s.time : "", day: di + 1 });
        });
      });
    }
    return { stop, lines, bike: bike as Pt[] | null, nStops };
  }, [P, day]);

  const fq = fold(q.trim());
  const visible = useMemo(() => {
    if (P) return spots.filter((s) => view.stop.has(s.id) || s.id === sel);
    return spots.filter((s) => (fq ? fold(s.name).includes(fq) : true) && (cat === "all" || s.cat === cat || (!fq && (s.cat === "start" || s.cat === "center"))));
  }, [spots, P, view, sel, fq, cat]);

  /** Lề che bởi bảng nổi / thẻ điểm / bottom sheet — để đưa điểm vào giữa phần bản đồ còn trống. */
  const pad = useCallback((card: boolean, sh: Sheet) => {
    const h = box.current?.clientHeight ?? 700;
    if (live.current.mob) return { l: 16, r: 16, t: 104, b: Math.max(PEEK, Math.round(h * SHEET_FRAC[sh === "full" ? "half" : sh])) + 16 };
    return { l: 412, r: card ? 450 : 110, t: 30, b: 30 };
  }, []);

  /** Đưa khung nhìn tới các điểm (tính cả lề bị che). `minZoom` = phóng gần ít nhất chừng đó. */
  const fit = useCallback((pts: Pt[], o: { minZoom?: number; maxZoom?: number; anim?: boolean; card?: boolean; sheet?: Sheet } = {}) => {
    const c = ctx.current;
    if (!c || !pts.length) return;
    const p = pad(o.card ?? live.current.card, o.sheet ?? live.current.sheet);
    const b = c.L.latLngBounds(pts);
    let z = pts.length > 1 ? c.map.getBoundsZoom(b, false, c.L.point(p.l + p.r + 60, p.t + p.b + 80)) : 18;
    z = Math.min(z, o.maxZoom ?? 17);
    if (o.minZoom != null) z = Math.max(z, Math.min(o.minZoom, 18));
    const center = c.map.unproject(c.map.project(b.getCenter(), z).subtract([(p.l - p.r) / 2, (p.t - p.b) / 2]), z);
    if (o.anim === false) c.map.setView(center, z, { animate: false });
    else c.map.flyTo(center, z, { duration: 0.6 });
  }, [pad]);

  const focus = useCallback((id: string) => {
    const s = byId.get(id);
    const c = ctx.current;
    if (!s) return;
    setSel(id);
    setSheet("half");
    if (c) fit([[s.lat, s.lng]], { minZoom: Math.max(c.map.getZoom(), c.z0 + 1), maxZoom: 18, card: true, sheet: "half" });
  }, [byId, fit]);
  const focusRef = useRef(focus);
  useEffect(() => { focusRef.current = focus; }, [focus]);

  /** Khung nhìn "toàn cảnh": chỉ lấy các điểm quanh trung tâm (≤ 9 km) — vài điểm ở rất xa làm bản đồ thu nhỏ tới mức mọi ghim dồn thành một cụm. */
  const nearCore = useCallback((list: BoardSpot[]) => {
    const c = byId.get("tt");
    if (!c) return list;
    const near = list.filter((s) => Math.hypot((s.lat - c.lat) * 110.57, (s.lng - c.lng) * 111.32 * Math.cos((c.lat * Math.PI) / 180)) <= 9);
    return near.length >= 5 ? near : list;
  }, [byId]);

  const fitCurrent = useCallback((anim = true, o: { card?: boolean; sheet?: Sheet } = {}) => {
    const on = view.lines.filter((l) => l.on).flatMap((l) => l.pts);
    const pts: Pt[] = P && on.length > 1 ? on : (P ? spots.filter((s) => view.stop.has(s.id)) : nearCore(spots.filter((s) => cat === "all" || s.cat === cat || s.cat === "center"))).map((s) => [s.lat, s.lng]);
    fit(pts, { anim, ...o });
  }, [P, view, spots, cat, fit, nearCore]);

  // Dựng bản đồ một lần.
  useEffect(() => {
    let dead = false;
    let map: LMap | null = null;
    let raf = 0;
    (async () => {
      const L = (await import("leaflet")).default;
      if (dead || !box.current) return;
      map = L.map(box.current, { zoomControl: false, attributionControl: true, scrollWheelZoom: true, zoomSnap: 0.25, maxZoom: 18, minZoom: 10 });
      L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { maxZoom: 19, attribution: tr("Ảnh vệ tinh © Esri, Maxar, Earthstar Geographics") }).addTo(map);
      L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}", { maxZoom: 19, opacity: 0.85 }).addTo(map);
      const routes = L.layerGroup().addTo(map);
      const pins = L.layerGroup().addTo(map);
      const c0 = spots[0] ?? { lat: 21.2754, lng: 104.4343 };
      const bikes = [0, 1].map((k) => L.marker([c0.lat, c0.lng], { icon: L.divIcon({ className: "", iconSize: [0, 0], html: bikeHtml(k ? "oklch(0.6 0.15 220)" : "oklch(0.62 0.19 30)") }), interactive: false, keyboard: false, zIndexOffset: 500 }).addTo(map!));
      map.setView([c0.lat, c0.lng], 13, { animate: false });
      ctx.current = { L, map, pins, routes, bikes, z0: 13 };
      map.on("zoomend", () => { popNext.current = true; setZoom(map!.getZoom()); });
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
    return () => { dead = true; cancelAnimationFrame(raf); ctx.current = null; map?.remove(); setReady(false); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spots]);

  // Khung nhìn đầu tiên: vừa mọi điểm (hoặc lịch trình mở sẵn); mức phóng này là mốc để bật nhãn.
  useEffect(() => {
    const c = ctx.current;
    if (!ready || !c) return;
    c.map.invalidateSize();
    fit(nearCore(spots.filter((s) => s.cat !== "start")).map((s) => [s.lat, s.lng]), { anim: false });
    c.z0 = c.map.getZoom();
    if (P) fitCurrent(false);
    setZoom(c.map.getZoom());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, mob]);

  // Đổi lịch trình / ngày / nhóm ⇒ đưa khung nhìn về vùng liên quan.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (!ready) return;
    popNext.current = true;
    fitCurrent(true, { card: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId, day, cat]);

  // Trạng thái ⇒ đường + xe.
  useEffect(() => {
    const c = ctx.current;
    if (!ready || !c) return;
    box.current?.classList.toggle("sb-shade", !!P);
    c.routes.clearLayers();
    const add = (pts: Pt[], o: { c: string; w: number; wo: number; op: number; dash?: string }) => {
      if (o.wo) c.L.polyline(pts, { color: "rgb(14,24,20)", weight: o.wo, opacity: 0.45, lineCap: "round", lineJoin: "round", interactive: false }).addTo(c.routes);
      c.L.polyline(pts, { color: o.c, weight: o.w, opacity: o.op, dashArray: o.dash, lineCap: "round", lineJoin: "round", interactive: false }).addTo(c.routes);
    };
    if (P) for (const r of view.lines) add(r.pts, r.on ? { c: r.c, w: 6, wo: 10, op: 1 } : { c: r.c, w: 3, wo: 0, op: 0.3, dash: "6 8" });
    else for (const pts of freeRoads) if (pts.length > 1) add(pts, { c: FREE_ROAD, w: 4, wo: 7, op: 0.95, dash: "10 8" });
    live.current.paths = P ? (view.bike ? [prep(view.bike)] : []) : freeRoads.filter((p) => p.length > 1).map(prep);
    live.current.loop = !!P;
  }, [ready, view, P, freeRoads]);

  // Trạng thái ⇒ ghim: gom các ghim gần nhau (≤50px) thành cụm; điểm đang chọn / điểm trong lịch trình luôn đứng riêng.
  useEffect(() => {
    const c = ctx.current;
    if (!ready || !c || !zoom) return;
    const z = c.map.getZoom();
    const pop = popNext.current;
    popNext.current = false;
    const items = visible
      .map((s) => ({ s, p: c.map.project([s.lat, s.lng], z), st: view.stop.get(s.id) }))
      .sort((a, b) => Number(b.s.id === sel) - Number(a.s.id === sel) || Number(!!b.st) - Number(!!a.st) || PRIO[b.s.cat] - PRIO[a.s.cat]);
    const groups: { x: number; y: number; m: typeof items; solo: boolean }[] = [];
    for (const it of items) {
      const solo = it.s.id === sel || !!it.st || it.s.cat === "start" || it.s.cat === "center"; // mốc trung tâm / bến xe luôn đứng riêng
      const g = solo ? undefined : groups.find((g) => !g.solo && Math.hypot(g.x - it.p.x, g.y - it.p.y) < 50);
      if (g) g.m.push(it);
      else groups.push({ x: it.p.x, y: it.p.y, m: [it], solo });
    }
    c.pins.clearLayers();
    const placed: [number, number, number, number][] = []; // nhãn đã đặt (x0, y0, x1, y1) — nhãn sau đè lên thì ẩn
    groups.forEach((g, gi) => {
      if (g.m.length > 1) {
        const pts = g.m.map((it) => [it.s.lat, it.s.lng] as Pt);
        const lat = pts.reduce((a, p) => a + p[0], 0) / pts.length, lng = pts.reduce((a, p) => a + p[1], 0) / pts.length;
        const dots = [...new Set(g.m.map((it) => CAT[it.s.cat][1]))].slice(0, 4);
        c.L.marker([lat, lng], { icon: c.L.divIcon({ className: "", iconSize: [0, 0], html: clusterHtml(g.m.length, dots, pop) }), keyboard: false, zIndexOffset: 40 })
          .on("click", () => fit(pts, { minZoom: z + 0.95, maxZoom: 18 }))
          .addTo(c.pins);
        return;
      }
      const { s, st } = g.m[0];
      const on = s.id === sel;
      const fixed = s.cat === "start" || s.cat === "center";
      const name = tr(s.name);
      let label = on || !!st || fixed || (z >= c.z0 + 1 && s.cat !== "cafe") || z >= c.z0 + 1.75;
      if (label) {
        const x0 = g.x + 20, y0 = g.y - 38, box: [number, number, number, number] = [x0, y0, x0 + name.length * 7.4 + 22, y0 + 28];
        if (!on && placed.some((b) => box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1])) label = false;
        else placed.push(box);
      }
      c.L.marker([s.lat, s.lng], {
        icon: c.L.divIcon({ className: "", iconSize: [0, 0], html: pinHtml({ c: st ? st.c : CAT[s.cat][1], cat: s.cat, num: st?.n ?? "", sel: on, label: label ? name : "", pop, delay: Math.min(gi * 0.02, 0.4) }) }),
        title: name,
        keyboard: false,
        zIndexOffset: on ? 1000 : st ? 300 : fixed ? 200 : 100,
      })
        .on("click", () => (on ? setSel(null) : focusRef.current(s.id)))
        .addTo(c.pins);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, zoom, visible, sel, view]);

  const pickMode = (id: string) => {
    setPlanId(id);
    setDay(-1);
    setSel(null);
    setSheet(id === "free" ? "peek" : "half");
  };
  const pickDay = (k: number) => { setDay(k); setSel(null); };
  const closeSpot = () => { setSel(null); setSheet(P ? "half" : "peek"); };
  const zoomBy = (d: number) => {
    const c = ctx.current;
    if (!c) return;
    const p = pad(sel != null, sheet);
    const sz = c.map.getSize();
    c.map.setZoomAround(c.L.point(p.l + (sz.x - p.l - p.r) / 2, p.t + (sz.y - p.t - p.b) / 2), c.map.getZoom() + d);
  };

  const spot = sel ? byId.get(sel) ?? null : null;
  const st = spot ? view.stop.get(spot.id) : undefined;
  const spotC = spot ? (st ? st.c : CAT[spot.cat][1]) : G;
  const dist = (s: BoardSpot) => (spot ? Math.hypot((s.lat - spot.lat) * 110.57, (s.lng - spot.lng) * 111.32 * Math.cos((spot.lat * Math.PI) / 180)) : 0);
  const near = spot ? spots.filter((s) => s.id !== spot.id).sort((a, b) => dist(a) - dist(b)).slice(0, 3) : [];
  const count = (k: CatFilter) => spots.filter((s) => (k === "all" ? s.cat === "cam" || s.cat === "home" || s.cat === "cafe" : s.cat === k)).length;
  const cats = ([["all", "Tất cả", G], ["cam", "Check-in & săn mây", CAT.cam[1]], ["home", "Homestay", CAT.home[1]], ["cafe", "Cafe & ăn", CAT.cafe[1]]] as const).filter(([k]) => k === "all" || count(k) > 0);
  const modes = [{ id: "free", name: tr("Khám phá") }, ...plans.map((p) => ({ id: p.id, name: tr(p.name) }))];
  const dayTabs = P ? [{ k: -1, name: tr("Cả lịch trình"), c: G }, ...P.days.map((_, i) => ({ k: i, name: tr("Ngày {0}", [i + 1]), c: DAYC[i % DAYC.length] }))] : [];
  const listInfo = (fq ? tr("{0} điểm khớp \"{1}\"", [visible.length, q.trim()]) : tr("{0} điểm", [visible.length])) + " · " + tr("bấm để xem trên bản đồ");

  const sheetH = sheet === "peek" ? `${PEEK}px` : `${SHEET_FRAC[sheet] * 100}%`;
  const sheetTitle = spot ? tr(spot.name) : P ? tr("Lịch trình {0}", [tr(P.name)]) : tr("{0} điểm quanh Tà Xùa", [visible.length]);
  const sheetSub = spot ? tr(CAT[spot.cat][0]) : P ? tr("{0} ngày · {1} điểm dừng", [P.days.length, view.nStops]) : tr("Kéo bản đồ, chạm ghim để xem chi tiết");
  const sheetBtn = sheet === "full" ? tr("Thu gọn") : sheet === "half" ? tr("Mở rộng") : tr("Danh sách");

  // ── các khối dùng chung desktop / mobile ──
  const searchBox = (big: boolean) => (
    <div className="relative">
      <span className="absolute left-3 top-1/2 h-[13px] w-[13px] -translate-y-1/2 rounded-full border-2 border-[oklch(0.55_0.02_160)]" />
      <input value={q} onChange={(e) => { setQ(e.target.value); if (mob && sheet === "peek") setSheet("half"); }} placeholder={tr("Tìm điểm, homestay, quán…")} aria-label={tr("Tìm điểm, homestay, quán…")} className={`w-full rounded-xl border-[1.5px] border-[oklch(0.9_0.01_160)] bg-white py-[11px] pl-[34px] pr-3 outline-none focus:border-[oklch(0.5_0.1_158)] ${big ? "text-[15px]" : "text-sm"}`} />
    </div>
  );
  const spotImage = (s: BoardSpot, cls: string) => (
    <div className={`relative overflow-hidden ${cls}`} style={{ background: `linear-gradient(135deg, ${spotC}, oklch(0.3 0.05 160))` }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {s.image && <img src={s.image} alt={tr(s.name)} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />}
      <span className="pointer-events-none absolute bottom-2.5 left-2.5 rounded-full px-2.5 py-1 text-[11px] font-extrabold text-white" style={{ background: spotC }}>{tr(CAT[s.cat][0])}</span>
    </div>
  );
  const spotBody = (s: BoardSpot) => (
    <>
      {st?.n && <div className="rounded-[10px] bg-[oklch(0.97_0.03_75)] px-2.5 py-1.5 text-xs font-extrabold text-[oklch(0.45_0.12_50)]">{tr("Điểm {0} · Ngày {1}", [st.n, st.day])}{st.time ? ` · ${st.time}` : ""}</div>}
      {s.desc && <p className="text-sm leading-[1.55] text-[oklch(0.38_0.02_160)]">{tr(s.desc)}</p>}
      {s.best && <p className="text-[13px] font-bold text-[oklch(0.4_0.08_160)]">{tr("Đẹp nhất: {0}", [tr(s.best)])}</p>}
      {s.tip && <p className="rounded-xl bg-[oklch(0.97_0.03_85)] px-3 py-2 text-[13px] leading-[1.5] text-[oklch(0.4_0.06_70)]">{tr("Mẹo: {0}", [tr(s.tip)])}</p>}
    </>
  );
  const nearChips = (
    <div className="flex flex-wrap gap-1.5">
      {near.map((n) => (
        <button key={n.id} type="button" onClick={() => focus(n.id)} className="flex cursor-pointer items-center gap-1.5 rounded-full bg-[oklch(0.96_0.008_160)] px-2.5 py-1.5 text-xs font-bold hover:bg-[oklch(0.93_0.015_160)]">
          <span className="h-[7px] w-[7px] flex-none rounded-full" style={{ background: CAT[n.cat][1] }} />
          {tr(n.name).split(" – ")[0]}
        </button>
      ))}
    </div>
  );
  const spotLinks = (s: BoardSpot, big: boolean) => (
    <>
      <a href={s.mapUrl} target="_blank" rel="noopener noreferrer" className={`flex-1 rounded-full text-center font-extrabold text-white ${big ? "p-3 text-sm" : "p-2.5 text-[13px]"}`} style={{ background: G }}>{tr("Chỉ đường ↗")}</a>
      {s.href && <Link href={s.href} className={`flex-1 rounded-full text-center font-extrabold text-white ${big ? "p-3 text-sm" : "p-2.5 text-[13px]"}`} style={{ background: O }}>{s.cat === "home" ? tr("Xem phòng") : tr("Xem chi tiết")}</Link>}
    </>
  );
  const dayChips = (wrapCls: string) => (
    <div className={wrapCls}>
      {dayTabs.map((d) => (
        <button key={d.k} type="button" onClick={() => pickDay(d.k)} className="flex flex-none cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full border-[1.5px] px-[11px] py-1.5 text-xs font-extrabold" style={{ borderColor: day === d.k ? d.c : "oklch(0.9 0.01 160)", background: day === d.k ? "oklch(0.97 0.02 155)" : "white" }}>
          <span className="h-2 w-2 rounded-full" style={{ background: d.c }} />
          {d.name}
        </button>
      ))}
    </div>
  );
  const planDays = (line: boolean) =>
    P?.days.map((d, di) => (
      <div key={di} className="flex flex-col px-1.5 pb-2.5 pt-1.5 transition-opacity" style={{ opacity: day < 0 || day === di ? 1 : 0.4 }}>
        <button type="button" onClick={() => pickDay(di)} className="flex cursor-pointer items-center gap-2 px-0.5 pb-2 pt-1 text-left">
          <span className="flex-none rounded-full px-[9px] py-[3px] text-[11px] font-extrabold text-white" style={{ background: DAYC[di % DAYC.length] }}>{tr("Ngày {0}", [di + 1])}</span>
          <span className="text-sm font-extrabold">{tr(d.title)}</span>
        </button>
        {d.stops.map((s, si) => (
          <button key={si} type="button" onClick={() => { setDay((cur) => (cur < 0 ? cur : di)); focus(s.spotId); }} className="grid cursor-pointer grid-cols-[46px_24px_minmax(0,1fr)] gap-2 rounded-xl px-1.5 py-[5px] text-left hover:bg-[oklch(0.97_0.012_155)]" style={{ background: sel === s.spotId && s.own ? "oklch(0.96 0.025 155)" : undefined }}>
            <span className="pt-[3px] text-xs font-extrabold text-[oklch(0.45_0.02_160)]">{tr(s.time)}</span>
            <span className="flex flex-col items-center">
              <span className="flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full text-[11px] font-extrabold text-white" style={{ background: DAYC[di % DAYC.length] }}>{si + 1}</span>
              {line && <span className="min-h-2 w-0.5 flex-1" style={{ background: si === d.stops.length - 1 ? "transparent" : "oklch(0.9 0.01 160)" }} />}
            </span>
            <span className="min-w-0 pb-1">
              <span className="block text-[13px] font-extrabold leading-[1.35]">{tr(s.name)}</span>
              {s.note && <span className="block text-xs leading-[1.45] text-[oklch(0.5_0.02_160)]">{tr(s.note)}</span>}
            </span>
          </button>
        ))}
      </div>
    ));
  const link3d = <Link href="/ban-do?view=3d" className="flex-none whitespace-nowrap rounded-full border-[1.5px] border-[oklch(0.88_0.015_160)] bg-white px-3 py-[7px] text-xs font-extrabold text-[oklch(0.3_0.03_160)] hover:text-[oklch(0.66_0.18_45)]">{tr("Bản đồ 3D")}</Link>;

  return (
    <div className="relative h-[calc(100dvh-56px)] min-h-[480px] w-full overflow-hidden bg-[oklch(0.32_0.04_150)] text-[oklch(0.22_0.03_160)] max-lg:z-[31] lg:h-[calc(100dvh-70px)]">
      <style>{CSS}</style>
      <div ref={box} className="sb-map absolute inset-0 isolate z-0" style={{ ["--sb-b" as string]: mob ? sheetH : "0px" }} />
      <div className="pointer-events-none absolute inset-0 z-[1] bg-[linear-gradient(180deg,oklch(0.2_0.03_200/.25),transparent_18%,transparent_80%,oklch(0.2_0.03_200/.3))]" />

      {!mob && (
        <>
          {/* BẢNG NỔI BÊN TRÁI */}
          <aside className="sb-rise absolute bottom-4 left-4 top-4 z-20 flex w-[380px] flex-col overflow-hidden rounded-3xl bg-white/[.96] shadow-[0_24px_60px_-24px_oklch(0.1_0.03_160/.55)] backdrop-blur-[14px] lg:bottom-12">
            <div className="flex flex-col gap-3 border-b border-[oklch(0.93_0.01_160)] px-[18px] pb-3 pt-[18px]">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-[11px] font-extrabold tracking-[.14em] text-[oklch(0.5_0.1_158)]">{tr("ẢNH VỆ TINH THẬT")}</div>
                  <h1 className="mt-0.5 text-2xl font-extrabold leading-[1.15] tracking-[-.025em]">{tr("Bản đồ Tà Xùa")}</h1>
                </div>
                {link3d}
              </div>
              <div className="sb-noscroll flex gap-1 overflow-x-auto rounded-[14px] bg-[oklch(0.95_0.008_160)] p-1">
                {modes.map((t) => (
                  <button key={t.id} type="button" onClick={() => pickMode(t.id)} className="cursor-pointer whitespace-nowrap rounded-[11px] px-3 py-2 text-center text-[13px] font-extrabold transition-all" style={{ flex: t.id === "free" ? "1.4" : "1", background: planId === t.id ? G : "transparent", color: planId === t.id ? "white" : "oklch(0.35 0.03 160)", boxShadow: planId === t.id ? "0 2px 8px -2px oklch(0.2 0.05 160 / .5)" : "none" }}>{t.name}</button>
                ))}
              </div>
              {!P ? (
                <div className="flex flex-col gap-2.5">
                  {searchBox(false)}
                  <div className="grid grid-cols-2 gap-1.5">
                    {cats.map(([k, name, dot]) => (
                      <button key={k} type="button" onClick={() => { setCat(k); setSel(null); }} className="flex cursor-pointer items-center gap-2 rounded-xl border-[1.5px] px-2.5 py-2 text-left text-[13px] font-bold text-[oklch(0.25_0.03_160)]" style={{ borderColor: cat === k ? G : "oklch(0.9 0.01 160)", background: cat === k ? "oklch(0.96 0.025 155)" : "white" }}>
                        <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ background: dot }} />
                        <span className="flex-1 truncate">{tr(name)}</span>
                        <span className="font-extrabold opacity-65">{count(k)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  <div>
                    <div className="text-[17px] font-extrabold">{tr("Lịch trình {0}", [tr(P.name)])}</div>
                    {P.sub && <div className="mt-0.5 text-[13px] leading-[1.5] text-[oklch(0.45_0.02_160)]">{tr(P.sub)}</div>}
                  </div>
                  {dayChips("flex flex-wrap gap-1.5")}
                </div>
              )}
            </div>
            <div className="flex-1 overflow-y-auto px-2.5 pb-3 pt-2 [scrollbar-width:thin]">
              {!P ? (
                <>
                  <div className="px-2 py-1.5 text-xs font-bold text-[oklch(0.5_0.02_160)]">{listInfo}</div>
                  {!visible.length && <div className="px-3 py-6 text-center text-sm text-[oklch(0.5_0.02_160)]">{tr("Không tìm thấy điểm nào.")}</div>}
                  {visible.map((s) => (
                    <button key={s.id} type="button" onClick={() => focus(s.id)} className="flex w-full cursor-pointer items-center gap-2.5 rounded-[14px] px-2.5 py-[9px] text-left hover:bg-[oklch(0.97_0.012_155)]" style={{ background: sel === s.id ? "oklch(0.96 0.025 155)" : undefined }}>
                      <span className="h-[30px] w-[30px] flex-none rounded-full border-2 border-white shadow-[0_2px_6px_-2px_oklch(0.1_0.02_160/.5)]" style={{ background: CAT[s.cat][1] }} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold">{tr(s.name)}</span>
                        <span className="block text-xs text-[oklch(0.52_0.02_160)]">{tr(CAT[s.cat][0])}</span>
                      </span>
                      <span className="text-base text-[oklch(0.7_0.01_160)]">›</span>
                    </button>
                  ))}
                </>
              ) : (
                planDays(true)
              )}
            </div>
            {P && (
              <div className="border-t border-[oklch(0.93_0.01_160)] px-3.5 py-3">
                <Link href="/combo" className="block rounded-full p-[13px] text-center text-sm font-extrabold text-white" style={{ background: O }}>{tr("Đặt combo {0} theo lịch này →", [tr(P.name)])}</Link>
              </div>
            )}
          </aside>

          {/* THẺ ĐIỂM BÊN PHẢI */}
          {spot && (
            <div key={spot.id} className="sb-rise absolute right-4 top-4 z-[21] flex max-h-[calc(100%-32px)] w-[340px] flex-col overflow-hidden rounded-[22px] bg-white shadow-[0_24px_60px_-24px_oklch(0.1_0.03_160/.6)] lg:right-[92px]">
              <div className="relative flex-none">
                {spotImage(spot, "aspect-video")}
                <button type="button" aria-label={tr("Đóng")} onClick={closeSpot} className="absolute right-2.5 top-2.5 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-white text-[17px] font-extrabold shadow-[0_2px_8px_oklch(0.1_0.02_160/.3)]">×</button>
              </div>
              <div className="flex flex-col gap-2.5 overflow-y-auto px-4 pb-4 pt-3.5">
                <div className="text-lg font-extrabold leading-[1.3]">{tr(spot.name)}</div>
                {spotBody(spot)}
                <div className="flex gap-2">{spotLinks(spot, false)}</div>
                {near.length > 0 && (
                  <div className="flex flex-col gap-1.5 border-t border-dashed border-[oklch(0.9_0.01_160)] pt-1.5">
                    <span className="text-[11px] font-extrabold tracking-[.08em] text-[oklch(0.5_0.08_158)]">{tr("GẦN ĐÂY")}</span>
                    {nearChips}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {mob && (
        <>
          {/* MOBILE: chip phía trên */}
          <div className="absolute inset-x-0 top-2.5 z-20 flex flex-col gap-2">
            <div className="sb-noscroll flex gap-1.5 overflow-x-auto px-3">
              {modes.map((t) => (
                <button key={t.id} type="button" onClick={() => pickMode(t.id)} className="flex-none cursor-pointer whitespace-nowrap rounded-full px-3.5 py-[9px] text-[13px] font-extrabold shadow-[0_4px_12px_-4px_oklch(0.1_0.02_160/.5)]" style={{ background: planId === t.id ? G : "white", color: planId === t.id ? "white" : "oklch(0.25 0.03 160)" }}>{t.name}</button>
              ))}
              <span className="flex flex-none shadow-[0_4px_12px_-4px_oklch(0.1_0.02_160/.5)]">{link3d}</span>
            </div>
            {!P && (
              <div className="sb-noscroll flex gap-1.5 overflow-x-auto px-3">
                {cats.map(([k, name, dot]) => (
                  <button key={k} type="button" onClick={() => { setCat(k); setSel(null); }} className="flex flex-none cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-[7px] text-xs font-extrabold shadow-[0_4px_12px_-4px_oklch(0.1_0.02_160/.5)]" style={{ background: cat === k ? G : "white", color: cat === k ? "white" : "oklch(0.25 0.03 160)" }}>
                    <span className="h-2 w-2 rounded-full" style={{ background: dot }} />
                    {tr(name)} <span className="opacity-70">{count(k)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* MOBILE: bottom sheet 3 nấc */}
          <div className="absolute inset-x-0 bottom-0 z-[22] flex flex-col rounded-t-3xl bg-white shadow-[0_-14px_40px_-16px_oklch(0.1_0.03_160/.55)] transition-[height] duration-[350ms] ease-[cubic-bezier(.2,.8,.2,1)]" style={{ height: sheetH }}>
            <button type="button" onClick={() => setSheet(sheet === "peek" ? "half" : sheet === "half" ? "full" : "peek")} className="flex flex-none cursor-pointer flex-col items-center gap-2 px-4 pb-2 pt-2.5 text-left">
              <span className="h-[5px] w-10 rounded-[3px] bg-[oklch(0.86_0.01_160)]" />
              <span className="flex items-center justify-between gap-2.5 self-stretch">
                <span className="min-w-0">
                  <span className="block truncate text-base font-extrabold">{sheetTitle}</span>
                  <span className="block text-xs text-[oklch(0.5_0.02_160)]">{sheetSub}</span>
                </span>
                <span className="flex-none rounded-full bg-[oklch(0.95_0.008_160)] px-2.5 py-1.5 text-xs font-extrabold">{sheetBtn}</span>
              </span>
            </button>
            <div className="flex-1 overflow-y-auto px-3 pb-[calc(16px+env(safe-area-inset-bottom))]">
              {spot ? (
                <div key={spot.id} className="sb-rise flex flex-col gap-2.5">
                  {spotImage(spot, "aspect-[16/8] rounded-2xl")}
                  {spotBody(spot)}
                  <div className="flex gap-2">
                    {spotLinks(spot, true)}
                    <button type="button" onClick={closeSpot} className="cursor-pointer rounded-full border-[1.5px] border-[oklch(0.88_0.015_160)] px-4 py-3 text-sm font-extrabold">{tr("Đóng")}</button>
                  </div>
                  {nearChips}
                </div>
              ) : !P ? (
                <>
                  <div className="mb-1.5">{searchBox(true)}</div>
                  {!visible.length && <div className="px-3 py-6 text-center text-sm text-[oklch(0.5_0.02_160)]">{tr("Không tìm thấy điểm nào.")}</div>}
                  {visible.map((s) => (
                    <button key={s.id} type="button" onClick={() => focus(s.id)} className="flex w-full cursor-pointer items-center gap-2.5 border-b border-[oklch(0.95_0.005_160)] px-1.5 py-2.5 text-left">
                      <span className="h-7 w-7 flex-none rounded-full border-2 border-white shadow-[0_2px_6px_-2px_oklch(0.1_0.02_160/.5)]" style={{ background: CAT[s.cat][1] }} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold">{tr(s.name)}</span>
                        <span className="block text-xs text-[oklch(0.52_0.02_160)]">{tr(CAT[s.cat][0])}</span>
                      </span>
                    </button>
                  ))}
                </>
              ) : (
                <>
                  {dayChips("sb-noscroll flex gap-1.5 overflow-x-auto pb-1.5")}
                  {planDays(false)}
                  <Link href="/combo" className="mt-1 block rounded-full p-[13px] text-center text-sm font-extrabold text-white" style={{ background: O }}>{tr("Đặt combo {0} →", [tr(P.name)])}</Link>
                </>
              )}
            </div>
          </div>
        </>
      )}

      {/* NÚT PHÓNG TO / THU NHỎ / XEM TOÀN BỘ */}
      <div className="absolute z-[19] flex flex-col gap-px overflow-hidden rounded-[14px] shadow-[0_8px_20px_-8px_oklch(0.1_0.02_160/.6)] transition-[bottom] duration-[350ms] ease-[cubic-bezier(.2,.8,.2,1)]" style={mob ? { right: 12, bottom: `calc(${sheetH} + 12px)`, display: sheet === "full" ? "none" : undefined } : { left: 412, bottom: 16 }}>
        <button type="button" title={tr("Phóng to")} aria-label={tr("Phóng to")} onClick={() => zoomBy(0.75)} className="flex h-[42px] w-[42px] cursor-pointer items-center justify-center bg-white text-xl font-bold">+</button>
        <button type="button" title={tr("Thu nhỏ")} aria-label={tr("Thu nhỏ")} onClick={() => zoomBy(-0.75)} className="flex h-[42px] w-[42px] cursor-pointer items-center justify-center bg-white text-[22px] font-bold">−</button>
        <button type="button" title={tr("Xem toàn bộ")} aria-label={tr("Xem toàn bộ")} onClick={() => fitCurrent(true)} className="flex h-[42px] w-[42px] cursor-pointer items-center justify-center bg-white"><span className="h-4 w-4 rounded border-2 border-[oklch(0.3_0.03_160)]" /></button>
      </div>
    </div>
  );
}
