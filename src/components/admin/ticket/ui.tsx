"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { TkData, TkOrder, TkVenueRef } from "@/lib/ticket-core";

/** Dùng chung cho giao diện Vé & đặt bàn (màu, kiểu, thành phần nhỏ) — theo mẫu "Ban ve - Quan tri". */

export const G = "oklch(0.29 0.055 160)";
export const O = "oklch(0.68 0.18 45)";
export const BORDER = "oklch(0.92 0.008 160)";
export const MUTED = "oklch(0.48 0.02 160)";
export const RED = "oklch(0.5 0.17 28)";
export const SOFT = "oklch(0.95 0.006 160)";
export const WD = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

export const money = (n: number) => n.toLocaleString("vi-VN") + "đ";
export const short = (n: number) => (n >= 1e6 ? (n / 1e6).toFixed(1).replace(".", ",").replace(",0", "") + "tr" : n >= 1000 ? Math.round(n / 1000) + "k" : String(n));
export const dm = (k: string) => `${k.slice(8, 10)}/${k.slice(5, 7)}`;
export const dmy = (k: string) => `${k.slice(8, 10)}/${k.slice(5, 7)}/${k.slice(0, 4)}`;
export const wdOf = (k: string) => WD[new Date(`${k}T00:00:00Z`).getUTCDay()];
export const lastName = (n: string) => n.trim().split(/\s+/).slice(-2).join(" ");

export const card: CSSProperties = { background: "white", border: `1px solid ${BORDER}`, borderRadius: 20, padding: 16, display: "flex", flexDirection: "column", gap: 12, minWidth: 0 };
export const inputCls: CSSProperties = { fontSize: 15, fontWeight: 600, padding: "10px 12px", borderRadius: 12, border: "1.5px solid oklch(0.88 0.015 160)", background: "white", color: "oklch(0.22 0.03 160)", width: "100%", minWidth: 0, fontFamily: "inherit" };
export const lbl: CSSProperties = { display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontWeight: 700, color: MUTED, minWidth: 0 };
export const h1: CSSProperties = { margin: 0, fontSize: "clamp(22px,2.6vw,28px)", fontWeight: 800, letterSpacing: "-.02em" };
export const sub: CSSProperties = { fontSize: 14, color: MUTED, marginTop: 4 };

/** Ngữ cảnh chung của các tab. `call` gọi POST /api/admin/ticket rồi thay toàn bộ dữ liệu. */
export interface Ctx {
  data: TkData;
  venues: TkVenueRef[];
  busy: boolean;
  isAdmin: boolean;
  call: (op: string, payload?: Record<string, unknown>, opts?: { quiet?: boolean }) => Promise<(TkData & { message?: string; orderId?: string }) | null>;
  pickVenue: (id: string) => void;
}

export function useWidth(): number {
  const [w, setW] = useState(1400);
  useEffect(() => {
    const on = () => setW(window.innerWidth);
    on();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  return w;
}

/** Đồng hồ 1 giây (đếm ngược giữ chỗ). */
export function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);
  return now;
}

/** "mm:ss" còn lại (âm ⇒ 00:00). */
export const mmssLeft = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

/** Đơn chờ có hạn giữ chỗ: "Tự huỷ sau mm:ss" (đỏ khi còn dưới 5 phút). */
export function HoldLeft({ until, now }: { until: number | null; now: number }) {
  if (!until) return null;
  const left = until - now;
  return (
    <span style={{ fontSize: 12, fontWeight: 800, whiteSpace: "nowrap", color: left < 300_000 ? "oklch(0.55 0.17 28)" : "oklch(0.5 0.14 55)" }}>
      {left > 0 ? `Tự huỷ sau ${mmssLeft(left)}` : "Hết hạn · đang nhả chỗ"}
    </span>
  );
}

/** Có đơn chờ vừa quá hạn giữ chỗ ⇒ nạp lại (server tự huỷ + nhả chỗ), tối đa 15 giây một lần. */
export function useExpiryReload(ctx: Ctx, now: number) {
  const last = useRef(0);
  const due = ctx.data.orders.some((o) => (o.status === "wait" || o.status === "draft") && o.holdUntil && o.holdUntil < now);
  const { call } = ctx;
  useEffect(() => {
    if (due && now - last.current > 15_000) {
      last.current = now;
      void call("reload", {}, { quiet: true });
    }
  }, [due, now, call]);
}

export function Stat({ k, v, c }: { k: string; v: ReactNode; c: string }) {
  return (
    <div style={{ padding: "12px 16px", borderRadius: 16, background: "white", border: `1px solid ${BORDER}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: "oklch(0.45 0.02 160)" }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: c }} />
        {k}
      </div>
      <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-.02em", marginTop: 2 }}>{v}</div>
    </div>
  );
}
export const statGrid: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,150px),1fr))", gap: 10 };

/** Thanh chọn dạng viên (tab, địa điểm, phương thức thu). */
export function Seg<T extends string>({ items, value, onPick, dark, grow }: { items: [T, string][]; value: T; onPick: (k: T) => void; dark?: boolean; grow?: boolean }) {
  return (
    <div style={{ display: "flex", gap: 4, padding: dark ? 3 : 4, borderRadius: dark ? 12 : 14, background: SOFT, overflowX: "auto", maxWidth: "100%" }}>
      {items.map(([k, name]) => {
        const on = k === value;
        return (
          <div
            key={k}
            onClick={() => onPick(k)}
            style={{
              cursor: "pointer", flex: grow ? 1 : "none", textAlign: "center", fontSize: dark ? 13 : 14, fontWeight: 800, padding: dark ? "7px 12px" : "9px 14px", borderRadius: dark ? 9 : 11, whiteSpace: "nowrap",
              background: on ? (dark ? G : "white") : "transparent", color: on ? (dark ? "white" : G) : "oklch(0.38 0.02 160)", boxShadow: on && !dark ? "0 1px 4px oklch(0.2 0.03 160 / .15)" : "none",
            }}
          >
            {name}
          </div>
        );
      })}
    </div>
  );
}

export function Stepper({ value, onDec, onInc, wide }: { value: ReactNode; onDec: () => void; onInc: () => void; wide?: boolean }) {
  const b: CSSProperties = { cursor: "pointer", width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, border: "none", fontFamily: "inherit", fontSize: 16 };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, padding: 3, borderRadius: 999, background: SOFT, flex: "none" }}>
      <button type="button" onClick={onDec} style={{ ...b, background: "white", color: "inherit" }} aria-label="Giảm">−</button>
      <span style={{ minWidth: wide ? 84 : 26, textAlign: "center", fontWeight: 800 }}>{value}</span>
      <button type="button" onClick={onInc} style={{ ...b, background: G, color: "white" }} aria-label="Tăng">+</button>
    </div>
  );
}

export function Badge({ bg, fg, children, big }: { bg: string; fg: string; children: ReactNode; big?: boolean }) {
  return <span style={{ fontSize: big ? 12 : 11, fontWeight: 800, padding: big ? "4px 10px" : "3px 8px", borderRadius: 999, background: bg, color: fg, whiteSpace: "nowrap" }}>{children}</span>;
}

/** Nút viên: pri (xanh đậm) · orange · warn (chữ đỏ) · mặc định viền. */
export function Act({ kind, onClick, children, disabled, block }: { kind?: "pri" | "orange" | "warn"; onClick?: () => void; children: ReactNode; disabled?: boolean; block?: boolean }) {
  const fill = kind === "pri" ? G : kind === "orange" ? O : "white";
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{
        cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.55 : 1, fontFamily: "inherit", fontSize: block ? 15 : 13, fontWeight: 800, padding: block ? 13 : "9px 14px", borderRadius: 999, whiteSpace: "nowrap",
        width: block ? "100%" : undefined, background: fill, color: kind === "pri" || kind === "orange" ? "white" : kind === "warn" ? RED : "oklch(0.25 0.03 160)",
        border: `1.5px solid ${kind === "pri" || kind === "orange" ? fill : "oklch(0.88 0.015 160)"}`,
      }}
    >
      {children}
    </button>
  );
}

export function KV({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 14 }}>
      <span style={{ color: "oklch(0.5 0.02 160)" }}>{k}</span>
      <b style={{ textAlign: "right", minWidth: 0, overflowWrap: "anywhere" }}>{v}</b>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div style={{ padding: "36px 20px", textAlign: "center", border: "1.5px dashed oklch(0.86 0.02 160)", borderRadius: 20, background: "white", fontSize: 15, color: MUTED, lineHeight: 1.6 }}>{children}</div>;
}

export function Head({ title, note, right }: { title: string; note: string; right?: ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
      <div style={{ minWidth: 0 }}>
        <h1 style={h1}>{title}</h1>
        <div style={sub}>{note}</div>
      </div>
      {right}
    </div>
  );
}

/** Thanh chọn địa điểm cùng loại (ẩn khi chỉ có một). */
export function VenuePick({ ctx }: { ctx: Ctx }) {
  const same = ctx.venues.filter((v) => v.kind === ctx.data.venue.kind);
  if (same.length < 2) return null;
  return <Seg items={same.map((v) => [v.id, v.name] as [string, string])} value={ctx.data.venue.id} onPick={ctx.pickVenue} />;
}

// ----------------------------- Vé điện tử: link + in -----------------------------
export const ticketUrl = (o: Pick<TkOrder, "token">) => `${window.location.origin}/ve/don/${o.token}`;

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);

/** Mở cửa sổ in một đoạn HTML (danh sách khách, phiếu bếp, vé). */
export function printHtml(title: string, body: string) {
  const w = window.open("", "_blank", "width=820,height=900");
  if (!w) return false;
  w.document.write(
    `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${esc(title)}</title><style>
body{font-family:'Be Vietnam Pro',system-ui,sans-serif;color:#16241d;margin:24px}h1{font-size:20px;margin:0 0 4px}p{margin:0 0 14px;color:#5b6660;font-size:13px}
table{border-collapse:collapse;width:100%;font-size:13px}th,td{border:1px solid #cfd8d3;padding:6px 8px;text-align:left;vertical-align:top}th{background:#f0f5f2}
.tk{display:inline-flex;gap:12px;align-items:center;border:1.5px dashed #9aa8a1;border-radius:14px;padding:10px 14px;margin:0 10px 10px 0;page-break-inside:avoid}
.tk b{display:block;font-size:15px}.tk small{display:block;color:#5b6660;font-size:12px}.tk code{font-size:12px}
.blk{border:1px solid #cfd8d3;border-radius:10px;padding:10px 12px;margin-bottom:10px;page-break-inside:avoid}.blk h2{font-size:16px;margin:0 0 6px}
@media print{body{margin:8mm}}
</style></head><body>${body}<script>window.onload=function(){setTimeout(function(){window.print()},250)}<\/script></body></html>`,
  );
  w.document.close();
  return true;
}
export const h = esc;

/** In vé (có mã QR) của một đơn — dùng cho bán tại cổng / tại quầy. */
export async function printTickets(o: TkOrder, venueName: string, when: string) {
  const QR = (await import("qrcode")).default;
  const parts = await Promise.all(
    o.tickets.map(async (t) => {
      const src = await QR.toDataURL(t.token, { margin: 1, width: 150 });
      return `<div class="tk"><img src="${src}" width="110" height="110" alt=""><div><small>${esc(venueName)}</small><b>${esc(t.label)}</b><small>${esc(when)}</small><code>${esc(t.code)}</code></div></div>`;
    }),
  );
  return printHtml(`Vé ${o.code}`, `<h1>${esc(venueName)}</h1><p>Đơn ${esc(o.code)} · ${esc(when)} · ${o.tickets.length} mã</p>${parts.join("")}`);
}
