"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { addDaysKey, cellType, countCells, isSeatItem, itemsLine, rowName, seatClassOf, seatKey, seatName, ticketQty, unitWord, type TkOrder } from "@/lib/ticket-core";
import { showToast } from "@/components/admin/Toast";
import { Act, Badge, Empty, G, Head, KV, MUTED, O, RED, SOFT, Seg, Stat, Stepper, VenuePick, card, copyText, dm, dmy, h, inputCls, lbl, money, printHtml, printTickets, short, statGrid, ticketUrl, useNow, useWidth, wdOf, type Ctx } from "./ui";

type SeatState = "free" | "held" | "sold" | "counter" | "lock";
/** [nền, viền, chữ] */
const SEAT: Record<Exclude<SeatState, "free">, [string, string, string]> = {
  sold: ["oklch(0.45 0.1 158)", "oklch(0.45 0.1 158)", "white"],
  counter: ["oklch(0.55 0.13 250)", "oklch(0.55 0.13 250)", "white"],
  held: ["oklch(0.92 0.07 70)", "oklch(0.75 0.13 60)", "oklch(0.45 0.12 55)"],
  lock: ["oklch(0.25 0.02 160)", "oklch(0.25 0.02 160)", "white"],
};
const SN: Record<SeatState, [string, string, string]> = {
  sold: ["Đã bán", "oklch(0.94 0.05 155)", "oklch(0.36 0.1 155)"],
  counter: ["Bán tại quầy", "oklch(0.94 0.04 250)", "oklch(0.42 0.12 250)"],
  held: ["Đang giữ", "oklch(0.96 0.05 75)", "oklch(0.48 0.14 55)"],
  lock: ["Khoá · khách mời", "oklch(0.92 0.005 160)", "oklch(0.3 0.02 160)"],
  free: ["Trống", "oklch(0.96 0.005 160)", "oklch(0.42 0.02 160)"],
};
const mmss = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

/** Tab SHOW: tình trạng theo suất, sơ đồ ghế trực tiếp (xem / khoá ghế / bán tại quầy) và đơn chờ thu tiền. */
export function ShowTab({ ctx }: { ctx: Ctx }) {
  const { data, call, busy } = ctx;
  const w = useWidth();
  const inner = w - (w >= 1024 ? 256 : 0);
  const now = useNow();
  const { venue, today } = data;
  const layout = venue.layout;
  // Bán theo BÀN (show ngồi bàn kiểu acoustic): ô to hơn, hiện tên bàn P-01 / S-01.
  const unit = venue.config.seatUnit, W = unitWord(unit), isTable = unit === "table", CELL = isTable ? 46 : 26;
  const nm = (k: string) => seatName(layout, k, unit);
  const nms = (ks: string[]) => ks.slice().sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).map(nm).join(", ");
  const cells = useMemo(() => countCells(layout), [layout]);
  const seatTotal = cells.vip + cells.norm;
  const sessions = data.sessions.filter((s) => s.date >= today);
  const [sid, setSid] = useState(sessions[0]?.id ?? "");
  const sess = sessions.find((s) => s.id === sid) ?? sessions[0];
  const [tool, setTool] = useState<"view" | "lock" | "sell">("view");
  const [sel, setSel] = useState<string | null>(null);
  const [pick, setPick] = useState<string[]>([]);
  const [moving, setMoving] = useState<{ orderId: string; from: string } | null>(null);
  const [standQ, setStandQ] = useState<Record<string, number>>({});
  const [form, setForm] = useState({ name: "", phone: "", pay: "cash" as "cash" | "qr" | "none" });
  const [quick, setQuick] = useState<null | { from: string; time: string; days: number }>(null);
  const [justPaid, setJustPaid] = useState<string[]>([]);

  const price = (cls: "vip" | "norm") => data.tiers.find((t) => t.seatClass === cls)?.price ?? 0;
  const tierName = (cls: "vip" | "norm") => data.tiers.find((t) => t.seatClass === cls)?.name ?? (cls === "vip" ? "VIP" : "Thường");
  const standTiers = data.tiers.filter((t) => t.active && !t.seatClass);
  const standCap = standTiers.reduce((a, t) => a + (t.quota ?? 0), 0);

  /** Tình trạng từng suất: ghế → đơn. */
  const view = (sessionId: string) => {
    const orders = data.orders.filter((o) => o.sessionId === sessionId);
    const bySeat = new Map<string, TkOrder>();
    for (const o of orders) for (const k of o.seats) bySeat.set(k, o);
    const locks = new Set(data.locks.filter((l) => l.sessionId === sessionId).map((l) => l.key));
    const state = (k: string): SeatState => {
      if (locks.has(k)) return "lock";
      const o = bySeat.get(k);
      return !o ? "free" : o.status === "wait" || o.status === "draft" ? "held" : o.source === "Quầy" ? "counter" : "sold";
    };
    const n = { sold: 0, held: 0, lock: locks.size, in: 0, revenue: 0 };
    for (const o of orders) {
      const q = ticketQty(o);
      if (o.status === "wait" || o.status === "draft") n.held += q;
      else {
        n.sold += q;
        n.revenue += o.ticketAmount;
        n.in += o.tickets.filter((t) => t.kind === "entry" && t.usedAt).length;
      }
    }
    const total = seatTotal + standCap;
    return { orders, bySeat, state, n, total, free: Math.max(0, total - n.sold - n.held - n.lock) };
  };
  const V = sess ? view(sess.id) : null;

  // Đơn giữ chỗ vừa hết hạn ⇒ tải lại (server tự huỷ + nhả ghế).
  const waits = data.orders.filter((o) => o.status === "wait" && o.holdUntil);
  const reloaded = useRef(0);
  useEffect(() => {
    if (waits.some((o) => (o.holdUntil ?? 0) < now) && now - reloaded.current > 15_000) {
      reloaded.current = now;
      void call("reload", {}, { quiet: true });
    }
  }, [now, waits, call]);

  if (!sess || !V) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Head title={`${venue.name} — tình trạng theo suất`} note="Chưa có suất diễn nào sắp tới" right={<VenuePick ctx={ctx} />} />
        <QuickForm quick={quick ?? { from: today, time: "20:00", days: 1 }} setQuick={setQuick} ctx={ctx} onDone={(id) => setSid(id)} />
      </div>
    );
  }
  const label = (s: { date: string; time: string }) => `${wdOf(s.date)} ${dm(s.date)} · ${s.time}`;

  const pickTotal = pick.reduce((a, k) => a + price(seatClassOf(layout, k) ?? "norm"), 0) + standTiers.reduce((a, t) => a + (standQ[t.id] ?? 0) * t.price, 0);
  const pickN = pick.length + standTiers.reduce((a, t) => a + (standQ[t.id] ?? 0), 0);

  async function onSeat(k: string) {
    const x = V!.state(k);
    if (moving) {
      if (x !== "free") return showToast("Chọn một ghế TRỐNG cùng hạng để đổi sang.", "error");
      if (await call("moveSeat", { orderId: moving.orderId, from: moving.from, to: k })) {
        setMoving(null);
        setSel(k);
      }
      return;
    }
    if (tool === "lock" && (x === "free" || x === "lock")) {
      setSel(k);
      return void call("seatLock", { sessionId: sess!.id, key: k }, { quiet: true });
    }
    if (tool === "sell" && x === "free") return setPick((p) => (p.includes(k) ? p.filter((i) => i !== k) : [...p, k]));
    setSel(k);
  }

  async function doSell() {
    if (!pickN || busy) return;
    if (form.pay === "none" && form.name.trim().length < 2) return showToast("Giữ chỗ chưa thu tiền: nhập tên khách để nhận ra đơn.", "error");
    const res = await call("showSell", {
      date: sess!.date, time: sess!.time, seats: pick, pay: form.pay, name: form.name, phone: form.phone,
      source: form.pay === "none" ? "Điện thoại" : "Quầy",
      tickets: standTiers.map((t) => ({ tierId: t.id, qty: standQ[t.id] ?? 0 })),
    });
    if (!res) return;
    setPick([]);
    setStandQ({});
    setForm((f) => ({ ...f, name: "", phone: "" }));
    const o = res.orders.find((x) => x.id === res.orderId);
    if (o && form.pay !== "none" && window.confirm("In vé cho khách?")) await printTickets(o, venue.name, label(sess!));
  }

  const resend = async (o: TkOrder) => showToast((await copyText(ticketUrl(o))) ? `Đã chép link vé ${o.code} — dán gửi khách qua Zalo.` : `Link vé: ${ticketUrl(o)}`);

  function printGuests() {
    const rows = V!.orders
      .filter((o) => o.status !== "draft").map((o) => `<tr><td>${h(o.seats.slice().sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).join(", ") || "—")}</td><td>${h(itemsLine(o))}</td><td>${h(o.name)}</td><td>${h(o.phone)}</td><td>${h(o.code)}</td><td>${o.status === "wait" ? "Chờ thu tiền" : "Đã thu"}</td><td>${o.tickets.filter((t) => t.kind === "entry" && t.usedAt).length}/${o.tickets.filter((t) => t.kind === "entry").length}</td></tr>`)
      .join("");
    if (!printHtml(`Danh sách khách ${label(sess!)}`, `<h1>${h(venue.name)}</h1><p>Suất ${h(label(sess!))} · ${V!.orders.length} đơn · in lúc ${new Date().toLocaleTimeString("vi-VN").slice(0, 5)} ${dmy(today)}</p><table><tr><th>Ghế</th><th>Vé</th><th>Khách</th><th>Điện thoại</th><th>Mã đơn</th><th>Tiền</th><th>Đã vào</th></tr>${rows}</table>`))
      showToast("Trình duyệt chặn cửa sổ in — cho phép pop-up.", "error");
  }

  // ---- Bảng chi tiết ghế đang chọn ----
  let detail: React.ReactNode = (
    <div style={{ fontSize: 14, lineHeight: 1.55, color: MUTED }}>
      Bấm một ghế trên sơ đồ để xem chi tiết. Chế độ <b>Khoá ghế</b> để giữ cho khách mời, <b>Bán tại quầy</b> để thêm vé cho khách gọi điện hoặc CTV.
    </div>
  );
  if (sel && seatClassOf(layout, sel)) {
    const x = V.state(sel), o = V.bySeat.get(sel), cls = seatClassOf(layout, sel)!, S = SN[x];
    const tk = o?.tickets.find((t) => t.seatKey === sel);
    detail = (
      <>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <div style={{ fontSize: 20, fontWeight: 800 }}>{W} {nm(sel)}</div>
          <Badge big bg={S[1]} fg={S[2]}>{S[0]}</Badge>
        </div>
        <div style={{ fontSize: 13, color: MUTED }}>Hạng {tierName(cls)} · {label(sess)}</div>
        {o && x !== "free" && x !== "lock" ? (
          <>
            <KV k="Mã đơn" v={o.status === "draft" ? "—" : o.code} />
            <KV k="Khách" v={o.status === "draft" ? "Khách web đang chọn" : `${o.name}${o.phone ? " · " + o.phone : ""}`} />
            {x === "held" ? (
              <>
                <KV k="Hết giữ sau" v={o.holdUntil ? mmss(o.holdUntil - now) : "—"} />
                <KV k="Trạng thái" v={o.status === "draft" ? "Đang điền thông tin" : "Chờ chuyển khoản"} />
              </>
            ) : (
              <>
                <KV k="Soát vé" v={tk?.usedAt ? `Đã vào ${tk.usedAt}` : "Chưa đến"} />
                <KV k={x === "counter" ? "Người bán" : "Nguồn"} v={x === "counter" ? (o.createdBy ?? "Quầy") : o.source} />
                <KV k="Thu" v={`${money(o.total)}${o.payMethod ? " · " + o.payMethod.toLowerCase() : ""}`} />
              </>
            )}
            {o.seats.length > 1 && <KV k="Cùng đơn" v={nms(o.seats)} />}
          </>
        ) : (
          <KV k="Giá" v={money(price(cls))} />
        )}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
          {x === "free" && (
            <>
              <Act kind="pri" onClick={() => { setTool("sell"); setPick((p) => (p.includes(sel) ? p : [...p, sel])); }}>Bán tại quầy</Act>
              <Act disabled={busy} onClick={() => call("seatLock", { sessionId: sess.id, key: sel }, { quiet: true })}>Khoá ghế</Act>
            </>
          )}
          {x === "lock" && <Act kind="pri" disabled={busy} onClick={() => call("seatLock", { sessionId: sess.id, key: sel }, { quiet: true })}>Mở khoá</Act>}
          {o && (x === "sold" || x === "counter") && (
            <>
              <Act onClick={() => resend(o)}>Gửi lại vé</Act>
              {!tk?.usedAt && <Act onClick={() => { setMoving({ orderId: o.id, from: sel }); showToast(`Bấm một ghế trống hạng ${tierName(cls)} để đổi ghế ${sel} sang.`); }}>Đổi ghế</Act>}
              {x === "counter" && <Act kind="warn" disabled={busy} onClick={() => window.confirm(`Huỷ đơn ${o.code} (${o.seats.join(", ")})?`) && call("cancel", { orderId: o.id })}>Huỷ vé quầy</Act>}
            </>
          )}
          {o && x === "held" && (
            <>
              {o.status === "wait" && <Act kind="pri" disabled={busy} onClick={() => call("paid", { orderId: o.id, pay: "qr" })}>Đã thu tiền</Act>}
              <Act kind="warn" disabled={busy} onClick={() => window.confirm(`Nhả toàn bộ ghế của đơn ${o.code}?`) && call("cancel", { orderId: o.id })}>Nhả ghế</Act>
            </>
          )}
        </div>
      </>
    );
  }

  const pending = data.orders.filter((o) => (o.status === "wait" && o.holdUntil) || justPaid.includes(o.id));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Head
        title={`${venue.name} — tình trạng theo suất`}
        note="Sơ đồ cập nhật trực tiếp · bấm ghế để xem đơn, khoá ghế hoặc bán tại quầy"
        right={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <VenuePick ctx={ctx} />
            <button type="button" onClick={printGuests} style={{ cursor: "pointer", fontSize: 14, fontWeight: 800, padding: "10px 16px", borderRadius: 999, border: "1.5px solid oklch(0.88 0.015 160)", background: "white", whiteSpace: "nowrap", fontFamily: "inherit" }}>In danh sách khách</button>
            <button type="button" onClick={() => setQuick(quick ? null : { from: addDaysKey(sessions[sessions.length - 1]?.date ?? today, 1), time: sess.time, days: 1 })} style={{ cursor: "pointer", fontSize: 14, fontWeight: 800, padding: "10px 16px", borderRadius: 999, background: O, color: "white", border: "none", whiteSpace: "nowrap", fontFamily: "inherit" }}>+ Tạo suất nhanh</button>
          </div>
        }
      />
      {quick && <QuickForm quick={quick} setQuick={setQuick} ctx={ctx} onDone={(id) => setSid(id)} />}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(min(100%,240px),1fr))", gap: 10 }}>
        {sessions.map((s) => {
          const c = view(s.id), paused = s.status === "paused", out = !c.free;
          const st = paused ? ["Tạm dừng", "oklch(0.92 0.005 160)", "oklch(0.35 0.02 160)"] : out ? ["Hết vé", "oklch(0.93 0 0)", "oklch(0.4 0 0)"] : c.free < 20 ? ["Sắp hết", "oklch(0.96 0.05 75)", "oklch(0.48 0.14 55)"] : ["Đang bán", "oklch(0.94 0.05 155)", "oklch(0.36 0.1 155)"];
          return (
            <div key={s.id} onClick={() => { setSid(s.id); setSel(null); setPick([]); setMoving(null); }} style={{ cursor: "pointer", padding: "12px 14px", borderRadius: 16, background: "white", border: `2px solid ${s.id === sess.id ? G : "oklch(0.92 0.008 160)"}`, display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 15, fontWeight: 800 }}>{label(s)}</span>
                <Badge bg={st[1]} fg={st[2]}>{st[0]}</Badge>
              </div>
              <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden", background: "oklch(0.94 0.01 160)" }}>
                <div style={{ width: `${(c.n.sold / Math.max(1, c.total)) * 100}%`, background: "oklch(0.45 0.1 158)" }} />
                <div style={{ width: `${(c.n.held / Math.max(1, c.total)) * 100}%`, background: "oklch(0.78 0.12 65)" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, whiteSpace: "nowrap", fontSize: 12, fontWeight: 700, color: MUTED }}>
                <span>Bán {c.n.sold} · giữ {c.n.held}</span>
                <span>Trống {c.free}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div style={statGrid}>
        <Stat k="Đã bán" v={`${V.n.sold}/${V.total}`} c="oklch(0.45 0.1 158)" />
        <Stat k="Đang giữ" v={V.n.held} c="oklch(0.78 0.12 65)" />
        <Stat k="Khoá khách mời" v={V.n.lock} c="oklch(0.25 0.02 160)" />
        <Stat k="Đã check-in" v={V.n.sold ? Math.round((V.n.in / V.n.sold) * 100) + "%" : "0%"} c="oklch(0.55 0.12 155)" />
        <Stat k="Doanh thu vé" v={short(V.n.revenue)} c={O} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: inner >= 1180 ? "minmax(0,1fr) 360px" : "1fr", gap: 14, alignItems: "start" }}>
        <div style={{ ...card, padding: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <Seg dark items={[["view", "Xem"], ["lock", "Khoá ghế"], ["sell", "Bán tại quầy"]]} value={tool} onPick={(t) => { setTool(t); setMoving(null); if (t !== "sell") setPick([]); }} />
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {([["Đã bán", SEAT.sold], ["Bán quầy", SEAT.counter], ["Đang giữ", SEAT.held], ["Khoá", SEAT.lock], ["Trống", ["white", "oklch(0.8 0.04 155)", ""]]] as [string, string[]][]).map(([name, c]) => (
                <span key={name} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 700, color: "oklch(0.42 0.02 160)", whiteSpace: "nowrap" }}>
                  <span style={{ width: 12, height: 12, borderRadius: 3, background: c[0], border: `1.5px solid ${c[1]}` }} />
                  {name}
                </span>
              ))}
            </div>
          </div>
          {moving && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700, padding: "8px 12px", borderRadius: 12, background: "oklch(0.96 0.05 75)", color: "oklch(0.42 0.12 55)" }}>
              Đang đổi ghế {moving.from}: bấm một ghế trống cùng hạng.
              <span onClick={() => setMoving(null)} style={{ cursor: "pointer", textDecoration: "underline" }}>Thôi</span>
            </div>
          )}
          <div style={{ overflow: "auto", borderRadius: 14, background: "oklch(0.975 0.006 160)", padding: "14px 10px" }}>
            <div style={{ width: "max-content", margin: "0 auto", display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
              <div style={{ width: "76%", marginBottom: 10, padding: "6px 0", borderRadius: "0 0 50px 50px / 0 0 18px 18px", background: G, color: "white", textAlign: "center", fontSize: 11, fontWeight: 800, letterSpacing: ".2em" }}>SÂN KHẤU</div>
              {Array.from({ length: layout.rows }, (_, r) => (
                <div key={r} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ width: 16, fontSize: 11, fontWeight: 800, color: "oklch(0.55 0.02 160)", textAlign: "center" }}>{rowName(r)}</span>
                  {Array.from({ length: layout.cols }, (_, c) => {
                    const t = cellType(layout, r, c), k = seatKey(r, c);
                    if (t === "aisle" || t === "empty") return <span key={c} style={{ width: t === "aisle" ? 16 : CELL, height: isTable ? 34 : 26 }} />;
                    if (t === "broken") return <span key={c} title={`${nm(k)} · hỏng`} style={{ width: CELL, height: isTable ? 34 : 26, borderRadius: "7px 7px 3px 3px", background: "oklch(0.96 0.02 28)", border: "2px solid oklch(0.85 0.06 28)", color: "oklch(0.6 0.12 28)", fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>×</span>;
                    const x = V.state(k), o = V.bySeat.get(k), vip = t === "vip";
                    const P = x === "free" ? [vip ? "oklch(0.97 0.03 75)" : "white", vip ? "oklch(0.75 0.11 65)" : "oklch(0.8 0.04 155)", "oklch(0.5 0.02 160)"] : SEAT[x];
                    const used = o?.tickets.find((tk) => tk.seatKey === k)?.usedAt;
                    const on = sel === k || pick.includes(k);
                    return (
                      <div key={c} onClick={() => !busy && onSeat(k)} title={`${W} ${nm(k)} · ${x === "free" ? money(price(vip ? "vip" : "norm")) : SN[x][0] + (o ? " · " + o.name : "")}`}
                        style={{ cursor: "pointer", width: CELL, height: isTable ? 34 : 26, borderRadius: isTable ? 10 : "7px 7px 3px 3px", background: pick.includes(k) ? O : P[0], border: `2px solid ${pick.includes(k) ? O : P[1]}`, color: pick.includes(k) ? "white" : P[2], fontSize: 10, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: on ? `0 0 0 3px ${O}` : "none" }}>
                        {pick.includes(k) ? "+" : x !== "free" && x !== "lock" && used ? "✓" : x === "lock" ? "×" : x === "counter" ? "Q" : ""}{isTable && <span style={{ marginLeft: 1 }}>{nm(k)}</span>}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", fontSize: 12, fontWeight: 700, color: MUTED }}>
            <span>{W} {tierName("vip")} {money(price("vip"))} · {tierName("norm")} {money(price("norm"))}{standTiers.map((t) => ` · ${t.name} ${money(t.price)}`).join("")}</span>
            <span>
              <span onClick={() => !busy && call("setPause", { date: sess.date, time: sess.time, paused: sess.status !== "paused" })} style={{ cursor: "pointer", fontWeight: 800, color: sess.status === "paused" ? G : RED }}>{sess.status === "paused" ? "Mở bán lại suất này" : "Tạm dừng bán suất này"}</span>
              {!V.orders.length && <span onClick={() => !busy && window.confirm(`Xoá suất ${label(sess)}?`) && call("deleteSession", { sessionId: sess.id })} style={{ cursor: "pointer", fontWeight: 800, color: RED, marginLeft: 14 }}>Xoá suất</span>}
            </span>
          </div>
        </div>

        <aside style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
          {tool === "sell" && (
            <div style={{ ...card, border: `2px solid ${O}`, gap: 10 }}>
              <div style={{ fontSize: 16, fontWeight: 800 }}>Bán tại quầy · {label(sess)}</div>
              <div style={{ fontSize: 13, color: MUTED }}>{pick.length ? `${W}: ${nms(pick)}` : `Bấm các ${W.toLowerCase()} trống trên sơ đồ để chọn.`}</div>
              {standTiers.map((t) => (
                <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 800 }}>{t.name}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "oklch(0.6 0.18 42)" }}>{money(t.price)}{t.quota != null ? ` · ${t.quota} vé/suất` : ""}</div>
                  </div>
                  <Stepper value={standQ[t.id] ?? 0} onDec={() => setStandQ((q) => ({ ...q, [t.id]: Math.max(0, (q[t.id] ?? 0) - 1) }))} onInc={() => setStandQ((q) => ({ ...q, [t.id]: (q[t.id] ?? 0) + 1 }))} />
                </div>
              ))}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <label style={lbl}>Tên khách<input style={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Không bắt buộc" /></label>
                <label style={lbl}>Điện thoại<input style={inputCls} inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
              </div>
              <Seg dark grow items={[["cash", "Tiền mặt"], ["qr", "Chuyển khoản"], ["none", "Chưa thu · giữ chỗ"]]} value={form.pay} onPick={(pay) => setForm({ ...form, pay })} />
              {form.pay === "none" && <div style={{ fontSize: 12, color: "oklch(0.48 0.14 55)", fontWeight: 700 }}>Giữ ghế {venue.config.holdMin} phút chờ khách chuyển khoản, quá hạn tự nhả.</div>}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderTop: "1px dashed oklch(0.86 0.01 160)", paddingTop: 10 }}>
                <span style={{ fontWeight: 700 }}>{form.pay === "none" ? "Cần thu" : "Thu"}</span>
                <span style={{ fontSize: 24, fontWeight: 800, color: "oklch(0.58 0.17 45)" }}>{money(pickTotal)}</span>
              </div>
              <Act kind={pickN ? "orange" : undefined} block disabled={!pickN || busy} onClick={doSell}>{form.pay === "none" ? `Giữ ${pickN} chỗ` : `Bán ${pickN} vé`}</Act>
            </div>
          )}
          <div style={{ ...card, gap: 10 }}>{detail}</div>
          <div style={{ ...card, gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <div style={{ fontSize: 16, fontWeight: 800 }}>Đơn chờ thu tiền</div>
              <span style={{ fontSize: 12, fontWeight: 700, color: "oklch(0.5 0.02 160)" }}>Tự huỷ khi hết giữ chỗ</span>
            </div>
            {!pending.length && <div style={{ fontSize: 14, color: MUTED }}>Không có đơn nào đang chờ chuyển khoản.</div>}
            {pending.map((o) => {
              const p = o.status !== "wait", left = (o.holdUntil ?? 0) - now, s = data.sessions.find((x) => x.id === o.sessionId);
              const seats = [nms(o.seats), ...o.items.filter((i) => i.kind === "ticket" && !isSeatItem(i.name)).map((i) => `${i.name} × ${i.qty}`)].filter(Boolean).join(" · ");
              return (
                <div key={o.id} style={{ display: "flex", flexDirection: "column", gap: 6, padding: "10px 12px", borderRadius: 14, border: `1px solid ${p ? "oklch(0.85 0.06 155)" : "oklch(0.92 0.01 160)"}`, background: p ? "oklch(0.97 0.025 155)" : "white" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ fontFamily: "ui-monospace,monospace", fontSize: 12, fontWeight: 700 }}>{o.code}{s && s.id !== sess.id ? ` · ${label(s)}` : ""}</span>
                    <span style={{ fontSize: 12, fontWeight: 800, color: p ? "oklch(0.4 0.1 155)" : left < 300_000 ? "oklch(0.55 0.17 28)" : "oklch(0.5 0.14 55)" }}>{p ? "Đã thu · vé đã phát" : `Còn ${mmss(left)}`}</span>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 800 }}>{o.name} · <span style={{ fontWeight: 600, color: "oklch(0.5 0.02 160)" }}>{seats}</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <b style={{ color: "oklch(0.58 0.17 45)" }}>{money(o.total)}</b>
                    <button type="button" disabled={busy} onClick={async () => {
                      if (p) { if (await call("unpaid", { orderId: o.id })) setJustPaid((j) => j.filter((i) => i !== o.id)); }
                      else if (await call("paid", { orderId: o.id, pay: "qr" })) { setJustPaid((j) => [...j, o.id]); void resend(o); }
                    }} style={{ cursor: "pointer", fontSize: 12, fontWeight: 800, padding: "7px 12px", borderRadius: 999, background: p ? "oklch(0.6 0.01 160)" : G, color: "white", whiteSpace: "nowrap", border: "none", fontFamily: "inherit" }}>
                      {p ? "Hoàn tác" : "Đã thu tiền"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </aside>
      </div>
      {!seatTotal && <Empty>Sơ đồ chưa có ghế bán được — vào tab <b>Dựng sơ đồ</b> để tô ghế VIP / Thường.</Empty>}
    </div>
  );
}

/** "+ Tạo suất nhanh": một giờ diễn, lặp liên tiếp N ngày. */
function QuickForm({ quick, setQuick, ctx, onDone }: { quick: { from: string; time: string; days: number }; setQuick: (q: { from: string; time: string; days: number } | null) => void; ctx: Ctx; onDone: (sessionId: string) => void }) {
  const dates = Array.from({ length: quick.days }, (_, i) => addDaysKey(quick.from, i));
  return (
    <div style={{ ...card, border: `2px solid ${O}`, flexDirection: "row", flexWrap: "wrap", alignItems: "flex-end" }}>
      <label style={{ ...lbl, flex: "1 1 150px" }}>Ngày diễn đầu tiên<input type="date" style={inputCls} min={ctx.data.today} value={quick.from} onChange={(e) => setQuick({ ...quick, from: e.target.value || ctx.data.today })} /></label>
      <label style={{ ...lbl, flex: "1 1 110px" }}>Giờ diễn<input type="time" style={inputCls} value={quick.time} onChange={(e) => setQuick({ ...quick, time: e.target.value })} /></label>
      <div style={{ ...lbl, flex: "none" }}>Số đêm liên tiếp<Stepper value={quick.days} onDec={() => setQuick({ ...quick, days: Math.max(1, quick.days - 1) })} onInc={() => setQuick({ ...quick, days: Math.min(30, quick.days + 1) })} /></div>
      <div style={{ flex: "1 1 200px", fontSize: 12, fontWeight: 700, color: MUTED, background: SOFT, borderRadius: 12, padding: "8px 12px" }}>{dates.slice(0, 6).map((d) => `${wdOf(d)} ${dm(d)}`).join(" · ")}{dates.length > 6 ? ` … (${dates.length} đêm)` : ""}</div>
      <Act kind="orange" disabled={ctx.busy} onClick={async () => {
        const res = await ctx.call("createSessions", { dates, time: quick.time });
        if (!res) return;
        setQuick(null);
        const s = res.sessions.find((x) => x.date === quick.from && x.time === quick.time);
        if (s) onDone(s.id);
      }}>Tạo suất</Act>
    </div>
  );
}
