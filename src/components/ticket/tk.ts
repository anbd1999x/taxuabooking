import type { CSSProperties } from "react";
import type { VenueKind } from "@/lib/ticket-core";

/** Màu & kiểu dùng chung của trang Vé & đặt bàn phía khách — theo mẫu claude.ai/design "Ban ve - Khach". */
export const G = "oklch(0.29 0.055 160)";
export const O = "oklch(0.68 0.18 45)";
export const DIM = "oklch(0.5 0.02 160)";
export const LINE = "oklch(0.92 0.01 160)";
export const PRICE = "oklch(0.6 0.18 42)";
export const SOFT = "oklch(0.975 0.012 155)";

/** [nhãn (khoá dịch), nền, chữ] */
export const TYPE: Record<VenueKind, [string, string, string]> = {
  GATE: ["Vé vào cổng", "oklch(0.94 0.05 155)", "oklch(0.36 0.1 155)"],
  SHOW: ["Show ca nhạc", "oklch(0.94 0.04 300)", "oklch(0.42 0.12 300)"],
  RESTAURANT: ["Đặt bàn", "oklch(0.95 0.06 70)", "oklch(0.48 0.14 55)"],
};
export const ZONE_BG = ["oklch(0.975 0.012 155)", "oklch(0.97 0.03 70)", "oklch(0.965 0.02 230)", "oklch(0.965 0.02 300)", "oklch(0.965 0.015 250)", "oklch(0.97 0.02 20)"];

export const money = (n: number) => n.toLocaleString("vi-VN") + "đ";
export const dm = (k: string) => `${k.slice(8, 10)}/${k.slice(5, 7)}`;
export const WD = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
export const wdOf = (k: string) => WD[new Date(`${k}T00:00:00Z`).getUTCDay()];
export const mmss = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

export const section: CSSProperties = { background: "white", border: `1px solid ${LINE}`, borderRadius: 22, padding: "clamp(14px,2vw,22px)", display: "flex", flexDirection: "column", gap: 16, animation: "tkRise .3s ease both" };
export const h2: CSSProperties = { fontSize: 18, fontWeight: 800 };
export const hint: CSSProperties = { fontSize: 13, color: DIM };
/** Ảnh bìa chưa có ⇒ nền sọc nhạt kèm tên. */
export const placeholder: CSSProperties = {
  width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 12, fontSize: 13, fontWeight: 700, color: "oklch(0.55 0.03 160)",
  background: "repeating-linear-gradient(-45deg, oklch(0.95 0.02 160) 0 10px, oklch(0.975 0.01 160) 10px 20px)",
};
export const KEYFRAMES = "@keyframes tkRise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}@keyframes tkPulse{0%,100%{opacity:1}50%{opacity:.55}}";
