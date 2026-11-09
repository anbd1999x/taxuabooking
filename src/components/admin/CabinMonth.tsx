"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const G = "oklch(0.29 0.055 160)";
const O = "oklch(0.68 0.18 45)";
const M = "oklch(0.48 0.02 160)";

export type TicketStatus = "new" | "ok" | "cancel";
export interface CabinTicket {
  id: string;
  code: string;
  name: string;
  phone: string;
  seats: number;
  status: TicketStatus;
  srcLabel: string; // "CTV Hằng" | "Khách" | "Web"
  isCtv: boolean;
}
export interface CabinDir {
  tripId: string | null; // null = chưa có chuyến ⇒ đang bán mặc định (lịch luôn mở bán)
  open: boolean; // false = admin đánh dấu HẾT VÉ (loại khỏi tìm kiếm cabin & combo)
  total: number;
  booked: number;
  price: number;
  time: string;
  route: string;
  tickets: CabinTicket[];
}
export interface CabinDay {
  di: CabinDir | null;
  ve: CabinDir | null;
}

const DIR_META: Record<"di" | "ve", { title: string; defTime: string }> = {
  di: { title: "Chiều đi", defTime: "21:00" },
  ve: { title: "Chiều về", defTime: "12:00" },
};
const ST_META: Record<TicketStatus, [string, string, string]> = {
  new: ["Mới", "oklch(0.95 0.06 70)", "oklch(0.5 0.15 50)"],
  ok: ["Đã xác nhận", "oklch(0.94 0.05 155)", "oklch(0.38 0.1 155)"],
  cancel: ["Đã huỷ", "oklch(0.94 0 0)", "oklch(0.45 0 0)"],
};
const WDS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

function vnd(n: number) {
  return n.toLocaleString("vi-VN") + "đ";
}
function dow(dateKey: string) {
  return new Date(dateKey + "T00:00:00Z").getUTCDay();
}

export function CabinMonth({
  serviceId,
  month,
  monthLabel,
  days,
  data,
  ctvOptions,
  todayKey,
  prevMonth,
  nextMonth,
}: {
  serviceId: string;
  month: string;
  monthLabel: string;
  days: string[];
  data: Record<string, CabinDay>;
  ctvOptions: { id: string; name: string }[];
  todayKey: string | null;
  prevMonth: string;
  nextMonth: string;
}) {
  const router = useRouter();
  const [w, setW] = useState(1440);
  const [dir, setDir] = useState<"both" | "di" | "ve">("both");
  const [sel, setSel] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState<"di" | "ve" | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", seats: 1, src: "phone" as "phone" | "ctv", ctv: "", err: "" });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const on = () => setW(window.innerWidth);
    on();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);

  const mobile = w < 900;
  const tiny = w < 560;
  const compact = tiny || (!mobile && w < 1120 && dir === "both");
  const dirKeys: ("di" | "ve")[] = dir === "both" ? ["di", "ve"] : [dir];

  async function call(payload: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/cabin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, serviceId }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Lỗi");
      router.refresh();
      return true;
    } catch (e) {
      alert(e instanceof Error ? e.message : "Có lỗi xảy ra.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  // ---- KPIs + cells ----
  let seatsM = 0, newM = 0, tightDays = 0, ctvM = 0;
  for (const dk of days) {
    const day = data[dk];
    if (!day) continue;
    let tight = false;
    for (const k of dirKeys) {
      const t = day[k];
      if (!t) continue;
      seatsM += t.booked;
      ctvM += t.tickets.filter((b) => b.status !== "cancel" && b.isCtv).reduce((a, b) => a + b.seats, 0);
      newM += t.tickets.filter((b) => b.status === "new").length;
      if (!t.open) tight = true; // ngày có chiều đánh dấu hết vé
    }
    if (tight) tightDays++;
  }
  const firstNew = days.find((dk) => dirKeys.some((k) => data[dk]?.[k]?.tickets.some((b) => b.status === "new"))) ?? null;

  const firstOffset = days.length ? (dow(days[0]) + 6) % 7 : 0;

  const fill = (t: CabinDir | null) => {
    // Chưa có chuyến = đang bán mặc định (luôn còn chỗ).
    if (!t) return { txt: compact ? "✓" : "Đang bán", fc: "oklch(0.45 0.1 155)", bar: "transparent", pct: "0%", track: "oklch(0.95 0.02 155)" };
    if (!t.open) return { txt: compact ? "×" : "Hết vé", fc: "oklch(0.5 0.17 28)", bar: "oklch(0.62 0.16 28)", pct: "100%", track: "oklch(0.93 0.02 28)" };
    const free = t.total - t.booked;
    const c = free <= 0 ? "oklch(0.58 0.19 28)" : free <= 3 ? "oklch(0.66 0.16 55)" : "oklch(0.6 0.13 155)";
    return {
      txt: compact ? String(t.booked) : `${t.booked}/${t.total}`,
      fc: free <= 0 ? "oklch(0.55 0.19 28)" : "oklch(0.25 0.03 160)",
      bar: c, pct: Math.min(100, (t.booked / Math.max(1, t.total)) * 100) + "%", track: "oklch(0.94 0.008 150)",
    };
  };

  function pickDay(dk: string) {
    setSel(dk);
    setOpen(true);
    setAdding(null);
  }
  function closeDay() {
    setOpen(false);
    setAdding(null);
  }

  const kpis = [
    { label: "Vé đã đặt trong tháng", v: String(seatsM), sub: `${ctvM} vé từ CTV · ${seatsM - ctvM} vé khách lẻ`, c: "oklch(0.22 0.03 160)", run: null as null | (() => void) },
    { label: "Yêu cầu mới cần gọi", v: String(newM), sub: firstNew ? `Bấm để mở ngày ${Number(firstNew.slice(8, 10))}` : "Không có yêu cầu mới", c: newM ? "oklch(0.58 0.17 45)" : "oklch(0.22 0.03 160)", run: firstNew ? () => pickDay(firstNew) : null },
    { label: "Ngày hết vé", v: String(tightDays), sub: "Ẩn khỏi tìm kiếm cabin & combo", c: tightDays ? "oklch(0.55 0.19 28)" : "oklch(0.22 0.03 160)", run: null },
  ];

  const cellH = tiny ? (dir === "both" ? 72 : 58) : mobile ? 86 : 104;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header: tháng */}
      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <div onClick={() => router.push(`/admin/availability?service=${serviceId}&month=${prevMonth}`)} style={navBtn}>‹</div>
        <div style={{ minWidth: 120, textAlign: "center", fontSize: 16, fontWeight: 800 }}>{monthLabel}</div>
        <div onClick={() => router.push(`/admin/availability?service=${serviceId}&month=${nextMonth}`)} style={navBtn}>›</div>
      </div>

      <BulkSoldOut busy={busy} call={call} defaultFrom={todayKey ?? days[0] ?? ""} />

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,180px),1fr))", gap: 10 }}>
        {kpis.map((k) => (
          <div key={k.label} onClick={k.run ?? undefined} style={{ cursor: k.run ? "pointer" : "default", background: "white", border: "1px solid oklch(0.91 0.01 150)", borderRadius: 16, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 2 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: M }}>{k.label}</div>
            <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-.02em", color: k.c }}>{k.v}</div>
            <div style={{ fontSize: 12, color: "oklch(0.52 0.02 160)" }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Direction toggle + legend */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ display: "inline-flex", gap: 4, padding: 4, borderRadius: 12, background: "oklch(0.93 0.008 150)" }}>
          {([["both", "Cả hai chiều"], ["di", "Chiều đi 21:00"], ["ve", "Chiều về 12:00"]] as const).map(([k, name]) => (
            <div key={k} onClick={() => { setDir(k); setAdding(null); }} style={{ cursor: "pointer", fontSize: 14, fontWeight: 700, padding: "8px 14px", borderRadius: 9, whiteSpace: "nowrap", background: dir === k ? "white" : "transparent", color: dir === k ? G : "oklch(0.42 0.02 160)", boxShadow: dir === k ? "0 1px 3px oklch(0.2 0.03 160 / .15)" : "none" }}>{name}</div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 12, fontWeight: 600, color: "oklch(0.45 0.02 160)" }}>
          <span><b>Đang bán</b> = mặc định luôn còn chỗ</span>
          <span><b>đặt/tổng</b> = vé đã đặt / tổng chỗ</span>
          <span style={{ color: "oklch(0.5 0.17 28)" }}><b>Hết vé</b> = ẩn khỏi tìm kiếm cabin & combo</span>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: O }} />Có yêu cầu mới</span>
        </div>
      </div>

      {/* Body: calendar + panel */}
      <div style={{ display: "grid", gridTemplateColumns: mobile ? "minmax(0,1fr)" : "minmax(0,1fr) 360px", gap: 16, alignItems: "start" }}>
        <div style={{ background: "white", border: "1px solid oklch(0.91 0.01 150)", borderRadius: 20, padding: mobile ? 10 : 16, minWidth: 0 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,minmax(0,1fr))", gap: tiny ? 4 : 6 }}>
            {WDS.map((n, i) => (
              <div key={n} style={{ textAlign: "center", fontSize: 12, fontWeight: 700, color: i >= 5 ? "oklch(0.5 0.13 45)" : "oklch(0.5 0.02 160)", paddingBottom: 4 }}>{n}</div>
            ))}
            {Array.from({ length: firstOffset }).map((_, i) => <div key={`b${i}`} style={{ visibility: "hidden" }} />)}
            {days.map((dk) => {
              const day = data[dk];
              const allClosed = dirKeys.every((k) => day?.[k] && !day[k]!.open);
              const newN = dirKeys.reduce((a, k) => a + (day?.[k]?.tickets.filter((b) => b.status === "new").length ?? 0), 0);
              const isToday = dk === todayKey;
              const on = sel === dk;
              return (
                <div key={dk} onClick={() => pickDay(dk)} style={{
                  minWidth: 0, overflow: "hidden", minHeight: cellH, borderRadius: 14, padding: 8, display: "flex", flexDirection: "column", gap: 6, cursor: "pointer",
                  background: allClosed ? "oklch(0.975 0.01 28)" : "white",
                  border: isToday ? `1.5px solid ${O}` : allClosed ? "1px solid oklch(0.9 0.04 28)" : "1px solid oklch(0.92 0.01 150)",
                  boxShadow: on ? `0 0 0 2.5px ${G}` : "none",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 800, color: dow(dk) === 0 || dow(dk) === 6 ? "oklch(0.5 0.13 45)" : "oklch(0.3 0.02 160)" }}>{Number(dk.slice(8, 10))}</span>
                    {newN > 0 && <span style={{ minWidth: 18, height: 18, padding: "0 5px", borderRadius: 9, background: O, color: "white", fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{newN}</span>}
                  </div>
                  {dirKeys.map((k) => {
                    const f = fill(day?.[k] ?? null);
                    return (
                      <div key={k} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 4, fontSize: 12 }}>
                          {!compact && <span style={{ fontWeight: 600, color: "oklch(0.5 0.02 160)" }}>{DIR_META[k].title.replace("Chiều ", "")}</span>}
                          <span style={{ fontWeight: 800, color: f.fc, whiteSpace: "nowrap" }}>{f.txt}</span>
                        </div>
                        <div style={{ height: 5, borderRadius: 3, background: f.track, overflow: "hidden" }}><div style={{ height: "100%", width: f.pct, background: f.bar, borderRadius: 3 }} /></div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        {/* Panel (desktop) / sheet (mobile) */}
        {mobile && open && <div onClick={closeDay} style={{ position: "fixed", inset: 0, zIndex: 19, background: "oklch(0.2 0.03 160 / .35)" }} />}
        {(sel && (!mobile || open)) && (
          <div style={{
            position: mobile ? "fixed" : "sticky", top: mobile ? "auto" : 16, left: mobile ? 0 : "auto", right: mobile ? 0 : "auto", bottom: mobile ? 0 : "auto",
            zIndex: mobile ? 20 : 1, maxHeight: mobile ? "86vh" : "calc(100vh - 32px)", overflowY: "auto",
            borderRadius: mobile ? "22px 22px 0 0" : 20, background: "white", border: "1px solid oklch(0.91 0.01 150)",
            boxShadow: mobile ? "0 -14px 40px -12px oklch(0.2 0.03 160 / .35)" : "none",
          }}>
            <DayPanel
              dk={sel}
              dirKeys={dirKeys}
              day={data[sel] ?? { di: null, ve: null }}
              mobile={mobile}
              busy={busy}
              adding={adding}
              setAdding={setAdding}
              form={form}
              setForm={setForm}
              ctvOptions={ctvOptions}
              call={call}
              closeDay={closeDay}
            />
          </div>
        )}
      </div>
    </div>
  );
}

const navBtn: React.CSSProperties = {
  cursor: "pointer", width: 40, height: 40, borderRadius: 12, background: "white",
  border: "1px solid oklch(0.9 0.01 150)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
};

function DayPanel({
  dk, dirKeys, day, mobile, busy, adding, setAdding, form, setForm, ctvOptions, call, closeDay,
}: {
  dk: string;
  dirKeys: ("di" | "ve")[];
  day: CabinDay;
  mobile: boolean;
  busy: boolean;
  adding: "di" | "ve" | null;
  setAdding: (v: "di" | "ve" | null) => void;
  form: { name: string; phone: string; seats: number; src: "phone" | "ctv"; ctv: string; err: string };
  setForm: (f: typeof form) => void;
  ctvOptions: { id: string; name: string }[];
  call: (p: Record<string, unknown>) => Promise<boolean>;
  closeDay: () => void;
}) {
  const dName = ["Chủ nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"][dow(dk)];
  const dayBooked = dirKeys.reduce((a, k) => a + (day[k]?.booked ?? 0), 0);

  async function saveAdd(k: "di" | "ve") {
    const ok = await call({ op: "addTicket", date: dk, direction: k === "ve" ? "RETURN" : "OUTBOUND", name: form.name, phone: form.phone, seats: form.seats, source: form.src, ctvId: form.src === "ctv" ? form.ctv : null });
    if (ok) setAdding(null);
  }

  return (
    <>
      <div style={{ position: "sticky", top: 0, zIndex: 1, background: "white", padding: "14px 16px 12px", borderBottom: "1px solid oklch(0.94 0.01 150)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>{dName}, {Number(dk.slice(8, 10))}/{Number(dk.slice(5, 7))}</div>
          <div style={{ fontSize: 13, color: M, marginTop: 2 }}>{dayBooked} vé đã đặt</div>
        </div>
        {mobile && <div onClick={closeDay} style={{ cursor: "pointer", fontSize: 15, fontWeight: 700, padding: "10px 16px", borderRadius: 12, background: G, color: "white" }}>Xong</div>}
      </div>

      {dirKeys.map((k) => {
        const meta = DIR_META[k];
        // Chưa có chuyến ⇒ đang bán mặc định (chuyến thật tạo khi có vé / khi chỉnh).
        const t: CabinDir = day[k] ?? { tripId: null, open: true, total: 0, booked: 0, price: 0, time: meta.defTime, route: "", tickets: [] };
        const isDefault = !t.tripId;
        const free = t ? Math.max(0, t.total - t.booked) : 0;
        const pct = t && t.total ? Math.min(100, (t.booked / t.total) * 100) + "%" : "0%";
        return (
          <section key={k} style={{ padding: 16, borderBottom: "6px solid oklch(0.965 0.005 150)", display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800 }}>{meta.title} · {t?.time ?? meta.defTime}</div>
                <div style={{ fontSize: 12, color: M, marginTop: 2 }}>{t?.route ?? ""}</div>
              </div>
              <div onClick={() => !busy && call({ op: "saveTrip", date: dk, direction: k === "ve" ? "RETURN" : "OUTBOUND", open: !t.open })}
                title={t.open ? "Bấm để đánh dấu HẾT VÉ (ẩn khỏi tìm kiếm)" : "Bấm để mở bán lại"}
                style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700, whiteSpace: "nowrap", color: t.open ? "oklch(0.38 0.1 155)" : "oklch(0.5 0.17 28)" }}>
                <span>{t.open ? "Đang bán" : "Hết vé"}</span>
                <span style={{ width: 38, height: 22, borderRadius: 11, background: t.open ? "oklch(0.6 0.13 155)" : "oklch(0.75 0.08 28)", position: "relative" }}>
                  <span style={{ position: "absolute", top: 3, left: t.open ? 19 : 3, width: 16, height: 16, borderRadius: "50%", background: "white" }} />
                </span>
              </div>
            </div>

            {!t.open && (
              <div style={{ padding: "10px 12px", borderRadius: 12, background: "oklch(0.97 0.02 28)", fontSize: 13, color: "oklch(0.45 0.15 28)", fontWeight: 600 }}>
                Ngày này đã đánh dấu hết vé — khách không thấy nhà xe khi tìm cabin / combo ngày này.
              </div>
            )}
            {isDefault ? (
              <div style={{ padding: "10px 12px", borderRadius: 12, background: "oklch(0.97 0.02 155)", fontSize: 13, color: "oklch(0.38 0.1 155)", lineHeight: 1.5 }}>
                Đang bán mặc định, luôn còn chỗ. Giờ chạy & giá theo chuyến gần nhất / bảng giá chặng. Chưa có vé nào.
              </div>
            ) : (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <div style={{ padding: 12, borderRadius: 14, background: "oklch(0.97 0.006 150)" }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: M }}>Đã đặt</div>
                    <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-.02em" }}>{t.booked} <span style={{ fontSize: 14, color: "oklch(0.5 0.02 160)" }}>vé</span></div>
                  </div>
                  <div style={{ padding: 12, borderRadius: 14, background: free <= 0 ? "oklch(0.97 0.015 28)" : free <= 3 ? "oklch(0.97 0.03 70)" : "oklch(0.97 0.025 155)" }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: M }}>Còn trống</div>
                    <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-.02em", color: free <= 0 ? "oklch(0.55 0.19 28)" : free <= 3 ? "oklch(0.55 0.15 50)" : "oklch(0.4 0.12 155)" }}>{free} <span style={{ fontSize: 14, color: "oklch(0.5 0.02 160)" }}>chỗ</span></div>
                  </div>
                </div>
                <div style={{ height: 8, borderRadius: 4, background: "oklch(0.93 0.008 150)", overflow: "hidden" }}><div style={{ height: "100%", width: pct, background: free <= 0 ? "oklch(0.58 0.19 28)" : "oklch(0.6 0.13 155)" }} /></div>

                <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 8 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: M }}>Tổng chỗ bán</div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: 4, borderRadius: 12, border: "1px solid oklch(0.88 0.01 150)" }}>
                      <div onClick={() => !busy && call({ op: "saveTrip", date: dk, direction: k === "ve" ? "RETURN" : "OUTBOUND", seatsTotal: t.total - 1 })} style={stepBtn}>−</div>
                      <div style={{ fontSize: 16, fontWeight: 800 }}>{t.total}</div>
                      <div onClick={() => !busy && call({ op: "saveTrip", date: dk, direction: k === "ve" ? "RETURN" : "OUTBOUND", seatsTotal: t.total + 1 })} style={stepBtn}>+</div>
                    </div>
                  </div>
                  <PriceField k={k} dk={dk} price={t.price} busy={busy} call={call} />
                </div>
              </>
            )}

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 800 }}>Danh sách vé · {t.tickets.filter((x) => x.status !== "cancel").length} khách</div>
                  </div>
                  <div onClick={() => setAdding(adding === k ? null : k)} style={{ cursor: "pointer", fontSize: 13, fontWeight: 700, color: "oklch(0.5 0.16 45)" }}>+ Thêm vé</div>
                </div>

                {adding === k && (
                  <div style={{ padding: 12, borderRadius: 14, background: "oklch(0.97 0.02 70)", display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>Nguồn</span>
                      {(["phone", "ctv"] as const).map((srcK) => (
                        <div key={srcK} onClick={() => setForm({ ...form, src: srcK, err: "" })} style={{ cursor: "pointer", fontSize: 13, fontWeight: 700, padding: "7px 12px", borderRadius: 9, background: form.src === srcK ? G : "white", color: form.src === srcK ? "white" : "oklch(0.35 0.02 160)" }}>{srcK === "ctv" ? "CTV" : "Khách gọi"}</div>
                      ))}
                    </div>
                    {form.src === "ctv" && ctvOptions.length > 0 && (
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {ctvOptions.map((o) => (
                          <div key={o.id} onClick={() => setForm({ ...form, ctv: o.id, err: "" })} style={{ cursor: "pointer", fontSize: 13, fontWeight: 700, padding: "7px 12px", borderRadius: 9, background: form.ctv === o.id ? "oklch(0.45 0.13 310)" : "white", color: form.ctv === o.id ? "white" : "oklch(0.35 0.02 160)" }}>{o.name}</div>
                        ))}
                      </div>
                    )}
                    <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value, err: "" })} placeholder="Tên khách" style={addInp} />
                    <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value, err: "" })} inputMode="tel" placeholder="Số điện thoại" style={addInp} />
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>Số vé</span>
                        <div onClick={() => setForm({ ...form, seats: Math.max(1, form.seats - 1) })} style={{ ...stepBtn, width: 32, height: 32, background: "white" }}>−</div>
                        <span style={{ fontWeight: 800, minWidth: 14, textAlign: "center" }}>{form.seats}</span>
                        <div onClick={() => setForm({ ...form, seats: Math.min(20, form.seats + 1) })} style={{ ...stepBtn, width: 32, height: 32, background: "white" }}>+</div>
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <div onClick={() => setAdding(null)} style={{ cursor: "pointer", fontSize: 14, fontWeight: 700, padding: "9px 12px", borderRadius: 10, background: "white" }}>Huỷ</div>
                        <div onClick={() => !busy && saveAdd(k)} style={{ cursor: "pointer", fontSize: 14, fontWeight: 700, padding: "9px 14px", borderRadius: 10, background: O, color: "white" }}>Lưu vé</div>
                      </div>
                    </div>
                  </div>
                )}

                {t.tickets.length === 0 ? (
                  <div style={{ fontSize: 13, color: "oklch(0.52 0.02 160)", padding: "10px 0" }}>Chưa có vé nào cho chuyến này.</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    {t.tickets.map((b) => (
                      <div key={b.id} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: "6px 10px", alignItems: "center", padding: "10px 0", borderTop: "1px solid oklch(0.95 0.005 150)", opacity: b.status === "cancel" ? 0.5 : 1 }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{b.name}</div>
                          <div style={{ fontSize: 12, color: "oklch(0.5 0.02 160)", display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginTop: 2 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 6, whiteSpace: "nowrap", background: b.isCtv ? "oklch(0.94 0.05 310)" : "oklch(0.95 0.01 160)", color: b.isCtv ? "oklch(0.45 0.13 310)" : "oklch(0.4 0.03 160)" }}>{b.srcLabel}</span>
                            <a href={`tel:${b.phone}`} style={{ fontWeight: 600 }}>{b.phone}</a>
                            <span>· {b.code}</span>
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, justifySelf: "end" }}>
                          <span style={{ fontSize: 13, fontWeight: 800, whiteSpace: "nowrap" }}>{b.seats} vé</span>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: "4px 8px", borderRadius: 999, whiteSpace: "nowrap", background: ST_META[b.status][1], color: ST_META[b.status][2] }}>{ST_META[b.status][0]}</span>
                        </div>
                        {b.status === "new" && (
                          <div style={{ gridColumn: "1 / -1", display: "flex", gap: 6 }}>
                            <div onClick={() => !busy && call({ op: "confirm", bookingId: b.id })} style={{ cursor: "pointer", flex: 1, textAlign: "center", fontSize: 13, fontWeight: 700, padding: 8, borderRadius: 9, background: G, color: "white" }}>Xác nhận</div>
                            <a href={`tel:${b.phone}`} style={{ flex: 1, textAlign: "center", fontSize: 13, fontWeight: 700, padding: 8, borderRadius: 9, background: "oklch(0.955 0.006 150)", color: G }}>Gọi khách</a>
                            <div onClick={() => !busy && call({ op: "cancel", bookingId: b.id })} style={{ cursor: "pointer", textAlign: "center", fontSize: 13, fontWeight: 700, padding: "8px 12px", borderRadius: 9, color: "oklch(0.5 0.15 28)" }}>Huỷ</div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
          </section>
        );
      })}
    </>
  );
}

const stepBtn: React.CSSProperties = { cursor: "pointer", width: 34, height: 34, borderRadius: 9, background: "oklch(0.955 0.006 150)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 700 };
const addInp: React.CSSProperties = { fontSize: 15, padding: "10px 12px", borderRadius: 10, border: "1px solid oklch(0.86 0.02 70)", outline: "none" };

function PriceField({ k, dk, price, busy, call }: { k: "di" | "ve"; dk: string; price: number; busy: boolean; call: (p: Record<string, unknown>) => Promise<boolean>; }) {
  const [v, setV] = useState(String(Math.round(price / 1000)));
  useEffect(() => { setV(String(Math.round(price / 1000))); }, [price]);
  function save() {
    const n = parseInt(v.replace(/\D/g, ""), 10);
    if (!n) return;
    const np = n < 10000 ? n * 1000 : n;
    if (np !== price) call({ op: "saveTrip", date: dk, direction: k === "ve" ? "RETURN" : "OUTBOUND", price: np });
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: M }}>Giá vé (nghìn đ)</div>
      <input value={v} disabled={busy} onChange={(e) => setV(e.target.value)} onBlur={save} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} inputMode="numeric" style={{ width: "100%", minWidth: 0, height: 44, fontSize: 16, fontWeight: 800, padding: "0 12px", borderRadius: 12, border: "1px solid oklch(0.88 0.01 150)", outline: "none" }} />
    </div>
  );
}

/** Đánh dấu HẾT VÉ (hoặc mở bán lại) cho một khoảng ngày — ngày hết vé bị loại khỏi tìm kiếm cabin & combo. */
function BulkSoldOut({ busy, call, defaultFrom }: { busy: boolean; call: (p: Record<string, unknown>) => Promise<boolean>; defaultFrom: string }) {
  const [openForm, setOpenForm] = useState(false);
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultFrom);
  const [direction, setDirection] = useState<"BOTH" | "OUTBOUND" | "RETURN">("BOTH");
  const [msg, setMsg] = useState("");
  async function run(closed: boolean) {
    setMsg("");
    if (!from) { setMsg("Chọn ngày bắt đầu."); return; }
    const end = to || from;
    if (end < from) { setMsg("Ngày kết thúc phải từ ngày bắt đầu trở đi."); return; }
    const ok = await call({ op: "bulkClose", from, to: end, direction, closed });
    if (ok) setMsg(closed ? "Đã đánh dấu hết vé." : "Đã mở bán lại.");
  }
  const inp: React.CSSProperties = { height: 40, fontSize: 14, padding: "0 10px", borderRadius: 10, border: "1px solid oklch(0.88 0.01 150)", outline: "none", background: "white", minWidth: 0 };
  return (
    <div style={{ background: "white", border: "1px solid oklch(0.91 0.01 150)", borderRadius: 16, padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800 }}>Ngày hết vé</div>
          <div style={{ fontSize: 12, color: M }}>Lịch luôn mở bán, không cần tạo chuyến. Thêm ngày hết vé để ẩn nhà xe khỏi tìm kiếm cabin & combo.</div>
        </div>
        <div onClick={() => setOpenForm(!openForm)} style={{ cursor: "pointer", fontSize: 13, fontWeight: 700, padding: "8px 12px", borderRadius: 10, background: openForm ? "oklch(0.955 0.006 150)" : "oklch(0.95 0.04 28)", color: openForm ? G : "oklch(0.48 0.16 28)", whiteSpace: "nowrap" }}>
          {openForm ? "Đóng" : "+ Thêm ngày hết vé"}
        </div>
      </div>
      {openForm && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "flex-end" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontWeight: 600, color: M }}>
            Từ ngày
            <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); if (!to || to < e.target.value) setTo(e.target.value); }} style={inp} />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontWeight: 600, color: M }}>
            Đến ngày
            <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} style={inp} />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontWeight: 600, color: M }}>
            Chiều
            <select value={direction} onChange={(e) => setDirection(e.target.value as typeof direction)} style={inp}>
              <option value="BOTH">Cả đi & về</option>
              <option value="OUTBOUND">Chiều đi</option>
              <option value="RETURN">Chiều về</option>
            </select>
          </label>
          <div onClick={() => !busy && run(true)} style={{ cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1, height: 40, display: "flex", alignItems: "center", fontSize: 14, fontWeight: 700, padding: "0 14px", borderRadius: 10, background: "oklch(0.58 0.18 28)", color: "white", whiteSpace: "nowrap" }}>Đánh dấu hết vé</div>
          <div onClick={() => !busy && run(false)} style={{ cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1, height: 40, display: "flex", alignItems: "center", fontSize: 14, fontWeight: 700, padding: "0 14px", borderRadius: 10, background: "oklch(0.955 0.006 150)", color: G, whiteSpace: "nowrap" }}>Mở bán lại</div>
          {msg && <div style={{ fontSize: 13, fontWeight: 600, color: "oklch(0.4 0.1 155)", alignSelf: "center" }}>{msg}</div>}
        </div>
      )}
    </div>
  );
}
