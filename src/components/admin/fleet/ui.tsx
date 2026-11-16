"use client";

import type { CSSProperties, ReactNode } from "react";
import type { FleetCond, FleetConfig, FleetKind, FleetRentalVM, FleetStatus, FleetVehicleVM } from "@/lib/fleet-core";

/** Dùng chung cho giao diện quản lý xe (màu, kiểu, định dạng) — theo mẫu "Admin Quan ly Xe may v2". */

export const G = "oklch(0.29 0.055 160)";
export const O = "oklch(0.68 0.18 45)";
export const BORDER = "oklch(0.92 0.008 160)";
export const MUTED = "oklch(0.5 0.02 160)";
export const RED = "oklch(0.55 0.19 28)";

export const TYC: Record<FleetKind, string> = { so: "oklch(0.6 0.12 155)", ga: "oklch(0.6 0.13 250)", con: "oklch(0.66 0.16 45)" };
/** [nhãn, nền, chữ, viền/chấm] */
export const ST: Record<FleetStatus, [string, string, string, string]> = {
  ready: ["Rảnh", "oklch(0.96 0.035 155)", "oklch(0.36 0.1 155)", "oklch(0.62 0.12 155)"],
  renting: ["Đang thuê", "oklch(0.58 0.13 250)", "white", "oklch(0.58 0.13 250)"],
  deposit: ["Đã cọc", "oklch(0.8 0.13 75)", "oklch(0.3 0.06 60)", "oklch(0.72 0.15 65)"],
  hold: ["Giữ chỗ · chưa cọc", "oklch(0.95 0.03 280)", "oklch(0.42 0.1 280)", "oklch(0.62 0.1 280)"],
  done: ["Đã trả xe", "oklch(0.93 0.005 160)", "oklch(0.45 0.02 160)", "oklch(0.75 0.01 160)"],
  maint: ["Bảo dưỡng", "oklch(0.95 0.035 28)", "oklch(0.5 0.16 28)", "oklch(0.6 0.16 28)"],
  off: ["Ngừng cho thuê", "oklch(0.93 0 0)", "oklch(0.42 0 0)", "oklch(0.55 0 0)"],
  web: ["Đơn web · chờ duyệt", "oklch(0.95 0.04 300)", "oklch(0.42 0.13 300)", "oklch(0.6 0.15 300)"],
  due: ["Chờ giao hôm nay", "oklch(0.94 0.05 210)", "oklch(0.38 0.09 215)", "oklch(0.6 0.1 215)"],
  late: ["Quá hạn trả", "oklch(0.6 0.19 28)", "white", "oklch(0.55 0.2 28)"],
  cancel: ["Đã huỷ", "oklch(0.96 0.02 28)", "oklch(0.5 0.16 28)", "oklch(0.6 0.16 28)"],
};
export const COND: Record<FleetCond, [string, string, string]> = {
  good: ["Tốt", "oklch(0.95 0.04 155)", "oklch(0.38 0.1 155)"],
  ok: ["Bình thường", "oklch(0.96 0.04 85)", "oklch(0.45 0.1 70)"],
  service: ["Cần bảo dưỡng", "oklch(0.95 0.035 28)", "oklch(0.5 0.16 28)"],
};
export const WD = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
export const WDL = ["Chủ nhật", "Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy"];

export const money = (n: number) => n.toLocaleString("vi-VN") + "đ";
export const short = (n: number) => {
  const a = Math.abs(n), sg = n < 0 ? "−" : "";
  return sg + (a >= 1e6 ? (a / 1e6).toFixed(1).replace(".", ",").replace(",0", "") + "tr" : Math.round(a / 1000) + "k");
};
export const dm = (k: string) => `${k.slice(8, 10)}/${k.slice(5, 7)}`;
export const dmy = (k: string) => `${k.slice(8, 10)}/${k.slice(5, 7)}/${k.slice(0, 4)}`;
export const at2 = (a: string) => (a ? dm(a.slice(0, 10)) + " " + a.slice(11, 16) : "");
export const mask = (c: string) => (c.length >= 8 ? c.slice(0, 4) + "••••" + c.slice(-4) : c || "—");
export const ym = (y: number, m: number) => `${y}-${String(m + 1).padStart(2, "0")}`;
export const daysIn = (y: number, m: number) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
export const lastName = (n: string) => n.trim().split(/\s+/).pop() ?? n;
export const ini = (n: string) => n.trim().split(/\s+/).map((x) => x[0]).slice(-2).join("").toUpperCase();
export const digits = (s: string) => parseInt(String(s ?? "").replace(/\D/g, ""), 10) || 0;

export const card: CSSProperties = { background: "white", border: `1px solid ${BORDER}`, borderRadius: 16 };
export const inputCls: CSSProperties = { fontSize: 15, fontWeight: 600, padding: "10px 12px", borderRadius: 11, border: "1.5px solid oklch(0.9 0.01 160)", background: "white", color: "oklch(0.22 0.03 160)", width: "100%", minWidth: 0, fontFamily: "inherit" };
export const lbl: CSSProperties = { display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontWeight: 700, color: MUTED, minWidth: 0 };

export const pill = (on: boolean, act = G): CSSProperties => ({
  cursor: "pointer", fontSize: 13, fontWeight: 700, padding: "8px 12px", borderRadius: 999, whiteSpace: "nowrap",
  background: on ? act : "white", color: on ? "white" : "oklch(0.32 0.02 160)", border: `1.5px solid ${on ? act : "oklch(0.9 0.01 160)"}`,
});
export const softPill = (on: boolean): CSSProperties => ({
  cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, padding: "8px 12px", borderRadius: 999,
  whiteSpace: "nowrap", background: on ? "oklch(0.96 0.02 155)" : "white", color: "oklch(0.25 0.03 160)", border: `1.5px solid ${on ? G : "oklch(0.9 0.01 160)"}`,
});
export const btn = (kind: "pri" | "orange" | "danger" | "ghost" = "ghost"): CSSProperties => ({
  cursor: "pointer", fontSize: 13, fontWeight: 800, padding: "9px 14px", borderRadius: 999, whiteSpace: "nowrap", fontFamily: "inherit",
  background: kind === "pri" ? G : kind === "orange" ? O : "white",
  color: kind === "pri" || kind === "orange" ? "white" : kind === "danger" ? "oklch(0.52 0.18 28)" : "oklch(0.25 0.03 160)",
  border: `1.5px solid ${kind === "pri" ? G : kind === "orange" ? O : kind === "danger" ? "oklch(0.88 0.05 28)" : "oklch(0.9 0.01 160)"}`,
});

export function Thumb({ url, label, style }: { url: string | null | undefined; label?: string; style?: CSSProperties }) {
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={label ?? ""} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", ...style }} />
  ) : (
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "repeating-linear-gradient(-45deg, oklch(0.96 0.01 160) 0 8px, oklch(0.985 0.004 160) 8px 16px)", color: "oklch(0.6 0.02 160)", fontSize: 12, fontWeight: 700, textAlign: "center", padding: 6, ...style }}>
      {label ?? "🏍"}
    </div>
  );
}

export function StatCard({ k, v, sub, c, onClick }: { k: string; v: ReactNode; sub: string; c: string; onClick?: () => void }) {
  return (
    <div onClick={onClick} style={{ cursor: onClick ? "pointer" : "default", padding: "12px 16px", borderRadius: 16, background: "white", border: `1px solid ${BORDER}`, animation: "fleetUp .35s ease both" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: "oklch(0.45 0.02 160)" }}><span style={{ width: 9, height: 9, borderRadius: "50%", background: c }} />{k}</div>
      <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-.02em", marginTop: 2 }}>{v}</div>
      <div style={{ fontSize: 12, fontWeight: 600, color: "oklch(0.52 0.02 160)" }}>{sub}</div>
    </div>
  );
}

export function MiniStat({ k, v, sub, c }: { k: string; v: ReactNode; sub: string; c: string }) {
  return (
    <div style={{ padding: "12px 16px", borderRadius: 16, background: "white", border: `1px solid ${BORDER}` }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "oklch(0.45 0.02 160)" }}>{k}</div>
      <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-.02em", marginTop: 2, color: c }}>{v}</div>
      <div style={{ fontSize: 12, color: "oklch(0.52 0.02 160)" }}>{sub}</div>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div style={{ padding: "40px 20px", textAlign: "center", border: "1.5px dashed oklch(0.86 0.02 160)", borderRadius: 20, background: "white", fontSize: 15, color: MUTED }}>{children}</div>;
}

export function Toggle({ on, onClick, color = G, children }: { on: boolean; onClick: () => void; color?: string; children: ReactNode }) {
  return (
    <div onClick={onClick} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 10, fontSize: 14, fontWeight: 700 }}>
      <span style={{ width: 40, height: 24, borderRadius: 999, background: on ? color : "oklch(0.85 0.01 160)", position: "relative", transition: "background .2s", flex: "none" }}>
        <span style={{ position: "absolute", top: 3, left: on ? 19 : 3, width: 18, height: 18, borderRadius: "50%", background: "white", transition: "left .2s" }} />
      </span>
      {children}
    </div>
  );
}

export type PendingBooking = { id: string; code: string; name: string; phone: string; s: string; e: string; qty: number; label: string; assigned: number };
export type FleetData = {
  vehicles: FleetVehicleVM[];
  rentals: FleetRentalVM[];
  pending: PendingBooking[];
  config: FleetConfig;
  today: string;
  now: string;
};
export type CallFn = (payload: Record<string, unknown>) => Promise<(FleetData & { savedId?: string; message?: string }) | null>;
