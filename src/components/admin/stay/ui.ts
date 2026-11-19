import type { CSSProperties } from "react";
import { dmy, wdDmy } from "@/lib/date-format";
import type { HkStatus, StayStatus } from "@/lib/stay-core";

/** Bảng màu & nhãn của màn Quản lý phòng (theo mẫu claude.ai/design "Admin Quan ly Phong"). */
export const G = "oklch(0.29 0.055 160)";
export const O = "oklch(0.68 0.18 45)";
export const DIM = "oklch(0.5 0.02 160)";
export const INK = "oklch(0.25 0.03 160)";
export const BORDER = "oklch(0.92 0.008 160)";
export const RED = "oklch(0.55 0.19 28)";

export const M = (n: number) => (n < 0 ? "−" : "") + Math.abs(Math.round(n)).toLocaleString("vi-VN") + "đ";
export const short = (n: number) => (Math.abs(n) >= 1e6 ? (n / 1e6).toFixed(1).replace(".", ",") + "tr" : Math.round(n / 1000) + "k");
export const D = (k: string) => dmy(k);
export const WD = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
export const WDL = ["Chủ nhật", "Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy"];
export const wd = (k: string) => wdDmy(k);
export const digits = (s: string) => +String(s || "").replace(/\D/g, "") || 0;
export const lastWord = (s: string) => s.split(" (")[0].trim().split(/\s+/).pop() ?? s;

/** [nhãn, nền, viền, chữ, kiểu viền] */
export const ST: Record<StayStatus, [string, string, string, string, string]> = {
  hold: ["Giữ chỗ · chưa cọc", "oklch(0.96 0.05 75)", "oklch(0.72 0.13 60)", "oklch(0.45 0.12 55)", "dashed"],
  deposit: ["Đã cọc", "oklch(0.6 0.12 250)", "oklch(0.6 0.12 250)", "white", "solid"],
  arriving: ["Đến hôm nay", O, O, "white", "solid"],
  inhouse: ["Đang ở", "oklch(0.45 0.1 158)", "oklch(0.45 0.1 158)", "white", "solid"],
  dueout: ["Trả phòng hôm nay", "oklch(0.55 0.13 300)", "oklch(0.55 0.13 300)", "white", "solid"],
  overdue: ["Quá giờ trả", "oklch(0.58 0.19 28)", "oklch(0.58 0.19 28)", "white", "solid"],
  out: ["Đã trả", "oklch(0.9 0.005 160)", "oklch(0.86 0.005 160)", "oklch(0.45 0.01 160)", "solid"],
  web: ["Đơn web chờ xác nhận", "white", O, "oklch(0.5 0.15 45)", "dashed"],
  cancel: ["Đã huỷ", "oklch(0.96 0.005 160)", "oklch(0.9 0.005 160)", DIM, "solid"],
  noshow: ["Không đến", "oklch(0.96 0.02 28)", "oklch(0.9 0.04 28)", "oklch(0.5 0.15 28)", "solid"],
  reject: ["Đã từ chối", "oklch(0.96 0.005 160)", "oklch(0.9 0.005 160)", DIM, "solid"],
};

/** [nhãn, chấm, nền, chữ] */
export const HK: Record<HkStatus, [string, string, string, string]> = {
  clean: ["Sạch", "oklch(0.55 0.12 155)", "oklch(0.94 0.05 155)", "oklch(0.36 0.1 155)"],
  dirty: ["Chưa dọn", "oklch(0.58 0.19 28)", "oklch(0.96 0.03 28)", "oklch(0.5 0.17 28)"],
  cleaning: ["Đang dọn", "oklch(0.7 0.15 60)", "oklch(0.96 0.05 75)", "oklch(0.48 0.14 55)"],
  maint: ["Bảo trì", "oklch(0.45 0.02 160)", "oklch(0.93 0.005 160)", "oklch(0.35 0.02 160)"],
};

export const HATCH = "repeating-linear-gradient(45deg, oklch(0.9 0.005 160) 0 6px, oklch(0.96 0.003 160) 6px 12px)";

export const card: CSSProperties = { background: "white", border: `1px solid ${BORDER}`, borderRadius: 20, padding: 16, display: "flex", flexDirection: "column", gap: 10 };
export const input: CSSProperties = { fontSize: 15, padding: "10px 12px", borderRadius: 12, border: "1.5px solid oklch(0.88 0.015 160)", minWidth: 0, fontFamily: "inherit", background: "white" };
export const lbl: CSSProperties = { display: "flex", flexDirection: "column", gap: 5, fontSize: 13, fontWeight: 700 };
export const chip = (on: boolean): CSSProperties => ({ cursor: "pointer", fontSize: 13, fontWeight: 700, padding: "7px 12px", borderRadius: 999, background: on ? G : "oklch(0.95 0.006 160)", color: on ? "white" : "oklch(0.3 0.03 160)" });
export const seg = (on: boolean): CSSProperties => ({ cursor: "pointer", fontSize: 13, fontWeight: 800, padding: "7px 12px", borderRadius: 9, background: on ? "white" : "transparent", color: on ? G : "oklch(0.42 0.02 160)", boxShadow: on ? "0 1px 3px oklch(0.2 0.03 160 / .15)" : "none", whiteSpace: "nowrap" });
export const kicker: CSSProperties = { fontSize: 12, fontWeight: 800, color: "oklch(0.5 0.08 158)" };

/** Chép chữ vào clipboard (có dự phòng cho trình duyệt cũ / http). */
export async function copyText(t: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(t);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = t;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}
