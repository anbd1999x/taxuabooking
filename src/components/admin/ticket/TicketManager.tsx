"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { REVIEW_LABEL, VENUE_KINDS, type TkData, type TkVenueRef, type VenueKind } from "@/lib/ticket-core";
import { showToast } from "@/components/admin/Toast";
import { usePublishTabs } from "@/components/admin/module-tabs";
import { BuildTab } from "./BuildTab";
import { DineTab } from "./DineTab";
import { GateTab } from "./GateTab";
import { RestTab } from "./RestTab";
import { Scanner } from "./Scanner";
import { SetupTab } from "./SetupTab";
import { ShowTab } from "./ShowTab";
import { Empty, MUTED, type Ctx } from "./ui";

/**
 * Vé & đặt bàn — theo mẫu claude.ai/design "Ban ve - Quan tri" (project 4ec052fe…).
 * Tabs: Vé cổng · Show · Nhà hàng (đặt bàn) · Gọi món QR (order tại bàn, `DineTab`) · Dựng sơ đồ · Soát vé · Thiết lập. Mỗi tab làm việc trên MỘT địa điểm cùng loại
 * (đổi địa điểm bằng thanh chọn ở đầu tab). Mọi thao tác gọi POST /api/admin/ticket và thay toàn bộ dữ liệu.
 */
export type Tab = "gate" | "live" | "rest" | "qr" | "build" | "scan" | "setup";
const TAB_KIND: Partial<Record<Tab, VenueKind>> = { gate: "GATE", live: "SHOW", rest: "RESTAURANT", qr: "RESTAURANT", build: "SHOW" };
const TABS: [Tab, string][] = [["gate", "Vé cổng"], ["live", "Show"], ["rest", "Nhà hàng"], ["qr", "Gọi món QR"], ["build", "Dựng sơ đồ"], ["scan", "Soát vé"], ["setup", "Thiết lập"]];

export function TicketManager({
  venues, initial, initialTab, providers, places, isAdmin, who, scanStats, only,
}: {
  venues: TkVenueRef[];
  initial: TkData | null;
  initialTab: Tab;
  providers: { id: string; name: string }[];
  places: { id: string; name: string; kind: string }[];
  isAdmin: boolean;
  who: string;
  scanStats: { checked: number; total: number };
  /** Chỉ hiện các tab này (trang bản demo /demo/ve, /demo/goi-mon). */
  only?: Tab[];
}) {
  const [data, setData] = useState<TkData | null>(initial);
  const [tab, setTab] = useState<Tab>(initialTab);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  /** Địa điểm mở gần nhất của từng loại — đổi tab quay lại đúng địa điểm đó. */
  const [lastByKind, setLastByKind] = useState<Partial<Record<VenueKind, string>>>(initial ? { [initial.venue.kind]: initial.venue.id } : {});
  const [loading, setLoading] = useState(false);

  const post = useCallback(async (venueId: string, op: string, payload: Record<string, unknown> = {}, quiet = false) => {
    if (op !== "reload") setBusy(true);
    try {
      const r = await fetch("/api/admin/ticket", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...payload, venueId, op }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        if (op !== "reload") showToast(j.error ?? "Có lỗi, thử lại.", "error");
        return null;
      }
      if (j.venue) {
        const d = j as TkData;
        setData(d);
        setLastByKind((m) => (m[d.venue.kind] === d.venue.id ? m : { ...m, [d.venue.kind]: d.venue.id }));
      }
      if (j.message && !quiet) showToast(j.message);
      return j as TkData & { message?: string; orderId?: string };
    } catch {
      if (op !== "reload") showToast("Mất kết nối, thử lại.", "error");
      return null;
    } finally {
      if (op !== "reload") setBusy(false);
    }
  }, []);

  const venueId = data?.venue.id;
  const call = useCallback<Ctx["call"]>((op, payload, opts) => (venueId ? post(venueId, op, payload, opts?.quiet) : Promise.resolve(null)), [post, venueId]);
  const pickVenue = useCallback((id: string) => void post(id, "reload"), [post]);

  // Địa điểm đang mở phải cùng loại với tab; khác loại ⇒ nạp địa điểm gần nhất của loại đó.
  const kind = TAB_KIND[tab];
  const pickTab = async (t: Tab) => {
    setTab(t);
    const k = TAB_KIND[t];
    const id = k && data?.venue.kind !== k ? (lastByKind[k] ?? venues.find((v) => v.kind === k)?.id) : undefined;
    if (!id) return;
    setLoading(true);
    await post(id, "reload");
    setLoading(false);
  };

  useEffect(() => {
    const u = new URL(window.location.href);
    u.searchParams.set("tab", tab);
    if (data && tab !== "scan") u.searchParams.set("venue", data.venue.id);
    window.history.replaceState(null, "", u);
  }, [tab, data]);

  // "Cập nhật trực tiếp": 20 giây nạp lại một lần khi đang mở tab vận hành.
  useEffect(() => {
    if ((tab !== "gate" && tab !== "live" && tab !== "rest") || busy || !venueId) return;
    const iv = setInterval(() => {
      if (!document.hidden) void post(venueId, "reload");
    }, 20_000);
    return () => clearInterval(iv);
  }, [tab, post, venueId, busy]);

  const pending = venues.filter((v) => v.review === "pending");
  const tabs = TABS.filter(([k]) => (!only || only.includes(k)) && (isAdmin || k === "scan" || k === "setup" || venues.some((v) => v.kind === TAB_KIND[k])));
  // Tab hiện thành MỤC CON ở menu trái (không còn thanh tab cuộn ngang).
  usePublishTabs(tabs.map(([key, label]) => ({ key, label })), tab, (k) => void pickTab(k as Tab));
  const ctx: Ctx | null = data ? { data, venues, busy, isAdmin, call, pickVenue } : null;
  const ready = ctx && (!kind || ctx.data.venue.kind === kind) ? ctx : null;
  const reloadTo = (id: string) => router.push(`/admin/provider/ve?tab=setup&venue=${id}`);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, color: "oklch(0.22 0.03 160)" }}>
      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        {tab === "setup" && venues.length > 1 && data && (
          <select value={data.venue.id} onChange={(e) => pickVenue(e.target.value)} style={{ fontSize: 14, fontWeight: 700, padding: "9px 12px", borderRadius: 12, border: "1.5px solid oklch(0.88 0.015 160)", background: "white", fontFamily: "inherit", maxWidth: "100%" }}>
            {venues.map((v) => <option key={v.id} value={v.id}>{VENUE_KINDS[v.kind]} · {v.name}{v.review !== "approved" ? ` (${REVIEW_LABEL[v.review]})` : ""}</option>)}
          </select>
        )}
      </div>

      {isAdmin && !only && pending.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "12px 14px", borderRadius: 16, background: "oklch(0.96 0.05 85)", border: "1px solid oklch(0.88 0.08 85)" }}>
          <b style={{ fontSize: 14 }}>{pending.length} địa điểm đối tác gửi duyệt:</b>
          {pending.map((v) => (
            <span key={v.id} onClick={() => { setTab("setup"); pickVenue(v.id); }} style={{ cursor: "pointer", fontSize: 13, fontWeight: 800, padding: "6px 12px", borderRadius: 999, background: "white", color: "oklch(0.45 0.12 70)" }}>
              {VENUE_KINDS[v.kind]} · {v.name} →
            </span>
          ))}
        </div>
      )}

      {tab === "setup" ? (
        <SetupTab ctx={ctx} providers={providers} places={places} onCreated={reloadTo} />
      ) : tab === "scan" ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 28, alignItems: "flex-start", justifyContent: "center" }}>
          <Scanner venues={venues} who={who} initial={scanStats} />
          <div style={{ maxWidth: 380, display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontSize: 20, fontWeight: 800 }}>Soát vé bằng điện thoại</div>
            <div style={{ fontSize: 14, lineHeight: 1.6, color: MUTED }}>
              Nhân viên mở trang <b>/admin/provider/soat-ve</b> trên điện thoại (tài khoản nhân viên chỉ vào được trang này). Mỗi vé một mã, đơn 4 người có 4 mã.
            </div>
            {([["oklch(0.55 0.13 155)", "Hợp lệ · mời vào", "vé đúng ngày, chưa dùng — hệ thống ghi giờ vào và người soát"], ["oklch(0.7 0.15 60)", "Vé đã dùng", "hiện giờ quét trước và người đã quét"], ["oklch(0.6 0.19 28)", "Sai suất / sai ngày", "vé của ngày khác, địa điểm khác, đơn chưa thu tiền hoặc đã huỷ"], ["oklch(0.55 0.13 250)", "Voucher đồ ăn uống", "bấm vào kết quả để đánh dấu đã giao"]] as const).map(([c, name, note]) => (
              <div key={name} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 14px", borderRadius: 16, background: "white", border: "1.5px solid oklch(0.9 0.01 160)" }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: c, marginTop: 5, flex: "none" }} />
                <span style={{ fontSize: 14 }}><b>{name}</b> — <span style={{ color: MUTED }}>{note}</span></span>
              </div>
            ))}
          </div>
        </div>
      ) : !ready ? (
        loading ? (
          <Empty>Đang tải…</Empty>
        ) : (
          <Empty>
            Chưa có địa điểm loại <b>{kind ? VENUE_KINDS[kind] : ""}</b>.
            {isAdmin ? <> Vào tab <b>Thiết lập</b> để tạo.</> : " Liên hệ quản trị viên để mở bán."}
          </Empty>
        )
      ) : tab === "gate" ? (
        <GateTab key={ready.data.venue.id} ctx={ready} />
      ) : tab === "live" ? (
        <ShowTab key={ready.data.venue.id} ctx={ready} />
      ) : tab === "rest" ? (
        <RestTab key={ready.data.venue.id} ctx={ready} />
      ) : tab === "qr" ? (
        <DineTab key={ready.data.venue.id} ctx={ready} />
      ) : (
        <BuildTab key={ready.data.venue.id} ctx={ready} />
      )}
    </div>
  );
}
