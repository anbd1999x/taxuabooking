"use client";

import { useMemo, useState } from "react";
import { WEB_CONFIRM_MIN, addDaysKey, itemsLine, ticketQty, type TkOrder } from "@/lib/ticket-core";
import { showToast } from "@/components/admin/Toast";
import { Act, BORDER, Badge, G, Head, HoldLeft, MUTED, O, RED, Seg, Stat, Stepper, VenuePick, card, copyText, dm, money, printTickets, short, statGrid, ticketUrl, useExpiryReload, useNow, useWidth, wdOf, type Ctx } from "./ui";
/** Tab VÉ CỔNG: quota 7 ngày, tạm dừng bán, đơn theo ngày (xác nhận & gửi vé) và bán tại cổng. */
export function GateTab({ ctx }: { ctx: Ctx }) {
  const { data, call, busy } = ctx;
  const w = useWidth();
  const inner = w - (w >= 1024 ? 256 : 0);
  const { venue, today } = data;
  const [day, setDay] = useState(today);
  const [sellQ, setSellQ] = useState<Record<string, number>>({});
  const [foodQ, setFoodQ] = useState<Record<string, number>>({});
  const [pay, setPay] = useState<"cash" | "qr">("cash");
  const [msg, setMsg] = useState("");
  const now = useNow();
  useExpiryReload(ctx, now);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDaysKey(today, i)), [today]);
  const sessOf = (d: string) => data.sessions.find((s) => s.date === d);
  const ordersOf = (d: string) => {
    const s = sessOf(d);
    return s ? data.orders.filter((o) => o.sessionId === s.id) : [];
  };
  const quotaOf = (d: string) => sessOf(d)?.quota ?? venue.config.quota;
  const soldOf = (d: string) => ordersOf(d).reduce((a, o) => a + ticketQty(o), 0);

  const todayOrders = ordersOf(today);
  const entries = todayOrders.flatMap((o) => o.tickets.filter((t) => t.kind === "entry"));
  const waitN = data.orders.filter((o) => o.status === "wait").length;
  const revenue = todayOrders.filter((o) => o.status !== "wait").reduce((a, o) => a + o.total, 0);
  const vouchers = todayOrders.flatMap((o) => o.tickets.filter((t) => t.kind === "food")).length;

  const tiers = data.tiers.filter((t) => t.active && !t.seatClass);
  const menu = data.menu.filter((m) => m.active);
  const sellN = tiers.reduce((a, t) => a + (sellQ[t.id] ?? 0), 0);
  const sellTotal = tiers.reduce((a, t) => a + (sellQ[t.id] ?? 0) * t.price, 0) + menu.reduce((a, m) => a + (foodQ[m.id] ?? 0) * m.price, 0);

  async function doSell() {
    if (!sellN || busy) return;
    const res = await call("gateSell", {
      date: today, pay,
      tickets: tiers.map((t) => ({ tierId: t.id, qty: sellQ[t.id] ?? 0 })),
      food: menu.map((m) => ({ menuId: m.id, qty: foodQ[m.id] ?? 0 })),
    }, { quiet: true });
    if (!res) return;
    const o = res.orders.find((x) => x.id === res.orderId);
    setMsg(`Đã bán ${sellN} vé · ${money(sellTotal)} ${pay === "cash" ? "tiền mặt" : "chuyển khoản"}${o ? " · " + o.code : ""} · đang in vé…`);
    setSellQ({});
    setFoodQ({});
    if (o && !(await printTickets(o, venue.name, `${wdOf(today)} ${dm(today)}`))) showToast("Trình duyệt chặn cửa sổ in — cho phép pop-up để in vé.", "error");
  }

  async function sendTicket(o: TkOrder, confirm: boolean) {
    if (confirm && !(await call("confirm", { orderId: o.id }, { quiet: true }))) return;
    const ok = await copyText(ticketUrl(o));
    showToast(ok ? `${confirm ? "Đã xác nhận · " : ""}Đã chép link vé ${o.code} — dán gửi khách qua Zalo.` : `Link vé: ${ticketUrl(o)}`);
  }

  const dayOrders = ordersOf(day);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Head title="Vé vào cổng điểm check-in" note="Quota theo ngày, tạm dừng bán, bán tại cổng và đơn chờ xác nhận" right={<VenuePick ctx={ctx} />} />

      <div style={statGrid}>
        <Stat k="Bán hôm nay" v={`${soldOf(today)}/${quotaOf(today)}`} c="oklch(0.45 0.1 158)" />
        <Stat k="Đã vào cổng" v={entries.filter((t) => t.usedAt).length} c="oklch(0.55 0.12 155)" />
        <Stat k="Chờ xác nhận" v={waitN} c={O} />
        <Stat k="Doanh thu hôm nay" v={short(revenue)} c={O} />
        <Stat k="Voucher đồ uống" v={vouchers} c="oklch(0.55 0.13 250)" />
      </div>

      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ fontSize: 16, fontWeight: 800 }}>Quota 7 ngày tới</div>
          <span style={{ fontSize: 12, fontWeight: 700, color: MUTED }}>Bấm − / + để đổi quota, bấm “Tạm dừng” khi đóng cửa vì thời tiết · bấm thẻ ngày để xem đơn</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(min(100%,150px),1fr))", gap: 8 }}>
          {days.map((d) => {
            const q = quotaOf(d), so = soldOf(d), paused = sessOf(d)?.status === "paused", full = so >= q, low = q - so < 30;
            const st = paused ? ["Tạm dừng", "oklch(0.92 0.005 160)", "oklch(0.35 0.02 160)", "oklch(0.7 0.01 160)"] : full ? ["Hết vé", "oklch(0.96 0.03 28)", RED, "oklch(0.55 0.17 28)"] : low ? ["Sắp hết", "oklch(0.96 0.05 75)", "oklch(0.48 0.14 55)", O] : ["Đang bán", "oklch(0.94 0.05 155)", "oklch(0.36 0.1 155)", "oklch(0.55 0.12 155)"];
            const sq: React.CSSProperties = { cursor: "pointer", width: 28, height: 28, borderRadius: 8, border: "1.5px solid oklch(0.9 0.01 160)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, background: "white", fontFamily: "inherit" };
            const stop = (fn: () => void) => (e: React.MouseEvent) => {
              e.stopPropagation();
              if (!busy) fn();
            };
            return (
              <div key={d} onClick={() => setDay(d)} style={{ cursor: "pointer", padding: 12, borderRadius: 16, border: `2px solid ${d === day ? G : "oklch(0.92 0.01 160)"}`, background: paused ? "oklch(0.975 0.003 160)" : "white", display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 6 }}>
                  <span style={{ fontSize: 15, fontWeight: 800 }}>{wdOf(d)} {dm(d)}</span>
                  <Badge bg={st[1]} fg={st[2]}>{st[0]}</Badge>
                </div>
                <div style={{ height: 7, borderRadius: 4, background: "oklch(0.93 0.01 160)", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${Math.min(100, Math.round((so / Math.max(1, q)) * 100))}%`, background: st[3] }} />
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "oklch(0.35 0.02 160)" }}>{so} / {q} vé</div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <button type="button" style={sq} onClick={stop(() => call("setQuota", { date: d, quota: Math.max(so, q - 10) }, { quiet: true }))} aria-label="Giảm quota">−</button>
                    <button type="button" style={sq} onClick={stop(() => call("setQuota", { date: d, quota: q + 10 }, { quiet: true }))} aria-label="Tăng quota">+</button>
                  </div>
                  <span onClick={stop(() => call("setPause", { date: d, paused: !paused }))} style={{ cursor: "pointer", fontSize: 12, fontWeight: 800, color: paused ? G : RED, whiteSpace: "nowrap" }}>{paused ? "Mở bán lại" : "Tạm dừng"}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: inner >= 1100 ? "minmax(0,1fr) 340px" : "1fr", gap: 14, alignItems: "start" }}>
        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div style={{ fontSize: 16, fontWeight: 800 }}>Đơn vé {day === today ? "hôm nay" : "ngày"} · {wdOf(day)} {dm(day)}</div>
            <span style={{ fontSize: 12, fontWeight: 700, color: MUTED }}>Vé cổng: khách gửi yêu cầu, mình gọi xác nhận trong {WEB_CONFIRM_MIN} phút — quá hạn đơn tự huỷ</span>
          </div>
          {!dayOrders.length && <div style={{ fontSize: 14, color: MUTED }}>Chưa có đơn vé nào cho ngày này.</div>}
          {dayOrders.map((o) => {
            const en = o.tickets.filter((t) => t.kind === "entry");
            const allIn = en.length > 0 && en.every((t) => t.usedAt);
            const someIn = en.some((t) => t.usedAt);
            const S = o.status === "wait" ? ["Chờ xác nhận", "oklch(0.96 0.05 75)", "oklch(0.48 0.14 55)"] : allIn ? ["Đã vào cổng", "oklch(0.94 0.05 155)", "oklch(0.36 0.1 155)"] : someIn ? [`Đã vào ${en.filter((t) => t.usedAt).length}/${en.length}`, "oklch(0.94 0.05 155)", "oklch(0.36 0.1 155)"] : ["Đã gửi vé", "oklch(0.94 0.04 250)", "oklch(0.42 0.12 250)"];
            return (
              <div key={o.id} style={{ display: "grid", gridTemplateColumns: inner >= 640 ? "minmax(0,1fr) auto" : "1fr", gap: 10, alignItems: "center", padding: "10px 12px", borderRadius: 14, border: "1px solid oklch(0.92 0.01 160)" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: "ui-monospace,monospace", fontSize: 12, fontWeight: 700, color: MUTED }}>{o.code} · {o.source}{o.payMethod ? " · " + o.payMethod : ""}</div>
                  <div style={{ fontSize: 15, fontWeight: 800 }}>{o.name} {o.phone && <span style={{ fontWeight: 600, color: MUTED }}>· {o.phone}</span>}</div>
                  <div style={{ fontSize: 13, color: "oklch(0.38 0.02 160)" }}>{itemsLine(o)}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
                  <b style={{ whiteSpace: "nowrap" }}>{money(o.total)}</b>
                  {o.status === "wait" && <HoldLeft until={o.holdUntil} now={now} />}
                  <Badge big bg={S[1]} fg={S[2]}>{S[0]}</Badge>
                  {o.status === "wait" && <Act kind="pri" disabled={busy} onClick={() => sendTicket(o, true)}>Xác nhận &amp; gửi vé</Act>}
                  {o.status !== "wait" && !allIn && <Act disabled={busy} onClick={() => sendTicket(o, false)}>Gửi lại vé</Act>}
                  {!someIn && <span onClick={() => !busy && window.confirm(`Huỷ đơn ${o.code}?`) && call("cancel", { orderId: o.id })} style={{ cursor: "pointer", fontSize: 12, fontWeight: 800, color: RED }}>Huỷ</span>}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ ...card, border: `2px solid ${O}` }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800 }}>Bán tại cổng</div>
            <div style={{ fontSize: 13, color: MUTED }}>Khách mua trực tiếp, in vé hoặc cho quét QR trên máy · vé cho hôm nay {dm(today)}</div>
          </div>
          {!tiers.length && <div style={{ fontSize: 13, color: RED }}>Chưa có hạng vé — thêm ở tab Thiết lập.</div>}
          {tiers.map((t) => (
            <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800 }}>{t.name}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "oklch(0.6 0.18 42)" }}>{t.price ? money(t.price) : "Miễn phí"}</div>
              </div>
              <Stepper value={sellQ[t.id] ?? 0} onDec={() => setSellQ((q) => ({ ...q, [t.id]: Math.max(0, (q[t.id] ?? 0) - 1) }))} onInc={() => { setSellQ((q) => ({ ...q, [t.id]: (q[t.id] ?? 0) + 1 })); setMsg(""); }} />
            </div>
          ))}
          {menu.length > 0 && (
            <details>
              <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 800, color: MUTED }}>Đồ ăn uống kèm ({menu.reduce((a, m) => a + (foodQ[m.id] ?? 0), 0)})</summary>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                {menu.map((m) => (
                  <div key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{m.name} <span style={{ color: "oklch(0.6 0.18 42)" }}>· {money(m.price)}</span></div>
                    <Stepper value={foodQ[m.id] ?? 0} onDec={() => setFoodQ((q) => ({ ...q, [m.id]: Math.max(0, (q[m.id] ?? 0) - 1) }))} onInc={() => setFoodQ((q) => ({ ...q, [m.id]: (q[m.id] ?? 0) + 1 }))} />
                  </div>
                ))}
              </div>
            </details>
          )}
          <Seg dark grow items={[["cash", "Tiền mặt"], ["qr", "Chuyển khoản QR"]]} value={pay} onPick={setPay} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderTop: "1px dashed oklch(0.86 0.01 160)", paddingTop: 10 }}>
            <span style={{ fontWeight: 700 }}>Thu</span>
            <span style={{ fontSize: 24, fontWeight: 800, color: "oklch(0.58 0.17 45)" }}>{money(sellTotal)}</span>
          </div>
          <button type="button" onClick={doSell} disabled={!sellN || busy} style={{ cursor: sellN ? "pointer" : "default", textAlign: "center", fontSize: 15, fontWeight: 800, padding: 13, borderRadius: 999, background: sellN ? O : "oklch(0.75 0.01 160)", color: "white", border: "none", fontFamily: "inherit" }}>
            Bán &amp; in {sellN} vé
          </button>
          {msg && <div style={{ fontSize: 13, fontWeight: 700, padding: "9px 12px", borderRadius: 12, background: "oklch(0.95 0.04 155)", color: "oklch(0.36 0.1 155)" }}>{msg}</div>}
        </div>
      </div>
      <div style={{ fontSize: 12, color: MUTED, borderTop: `1px solid ${BORDER}`, paddingTop: 10 }}>Quota mặc định mỗi ngày: <b>{venue.config.quota}</b> vé (đổi ở tab Thiết lập). Ngày chưa chỉnh tay dùng quota mặc định.</div>
    </div>
  );
}
