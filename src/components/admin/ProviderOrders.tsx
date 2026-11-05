"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  advanceBookingStatus,
  setBookingPaymentStep,
  setBookingCommissionPaid,
} from "@/app/admin/bookings/actions";

/* Trạng thái gộp (đơn + thanh toán) để hiển thị theo thiết kế "Chủ dịch vụ - Đơn". */
export type POStatus = "new" | "held" | "dep" | "paid" | "done" | "cancel";

export interface ProviderOrderVM {
  id: string;
  code: string;
  createdText: string;
  createdSort: string;
  st: POStatus;
  src: "web" | "ctv";
  combo: boolean;
  canStatus: boolean; // được đổi trạng thái (thu nốt/hoàn thành) — chỉ sau khi sàn xác nhận + có cọc
  canPay: boolean; // được ghi nhận thu tiền — khoá với combo (sàn thu) & trước khi mở khoá
  canCancel: boolean; // được huỷ/khôi phục đơn — chỉ SÀN (admin)
  name: string;
  phone: string;
  phoneLocked: boolean; // true = ẩn SĐT khách (chủ dịch vụ, đơn chưa nhận cọc/hoàn thành)
  ciKey: string; // yyyy-mm-dd ngày nhận phòng (lọc/sắp xếp)
  calMon: string;
  calDay: number;
  calDow: string;
  room: string;
  stay: string;
  gross: number;
  discount: number;
  net: number;
  collected: number;
  moneyLabel: string; // "Tiền của bạn" / "Tiền phòng của bạn" / "Tiền vé của bạn"
  mainTag: "PH" | "XE"; // biểu tượng dòng dịch vụ chính (phòng / xe)
  showBusLine: boolean; // combo phía homestay: hiện thêm dòng vé xe (nhà xe thu)
  ctv: string;
  comm: number;
  ctvPaid: boolean;
  guestNote: string;
  adminNote: string;
  busLabel: string;
  busPrice: number;
}

const G = "oklch(0.29 0.055 160)";
const K = (n: number) => n.toLocaleString("vi-VN") + "đ";

const ST: Record<POStatus, { label: string; bg: string; fg: string; dot: string }> = {
  new: { label: "Mới", bg: "oklch(0.95 0.06 70)", fg: "oklch(0.5 0.15 50)", dot: "oklch(0.68 0.18 45)" },
  held: { label: "Đã giữ phòng", bg: "oklch(0.95 0.03 250)", fg: "oklch(0.42 0.12 250)", dot: "oklch(0.58 0.14 250)" },
  dep: { label: "Đã cọc", bg: "oklch(0.95 0.04 300)", fg: "oklch(0.45 0.13 300)", dot: "oklch(0.58 0.14 300)" },
  paid: { label: "Đã thanh toán đủ", bg: "oklch(0.94 0.05 155)", fg: "oklch(0.38 0.1 155)", dot: "oklch(0.55 0.13 155)" },
  done: { label: "Hoàn thành", bg: "oklch(0.93 0.03 155)", fg: "oklch(0.33 0.08 155)", dot: "oklch(0.45 0.1 155)" },
  cancel: { label: "Đã huỷ", bg: "oklch(0.94 0 0)", fg: "oklch(0.45 0 0)", dot: "oklch(0.7 0 0)" },
};

// Nút bước kế tiếp theo trạng thái: [nhãn, hành động, màu nền]. 'pay' = mở drawer thu tiền.
// 'held' = xác nhận giữ phòng (SÀN); 'complete' = hoàn thành (chủ dịch vụ, sau khi thu đủ).
const NEXT: Partial<Record<POStatus, [string, "held" | "pay" | "complete", string]>> = {
  new: ["Xác nhận giữ phòng", "held", "oklch(0.68 0.18 45)"],
  held: ["Ghi nhận cọc", "pay", "oklch(0.58 0.14 250)"],
  dep: ["Thu nốt tiền", "pay", "oklch(0.58 0.14 300)"],
  paid: ["Hoàn thành đơn", "complete", "oklch(0.45 0.1 155)"],
};

const TAB_DEFS: { k: string; name: string; f: (o: ProviderOrderVM) => boolean; dot?: string }[] = [
  { k: "todo", name: "Cần xử lý", f: (o) => o.st === "new" || o.st === "held", dot: "oklch(0.68 0.18 45)" },
  { k: "new", name: "Mới", f: (o) => o.st === "new" },
  { k: "held", name: "Đã giữ phòng", f: (o) => o.st === "held" },
  { k: "dep", name: "Đã cọc", f: (o) => o.st === "dep" },
  { k: "paid", name: "Đã thanh toán đủ", f: (o) => o.st === "paid" },
  { k: "done", name: "Hoàn thành", f: (o) => o.st === "done" },
  { k: "cancel", name: "Đã huỷ", f: (o) => o.st === "cancel" },
  { k: "all", name: "Tất cả", f: () => true, dot: G },
];

export function ProviderOrders({
  orders,
  scopeLabel,
  todayText,
  todayKey,
}: {
  orders: ProviderOrderVM[];
  scopeLabel: string;
  todayText: string;
  todayKey: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [tab, setTab] = useState("todo");
  const [src, setSrc] = useState<"all" | "web" | "ctv">("all");
  const [range, setRange] = useState<"all" | "week" | "month">("all");
  const [sort, setSort] = useState<"date" | "new" | "due">("date");
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [amt, setAmt] = useState("");
  const [method, setMethod] = useState("Chuyển khoản");
  const [payErr, setPayErr] = useState("");
  const [toast, setToast] = useState("");
  const toastT = useRef<number | undefined>(undefined);

  function say(t: string) {
    setToast(t);
    window.clearTimeout(toastT.current);
    toastT.current = window.setTimeout(() => setToast(""), 2200);
  }

  function run(action: (fd: FormData) => Promise<void>, fields: Record<string, string>, msg?: string) {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.append(k, v);
    start(async () => {
      await action(fd);
      router.refresh();
      if (msg) say(msg);
    });
  }

  // Lọc theo nguồn + khoảng ngày nhận phòng + tìm kiếm.
  const base = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return orders.filter((o) => {
      if (src !== "all" && o.src !== src) return false;
      if (range !== "all") {
        const diff = (Date.parse(o.ciKey) - Date.parse(todayKey)) / 864e5;
        if (range === "week" ? !(diff >= 0 && diff < 7) : !(diff >= 0 && diff < 31)) return false;
      }
      if (qq && !(o.code + o.name + o.phone).toLowerCase().includes(qq)) return false;
      return true;
    });
  }, [orders, src, range, q, todayKey]);

  const tabDef = TAB_DEFS.find((t) => t.k === tab) ?? TAB_DEFS[0];
  const list = useMemo(() => {
    const l = base.filter(tabDef.f);
    l.sort((a, b) =>
      sort === "new"
        ? b.createdSort.localeCompare(a.createdSort)
        : sort === "due"
          ? b.net - b.collected - (a.net - a.collected)
          : a.ciKey.localeCompare(b.ciKey),
    );
    return l;
  }, [base, tabDef, sort]);

  // KPI trên các đơn còn hiệu lực (không tính huỷ).
  const live = orders.filter((o) => o.st !== "cancel");
  const collectedTotal = live.reduce((a, o) => a + o.collected, 0);
  const dueTotal = live.reduce((a, o) => a + Math.max(0, o.net - o.collected), 0);
  const ctvDueOrders = live.filter((o) => o.ctv && !o.ctvPaid);
  const ctvDue = ctvDueOrders.reduce((a, o) => a + o.comm, 0);
  const todoN = orders.filter((o) => o.st === "new" || o.st === "held").length;

  const od = orders.find((o) => o.id === openId) ?? null;

  function openOrder(o: ProviderOrderVM, pay = false) {
    setOpenId(o.id);
    setPayErr("");
    setAmt(pay && o.st === "held" ? String(Math.round((o.net * 0.3) / 10000) * 10000) : pay ? String(Math.max(0, o.net - o.collected)) : "");
  }

  // Nút bước kế tiếp hợp lệ theo quyền: 'held' cần quyền đổi trạng thái, 'pay' cần quyền thu tiền.
  function nextOf(o: ProviderOrderVM): [string, "held" | "pay" | "complete", string] | undefined {
    const n = NEXT[o.st];
    if (!n) return undefined;
    if (n[1] === "held" || n[1] === "complete") return o.canStatus ? n : undefined;
    return o.canPay ? n : undefined;
  }

  function doNext(o: ProviderOrderVM) {
    const n = nextOf(o);
    if (!n) return;
    if (n[1] === "held") run(advanceBookingStatus, { id: o.id, status: "CONFIRMED" }, "Đã xác nhận giữ phòng " + o.code);
    else if (n[1] === "complete") run(advanceBookingStatus, { id: o.id, status: "COMPLETED" }, "Đã hoàn thành " + o.code);
    else openOrder(o, true);
  }

  function addPay() {
    if (!od) return;
    const a = Number(amt);
    const rem = Math.max(0, od.net - od.collected);
    if (!a) return setPayErr("Nhập số tiền đã nhận");
    if (a > rem) return setPayErr("Vượt số còn thiếu (" + K(rem) + ")");
    const total = od.collected + a;
    run(
      setBookingPaymentStep,
      { id: od.id, status: total >= od.net ? "PAID" : "DEPOSITED", amountCollected: String(total) },
      total >= od.net ? "Đơn đã thanh toán đủ" : "Đã ghi nhận " + K(a),
    );
    setAmt("");
  }

  const KPIS = [
    { label: "Cần xử lý", v: todoN + " đơn", sub: "Mới cần xác nhận hoặc chờ cọc", dot: "oklch(0.68 0.18 45)", bg: "oklch(0.985 0.02 70)", bd: "oklch(0.9 0.06 70)", pick: () => setTab("todo") },
    { label: "Đã thu", v: K(collectedTotal), sub: "Cọc và thanh toán đã ghi nhận", dot: "oklch(0.55 0.13 155)", bg: "white", bd: "oklch(0.92 0.01 160)", pick: () => setTab("all") },
    { label: "Còn phải thu", v: K(dueTotal), sub: "Từ các đơn chưa thanh toán đủ", dot: "oklch(0.58 0.14 300)", bg: "white", bd: "oklch(0.92 0.01 160)", pick: () => { setTab("all"); setSort("due"); } },
    { label: "Hoa hồng CTV chưa trả", v: K(ctvDue), sub: ctvDueOrders.length + " đơn từ CTV", dot: "oklch(0.7 0.15 80)", bg: "white", bd: "oklch(0.92 0.01 160)", pick: () => { setSrc("ctv"); setTab("all"); } },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 1280, color: "oklch(0.22 0.03 160)", opacity: pending ? 0.75 : 1, transition: "opacity .15s" }}>
      {/* Tiêu đề + khoảng ngày */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "clamp(24px,3vw,30px)", fontWeight: 800, letterSpacing: "-.02em" }}>Đơn &amp; xác nhận</h1>
          <div style={{ fontSize: 14, color: "oklch(0.48 0.02 160)", marginTop: 4 }}>{scopeLabel} · {todayText}</div>
        </div>
        <div style={{ display: "inline-flex", gap: 4, padding: 4, borderRadius: 12, background: "oklch(0.93 0.01 160)" }}>
          {([["week", "7 ngày tới"], ["month", "30 ngày tới"], ["all", "Tất cả"]] as const).map(([k, name]) => {
            const on = range === k;
            return (
              <div key={k} onClick={() => setRange(k)} style={{ cursor: "pointer", fontSize: 13, fontWeight: 700, padding: "7px 12px", borderRadius: 9, whiteSpace: "nowrap", background: on ? "white" : "transparent", color: on ? G : "oklch(0.42 0.02 160)", boxShadow: on ? "0 1px 3px oklch(0.2 0.03 160 / .15)" : "none" }}>{name}</div>
            );
          })}
        </div>
      </div>

      {/* KPI */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,200px),1fr))", gap: 12 }}>
        {KPIS.map((k) => (
          <div key={k.label} onClick={k.pick} style={{ cursor: "pointer", padding: "16px 18px", borderRadius: 18, background: k.bg, border: `1.5px solid ${k.bd}`, display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "oklch(0.42 0.02 160)" }}>{k.label}</span>
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: k.dot }} />
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-.02em", lineHeight: 1 }}>{k.v}</div>
            <div style={{ fontSize: 12, color: "oklch(0.5 0.02 160)" }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Tabs pipeline */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2, scrollbarWidth: "none" }}>
          {TAB_DEFS.map((t) => {
            const on = tab === t.k;
            const n = base.filter(t.f).length;
            const dot = t.dot ?? ST[t.k as POStatus]?.dot ?? G;
            return (
              <div key={t.k} onClick={() => setTab(t.k)} style={{ cursor: "pointer", flex: "none", display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 14, background: on ? G : "white", color: on ? "white" : "oklch(0.3 0.03 160)", border: `1.5px solid ${on ? G : "oklch(0.9 0.01 160)"}`, fontSize: 14, fontWeight: 700, whiteSpace: "nowrap" }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: dot }} />
                {t.name}
                <span style={{ minWidth: 22, padding: "1px 7px", borderRadius: 999, background: on ? "oklch(1 0 0 / .2)" : "oklch(0.95 0.005 160)", fontSize: 12, fontWeight: 800, textAlign: "center" }}>{n}</span>
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {([["all", "Mọi nguồn"], ["web", "Khách đặt web"], ["ctv", "Từ CTV"]] as const).map(([k, name]) => {
            const on = src === k;
            return (
              <div key={k} onClick={() => setSrc(k)} style={{ cursor: "pointer", fontSize: 13, fontWeight: 700, padding: "6px 12px", borderRadius: 999, whiteSpace: "nowrap", background: on ? "oklch(0.95 0.025 155)" : "white", color: on ? G : "oklch(0.42 0.02 160)", border: "1px solid oklch(0.9 0.01 160)" }}>{name}</div>
            );
          })}
          <span style={{ flex: 1 }} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm mã đơn, tên khách, SĐT"
            style={{ fontSize: 13, fontWeight: 600, padding: "7px 12px", borderRadius: 10, border: "1px solid oklch(0.88 0.015 160)", background: "white", minWidth: 180, outline: "none" }}
          />
          <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} style={{ fontSize: 13, fontWeight: 700, padding: "7px 10px", borderRadius: 10, border: "1px solid oklch(0.88 0.015 160)", background: "white" }}>
            <option value="date">Ngày nhận phòng gần nhất</option>
            <option value="new">Mới đặt nhất</option>
            <option value="due">Còn phải thu nhiều nhất</option>
          </select>
        </div>
      </div>

      {/* Danh sách đơn */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {list.map((o) => {
          const st = ST[o.st];
          const rem = Math.max(0, o.net - o.collected);
          const pct = o.net > 0 ? Math.min(100, Math.round((o.collected / o.net) * 100)) : 0;
          const barC = rem === 0 && o.st !== "cancel" ? "oklch(0.55 0.13 155)" : st.dot;
          const dueText = o.st === "cancel" ? "Đã huỷ" : rem === 0 ? "Đủ tiền ✓" : "Còn thiếu " + K(rem);
          const dueC = o.st === "cancel" ? "oklch(0.5 0 0)" : rem === 0 ? "oklch(0.4 0.1 155)" : "oklch(0.55 0.17 40)";
          const srcBg = o.src === "ctv" ? "oklch(0.96 0.04 80)" : "oklch(0.96 0.01 160)";
          const srcFg = o.src === "ctv" ? "oklch(0.48 0.12 60)" : "oklch(0.42 0.03 160)";
          const n = nextOf(o);
          return (
            <article key={o.id} style={{ background: "white", borderRadius: 20, border: `1.5px solid ${o.st === "new" ? "oklch(0.85 0.08 60)" : "oklch(0.92 0.01 160)"}`, overflow: "hidden" }}>
              <div className="po-row" style={{ display: "grid", gap: 16, padding: "16px 18px", alignItems: "center" }}>
                {/* Ngày + mã */}
                <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                  <div style={{ width: 58, flex: "none", textAlign: "center", borderRadius: 14, overflow: "hidden", border: "1px solid oklch(0.9 0.01 160)" }}>
                    <div style={{ fontSize: 11, fontWeight: 800, padding: "3px 0", background: st.dot, color: "white" }}>{o.calMon}</div>
                    <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.1, padding: "4px 0 0" }}>{o.calDay}</div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "oklch(0.5 0.02 160)", paddingBottom: 4 }}>{o.calDow}</div>
                  </div>
                  <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <span onClick={() => openOrder(o)} style={{ cursor: "pointer", fontSize: 15, fontWeight: 800, color: "oklch(0.35 0.08 160)", letterSpacing: ".02em" }}>{o.code}</span>
                      <Badge bg={st.bg} fg={st.fg}>{st.label}</Badge>
                      <Badge bg={srcBg} fg={srcFg}>{o.src === "ctv" ? "Từ CTV" : "Khách đặt web"}</Badge>
                      {o.combo && <Badge bg="oklch(0.95 0.04 300)" fg="oklch(0.45 0.13 300)">Combo</Badge>}
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>{o.room}</div>
                    <div style={{ fontSize: 13, color: "oklch(0.5 0.02 160)" }}>{o.stay}</div>
                  </div>
                </div>
                {/* Khách */}
                <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.name}</div>
                  {o.phoneLocked ? (
                    <div style={{ fontSize: 12, fontWeight: 700, color: "oklch(0.52 0.02 160)", padding: "6px 10px", borderRadius: 999, background: "oklch(0.95 0.005 160)", whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 6, width: "fit-content" }} title="SĐT khách hiện sau khi ghi nhận cọc">🔒 Tạm ẩn</div>
                  ) : (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <a href={`tel:${o.phone}`} style={{ fontSize: 13, fontWeight: 700, padding: "6px 10px", borderRadius: 999, background: "oklch(0.96 0.02 155)", whiteSpace: "nowrap", color: "inherit" }}>☎ {o.phone}</a>
                      <a href={`https://zalo.me/${o.phone}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, fontWeight: 700, padding: "6px 10px", borderRadius: 999, background: "oklch(0.95 0.03 250)", color: "oklch(0.42 0.12 250)" }}>Zalo</a>
                    </div>
                  )}
                </div>
                {/* Tiền */}
                <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13 }}>
                    <span style={{ color: "oklch(0.5 0.02 160)" }}>{o.moneyLabel}</span>
                    <b style={{ fontSize: 16 }}>{K(o.net)}</b>
                  </div>
                  <div style={{ height: 8, borderRadius: 999, background: "oklch(0.93 0.01 160)", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: pct + "%", borderRadius: 999, background: barC, transition: "width .5s" }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12 }}>
                    <span style={{ color: "oklch(0.4 0.1 155)", fontWeight: 700 }}>Đã thu {K(o.collected)}</span>
                    <span style={{ color: dueC, fontWeight: 700 }}>{dueText}</span>
                  </div>
                  {o.discount > 0 && <div style={{ fontSize: 11, color: "oklch(0.5 0.02 160)" }}>Giá bán {K(o.gross)} − chiết khấu {K(o.discount)}</div>}
                </div>
                {/* Hành động */}
                <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "stretch" }}>
                  {n && (
                    <div onClick={() => doNext(o)} style={{ cursor: "pointer", textAlign: "center", fontSize: 14, fontWeight: 800, padding: "11px 14px", borderRadius: 12, background: n[2], color: "white", whiteSpace: "nowrap" }}>{n[0]}</div>
                  )}
                  <div style={{ display: "flex", gap: 6 }}>
                    <div onClick={() => openOrder(o)} style={{ flex: 1, cursor: "pointer", textAlign: "center", fontSize: 13, fontWeight: 700, padding: "8px 12px", borderRadius: 12, border: "1.5px solid oklch(0.9 0.01 160)", whiteSpace: "nowrap" }}>Chi tiết</div>
                    {o.canCancel && o.st === "cancel" && (
                      <div onClick={() => run(advanceBookingStatus, { id: o.id, status: "NEW" }, "Đã khôi phục " + o.code)} style={{ cursor: "pointer", textAlign: "center", fontSize: 13, fontWeight: 700, padding: "8px 12px", borderRadius: 12, border: "1.5px solid oklch(0.9 0.01 160)", whiteSpace: "nowrap" }}>Khôi phục</div>
                    )}
                    {o.canCancel && o.st !== "cancel" && (
                      <div onClick={() => { if (confirm("Huỷ đơn " + o.code + "? (khách huỷ / không tới)")) run(advanceBookingStatus, { id: o.id, status: "CANCELLED" }, "Đã huỷ " + o.code); }} style={{ cursor: "pointer", textAlign: "center", fontSize: 13, fontWeight: 700, padding: "8px 12px", borderRadius: 12, border: "1.5px solid oklch(0.9 0.04 28)", color: "oklch(0.5 0.18 28)", whiteSpace: "nowrap" }}>Huỷ</div>
                    )}
                  </div>
                </div>
              </div>
              {o.ctv && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "10px 18px", background: "oklch(0.975 0.015 80)", borderTop: "1px solid oklch(0.93 0.02 80)", fontSize: 13 }}>
                  <span>CTV <b>{o.ctv}</b> · hoa hồng <b>{K(o.comm)}</b></span>
                  <span onClick={() => run(setBookingCommissionPaid, { id: o.id, paid: String(!o.ctvPaid) }, o.ctvPaid ? "Đã bỏ đánh dấu trả CTV" : "Đã đánh dấu trả hoa hồng cho " + o.ctv)} style={{ cursor: "pointer", fontWeight: 800, padding: "5px 12px", borderRadius: 999, background: o.ctvPaid ? "oklch(0.93 0.05 155)" : "oklch(0.68 0.18 45)", color: o.ctvPaid ? "oklch(0.38 0.1 155)" : "white", whiteSpace: "nowrap" }}>{o.ctvPaid ? "Đã trả CTV ✓" : "Đánh dấu đã trả"}</span>
                </div>
              )}
            </article>
          );
        })}
        {list.length === 0 && (
          <div style={{ padding: "48px 20px", textAlign: "center", borderRadius: 20, border: "1.5px dashed oklch(0.85 0.02 160)", background: "white", color: "oklch(0.48 0.02 160)", fontSize: 15 }}>Không có đơn nào ở mục này.</div>
        )}
      </div>

      {od && <Drawer o={od} onClose={() => setOpenId(null)} amt={amt} setAmt={(v) => { setAmt(v.replace(/\D/g, "")); setPayErr(""); }} method={method} setMethod={setMethod} payErr={payErr} addPay={addPay} run={run} openOrder={openOrder} />}

      {toast && (
        <div style={{ position: "fixed", left: "50%", bottom: 24, transform: "translateX(-50%)", zIndex: 60, background: "oklch(0.25 0.04 160)", color: "white", fontSize: 14, fontWeight: 700, padding: "12px 18px", borderRadius: 999, whiteSpace: "nowrap" }}>{toast}</div>
      )}

      <style>{`.po-row{grid-template-columns:1fr}@media(min-width:760px){.po-row{grid-template-columns:minmax(0,1.4fr) minmax(0,1fr) minmax(0,1.1fr) 170px}}`}</style>
    </div>
  );
}

function Badge({ bg, fg, children }: { bg: string; fg: string; children: React.ReactNode }) {
  return <span style={{ fontSize: 11, fontWeight: 800, padding: "3px 8px", borderRadius: 999, background: bg, color: fg, whiteSpace: "nowrap" }}>{children}</span>;
}

function Drawer({
  o,
  onClose,
  amt,
  setAmt,
  method,
  setMethod,
  payErr,
  addPay,
  run,
  openOrder,
}: {
  o: ProviderOrderVM;
  onClose: () => void;
  amt: string;
  setAmt: (v: string) => void;
  method: string;
  setMethod: (v: string) => void;
  payErr: string;
  addPay: () => void;
  run: (a: (fd: FormData) => Promise<void>, f: Record<string, string>, m?: string) => void;
  openOrder: (o: ProviderOrderVM, pay?: boolean) => void;
}) {
  const st = ST[o.st];
  const rem = Math.max(0, o.net - o.collected);
  const pct = o.net > 0 ? Math.min(100, Math.round((o.collected / o.net) * 100)) : 0;
  const barC = rem === 0 && o.st !== "cancel" ? "oklch(0.55 0.13 155)" : st.dot;
  const dueText = o.st === "cancel" ? "Đã huỷ" : rem === 0 ? "Đủ tiền ✓" : "Còn thiếu " + K(rem);
  const dueC = o.st === "cancel" ? "oklch(0.5 0 0)" : rem === 0 ? "oklch(0.4 0.1 155)" : "oklch(0.55 0.17 40)";
  const srcBg = o.src === "ctv" ? "oklch(0.96 0.04 80)" : "oklch(0.96 0.01 160)";
  const srcFg = o.src === "ctv" ? "oklch(0.48 0.12 60)" : "oklch(0.42 0.03 160)";
  const order: POStatus[] = ["new", "held", "dep", "paid"];
  const idx = o.st === "done" ? 3 : order.indexOf(o.st);
  const steps = ["Đặt phòng", "Giữ phòng", "Đã cọc", "Thanh toán đủ"].map((name, i) => ({
    name,
    c: o.st === "cancel" ? "oklch(0.88 0 0)" : i <= idx ? st.dot : "oklch(0.9 0.01 160)",
    fw: i === idx ? 800 : 600,
    fg: i <= idx ? "oklch(0.25 0.03 160)" : "oklch(0.55 0.02 160)",
  }));
  const quick: [string, number][] = rem > 0 && o.st !== "cancel" && o.canPay
    ? ([["Cọc 30%", Math.round((o.net * 0.3) / 10000) * 10000], ["Cọc 50%", Math.round((o.net * 0.5) / 10000) * 10000], ["Thu đủ " + K(rem), rem]] as [string, number][]).filter((x) => x[1] > 0 && x[1] <= rem)
    : [];
  const canCancel = o.st !== "cancel" && o.canCancel;
  const drawerNext = o.st === "new" && o.canStatus ? "Xác nhận giữ phòng" : o.st === "cancel" && o.canCancel ? "Khôi phục đơn" : "";
  const drawerComplete = o.st === "paid" && o.canStatus;

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 40, background: "oklch(0.15 0.03 160 / .45)" }} />
      <div style={{ position: "fixed", zIndex: 41, top: 0, right: 0, bottom: 0, width: "min(520px,100vw)", background: "oklch(0.98 0.005 160)", display: "flex", flexDirection: "column", boxShadow: "-20px 0 50px -20px oklch(0.15 0.03 160 / .4)", color: "oklch(0.22 0.03 160)" }}>
        <div style={{ padding: "16px 20px", background: "white", borderBottom: "1px solid oklch(0.93 0.01 160)", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div>
            <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontSize: 18, fontWeight: 800, color: "oklch(0.35 0.08 160)" }}>{o.code}</span>
              <Badge bg={st.bg} fg={st.fg}>{st.label}</Badge>
              <Badge bg={srcBg} fg={srcFg}>{o.src === "ctv" ? "Từ CTV" : "Khách đặt web"}</Badge>
              {o.combo && <Badge bg="oklch(0.95 0.04 300)" fg="oklch(0.45 0.13 300)">Combo</Badge>}
            </div>
            <div style={{ fontSize: 12, color: "oklch(0.5 0.02 160)", marginTop: 4 }}>Đặt lúc {o.createdText}</div>
          </div>
          <div onClick={onClose} style={{ cursor: "pointer", width: 36, height: 36, borderRadius: "50%", background: "oklch(0.95 0.005 160)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 700, flex: "none" }}>×</div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
          {/* stepper */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 4 }}>
            {steps.map((s) => (
              <div key={s.name} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ height: 5, borderRadius: 999, background: s.c }} />
                <span style={{ fontSize: 11, fontWeight: s.fw, color: s.fg, lineHeight: 1.3 }}>{s.name}</span>
              </div>
            ))}
          </div>
          {/* khách */}
          <div style={{ padding: "14px 16px", borderRadius: 16, background: "white", border: "1px solid oklch(0.92 0.01 160)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800 }}>{o.name}</div>
              <div style={{ fontSize: 13, color: "oklch(0.5 0.02 160)" }}>{o.phoneLocked ? "🔒 Tạm ẩn" : o.phone} · {o.stay.split(" · ").slice(-1)[0]}</div>
            </div>
            {!o.phoneLocked && (
              <div style={{ display: "flex", gap: 6 }}>
                <a href={`tel:${o.phone}`} style={{ fontSize: 13, fontWeight: 800, padding: "9px 14px", borderRadius: 999, background: "oklch(0.29 0.055 160)", color: "white" }}>Gọi</a>
                <a href={`https://zalo.me/${o.phone}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, fontWeight: 800, padding: "9px 14px", borderRadius: 999, background: "oklch(0.95 0.03 250)", color: "oklch(0.42 0.12 250)" }}>Zalo</a>
              </div>
            )}
          </div>
          {/* dịch vụ trong đơn */}
          <div style={{ padding: "14px 16px", borderRadius: 16, background: "white", border: "1px solid oklch(0.92 0.01 160)", display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: ".04em", textTransform: "uppercase", color: "oklch(0.5 0.02 160)" }}>Dịch vụ trong đơn</div>
            <ItemRow
              tag={o.mainTag}
              ibg={o.mainTag === "XE" ? "oklch(0.95 0.03 250)" : "oklch(0.94 0.05 155)"}
              ifg={o.mainTag === "XE" ? "oklch(0.42 0.12 250)" : "oklch(0.38 0.1 155)"}
              title={o.room}
              sub={o.stay + (o.discount > 0 ? ` · chiết khấu −${K(o.discount)}` : "")}
              price={K(o.net)}
              who="Bạn thực nhận"
              op={1}
            />
            {o.showBusLine && o.busPrice > 0 && (
              <ItemRow tag="XE" ibg="oklch(0.95 0.03 250)" ifg="oklch(0.42 0.12 250)" title="Xe cabin (trong combo)" sub={o.busLabel} price={K(o.busPrice)} who="Nhà xe thu" op={0.6} />
            )}
            <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 10, borderTop: "1px dashed oklch(0.88 0.015 160)", fontSize: 14 }}>
              <span>Phần tiền của bạn</span>
              <b style={{ fontSize: 17 }}>{K(o.net)}</b>
            </div>
          </div>
          {/* thanh toán */}
          <div style={{ padding: "14px 16px", borderRadius: 16, background: "white", border: "1px solid oklch(0.92 0.01 160)", display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: ".04em", textTransform: "uppercase", color: "oklch(0.5 0.02 160)" }}>Thanh toán của khách</div>
              <span style={{ fontSize: 13, fontWeight: 800, color: dueC }}>{dueText}</span>
            </div>
            <div style={{ height: 10, borderRadius: 999, background: "oklch(0.93 0.01 160)", overflow: "hidden" }}>
              <div style={{ height: "100%", width: pct + "%", background: barC, transition: "width .5s" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span style={{ color: "oklch(0.5 0.02 160)" }}>Đã thu</span>
              <b style={{ color: "oklch(0.4 0.1 155)" }}>{K(o.collected)}</b>
            </div>
            {!o.canPay ? (
              <div style={{ fontSize: 12, fontWeight: 600, color: "oklch(0.5 0.02 160)", padding: "8px 10px", borderRadius: 10, background: "oklch(0.96 0.02 300)" }}>Đơn combo do Tà Xùa Booking điều phối — phần thu tiền do sàn thực hiện. Bạn vẫn xác nhận giữ phòng / huỷ phần phòng của mình.</div>
            ) : o.st !== "cancel" ? (
              <>
                {quick.length > 0 && (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {quick.map(([name, a]) => (
                      <div key={name} onClick={() => setAmt(String(a))} style={{ cursor: "pointer", fontSize: 12, fontWeight: 700, padding: "6px 10px", borderRadius: 999, border: "1px solid oklch(0.88 0.015 160)", whiteSpace: "nowrap" }}>{name}</div>
                    ))}
                  </div>
                )}
                <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 120px auto", gap: 6 }}>
                  <input value={amt} onChange={(e) => setAmt(e.target.value)} inputMode="numeric" placeholder="Số tiền đã nhận" style={{ fontSize: 15, fontWeight: 700, padding: "10px 12px", borderRadius: 12, border: "1.5px solid oklch(0.88 0.015 160)", minWidth: 0 }} />
                  <select value={method} onChange={(e) => setMethod(e.target.value)} style={{ fontSize: 13, fontWeight: 700, padding: "10px 8px", borderRadius: 12, border: "1.5px solid oklch(0.88 0.015 160)", background: "white" }}>
                    <option>Chuyển khoản</option>
                    <option>Tiền mặt</option>
                  </select>
                  <div onClick={addPay} style={{ cursor: "pointer", fontSize: 14, fontWeight: 800, padding: "10px 14px", borderRadius: 12, background: "oklch(0.45 0.1 155)", color: "white", whiteSpace: "nowrap" }}>Ghi nhận</div>
                </div>
                {payErr && <div style={{ fontSize: 12, fontWeight: 700, color: "oklch(0.55 0.19 28)" }}>{payErr}</div>}
              </>
            ) : null}
          </div>
          {/* CTV */}
          {o.ctv && (
            <div style={{ padding: "14px 16px", borderRadius: 16, background: "oklch(0.975 0.015 80)", border: "1px solid oklch(0.92 0.03 80)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800 }}>CTV {o.ctv}</div>
                <div style={{ fontSize: 13, color: "oklch(0.45 0.04 60)" }}>Hoa hồng {K(o.comm)} · {o.ctvPaid ? "đã trả" : o.st === "paid" ? "đơn hoàn tất, nên trả ngay" : "trả khi khách thanh toán đủ"}</div>
              </div>
              <div onClick={() => run(setBookingCommissionPaid, { id: o.id, paid: String(!o.ctvPaid) }, o.ctvPaid ? "Đã bỏ đánh dấu trả CTV" : "Đã đánh dấu trả hoa hồng cho " + o.ctv)} style={{ cursor: "pointer", fontSize: 13, fontWeight: 800, padding: "9px 14px", borderRadius: 999, background: o.ctvPaid ? "oklch(0.93 0.05 155)" : "oklch(0.68 0.18 45)", color: o.ctvPaid ? "oklch(0.38 0.1 155)" : "white", whiteSpace: "nowrap" }}>{o.ctvPaid ? "Đã trả CTV ✓" : "Đánh dấu đã trả"}</div>
            </div>
          )}
          {/* ghi chú */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: ".04em", textTransform: "uppercase", color: "oklch(0.5 0.02 160)" }}>Ghi chú</div>
            {o.guestNote && <div style={{ fontSize: 13, padding: "10px 12px", borderRadius: 12, background: "oklch(0.96 0.02 250)" }}><b>Khách ghi:</b> {o.guestNote}</div>}
            {o.adminNote && <div style={{ fontSize: 13, padding: "10px 12px", borderRadius: 12, background: "oklch(0.97 0.01 160)" }}>{o.adminNote}</div>}
            {!o.guestNote && !o.adminNote && <div style={{ fontSize: 13, color: "oklch(0.55 0.02 160)", fontStyle: "italic" }}>Không có ghi chú.</div>}
          </div>
        </div>

        {(canCancel || drawerNext || drawerComplete) && (
          <div style={{ padding: "12px 20px", background: "white", borderTop: "1px solid oklch(0.93 0.01 160)", display: "flex", gap: 8 }}>
            {canCancel && (
              <div onClick={() => { if (confirm("Huỷ đơn " + o.code + "?")) run(advanceBookingStatus, { id: o.id, status: "CANCELLED" }, "Đã huỷ " + o.code); }} style={{ cursor: "pointer", fontSize: 14, fontWeight: 800, padding: "12px 16px", borderRadius: 12, color: "oklch(0.5 0.18 28)", border: "1.5px solid oklch(0.9 0.04 28)", whiteSpace: "nowrap" }}>Huỷ đơn</div>
            )}
            {drawerNext && (
              <div onClick={() => run(advanceBookingStatus, { id: o.id, status: o.st === "new" ? "CONFIRMED" : "NEW" }, o.st === "new" ? "Đã xác nhận giữ phòng" : "Đã khôi phục đơn")} style={{ cursor: "pointer", flex: 1, textAlign: "center", fontSize: 15, fontWeight: 800, padding: "12px 16px", borderRadius: 12, background: o.st === "new" ? "oklch(0.68 0.18 45)" : G, color: "white" }}>{drawerNext}</div>
            )}
            {drawerComplete && (
              <div onClick={() => run(advanceBookingStatus, { id: o.id, status: "COMPLETED" }, "Đã hoàn thành " + o.code)} style={{ cursor: "pointer", flex: 1, textAlign: "center", fontSize: 15, fontWeight: 800, padding: "12px 16px", borderRadius: 12, background: "oklch(0.45 0.1 155)", color: "white" }}>Hoàn thành đơn</div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

function ItemRow({ tag, ibg, ifg, title, sub, price, who, op }: { tag: string; ibg: string; ifg: string; title: string; sub: string; price: string; who: string; op: number }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "34px minmax(0,1fr) auto", gap: 10, alignItems: "start", opacity: op }}>
      <span style={{ width: 34, height: 34, borderRadius: 10, background: ibg, color: ifg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800 }}>{tag}</span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>{title}</div>
        <div style={{ fontSize: 12, lineHeight: 1.5, color: "oklch(0.5 0.02 160)" }}>{sub}</div>
      </div>
      <div style={{ textAlign: "right", fontSize: 14, fontWeight: 800, whiteSpace: "nowrap" }}>{price}<div style={{ fontSize: 11, fontWeight: 600, color: "oklch(0.5 0.02 160)" }}>{who}</div></div>
    </div>
  );
}
