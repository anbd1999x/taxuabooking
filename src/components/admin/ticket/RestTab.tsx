"use client";

import { useMemo, useState } from "react";
import { addDaysKey, foodItems, mealOverlap, mealRange, policyPreview, type OrderStatus, type RestPolicy, type TkOrder, type TkTable } from "@/lib/ticket-core";
import { showToast } from "@/components/admin/Toast";
import { Act, Badge, Empty, G, Head, HoldLeft, KV, MUTED, O, SOFT, Stat, Stepper, VenuePick, card, dm, h, inputCls, lastName, lbl, money, printHtml, statGrid, useExpiryReload, useNow, useWidth, wdOf, type Ctx } from "./ui";

/** [nhãn, nền, viền, chữ] */
const RS: Record<"wait" | "ok" | "here" | "eat" | "free", [string, string, string, string]> = {
  wait: ["Chờ xác nhận", "oklch(0.96 0.05 75)", "oklch(0.75 0.13 60)", "oklch(0.45 0.12 55)"],
  ok: ["Đã xác nhận", "oklch(0.94 0.04 155)", "oklch(0.6 0.1 155)", "oklch(0.32 0.08 155)"],
  here: ["Khách đã đến", "oklch(0.45 0.1 158)", "oklch(0.45 0.1 158)", "white"],
  eat: ["Đang dùng bữa", "oklch(0.55 0.13 250)", "oklch(0.55 0.13 250)", "white"],
  free: ["Trống", "white", "oklch(0.82 0.03 155)", "oklch(0.55 0.02 160)"],
};
const ZONE_BG = ["oklch(0.975 0.012 155)", "oklch(0.97 0.03 70)", "oklch(0.965 0.02 230)", "oklch(0.965 0.02 300)", "oklch(0.965 0.015 250)", "oklch(0.97 0.02 20)"];
const POL: Record<RestPolicy, [string, string]> = {
  none: ["Không bắt buộc", "Giữ bàn miễn phí, món đặt trước tuỳ khách"],
  deposit: ["Chỉ thu cọc bàn", "Khách chuyển cọc mỗi bàn, món trả tại quán"],
  min: ["Bắt buộc đặt món tối thiểu", "Bàn chỉ giữ khi đặt trước đủ số tiền tối thiểu"],
};
const stKey = (s: OrderStatus) => (s === "draft" ? "wait" : s === "wait" || s === "ok" || s === "here" || s === "eat" ? s : "free");

/** Tab NHÀ HÀNG: sơ đồ bàn theo ngày + khung giờ, giữ bàn cho khách gọi điện, phiếu bếp, chính sách cọc. */
export function RestTab({ ctx }: { ctx: Ctx }) {
  const { data, call, busy } = ctx;
  const w = useWidth();
  const inner = w - (w >= 1024 ? 256 : 0);
  const now = useNow();
  useExpiryReload(ctx, now);
  const { venue, today } = data;
  const cfg = venue.config;
  const [day, setDay] = useState(today);
  const [slot, setSlot] = useState(cfg.slots[Math.min(3, cfg.slots.length - 1)]);
  const [floor, setFloor] = useState<number | "all">("all");
  const [selId, setSelId] = useState<string | null>(null);
  const [hold, setHold] = useState<null | { name: string; phone: string; guests: number; note: string; food: Record<string, number>; notes: Record<string, string> }>(null);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDaysKey(today, i)), [today]);
  const tables = data.tables.filter((t) => t.active);
  const menu = data.menu.filter((m) => m.active);
  const sessOf = (o: TkOrder) => data.sessions.find((x) => x.id === o.sessionId);
  /**
   * Đơn đang giữ bàn `t` ở (ngày, giờ): đơn đúng khung giờ đó, hoặc đơn ở khung khác mà thời lượng bữa ăn (mealMin) chồng lên
   * — cùng quy tắc server dùng để chặn đặt trùng.
   */
  const bk = (d: string, time: string, t: TkTable): TkOrder | undefined => {
    const live = data.orders.filter((o) => o.status !== "done" && o.status !== "cancel" && o.seats.includes(t.id));
    const exact = live.find((o) => { const s = sessOf(o); return s?.date === d && s.time === time; });
    return exact ?? live.find((o) => { const s = sessOf(o); return !!s && mealOverlap(s.date, s.time, d, time, cfg.mealMin); });
  };
  const cur = tables.map((t) => ({ t, b: bk(day, slot, t) }));
  const booked = cur.filter((c) => c.b);
  const uniq = [...new Map(booked.map((c) => [c.b!.id, c.b!])).values()].filter((o) => o.status !== "draft");
  const selC = cur.find((c) => c.t.id === selId);
  const floorName = (i: number) => cfg.floors[i]?.name ?? `Tầng ${i + 1}`;

  const zones = useMemo(() => {
    const m = new Map<string, { floor: number; zone: string; list: typeof cur }>();
    for (const c of cur) {
      const key = c.t.floor + "|" + c.t.zone;
      if (!m.has(key)) m.set(key, { floor: c.t.floor, zone: c.t.zone, list: [] });
      m.get(key)!.list.push(c);
    }
    return [...m.values()].sort((a, b) => a.floor - b.floor);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, day, slot]);

  // Phiếu bếp cả ngày: gộp món theo khung giờ (bỏ bàn đã lên món / đã trả).
  const kitchen = cfg.slots
    .map((time) => {
      const s = data.sessions.find((x) => x.date === day && x.time === time);
      const orders = s ? data.orders.filter((o) => o.sessionId === s.id && (o.status === "wait" || o.status === "ok" || o.status === "here") && foodItems(o).length) : [];
      const m = new Map<string, { q: number; name: string; note: string }>();
      for (const o of orders) for (const f of foodItems(o)) {
        const k = f.name + "|" + f.note;
        m.set(k, { q: (m.get(k)?.q ?? 0) + f.qty, name: f.name, note: f.note });
      }
      const names = orders.flatMap((o) => o.seats.map((id) => data.tables.find((t) => t.id === id)?.name ?? "?"));
      return { time, tables: names, items: [...m.values()] };
    })
    .filter((k) => k.items.length);

  function printKitchen() {
    const body = kitchen.map((k) => `<div class="blk"><h2>${h(k.time)} · Bàn ${h(k.tables.join(", "))}</h2>${k.items.map((i) => `<div><b>${i.q}×</b> ${h(i.name)}${i.note ? ` — <i>${h(i.note)}</i>` : ""}</div>`).join("")}</div>`).join("");
    if (!printHtml(`Phiếu bếp ${dm(day)}`, `<h1>${h(venue.name)} · Phiếu bếp</h1><p>${wdOf(day)} ${dm(day)} · món khách đặt trước</p>${body}`)) showToast("Trình duyệt chặn cửa sổ in — cho phép pop-up.", "error");
  }

  function startHold() {
    if (!selC || selC.b) return showToast("Bấm chọn một bàn TRỐNG trên sơ đồ trước, rồi giữ bàn.", "error");
    setHold({ name: "", phone: "", guests: Math.min(2, selC.t.cap), note: "", food: {}, notes: {} });
  }
  async function submitHold() {
    if (!hold || !selC) return;
    const res = await call("tableHold", {
      date: day, time: slot, tableIds: [selC.t.id], name: hold.name, phone: hold.phone, guests: hold.guests, note: hold.note,
      food: menu.filter((m) => hold.food[m.id]).map((m) => ({ menuId: m.id, qty: hold.food[m.id], note: hold.notes[m.id] ?? "" })),
    });
    if (res) setHold(null);
  }
  const savePolicy = (policy: RestPolicy, amount: number) => !busy && call("savePolicy", { policy, amount }, { quiet: true });

  if (!tables.length) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Head title={`${venue.name} · đặt bàn & món trước`} note="Sơ đồ bàn theo khung giờ, phiếu bếp và chính sách cọc" right={<VenuePick ctx={ctx} />} />
        <Empty>Nhà hàng chưa khai bàn nào. Vào tab <b>Thiết lập</b> để thêm bàn (tên, số chỗ, khu, tầng) và thực đơn đặt trước.</Empty>
      </div>
    );
  }

  let panel: React.ReactNode = <div style={{ fontSize: 14, lineHeight: 1.55, color: MUTED }}>Bấm một bàn để xem khách, món đặt trước và cập nhật trạng thái. Bàn trống: bấm để giữ cho khách gọi điện.</div>;
  if (selC) {
    const { t, b } = selC;
    const where = `${floorName(t.floor)} · ${t.zone}`;
    if (b) {
      const S = RS[stKey(b.status)], food = foodItems(b), depDue = b.deposit > b.paid;
      const st = (to: string) => () => call("tableStatus", { orderId: b.id, to }, { quiet: true });
      const cancel = () => window.confirm(`Huỷ bàn ${t.name} của ${b.name}?`) && call("cancel", { orderId: b.id });
      panel = (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <div style={{ fontSize: 20, fontWeight: 800 }}>Bàn {t.name} · {t.cap} chỗ</div>
            <Badge big bg={S[1]} fg={S[3]}>{b.status === "draft" ? "Khách đang đặt" : S[0]}</Badge>
          </div>
          <KV k="Vị trí" v={where} />
          <KV k="Mã đơn" v={b.status === "draft" ? "—" : `${b.code} · ${b.source}`} />
          <KV k="Khách" v={b.status === "draft" ? "Khách web đang điền thông tin (giữ 10 phút)" : b.name} />
          <KV k="Điện thoại" v={b.phone || "—"} />
          <KV k="Số khách" v={`${b.guests} người · ${sessOf(b)?.time ?? slot}`} />
          <KV k="Giữ bàn" v={`${mealRange(sessOf(b)?.time ?? slot, cfg.mealMin)}${sessOf(b) && sessOf(b)!.time !== slot ? ` · đặt lúc ${sessOf(b)!.time}, chồng khung ${slot}` : ""}`} />
          {(b.status === "wait" || b.status === "draft") && b.holdUntil && <KV k="Hạn giữ chỗ" v={<HoldLeft until={b.holdUntil} now={now} />} />}
          <KV k="Cọc bàn" v={!b.deposit ? "Không cần" : depDue ? `Chưa thu ${money(b.deposit)}` : `Đã thu ${money(b.paid)}`} />
          {b.foodAmount > 0 && <KV k="Tiền món đặt trước" v={money(b.foodAmount)} />}
          {b.note && <KV k="Ghi chú" v={b.note} />}
          {food.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "10px 12px", borderRadius: 14, background: "oklch(0.97 0.03 80)" }}>
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".06em", color: "oklch(0.48 0.13 55)" }}>MÓN ĐẶT TRƯỚC</div>
              {food.map((f, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 14 }}>
                  <span><b>{f.qty}×</b> {f.name}{f.note && <span style={{ display: "block", fontSize: 12, color: "oklch(0.5 0.12 45)" }}>“{f.note}”</span>}</span>
                  <b style={{ whiteSpace: "nowrap" }}>{money(f.price * f.qty)}</b>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {b.status === "draft" && <Act kind="warn" disabled={busy} onClick={cancel}>Nhả bàn</Act>}
            {b.status === "wait" && <><Act kind="pri" disabled={busy} onClick={() => call("confirm", { orderId: b.id })}>Xác nhận</Act><Act kind="warn" disabled={busy} onClick={cancel}>Huỷ bàn</Act></>}
            {b.status === "ok" && <><Act kind="pri" disabled={busy} onClick={st("here")}>Khách đã đến</Act>{depDue && <Act disabled={busy} onClick={() => call("paid", { orderId: b.id, pay: "qr" })}>Đã thu cọc</Act>}<Act kind="warn" disabled={busy} onClick={cancel}>Huỷ bàn</Act></>}
            {b.status === "here" && <Act kind="pri" disabled={busy} onClick={st("eat")}>Bắt đầu lên món</Act>}
            {b.status === "eat" && <Act kind="pri" disabled={busy} onClick={st("done")}>Trả bàn</Act>}
          </div>
        </>
      );
    } else {
      panel = (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <div style={{ fontSize: 20, fontWeight: 800 }}>Bàn {t.name} · {t.cap} chỗ</div>
            <Badge big bg="oklch(0.96 0.005 160)" fg="oklch(0.42 0.02 160)">Trống</Badge>
          </div>
          <KV k="Vị trí" v={where} />
          <KV k="Khung giờ" v={`${dm(day)} · ${slot}`} />
          {!hold ? (
            <div><Act kind="pri" onClick={startHold}>Giữ bàn cho khách gọi điện</Act></div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <label style={lbl}>Tên khách<input style={inputCls} value={hold.name} onChange={(e) => setHold({ ...hold, name: e.target.value })} placeholder="Khách gọi điện" /></label>
                <label style={lbl}>Điện thoại<input style={inputCls} inputMode="tel" value={hold.phone} onChange={(e) => setHold({ ...hold, phone: e.target.value })} /></label>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 14, fontWeight: 700 }}>Số khách<Stepper value={hold.guests} onDec={() => setHold({ ...hold, guests: Math.max(1, hold.guests - 1) })} onInc={() => setHold({ ...hold, guests: hold.guests + 1 })} /></div>
              {hold.guests > t.cap && <div style={{ fontSize: 12, fontWeight: 700, color: "oklch(0.5 0.14 55)" }}>Bàn {t.name} chỉ {t.cap} chỗ — đoàn đông nên giữ thêm bàn bên cạnh.</div>}
              <label style={lbl}>Ghi chú<input style={inputCls} value={hold.note} onChange={(e) => setHold({ ...hold, note: e.target.value })} placeholder="Sinh nhật, ghế trẻ em…" /></label>
              {menu.length > 0 && (
                <details>
                  <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 800, color: MUTED }}>Món đặt trước ({Object.values(hold.food).reduce((a, n) => a + n, 0)})</summary>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                    {menu.map((m) => (
                      <div key={m.id} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                          <div style={{ fontSize: 13, fontWeight: 700 }}>{m.name} <span style={{ color: "oklch(0.6 0.18 42)" }}>· {money(m.price)}</span></div>
                          <Stepper value={hold.food[m.id] ?? 0} onDec={() => setHold({ ...hold, food: { ...hold.food, [m.id]: Math.max(0, (hold.food[m.id] ?? 0) - 1) } })} onInc={() => setHold({ ...hold, food: { ...hold.food, [m.id]: (hold.food[m.id] ?? 0) + 1 } })} />
                        </div>
                        {(hold.food[m.id] ?? 0) > 0 && <input style={{ ...inputCls, fontSize: 13, padding: "7px 10px" }} value={hold.notes[m.id] ?? ""} onChange={(e) => setHold({ ...hold, notes: { ...hold.notes, [m.id]: e.target.value } })} placeholder="Ghi chú món (ít cay, không hành…)" />}
                      </div>
                    ))}
                  </div>
                </details>
              )}
              <div style={{ display: "flex", gap: 6 }}>
                <Act kind="pri" disabled={busy} onClick={submitHold}>Giữ bàn</Act>
                <Act onClick={() => setHold(null)}>Thôi</Act>
              </div>
            </div>
          )}
        </>
      );
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Head
        title={`${venue.name} · đặt bàn & món trước`}
        note={`Sơ đồ bàn theo khung giờ, phiếu bếp và chính sách cọc · mỗi lượt đặt giữ bàn ${cfg.mealMin} phút`}
        right={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <VenuePick ctx={ctx} />
            <button type="button" onClick={startHold} style={{ cursor: "pointer", fontSize: 14, fontWeight: 800, padding: "10px 16px", borderRadius: 999, background: O, color: "white", whiteSpace: "nowrap", border: "none", fontFamily: "inherit" }}>+ Đặt bàn cho khách gọi điện</button>
          </div>
        }
      />

      <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 12, borderRadius: 18, background: "white", border: "1px solid oklch(0.92 0.008 160)" }}>
        <div style={{ display: "flex", gap: 6, overflowX: "auto" }}>
          {days.map((d) => {
            const on = d === day;
            return (
              <div key={d} onClick={() => { setDay(d); setSelId(null); setHold(null); }} style={{ cursor: "pointer", flex: "none", minWidth: 70, textAlign: "center", padding: "8px 10px", borderRadius: 12, border: `1.5px solid ${on ? G : "oklch(0.9 0.01 160)"}`, background: on ? G : "white", color: on ? "white" : "oklch(0.25 0.03 160)" }}>
                <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.75 }}>{wdOf(d)}</div>
                <div style={{ fontSize: 15, fontWeight: 800 }}>{dm(d)}</div>
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 6, overflowX: "auto" }}>
          {cfg.slots.map((time) => {
            const n = tables.filter((t) => bk(day, time, t)).length, on = time === slot;
            return (
              <div key={time} onClick={() => { setSlot(time); setSelId(null); setHold(null); }} style={{ cursor: "pointer", flex: "none", display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 999, border: `1.5px solid ${on ? G : "oklch(0.9 0.01 160)"}`, background: on ? G : "white", color: on ? "white" : "oklch(0.25 0.03 160)", fontSize: 14, fontWeight: 800, whiteSpace: "nowrap" }}>
                {time}
                <span style={{ fontSize: 11, fontWeight: 800, padding: "1px 7px", borderRadius: 999, background: on ? O : n / tables.length > 0.6 ? "oklch(0.96 0.05 75)" : SOFT, color: on ? "white" : "oklch(0.42 0.04 160)" }}>{n}/{tables.length}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div style={statGrid}>
        <Stat k="Bàn đã đặt" v={`${booked.length}/${tables.length}`} c="oklch(0.45 0.1 158)" />
        <Stat k="Khách dự kiến" v={uniq.reduce((a, o) => a + o.guests, 0)} c="oklch(0.55 0.13 250)" />
        <Stat k="Chờ xác nhận" v={uniq.filter((o) => o.status === "wait").length} c={O} />
        <Stat k="Chưa thu cọc" v={cfg.policy === "deposit" ? uniq.filter((o) => o.deposit > o.paid).length : "—"} c="oklch(0.55 0.17 28)" />
        <Stat k="Có món trước" v={`${uniq.filter((o) => foodItems(o).length).length} bàn`} c={O} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: inner >= 1180 ? "minmax(0,1fr) 380px" : "1fr", gap: 14, alignItems: "start" }}>
        <div style={card}>
          <div style={{ fontSize: 16, fontWeight: 800 }}>Sơ đồ bàn · {dm(day)} · {slot}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,150px),1fr))", gap: 6 }}>
            {[{ k: "all" as const, name: "Tất cả tầng", sub: "" }, ...cfg.floors.map((f, i) => ({ k: i, name: f.name, sub: f.sub }))].map((f) => {
              const ts = cur.filter((c) => f.k === "all" || c.t.floor === f.k), n = ts.filter((c) => c.b).length, on = floor === f.k;
              return (
                <div key={f.k} onClick={() => setFloor(f.k)} style={{ cursor: "pointer", display: "flex", flexDirection: "column", gap: 2, padding: "9px 12px", borderRadius: 14, border: `2px solid ${on ? G : "oklch(0.9 0.01 160)"}`, background: on ? "oklch(0.96 0.025 155)" : "white" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 14, fontWeight: 800, whiteSpace: "nowrap" }}>{f.name}</span>
                    <span style={{ fontSize: 11, fontWeight: 800, padding: "1px 7px", borderRadius: 999, background: ts.length && n / ts.length > 0.6 ? "oklch(0.96 0.05 75)" : SOFT, whiteSpace: "nowrap" }}>{n}/{ts.length} bàn</span>
                  </div>
                  {f.sub && <span style={{ fontSize: 11, color: "oklch(0.5 0.02 160)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.sub}</span>}
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}>
            {(["wait", "ok", "here", "eat", "free"] as const).map((k) => (
              <span key={k} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 700, color: "oklch(0.42 0.02 160)", whiteSpace: "nowrap" }}>
                <span style={{ width: 12, height: 12, borderRadius: 4, background: RS[k][1], border: `1.5px solid ${RS[k][2]}` }} />
                {RS[k][0]}
              </span>
            ))}
          </div>
          {zones.filter((z) => floor === "all" || z.floor === floor).map((z, zi) => (
            <div key={z.floor + z.zone} style={{ display: "flex", flexDirection: "column", gap: 8, padding: 12, borderRadius: 16, background: ZONE_BG[zi % ZONE_BG.length] }}>
              <div style={{ fontSize: 14, fontWeight: 800 }}>{floor === "all" ? floorName(z.floor) + " · " : ""}{z.zone}</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {z.list.map(({ t, b }) => {
                  const S = RS[b ? stKey(b.status) : "free"];
                  return (
                    <div key={t.id} onClick={() => { setSelId(t.id); setHold(null); }} style={{ cursor: "pointer", width: t.cap <= 2 ? 92 : t.cap <= 4 ? 104 : t.cap <= 6 ? 120 : 140, minHeight: 72, padding: "6px 8px", borderRadius: t.round && t.cap <= 4 ? 28 : 14, border: `2px solid ${S[2]}`, background: S[1], color: S[3], display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1, boxShadow: selId === t.id ? `0 0 0 3px ${O}` : "none", textAlign: "center" }}>
                      <span style={{ fontSize: 14, fontWeight: 800 }}>{t.name} <span style={{ fontSize: 11, opacity: 0.75 }}>· {t.cap} chỗ</span></span>
                      <span style={{ fontSize: 11, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>{b ? (b.status === "draft" ? "Đang đặt…" : lastName(b.name)) : "Trống"}</span>
                      {b && sessOf(b) && sessOf(b)!.time !== slot && <span style={{ fontSize: 10, fontWeight: 800, opacity: 0.8 }}>đặt {sessOf(b)!.time}</span>}
                      {b && foodItems(b).length > 0 && <span style={{ fontSize: 10, fontWeight: 800, padding: "1px 6px", borderRadius: 999, background: O, color: "white" }}>có món trước</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <aside style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
          <div style={card}>{panel}</div>
          <div style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 16, fontWeight: 800 }}>Phiếu bếp · {wdOf(day)} {dm(day)}</div>
              {kitchen.length > 0 && <span onClick={printKitchen} style={{ cursor: "pointer", fontSize: 13, fontWeight: 800, padding: "7px 12px", borderRadius: 999, border: "1.5px solid oklch(0.88 0.015 160)", whiteSpace: "nowrap" }}>In phiếu</span>}
            </div>
            {!kitchen.length && <div style={{ fontSize: 14, color: MUTED }}>Chưa có món đặt trước trong ngày.</div>}
            {kitchen.map((k) => (
              <div key={k.time} style={{ display: "flex", flexDirection: "column", gap: 4, padding: "10px 12px", borderRadius: 14, background: k.time === slot ? "oklch(0.97 0.04 75)" : "oklch(0.975 0.006 160)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <b style={{ fontSize: 15 }}>{k.time}</b>
                  <span style={{ fontSize: 12, fontWeight: 700, color: MUTED }}>Bàn {k.tables.join(", ")}</span>
                </div>
                {k.items.map((i, n) => (
                  <div key={n} style={{ fontSize: 14 }}><b>{i.q}×</b> {i.name}{i.note && <span style={{ color: "oklch(0.5 0.12 45)" }}> · {i.note}</span>}</div>
                ))}
              </div>
            ))}
          </div>
          <div style={card}>
            <div style={{ fontSize: 16, fontWeight: 800 }}>Chính sách đặt món &amp; cọc</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {(Object.keys(POL) as RestPolicy[]).map((k) => {
                const on = cfg.policy === k;
                return (
                  <div key={k} onClick={() => !on && savePolicy(k, k === "min" ? 300000 : 100000)} style={{ cursor: "pointer", display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 12px", borderRadius: 14, border: `2px solid ${on ? G : "oklch(0.92 0.01 160)"}`, background: on ? "oklch(0.97 0.02 155)" : "white" }}>
                    <span style={{ flex: "none", width: 18, height: 18, marginTop: 1, borderRadius: "50%", border: `2px solid ${on ? G : "oklch(0.75 0.01 160)"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: on ? G : "transparent" }} />
                    </span>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 800 }}>{POL[k][0]}</div>
                      <div style={{ fontSize: 12, color: "oklch(0.5 0.02 160)" }}>{POL[k][1]}</div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 14, fontWeight: 700 }}>{cfg.policy === "min" ? "Tối thiểu mỗi bàn" : cfg.policy === "deposit" ? "Cọc mỗi bàn" : "Cọc (không áp dụng)"}</span>
              <Stepper wide value={cfg.policy === "none" ? "0đ" : money(cfg.amount)} onDec={() => cfg.policy !== "none" && savePolicy(cfg.policy, Math.max(50000, cfg.amount - 50000))} onInc={() => cfg.policy !== "none" && savePolicy(cfg.policy, cfg.amount + 50000)} />
            </div>
            <div style={{ fontSize: 12, lineHeight: 1.5, color: MUTED }}>Khách sẽ thấy: “{policyPreview(cfg)}”</div>
          </div>
        </aside>
      </div>
    </div>
  );
}
