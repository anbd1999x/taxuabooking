"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "leaflet/dist/leaflet.css";
import type { LayerGroup, Map as LeafletMap } from "leaflet";
import Link from "@/components/Link";
import { useT } from "@/components/i18n/I18nProvider";
import type { NearbyHome, NearbyKind, NearbyPlace } from "@/lib/nearby";

/**
 * Popup "Xung quanh <home> có gì?" — theo claude.ai/design `Popup Xung quanh.dc.html`.
 * Bản đồ Leaflet (miễn phí, mã nguồn mở) + nền ĐỊA HÌNH Esri World Topo (đường đồng mức, đồi núi, cung đường),
 * chuyển được sang ảnh vệ tinh. Điểm = Place đã đăng có toạ độ (check-in / cafe / nhà hàng); khoảng cách
 * tính từ toạ độ homestay (đường chim bay; quãng đường & thời gian xe máy là ước tính theo đường núi).
 */

const G = "oklch(0.29 0.055 160)";
const HOME_C = "oklch(0.45 0.1 158)";
const TYPES: Record<NearbyKind, [string, string]> = {
  CHECKIN: ["Check-in", "oklch(0.62 0.17 45)"],
  CAFE: ["Cafe", "oklch(0.5 0.08 60)"],
  RESTAURANT: ["Nhà hàng", "oklch(0.52 0.15 25)"],
  HOMESTAY: ["Homestay", "oklch(0.48 0.13 250)"],
};

/**
 * Tải trước (khi khách rê chuột / chạm vào nút): thư viện bản đồ + dữ liệu điểm + quãng đường của home mặc định.
 * Lưu promise theo khoá để popup mở ra dùng lại ngay, không tải lần hai.
 */
const prefetchCache = new Map<string, Promise<unknown>>();
function prefetchJson(url: string): Promise<unknown> {
  let p = prefetchCache.get(url);
  if (!p) {
    p = fetch(url).then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))));
    p.catch(() => prefetchCache.delete(url));
    prefetchCache.set(url, p);
  }
  return p;
}
const dataUrl = (ids: string[]) => `/api/nearby?ids=${encodeURIComponent(ids.join(","))}`;
const roadsUrl = (homeId: string) => `/api/nearby/roads?home=${homeId}`;
function warm(ids: string[]) {
  void import("leaflet").catch(() => {});
  void prefetchJson(dataUrl(ids)).catch(() => {});
  if (ids[0]) void prefetchJson(roadsUrl(ids[0])).catch(() => {});
}
/** Icon nét trắng (viewBox 24) cho ghim bản đồ + huy hiệu danh sách: nhà · dao dĩa · ly cà phê · máy ảnh. */
const ICON_PATHS: Record<NearbyKind, string> = {
  HOMESTAY: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v10h13V10"/><path d="M10 20v-5.5h4V20"/>',
  RESTAURANT: '<path d="M7 3v18"/><path d="M4.5 3v5a2.5 2.5 0 0 0 5 0V3"/><path d="M17 21V3c-2.2 1.5-3 4-3 7v3h3"/>',
  CAFE: '<path d="M4 9h12v4.5A5.5 5.5 0 0 1 10.5 19h-1A5.5 5.5 0 0 1 4 13.5z"/><path d="M16 10.5h1.5a2.75 2.75 0 0 1 0 5.5H16"/><path d="M8 3.5v2.5M12 3.5v2.5"/>',
  CHECKIN: '<path d="M4 8h3l1.8-2.5h6.4L17 8h3v11H4z"/><circle cx="12" cy="13.3" r="3.3"/>',
};
const iconSvg = (k: NearbyKind, size: number) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="display:block;flex:none">${ICON_PATHS[k]}</svg>`;

const RADII: [number, string][] = [[1, "≤ 1 km"], [3, "≤ 3 km"], [5, "≤ 5 km"], [0, "Tất cả"]];

function hav(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const r = (x: number) => (x * Math.PI) / 180;
  const dLa = r(b.lat - a.lat);
  const dLo = r(b.lng - a.lng);
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
const fmtKm = (d: number) => (d < 1 ? `${Math.round(d * 100) * 10} m` : `${d.toFixed(1).replace(".", ",")} km`);
/** Quãng đường núi ước tính (đường vòng ≈ 1,45 lần đường chim bay). */
const road = (d: number) => d * 1.45 + 0.15;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

/** Nút mở popup — đặt ở trang homestay / thẻ combo. `homeIds[0]` = home mặc định. */
export function NearbyButton({ homeIds, context = "home", className = "" }: { homeIds: string[]; context?: "home" | "combo"; className?: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  // Trang hiện xong & trình duyệt rảnh ⇒ tải sẵn THƯ VIỆN bản đồ (một lần, dùng chung mọi nút) — bấm thẳng trên điện thoại
  // vẫn mở nhanh. Dữ liệu chỉ tải trước khi rê chuột / chạm đúng nút (trang combo có nhiều nút).
  const key = homeIds.length ? "1" : "";
  useEffect(() => {
    if (!key) return;
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
    const run = () => void import("leaflet").catch(() => {});
    const id = w.requestIdleCallback ? w.requestIdleCallback(run, { timeout: 4000 }) : window.setTimeout(run, 2500);
    return () => (w.cancelIdleCallback ? w.cancelIdleCallback(id) : window.clearTimeout(id));
  }, [key]);
  if (!homeIds.length) return null;
  return (
    <>
      <button
        type="button"
        onMouseEnter={() => warm(homeIds)}
        onFocus={() => warm(homeIds)}
        onTouchStart={() => warm(homeIds)}
        onClick={() => setOpen(true)}
        className={`group ${
          className ||
          "inline-flex items-center gap-2 rounded-full border-[1.5px] border-[oklch(0.85_0.04_158)] bg-white px-4 py-2.5 text-sm font-extrabold text-[oklch(0.33_0.07_158)] transition-colors hover:bg-[oklch(0.96_0.025_155)]"
        }`}
      >
        <span className="nb-bob nb-dot h-2 w-2 flex-none rounded-full bg-sunset-500" />
        {t("Xung quanh có gì?")}
      </button>
      {open && <NearbyPopup homeIds={homeIds} context={context} onClose={() => setOpen(false)} />}
    </>
  );
}

export function NearbyPopup({ homeIds, context, onClose }: { homeIds: string[]; context: "home" | "combo"; onClose: () => void }) {
  const t = useT();
  const [data, setData] = useState<{ homes: NearbyHome[]; places: NearbyPlace[] } | null>(null);
  const [err, setErr] = useState(false);
  const [homeId, setHomeId] = useState(homeIds[0]);
  const [type, setType] = useState<"all" | NearbyKind>("all");
  const [radius, setRadius] = useState(5);
  const [sort, setSort] = useState<"near" | "rate">("near");
  const [sel, setSel] = useState<string | null>(null);
  // Popup chỉ dựng ở trình duyệt (mở bằng bấm nút) ⇒ đọc bề rộng ngay, bản đồ khởi tạo đúng khung mobile từ đầu.
  const [mob, setMob] = useState(() => typeof window !== "undefined" && window.innerWidth < 760);

  // Nạp dữ liệu
  useEffect(() => {
    let off = false;
    prefetchJson(dataUrl(homeIds))
      .then((j) => !off && setData(j as { homes: NearbyHome[]; places: NearbyPlace[] }))
      .catch(() => !off && setErr(true));
    return () => { off = true; };
  }, [homeIds]);

  // Khoá cuộn trang + Esc để đóng + theo dõi bề rộng
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const onR = () => setMob(window.innerWidth < 760);
    onR();
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onR);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onR);
    };
  }, [onClose]);

  // Home chưa có toạ độ ⇒ không tự lấy home khác thay vào (khoảng cách sẽ sai), chỉ cho chọn ở ô bên trên.
  const home = data?.homes.find((h) => h.id === homeId) ?? null;
  // Quãng đường XE CHẠY THẬT (km, phút) theo home đang chọn — /api/nearby/roads (dẫn đường OpenStreetMap, có cache).
  const [roads, setRoads] = useState<{ home: string; map: Record<string, { km: number; min: number }> } | null>(null);
  useEffect(() => {
    if (!home) return;
    let off = false;
    prefetchJson(roadsUrl(home.id))
      .then((j) => !off && setRoads({ home: home.id, map: (j as { roads?: Record<string, { km: number; min: number }> })?.roads ?? {} }))
      .catch(() => !off && setRoads({ home: home.id, map: {} }));
    return () => { off = true; };
  }, [home]);
  const roadMap = roads && home && roads.home === home.id ? roads.map : null;
  const roadsLoading = Boolean(home) && !roadMap;
  // d = km đường đi (thật nếu đã tính, chưa có thì ước tính theo đường chim bay × 1,45), real = đã có số thật.
  const all = useMemo(
    () =>
      home && data
        ? data.places.filter((p) => p.id !== home.id).map((p) => {
            const r = roadMap?.[p.id];
            const air = hav(home, p);
            return { ...p, air, d: r ? r.km : road(air), min: r ? r.min : null, real: Boolean(r) };
          })
        : [],
    [home, data, roadMap],
  );
  const inR = useMemo(() => all.filter((p) => !radius || p.d <= radius), [all, radius]);
  const vis = useMemo(
    () =>
      inR
        .filter((p) => type === "all" || p.kind === type)
        .sort((a, b) => (sort === "rate" ? (b.rating ?? 0) - (a.rating ?? 0) || a.d - b.d : a.d - b.d)),
    [inR, type, sort],
  );
  const mins = (p: { d: number; min: number | null }) =>
    p.d < 0.6 ? t("~{0} phút đi bộ", [Math.max(2, Math.round((p.d * 1000) / 75))]) : p.min != null ? t("{0} phút xe máy", [p.min]) : t("~{0} phút xe máy", [Math.max(3, Math.round((p.d / 20) * 60))]);
  const kmLabel = (p: { d: number; real: boolean }) => (p.real ? fmtKm(p.d) : "~" + fmtKm(p.d));

  // Đường đi tới điểm đang chọn (bám theo cung đường) — /api/nearby/route.
  const [route, setRoute] = useState<{ key: string; path: [number, number][] | null } | null>(null);
  const routeKey = home && sel ? `${home.id}|${sel}` : "";
  useEffect(() => {
    if (!routeKey || !home || !sel) return;
    let off = false;
    fetch(`/api/nearby/route?home=${home.id}&place=${sel}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => !off && setRoute({ key: routeKey, path: j?.route?.path ?? null }))
      .catch(() => !off && setRoute({ key: routeKey, path: null }));
    return () => { off = true; };
  }, [routeKey, home, sel]);
  const routePath = route && route.key === routeKey ? route.path : undefined; // undefined = đang tải, null = không có

  // ----- Bản đồ -----
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<{ map: LeafletMap; layer: LayerGroup; L: typeof import("leaflet") } | null>(null);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    if (!home) return;
    let dead = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (dead || !box.current || mapRef.current) return;
      const map = L.map(box.current, { zoomControl: true, attributionControl: true, scrollWheelZoom: true });
      const topo = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}", {
        maxZoom: 19,
        attribution: "© Esri · OpenStreetMap",
      });
      const sat = L.layerGroup([
        L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { maxZoom: 19, attribution: "© Esri, Maxar" }),
        L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}", { maxZoom: 19, opacity: 0.9 }),
        // Đường giao thông phủ lên ảnh vệ tinh — thấy rõ cung đường đèo.
        L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}", { maxZoom: 19, opacity: 0.85 }),
      ]).addTo(map); // mặc định: ảnh vệ tinh
      L.control.layers({ [t("Vệ tinh")]: sat, [t("Địa hình")]: topo }, undefined, { position: "topleft", collapsed: true }).addTo(map);
      const layer = L.layerGroup().addTo(map);
      mapRef.current = { map, layer, L };
      setMapReady(true);
      setTimeout(() => map.invalidateSize(), 80);
    })();
    return () => {
      dead = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Boolean(home)]);
  useEffect(() => () => { mapRef.current?.map.remove(); mapRef.current = null; }, []);
  useEffect(() => {
    const m = mapRef.current;
    if (m) setTimeout(() => m.map.invalidateSize(), 60);
  }, [mob]);

  const pin = (L: typeof import("leaflet"), label: string, c: string, big: boolean, on: boolean, kind?: NearbyKind) => {
    const col = on ? G : c;
    return L.divIcon({
      className: "",
      iconSize: [0, 0],
      html: `<div style="transform:translate(-50%,-100%);display:flex;flex-direction:column;align-items:center"><div style="background:${col};color:white;font:800 ${big ? 13 : 12}px 'Be Vietnam Pro',system-ui,sans-serif;${kind && !label ? "width:22px;height:22px;padding:0;justify-content:center" : `padding:${big ? "7px 12px" : on ? "5px 10px" : "4px 8px"}`};display:flex;align-items:center;gap:5px;border-radius:999px;border:2px solid white;box-shadow:0 6px 14px -4px rgba(0,0,0,.45);white-space:nowrap;cursor:pointer">${kind ? iconSvg(kind, kind && !label ? 12 : 13) : ""}${label ? esc(label) : ""}</div><div style="width:2px;height:${big ? 12 : 8}px;background:${col}"></div><div style="width:8px;height:8px;border-radius:50%;background:${col};border:2px solid white;margin-top:-1px"></div></div>`,
    });
  };

  // Vẽ lại khi đổi home / loại / bán kính / chọn điểm. `fit` = canh khung lại (đổi home / loại / bán kính).
  const fitKey = `${home?.id}|${type}|${radius}`;
  const lastFit = useRef("");
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !home) return;
    const { map, layer, L } = m;
    layer.clearLayers();
    const sp = vis.find((p) => p.id === sel);
    let routeLine: ReturnType<typeof L.polyline> | null = null;
    if (sp) {
      if (routePath && routePath.length > 1) {
        // Đường xe chạy thật: viền trắng + nét xanh, bám theo cung đường đèo.
        L.polyline(routePath, { color: "white", weight: 8, opacity: 0.9, lineCap: "round", lineJoin: "round" }).addTo(layer);
        routeLine = L.polyline(routePath, { color: G, weight: 4.5, lineCap: "round", lineJoin: "round" }).addTo(layer);
      } else {
        // Đang tính / không có dữ liệu đường ⇒ nét đứt nối thẳng (tạm).
        L.polyline([[home.lat, home.lng], [sp.lat, sp.lng]], { color: G, weight: 3, dashArray: "2 8", lineCap: "round" }).addTo(layer);
      }
    }
    vis.forEach((p) => {
      const on = p.id === sel;
      L.marker([p.lat, p.lng], { icon: pin(L, on ? `${t(p.name)} · ${kmLabel(p)}` : "", TYPES[p.kind][1], false, on, p.kind), zIndexOffset: on ? 900 : 0, opacity: !sel || on ? 1 : 0.28 })
        .on("click", () => setSel(p.id))
        .addTo(layer);
    });
    L.marker([home.lat, home.lng], { icon: pin(L, t(home.name), HOME_C, true, false, "HOMESTAY"), zIndexOffset: 1000 }).addTo(layer);
    if (lastFit.current !== fitKey) {
      lastFit.current = fitKey;
      const pts: [number, number][] = [[home.lat, home.lng], ...vis.map((p) => [p.lat, p.lng] as [number, number])];
      if (pts.length > 1) map.fitBounds(pts, { padding: [50, 50], maxZoom: 16 });
      else map.setView([home.lat, home.lng], 15);
    } else if (routeLine) map.fitBounds(routeLine.getBounds(), { padding: [60, 60], maxZoom: 16 });
    else if (sp) map.panTo([(home.lat + sp.lat) / 2, (home.lng + sp.lng) / 2], { animate: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, home, vis, sel, fitKey, routePath]);

  const refit = () => {
    setSel(null);
    lastFit.current = "";
    const m = mapRef.current;
    if (m && home) {
      const pts: [number, number][] = [[home.lat, home.lng], ...vis.map((p) => [p.lat, p.lng] as [number, number])];
      if (pts.length > 1) m.map.fitBounds(pts, { padding: [50, 50], maxZoom: 16 });
      else m.map.setView([home.lat, home.lng], 15);
      lastFit.current = fitKey;
    }
  };

  // Chọn ở bản đồ ⇒ cuộn danh sách tới điểm đó.
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!sel) return;
    listRef.current?.querySelector(`[data-pid="${sel}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [sel]);

  const kick = `${context === "combo" ? "COMBO" : "HOMESTAY"} · ${t("BẢN ĐỒ XUNG QUANH")}`;

  return createPortal(
    <>
      <div onClick={onClose} className="fixed inset-0 z-[80] bg-[oklch(0.15_0.03_165_/.55)] backdrop-blur-[3px]" style={{ animation: "nbFade .2s ease both" }} />
      <div
        role="dialog"
        aria-modal="true"
        className="fixed inset-0 z-[81] m-auto flex flex-col overflow-hidden bg-white text-ink shadow-[0_40px_80px_-30px_oklch(0.1_0.03_160_/.6)]"
        style={{ width: mob ? "100vw" : "min(1180px, 94vw)", height: mob ? "100dvh" : "min(780px, 92vh)", borderRadius: mob ? 0 : 24, animation: "nbPop .3s cubic-bezier(.2,.7,.2,1) both" }}
      >
        {/* Đầu popup */}
        <div className="flex items-start justify-between gap-3 border-b border-[oklch(0.93_0.01_160)] px-[18px] pb-3 pt-4">
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-xs font-extrabold tracking-[0.08em] text-[oklch(0.5_0.1_158)]">{kick}</span>
            <div className="font-extrabold leading-[1.2] tracking-[-0.02em]" style={{ fontSize: mob ? 19 : 23 }}>
              {t("Xung quanh {0} có gì?", [home ? t(home.name) : "homestay"])}
            </div>
            {data && (data.homes.length > 1 || (!home && data.homes.length > 0)) && (
              <label className="flex flex-wrap items-center gap-2 text-[13px] font-semibold text-[oklch(0.48_0.02_160)]">
                {t("Tính khoảng cách từ")}
                <select
                  value={home?.id ?? ""}
                  onChange={(e) => { setHomeId(e.target.value); setSel(null); }}
                  className="rounded-full border-[1.5px] border-[oklch(0.88_0.015_160)] bg-[oklch(0.97_0.01_155)] px-2.5 py-1.5 text-[13px] font-extrabold text-[oklch(0.3_0.06_158)]"
                >
                  {!home && <option value="">{t("Chọn homestay")}</option>}
                  {data.homes.map((h) => <option key={h.id} value={h.id}>{t(h.name)}</option>)}
                </select>
              </label>
            )}
          </div>
          <button type="button" onClick={onClose} aria-label={t("Đóng")} className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-[oklch(0.95_0.005_160)] text-xl font-extrabold">×</button>
        </div>

        {/* Thanh lọc */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-[oklch(0.93_0.01_160)] px-[18px] py-2.5">
          <div className="flex max-w-full gap-1.5 overflow-x-auto [scrollbar-width:none]">
            {([["all", t("Tất cả"), G], ["CHECKIN", t("Điểm check-in"), TYPES.CHECKIN[1]], ["CAFE", t("Cafe"), TYPES.CAFE[1]], ["RESTAURANT", t("Nhà hàng"), TYPES.RESTAURANT[1]], ["HOMESTAY", t("Homestay"), TYPES.HOMESTAY[1]]] as const).map(([k, name, dot]) => {
              const on = type === k;
              const n = k === "all" ? inR.length : inR.filter((p) => p.kind === k).length;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => { setType(k); setSel(null); }}
                  className="flex flex-none items-center gap-1.5 whitespace-nowrap rounded-full border-[1.5px] px-[13px] py-2 text-[13px] font-extrabold"
                  style={{ background: on ? dot : "white", color: on ? "white" : "oklch(0.3 0.03 160)", borderColor: on ? dot : "oklch(0.9 0.01 160)" }}
                >
                  <span className="h-2 w-2 rounded-full" style={{ background: on ? "white" : dot }} />
                  {name}
                  <span className="opacity-70">{n}</span>
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex gap-[3px] rounded-[11px] bg-[oklch(0.95_0.006_160)] p-[3px]">
              {RADII.map(([k, name]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => { setRadius(k); setSel(null); }}
                  className="whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-extrabold"
                  style={{ background: radius === k ? "white" : "transparent", color: radius === k ? G : "oklch(0.45 0.02 160)", boxShadow: radius === k ? "0 1px 3px oklch(0.2 0.03 160 / .15)" : "none" }}
                >
                  {t(name)}
                </button>
              ))}
            </div>
            <select value={sort} onChange={(e) => setSort(e.target.value as "near" | "rate")} className="rounded-[10px] border-[1.5px] border-[oklch(0.9_0.01_160)] bg-white px-2.5 py-[7px] text-xs font-extrabold">
              <option value="near">{t("Gần nhất")}</option>
              <option value="rate">{t("Đánh giá cao")}</option>
            </select>
          </div>
        </div>

        {/* Thân: bản đồ + danh sách */}
        {err ? (
          <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-gray-500">{t("Không tải được dữ liệu. Thử lại sau.")}</div>
        ) : !data ? (
          <div className="flex flex-1 items-center justify-center p-6 text-sm text-gray-500">{t("Đang tải bản đồ…")}</div>
        ) : !home ? (
          <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-gray-500">{data.homes.length ? t("Homestay này chưa có vị trí trên bản đồ — chọn homestay khác ở ô phía trên để xem.") : t("Homestay này chưa có vị trí trên bản đồ.")}</div>
        ) : (
          <div className="grid min-h-0 flex-1" style={{ gridTemplateColumns: mob ? "1fr" : "minmax(0,1.35fr) minmax(0,1fr)", gridTemplateRows: mob ? "50dvh minmax(0,1fr)" : "1fr" }}>
            <div className="relative min-h-0 min-w-0">
              <div ref={box} className="absolute inset-0 bg-[oklch(0.94_0.01_160)] [&_.leaflet-container]:font-[inherit]" />
              <div className="pointer-events-none absolute bottom-3 left-3 z-[500] flex flex-wrap gap-1.5">
                {[{ name: t(home.name), c: HOME_C, k: "HOMESTAY" as NearbyKind }, ...(Object.entries(TYPES) as [NearbyKind, [string, string]][]).map(([k, [name, c]]) => ({ name: t(name), c, k }))].map((l) => (
                  <span key={l.name} className="flex items-center gap-1.5 whitespace-nowrap rounded-full bg-white/95 px-[7px] py-[4px] text-[11px] font-extrabold shadow-[0_2px_8px_-2px_oklch(0.2_0.03_160_/.3)]">
                    <span className="flex h-4 w-4 items-center justify-center rounded-full" style={{ background: l.c }} dangerouslySetInnerHTML={{ __html: iconSvg(l.k, 10) }} />
                    {l.name}
                  </span>
                ))}
              </div>
              <button type="button" onClick={refit} className="absolute right-3 top-3 z-[500] rounded-full bg-white px-3 py-2 text-xs font-extrabold shadow-[0_4px_12px_-4px_oklch(0.2_0.03_160_/.35)]">
                {t("Về vị trí home")}
              </button>
            </div>
            <div ref={listRef} className="flex min-h-0 flex-col overflow-y-auto" style={{ borderLeft: mob ? 0 : "1px solid oklch(0.93 0.01 160)", borderTop: mob ? "1px solid oklch(0.93 0.01 160)" : 0 }}>
              <div className="px-4 pb-1.5 pt-3 text-[13px] font-bold text-[oklch(0.48_0.02_160)]">
                {radius ? t("{0} điểm trong bán kính {1} km", [vis.length, radius]) : t("{0} điểm quanh Tà Xùa", [vis.length])}
                {" · "}
                {sort === "near" ? t("gần nhất trước") : t("đánh giá cao trước")}
              </div>
              {!vis.length && (
                <div className="mx-4 my-2 rounded-2xl border-[1.5px] border-dashed border-[oklch(0.86_0.02_160)] px-3.5 py-6 text-center text-sm text-[oklch(0.5_0.02_160)]">
                  {t("Không có điểm nào trong bán kính này. Thử mở rộng bán kính.")}
                </div>
              )}
              <div className="flex flex-col gap-2 px-3 pb-4 pt-1">
                {vis.map((p) => {
                  const on = sel === p.id;
                  const c = TYPES[p.kind][1];
                  const dir = `https://www.google.com/maps/dir/?api=1&origin=${home.lat},${home.lng}&destination=${p.lat},${p.lng}&travelmode=driving`;
                  const gm = p.mapUrl || `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`;
                  const facts = [p.real ? t("Đường xe chạy {0}", [fmtKm(p.d)]) : t("Đường đi ~{0} km", [p.d.toFixed(1).replace(".", ",")]), t("Chim bay {0}", [fmtKm(p.air)]), p.hours && t("Mở {0}", [p.hours]), p.price].filter(Boolean) as string[];
                  return (
                    <div
                      key={p.id}
                      data-pid={p.id}
                      onClick={() => setSel(on ? null : p.id)}
                      className="flex cursor-pointer flex-col gap-2.5 rounded-2xl border-[1.5px] p-2.5 transition-colors hover:border-[oklch(0.75_0.06_158)]"
                      style={{ borderColor: on ? G : "oklch(0.92 0.01 160)", background: on ? "oklch(0.97 0.015 155)" : "white" }}
                    >
                      <div className="grid grid-cols-[64px_minmax(0,1fr)_auto] items-center gap-2.5">
                        <div className="relative h-[52px] w-16 overflow-hidden rounded-[10px] bg-[oklch(0.94_0.01_160)]">
                          {p.cover && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={p.cover} alt="" loading="lazy" className="h-full w-full object-cover" />
                          )}
                          <span className="pointer-events-none absolute left-1 top-1 flex h-5 w-5 items-center justify-center rounded-full border-[1.5px] border-white" style={{ background: c }} dangerouslySetInnerHTML={{ __html: iconSvg(p.kind, 11) }} />
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-[15px] font-extrabold">{t(p.name)}</div>
                          <div className="truncate text-xs text-[oklch(0.5_0.02_160)]">
                            <span className="font-extrabold" style={{ color: c }}>{t(TYPES[p.kind][0])}</span>
                            {p.rating != null && <> · ★ {p.rating.toFixed(1).replace(".", ",")}</>}
                            {p.short && <> · {t(p.short)}</>}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[17px] font-extrabold tracking-[-0.01em]">{kmLabel(p)}</div>
                          <div className="whitespace-nowrap text-[11px] font-bold text-[oklch(0.5_0.02_160)]">{mins(p)}</div>
                        </div>
                      </div>
                      {on && (
                        <div className="flex flex-col gap-2" style={{ animation: "nbFade .2s ease both" }}>
                          {p.desc && <div className="text-[13px] leading-[1.55] text-[oklch(0.38_0.02_160)]">{t(p.desc)}</div>}
                          <div className="flex flex-wrap gap-1.5">
                            {facts.map((f) => <span key={f} className="whitespace-nowrap rounded-full border border-[oklch(0.9_0.01_160)] bg-white px-[9px] py-1 text-[11px] font-bold">{t(f)}</span>)}
                          </div>
                          <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                            <a href={dir} target="_blank" rel="noopener noreferrer" className="flex-1 rounded-full p-2.5 text-center text-[13px] font-extrabold text-white" style={{ background: G }}>
                              {t("Chỉ đường Google Maps ↗")}
                            </a>
                            {p.href ? (
                              <Link href={p.href} target="_blank" className="whitespace-nowrap rounded-full border-[1.5px] border-[oklch(0.88_0.015_160)] px-3.5 py-2.5 text-[13px] font-extrabold text-[oklch(0.25_0.03_160)]">
                                {p.kind === "HOMESTAY" ? t("Xem homestay") : t("Xem quán")}
                              </Link>
                            ) : (
                              <a href={gm} target="_blank" rel="noopener noreferrer" className="whitespace-nowrap rounded-full border-[1.5px] border-[oklch(0.88_0.015_160)] px-3.5 py-2.5 text-[13px] font-extrabold text-[oklch(0.25_0.03_160)]">
                                {t("Xem điểm")}
                              </a>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="mt-auto border-t border-[oklch(0.94_0.006_160)] px-4 pb-3.5 pt-2.5 text-[11px] leading-normal text-[oklch(0.55_0.02_160)]">
                {roadsLoading
                  ? t("Đang tính quãng đường xe chạy… số có dấu ~ là ước tính tạm.")
                  : t("Quãng đường và thời gian tính theo đường xe máy thực tế trên bản đồ OpenStreetMap; số có dấu ~ là ước tính (chưa có dữ liệu đường).")}
              </div>
            </div>
          </div>
        )}
      </div>
      <style>{`@keyframes nbPop{from{opacity:0;transform:translateY(16px) scale(.98)}to{opacity:1;transform:none}}@keyframes nbFade{from{opacity:0}to{opacity:1}}`}</style>
    </>,
    document.body,
  );
}
