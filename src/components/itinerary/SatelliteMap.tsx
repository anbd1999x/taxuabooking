"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import type { Map as LeafletMap, Marker } from "leaflet";

export interface SatSpot {
  id: string;
  name: string;
  lat: number;
  lng: number;
  mapUrl: string;
  main?: boolean; // mốc trung tâm
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

/**
 * Bản đồ ẢNH VỆ TINH (Leaflet + ảnh vệ tinh Esri World Imagery) có ghim từng điểm check-in theo
 * toạ độ thật. Thay cho khung nhúng Google Maps (không tải được ảnh khi nhúng không có khoá API).
 */
export function SatelliteMap({ spots, selected, onSelect }: { spots: SatSpot[]; selected: string | null; onSelect: (id: string) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const state = useRef<{ map: LeafletMap; markers: Map<string, Marker> } | null>(null);
  const live = useRef({ onSelect, selected });
  useEffect(() => { live.current = { onSelect, selected }; });

  useEffect(() => {
    let dead = false;
    let map: LeafletMap | null = null;
    (async () => {
      const L = (await import("leaflet")).default;
      if (dead || !box.current) return;
      map = L.map(box.current, { zoomControl: true, attributionControl: true, scrollWheelZoom: true });
      L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
        maxZoom: 19,
        attribution: "Ảnh vệ tinh © Esri, Maxar, Earthstar Geographics",
      }).addTo(map);
      // tên đường / địa danh phủ lên ảnh vệ tinh
      L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}", { maxZoom: 19, opacity: 0.9 }).addTo(map);
      const markers = new Map<string, Marker>();
      for (const s of spots) {
        const icon = L.divIcon({
          className: "",
          iconSize: [0, 0],
          html: `<div class="sat-pin${s.main ? " sat-pin-main" : ""}" data-id="${esc(s.id)}"><span class="sat-dot"></span><span class="sat-label">${esc(s.name)}</span></div>`,
        });
        const m = L.marker([s.lat, s.lng], { icon, title: s.name }).addTo(map);
        m.bindPopup(`<b>${esc(s.name)}</b><br/><a href="${esc(s.mapUrl)}" target="_blank" rel="noopener noreferrer">Chỉ đường Google Maps ↗</a>`, { offset: [0, -6] });
        m.on("click", () => live.current.onSelect(s.id));
        markers.set(s.id, m);
      }
      if (spots.length > 0) map.fitBounds(L.latLngBounds(spots.map((s) => [s.lat, s.lng] as [number, number])).pad(0.15), { maxZoom: 15 });
      else map.setView([21.2754, 104.4343], 12);
      state.current = { map, markers };
      const cur = live.current.selected ? markers.get(live.current.selected) : undefined;
      if (cur) { map.setView(cur.getLatLng(), 16); cur.openPopup(); }
    })();
    return () => { dead = true; state.current = null; map?.remove(); };
  }, [spots]);

  // Chọn một điểm (từ danh sách / hàng nút) ⇒ bay tới điểm đó.
  useEffect(() => {
    const st = state.current;
    if (!st) return;
    st.map.getContainer().querySelectorAll(".sat-pin-on").forEach((el) => el.classList.remove("sat-pin-on"));
    const m = selected ? st.markers.get(selected) : undefined;
    if (!m) return;
    st.map.flyTo(m.getLatLng(), Math.max(st.map.getZoom(), 16), { duration: 0.8 });
    m.openPopup();
    m.getElement()?.querySelector(".sat-pin")?.classList.add("sat-pin-on");
  }, [selected]);

  return (
    <>
      <style>{`.sat-pin{position:absolute;left:0;top:0;transform:translate(-50%,-100%);display:flex;flex-direction:column-reverse;align-items:center;gap:3px;white-space:nowrap;pointer-events:auto;cursor:pointer}
.sat-dot{width:14px;height:14px;border-radius:50%;background:oklch(0.68 0.18 45);border:2.5px solid white;box-shadow:0 2px 6px rgba(0,0,0,.5)}
.sat-label{font:800 12px/1.2 'Be Vietnam Pro',system-ui,sans-serif;padding:4px 8px;border-radius:999px;background:white;color:oklch(0.22 0.03 160);box-shadow:0 3px 10px rgba(0,0,0,.35)}
.sat-pin-main .sat-dot{background:oklch(0.29 0.055 160)}.sat-pin-main .sat-label{background:oklch(0.29 0.055 160);color:white}
.sat-pin-on .sat-label{background:oklch(0.68 0.18 45);color:white}.sat-pin-on{z-index:999}`}</style>
      <div ref={box} className="absolute inset-0 z-[5]" style={{ background: "oklch(0.3 0.03 200)" }} />
    </>
  );
}
