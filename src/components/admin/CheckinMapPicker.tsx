"use client";

import { MAP_EDGES, MAP_NODES } from "@/lib/checkin-map";

const YS = 0.8; // mặt bản đồ tỉ lệ 1.25 ⇒ SVG viewBox 100×80
const INPUT = "w-24 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:border-forest-500 focus:outline-none";

/**
 * Chọn vị trí một điểm check-in trên bản đồ hoạt hình (/ban-do): bấm vào sơ đồ nhìn từ trên xuống
 * (cùng hệ toạ độ 0–100 với trang khách) hoặc gõ số X/Y. `fallback` = vị trí mặc định theo slug.
 */
export function CheckinMapPicker({
  name, value, fallback, others, onChange,
}: {
  name: string;
  value: [number, number] | null;
  fallback: [number, number] | null;
  others: { name: string; pos: [number, number] }[];
  onChange: (v: [number, number] | null) => void;
}) {
  const pos = value ?? fallback;
  const round = (v: number) => Math.round(Math.max(0, Math.min(100, v)) * 10) / 10;

  function pick(e: React.MouseEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    onChange([round(((e.clientX - r.left) / r.width) * 100), round(((e.clientY - r.top) / r.height) * 100)]);
  }
  const setAxis = (i: 0 | 1, raw: string) => {
    const v = parseFloat(raw);
    if (!Number.isFinite(v)) return;
    const cur: [number, number] = pos ? [pos[0], pos[1]] : [50, 50];
    cur[i] = round(v);
    onChange(cur);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="text-xs font-bold text-gray-500">
        Vị trí trên bản đồ check-in <span className="font-medium text-gray-400">· bấm vào sơ đồ để đặt điểm</span>
      </div>
      <div
        onClick={pick}
        className="relative aspect-[1.25] w-full cursor-crosshair overflow-hidden rounded-2xl border border-gray-200"
        style={{ background: "radial-gradient(ellipse at 50% 55%, oklch(0.86 0.08 140), oklch(0.74 0.1 148))" }}
      >
        <svg viewBox="0 0 100 80" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full">
          {MAP_EDGES.map((e, i) => (
            <polyline key={i} points={e.pts.map((p) => `${p[0]},${p[1] * YS}`).join(" ")} fill="none" stroke="oklch(0.97 0.03 85)" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={e.rough ? "2 4" : undefined} vectorEffect="non-scaling-stroke" />
          ))}
        </svg>
        {[{ name: "Trung tâm Tà Xùa", pos: MAP_NODES.tt }, { name: "Bắc Yên", pos: MAP_NODES.by }].map((f) => (
          <Dot key={f.name} pos={f.pos} label={f.name} tone="fixed" />
        ))}
        {others.map((o) => (
          <Dot key={o.name} pos={o.pos} label={o.name} tone="other" />
        ))}
        {pos && <Dot pos={pos} label={name || "Điểm này"} tone={value ? "me" : "default"} />}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-gray-600">
        <label className="flex items-center gap-1.5">X <input type="number" min={0} max={100} step={0.5} value={pos ? pos[0] : ""} onChange={(e) => setAxis(0, e.target.value)} className={INPUT} /></label>
        <label className="flex items-center gap-1.5">Y <input type="number" min={0} max={100} step={0.5} value={pos ? pos[1] : ""} onChange={(e) => setAxis(1, e.target.value)} className={INPUT} /></label>
        {value && (
          <button type="button" onClick={() => onChange(null)} className="text-xs font-semibold text-red-500 hover:underline">
            {fallback ? "Về vị trí mặc định" : "Gỡ khỏi bản đồ"}
          </button>
        )}
      </div>
      <div className="rounded-xl bg-forest-50 px-4 py-3 text-[13px] leading-relaxed text-forest-800">
        {value
          ? "Đang dùng vị trí tự khai."
          : fallback
            ? "Đang dùng vị trí mặc định của điểm này (chấm viền nét đứt). Bấm vào sơ đồ nếu muốn đổi."
            : "Điểm này chưa có vị trí nên chưa hiện nhãn trên bản đồ hoạt hình — bấm vào sơ đồ để đặt."}{" "}
        X tính từ trái sang, Y từ trên xuống (0–100). Đây là vị trí tương đối để vẽ bản đồ, không phải toạ độ GPS; cung đường tự nối điểm vào đoạn đường gần nhất.
      </div>
    </div>
  );
}

function Dot({ pos, label, tone }: { pos: [number, number]; label: string; tone: "fixed" | "other" | "me" | "default" }) {
  const me = tone === "me" || tone === "default";
  return (
    <div className="pointer-events-none absolute" style={{ left: `${pos[0]}%`, top: `${pos[1]}%`, zIndex: me ? 2 : 1 }}>
      <span
        className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white"
        style={{
          width: me ? 16 : 10,
          height: me ? 16 : 10,
          background: tone === "fixed" ? "oklch(0.29 0.055 160)" : me ? "oklch(0.68 0.18 45)" : "oklch(0.5 0.07 160)",
          outline: tone === "default" ? "2px dashed oklch(0.68 0.18 45)" : undefined,
          outlineOffset: 2,
        }}
      />
      <span
        className="absolute left-0 top-2.5 -translate-x-1/2 whitespace-nowrap rounded-full px-1.5 py-px text-[10px] font-bold"
        style={{ background: me ? "oklch(0.68 0.18 45)" : "oklch(1 0 0 / .85)", color: me ? "white" : "oklch(0.25 0.03 160)" }}
      >
        {label}
      </span>
    </div>
  );
}
