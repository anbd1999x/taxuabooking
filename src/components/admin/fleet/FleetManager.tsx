"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { usePublishTabs } from "@/components/admin/module-tabs";
import {
  FLEET_KINDS,
  addDaysKey,
  diffDays,
  dowOf,
  effEnd,
  isVehicleFree,
  rentalSpan,
  rentalStatus,
  tmin,
  vehicleStatusOn,
  vnNow,
  type FleetKind,
  type FleetRentalVM,
  type FleetStatus,
  type FleetVehicleVM,
} from "@/lib/fleet-core";
import { BookingDrawer, EditDrawer, OrderDrawer, SvcDrawer, VehicleDrawer, payOf, type Ctx, type Drawer } from "./drawers";
import { CustTab, LedgerTab, MaintTab, ReportTab, SettingsTab, WebTab } from "./panels";
import {
  BORDER, COND, G, MUTED, O, ST, TYC, WD, WDL, Empty, StatCard, Thumb,
  daysIn, dm, dmy, inputCls, lastName, pill, short, ym,
  type FleetData,
} from "./ui";

/**
 * Quản lý xe cho thuê — theo mẫu claude.ai/design "Admin Quan ly Xe may v2" (project 4ec052fe…).
 * Tabs: Tổng quan (Nhắc việc + Ngày/Tháng/Năm) · Đơn web · Thu chi · Đội xe · Bảo dưỡng · Khách hàng · Báo cáo · Cài đặt.
 * Chế độ "Nhân viên giao xe" chỉ thấy việc giao/nhận xe trong ngày. Mọi thao tác gọi POST /api/admin/fleet.
 */

type Tab = "overview" | "web" | "ledger" | "fleet" | "maint" | "cust" | "report" | "settings";

export function FleetManager({
  serviceId,
  serviceTitle,
  services,
  webTypes,
  hotline,
  viewerRole,
  initial,
  demo = false,
}: {
  serviceId: string;
  serviceTitle: string;
  services: { id: string; title: string }[];
  webTypes: { id: string; name: string }[];
  hotline: string;
  /** STAFF (tài khoản nhân viên) ⇒ luôn ở chế độ nhân viên, không đổi được. */
  viewerRole: "ADMIN" | "PROVIDER" | "STAFF";
  initial: FleetData;
  /** Bản demo (nhà xe mẫu): hiện dải thông báo + nút làm mới dữ liệu mẫu. */
  demo?: boolean;
}) {
  const router = useRouter();
  const [raw, setRaw] = useState<FleetData>(initial);
  const [clock, setClock] = useState(() => ({ today: initial.today, now: initial.now }));
  const [tab, setTab] = useState<Tab>("overview");
  const [view, setView] = useState<"day" | "month" | "year">("month");
  const [date, setDate] = useState(initial.today);
  const [y, setY] = useState(Number(initial.today.slice(0, 4)));
  const [m, setM] = useState(Number(initial.today.slice(5, 7)) - 1);
  const [kind, setKind] = useState<"all" | FleetKind>("all");
  const [q, setQ] = useState("");
  const [dr, setDr] = useState<Drawer>(null);
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);
  const [role, setRole] = useState<"owner" | "staff">(viewerRole === "STAFF" ? "staff" : "owner");
  const [allAl, setAllAl] = useState(false);
  const [w, setW] = useState(1200);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    const t = setInterval(() => setClock(vnNow()), 60_000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  const data: FleetData = useMemo(() => ({ ...raw, ...clock }), [raw, clock]);
  const T = data.today, NOW = data.now;
  const say = (t: string) => setToast(t);
  const isStaff = role === "staff";

  async function call(payload: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/fleet", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ serviceId, ...payload }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { say(j.error ?? "Có lỗi xảy ra"); return null; }
      setRaw({ vehicles: j.vehicles, rentals: j.rentals, pending: j.pending, config: j.config, today: j.today, now: j.now, staff: j.staff, hasOwner: j.hasOwner });
      setClock({ today: j.today, now: j.now });
      if (j.message) say(j.message);
      return j as FleetData & { savedId?: string; message?: string };
    } catch {
      say("Mất kết nối, thử lại");
      return null;
    } finally {
      setBusy(false);
    }
  }

  const ctx: Ctx = {
    data, serviceId, webTypes, hotline, isStaff, busy, call, say, setDr, viewerStaff: viewerRole === "STAFF", demo,
    afterCreate: (s) => { setTab("overview"); setView("month"); setY(Number(s.slice(0, 4))); setM(Number(s.slice(5, 7)) - 1); },
  };

  const V = data.vehicles;
  const Bk = data.rentals;
  const L = Bk.filter((b) => !b.cancelled);
  const vById = (id: string) => V.find((v) => v.id === id);
  const bst = (b: FleetRentalVM) => rentalStatus(b, T, NOW);
  const mob = w < 700;
  const typeOk = (v: FleetVehicleVM) => kind === "all" || v.kind === kind;
  const vis = V.filter(typeOk);
  const openB = (id: string) => setDr({ kind: "book", id });
  const openV = (id: string) => setDr({ kind: "veh", id });
  const rentV = (v: FleetVehicleVM, d: string) => setDr({ kind: "order", pre: { kind: v.kind, s: d, e: addDaysKey(d, 1), picks: [v.id] } });

  // ===== thống kê hôm nay =====
  const tdy = V.map((v) => vehicleStatusOn(v, T, Bk, T, NOW));
  const cnt = (k: FleetStatus) => tdy.filter((x) => x.key === k).length;
  const wk = L.filter((b) => b.s > T && b.s <= addDaysKey(T, 7));
  const dep7 = wk.filter((b) => bst(b) === "deposit").length;
  const hold = L.filter((b) => bst(b) === "hold" && b.s > T && b.s <= addDaysKey(T, 14)).length;
  const mRev = L.filter((b) => !b.web && b.s.slice(0, 7) === ym(y, m)).reduce((a, b) => a + b.total, 0);
  const goStat = (vw: "day" | "month") => () => { setTab("overview"); setView(vw); setDate(T); setY(Number(T.slice(0, 4))); setM(Number(T.slice(5, 7)) - 1); };
  const webP = L.filter((b) => bst(b) === "web");

  // ===== nhắc việc =====
  type Tone = "web" | "late" | "due" | "ret" | "hold" | "maint";
  const tone: Record<Tone, [string, string, string]> = {
    web: ["oklch(0.975 0.02 300)", "oklch(0.88 0.06 300)", ST.web[3]],
    late: ["oklch(0.97 0.03 28)", "oklch(0.85 0.09 28)", ST.late[3]],
    due: ["oklch(0.97 0.025 215)", "oklch(0.86 0.06 215)", ST.due[3]],
    ret: ["oklch(0.975 0.03 75)", "oklch(0.88 0.08 75)", ST.deposit[3]],
    hold: ["oklch(0.975 0.02 280)", "oklch(0.88 0.05 280)", ST.hold[3]],
    maint: ["oklch(0.975 0.02 28)", "oklch(0.9 0.05 28)", ST.maint[3]],
  };
  const al = (tn: Tone, title: string, sub: string, btnL: string, go: () => void, key: string) => ({ key, title, sub, btnL, go, t: tone[tn] });
  const maintAl = V.filter((v) => v.mode !== "off" && v.odo - v.lastOil >= v.oilEvery * 0.9)
    .map((v) => al("maint", "Đến hạn thay nhớt · " + v.name, `${v.plate} · đã chạy ${(v.odo - v.lastOil).toLocaleString("vi-VN")} km`, "Bảo dưỡng", () => setTab("maint"), "oil" + v.id))
    .concat(V.filter((v) => v.mode !== "off" && v.insExp && diffDays(T, v.insExp) <= 30).map((v) => al("maint", (v.insExp! < T ? "Bảo hiểm đã hết hạn · " : "Bảo hiểm sắp hết hạn · ") + v.plate, `${v.name} · hạn ${dm(v.insExp!)}`, "Gia hạn", () => setTab("maint"), "ins" + v.id)));
  const holdLimit = data.config.holdH;
  const allAlerts = [
    ...L.filter((b) => bst(b) === "late").map((b) => al("late", "Quá hạn trả · " + b.name, `${vById(b.vid)?.plate ?? ""} · hẹn ${dm(b.e)} ${b.et} · ${b.phone}`, "Xử lý", () => openB(b.id), "l" + b.id)),
    ...L.filter((b) => bst(b) === "due").map((b) => al("due", `Cần giao xe ${b.st} hôm nay`, `${b.name} · ${vById(b.vid)?.name ?? ""} · ${b.place}`, "Lập biên bản", () => openB(b.id), "d" + b.id)),
    ...L.filter((b) => bst(b) === "renting" && b.e === T).map((b) => al("ret", `Nhận lại xe ${b.et} hôm nay`, `${b.name} · ${vById(b.vid)?.plate ?? ""}`, "Mở đơn", () => openB(b.id), "r" + b.id)),
    ...(isStaff ? [] : [
      ...(webP.length ? [al("web", `${webP.length} đơn web chờ xác nhận`, "Xe đã được xếp sẵn, chỉ cần duyệt", "Duyệt", () => setTab("web"), "web")] : []),
      ...L.filter((b) => bst(b) === "hold" && b.s <= addDaysKey(T, 3)).map((b) => al("hold", "Chưa cọc · " + b.name, `Nhận xe ${dm(b.s)} · quá ${holdLimit} giờ chưa cọc nên nhả xe`, "Xem", () => openB(b.id), "h" + b.id)),
      ...maintAl,
    ]),
  ];

  const stats = [
    { k: "Xe vận hành", v: V.filter((v) => v.mode !== "off").length, sub: V.filter((v) => v.mode === "off").length + " xe ngừng", c: G, pick: () => setTab("fleet") },
    { k: "Rảnh hôm nay", v: cnt("ready"), sub: "Sẵn sàng cho thuê", c: ST.ready[3], pick: goStat("day") },
    { k: "Đang thuê", v: cnt("renting") + cnt("late"), sub: cnt("late") ? cnt("late") + " xe quá hạn trả" : L.filter((b) => b.e === T && bst(b) === "renting").length + " xe trả hôm nay", c: ST.renting[3], pick: goStat("day") },
    { k: "Cọc · 7 ngày", v: dep7, sub: wk.length + " đơn sắp giao", c: ST.deposit[3], pick: goStat("month") },
    { k: "Chưa cọc", v: hold, sub: "Trong 14 ngày · nhắc khách", c: ST.hold[3], pick: goStat("month") },
    { k: "Doanh thu T" + (m + 1), v: short(mRev), sub: "Theo ngày nhận xe", c: O, pick: goStat("month") },
  ];

  // ===== kỳ xem =====
  const effView = isStaff ? "day" : view;
  const N = daysIn(y, m);
  const mStart = `${ym(y, m)}-01`;
  const mEnd = `${ym(y, m)}-${String(N).padStart(2, "0")}`;
  const DW = mob ? 30 : w >= 1300 ? 40 : 34;
  const nameW = mob ? 124 : 210;
  const shift = (n: number) => {
    if (effView === "day") { const d = addDaysKey(date, n); setDate(d); setY(Number(d.slice(0, 4))); setM(Number(d.slice(5, 7)) - 1); return; }
    if (effView === "year") { setY(y + n); return; }
    const d = new Date(Date.UTC(y, m + n, 1));
    setY(d.getUTCFullYear()); setM(d.getUTCMonth());
  };
  const periodLabel = effView === "day" ? (mob ? WD[dowOf(date)] : WDL[dowOf(date)]) + ", " + dm(date) : effView === "year" ? "Năm " + y : "Tháng " + (m + 1) + ", " + y;
  const legend: FleetStatus[] = ["ready", "web", "hold", "deposit", "due", "renting", "late", "done", "maint"];
  const yearCols = "190px repeat(12,minmax(48px,1fr)) 100px";
  const ql = q.trim().toLowerCase();
  const fleet = V.filter((v) => typeOk(v) && (!ql || (v.name + " " + v.plate).toLowerCase().includes(ql)));

  const tabs: [Tab, string, number?][] = isStaff
    ? [["overview", "Việc hôm nay"]]
    : [["overview", "Tổng quan"], ["web", "Đơn web", webP.length], ["ledger", "Thu chi"], ["fleet", "Đội xe · " + V.length], ["maint", "Bảo dưỡng", maintAl.length], ["cust", "Khách hàng"], ["report", "Báo cáo"], ["settings", "Cài đặt"]];
  const curTab = isStaff ? "overview" : tab;
  // Tab hiện thành MỤC CON ở menu trái (không còn thanh tab cuộn ngang); nhân viên chỉ có 1 màn ⇒ không cần mục con.
  usePublishTabs(isStaff ? [] : tabs.map(([key, label, badge]) => ({ key, label, badge })), curTab, (k) => setTab(k as Tab));

  const typeChips = () => (
    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
      {([["all", "Tất cả"], ...Object.entries(FLEET_KINDS)] as ["all" | FleetKind, string][]).map(([k2, name]) => (
        <div key={k2} onClick={() => setKind(k2)} style={pill(kind === k2)}>{name} <span style={{ opacity: 0.6 }}>{k2 === "all" ? V.length : V.filter((v) => v.kind === k2).length}</span></div>
      ))}
    </div>
  );

  return (
    <div ref={rootRef} className="fleet-root -m-4 lg:-m-6" style={{ color: "oklch(0.22 0.03 160)", minHeight: "100%", background: "oklch(0.975 0.004 160)" }}>
      <style>{`@keyframes fleetSlide{from{transform:translateX(40px);opacity:0}to{transform:none;opacity:1}}@keyframes fleetUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}.fleet-root *{box-sizing:border-box}`}</style>
      {/* top bar (không dính — thanh tab bên dưới mới dính khi cuộn) */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "12px clamp(14px,2.5vw,28px)", background: "white", borderBottom: "1px solid oklch(0.93 0.008 160)", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          {services.length > 1 ? (
            <select value={serviceId} onChange={(e) => router.push(`/admin/provider/xe?service=${e.target.value}`)} style={{ fontSize: 14, fontWeight: 800, padding: "6px 12px", borderRadius: 999, background: "oklch(0.95 0.025 155)", color: "oklch(0.35 0.08 158)", border: "none", maxWidth: "60vw", fontFamily: "inherit" }}>
              {services.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
            </select>
          ) : (
            <span style={{ fontSize: 14, fontWeight: 800, padding: "6px 12px", borderRadius: 999, background: "oklch(0.95 0.025 155)", color: "oklch(0.35 0.08 158)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{serviceTitle}</span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {viewerRole !== "STAFF" && <select value={role} onChange={(e) => { const r = e.target.value as "owner" | "staff"; setRole(r); if (r === "staff") { setDate(T); setDr(null); } say(r === "staff" ? "Đang xem với quyền nhân viên" : "Đang xem với quyền chủ cơ sở"); }} style={{ fontSize: 13, fontWeight: 700, padding: "8px 10px", borderRadius: 999, border: "1.5px solid oklch(0.9 0.01 160)", background: "white", maxWidth: 170, fontFamily: "inherit" }}>
            <option value="owner">Chủ cơ sở</option>
            <option value="staff">Nhân viên giao xe</option>
          </select>}
          {!mob && <span style={{ fontSize: 14, color: MUTED, whiteSpace: "nowrap" }}>{WDL[dowOf(T)] + ", " + dmy(T)}</span>}
          <div onClick={() => setDr({ kind: "order" })} style={{ cursor: "pointer", fontSize: 14, fontWeight: 800, padding: "10px 16px", borderRadius: 999, background: O, color: "white", whiteSpace: "nowrap" }}>+ Đơn thuê mới</div>
        </div>
      </div>

      <div style={{ padding: "clamp(14px,2.5vw,28px)", display: "flex", flexDirection: "column", gap: 16 }}>
        {demo && (
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "12px 16px", borderRadius: 14, background: "oklch(0.96 0.05 75)", border: "1.5px solid oklch(0.85 0.1 75)", color: "oklch(0.36 0.08 60)", fontSize: 14, lineHeight: 1.5 }}>
            <span><b>Bản demo</b> · dữ liệu mẫu, thử thoải mái mọi thao tác: tạo đơn, giao xe, nhận xe, đổi giá… Đổi ô “Chủ cơ sở” sang “Nhân viên giao xe” để xem màn hình của nhân viên.</span>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- route handler đặt phiên demo, <Link> sẽ prefetch gọi nhầm */}
            <a href="/hop-tac/xe-may/demo?reset=1" style={{ fontSize: 13, fontWeight: 800, padding: "8px 14px", borderRadius: 999, background: "white", border: "1.5px solid oklch(0.85 0.1 75)", color: "oklch(0.36 0.08 60)", whiteSpace: "nowrap" }}>Làm mới dữ liệu mẫu</a>
          </div>
        )}
        {isStaff && <div style={{ padding: "12px 16px", borderRadius: 14, background: "oklch(0.95 0.03 250)", color: "oklch(0.38 0.1 250)", fontSize: 14, lineHeight: 1.5 }}>Đang xem với quyền <b>Nhân viên giao xe</b>: chỉ thấy việc giao và nhận xe. Doanh thu, báo cáo và cài đặt được ẩn.</div>}
        <div>
          <h1 style={{ margin: 0, fontSize: "clamp(24px,2.6vw,30px)", fontWeight: 800, letterSpacing: "-.02em" }}>Quản lý xe cho thuê</h1>
          <div style={{ fontSize: 15, color: "oklch(0.48 0.02 160)", marginTop: 4 }}>Xem xe nào rảnh, ai đang thuê, ai đã cọc. Đơn mới sẽ tự xếp xe trống phù hợp.</div>
        </div>

        {!isStaff && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,150px),1fr))", gap: 10 }}>
            {stats.map((s) => <StatCard key={s.k} k={s.k} v={s.v} sub={s.sub} c={s.c} onClick={s.pick} />)}
          </div>
        )}

        {/* Đơn web chưa đủ xe */}
        {!isStaff && data.pending.length > 0 && (
          <div style={{ padding: 14, borderRadius: 18, background: "oklch(0.97 0.03 28)", border: "1.5px solid oklch(0.85 0.07 28)", display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: "oklch(0.45 0.15 28)" }}>Đơn web chưa xếp đủ xe ({data.pending.length})</div>
            {data.pending.map((p) => {
              const freeNow = V.filter((v) => isVehicleFree(v, p.s, p.e, Bk, T, undefined, NOW));
              return (
                <div key={p.id} style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", justifyContent: "space-between", padding: "8px 10px", borderRadius: 12, background: "white" }}>
                  <span style={{ minWidth: 0, fontSize: 14 }}><b>{p.code}</b> · {p.name} · {dm(p.s)}→{dm(p.e)} · cần {p.qty} xe, đã xếp {p.assigned}{p.label ? <span style={{ color: MUTED }}> · {p.label}</span> : null}</span>
                  {freeNow.length ? (
                    <select defaultValue="" disabled={busy} onChange={(e) => { if (e.target.value) call({ op: "assign", bookingId: p.id, vehicleId: e.target.value }); e.target.value = ""; }} style={{ ...inputCls, width: "auto", fontSize: 13, padding: "7px 10px" }}>
                      <option value="">Xếp xe…</option>
                      {freeNow.map((v) => <option key={v.id} value={v.id}>{v.name} · {v.plate}</option>)}
                    </select>
                  ) : <span style={{ fontSize: 13, fontWeight: 700, color: "oklch(0.5 0.16 28)" }}>Không còn xe trống</span>}
                </div>
              );
            })}
          </div>
        )}

        {V.length === 0 && curTab !== "settings" && (
          <div style={{ padding: "40px 20px", textAlign: "center", border: "1.5px dashed oklch(0.86 0.02 160)", borderRadius: 20, background: "white", display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}>
            <div style={{ fontSize: 17, fontWeight: 800 }}>Chưa có xe nào trong đội xe</div>
            <div style={{ fontSize: 14, color: MUTED }}>Thêm từng xe (ảnh, biển số, loại xe, giá) để bắt đầu quản lý lịch thuê và tự xếp xe cho đơn.</div>
            {!isStaff && <div onClick={() => setDr({ kind: "edit" })} style={{ cursor: "pointer", fontSize: 14, fontWeight: 800, padding: "11px 18px", borderRadius: 999, background: G, color: "white" }}>+ Thêm xe đầu tiên</div>}
          </div>
        )}

        {/* ===== OVERVIEW ===== */}
        {curTab === "overview" && V.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {allAlerts.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 16, fontWeight: 800 }}>Nhắc việc <span style={{ color: "oklch(0.55 0.16 45)" }}>{allAlerts.length}</span></span>
                  {allAlerts.length > 6 && <span onClick={() => setAllAl(!allAl)} style={{ cursor: "pointer", fontSize: 13, fontWeight: 800, color: "oklch(0.4 0.08 158)" }}>{allAl ? "Thu gọn" : "Xem tất cả"}</span>}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(min(100%,300px),1fr))", gap: 8 }}>
                  {(allAl ? allAlerts : allAlerts.slice(0, 6)).map((a) => (
                    <div key={a.key} style={{ display: "flex", gap: 12, alignItems: "center", padding: "11px 12px 11px 14px", borderRadius: 16, background: a.t[0], border: `1.5px solid ${a.t[1]}`, animation: "fleetUp .3s ease both" }}>
                      <span style={{ width: 10, height: 10, borderRadius: "50%", background: a.t[2], flex: "none" }} />
                      <div style={{ minWidth: 0, flex: 1 }}><div style={{ fontSize: 14, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.title}</div><div style={{ fontSize: 12, color: "oklch(0.45 0.02 160)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.sub}</div></div>
                      <div onClick={a.go} style={{ cursor: "pointer", flex: "none", fontSize: 13, fontWeight: 800, padding: "8px 12px", borderRadius: 999, background: "white", border: `1.5px solid ${a.t[1]}`, whiteSpace: "nowrap" }}>{a.btnL}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "10px 12px", borderRadius: 18, background: "white", border: `1px solid ${BORDER}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div onClick={() => shift(-1)} style={{ cursor: "pointer", width: 38, height: 38, borderRadius: "50%", border: "1.5px solid oklch(0.9 0.01 160)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 800 }}>‹</div>
                <div style={{ minWidth: mob ? 120 : 160, textAlign: "center", fontSize: 18, fontWeight: 800, whiteSpace: "nowrap" }}>{periodLabel}</div>
                <div onClick={() => shift(1)} style={{ cursor: "pointer", width: 38, height: 38, borderRadius: "50%", border: "1.5px solid oklch(0.9 0.01 160)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 800 }}>›</div>
                <div onClick={() => { setDate(T); setY(Number(T.slice(0, 4))); setM(Number(T.slice(5, 7)) - 1); }} style={{ cursor: "pointer", fontSize: 13, fontWeight: 800, padding: "9px 14px", borderRadius: 999, background: "oklch(0.95 0.025 155)", color: "oklch(0.35 0.08 158)", whiteSpace: "nowrap" }}>Hôm nay</div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                {!isStaff && (
                  <div style={{ display: "inline-flex", gap: 3, padding: 3, borderRadius: 12, background: "oklch(0.95 0.005 160)" }}>
                    {([["day", "Ngày"], ["month", "Tháng"], ["year", "Năm"]] as const).map(([k2, name]) => (
                      <div key={k2} onClick={() => setView(k2)} style={{ cursor: "pointer", fontSize: 13, fontWeight: 800, padding: "7px 14px", borderRadius: 9, whiteSpace: "nowrap", background: view === k2 ? "white" : "transparent", color: view === k2 ? G : "oklch(0.45 0.02 160)", boxShadow: view === k2 ? "0 1px 3px oklch(0.2 0.03 160 / .15)" : "none" }}>{name}</div>
                    ))}
                  </div>
                )}
                {typeChips()}
              </div>
            </div>

            <div style={{ display: "flex", gap: "6px 14px", flexWrap: "wrap", alignItems: "center", fontSize: 13, fontWeight: 600, color: "oklch(0.42 0.02 160)" }}>
              {legend.map((k2) => (
                <span key={k2} style={{ display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
                  <span style={{ width: 16, height: 10, borderRadius: 4, background: k2 === "hold" ? "oklch(0.97 0.02 280)" : k2 === "ready" ? "white" : ST[k2][1], border: `1.5px ${k2 === "hold" || k2 === "maint" || k2 === "web" ? "dashed" : "solid"} ${k2 === "ready" ? "oklch(0.85 0.02 160)" : ST[k2][3]}` }} />{ST[k2][0]}
                </span>
              ))}
            </div>

            {/* DAY */}
            {effView === "day" && (
              <div style={{ display: "grid", gridTemplateColumns: w >= 1100 ? "minmax(0,1fr) 340px" : "1fr", gap: 14, alignItems: "start" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(min(100%,260px),1fr))", gap: 10 }}>
                  {vis.map((v) => {
                    const x = vehicleStatusOn(v, date, Bk, T, NOW), M = ST[x.key], b = x.r;
                    const nx = !b ? L.filter((y2) => y2.vid === v.id && y2.s > date).sort((a, c) => a.s.localeCompare(c.s))[0] : undefined;
                    const py = b ? payOf(b, T, NOW) : ["", ""];
                    const free = x.key === "ready";
                    return (
                      <div key={v.id} style={{ display: "flex", flexDirection: "column", background: "white", borderRadius: 18, overflow: "hidden", border: `1.5px solid ${free ? "oklch(0.85 0.06 155)" : BORDER}`, animation: "fleetUp .3s ease both" }}>
                        <div onClick={() => openV(v.id)} style={{ display: "flex", gap: 12, padding: 12, alignItems: "center", cursor: "pointer" }}>
                          <div style={{ width: 64, height: 52, borderRadius: 12, overflow: "hidden", flex: "none" }}><Thumb url={v.imageUrl} label=" " /></div>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontSize: 15, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{v.name}</div>
                            <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 3 }}><span style={{ fontFamily: "ui-monospace,monospace", fontSize: 12, fontWeight: 700, padding: "2px 7px", borderRadius: 6, background: "oklch(0.95 0.005 160)" }}>{v.plate}</span><span style={{ fontSize: 12, color: MUTED, whiteSpace: "nowrap" }}>{FLEET_KINDS[v.kind]}</span></div>
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 800, padding: "5px 10px", borderRadius: 999, whiteSpace: "nowrap", background: M[1], color: M[2] }}>{M[0]}</span>
                        </div>
                        <div style={{ padding: "10px 12px 12px", borderTop: "1px solid oklch(0.94 0.008 160)", display: "flex", flexDirection: "column", gap: 6, background: free ? "oklch(0.985 0.015 155)" : "white", flex: 1 }}>
                          {b && (
                            <div onClick={() => openB(b.id)} style={{ cursor: "pointer", display: "flex", flexDirection: "column", gap: 3 }}>
                              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 14, fontWeight: 800 }}><span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{b.name}</span><span style={{ fontWeight: 700, color: "oklch(0.45 0.02 160)", whiteSpace: "nowrap" }}>{b.phone}</span></div>
                              <div style={{ fontSize: 13, color: "oklch(0.42 0.02 160)" }}>{dm(b.s)} {b.st} → {dm(b.e)} {b.et}{b.place ? " · " + b.place : ""}</div>
                              {!isStaff && <div style={{ fontSize: 13, fontWeight: 700, color: py[1] }}>{py[0]}</div>}
                            </div>
                          )}
                          {free && (
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                              <div style={{ fontSize: 13, color: "oklch(0.42 0.02 160)" }}>{nx ? "Rảnh tới " + dm(addDaysKey(nx.s, -1)) + " · đơn kế " + lastName(nx.name) : "Rảnh, chưa có đơn kế tiếp"}</div>
                              <div onClick={() => (date < T ? say("Ngày đã qua") : rentV(v, date))} style={{ cursor: "pointer", fontSize: 13, fontWeight: 800, padding: "7px 12px", borderRadius: 999, background: G, color: "white", whiteSpace: "nowrap" }}>Cho thuê</div>
                            </div>
                          )}
                          {(x.key === "maint" || x.key === "off") && <div style={{ fontSize: 13, color: "oklch(0.5 0.14 28)" }}>{v.note || M[0]}</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <aside style={{ display: "flex", flexDirection: "column", gap: 12, position: w >= 1100 ? "sticky" : "static", top: 80 }}>
                  {[
                    { title: "Giao xe trong ngày", c: ST.renting[3], list: L.filter((b) => b.s === date && bst(b) !== "web").sort((a, b) => a.st.localeCompare(b.st)), tk: "st" as const },
                    { title: "Nhận lại xe", c: ST.deposit[3], list: L.filter((b) => (b.e === date || (date === T && bst(b) === "late")) && bst(b) !== "web").sort((a, b) => a.et.localeCompare(b.et)), tk: "et" as const },
                  ].map((g) => (
                    <div key={g.title} style={{ padding: 14, borderRadius: 18, background: "white", border: `1px solid ${BORDER}`, display: "flex", flexDirection: "column", gap: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 15, fontWeight: 800 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: g.c }} />{g.title}</span><span style={{ fontSize: 13, fontWeight: 800, color: MUTED }}>{g.list.length}</span></div>
                      {!g.list.length && <div style={{ fontSize: 13, color: "oklch(0.55 0.02 160)", padding: "6px 0" }}>Không có.</div>}
                      {g.list.map((b) => { const vv = vById(b.vid); return (
                        <div key={b.id} onClick={() => openB(b.id)} style={{ cursor: "pointer", display: "grid", gridTemplateColumns: "50px minmax(0,1fr) auto", gap: 10, alignItems: "center", padding: "8px 10px", borderRadius: 12, background: bst(b) === "late" ? "oklch(0.97 0.03 28)" : "oklch(0.975 0.005 160)" }}>
                          <span style={{ fontSize: 14, fontWeight: 800 }}>{b[g.tk]}</span>
                          <span style={{ minWidth: 0 }}><span style={{ display: "block", fontSize: 14, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{b.name}</span><span style={{ display: "block", fontSize: 12, color: MUTED, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{vv?.name}{b.place ? " · " + b.place : ""}</span></span>
                          <span style={{ fontFamily: "ui-monospace,monospace", fontSize: 11, fontWeight: 700, color: "oklch(0.45 0.02 160)" }}>{vv?.plate}</span>
                        </div>
                      ); })}
                    </div>
                  ))}
                </aside>
              </div>
            )}

            {/* MONTH */}
            {effView === "month" && (
              <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 20, overflow: "hidden" }}>
                <div style={{ overflowX: "auto", scrollbarWidth: "thin" }}>
                  <div style={{ minWidth: nameW + N * DW }}>
                    <div style={{ display: "flex", borderBottom: `1px solid ${BORDER}`, background: "oklch(0.985 0.004 160)" }}>
                      <div style={{ position: "sticky", left: 0, zIndex: 3, width: nameW, flex: "none", background: "oklch(0.985 0.004 160)", padding: "10px 12px", fontSize: 12, fontWeight: 800, letterSpacing: ".06em", color: MUTED, borderRight: `1px solid ${BORDER}` }}>XE</div>
                      <div style={{ display: "flex" }}>
                        {Array.from({ length: N }, (_, i) => {
                          const k = addDaysKey(mStart, i), wd = dowOf(k), we = wd === 0 || wd === 6, isT = k === T;
                          return (
                            <div key={k} onClick={() => { setView("day"); setDate(k); }} style={{ cursor: "pointer", width: DW, flex: "none", textAlign: "center", padding: "6px 0", background: we ? "oklch(0.97 0.006 160)" : "transparent", borderRight: "1px solid oklch(0.94 0.006 160)" }}>
                              <div style={{ fontSize: 10, fontWeight: 800, color: wd === 0 ? "oklch(0.55 0.16 28)" : "oklch(0.55 0.02 160)" }}>{WD[wd]}</div>
                              <div style={{ margin: "2px auto 0", width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, background: isT ? O : "transparent", color: isT ? "white" : "oklch(0.25 0.03 160)" }}>{i + 1}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    {vis.map((v) => {
                      const bs = L.filter((b) => b.vid === v.id && b.s <= mEnd && effEnd(b, T, NOW) >= mStart);
                      const mFrom = v.mode === "maint" && T <= mEnd ? Math.max(0, diffDays(mStart, T)) : -1;
                      const showM = mFrom >= 0 || v.mode === "off";
                      return (
                        <div key={v.id} style={{ display: "flex", borderBottom: "1px solid oklch(0.94 0.006 160)" }}>
                          <div onClick={() => openV(v.id)} style={{ position: "sticky", left: 0, zIndex: 2, width: nameW, flex: "none", background: "white", padding: "8px 12px", borderRight: `1px solid ${BORDER}`, cursor: "pointer", display: "flex", flexDirection: "column", justifyContent: "center", minWidth: 0 }}>
                            <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}><span style={{ width: 8, height: 8, borderRadius: "50%", flex: "none", background: v.mode === "ready" ? TYC[v.kind] : ST[v.mode][3] }} />{v.name}</span>
                            <span style={{ fontFamily: "ui-monospace,monospace", fontSize: 11, fontWeight: 700, color: MUTED, marginTop: 2, whiteSpace: "nowrap" }}>{v.plate}</span>
                          </div>
                          <div
                            title="Bấm ô trống để tạo đơn cho xe này"
                            onClick={(e) => {
                              if (e.target !== e.currentTarget) return;
                              const r = e.currentTarget.getBoundingClientRect();
                              const i = Math.floor((e.clientX - r.left) / DW);
                              const d = addDaysKey(mStart, Math.max(0, Math.min(N - 1, i)));
                              if (v.mode !== "ready") return say(v.name + " đang " + ST[v.mode][0].toLowerCase());
                              if (d < T) return say("Không thể tạo đơn cho ngày đã qua");
                              rentV(v, d);
                            }}
                            style={{ position: "relative", flex: "none", width: N * DW, height: 56, cursor: "copy", background: `repeating-linear-gradient(90deg, transparent 0 ${DW - 1}px, oklch(0.95 0.005 160) ${DW - 1}px ${DW}px)` }}
                          >
                            {T >= mStart && T <= mEnd && <div style={{ position: "absolute", top: 0, bottom: 0, left: diffDays(mStart, T) * DW, width: DW, background: "oklch(0.97 0.04 70 / .7)", pointerEvents: "none" }} />}
                            {showM && (
                              <div style={{ position: "absolute", top: 10, bottom: 10, left: (v.mode === "off" ? 0 : mFrom * DW) + 2, right: 4, borderRadius: 10, background: "repeating-linear-gradient(-45deg, oklch(0.95 0.03 28) 0 6px, oklch(0.985 0.01 28) 6px 12px)", border: "1.5px dashed oklch(0.75 0.1 28)", color: "oklch(0.5 0.15 28)", fontSize: 12, fontWeight: 800, display: "flex", alignItems: "center", padding: "0 10px", whiteSpace: "nowrap", overflow: "hidden", pointerEvents: "none" }}>
                                {v.mode === "off" ? "Ngừng cho thuê" : "Bảo dưỡng" + (v.note ? " · " + v.note : "")}
                              </div>
                            )}
                            {bs.map((b) => {
                              const st = bst(b), M = ST[st];
                              // Thanh vẽ theo GIỜ nhận/trả (2 lượt cùng ngày: trả sáng – nhận chiều nằm cạnh nhau).
                              const [rs0, re0] = rentalSpan(b, T, NOW);
                              const pos = (ts: string) => diffDays(mStart, ts.slice(0, 10)) + tmin(ts.slice(11, 16)) / 1440;
                              const a = Math.max(0, pos(rs0)), z = Math.min(N, pos(re0));
                              const wid = Math.max(10, (z - a) * DW);
                              const label = wid < 60 ? lastName(b.name) : b.name.trim().split(/\s+/).slice(-2).join(" ") + " · " + dm(b.s) + " " + b.st + "–" + dm(b.e) + " " + b.et;
                              return (
                                <div key={b.id} onClick={(e) => { e.stopPropagation(); openB(b.id); }} title={`${b.code} · ${b.name} · ${M[0]}`}
                                  style={{ position: "absolute", top: 10, bottom: 10, left: a * DW + 1, width: wid - 2, borderRadius: 10, background: st === "hold" ? "oklch(0.97 0.02 280)" : M[1], color: M[2], border: `1.5px ${st === "hold" || st === "web" ? "dashed" : "solid"} ${M[3]}`, fontSize: 12, fontWeight: 800, padding: "0 8px", display: "flex", alignItems: "center", gap: 5, overflow: "hidden", whiteSpace: "nowrap", cursor: "pointer", boxShadow: "0 4px 10px -6px oklch(0.2 0.04 160 / .4)" }}>
                                  <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div style={{ padding: "10px 14px", fontSize: 13, color: MUTED, borderTop: "1px solid oklch(0.94 0.006 160)" }}>Bấm thanh màu để xem người thuê · bấm ô trống để tạo đơn cho xe đó · bấm ngày ở trên để xem chi tiết ngày.</div>
              </div>
            )}

            {/* YEAR */}
            {effView === "year" && (
              <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 20, overflow: "hidden" }}>
                <div style={{ overflowX: "auto" }}>
                  <div style={{ minWidth: 860 }}>
                    <div style={{ display: "grid", gridTemplateColumns: yearCols, borderBottom: `1px solid ${BORDER}`, background: "oklch(0.985 0.004 160)" }}>
                      <div style={{ position: "sticky", left: 0, background: "oklch(0.985 0.004 160)", padding: "10px 12px", fontSize: 12, fontWeight: 800, letterSpacing: ".06em", color: MUTED }}>XE</div>
                      {Array.from({ length: 12 }, (_, i) => <div key={i} onClick={() => { setView("month"); setM(i); }} style={{ cursor: "pointer", textAlign: "center", padding: "10px 0", fontSize: 12, fontWeight: 800, color: ym(y, i) === T.slice(0, 7) ? O : MUTED }}>T{i + 1}</div>)}
                      <div style={{ padding: "10px 12px", fontSize: 12, fontWeight: 800, color: MUTED, textAlign: "right" }}>DOANH THU</div>
                    </div>
                    {vis.map((v) => {
                      let rev = 0;
                      const cells = Array.from({ length: 12 }, (_, mi) => {
                        const n = daysIn(y, mi), a = `${ym(y, mi)}-01`, z = `${ym(y, mi)}-${String(n).padStart(2, "0")}`;
                        let used = 0;
                        L.filter((b) => b.vid === v.id && !b.web && b.s <= z && b.e >= a).forEach((b) => {
                          const x2 = b.s > a ? b.s : a, y2 = b.e < z ? b.e : z;
                          used += diffDays(x2, y2) + 1;
                          if (b.s >= a && b.s <= z) rev += b.total;
                        });
                        const pc = Math.round((used / n) * 100);
                        const lv = pc === 0 ? 0 : pc < 25 ? 1 : pc < 50 ? 2 : pc < 75 ? 3 : 4;
                        const HL = ["oklch(0.97 0.004 160)", "oklch(0.92 0.04 155)", "oklch(0.82 0.08 155)", "oklch(0.66 0.11 155)", "oklch(0.5 0.1 158)"];
                        return { mi, pc, used, bg: HL[lv], fg: lv >= 3 ? "white" : "oklch(0.35 0.04 160)" };
                      });
                      return (
                        <div key={v.id} style={{ display: "grid", gridTemplateColumns: yearCols, borderBottom: "1px solid oklch(0.95 0.005 160)", alignItems: "center" }}>
                          <div onClick={() => openV(v.id)} style={{ cursor: "pointer", position: "sticky", left: 0, background: "white", padding: "8px 12px", minWidth: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{v.name}</div>
                            <div style={{ fontFamily: "ui-monospace,monospace", fontSize: 11, color: MUTED }}>{v.plate}</div>
                          </div>
                          {cells.map((c) => <div key={c.mi} onClick={() => { setView("month"); setM(c.mi); }} title={`Tháng ${c.mi + 1}: ${c.used} ngày thuê`} style={{ cursor: "pointer", margin: "5px 3px", height: 38, borderRadius: 9, background: c.bg, color: c.fg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800 }}>{c.pc ? c.pc + "%" : ""}</div>)}
                          <div style={{ padding: "8px 12px", textAlign: "right", fontSize: 14, fontWeight: 800 }}>{short(rev)}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div style={{ padding: "10px 14px", fontSize: 13, color: MUTED, borderTop: "1px solid oklch(0.94 0.006 160)" }}>Số % là tỉ lệ ngày xe được thuê trong tháng. Bấm một ô để mở lịch tháng đó.</div>
              </div>
            )}
          </div>
        )}

        {/* ===== FLEET ===== */}
        {curTab === "fleet" && V.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm tên xe hoặc biển số…" style={{ width: "min(280px,100%)", fontSize: 15, padding: "11px 14px", borderRadius: 12, border: "1.5px solid oklch(0.9 0.01 160)", background: "white", fontFamily: "inherit" }} />
                {typeChips()}
              </div>
              <div onClick={() => setDr({ kind: "edit" })} style={{ cursor: "pointer", fontSize: 14, fontWeight: 800, padding: "11px 18px", borderRadius: 999, background: G, color: "white", whiteSpace: "nowrap" }}>+ Thêm xe</div>
            </div>
            {!fleet.length && <Empty>Không tìm thấy xe phù hợp.</Empty>}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(min(100%,270px),1fr))", gap: 14 }}>
              {fleet.map((v) => {
                const x = vehicleStatusOn(v, T, Bk, T, NOW), M = ST[x.key], C = COND[v.cond];
                const nx = L.filter((b) => b.vid === v.id && b.s > T).sort((a, b) => a.s.localeCompare(b.s))[0];
                const info = x.r ? M[0] + ": " + x.r.name + " · tới " + dm(x.r.e) : x.key === "ready" ? (nx ? "Đơn kế: " + dm(nx.s) + " · " + nx.name : "Chưa có đơn sắp tới") : v.note || M[0];
                return (
                  <div key={v.id} style={{ display: "flex", flexDirection: "column", background: "white", borderRadius: 20, overflow: "hidden", border: `1px solid ${BORDER}`, animation: "fleetUp .3s ease both" }}>
                    {/* Khung ảnh cố định 16:10 — overflow:hidden + flex:none để ảnh dọc không kéo cao khung (ảnh tự cắt giữa). */}
                    <div onClick={() => openV(v.id)} style={{ position: "relative", aspectRatio: "16/10", flex: "none", overflow: "hidden", cursor: "pointer", background: "oklch(0.96 0.006 160)" }}>
                      <div style={{ position: "absolute", inset: 0 }}><Thumb url={v.imageUrl} label={"Ảnh " + v.name} /></div>
                      <span style={{ position: "absolute", top: 10, left: 10, fontSize: 12, fontWeight: 800, padding: "5px 10px", borderRadius: 999, background: M[1], color: M[2] }}>{M[0]}</span>
                      <span style={{ position: "absolute", top: 10, right: 10, fontFamily: "ui-monospace,monospace", fontSize: 12, fontWeight: 800, padding: "5px 9px", borderRadius: 8, background: "white", border: "1.5px solid oklch(0.3 0.03 160)" }}>{v.plate}</span>
                    </div>
                    <div style={{ padding: "14px 16px 16px", display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}><span style={{ fontSize: 17, fontWeight: 800 }}>{v.name}</span><span style={{ fontSize: 15, fontWeight: 800, color: "oklch(0.55 0.16 45)", whiteSpace: "nowrap" }}>{short(v.price)}/ngày</span></div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {[FLEET_KINDS[v.kind], v.color, v.year ? "Đời " + v.year : ""].filter(Boolean).map((c) => <span key={c} style={{ fontSize: 12, fontWeight: 600, padding: "3px 9px", borderRadius: 999, background: "oklch(0.965 0.006 160)", color: "oklch(0.38 0.02 160)", whiteSpace: "nowrap" }}>{c}</span>)}
                        <span style={{ fontSize: 12, fontWeight: 700, padding: "3px 9px", borderRadius: 999, background: C[1], color: C[2], whiteSpace: "nowrap" }}>{C[0]}</span>
                      </div>
                      <div style={{ fontSize: 13, color: "oklch(0.45 0.02 160)" }}>{info}</div>
                      <div style={{ flex: 1 }} />
                      <div style={{ display: "flex", gap: 6 }}>
                        <div onClick={() => openV(v.id)} style={{ cursor: "pointer", flex: 1, textAlign: "center", fontSize: 13, fontWeight: 800, padding: 9, borderRadius: 999, border: "1.5px solid oklch(0.9 0.01 160)" }}>Chi tiết</div>
                        <div onClick={() => setDr({ kind: "edit", id: v.id })} style={{ cursor: "pointer", flex: 1, textAlign: "center", fontSize: 13, fontWeight: 800, padding: 9, borderRadius: 999, background: "oklch(0.95 0.025 155)", color: "oklch(0.32 0.08 158)" }}>Sửa</div>
                        <div onClick={() => setDr({ kind: "edit", copyOf: v.id })} title="Tạo xe mới chép thông tin xe này" style={{ cursor: "pointer", flex: 1, textAlign: "center", fontSize: 13, fontWeight: 800, padding: 9, borderRadius: 999, border: "1.5px solid oklch(0.9 0.01 160)", whiteSpace: "nowrap" }}>Nhân đôi</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {curTab === "web" && <WebTab ctx={ctx} />}
        {curTab === "ledger" && <LedgerTab ctx={ctx} mob={mob} />}
        {curTab === "maint" && V.length > 0 && <MaintTab ctx={ctx} />}
        {curTab === "cust" && <CustTab ctx={ctx} />}
        {curTab === "report" && <ReportTab ctx={ctx} wide={w >= 1000} />}
        {curTab === "settings" && <SettingsTab key={JSON.stringify(data.config)} ctx={ctx} />}
      </div>

      {/* ===== DRAWERS ===== */}
      {dr?.kind === "veh" && <VehicleDrawer ctx={ctx} id={dr.id} />}
      {dr?.kind === "edit" && <EditDrawer key={dr.id ?? "copy:" + (dr.copyOf ?? "new")} ctx={ctx} id={dr.id} copyOf={dr.copyOf} />}
      {dr?.kind === "order" && <OrderDrawer key={JSON.stringify(dr.pre ?? {})} ctx={ctx} pre={dr.pre} />}
      {dr?.kind === "book" && <BookingDrawer key={dr.id + ":" + (Bk.find((b) => b.id === dr.id)?.hand ? "h" : "n")} ctx={ctx} id={dr.id} />}
      {dr?.kind === "svc" && <SvcDrawer key={dr.id} ctx={ctx} id={dr.id} />}

      {toast && (
        <div style={{ position: "fixed", left: "50%", bottom: 24, transform: "translateX(-50%)", zIndex: 90, maxWidth: "calc(100vw - 32px)", fontSize: 14, fontWeight: 700, padding: "13px 20px", borderRadius: 999, background: "oklch(0.25 0.04 160)", color: "white", boxShadow: "0 14px 30px -10px oklch(0.15 0.03 160 / .5)", animation: "fleetUp .25s ease both" }}>{toast}</div>
      )}
    </div>
  );
}
