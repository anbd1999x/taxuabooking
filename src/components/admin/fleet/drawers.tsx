"use client";

import { useState, type ReactNode } from "react";
import {
  FLEET_ACC,
  FLEET_CONDS,
  FLEET_DOCS,
  FLEET_KINDS,
  FUEL_LEVELS,
  SERVICE_PRESETS,
  autoPick,
  diffDays,
  addDaysKey,
  dowOf,
  feeSum,
  isVehicleFree,
  quoteRental,
  rentalBlocks,
  rentalSpan,
  rentalStatus,
  stamp,
  returnFees,
  vehicleStatusOn,
  type FleetCond,
  type FleetKind,
  type FleetMode,
  type FleetRentalVM,
  type FleetStatus,
  type FleetVehicleVM,
} from "@/lib/fleet-core";
import {
  BORDER, COND, G, MUTED, O, RED, ST, TYC, WDL, Thumb, Toggle,
  at2, btn, card, digits, dm, dmy, inputCls, lbl, mask, money, pill, short, softPill,
  type CallFn, type FleetData,
} from "./ui";
import { MediaManager, uploadFleetFile } from "./media";

export type Drawer =
  | { kind: "veh"; id: string }
  | { kind: "edit"; id?: string; copyOf?: string }
  | { kind: "order"; pre?: Partial<OrderState> }
  | { kind: "book"; id: string }
  | { kind: "svc"; id: string }
  | null;

export type Ctx = {
  data: FleetData;
  serviceId: string;
  webTypes: { id: string; name: string }[];
  hotline: string;
  isStaff: boolean;
  busy: boolean;
  call: CallFn;
  say: (t: string) => void;
  setDr: (d: Drawer) => void;
  afterCreate: (s: string) => void;
  /** Người xem đăng nhập bằng tài khoản nhân viên (không chỉ đang xem chế độ nhân viên). */
  viewerStaff: boolean;
};

type Act = { name: string; go: () => void; kind?: "pri" | "orange" | "danger" | "ghost"; flex?: number };

export function DrawerShell({ kicker, title, actions, busy, onClose, children }: { kicker: string; title: string; actions: Act[]; busy: boolean; onClose: () => void; children: ReactNode }) {
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 70, background: "oklch(0.15 0.03 165 / .45)", backdropFilter: "blur(2px)" }} />
      <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, zIndex: 71, width: "min(540px,100vw)", background: "oklch(0.985 0.004 160)", display: "flex", flexDirection: "column", boxShadow: "-30px 0 60px -20px oklch(0.15 0.03 165 / .5)", animation: "fleetSlide .3s cubic-bezier(.2,.8,.2,1) both" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "14px 18px", background: "white", borderBottom: "1px solid oklch(0.93 0.008 160)" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: "oklch(0.5 0.08 158)" }}>{kicker}</div>
            <div style={{ fontSize: 19, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</div>
          </div>
          <div onClick={onClose} style={{ cursor: "pointer", width: 38, height: 38, borderRadius: "50%", background: "oklch(0.95 0.005 160)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 700, flex: "none" }}>×</div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px 24px", display: "flex", flexDirection: "column", gap: 14 }}>{children}</div>
        {actions.length > 0 && (
          <div style={{ display: "flex", gap: 8, padding: "12px 18px calc(12px + env(safe-area-inset-bottom))", background: "white", borderTop: "1px solid oklch(0.93 0.008 160)" }}>
            {actions.map((a) => (
              <button key={a.name} type="button" disabled={busy} onClick={a.go} style={{ ...btn(a.kind), flex: a.flex ?? 1, fontSize: 14, padding: "13px 14px", textAlign: "center", opacity: busy ? 0.7 : 1, cursor: busy ? "wait" : "pointer" }}>
                {a.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

const Fact = ({ k, v, c }: { k: string; v: ReactNode; c?: string }) => (
  <div style={{ ...card, borderRadius: 12, padding: "10px 12px" }}><div style={{ fontSize: 12, color: MUTED }}>{k}</div><div style={{ fontSize: 15, fontWeight: 800, color: c || undefined }}>{v}</div></div>
);
const SoftFact = ({ k, v }: { k: string; v: ReactNode }) => (
  <div style={{ padding: "9px 11px", borderRadius: 11, background: "oklch(0.975 0.004 160)" }}><div style={{ fontSize: 12, color: MUTED }}>{k}</div><div style={{ fontSize: 14, fontWeight: 800 }}>{v}</div></div>
);
const Chips = ({ list, isOn, pick }: { list: readonly string[]; isOn: (n: string) => boolean; pick: (n: string) => void }) => (
  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{list.map((n) => <div key={n} onClick={() => pick(n)} style={softPill(isOn(n))}>{n}</div>)}</div>
);
const Group = ({ label, children }: { label: string; children: ReactNode }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}><span style={{ fontSize: 12, fontWeight: 700, color: MUTED }}>{label}</span>{children}</div>
);

export function payOf(b: FleetRentalVM, T: string, NOW: string): [string, string] {
  const due = b.total + feeSum(b);
  if (rentalStatus(b, T, NOW) === "cancel") return ["Đã huỷ", "oklch(0.55 0.16 28)"];
  if (b.deposit >= due) return ["Đã thu đủ " + money(due), "oklch(0.42 0.11 155)"];
  if (b.deposit) return ["Đã thu " + money(b.deposit) + " · còn " + money(due - b.deposit), "oklch(0.5 0.13 60)"];
  return ["Chưa cọc · " + money(due), "oklch(0.55 0.16 28)"];
}

// ======================= CHI TIẾT XE =======================
export function VehicleDrawer({ ctx, id }: { ctx: Ctx; id: string }) {
  const { data, call, setDr } = ctx;
  const { today: T, now: NOW } = data;
  const v = data.vehicles.find((x) => x.id === id);
  if (!v) return null;
  const L = data.rentals.filter((b) => !b.cancelled);
  const bst = (b: FleetRentalVM) => rentalStatus(b, T, NOW);
  const x = vehicleStatusOn(v, T, data.rentals, T, NOW), M = ST[x.key], C = COND[v.cond];
  const cur = x.r ?? L.filter((b) => b.vid === v.id && b.s > T && bst(b) === "deposit").sort((a, b) => a.s.localeCompare(b.s))[0];
  const up = L.filter((b) => b.vid === v.id && b.e >= T && b !== cur && bst(b) !== "done").sort((a, b) => a.s.localeCompare(b.s));
  const yr = T.slice(0, 4);
  const past = L.filter((b) => b.vid === v.id && bst(b) === "done" && b.s.slice(0, 4) === yr);
  const cs = cur ? ST[bst(cur)] : null, py = cur ? payOf(cur, T, NOW) : ["", ""];
  const web = ctx.webTypes.find((t) => t.id === v.rentalVehicleId);
  const specs = [
    { k: "Giá thuê", v: money(v.price) + "/ngày" },
    { k: "Đời xe", v: v.year ? String(v.year) : "—" },
    { k: "Số km (ODO)", v: v.odo.toLocaleString("vi-VN") + " km" },
    { k: "Trạng thái cấu hình", v: v.mode === "ready" ? "Sẵn sàng cho thuê" : ST[v.mode][0] },
    { k: "Ghi chú", v: v.note || "—" },
    { k: "Đơn năm " + yr, v: L.filter((b) => b.vid === v.id && b.s.slice(0, 4) === yr).length + " đơn" },
    ...(ctx.webTypes.length ? [{ k: "Loại xe trên web", v: web?.name ?? "Chưa gắn" }] : []),
    { k: "Hạn bảo hiểm", v: v.insExp ? dmy(v.insExp) : "Chưa nhập" },
  ];
  const actions: Act[] = ctx.isStaff
    ? [...(v.mode === "ready" ? [{ name: "Tạo đơn", go: () => setDr({ kind: "order", pre: { kind: v.kind, s: T, e: addDaysKey(T, 1), picks: [v.id] } }), kind: "orange" as const }] : [])]
    : [
        { name: "Sửa", go: () => setDr({ kind: "edit", id: v.id }) },
        { name: "Nhân đôi", go: () => setDr({ kind: "edit", copyOf: v.id }) },
        v.mode === "ready"
          ? { name: "Bảo dưỡng", go: () => call({ op: "setMode", id: v.id, mode: "maint" }) }
          : { name: v.mode === "maint" ? "Đưa vào cho thuê" : "Cho thuê lại", go: () => call({ op: "setMode", id: v.id, mode: "ready" }) },
        ...(v.mode === "ready" ? [{ name: "Tạo đơn", go: () => setDr({ kind: "order", pre: { kind: v.kind, s: T, e: addDaysKey(T, 1), picks: [v.id] } }), kind: "orange" as const }] : []),
      ];
  return (
    <DrawerShell kicker={FLEET_KINDS[v.kind] + (v.color ? " · " + v.color : "")} title={v.name} actions={actions} busy={ctx.busy} onClose={() => setDr(null)}>
      <MediaManager serviceId={ctx.serviceId} media={v.media} say={ctx.say} disabled={ctx.busy} onChange={(media) => call({ op: "setMedia", id: v.id, media })} />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontFamily: "ui-monospace,monospace", fontSize: 14, fontWeight: 800, padding: "6px 11px", borderRadius: 8, background: "white", border: "1.5px solid oklch(0.3 0.03 160)" }}>{v.plate}</span>
        <span style={{ fontSize: 13, fontWeight: 800, padding: "6px 12px", borderRadius: 999, background: M[1], color: M[2] }}>Hôm nay: {M[0]}</span>
        <span style={{ fontSize: 13, fontWeight: 700, padding: "6px 12px", borderRadius: 999, background: C[1], color: C[2] }}>{C[0]}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 8 }}>{specs.map((s) => <Fact key={s.k} k={s.k} v={s.v} />)}</div>
      {cur && cs && (
        <div onClick={() => setDr({ kind: "book", id: cur.id })} style={{ cursor: "pointer", padding: 14, borderRadius: 16, background: `color-mix(in oklch, ${cs[1]} 25%, white)`, border: `1.5px solid ${cs[3]}`, display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", color: cs[3] }}>{bst(cur) === "renting" || bst(cur) === "late" ? cs[0] : "Đã cọc · sắp giao"}</div>
          <div style={{ fontSize: 17, fontWeight: 800 }}>{cur.name} · {cur.phone}</div>
          <div style={{ fontSize: 14, color: "oklch(0.4 0.02 160)" }}>{dm(cur.s)} {cur.st} → {dm(cur.e)} {cur.et}{cur.place ? " · " + cur.place : ""}</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: py[1] }}>{py[0]}</div>
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ fontSize: 15, fontWeight: 800 }}>Lịch sắp tới</div>
        {!up.length && <div style={{ fontSize: 14, color: MUTED, padding: "10px 12px", borderRadius: 12, border: "1.5px dashed oklch(0.88 0.015 160)" }}>Chưa có đơn nào sắp tới.</div>}
        {up.slice(0, 6).map((b) => { const s2 = ST[bst(b)]; return (
          <div key={b.id} onClick={() => setDr({ kind: "book", id: b.id })} style={{ cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "10px 12px", ...card, borderRadius: 12 }}>
            <span style={{ minWidth: 0 }}><span style={{ display: "block", fontSize: 14, fontWeight: 800 }}>{dm(b.s)} → {dm(b.e)} · {diffDays(b.s, b.e) + 1} ngày</span><span style={{ display: "block", fontSize: 13, color: MUTED, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{b.name} · {b.phone}</span></span>
            <span style={{ fontSize: 12, fontWeight: 800, padding: "4px 10px", borderRadius: 999, background: s2[1], color: s2[2], whiteSpace: "nowrap" }}>{s2[0]}</span>
          </div>
        ); })}
      </div>
      {!ctx.isStaff && <div style={{ fontSize: 13, color: MUTED }}>Đã cho thuê {past.length} lần trong năm · doanh thu {money(past.reduce((a, b) => a + b.total + feeSum(b), 0))}</div>}
    </DrawerShell>
  );
}

// ======================= THÊM / SỬA XE =======================
type FormState = {
  id?: string; name: string; plate: string; kind: FleetKind; color: string; year: string; odo: string; price: string;
  cond: FleetCond; mode: FleetMode; note: string; media: string[]; rentalVehicleId: string; oilEvery: string; lastOil: string; insExp: string;
  err: string; errKey?: string;
};
export function EditDrawer({ ctx, id, copyOf }: { ctx: Ctx; id?: string; copyOf?: string }) {
  const { data, call, setDr, say } = ctx;
  const T = data.today;
  const v = id ? data.vehicles.find((x) => x.id === id) : undefined;
  // Nhân đôi: chép mọi thông tin của xe nguồn (ảnh, loại, màu, đời, giá, tình trạng, loại xe web, chu kỳ nhớt),
  // chỉ để trống biển số + hạn bảo hiểm + ghi chú — vì đó là thông tin riêng từng chiếc.
  const src = copyOf ? data.vehicles.find((x) => x.id === copyOf) : undefined;
  const [f, setForm] = useState<FormState>(() =>
    src
      ? { name: src.name, plate: "", kind: src.kind, color: src.color, year: src.year ? String(src.year) : "", odo: String(src.odo), price: String(src.price), cond: src.cond, mode: src.mode === "off" ? "ready" : src.mode, note: "", media: [...src.media], rentalVehicleId: src.rentalVehicleId ?? "", oilEvery: String(src.oilEvery), lastOil: "", insExp: "", err: "", errKey: "plate" }
      : v
      ? { id: v.id, name: v.name, plate: v.plate, kind: v.kind, color: v.color, year: v.year ? String(v.year) : "", odo: String(v.odo), price: String(v.price), cond: v.cond, mode: v.mode, note: v.note, media: v.media, rentalVehicleId: v.rentalVehicleId ?? "", oilEvery: String(v.oilEvery), lastOil: String(v.lastOil), insExp: v.insExp ?? "", err: "" }
      : { name: "", plate: "", kind: "ga", color: "", year: String(Number(T.slice(0, 4)) - 2), odo: "0", price: "200000", cond: "good", mode: "ready", note: "", media: [], rentalVehicleId: "", oilEvery: "2000", lastOil: "", insExp: "", err: "" },
  );
  const setF = (patch: Partial<FormState>) => setForm((x) => ({ ...x, ...patch, err: "" }));
  const fields: [string, keyof FormState, string, "text" | "numeric", string][] = [
    ["Tên xe", "name", "VD: Honda Vision", "text", "1 / -1"],
    ["Biển số", "plate", "26B1-123.45", "text", "auto"],
    ["Màu", "color", "Trắng", "text", "auto"],
    ["Giá thuê / ngày (đ)", "price", "200000", "numeric", "auto"],
    ["Đời xe", "year", "2023", "numeric", "auto"],
    ["Số km (ODO)", "odo", "12000", "numeric", "auto"],
    ["Chu kỳ thay nhớt (km)", "oilEvery", "2000", "numeric", "auto"],
    ["ODO lần thay nhớt gần nhất", "lastOil", "Để trống = ODO hiện tại", "numeric", "auto"],
  ];
  const seg = <K extends "kind" | "cond" | "mode">(label: string, key: K, opts: [FormState[K], string, string][], hint = "") => (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontSize: 13, fontWeight: 700, color: "oklch(0.42 0.02 160)" }}>{label}</span>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {opts.map(([k2, name, dot]) => (
          <div key={String(k2)} onClick={() => setF({ [key]: k2 } as Partial<FormState>)} style={{ ...softPill(f[key] === k2), fontSize: 14, padding: "9px 14px" }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: dot }} />{name}</div>
        ))}
      </div>
      {hint && <span style={{ fontSize: 12, color: MUTED }}>{hint}</span>}
    </div>
  );
  const save = async () => {
    const pl = f.plate.trim().toUpperCase().replace(/\s+/g, "");
    const pr = digits(f.price);
    let err = "", errKey: keyof FormState | undefined;
    if (f.name.trim().length < 2) { err = "Nhập tên xe"; errKey = "name"; }
    else if (!/^\d{2}[A-Z]{1,2}\d?-?\d{3}\.?\d{2}$/.test(pl)) { err = "Biển số chưa đúng dạng, VD 26B1-123.45"; errKey = "plate"; }
    else if (data.vehicles.some((x) => x.plate === pl && x.id !== f.id)) { err = "Biển số này đã có trong đội xe"; errKey = "plate"; }
    else if (pr < 10000) { err = "Nhập giá thuê mỗi ngày"; errKey = "price"; }
    if (err) { setForm((x) => ({ ...x, err, errKey })); return; }
    const j = await call({ op: "saveVehicle", vehicle: { ...f, plate: pl, price: pr } });
    if (j?.savedId) setDr({ kind: "veh", id: j.savedId });
  };
  const actions: Act[] = [
    !v
      ? { name: "Huỷ", go: () => setDr(null) }
      : { name: "Xoá xe", kind: "danger", go: async () => { if (!confirm("Xoá xe " + v.plate + "?")) return; const j = await call({ op: "deleteVehicle", id: v.id }); if (j) setDr(null); } },
    { name: v ? "Lưu thay đổi" : "Thêm xe", go: save, kind: "pri", flex: 2 },
  ];
  return (
    <DrawerShell kicker={v ? "Sửa thông tin xe" : src ? "Nhân đôi từ " + src.plate : "Thêm xe mới"} title={f.name || "Xe chưa đặt tên"} actions={actions} busy={ctx.busy} onClose={() => setDr(null)}>
      {src && <div style={{ fontSize: 13, fontWeight: 700, padding: "10px 12px", borderRadius: 12, background: "oklch(0.95 0.03 250)", color: "oklch(0.4 0.12 250)" }}>Đã chép thông tin từ {src.name} · {src.plate}. Chỉ cần nhập <b>biển số</b> (và ODO, hạn bảo hiểm nếu khác) rồi bấm “Thêm xe”.</div>}
      <MediaManager serviceId={ctx.serviceId} media={f.media} say={say} onChange={(media) => setF({ media })} />
      {v && <span style={{ fontSize: 12, color: MUTED, marginTop: -6 }}>Ảnh/video thêm ở đây được lưu khi bấm “Lưu thay đổi”.</span>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 10 }}>
        {fields.map(([label, key, ph, im, span]) => (
          <label key={key} style={{ ...lbl, fontSize: 13, color: "oklch(0.42 0.02 160)", gridColumn: span }}>{label}
            <input value={String(f[key] ?? "")} onChange={(e) => setF({ [key]: e.target.value } as Partial<FormState>)} placeholder={ph} inputMode={im}
              style={{ ...inputCls, borderColor: f.err && f.errKey === key ? "oklch(0.6 0.19 28)" : "oklch(0.9 0.01 160)" }} />
          </label>
        ))}
        <label style={{ ...lbl, fontSize: 13, color: "oklch(0.42 0.02 160)", gridColumn: "1 / -1" }}>Hạn bảo hiểm TNDS
          <input type="date" value={f.insExp} onChange={(e) => setF({ insExp: e.target.value })} style={inputCls} />
        </label>
      </div>
      {seg("Loại xe", "kind", (Object.keys(FLEET_KINDS) as FleetKind[]).map((k2) => [k2, FLEET_KINDS[k2], TYC[k2]]))}
      {seg("Tình trạng xe", "cond", (Object.keys(FLEET_CONDS) as FleetCond[]).map((k2) => [k2, COND[k2][0], COND[k2][2]]))}
      {seg("Cấu hình cho thuê", "mode", [["ready", "Sẵn sàng cho thuê", ST.ready[3]], ["maint", "Bảo dưỡng", ST.maint[3]], ["off", "Ngừng cho thuê", ST.off[3]]],
        'Chỉ xe "Sẵn sàng" mới được tự xếp vào đơn mới. "Đang thuê" và "Đã cọc" tự cập nhật theo đơn.')}
      {ctx.webTypes.length > 0 && (
        <label style={{ ...lbl, fontSize: 13, color: "oklch(0.42 0.02 160)" }}>Thuộc loại xe bán trên web
          <select value={f.rentalVehicleId} onChange={(e) => setF({ rentalVehicleId: e.target.value })} style={inputCls}>
            <option value="">— Không gắn (nhận mọi đơn web) —</option>
            {ctx.webTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <span style={{ fontWeight: 500, color: MUTED }}>Khách đặt loại xe này trên web sẽ được tự xếp vào xe phù hợp.</span>
        </label>
      )}
      <label style={{ ...lbl, fontSize: 13, color: "oklch(0.42 0.02 160)" }}>Ghi chú tình trạng
        <textarea value={f.note} onChange={(e) => setF({ note: e.target.value })} rows={3} placeholder="VD: Xước nhẹ yếm trái, thay nhớt 12/11" style={{ ...inputCls, fontWeight: 500, resize: "vertical" }} />
      </label>
      {f.err && <div style={{ fontSize: 14, fontWeight: 700, color: RED }}>{f.err}</div>}
    </DrawerShell>
  );
}

// ======================= ĐƠN THUÊ MỚI =======================
export type OrderState = {
  s: string; st: string; e: string; et: string; kind: FleetKind; qty: number; name: string; phone: string; cccd: string;
  place: "store" | "home" | "far"; src: string; dep: number; picks: string[] | null; hourly: boolean; ctvName: string; err: string; errKey?: string;
};
export function OrderDrawer({ ctx, pre }: { ctx: Ctx; pre?: Partial<OrderState> }) {
  const { data, call, setDr } = ctx;
  const { today: T, now: NOW, vehicles: V, rentals: Bk, config: P } = data;
  const [o, setOrder] = useState<OrderState>(() => ({
    s: addDaysKey(T, 1), st: "08:00", e: addDaysKey(T, 2), et: "17:00", kind: "ga", qty: 1, name: "", phone: "", cccd: "",
    place: "store", src: "Zalo", dep: 0.3, picks: null, hourly: false, ctvName: "", err: "", ...pre,
  }));
  const setO = (patch: Partial<OrderState>) => setOrder((x) => ({ ...x, ...patch, err: "" }));
  const L = Bk.filter((b) => !b.cancelled);
  const ok = !!o.s && !!o.e && o.e >= o.s;
  const nd = ok ? diffDays(o.s, o.e) + 1 : 0;
  const pool = V.filter((v) => v.kind === o.kind && v.mode !== "off");
  // Theo GIỜ: xe trả 08:00 thì 08:00 cùng ngày đã nhận đơn mới được (không chừa khoảng nghỉ).
  const freeAll = ok ? autoPick(pool, o.s, o.e, pool.length, Bk, T, o.st, o.et, NOW) : [];
  const busyV = pool.filter((v) => !freeAll.includes(v));
  const picks = (o.picks ?? freeAll.slice(0, o.qty).map((v) => v.id)).filter((id) => freeAll.some((v) => v.id === id));
  const sel = picks.map((id) => V.find((v) => v.id === id)!).filter(Boolean);
  const hr = o.hourly && o.s === o.e;
  const qs = ok ? sel.map((v) => quoteRental(v, o.s, o.e, o.st, o.et, hr, P)) : [];
  const far = o.place === "far" ? P.far : 0;
  const total = qs.reduce((a, q) => a + q.t, 0) + (sel.length ? far : 0);
  const dep = o.dep === 1 ? total : Math.round((total * o.dep) / 10000) * 10000;
  const phN = o.phone.replace(/\s/g, "");
  const known = phN.length >= 10 ? Bk.filter((b) => b.phone === phN && b.ret).length : 0;
  const black = P.black[phN];
  const why = (v: FleetVehicleVM): [string, string] => {
    if (v.mode === "maint") return ["Đang bảo dưỡng", "oklch(0.55 0.16 28)"];
    const a0 = stamp(o.s, o.st), b0 = stamp(o.e, o.et);
    const b = L.find((x) => { if (x.vid !== v.id || !rentalBlocks(x, T, NOW)) return false; const [rs, re] = rentalSpan(x, T, NOW); return rs < b0 && a0 < re; });
    return b ? [`Bận ${dm(b.s)} ${b.st} – ${dm(b.e)} ${b.et} · ${b.name}`, "oklch(0.55 0.16 28)"] : ["", ""];
  };
  const short2 = o.qty - picks.length;
  const otherFree = ok ? (Object.keys(FLEET_KINDS) as FleetKind[]).filter((t) => t !== o.kind).map((t) => [t, V.filter((v) => v.kind === t && isVehicleFree(v, o.s, o.e, Bk, T, undefined, NOW, o.st, o.et)).length] as const).filter((x) => x[1]) : [];
  const asWarn = short2 > 0 || !ok;
  const fld = (label: string, key: "name" | "phone" | "cccd" | "ctvName", ph: string, im: "text" | "tel" | "numeric", span: string) => (
    <label key={key} style={{ ...lbl, gridColumn: span }}>{label}
      <input value={o[key]} onChange={(e) => setO({ [key]: e.target.value } as Partial<OrderState>)} placeholder={ph} inputMode={im}
        style={{ ...inputCls, borderColor: o.errKey === key ? "oklch(0.6 0.19 28)" : "oklch(0.9 0.01 160)" }} />
    </label>
  );
  const submit = async () => {
    let err = "", errKey: OrderState["errKey"];
    if (!ok) err = "Kiểm tra lại ngày nhận / trả xe";
    else if (o.s < T) err = "Ngày nhận xe đã qua";
    else if (!picks.length) err = "Chưa có xe nào được chọn";
    else if (o.name.trim().length < 2) { err = "Nhập họ tên người thuê"; errKey = "name"; }
    else if (!/^0\d{9}$/.test(phN)) { err = "Số điện thoại chưa đúng (10 số)"; errKey = "phone"; }
    if (err) { setOrder((x) => ({ ...x, err, errKey })); return; }
    if (black && !confirm("Khách trong danh sách đen: " + black + ". Vẫn tạo đơn?")) return;
    const j = await call({ op: "createRental", order: { ...o, phone: phN, picks, hourly: hr } });
    if (j?.savedId) { ctx.afterCreate(o.s); setDr({ kind: "book", id: j.savedId }); }
  };
  const actions: Act[] = [{ name: "Huỷ", go: () => setDr(null) }, { name: picks.length ? `Tạo đơn · ${picks.length} xe` : "Tạo đơn", go: submit, kind: "orange", flex: 2 }];
  const brk = qs.length ? qs[0].n.join(" · ") + (far ? " · giao xa +" + short(far) : "") : "";
  return (
    <DrawerShell kicker="Đơn thuê mới" title={ok ? `${dm(o.s)} → ${dm(o.e)} · ${nd} ngày` : "Chọn thời gian thuê"} actions={actions} busy={ctx.busy} onClose={() => setDr(null)}>
      <div style={{ ...card, padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ fontSize: 14, fontWeight: 800 }}>1. Thời gian thuê</div>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.4fr) minmax(0,1fr)", gap: 8 }}>
          <label style={lbl}>Nhận xe<input type="date" value={o.s} min={T} onChange={(e) => setO({ s: e.target.value, picks: null, ...(o.e < e.target.value ? { e: e.target.value } : {}) })} style={{ ...inputCls, fontWeight: 700 }} /></label>
          <label style={lbl}>Giờ<input type="time" value={o.st} onChange={(e) => setO({ st: e.target.value })} style={{ ...inputCls, fontWeight: 700 }} /></label>
          <label style={lbl}>Trả xe<input type="date" value={o.e} min={o.s || T} onChange={(e) => setO({ e: e.target.value, picks: null })} style={{ ...inputCls, fontWeight: 700 }} /></label>
          <label style={lbl}>Giờ<input type="time" value={o.et} onChange={(e) => setO({ et: e.target.value })} style={{ ...inputCls, fontWeight: 700 }} /></label>
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: "oklch(0.42 0.08 158)" }}>{ok ? `Tính ${nd} ngày thuê · ${WDL[dowOf(o.s)]} đến ${WDL[dowOf(o.e)].toLowerCase()}` : "Ngày trả phải sau hoặc trùng ngày nhận"}</div>
        {o.s === o.e && <Toggle on={hr} onClick={() => setO({ hourly: !o.hourly })}>Thuê theo giờ trong ngày</Toggle>}
      </div>

      <div style={{ ...card, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 800 }}>2. Loại xe &amp; số lượng</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span onClick={() => setO({ qty: Math.max(1, o.qty - 1), picks: null })} style={{ cursor: "pointer", width: 32, height: 32, borderRadius: 9, background: "oklch(0.95 0.005 160)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800 }}>−</span>
            <b style={{ fontSize: 16, minWidth: 18, textAlign: "center" }}>{o.qty}</b>
            <span onClick={() => setO({ qty: Math.min(10, o.qty + 1), picks: null })} style={{ cursor: "pointer", width: 32, height: 32, borderRadius: 9, background: "oklch(0.95 0.005 160)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800 }}>+</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {(Object.keys(FLEET_KINDS) as FleetKind[]).map((t) => (
            <div key={t} onClick={() => setO({ kind: t, picks: null })} style={{ ...pill(o.kind === t), fontSize: 14, padding: "9px 14px" }}>
              {FLEET_KINDS[t]} <span style={{ opacity: 0.65 }}>· {ok ? V.filter((v) => v.kind === t && isVehicleFree(v, o.s, o.e, Bk, T, undefined, NOW, o.st, o.et)).length : 0} trống</span>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "10px 12px", borderRadius: 12, background: asWarn ? "oklch(0.96 0.035 28)" : "oklch(0.95 0.04 155)", color: asWarn ? "oklch(0.5 0.16 28)" : "oklch(0.36 0.1 155)" }}>
          <span style={{ fontSize: 14, fontWeight: 800 }}>{!ok ? "Chọn ngày để xếp xe" : short2 > 0 ? `Chỉ còn ${freeAll.length} xe trống, thiếu ${short2} xe` : `Đã tự xếp ${picks.length} xe trống phù hợp`}</span>
          <span onClick={() => setO({ picks: null })} style={{ cursor: "pointer", fontSize: 13, fontWeight: 800, textDecoration: "underline", whiteSpace: "nowrap" }}>Tự xếp lại</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {[...freeAll, ...busyV].map((v) => {
            const on = picks.includes(v.id), isF = freeAll.includes(v);
            const yy: [string, string] = isF ? [(v.cond === "good" ? "Tình trạng tốt" : COND[v.cond][0]) + " · " + v.odo.toLocaleString("vi-VN") + " km", MUTED] : why(v);
            return (
              <div key={v.id} onClick={() => { if (!isF) return; const np = on ? picks.filter((id) => id !== v.id) : [...picks, v.id]; setO({ picks: np, qty: Math.max(1, np.length) }); }}
                style={{ cursor: isF ? "pointer" : "not-allowed", display: "grid", gridTemplateColumns: "22px 48px minmax(0,1fr) auto", gap: 10, alignItems: "center", padding: "8px 10px", borderRadius: 14, border: `1.5px solid ${on ? G : BORDER}`, background: on ? "oklch(0.97 0.02 155)" : "white", opacity: isF ? 1 : 0.5, transition: "all .15s" }}>
                <span style={{ width: 22, height: 22, borderRadius: 7, border: `2px solid ${on ? G : "oklch(0.8 0.01 160)"}`, background: on ? G : "white", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 900 }}>{on ? "✓" : ""}</span>
                <div style={{ width: 48, height: 38, borderRadius: 9, overflow: "hidden" }}><Thumb url={v.imageUrl} label=" " /></div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{v.name} <span style={{ fontFamily: "ui-monospace,monospace", fontSize: 12, color: MUTED }}>{v.plate}</span></div>
                  <div style={{ fontSize: 12, color: yy[1], whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{yy[0]}</div>
                </div>
                <span style={{ fontSize: 13, fontWeight: 800, whiteSpace: "nowrap" }}>{short(v.price)}/ng</span>
              </div>
            );
          })}
          {!pool.length && <div style={{ fontSize: 13, color: MUTED }}>Chưa có xe loại này trong đội xe.</div>}
        </div>
        {short2 > 0 && otherFree.length > 0 && <div style={{ fontSize: 13, color: "oklch(0.48 0.14 50)" }}>Gợi ý: còn {otherFree.map(([t, n]) => n + " " + FLEET_KINDS[t].toLowerCase()).join(", ")} trống cùng thời gian.</div>}
      </div>

      <div style={{ ...card, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontSize: 14, fontWeight: 800 }}>3. Người thuê</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 8 }}>
          {fld("Họ tên", "name", "Nguyễn Văn A", "text", "1 / -1")}
          {fld("Số điện thoại", "phone", "09xx xxx xxx", "tel", "auto")}
          {fld("CCCD (giữ khi giao xe)", "cccd", "12 số", "numeric", "auto")}
          {o.src === "CTV" && fld("CTV giới thiệu", "ctvName", "VD: Hà · CTV Mộc Châu", "text", "1 / -1")}
        </div>
        {black && <div style={{ fontSize: 13, fontWeight: 700, padding: "10px 12px", borderRadius: 12, background: "oklch(0.95 0.04 28)", color: "oklch(0.45 0.16 28)" }}>Khách trong danh sách đen: {black}</div>}
        {known > 0 && <div style={{ fontSize: 13, fontWeight: 700, color: "oklch(0.42 0.11 155)" }}>Khách quen · đã thuê {known} lần</div>}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {([["store", "Nhận tại cửa hàng"], ["home", "Giao homestay (≤3 km)"], ["far", "Giao xa +" + short(P.far)]] as const).map(([k2, name]) => (
            <div key={k2} onClick={() => setO({ place: k2 })} style={softPill(o.place === k2)}>{name}</div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {["Web", "CTV", "Zalo", "Khách quen"].map((k2) => (
            <div key={k2} onClick={() => setO({ src: k2 })} style={{ cursor: "pointer", fontSize: 13, fontWeight: 700, padding: "7px 12px", borderRadius: 999, whiteSpace: "nowrap", background: o.src === k2 ? "oklch(0.95 0.03 250)" : "white", color: o.src === k2 ? "oklch(0.4 0.12 250)" : "oklch(0.4 0.02 160)", border: `1.5px solid ${o.src === k2 ? "oklch(0.6 0.13 250)" : "oklch(0.9 0.01 160)"}` }}>Nguồn: {k2}</div>
          ))}
        </div>
      </div>

      <div style={{ ...card, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}><span style={{ fontSize: 14, fontWeight: 800 }}>4. Tiền thuê &amp; cọc</span><span style={{ fontSize: 20, fontWeight: 800, color: "oklch(0.55 0.16 45)" }}>{money(total)}</span></div>
        {brk && <div style={{ fontSize: 13, fontWeight: 600, color: "oklch(0.45 0.02 160)" }}>{brk}</div>}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {([[0, "Chưa cọc (giữ chỗ)"], [0.3, "Cọc 30%"], [0.5, "Cọc 50%"], [1, "Thu đủ"]] as const).map(([val, name]) => (
            <div key={val} onClick={() => setO({ dep: val })} style={{ cursor: "pointer", fontSize: 13, fontWeight: 700, padding: "8px 12px", borderRadius: 999, whiteSpace: "nowrap", background: o.dep === val ? "oklch(0.97 0.04 70)" : "white", color: o.dep === val ? "oklch(0.45 0.14 50)" : "oklch(0.35 0.02 160)", border: `1.5px solid ${o.dep === val ? O : "oklch(0.9 0.01 160)"}` }}>{name}</div>
          ))}
        </div>
        <div style={{ fontSize: 13, color: "oklch(0.45 0.02 160)" }}>{o.dep ? `Ghi nhận ${money(dep)} · còn lại ${money(total - dep)} thu khi giao xe. Xe chuyển trạng thái "Đã cọc".` : 'Xe sẽ ở trạng thái "Giữ chỗ · chưa cọc" cho tới khi bạn ghi nhận cọc.'}</div>
      </div>
      {o.err && <div style={{ fontSize: 14, fontWeight: 700, color: RED }}>{o.err}</div>}
    </DrawerShell>
  );
}

// ======================= CHI TIẾT ĐƠN =======================
export function BookingDrawer({ ctx, id }: { ctx: Ctx; id: string }) {
  const { data, call, setDr, say } = ctx;
  const { today: T, now: NOW, config: P } = data;
  const b = data.rentals.find((x) => x.id === id);
  const v = b ? data.vehicles.find((x) => x.id === b.vid) : undefined;
  const [hf, setHFs] = useState(() => ({ odo: String(v?.odo ?? ""), fuel: "Đầy", acc: ["2 mũ bảo hiểm", "Áo mưa"] as string[], doc: "CCCD gốc", photos: ["", "", "", ""] }));
  const [rf, setRFs] = useState(() => ({ odo: String((b?.hand?.odo ?? v?.odo ?? 0) + (b ? (diffDays(b.s, b.e) + 1) * 45 : 0)), fuel: "Đầy", accBack: [...(b?.hand?.acc ?? [])], dmg: "", dmgNote: "", method: "Tiền mặt" }));
  const [pf, setPFs] = useState({ amt: "", method: "Tiền mặt", kind: "Thu" });
  const [up, setUp] = useState(-1);
  if (!b || !v) return null;
  const setHF = (p: Partial<typeof hf>) => setHFs((x) => ({ ...x, ...p }));
  const setRF = (p: Partial<typeof rf>) => setRFs((x) => ({ ...x, ...p }));
  const setPF = (p: Partial<typeof pf>) => setPFs((x) => ({ ...x, ...p }));
  const st = rentalStatus(b, T, NOW), M = ST[st], py = payOf(b, T, NOW);
  const idx = ({ web: 0, hold: 0, deposit: 0, due: 1, renting: 2, late: 2, done: 3 } as Partial<Record<FleetStatus, number>>)[st] ?? -1;
  const days = diffDays(b.s, b.e) + 1;
  const black = P.black[b.phone];
  const newFees = st === "renting" || st === "late" ? returnFees(b, v, { fuel: rf.fuel, accBack: rf.accBack, dmg: digits(rf.dmg), dmgNote: rf.dmgNote }, P, T, NOW) : [];
  const fs = newFees.reduce((a, f) => a + f.amt, 0), oldFees = feeSum(b), finalDue = b.total + oldFees + fs - b.deposit;
  const docBack = b.hand?.doc && b.hand.doc !== "Không giữ" ? "Nhớ trả lại " + b.hand.doc.toLowerCase() + " cho khách." : "";
  const uploadPhoto = async (i: number, file: File) => {
    setUp(i);
    try {
      const r = await uploadFleetFile(ctx.serviceId, file, true);
      if (!r.url) say(r.error ?? "Tải ảnh thất bại");
      else setHFs((x) => ({ ...x, photos: x.photos.map((p, k) => (k === i ? r.url! : p)) }));
    } finally {
      setUp(-1);
    }
  };
  const copySlip = () => {
    const txt = `PHIẾU THUÊ XE · ${b.code}\n${b.name} · ${b.phone}\nXe: ${v.name} ${v.plate}\nNhận: ${dm(b.s)} ${b.st} · Trả: ${dm(b.e)} ${b.et}\n${b.place}\nTiền thuê: ${money(b.total)} · Đã thu: ${money(b.deposit)}${ctx.hotline ? `\nHotline: ${ctx.hotline}` : ""}`;
    navigator.clipboard?.writeText(txt).then(() => say("Đã chép phiếu, dán vào Zalo gửi khách"), () => say("Không chép được, hãy thử lại"));
  };
  const facts = [
    { k: "Nhận xe", v: dm(b.s) + " · " + b.st },
    { k: "Trả xe", v: dm(b.e) + " · " + b.et, c: st === "late" ? "oklch(0.52 0.19 28)" : "" },
    { k: "Số ngày", v: days + " ngày" },
    { k: "Địa điểm", v: b.place || "—" },
    { k: "Tiền thuê", v: money(b.total), c: "oklch(0.55 0.16 45)" },
    { k: "Thanh toán", v: py[0], c: py[1] },
  ];
  const ctvLine = b.ctv ? `Khách từ ${b.ctv} · hoa hồng ${P.ctv}% = ${money(Math.round((b.total * P.ctv) / 100000) * 1000)}` : "";
  const handForm = !b.hand && ["due", "deposit", "hold"].includes(st);
  const retForm = st === "renting" || st === "late";
  const cancel = (msg: string, opName = "cancel") => () => {
    if (b.bookingId) {
      // Đơn từ web: hỏi lý do để sàn báo lại khách.
      const reason = prompt((opName === "webReject" ? "Từ chối" : "Huỷ") + " xe này? Lý do (gửi kèm cho sàn):", opName === "webReject" ? "Hết xe trong thời gian này" : "");
      if (reason === null) return;
      call({ op: opName, id: b.id, reason });
      return;
    }
    if (msg && !confirm(msg)) return;
    call({ op: opName, id: b.id });
  };
  const A: Act[] = [];
  const staffOnly = ctx.isStaff && ctx.viewerStaff;
  if (st === "web" && !staffOnly) A.push({ name: "Từ chối", kind: "danger", go: cancel("Từ chối đơn web này?", "webReject") }, { name: "Xác nhận đơn", kind: "pri", flex: 2, go: () => call({ op: "webConfirm", id: b.id }) });
  if (st === "hold") A.push(...(staffOnly ? [] : [{ name: "Huỷ · nhả xe", kind: "danger" as const, go: cancel("") }]), { name: "Ghi nhận cọc 30%", kind: "orange", flex: 2, go: () => call({ op: "deposit", id: b.id }) });
  if (st === "deposit" || st === "due") A.push(...(staffOnly ? [] : [{ name: "Huỷ", kind: "danger" as const, go: cancel("Huỷ đơn đã cọc?") }]), { name: "Xác nhận giao xe", kind: "pri", flex: 2, go: () => call({ op: "handover", id: b.id, hand: { ...hf, odo: digits(hf.odo), photos: hf.photos.filter(Boolean) } }) });
  if (st === "renting" || st === "late") A.push({ name: "Gia hạn +1 ngày", go: () => call({ op: "extend", id: b.id }) }, { name: "Nhận xe & quyết toán", kind: "pri", flex: 2, go: () => call({ op: "return", id: b.id, ret: { ...rf, odo: digits(rf.odo), dmg: digits(rf.dmg) } }) });
  if (st === "done" || st === "cancel") A.push({ name: "Đóng", kind: "pri", go: () => setDr(null) });
  const settle = [
    { k: "Tiền thuê", v: money(b.total) },
    ...(oldFees ? [{ k: "Phát sinh trước đó", v: money(oldFees) }] : []),
    { k: "Phát sinh khi trả", v: money(fs) },
    { k: "Đã thu", v: "−" + money(b.deposit) },
  ];
  const photoLabels = ["Trước", "Sau", "Trái", "Phải"];
  return (
    <DrawerShell kicker={"Đơn " + b.code + (b.bookingCode ? " · từ website " + b.bookingCode : "")} title={b.name} actions={A} busy={ctx.busy} onClose={() => setDr(null)}>
      <div style={{ display: "flex", gap: 4 }}>
        {["Đặt & cọc", "Giao xe", "Đang thuê", "Trả & quyết toán"].map((n, i) => (
          <div key={n} style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ height: 5, borderRadius: 3, background: i <= idx ? (st === "late" && i === 2 ? ST.late[3] : G) : "oklch(0.9 0.008 160)" }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: i <= idx ? "oklch(0.3 0.03 160)" : "oklch(0.6 0.01 160)" }}>{n}</span>
          </div>
        ))}
      </div>
      {black && <div style={{ padding: "12px 14px", borderRadius: 14, background: "oklch(0.95 0.04 28)", border: "1.5px solid oklch(0.8 0.1 28)", color: "oklch(0.45 0.16 28)", fontSize: 14, fontWeight: 700 }}>Khách trong danh sách đen: {black}</div>}
      <div style={{ ...card, padding: 14, display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}><span style={{ fontSize: 17, fontWeight: 800 }}>{b.name}</span><span style={{ fontSize: 12, fontWeight: 800, padding: "4px 10px", borderRadius: 999, background: M[1], color: M[2], whiteSpace: "nowrap" }}>{M[0]}</span></div>
        <div style={{ fontSize: 14, color: "oklch(0.42 0.02 160)" }}>{b.phone} · CCCD {mask(b.cccd)} · Nguồn {b.src}</div>
        {ctvLine && !ctx.isStaff && <div style={{ fontSize: 13, fontWeight: 700, color: "oklch(0.42 0.12 250)" }}>{ctvLine}</div>}
        <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
          <a href={"tel:" + b.phone} style={{ flex: 1, textAlign: "center", fontSize: 14, fontWeight: 800, padding: 10, borderRadius: 999, border: "1.5px solid oklch(0.9 0.01 160)", color: "oklch(0.25 0.03 160)" }}>Gọi</a>
          <a href={"https://zalo.me/" + b.phone.replace(/\D/g, "")} target="_blank" rel="noreferrer" style={{ flex: 1, textAlign: "center", fontSize: 14, fontWeight: 800, padding: 10, borderRadius: 999, background: "oklch(0.95 0.03 250)", color: "oklch(0.4 0.12 250)" }}>Zalo</a>
          <div onClick={copySlip} style={{ cursor: "pointer", flex: 1.3, textAlign: "center", fontSize: 14, fontWeight: 800, padding: 10, borderRadius: 999, border: "1.5px solid oklch(0.9 0.01 160)", whiteSpace: "nowrap" }}>Chép phiếu thuê</div>
        </div>
      </div>
      <div onClick={() => setDr({ kind: "veh", id: v.id })} style={{ cursor: "pointer", display: "grid", gridTemplateColumns: "64px minmax(0,1fr)", gap: 12, alignItems: "center", padding: 12, ...card }}>
        <div style={{ width: 64, height: 50, borderRadius: 10, overflow: "hidden" }}><Thumb url={v.imageUrl} label=" " /></div>
        <div style={{ minWidth: 0 }}><div style={{ fontSize: 15, fontWeight: 800 }}>{v.name}</div><div style={{ fontFamily: "ui-monospace,monospace", fontSize: 13, color: "oklch(0.45 0.02 160)" }}>{v.plate}</div></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 8 }}>{facts.map((f) => <Fact key={f.k} k={f.k} v={f.v} c={f.c} />)}</div>
      {b.note && <div style={{ fontSize: 14, lineHeight: 1.5, padding: "12px 14px", borderRadius: 12, background: "oklch(0.97 0.03 80)", color: "oklch(0.4 0.06 60)" }}>{b.note}</div>}

      {handForm && (
        <div style={{ ...card, padding: 14, display: "flex", flexDirection: "column", gap: 10, border: "1.5px solid oklch(0.8 0.08 215)" }}>
          <div style={{ fontSize: 15, fontWeight: 800 }}>Biên bản giao xe</div>
          <label style={lbl}>Số km (ODO) lúc giao<input value={hf.odo} onChange={(e) => setHF({ odo: e.target.value })} inputMode="numeric" style={inputCls} /></label>
          <Group label="Mức xăng"><Chips list={FUEL_LEVELS} isOn={(n) => hf.fuel === n} pick={(n) => setHF({ fuel: n })} /></Group>
          <Group label="Phụ kiện giao kèm"><Chips list={FLEET_ACC} isOn={(n) => hf.acc.includes(n)} pick={(n) => setHF({ acc: hf.acc.includes(n) ? hf.acc.filter((a) => a !== n) : [...hf.acc, n] })} /></Group>
          <Group label="Giấy tờ giữ của khách"><Chips list={FLEET_DOCS} isOn={(n) => hf.doc === n} pick={(n) => setHF({ doc: n })} /></Group>
          <span style={{ fontSize: 12, fontWeight: 700, color: MUTED }}>Ảnh 4 góc xe trước khi giao</span>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 6 }}>
            {photoLabels.map((ph, i) => (
              <label key={ph} style={{ aspectRatio: "1", borderRadius: 10, overflow: "hidden", border: "1.5px dashed oklch(0.85 0.02 160)", cursor: "pointer", display: "block" }}>
                <Thumb url={hf.photos[i] || null} label={up === i ? "…" : ph} />
                <input type="file" accept="image/*" capture="environment" hidden onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadPhoto(i, file); e.target.value = ""; }} />
              </label>
            ))}
          </div>
        </div>
      )}
      {b.hand && (
        <div style={{ ...card, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 15, fontWeight: 800 }}>Biên bản giao xe</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 8 }}>
            <SoftFact k="Giao lúc" v={at2(b.hand.at) + (b.hand.by ? " · " + b.hand.by : "")} />
            <SoftFact k="ODO lúc giao" v={b.hand.odo.toLocaleString("vi-VN") + " km"} />
            <SoftFact k="Xăng" v={b.hand.fuel} />
            <SoftFact k="Giấy tờ giữ" v={b.hand.doc} />
            <SoftFact k="Phụ kiện kèm" v={b.hand.acc.join(", ") || "Không"} />
          </div>
          {b.hand.photos.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 6 }}>
              {b.hand.photos.map((u) => <a key={u} href={u} target="_blank" rel="noreferrer" style={{ aspectRatio: "1", borderRadius: 10, overflow: "hidden", display: "block" }}><Thumb url={u} /></a>)}
            </div>
          )}
        </div>
      )}

      {retForm && (
        <div style={{ ...card, padding: 14, display: "flex", flexDirection: "column", gap: 10, border: "1.5px solid oklch(0.82 0.1 65)" }}>
          <div style={{ fontSize: 15, fontWeight: 800 }}>Nhận lại xe &amp; phát sinh</div>
          <label style={lbl}>Số km (ODO) lúc trả<input value={rf.odo} onChange={(e) => setRF({ odo: e.target.value })} inputMode="numeric" style={inputCls} /></label>
          <Group label="Mức xăng lúc trả"><Chips list={FUEL_LEVELS} isOn={(n) => rf.fuel === n} pick={(n) => setRF({ fuel: n })} /></Group>
          {(b.hand?.acc.length ?? 0) > 0 && (
            <Group label="Kiểm tra phụ kiện (bấm để đánh dấu thiếu)">
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {b.hand!.acc.map((a) => { const okA = rf.accBack.includes(a); return (
                  <div key={a} onClick={() => setRF({ accBack: okA ? rf.accBack.filter((x) => x !== a) : [...rf.accBack, a] })} style={{ cursor: "pointer", fontSize: 13, fontWeight: 700, padding: "8px 12px", borderRadius: 999, whiteSpace: "nowrap", background: okA ? "oklch(0.96 0.03 155)" : "oklch(0.96 0.03 28)", color: okA ? "oklch(0.36 0.1 155)" : "oklch(0.5 0.16 28)", border: `1.5px solid ${okA ? "oklch(0.8 0.08 155)" : "oklch(0.8 0.1 28)"}` }}>{okA ? "✓ " : "✗ "}{a}</div>
                ); })}
              </div>
            </Group>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1.4fr)", gap: 8 }}>
            <label style={lbl}>Hư hỏng (đ)<input value={rf.dmg} onChange={(e) => setRF({ dmg: e.target.value })} inputMode="numeric" placeholder="0" style={inputCls} /></label>
            <label style={lbl}>Mô tả hư hỏng<input value={rf.dmgNote} onChange={(e) => setRF({ dmgNote: e.target.value })} placeholder="VD: vỡ xi nhan trái" style={inputCls} /></label>
          </div>
          <div style={{ padding: "10px 12px", borderRadius: 12, background: "oklch(0.975 0.004 160)" }}>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".06em", color: MUTED, marginBottom: 4 }}>PHÁT SINH TỰ TÍNH</div>
            {!newFees.length && <div style={{ fontSize: 14, color: "oklch(0.42 0.11 155)", fontWeight: 700 }}>Không có phát sinh</div>}
            {newFees.map((f) => <div key={f.k} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 14, padding: "4px 0" }}><span>{f.k}</span><b style={{ color: "oklch(0.55 0.16 45)", whiteSpace: "nowrap" }}>+{money(f.amt)}</b></div>)}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2, paddingTop: 6, borderTop: "1px dashed oklch(0.88 0.015 160)" }}>
            {settle.map((x) => <div key={x.k} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 14, fontWeight: 600, color: "oklch(0.35 0.02 160)", padding: "3px 0" }}><span>{x.k}</span><span style={{ whiteSpace: "nowrap" }}>{x.v}</span></div>)}
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 14, fontWeight: 800, color: finalDue >= 0 ? "oklch(0.55 0.16 45)" : "oklch(0.42 0.11 155)", padding: "3px 0" }}><span>{finalDue >= 0 ? "Khách cần trả thêm" : "Hoàn lại khách"}</span><span>{money(Math.abs(finalDue))}</span></div>
          </div>
          {finalDue !== 0 && <Group label="Thu / hoàn bằng"><Chips list={["Tiền mặt", "Chuyển khoản"]} isOn={(n) => rf.method === n} pick={(n) => setRF({ method: n })} /></Group>}
          {docBack && <div style={{ fontSize: 13, fontWeight: 700, color: "oklch(0.48 0.14 50)" }}>{docBack}</div>}
        </div>
      )}
      {b.ret && (
        <div style={{ ...card, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 15, fontWeight: 800 }}>Đã nhận lại xe</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 8 }}>
            <SoftFact k="Nhận lại lúc" v={at2(b.ret.at) + (b.ret.by ? " · " + b.ret.by : "")} />
            <SoftFact k="ODO lúc trả" v={b.ret.odo.toLocaleString("vi-VN") + " km"} />
            <SoftFact k="Xăng lúc trả" v={b.ret.fuel} />
            <SoftFact k="Đã chạy" v={b.hand ? Math.max(0, b.ret.odo - b.hand.odo).toLocaleString("vi-VN") + " km" : "—"} />
          </div>
          {b.fees.map((f) => <div key={f.k} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 14, padding: "4px 0" }}><span>{f.k}</span><b style={{ color: "oklch(0.55 0.16 45)", whiteSpace: "nowrap" }}>+{money(f.amt)}</b></div>)}
        </div>
      )}

      {b.bookingId && <div style={{ fontSize: 13, color: MUTED }}>Đơn được tự xếp từ yêu cầu đặt trên web ({b.bookingCode}). Huỷ đơn web thì xe tự trống lại.</div>}

      <div style={{ ...card, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontSize: 15, fontWeight: 800 }}>Thu chi của đơn</div>
        {!b.pays.length && <div style={{ fontSize: 13, color: MUTED }}>Chưa có khoản thu nào.</div>}
        {b.pays.map((y) => (
          <div key={y.id} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 10, alignItems: "center", padding: "6px 0", borderBottom: "1px solid oklch(0.95 0.005 160)" }}>
            <div style={{ minWidth: 0 }}><div style={{ fontSize: 14, fontWeight: 700 }}>{y.kind}</div><div style={{ fontSize: 12, color: MUTED }}>{at2(y.at)} · {y.method}{y.by ? " · " + y.by : ""}</div></div>
            <b style={{ fontSize: 15, color: y.amt < 0 ? "oklch(0.5 0.16 28)" : "oklch(0.42 0.11 155)", whiteSpace: "nowrap" }}>{y.amt < 0 ? "−" : "+"}{money(Math.abs(y.amt))}</b>
          </div>
        ))}
        {st === "cancel" && b.deposit > 0 && <div style={{ fontSize: 13, fontWeight: 700, color: "oklch(0.48 0.14 50)" }}>Đơn đã huỷ nhưng còn giữ {money(b.deposit)} của khách — ghi “Hoàn cọc” khi đã trả lại (hoặc giữ cọc theo chính sách).</div>}
        {(st !== "cancel" || b.deposit > 0) && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <input value={pf.amt} onChange={(e) => setPF({ amt: e.target.value })} inputMode="numeric" placeholder="Số tiền" style={{ ...inputCls, width: 130 }} />
            {["Thu", "Hoàn cọc"].map((n) => <div key={n} onClick={() => setPF({ kind: n })} style={softPill(pf.kind === n)}>{n}</div>)}
            {["Tiền mặt", "Chuyển khoản"].map((n) => <div key={n} onClick={() => setPF({ method: n })} style={softPill(pf.method === n)}>{n}</div>)}
            <button type="button" disabled={ctx.busy} onClick={async () => { if (!digits(pf.amt)) return say("Nhập số tiền"); const j = await call({ op: "addPay", id: b.id, amt: digits(pf.amt), kind: pf.kind, method: pf.method }); if (j) setPF({ amt: "" }); }} style={btn("pri")}>Ghi</button>
          </div>
        )}
      </div>
    </DrawerShell>
  );
}

// ======================= GHI BẢO DƯỠNG =======================
export function SvcDrawer({ ctx, id }: { ctx: Ctx; id: string }) {
  const { data, call, setDr } = ctx;
  const v = data.vehicles.find((x) => x.id === id);
  const [f, setF] = useState({ what: "Bảo dưỡng định kỳ", cost: "", odo: String(v?.odo ?? ""), note: "", toMaint: false });
  if (!v) return null;
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));
  const actions: Act[] = [
    { name: "Huỷ", go: () => setDr(null) },
    { name: "Lưu", kind: "pri", flex: 2, go: async () => { const j = await call({ op: "svcLog", vehicleId: v.id, what: f.what, cost: digits(f.cost), odo: digits(f.odo), note: f.note, toMaint: f.toMaint }); if (j) setDr(null); } },
  ];
  return (
    <DrawerShell kicker={"Ghi bảo dưỡng · " + v.plate} title={v.name} actions={actions} busy={ctx.busy} onClose={() => setDr(null)}>
      <span style={{ fontSize: 13, fontWeight: 700, color: "oklch(0.42 0.02 160)" }}>Hạng mục</span>
      <Chips list={SERVICE_PRESETS} isOn={(n) => f.what === n} pick={(n) => set({ what: n })} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 8 }}>
        <label style={lbl}>Chi phí (đ)<input value={f.cost} onChange={(e) => set({ cost: e.target.value })} inputMode="numeric" placeholder="120000" style={inputCls} /></label>
        <label style={lbl}>ODO lúc làm<input value={f.odo} onChange={(e) => set({ odo: e.target.value })} inputMode="numeric" style={inputCls} /></label>
      </div>
      <label style={lbl}>Ghi chú<input value={f.note} onChange={(e) => set({ note: e.target.value })} placeholder="VD: thay má phanh trước, tiệm Hùng Bắc Yên" style={inputCls} /></label>
      <Toggle on={f.toMaint} onClick={() => set({ toMaint: !f.toMaint })} color="oklch(0.6 0.16 28)">Xe đang nằm tiệm (tạm ngừng cho thuê)</Toggle>
    </DrawerShell>
  );
}
