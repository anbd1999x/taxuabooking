"use client";

import { useT } from "@/components/i18n/I18nProvider";

/**
 * Cờ "Đi Tà Xùa thôii" cho nhân vật trong hoạt cảnh hero (combo, cabin, homestay, xe máy, xe ôm, taxi).
 * Đặt BÊN TRONG khung nhân vật (khung có position absolute) → cờ đi/ẩn/thu nhỏ theo nhân vật.
 * (x, y) = đỉnh cán cờ so với khung; cán dài `h` px xuống tới tay.
 * Nhân vật bị lật (scaleX(-1)) thì đặt biến CSS `--f: -1` trên khung để chữ trên cờ không bị ngược.
 */
export function TripFlag({ x, y, h, big = false }: { x: number; y: number; h: number; big?: boolean }) {
  const tr = useT();
  return (
    <div aria-hidden className="pointer-events-none absolute" style={{ left: x, top: y }}>
      <div className="absolute left-0 top-0 w-[2px] rounded-full" style={{ height: h, background: "oklch(0.4 0.05 60)" }} />
      <div className="absolute left-[-1.5px] top-[-3px] h-[5px] w-[5px] rounded-full" style={{ background: "oklch(0.86 0.15 85)" }} />
      <div
        className="tx-flag absolute left-[2px] top-0 flex items-center whitespace-nowrap font-black leading-none tracking-[0.01em]"
        style={{
          height: big ? 19 : 15,
          padding: big ? "0 11px 0 6px" : "0 9px 0 5px",
          fontSize: big ? 9.5 : 7.5,
          color: "oklch(0.97 0.08 95)",
          background: "linear-gradient(180deg, oklch(0.66 0.21 32), oklch(0.58 0.2 28))",
          clipPath: "polygon(0 0, 100% 0, 90% 50%, 100% 100%, 0 100%)",
          filter: "drop-shadow(0 1px 2px oklch(0.2 0.05 30 / .35))",
          transformOrigin: "left center",
        }}
      >
        <span className="inline-block" style={{ transform: "scaleX(var(--f, 1))" }}>{tr("Đi Tà Xùa thôii")}</span>
      </div>
    </div>
  );
}
