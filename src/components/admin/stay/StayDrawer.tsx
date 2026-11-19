"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import type { HomeData } from "@/lib/stay";
import {
  CLOSE_REASONS,
  STAY_SOURCES,
  addDaysKey,
  billOf,
  cancelMoney,
  diffDays,
  feesOf,
  hh,
  isLive,
  normPhone,
  paidOf,
  quoteStay,
  rawPaid,
  roomFree,
  stayPrice,
  stayStatus,
  type StayVM,
} from "@/lib/stay-core";
import type { CallFn, Dr } from "./StayManager";
import { D, DIM, G, HK, INK, M, O, RED, ST, chip, copyText, digits, input, kicker, lbl, wd } from "./ui";

type Props = {
  dr: NonNullable<Dr>;
  setDr: (d: Dr) => void;
  data: HomeData;
  call: CallFn;
  say: (t: string) => void;
  busy: boolean;
  mob: boolean;
  serviceTitle: string;
};

type Act = { name: string; go: () => void; kind?: "pri" | "org" | "warn" | ""; flex?: string };

const smallInput: CSSProperties = { fontSize: 13, padding: 8, borderRadius: 10, border: "1.5px solid oklch(0.88 0.015 160)", minWidth: 0, background: "white" };
const ghostBtn: CSSProperties = { cursor: "pointer", fontSize: 13, fontWeight: 800, padding: "9px 14px", borderRadius: 999, border: "1.5px solid oklch(0.88 0.015 160)", color: INK, background: "white" };

/** Ngăn kéo phải của Quản lý phòng (đặt phòng / lượt ở / nhận phòng / trả phòng / đóng phòng). */
export function StayDrawer({ dr, setDr, data, call, say, busy, mob, serviceTitle }: Props) {
  const { rooms, types, stays, closes, locks, cfg } = data;
  const T = data.today, NOW = data.now;
  const roomById = new Map(rooms.map((r) => [r.id, r]));
  const rName = (id: string) => roomById.get(id)?.name ?? "?";
  const typeName = (roomId: string) => types.find((t) => t.id === roomById.get(roomId)?.typeId)?.name ?? "";
  const x = "id" in dr ? stays.find((s) => s.id === dr.id) ?? null : null;
  const stat = (s: StayVM) => stayStatus(s, stays, T, NOW, cfg);
  const free = (roomId: string, ci: string, co: string, except?: string) => roomFree(roomId, ci, co, { stays, closes, locks }, except);
  const close = () => setDr(null);

  // --- đặt phòng mới ---
  const initCi = dr.kind === "new" && dr.ci ? dr.ci : T;
  const [nf, setNf] = useState({ src: "Gọi điện", name: "", phone: "", ci: initCi, co: addDaysKey(initCi, 1), guests: 2, rooms: dr.kind === "new" && dr.room ? [dr.room] : ([] as string[]), override: "", dep: "", note: "", err: "" });
  // --- lượt ở ---
  const [payKind, setPayKind] = useState(x && stat(x) === "hold" ? "Cọc" : "Thu");
  const [payAmt, setPayAmt] = useState("");
  const [payMethod, setPayMethod] = useState("Tiền mặt");
  const [moveTo, setMoveTo] = useState("");
  // --- nhận phòng ---
  const [inTime, setInTime] = useState(NOW);
  const [guests, setGuests] = useState(() =>
    x
      ? x.guestList.length
        ? x.guestList.map((g, i) => ({ id: `g${i}`, ...g }))
        : [{ id: "g0", name: x.name.split(" (")[0], cccd: "" }, ...Array.from({ length: Math.max(0, x.guests - 1) }, (_, i) => ({ id: `g${i + 1}`, name: "", cccd: "" }))]
      : [],
  );
  // --- huỷ / không đến khi đã thu tiền: hỏi hoàn hay giữ cọc ---
  const [cxl, setCxl] = useState<null | "cancel" | "noShow">(null);
  const [cxlMethod, setCxlMethod] = useState("Tiền mặt");
  // --- sửa lượt ở ---
  const [ef, setEf] = useState(() => ({
    name: x?.name ?? "", phone: x?.phone ?? "", cccd: x?.guestList[0]?.cccd ?? "", guests: x?.guests ?? 1, note: x?.note ?? "",
    src: x?.src ?? "Gọi điện", ci: x?.ci ?? T, co: x?.co ?? addDaysKey(T, 1), total: "", err: "",
  }));
  // --- trả phòng ---
  const [coLate, setCoLate] = useState(() => (x ? stat(x) === "overdue" : false));
  const [dmg, setDmg] = useState("");
  // --- đóng phòng ---
  const [cl, setCl] = useState({ rooms: [] as string[], from: T, to: addDaysKey(T, 1), reason: "Bảo trì" });
  const [clErr, setClErr] = useState("");

  const A = (name: string, go: () => void, kind: Act["kind"] = "", flex?: string): Act => ({ name, go, kind, flex });
  let kickerText = "", title = "", acts: Act[] = [], body: ReactNode = null;

  // ================= ĐẶT PHÒNG TẠO TAY =================
  if (dr.kind === "new") {
    const f = nf;
    const set = (o: Partial<typeof nf>) => setNf({ ...f, ...o, err: "" });
    const nights = Math.max(0, diffDays(f.ci, f.co));
    const picked = f.rooms.map((id) => roomById.get(id)).filter((r): r is NonNullable<typeof r> => !!r);
    const q = quoteStay(picked, f.ci, f.co, f.guests, data.holKeys, data.extraFee);
    const phone = normPhone(f.phone);
    const flag = cfg.flags[phone];
    const prev = /^0\d{9}$/.test(phone) ? stays.filter((s) => s.phone === phone && isLive(s)) : [];
    const known = flag === "black" ? "⚠ Số này nằm trong danh sách đen. Cân nhắc yêu cầu cọc đủ trước khi giữ phòng." : prev.length ? `Khách cũ: ${prev[0].name.split(" (")[0]} · đã ở ${prev.length} lần${flag === "vip" ? " · khách quen" : ""}` : "";
    const overCap = q.over;
    const quote = f.override ? digits(f.override) : q.total;
    kickerText = "Đặt phòng tạo tay";
    title = f.rooms.length > 1 ? `Đoàn ${f.rooms.length} phòng` : "Lượt ở mới";
    const save = async () => {
      if (f.name.trim().length < 2) return set({ err: "Nhập tên khách" });
      if (!/^0\d{9}$/.test(phone)) return set({ err: "Số điện thoại 10 số" });
      if (!nights) return set({ err: "Ngày trả phải sau ngày nhận" });
      if (!f.rooms.length) return set({ err: "Chọn ít nhất 1 phòng" });
      const r = await call({ op: "createStay", name: f.name, phone, ci: f.ci, co: f.co, guests: f.guests, src: f.src, rooms: f.rooms, override: f.override ? digits(f.override) : 0, dep: digits(f.dep), note: f.note });
      if (r) close();
    };
    acts = [A("Huỷ", close, "", "0 0 auto"), A(busy ? "Đang lưu…" : "Lưu đặt phòng", save, "org")];
    body = (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 800 }}>Nguồn khách</span>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{STAY_SOURCES.map((v) => <div key={v} onClick={() => set({ src: v })} style={chip(f.src === v)}>{v}</div>)}</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 8 }}>
          <label style={lbl}>Tên khách *<input value={f.name} onChange={(e) => set({ name: e.target.value })} style={{ ...input, padding: "11px 12px" }} /></label>
          <label style={lbl}>Số điện thoại *<input value={f.phone} onChange={(e) => set({ phone: e.target.value })} inputMode="tel" style={{ ...input, padding: "11px 12px" }} /></label>
        </div>
        {known && <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.5, padding: "10px 12px", borderRadius: 12, background: flag === "black" ? "oklch(0.96 0.03 28)" : "oklch(0.95 0.04 155)", color: flag === "black" ? "oklch(0.5 0.17 28)" : "oklch(0.36 0.1 155)" }}>{known}</div>}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 8 }}>
          <label style={lbl}>Nhận phòng<input type="date" value={f.ci} min={addDaysKey(T, -1)} onChange={(e) => { const v = e.target.value; if (v) set({ ci: v, co: f.co <= v ? addDaysKey(v, 1) : f.co }); }} style={input} /></label>
          <label style={lbl}>Trả phòng<input type="date" value={f.co} min={addDaysKey(f.ci, 1)} onChange={(e) => e.target.value && set({ co: e.target.value })} style={input} /></label>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 14, background: "oklch(0.975 0.006 160)" }}>
          <span style={{ fontSize: 14, fontWeight: 800 }}>Số khách</span>
          <Stepper value={String(f.guests)} dec={() => set({ guests: Math.max(1, f.guests - 1) })} inc={() => set({ guests: f.guests + 1 })} light />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13, fontWeight: 800 }}>Chọn phòng ({nights} đêm)</span>
            <span style={{ fontSize: 12, fontWeight: 800, color: overCap > 2 ? RED : overCap ? O : "oklch(0.4 0.1 155)" }}>{f.rooms.length ? `${q.cap} chỗ cho ${f.guests} khách${overCap ? " · ghép " + overCap : ""}` : "Chưa chọn phòng"}</span>
          </div>
          {rooms.map((r) => {
            const on = f.rooms.includes(r.id);
            const ok = nights > 0 && free(r.id, f.ci, f.co);
            return (
              <div key={r.id} onClick={() => (ok || on) && set({ rooms: on ? f.rooms.filter((y) => y !== r.id) : [...f.rooms, r.id] })} style={{ cursor: ok || on ? "pointer" : "not-allowed", display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 12, border: `2px solid ${on ? G : "oklch(0.92 0.01 160)"}`, background: on ? "oklch(0.97 0.02 155)" : "white", opacity: ok || on ? 1 : 0.5 }}>
                <span style={{ width: 20, height: 20, borderRadius: 6, border: `2px solid ${on ? G : "oklch(0.75 0.01 160)"}`, background: on ? G : "white", color: "white", fontSize: 12, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>{on ? "✓" : ""}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name} <span style={{ fontWeight: 600, color: DIM }}>· {typeName(r.id)}</span></div>
                  <div style={{ fontSize: 12, color: ok ? "oklch(0.4 0.1 155)" : "oklch(0.55 0.17 28)" }}>{ok ? `Trống ${nights} đêm · ${r.cap} khách${r.max > r.cap ? ` (tối đa ${r.max})` : ""}` : nights ? "Bận trong khoảng này" : "Chọn ngày"}</div>
                </div>
                <b style={{ fontSize: 13, whiteSpace: "nowrap" }}>{nights ? M(stayPrice(r, f.ci, f.co, data.holKeys)) : ""}</b>
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "12px 14px", borderRadius: 14, background: "oklch(0.975 0.012 155)" }}>
          {q.lines.map((l) => <div key={l.k} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13 }}><span style={{ color: "oklch(0.45 0.02 160)" }}>{l.k}</span><b style={{ whiteSpace: "nowrap" }}>{M(l.v ?? 0)}</b></div>)}
          {q.hols.length > 0 && <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13 }}><span style={{ color: "oklch(0.45 0.02 160)" }}>Giá ngày lễ đêm {q.hols.map((d) => D(d)).join(", ")}</span><b>đã tính</b></div>}
          {overCap > 0 && !data.extraFee && <div style={{ fontSize: 12, color: DIM }}>Homestay chưa đặt mức phụ thu người thêm — sửa tổng tiền nếu cần.</div>}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderTop: "1px dashed oklch(0.86 0.01 160)", paddingTop: 8 }}>
            <span style={{ fontWeight: 800 }}>Báo giá</span>
            <span style={{ fontSize: 22, fontWeight: 800, color: "oklch(0.58 0.17 45)" }}>{M(quote)}</span>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 8 }}>
          <label style={lbl}>Sửa tổng tiền<input value={f.override} onChange={(e) => set({ override: e.target.value })} inputMode="numeric" placeholder={q.total ? q.total.toLocaleString("vi-VN") : ""} style={input} /></label>
          <label style={lbl}>Khách cọc<input value={f.dep} onChange={(e) => set({ dep: e.target.value })} inputMode="numeric" placeholder="0 = giữ chỗ" style={input} /></label>
        </div>
        <label style={lbl}>Ghi chú<input value={f.note} onChange={(e) => set({ note: e.target.value })} placeholder="Giờ tới, yêu cầu riêng…" style={input} /></label>
        <div style={{ fontSize: 12, lineHeight: 1.5, color: DIM }}>{digits(f.dep) > 0 ? "Có cọc: phòng hiện “Đã cọc” trên lịch, web báo hết phòng các đêm này." : `Không cọc: giữ chỗ ${cfg.hold} giờ rồi tự nhả nếu khách chưa chuyển cọc. Trong lúc giữ, web vẫn báo hết phòng.`}</div>
        {f.err && <div style={{ fontSize: 13, fontWeight: 700, color: RED }}>{f.err}</div>}
      </div>
    );
  }

  // ================= CHI TIẾT LƯỢT Ở =================
  if (dr.kind === "stay" && x) {
    const st = stat(x), S = ST[st], bill = billOf(x), pd = paidOf(x, stays), due = bill - pd;
    const group = x.groupId ? stays.filter((s) => s.groupId === x.groupId && isLive(s)) : [];
    const manual = !x.bookingId;
    const moveOpts = rooms.filter((r) => r.id !== x.roomId && free(r.id, x.ci, x.co, x.id));
    const canPay = !["out", "cancel", "noshow", "reject"].includes(st) && !x.payBlock;
    const copy = async () => {
      const txt = [
        `PHIẾU XÁC NHẬN ĐẶT PHÒNG · ${serviceTitle}`,
        `Mã: ${x.code}${x.bookingCode ? ` (đơn ${x.bookingCode})` : ""}`,
        `Khách: ${x.name} · ${x.phone}`,
        `Phòng: ${rName(x.roomId)} (${typeName(x.roomId)}) · ${x.guests} khách`,
        `Nhận phòng: ${wd(x.ci)} từ ${hh(cfg.ci)}`,
        `Trả phòng: ${wd(x.co)} trước ${hh(cfg.co)}`,
        x.combo ? `Tiền phòng: ${M(x.total)} (combo — thanh toán với Tà Xùa Booking)${feesOf(x) ? ` · Dịch vụ: ${M(feesOf(x))}, còn lại ${M(Math.max(0, due))}` : ""}` : `Tổng tiền: ${M(bill)} · Đã thu: ${M(pd)} · Còn lại: ${M(Math.max(0, due))}`,
      ].join("\n");
      say((await copyText(txt)) ? "Đã chép phiếu xác nhận" : "Không chép được, thử lại");
    };
    const addPay = async () => {
      const a = digits(payAmt) || (payKind === "Hoàn" ? 0 : Math.max(0, due));
      if (!a) return say("Nhập số tiền");
      if (await call({ op: "addPay", id: x.id, kind: payKind, amt: a, method: payMethod })) setPayAmt("");
    };
    const ext = () => call({ op: "extend", id: x.id });
    // Tiền chủ nhà đã thu (cả đoàn nếu đây là phòng cuối còn hiệu lực) — có tiền thì phải chọn hoàn / giữ cọc.
    const money = cancelMoney(x.id, x.groupId ? stays.filter((s) => s.groupId === x.groupId) : [x]);
    const askCancel = async (op: "cancel" | "noShow") => {
      if (money > 0) return setCxl(op);
      const q = op === "cancel" ? "Huỷ lượt ở này? Các đêm sẽ được nhả." : "Ghi khách không đến và nhả phòng?";
      if (confirm(q) && (await call({ op, id: x.id }))) close();
    };
    const doCancel = async (refund: "refund" | "keep") => {
      if (!cxl) return;
      if (await call({ op: cxl, id: x.id, refund, method: cxlMethod })) close();
    };
    const editable = isLive(x) && !x.outAt;
    kickerText = x.code + (x.groupName ? " · " + x.groupName : "") + (x.bookingCode ? " · đơn " + x.bookingCode : "");
    title = `${rName(x.roomId)} · ${x.name}`;
    const editAct = editable ? [A("Sửa", () => setDr({ kind: "edit", id: x.id }), "", "0 0 auto")] : [];
    acts =
      st === "arriving"
        ? [...editAct, ...(manual ? [A("Không đến", () => askCancel("noShow"), "warn", "0 0 auto")] : []), A("Nhận phòng", () => setDr({ kind: "in", id: x.id }), "org")]
        : ["inhouse", "dueout", "overdue"].includes(st)
          ? [...editAct, ...(manual ? [A("Gia hạn +1 đêm", ext, "", "0 0 auto")] : []), A("Trả phòng", () => setDr({ kind: "out", id: x.id }), "org")]
          : st === "hold" || st === "deposit"
            ? [...editAct, ...(manual ? [A("Huỷ", () => askCancel("cancel"), "warn", "0 0 auto"), A("Gia hạn +1", ext, "", "0 0 auto")] : []), A("Đóng", close, "pri")]
            : [...editAct, A("Đóng", close, "pri")];
    body = (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {cxl && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "12px 14px", borderRadius: 16, border: "2px solid oklch(0.85 0.06 28)", background: "oklch(0.98 0.015 28)" }}>
            <div style={{ fontSize: 14, fontWeight: 800 }}>{cxl === "cancel" ? "Huỷ lượt ở" : "Khách không đến"} · đã thu {M(money)}{x.groupId ? " (cả đoàn)" : ""}</div>
            <div style={{ fontSize: 13, lineHeight: 1.5, color: "oklch(0.45 0.02 160)" }}>Hoàn cọc: ghi một dòng hoàn {M(money)} vào sổ thu chi. Giữ cọc: tiền giữ lại làm doanh thu, lượt ở ghi chú “Giữ cọc”.</div>
            <select value={cxlMethod} onChange={(e) => setCxlMethod(e.target.value)} style={{ ...smallInput, maxWidth: 200 }}><option>Tiền mặt</option><option>Chuyển khoản</option></select>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <div onClick={() => !busy && doCancel("refund")} style={{ ...ghostBtn, borderColor: "oklch(0.85 0.06 28)", color: "oklch(0.5 0.17 28)" }}>Hoàn cọc {M(money)}</div>
              <div onClick={() => !busy && doCancel("keep")} style={{ ...ghostBtn, background: G, borderColor: G, color: "white" }}>Giữ cọc {M(money)}</div>
              <div onClick={() => setCxl(null)} style={ghostBtn}>Thôi</div>
            </div>
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, fontWeight: 800, padding: "5px 12px", borderRadius: 999, background: S[1], color: S[3], border: `1.5px ${S[4]} ${S[2]}` }}>{S[0]}</span>
          <span style={{ fontSize: 12, fontWeight: 700, padding: "5px 10px", borderRadius: 999, background: "oklch(0.96 0.008 160)" }}>{x.src}</span>
          {x.groupName && <span style={{ fontSize: 12, fontWeight: 700, padding: "5px 10px", borderRadius: 999, background: "oklch(0.95 0.03 250)", color: "oklch(0.42 0.12 250)" }}>{x.groupName} · {group.length} phòng</span>}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 8 }}>
          {[
            { k: "Khách", v: x.name },
            { k: "Điện thoại", v: x.phone },
            { k: "Phòng", v: `${rName(x.roomId)} · ${typeName(x.roomId)}` },
            { k: "Số khách", v: `${x.guests} người` },
            { k: "Nhận phòng", v: `${wd(x.ci)} · ${x.inAt ? "đã nhận " + x.inAt.slice(11) : hh(cfg.ci)}` },
            { k: "Trả phòng", v: `${wd(x.co)} · ${x.outAt ? "đã trả " + x.outAt.slice(11) : hh(cfg.co)}` },
          ].map((f) => (
            <div key={f.k} style={{ padding: "10px 12px", borderRadius: 12, background: "oklch(0.975 0.006 160)", minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: DIM }}>{f.k}</div>
              <div style={{ fontSize: 14, fontWeight: 800, marginTop: 2, overflowWrap: "anywhere" }}>{f.v}</div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <a href={`tel:${x.phone}`} style={ghostBtn}>Gọi</a>
          <a href={`https://zalo.me/${x.phone}`} target="_blank" rel="noreferrer" style={ghostBtn}>Zalo</a>
          <div onClick={copy} style={ghostBtn}>Chép phiếu xác nhận</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "12px 14px", borderRadius: 16, border: "1px solid oklch(0.92 0.01 160)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ fontSize: 14, fontWeight: 800 }}>Tiền</span>
            <span style={{ fontSize: 13, fontWeight: 800, color: due > 0 ? "oklch(0.52 0.15 45)" : "oklch(0.4 0.1 155)" }}>{due > 0 ? "Còn thu " + M(due) : due < 0 ? `Thừa ${M(-due)} · cần hoàn` : "Đã thu đủ"}</span>
          </div>
          <div style={{ height: 8, borderRadius: 4, background: "oklch(0.94 0.01 160)", overflow: "hidden" }}><div style={{ height: "100%", width: Math.min(100, Math.round((pd / Math.max(1, bill)) * 100)) + "%", background: "oklch(0.55 0.12 155)" }} /></div>
          <Row k={<><b>Tiền phòng</b> · {diffDays(x.ci, x.co)} đêm</>} v={M(x.total)} />
          {x.fees.length > 0 && <Row k={<><b>Dịch vụ / phụ thu</b> · {x.fees.length} khoản</>} v={M(feesOf(x))} />}
          {x.pays.map((p) => <Row key={p.id} k={<><b>{p.kind}</b> · {p.method} · {D(p.at.slice(0, 10)).slice(0, 5)}</>} v={(p.amt >= 0 ? "+" : "") + M(p.amt)} c={p.amt >= 0 ? "oklch(0.4 0.1 155)" : "oklch(0.5 0.17 28)"} />)}
          {group.length > 1 && <div style={{ fontSize: 12, color: DIM }}>Tiền đoàn tính chung: đã thu cả đoàn {M(stays.filter((s) => s.groupId === x.groupId).reduce((a, s) => a + rawPaid(s), 0))} / {M(group.reduce((a, s) => a + billOf(s), 0))}, chia về từng phòng theo tỉ lệ.</div>}
          {x.combo && <div style={{ fontSize: 12, color: DIM }}>Đơn combo: tiền phòng do sàn thu và trả lại cho nhà; ở đây chỉ ghi các khoản nhà tự thu thêm.</div>}
          {x.payBlock && <div style={{ fontSize: 12, fontWeight: 700, color: "oklch(0.5 0.15 45)" }}>{x.payBlock}</div>}
          {canPay && (
            <div style={{ display: "grid", gridTemplateColumns: mob ? "88px minmax(0,1fr) auto" : "96px minmax(0,1fr) 120px auto", gap: 6, marginTop: 4 }}>
              <select value={payKind} onChange={(e) => setPayKind(e.target.value)} style={smallInput}><option value="Cọc">Cọc</option><option value="Thu">Thu thêm</option><option value="Hoàn">Hoàn tiền</option></select>
              <input value={payAmt} onChange={(e) => setPayAmt(e.target.value)} inputMode="numeric" placeholder={due > 0 ? due.toLocaleString("vi-VN") : "Số tiền"} style={{ ...smallInput, padding: "8px 10px" }} />
              {!mob && <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)} style={smallInput}><option>Tiền mặt</option><option>Chuyển khoản</option></select>}
              <div onClick={addPay} style={{ cursor: "pointer", fontSize: 13, fontWeight: 800, padding: "8px 12px", borderRadius: 10, background: G, color: "white", display: "flex", alignItems: "center" }}>Ghi</div>
              {mob && <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)} style={{ ...smallInput, gridColumn: "1 / -1" }}><option>Tiền mặt</option><option>Chuyển khoản</option></select>}
            </div>
          )}
        </div>
        {!x.outAt && isLive(x) && moveOpts.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 6, alignItems: "center" }}>
            <select value={moveTo} onChange={(e) => setMoveTo(e.target.value)} style={{ ...input, fontSize: 14 }}>
              <option value="">Đổi sang phòng…</option>
              {moveOpts.map((r) => <option key={r.id} value={r.id}>{r.name} · {typeName(r.id)}</option>)}
            </select>
            <div onClick={async () => { if (!moveTo) return say("Chọn phòng muốn đổi"); if (await call({ op: "move", id: x.id, to: moveTo })) setMoveTo(""); }} style={{ cursor: "pointer", fontSize: 13, fontWeight: 800, padding: "10px 14px", borderRadius: 12, border: "1.5px solid oklch(0.85 0.04 158)", color: "oklch(0.35 0.08 158)" }}>Đổi phòng</div>
          </div>
        )}
        {x.fees.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 4, padding: "10px 12px", borderRadius: 14, background: "oklch(0.97 0.03 80)" }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "oklch(0.48 0.13 55)" }}>DỊCH VỤ PHÁT SINH</div>
            {x.fees.map((f, i) => <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}><span>{f.name}</span><b>{M(f.amt)}</b></div>)}
          </div>
        )}
        {["inhouse", "dueout", "overdue"].includes(st) && cfg.svcs.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={kicker}>GHI DỊCH VỤ VÀO PHÒNG</span>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {cfg.svcs.map((v) => <div key={v.name} onClick={() => call({ op: "charge", id: x.id, name: v.name, amt: v.price })} style={{ cursor: "pointer", fontSize: 12, fontWeight: 700, padding: "7px 11px", borderRadius: 999, border: "1.5px solid oklch(0.88 0.015 160)" }}>+ {v.name} {Math.round(v.price / 1000)}k</div>)}
            </div>
          </div>
        )}
        {x.guestList.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 4, padding: "10px 12px", borderRadius: 12, background: "oklch(0.975 0.006 160)", fontSize: 13 }}>
            <span style={kicker}>KHÁCH LƯU TRÚ</span>
            {x.guestList.map((g, i) => <span key={i}>{i + 1}. {g.name || "—"}{g.cccd ? ` · CCCD ${g.cccd}` : ""}</span>)}
          </div>
        )}
        {x.note && <div style={{ fontSize: 13, lineHeight: 1.5, padding: "10px 12px", borderRadius: 12, background: "oklch(0.975 0.006 160)" }}>“{x.note}”</div>}
      </div>
    );
  }

  // ================= SỬA LƯỢT Ở =================
  if (dr.kind === "edit" && x) {
    const f = ef;
    const set = (o: Partial<typeof ef>) => setEf({ ...f, ...o, err: "" });
    const platform = !!x.bookingId;
    const inHouse = !!x.inAt;
    const room = roomById.get(x.roomId);
    const datesChanged = f.ci !== x.ci || f.co !== x.co;
    const nights = Math.max(0, diffDays(f.ci, f.co));
    const requote = !platform && room && nights > 0 && (datesChanged || f.guests !== x.guests) ? quoteStay([room], f.ci, f.co, f.guests, data.holKeys, data.extraFee).total : null;
    const newTotal = f.total ? digits(f.total) : (requote ?? x.total);
    const okFree = !datesChanged || (nights > 0 && free(x.roomId, f.ci, f.co, x.id));
    kickerText = "Sửa lượt ở · " + x.code + (x.bookingCode ? " · đơn " + x.bookingCode : "");
    title = `${rName(x.roomId)} · ${x.name}`;
    const save = async () => {
      if (!/^0\d{9}$/.test(normPhone(f.phone))) return set({ err: "Số điện thoại 10 số" });
      if (f.cccd && f.cccd.length !== 12) return set({ err: "Số CCCD gồm 12 chữ số" });
      const payload: Record<string, unknown> = { op: "edit", id: x.id, phone: normPhone(f.phone), cccd: f.cccd, note: f.note };
      if (!platform) {
        if (f.name.trim().length < 2) return set({ err: "Nhập tên khách" });
        if (!nights) return set({ err: "Ngày trả phải sau ngày nhận" });
        if (!okFree) return set({ err: "Phòng bận trong khoảng ngày mới" });
        Object.assign(payload, { name: f.name, guests: f.guests, src: f.src, ci: f.ci, co: f.co, total: f.total ? digits(f.total) : 0 });
      }
      if (await call(payload)) setDr({ kind: "stay", id: x.id });
    };
    acts = [A("Quay lại", () => setDr({ kind: "stay", id: x.id }), "", "0 0 auto"), A(busy ? "Đang lưu…" : "Lưu thay đổi", save, "org")];
    body = (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {platform && <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.5, padding: "9px 12px", borderRadius: 12, background: "oklch(0.95 0.03 250)", color: "oklch(0.42 0.12 250)" }}>Đơn của sàn: ngày, giá, tên và số khách theo đơn — báo sàn nếu cần đổi. Ở đây chỉ sửa SĐT, CCCD và ghi chú (SĐT cập nhật luôn lên đơn).</div>}
        {!platform && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 800 }}>Nguồn khách</span>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{STAY_SOURCES.map((v) => <div key={v} onClick={() => set({ src: v })} style={chip(f.src === v)}>{v}</div>)}</div>
          </div>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 8 }}>
          <label style={lbl}>Tên khách<input value={f.name} disabled={platform} onChange={(e) => set({ name: e.target.value })} style={{ ...input, padding: "11px 12px", opacity: platform ? 0.6 : 1 }} /></label>
          <label style={lbl}>Số điện thoại<input value={f.phone} onChange={(e) => set({ phone: e.target.value })} inputMode="tel" style={{ ...input, padding: "11px 12px" }} /></label>
        </div>
        <label style={lbl}>CCCD khách chính<input value={f.cccd} onChange={(e) => set({ cccd: e.target.value.replace(/\D/g, "").slice(0, 12) })} inputMode="numeric" placeholder="12 số" style={{ ...input, fontFamily: "ui-monospace,monospace" }} /></label>
        {!platform && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 8 }}>
              <label style={lbl}>Nhận phòng<input type="date" value={f.ci} disabled={inHouse} min={inHouse ? undefined : addDaysKey(T, -1)} onChange={(e) => { const v = e.target.value; if (v) set({ ci: v, co: f.co <= v ? addDaysKey(v, 1) : f.co }); }} style={{ ...input, opacity: inHouse ? 0.6 : 1 }} /></label>
              <label style={lbl}>Trả phòng<input type="date" value={f.co} min={inHouse && T > f.ci ? T : addDaysKey(f.ci, 1)} onChange={(e) => e.target.value && set({ co: e.target.value })} style={input} /></label>
            </div>
            {inHouse && <div style={{ fontSize: 12, color: DIM }}>Khách đã nhận phòng — chỉ đổi được ngày trả.</div>}
            {datesChanged && !okFree && <div style={{ fontSize: 13, fontWeight: 700, color: RED }}>Phòng {rName(x.roomId)} bận trong khoảng ngày mới.</div>}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 14, background: "oklch(0.975 0.006 160)" }}>
              <span style={{ fontSize: 14, fontWeight: 800 }}>Số khách</span>
              <Stepper value={String(f.guests)} dec={() => set({ guests: Math.max(1, f.guests - 1) })} inc={() => set({ guests: f.guests + 1 })} light />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "12px 14px", borderRadius: 14, background: "oklch(0.975 0.012 155)" }}>
              <Row k="Tiền phòng hiện tại" v={M(x.total)} size={14} />
              {requote != null && <Row k={`Báo giá lại · ${nights} đêm${f.guests !== x.guests ? ` · ${f.guests} khách` : ""}`} v={M(requote)} size={14} />}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderTop: "1px dashed oklch(0.86 0.01 160)", paddingTop: 8 }}>
                <span style={{ fontWeight: 800 }}>Tiền phòng sau khi lưu</span>
                <span style={{ fontSize: 20, fontWeight: 800, color: "oklch(0.58 0.17 45)" }}>{M(newTotal)}</span>
              </div>
            </div>
            <label style={lbl}>Sửa tổng tiền phòng<input value={f.total} onChange={(e) => set({ total: e.target.value })} inputMode="numeric" placeholder={(requote ?? x.total).toLocaleString("vi-VN")} style={input} /></label>
          </>
        )}
        <label style={lbl}>Ghi chú<input value={f.note} onChange={(e) => set({ note: e.target.value })} placeholder="Giờ tới, yêu cầu riêng…" style={input} /></label>
        {f.err && <div style={{ fontSize: 13, fontWeight: 700, color: RED }}>{f.err}</div>}
      </div>
    );
  }

  // ================= NHẬN PHÒNG =================
  if (dr.kind === "in" && x) {
    const room = roomById.get(x.roomId);
    let earlyNote = inTime < hh(cfg.ci) ? `Nhận trước ${hh(cfg.ci)} · ${inTime < "12:00" && cfg.early ? "phụ thu nhận sớm " + M(cfg.early) + " (tự cộng)" : "trong khung miễn phí"}` : "";
    if (!earlyNote && room && room.hk !== "clean") earlyNote = `Phòng ${room.name} đang “${HK[room.hk][0]}”, báo buồng phòng dọn trước khi giao.`;
    const exportList = async () => {
      const txt = guests.filter((g) => g.name || g.cccd).map((g, i) => `${i + 1}. ${g.name}${g.cccd ? " · CCCD " + g.cccd : ""}`).join("\n");
      say(txt && (await copyText(`Khách lưu trú phòng ${rName(x.roomId)} · ${D(x.ci)} → ${D(x.co)}\n${txt}`)) ? "Đã chép danh sách khai báo tạm trú" : "Chưa có tên khách");
    };
    kickerText = "Nhận phòng · " + x.code;
    title = `${rName(x.roomId)} · ${x.name}`;
    acts = [
      A("Quay lại", () => setDr({ kind: "stay", id: x.id }), "", "0 0 auto"),
      A("Xác nhận nhận phòng", async () => {
        if (await call({ op: "checkIn", id: x.id, time: inTime, guests: guests.map((g) => ({ name: g.name, cccd: g.cccd })) })) setDr({ kind: "stay", id: x.id });
      }, "org"),
    ];
    body = (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <label style={lbl}>Giờ nhận thực tế<input type="time" value={inTime} onChange={(e) => setInTime(e.target.value || NOW)} style={{ ...input, fontSize: 16, fontWeight: 800, maxWidth: 140 }} /></label>
        {earlyNote && <div style={{ fontSize: 13, fontWeight: 700, padding: "9px 12px", borderRadius: 12, background: "oklch(0.97 0.04 75)", color: "oklch(0.45 0.12 50)" }}>{earlyNote}</div>}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 14, fontWeight: 800 }}>Khách lưu trú (khai báo tạm trú)</span>
          <span onClick={() => setGuests([...guests, { id: "g" + Date.now(), name: "", cccd: "" }])} style={{ cursor: "pointer", fontSize: 13, fontWeight: 800, color: "oklch(0.4 0.08 158)" }}>+ Thêm khách</span>
        </div>
        {guests.map((g, i) => (
          <div key={g.id} style={{ display: "grid", gridTemplateColumns: "28px minmax(0,1fr) auto", gap: 10, alignItems: "center", padding: 10, borderRadius: 14, border: "1px solid oklch(0.92 0.01 160)" }}>
            <span style={{ width: 28, height: 28, borderRadius: "50%", background: "oklch(0.95 0.025 155)", color: "oklch(0.35 0.08 158)", fontSize: 13, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
              <input value={g.name} onChange={(e) => setGuests(guests.map((y) => (y.id === g.id ? { ...y, name: e.target.value } : y)))} placeholder={`Họ tên khách ${i + 1}`} style={{ ...smallInput, fontSize: 14, padding: "8px 10px" }} />
              <input value={g.cccd} onChange={(e) => setGuests(guests.map((y) => (y.id === g.id ? { ...y, cccd: e.target.value.replace(/\D/g, "").slice(0, 12) } : y)))} inputMode="numeric" placeholder="Số CCCD 12 số" style={{ ...smallInput, fontSize: 14, padding: "8px 10px", fontFamily: "ui-monospace,monospace" }} />
            </div>
            {guests.length > 1 ? <span onClick={() => setGuests(guests.filter((y) => y.id !== g.id))} title="Bỏ khách" style={{ cursor: "pointer", fontSize: 18, fontWeight: 800, color: DIM, padding: 4 }}>×</span> : <span />}
          </div>
        ))}
        <div style={{ fontSize: 12, lineHeight: 1.5, color: DIM }}>
          Danh sách khách chỉ chủ, lễ tân và admin của nhà xem được.{" "}
          <span onClick={exportList} style={{ cursor: "pointer", fontWeight: 800, color: "oklch(0.4 0.08 158)" }}>Chép danh sách để khai báo tạm trú</span>
        </div>
      </div>
    );
  }

  // ================= TRẢ PHÒNG =================
  if (dr.kind === "out" && x) {
    const extraFees = [...(coLate ? [{ name: "Trả muộn", amt: cfg.late }] : []), ...(digits(dmg) ? [{ name: "Hư hỏng", amt: digits(dmg) }] : [])];
    const me = { ...x, fees: [...x.fees, ...extraFees] };
    const all = stays.map((s) => (s.id === x.id ? me : s));
    const extra = extraFees.reduce((a, f) => a + f.amt, 0);
    const bill = billOf(me), pd = paidOf(me, all), due = bill - pd;
    kickerText = "Trả phòng · quyết toán";
    title = `${rName(x.roomId)} · ${x.name}`;
    acts = [
      A("Quay lại", () => setDr({ kind: "stay", id: x.id }), "", "0 0 auto"),
      A(x.payBlock ? "Trả phòng" : due >= 0 ? `Thu ${M(due)} & trả phòng` : `Hoàn ${M(-due)} & trả phòng`, async () => {
        if (await call({ op: "checkOut", id: x.id, late: coLate, dmg: digits(dmg), method: payMethod })) close();
      }, "org"),
    ];
    const early = !x.bookingId && (T > x.ci ? T : addDaysKey(x.ci, 1)) < x.co;
    body = (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {early && (
          <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.5, padding: "9px 12px", borderRadius: 12, background: "oklch(0.97 0.04 75)", color: "oklch(0.45 0.12 50)" }}>
            Trả trước ngày dự kiến ({D(x.co)}): không phạt, vẫn tính đủ tiền phòng như đã đặt. Các đêm chưa ở được nhả để bán lại. Muốn bớt tiền thì bấm “Sửa” lượt ở trước khi trả phòng.
          </div>
        )}
        {[
          { name: `Trả muộn sau ${hh(cfg.co)}`, on: coLate, v: cfg.late, pick: () => setCoLate(!coLate) },
        ].map((t) => (
          <div key={t.name} onClick={t.pick} style={{ cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 12, border: `2px solid ${t.on ? O : "oklch(0.92 0.01 160)"}`, background: t.on ? "oklch(0.97 0.04 75)" : "white" }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>{t.name}</span>
            <b>{t.on ? "+ " + M(t.v) : "Không"}</b>
          </div>
        ))}
        <label style={lbl}>Hư hỏng / mất đồ<input value={dmg} onChange={(e) => setDmg(e.target.value)} inputMode="numeric" placeholder="0" style={{ ...input, maxWidth: 200 }} /></label>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "12px 14px", borderRadius: 14, background: "oklch(0.975 0.012 155)" }}>
          <Row k={`Tiền phòng · ${diffDays(x.ci, x.co)} đêm`} v={M(x.total)} size={14} />
          {x.fees.map((f, i) => <Row key={i} k={f.name} v={M(f.amt)} size={14} />)}
          {extra > 0 && <Row k="Phụ thu & hư hỏng" v={M(extra)} c="oklch(0.52 0.15 45)" size={14} />}
          <Row k="Đã thu" v={"− " + M(pd)} c="oklch(0.4 0.1 155)" size={14} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderTop: "1px dashed oklch(0.86 0.01 160)", paddingTop: 8 }}>
            <span style={{ fontWeight: 800 }}>{due >= 0 ? "Thu nốt" : "Hoàn cọc"}</span>
            <span style={{ fontSize: 24, fontWeight: 800, color: due >= 0 ? "oklch(0.58 0.17 45)" : "oklch(0.5 0.17 28)" }}>{M(Math.abs(due))}</span>
          </div>
        </div>
        {x.payBlock ? (
          <div style={{ fontSize: 12, fontWeight: 700, color: "oklch(0.5 0.15 45)" }}>{x.payBlock} Số còn thu sẽ không ghi vào sổ ở đây.</div>
        ) : (
          <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)} style={{ ...input, fontSize: 14 }}><option>Tiền mặt</option><option>Chuyển khoản</option></select>
        )}
        <div style={{ fontSize: 12, color: DIM }}>Trả phòng xong, phòng tự chuyển sang “Chưa dọn”.</div>
      </div>
    );
  }

  // ================= ĐÓNG PHÒNG =================
  if (dr.kind === "close") {
    const active = closes.filter((c) => c.to >= T);
    kickerText = "Không bán các đêm này trên web";
    title = "Đóng phòng";
    acts = [
      A("Huỷ", close, "", "0 0 auto"),
      A(`Đóng ${cl.rooms.length || ""} phòng`, async () => {
        if (!cl.rooms.length) return setClErr("Chọn phòng");
        if (cl.to < cl.from) return setClErr("Ngày kết thúc phải sau ngày bắt đầu");
        const busyRooms = cl.rooms.filter((r) => !free(r, cl.from, addDaysKey(cl.to, 1)));
        if (busyRooms.length) return setClErr(`Phòng ${busyRooms.map(rName).join(", ")} đã có khách hoặc đang khoá trong khoảng này`);
        if (await call({ op: "close", rooms: cl.rooms, from: cl.from, to: cl.to, reason: cl.reason })) close();
      }, "pri"),
    ];
    body = (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {rooms.map((r) => {
            const on = cl.rooms.includes(r.id);
            return <div key={r.id} onClick={() => { setCl({ ...cl, rooms: on ? cl.rooms.filter((y) => y !== r.id) : [...cl.rooms, r.id] }); setClErr(""); }} style={{ cursor: "pointer", fontSize: 14, fontWeight: 800, padding: "9px 14px", borderRadius: 12, border: `2px solid ${on ? G : "oklch(0.9 0.01 160)"}`, background: on ? G : "white", color: on ? "white" : INK }}>{r.name}</div>;
          })}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 8 }}>
          <label style={lbl}>Từ ngày<input type="date" value={cl.from} onChange={(e) => e.target.value && setCl({ ...cl, from: e.target.value, to: cl.to < e.target.value ? e.target.value : cl.to })} style={input} /></label>
          <label style={lbl}>Đến hết ngày<input type="date" value={cl.to} min={cl.from} onChange={(e) => e.target.value && setCl({ ...cl, to: e.target.value })} style={input} /></label>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{CLOSE_REASONS.map((v) => <div key={v} onClick={() => setCl({ ...cl, reason: v })} style={chip(cl.reason === v)}>{v}</div>)}</div>
        {clErr && <div style={{ fontSize: 13, fontWeight: 700, color: RED }}>{clErr}</div>}
        <div style={kicker}>ĐANG ĐÓNG</div>
        {!active.length && <div style={{ fontSize: 13, color: DIM }}>Không có phòng nào đang đóng.</div>}
        {active.map((c) => (
          <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "9px 12px", borderRadius: 12, background: "oklch(0.96 0.005 160)" }}>
            <span style={{ fontSize: 13 }}><b>{c.roomIds.map(rName).join(", ")}</b> · {D(c.from)} → {D(c.to)} · {c.reason}</span>
            <span onClick={() => confirm("Mở lại các phòng này để bán trên web?") && call({ op: "reopen", id: c.id })} style={{ cursor: "pointer", fontSize: 12, fontWeight: 800, color: "oklch(0.4 0.08 158)", whiteSpace: "nowrap" }}>Mở lại</span>
          </div>
        ))}
      </div>
    );
  }

  if (!body) {
    // Lượt ở vừa bị xoá / lọc khỏi dữ liệu.
    kickerText = "";
    title = "Không tìm thấy lượt ở";
    acts = [A("Đóng", close, "pri")];
    body = <div style={{ fontSize: 14, color: DIM }}>Lượt ở này không còn trong dữ liệu.</div>;
  }

  return (
    <>
      <div onClick={close} style={{ position: "fixed", inset: 0, zIndex: 70, background: "oklch(0.15 0.03 165 / .45)", backdropFilter: "blur(2px)" }} />
      <aside style={{ position: "fixed", top: 0, right: 0, bottom: 0, zIndex: 71, width: mob ? "100%" : "min(560px,100%)", background: "white", display: "flex", flexDirection: "column", boxShadow: "-30px 0 60px -30px oklch(0.1 0.03 160 / .5)", animation: "staySlide .25s ease both" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "14px 18px", borderBottom: "1px solid oklch(0.93 0.01 160)" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: DIM, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{kickerText}</div>
            <div style={{ fontSize: 19, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</div>
          </div>
          <div onClick={close} style={{ cursor: "pointer", flex: "none", width: 38, height: 38, borderRadius: "50%", background: "oklch(0.95 0.005 160)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 800 }}>×</div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px 24px", display: "flex", flexDirection: "column", gap: 14 }}>{body}</div>
        <div style={{ display: "flex", gap: 8, padding: "12px 18px calc(12px + env(safe-area-inset-bottom))", borderTop: "1px solid oklch(0.93 0.01 160)", flexWrap: "wrap" }}>
          {acts.map((a) => {
            const bg = a.kind === "pri" ? G : a.kind === "org" ? O : "white";
            const fg = a.kind === "pri" || a.kind === "org" ? "white" : a.kind === "warn" ? "oklch(0.5 0.17 28)" : INK;
            const bd = a.kind === "pri" ? G : a.kind === "org" ? O : a.kind === "warn" ? "oklch(0.85 0.06 28)" : "oklch(0.88 0.015 160)";
            return <div key={a.name} onClick={() => !busy && a.go()} style={{ cursor: busy ? "wait" : "pointer", flex: a.flex ?? "1", textAlign: "center", fontSize: 14, fontWeight: 800, padding: "13px 14px", borderRadius: 999, background: bg, color: fg, border: `1.5px solid ${bd}`, whiteSpace: "nowrap", opacity: busy ? 0.7 : 1 }}>{a.name}</div>;
          })}
        </div>
      </aside>
    </>
  );
}

function Row({ k, v, c, size = 13 }: { k: ReactNode; v: string; c?: string; size?: number }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: size }}>
      <span style={{ color: size > 13 ? "oklch(0.45 0.02 160)" : undefined }}>{k}</span>
      <b style={{ color: c, whiteSpace: "nowrap" }}>{v}</b>
    </div>
  );
}

export function Stepper({ value, dec, inc, light }: { value: string; dec: () => void; inc: () => void; light?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, padding: 3, borderRadius: 999, background: light ? "white" : "oklch(0.95 0.006 160)" }}>
      <div onClick={dec} style={{ cursor: "pointer", width: 32, height: 32, borderRadius: "50%", background: light ? "oklch(0.95 0.006 160)" : "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800 }}>−</div>
      <span style={{ minWidth: light ? 30 : 84, textAlign: "center", fontWeight: 800, fontSize: 14 }}>{value}</span>
      <div onClick={inc} style={{ cursor: "pointer", width: 32, height: 32, borderRadius: "50%", background: G, color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800 }}>+</div>
    </div>
  );
}
