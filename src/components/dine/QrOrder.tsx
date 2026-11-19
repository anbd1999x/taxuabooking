"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { DINE_CATS, hm, isFee, money, type DineCustomer, type DineStatus } from "@/lib/dine-core";

const G = "oklch(0.29 0.055 160)";
const O = "oklch(0.68 0.18 45)";
const DIM = "oklch(0.5 0.02 160)";
/** [nhãn, nền, chữ, bước] */
const SS: Record<Exclude<DineStatus, "paid" | "cancel">, [string, string, string, number]> = {
  new: ["Đã gửi bếp", "oklch(0.96 0.05 75)", "oklch(0.48 0.14 55)", 0],
  cooking: ["Bếp đang làm", "oklch(0.94 0.04 250)", "oklch(0.42 0.12 250)", 1],
  served: ["Đã lên món", "oklch(0.94 0.05 155)", "oklch(0.36 0.1 155)", 2],
};
const round: React.CSSProperties = { cursor: "pointer", width: 30, height: 30, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, border: "none", fontFamily: "inherit", fontSize: 16, padding: 0 };

/**
 * Điện thoại khách sau khi quét QR ở bàn — theo mẫu claude.ai/design "Nha hang QR Order".
 * Thực đơn → giỏ món (ghi chú từng món / cả bàn) → gửi bếp; tab "Món đã gọi" theo dõi Đã gửi → Đang làm → Lên món,
 * gọi nhân viên, xin thanh toán (tiền mặt / VietQR). Trạng thái nạp lại 5 giây một lần qua GET /api/qr.
 */
export function QrOrder({ initial, q }: { initial: DineCustomer; q: { v: string; t: string; k: string } }) {
  const [d, setD] = useState(initial);
  const [tab, setTab] = useState<"menu" | "cart" | "status">("menu");
  // Nhóm món: Món chính → Ăn kèm → Đồ uống trước, nhóm quán tự đặt theo sau.
  const cats = useMemo(() => {
    const rank = (c: string) => (DINE_CATS.indexOf(c) + 1 || DINE_CATS.length + 1);
    return [...new Set(d.menu.map((m) => m.group || "Khác"))].sort((x, y) => rank(x) - rank(y));
  }, [d.menu]);
  const [cat, setCat] = useState(cats[0] ?? "");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const [payPick, setPayPick] = useState(false);
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);
  const [payQr, setPayQr] = useState("");
  /** Món đang xem ảnh lớn (bấm vào ảnh ở thực đơn) + ảnh bắt đầu. */
  const [zoom, setZoom] = useState<{ id: string; i: number } | null>(null);
  // "Đã thanh toán · Cảm ơn" chỉ cho máy đã thấy món của bàn trong lần mở trang này — khách mới ngồi vào quét mã
  // trong 30 phút sau khi bàn trước thu tiền không bị báo "đã thanh toán".
  const [hadOrders, setHadOrders] = useState(initial.orders.length > 0);
  if (d.orders.length > 0 && !hadOrders) setHadOrders(true);
  const showPaid = d.paid && hadOrders;
  const toastT = useRef<ReturnType<typeof setTimeout>>(undefined);
  const qs = `v=${encodeURIComponent(q.v)}&t=${encodeURIComponent(q.t)}&k=${encodeURIComponent(q.k)}`;

  const say = useCallback((m: string) => {
    clearTimeout(toastT.current);
    setToast(m);
    toastT.current = setTimeout(() => setToast(""), 2400);
  }, []);
  useEffect(() => {
    const iv = setInterval(async () => {
      if (document.hidden) return;
      try {
        const r = await fetch(`/api/qr?${qs}`, { cache: "no-store" });
        if (r.ok) setD(await r.json());
      } catch {
        /* mất mạng tạm thời */
      }
    }, 5000);
    return () => clearInterval(iv);
  }, [qs]);
  const qrText = d.payReq === "Chuyển khoản" && d.bank ? d.bank.qr : "";
  useEffect(() => {
    let off = false;
    if (qrText) QRCode.toDataURL(qrText, { margin: 1, width: 220 }).then((u) => !off && setPayQr(u), () => {});
    return () => {
      off = true;
    };
  }, [qrText]);

  async function post(body: Record<string, unknown>): Promise<boolean> {
    if (busy) return false;
    setBusy(true);
    try {
      const r = await fetch("/api/qr", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...q, ...body }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        say(j.error ?? "Có lỗi, thử lại giúp mình.");
        return false;
      }
      setD(j);
      if (j.message) say(j.message);
      return true;
    } catch {
      say("Mất kết nối, thử lại giúp mình.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  const item = (id: string) => d.menu.find((m) => m.id === id);
  // Món vừa bị tắt / xoá khỏi thực đơn thì rơi khỏi giỏ.
  const ids = Object.keys(cart).filter((k) => cart[k] > 0 && item(k)?.avail);
  const cartN = ids.reduce((a, k) => a + cart[k], 0);
  const cartTotal = ids.reduce((a, k) => a + cart[k] * (item(k)?.price ?? 0), 0);
  const setQ = (id: string, n: number) => setCart((c) => ({ ...c, [id]: Math.max(0, Math.min(50, n)) }));
  const curCat = cats.includes(cat) ? cat : (cats[0] ?? "");

  async function send() {
    if (!cartN) return;
    if (await post({ op: "order", note, items: ids.map((k) => ({ menuId: k, qty: cart[k], note: notes[k] ?? "" })) })) {
      setCart({});
      setNotes({});
      setNote("");
      setTab("status");
    }
  }
  const onMenu = tab === "menu" || tab === "cart";
  /** Món đang xem ảnh lớn + số lượng đang có trong giỏ. */
  const zm = zoom ? item(zoom.id) : undefined;
  const zn = zm ? (cart[zm.id] ?? 0) : 0;

  return (
    <div style={{ minHeight: "100dvh", background: "oklch(0.96 0.008 160)", display: "flex", justifyContent: "center", color: "oklch(0.22 0.03 160)" }}>
      <style>{"@keyframes qrUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}@keyframes qrDrop{from{opacity:0;transform:translateY(-16px)}to{opacity:1;transform:none}}.qr-noscroll{scrollbar-width:none}.qr-noscroll::-webkit-scrollbar{display:none}"}</style>
      <div style={{ position: "relative", width: "100%", maxWidth: 480, height: "100dvh", display: "flex", flexDirection: "column", background: "oklch(0.98 0.006 80)", overflow: "hidden" }}>
        <div style={{ padding: "14px 16px 10px", background: G, color: "white", display: "flex", flexDirection: "column", gap: 8, flex: "none" }}>
          <div>
            <div style={{ fontSize: 12, opacity: 0.8 }}>{d.venue}</div>
            <div style={{ fontSize: 19, fontWeight: 800 }}>Bàn {d.table}</div>
          </div>
          <div style={{ display: "flex", gap: 4, padding: 3, borderRadius: 12, background: "oklch(1 0 0 / .12)" }}>
            {([["menu", "Thực đơn"], ["status", `Món đã gọi${d.orders.filter((o) => !isFee(o)).length ? " · " + d.orders.filter((o) => !isFee(o)).length : ""}`]] as const).map(([k, name]) => {
              const on = k === "menu" ? onMenu : tab === "status";
              return <div key={k} onClick={() => setTab(k)} style={{ flex: 1, textAlign: "center", cursor: "pointer", fontSize: 13, fontWeight: 800, padding: 7, borderRadius: 9, background: on ? "white" : "transparent", color: on ? G : "white" }}>{name}</div>;
            })}
          </div>
        </div>

        {tab === "menu" && (
          <>
            <div className="qr-noscroll" style={{ display: "flex", gap: 6, overflowX: "auto", padding: "10px 14px", background: "white", borderBottom: "1px solid oklch(0.93 0.008 160)", flex: "none" }}>
              {cats.map((c) => <div key={c} onClick={() => setCat(c)} style={{ cursor: "pointer", flex: "none", fontSize: 13, fontWeight: 800, padding: "7px 12px", borderRadius: 999, background: curCat === c ? G : "oklch(0.95 0.006 160)", color: curCat === c ? "white" : "oklch(0.3 0.03 160)" }}>{c}</div>)}
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "10px 14px 96px", display: "flex", flexDirection: "column", gap: 8 }}>
              {!d.menu.length && <div style={{ padding: "24px 14px", textAlign: "center", fontSize: 14, color: DIM }}>Quán chưa đưa thực đơn lên. Bạn gọi nhân viên giúp mình nhé.</div>}
              {d.menu.filter((m) => (m.group || "Khác") === curCat).map((m) => {
                const n = cart[m.id] ?? 0;
                return (
                  <div key={m.id} style={{ display: "flex", gap: 10, padding: 8, borderRadius: 16, background: "white", border: "1px solid oklch(0.93 0.008 160)", opacity: m.avail ? 1 : 0.5 }}>
                    <div style={{ position: "relative", width: 96, height: 96, borderRadius: 12, overflow: "hidden", flex: "none", background: "repeating-linear-gradient(-45deg, oklch(0.95 0.02 160) 0 8px, oklch(0.975 0.01 160) 8px 16px)" }}>
                      <Slides images={m.images} alt={m.name} onTap={(i) => setZoom({ id: m.id, i })} />
                      {m.hot && <span style={{ position: "absolute", left: 4, top: 4, fontSize: 9, fontWeight: 800, padding: "2px 6px", borderRadius: 999, background: O, color: "white", pointerEvents: "none" }}>Bán chạy</span>}
                    </div>
                    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                      <div style={{ fontSize: 14, fontWeight: 800, lineHeight: 1.3 }}>{m.name}</div>
                      {/* Mô tả chi tiết: thẻ chỉ hiện 2 dòng, bấm để xem đầy đủ (kèm ảnh). */}
                      {m.desc && <div onClick={() => setZoom({ id: m.id, i: 0 })} style={{ cursor: "pointer", fontSize: 11, lineHeight: 1.35, color: DIM, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", whiteSpace: "pre-line" }}>{m.desc}</div>}
                      <div style={{ flex: 1 }} />
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                        <b style={{ fontSize: 14, color: "oklch(0.58 0.17 45)" }}>{money(m.price)}</b>
                        {!m.avail ? (
                          <span style={{ fontSize: 11, fontWeight: 800, color: DIM }}>Hết món</span>
                        ) : (
                          <div style={{ display: "flex", alignItems: "center", gap: 2, padding: 2, borderRadius: 999, background: n ? "oklch(0.93 0.03 155)" : "transparent" }}>
                            {n > 0 && (
                              <>
                                <button type="button" onClick={() => setQ(m.id, n - 1)} style={{ ...round, background: "white", color: "inherit" }} aria-label="Bớt">−</button>
                                <span style={{ minWidth: 20, textAlign: "center", fontSize: 14, fontWeight: 800 }}>{n}</span>
                              </>
                            )}
                            <button type="button" onClick={() => setQ(m.id, n + 1)} style={{ ...round, background: G, color: "white" }} aria-label={`Thêm ${m.name}`}>+</button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {tab === "cart" && (
          <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px 110px", display: "flex", flexDirection: "column", gap: 10 }}>
            <div onClick={() => setTab("menu")} style={{ cursor: "pointer", fontSize: 13, fontWeight: 800, color: "oklch(0.4 0.08 158)" }}>← Chọn thêm món</div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>Giỏ món · bàn {d.table}</div>
            {!ids.length && <div style={{ fontSize: 14, color: DIM }}>Giỏ đang trống.</div>}
            {ids.map((k) => {
              const m = item(k)!;
              return (
                <div key={k} style={{ display: "flex", flexDirection: "column", gap: 6, padding: "10px 12px", borderRadius: 14, background: "white", border: "1px solid oklch(0.93 0.008 160)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 800 }}>{m.name}</div>
                      <div style={{ fontSize: 12, color: DIM }}>{money(m.price)} · {money(m.price * cart[k])}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 2, padding: 2, borderRadius: 999, background: "oklch(0.95 0.006 160)" }}>
                      <button type="button" onClick={() => setQ(k, cart[k] - 1)} style={{ ...round, background: "white", color: "inherit" }} aria-label="Bớt">−</button>
                      <span style={{ minWidth: 20, textAlign: "center", fontWeight: 800 }}>{cart[k]}</span>
                      <button type="button" onClick={() => setQ(k, cart[k] + 1)} style={{ ...round, background: G, color: "white" }} aria-label="Thêm">+</button>
                    </div>
                  </div>
                  <input value={notes[k] ?? ""} maxLength={120} onChange={(e) => setNotes({ ...notes, [k]: e.target.value })} placeholder="Ghi chú: ít cay, không hành…" style={{ fontSize: 14, padding: "7px 10px", borderRadius: 9, border: "1.5px solid oklch(0.9 0.01 160)", fontFamily: "inherit" }} />
                </div>
              );
            })}
            <textarea value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Ghi chú cho cả bàn (có trẻ nhỏ, lên món chính sau…)" style={{ fontSize: 14, padding: "10px 12px", borderRadius: 12, border: "1.5px solid oklch(0.9 0.01 160)", resize: "none", fontFamily: "inherit" }} />
            <div style={{ fontSize: 12, lineHeight: 1.5, color: DIM }}>Món gửi thẳng tới bếp. Thanh toán tại bàn khi ăn xong.</div>
          </div>
        )}

        {tab === "status" && (
          <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
            {showPaid && (
              <div style={{ padding: 18, borderRadius: 18, background: "oklch(0.94 0.05 155)", textAlign: "center", display: "flex", flexDirection: "column", gap: 6, animation: "qrUp .3s ease both" }}>
                <div style={{ fontSize: 30, fontWeight: 800, color: "oklch(0.4 0.1 155)" }}>✓</div>
                <div style={{ fontSize: 17, fontWeight: 800 }}>Đã thanh toán. Cảm ơn bạn!</div>
                <div style={{ fontSize: 13, color: "oklch(0.4 0.04 160)" }}>Hẹn gặp lại ở Tà Xùa.</div>
              </div>
            )}
            {!d.orders.length && !showPaid && <div style={{ padding: "24px 14px", textAlign: "center", border: "1.5px dashed oklch(0.86 0.02 160)", borderRadius: 16, fontSize: 14, color: DIM }}>Bàn chưa gọi món nào.</div>}
            {d.orders.filter((o) => !isFee(o)).map((o, i) => {
              const S = SS[o.status as keyof typeof SS] ?? SS.new;
              return (
                <div key={o.id} style={{ display: "flex", flexDirection: "column", gap: 8, padding: 12, borderRadius: 16, background: "white", border: `1.5px solid ${o.status === "served" ? "oklch(0.85 0.06 155)" : "oklch(0.92 0.01 160)"}`, animation: "qrUp .3s ease both" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <b style={{ fontSize: 14 }}>Lần gọi {i + 1} · {hm(o.at)}</b>
                    <span style={{ fontSize: 11, fontWeight: 800, padding: "3px 9px", borderRadius: 999, background: S[1], color: S[2] }}>{S[0]}</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 4 }}>
                    {["Đã gửi", "Đang làm", "Lên món"].map((name, j) => (
                      <div key={name} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <div style={{ height: 5, borderRadius: 3, background: j <= S[3] ? (S[3] === 2 ? "oklch(0.55 0.12 155)" : O) : "oklch(0.92 0.01 160)" }} />
                        <span style={{ fontSize: 10, fontWeight: 700, color: j <= S[3] ? "oklch(0.3 0.03 160)" : "oklch(0.6 0.01 160)" }}>{name}</span>
                      </div>
                    ))}
                  </div>
                  {o.items.map((it, n) => (
                    <div key={n} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13 }}>
                      <span><b>{it.qty}×</b> {it.name}{it.note && <span style={{ display: "block", fontSize: 11, color: "oklch(0.5 0.12 45)" }}>{it.note}</span>}</span>
                      <span style={{ whiteSpace: "nowrap" }}>{money(it.price * it.qty)}</span>
                    </div>
                  ))}
                  {o.note && <div style={{ fontSize: 12, padding: "6px 8px", borderRadius: 8, background: "oklch(0.97 0.03 80)", color: "oklch(0.42 0.08 55)" }}>{o.note}</div>}
                  {/* Bếp chưa bấm "Đang làm" ⇒ khách tự huỷ được lần gọi này. */}
                  {o.status === "new" && (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, paddingTop: 8, borderTop: "1px dashed oklch(0.9 0.01 160)" }}>
                      <span style={{ fontSize: 11, color: DIM }}>Bếp chưa bắt đầu làm — còn huỷ được</span>
                      <button type="button" disabled={busy} onClick={() => window.confirm(`Huỷ lần gọi ${i + 1} (${o.items.reduce((a, it) => a + it.qty, 0)} món)?`) && post({ op: "cancel", orderId: o.id })} style={{ cursor: "pointer", fontSize: 12, fontWeight: 800, padding: "7px 12px", borderRadius: 999, border: "1.5px solid oklch(0.85 0.08 28)", color: "oklch(0.52 0.18 28)", background: "white", fontFamily: "inherit", whiteSpace: "nowrap" }}>Huỷ lần gọi</button>
                    </div>
                  )}
                </div>
              );
            })}
            {/* Phụ thu quán thêm vào hoá đơn (phí phục vụ, ngày lễ…) — không phải lần gọi món. */}
            {d.orders.some(isFee) && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: 12, borderRadius: 16, background: "white", border: "1.5px solid oklch(0.92 0.01 160)" }}>
                <b style={{ fontSize: 14 }}>Phụ thu</b>
                {d.orders.filter(isFee).flatMap((o) => o.items).map((it, n) => (
                  <div key={n} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13 }}>
                    <span>{it.name}</span>
                    <span style={{ whiteSpace: "nowrap" }}>{money(it.price * it.qty)}</span>
                  </div>
                ))}
              </div>
            )}
            {d.orders.length > 0 && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "12px 14px", borderRadius: 14, background: "oklch(0.96 0.02 155)" }}>
                  <span style={{ fontWeight: 800 }}>Tạm tính cả bàn</span>
                  <span style={{ fontSize: 22, fontWeight: 800, color: "oklch(0.58 0.17 45)" }}>{money(d.bill)}</span>
                </div>
                {/* Đã chọn cách thanh toán: chỉ báo trạng thái — hoá đơn chi tiết (+ mã QR nếu chuyển khoản) mở bằng nút "Xem hoá đơn". */}
                {d.payReq && (
                  <div onClick={() => setPayPick(true)} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 10, fontSize: 13, lineHeight: 1.45, padding: "10px 12px", borderRadius: 12, background: d.claimNote ? "oklch(0.96 0.03 28)" : d.payClaim ? "oklch(0.95 0.05 155)" : "oklch(0.97 0.04 75)", color: d.claimNote ? "oklch(0.48 0.17 28)" : d.payClaim ? "oklch(0.32 0.09 155)" : "oklch(0.45 0.12 50)" }}>
                    <span style={{ flex: 1, minWidth: 0, fontWeight: 700 }}>
                      {d.claimNote ? `Quán chưa nhận được tiền chuyển khoản — mở hoá đơn để xem` : d.payClaim ? `Đã gửi xác nhận chuyển khoản · chờ quán kiểm tra` : d.payReq === "Chuyển khoản" ? "Đã chọn chuyển khoản · mở hoá đơn để quét mã QR" : "Đã báo nhân viên · thanh toán tiền mặt tại bàn"}
                    </span>
                    <span style={{ flex: "none", fontSize: 12, fontWeight: 800, padding: "6px 10px", borderRadius: 999, background: "white" }}>Xem hoá đơn</span>
                  </div>
                )}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  <button type="button" disabled={busy || d.staffAsked} onClick={() => post({ op: "staff" })} style={{ cursor: "pointer", textAlign: "center", fontSize: 13, fontWeight: 800, padding: 11, borderRadius: 999, border: "1.5px solid oklch(0.85 0.04 158)", color: "oklch(0.3 0.06 158)", background: "white", fontFamily: "inherit", opacity: d.staffAsked ? 0.6 : 1 }}>{d.staffAsked ? "Đã gọi nhân viên" : "Gọi nhân viên"}</button>
                  <button type="button" onClick={() => setPayPick(true)} style={{ cursor: "pointer", textAlign: "center", fontSize: 13, fontWeight: 800, padding: 11, borderRadius: 999, background: G, color: "white", border: "none", fontFamily: "inherit" }}>{d.payReq ? "Xem hoá đơn" : "Thanh toán"}</button>
                </div>
              </>
            )}
            {!d.orders.length && (
              <button type="button" disabled={busy || d.staffAsked} onClick={() => post({ op: "staff" })} style={{ cursor: "pointer", alignSelf: "center", fontSize: 13, fontWeight: 800, padding: "11px 18px", borderRadius: 999, border: "1.5px solid oklch(0.85 0.04 158)", color: "oklch(0.3 0.06 158)", background: "white", fontFamily: "inherit", opacity: d.staffAsked ? 0.6 : 1 }}>{d.staffAsked ? "Đã gọi nhân viên" : "Gọi nhân viên"}</button>
            )}
          </div>
        )}

        {cartN > 0 && tab !== "status" && (
          <div style={{ position: "absolute", left: 12, right: 12, bottom: "calc(14px + env(safe-area-inset-bottom))", display: "flex", alignItems: "center", gap: 10, padding: "10px 10px 10px 16px", borderRadius: 999, background: G, color: "white", boxShadow: "0 12px 24px -10px oklch(0.15 0.04 160 / .7)", animation: "qrUp .25s ease both" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, opacity: 0.85 }}>{cartN} món</div>
              <div style={{ fontSize: 17, fontWeight: 800 }}>{money(cartTotal)}</div>
            </div>
            <button type="button" disabled={busy} onClick={() => (tab === "cart" ? send() : setTab("cart"))} style={{ cursor: "pointer", fontSize: 14, fontWeight: 800, padding: "11px 18px", borderRadius: 999, background: O, color: "white", whiteSpace: "nowrap", border: "none", fontFamily: "inherit", opacity: busy ? 0.6 : 1 }}>{tab === "cart" ? (busy ? "Đang gửi…" : "Gửi order cho bếp") : "Xem giỏ →"}</button>
          </div>
        )}
        {payPick && d.orders.length > 0 && <BillSheet d={d} payQr={payQr} busy={busy} q={q} post={post} say={say} onClose={() => setPayPick(false)} />}
        {zoom && zm && (
            <div style={{ position: "absolute", inset: 0, zIndex: 8, background: "oklch(0.15 0.02 160 / .96)", display: "flex", flexDirection: "column", animation: "qrUp .2s ease both" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "14px 16px", color: "white" }}>
                <b style={{ fontSize: 16, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{zm.name}</b>
                <button type="button" onClick={() => setZoom(null)} aria-label="Đóng" style={{ ...round, width: 36, height: 36, background: "oklch(1 0 0 / .16)", color: "white", fontSize: 18, flex: "none" }}>×</button>
              </div>
              <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
                <Slides images={zm.images} alt={zm.name} start={zoom.i} big />
              </div>
              <div style={{ padding: "12px 16px calc(16px + env(safe-area-inset-bottom))", color: "white", display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {zm.desc && <div style={{ fontSize: 13, lineHeight: 1.45, opacity: 0.85, whiteSpace: "pre-line", maxHeight: "32vh", overflowY: "auto", marginBottom: 4 }}>{zm.desc}</div>}
                  <b style={{ fontSize: 18, color: "oklch(0.82 0.13 70)" }}>{money(zm.price)}</b>
                </div>
                {zm.avail ? (
                  <button type="button" onClick={() => { setQ(zm.id, zn + 1); say(`Đã thêm ${zm.name} vào giỏ`); }} style={{ cursor: "pointer", fontSize: 14, fontWeight: 800, padding: "12px 18px", borderRadius: 999, background: O, color: "white", border: "none", fontFamily: "inherit", whiteSpace: "nowrap" }}>+ Thêm{zn ? ` (${zn})` : ""}</button>
                ) : (
                  <span style={{ fontSize: 13, fontWeight: 800, opacity: 0.8 }}>Hết món</span>
                )}
              </div>
            </div>
        )}
        {toast && <div style={{ position: "absolute", left: 16, right: 16, top: 120, padding: "12px 14px", borderRadius: 14, background: "oklch(0.25 0.04 160)", color: "white", fontSize: 13, fontWeight: 700, textAlign: "center", animation: "qrDrop .25s ease both", zIndex: 9 }}>{toast}</div>}
      </div>
    </div>
  );
}

/**
 * Ảnh của món dạng TRƯỢT (vuốt ngang, scroll-snap): chấm báo vị trí + số ảnh. `big` = bản xem lớn (ảnh hiện trọn, không cắt).
 * Không có ảnh ⇒ không dựng gì (khung cha tự hiện nền sọc).
 */
function Slides({ images, alt, onTap, start = 0, big }: { images: string[]; alt: string; onTap?: (i: number) => void; start?: number; big?: boolean }) {
  const [at, setAt] = useState(start);
  if (!images.length) return null;
  const cur = Math.min(at, images.length - 1);
  return (
    <>
      <div
        className="qr-noscroll"
        // Mở bản xem lớn đúng ảnh khách vừa bấm.
        ref={(el) => {
          if (el && start && !el.dataset.init) {
            el.dataset.init = "1";
            el.scrollLeft = start * el.clientWidth;
          }
        }}
        onScroll={(e) => setAt(Math.round(e.currentTarget.scrollLeft / Math.max(1, e.currentTarget.clientWidth)))}
        style={{ position: "absolute", inset: 0, display: "flex", overflowX: "auto", scrollSnapType: "x mandatory", overscrollBehaviorX: "contain" }}
      >
        {images.map((u, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={u} src={u} alt={i ? "" : alt} loading={i ? "lazy" : undefined} onClick={() => onTap?.(i)} style={{ flex: "none", width: "100%", height: "100%", objectFit: big ? "contain" : "cover", scrollSnapAlign: "center", cursor: onTap ? "zoom-in" : "default" }} />
        ))}
      </div>
      {images.length > 1 && (
        <>
          <span style={{ position: "absolute", right: big ? 12 : 4, top: big ? 8 : 4, fontSize: big ? 12 : 9, fontWeight: 800, padding: big ? "3px 9px" : "1px 5px", borderRadius: 999, background: "oklch(0.2 0.02 160 / .7)", color: "white", pointerEvents: "none" }}>{cur + 1}/{images.length}</span>
          <div style={{ position: "absolute", left: 0, right: 0, bottom: big ? 10 : 4, display: "flex", justifyContent: "center", gap: big ? 6 : 3, pointerEvents: "none" }}>
            {images.map((u, i) => <span key={u} style={{ width: big ? 8 : 5, height: big ? 8 : 5, borderRadius: "50%", background: i === cur ? "white" : "oklch(1 0 0 / .45)", boxShadow: "0 0 2px oklch(0 0 0 / .5)" }} />)}
          </div>
        </>
      )}
    </>
  );
}

/**
 * Trả bằng CHUYỂN KHOẢN: mã VietQR đã kèm đúng số tiền hoá đơn (quét bằng app ngân hàng là ra số tiền), nút lưu ảnh QR / chép
 * thông tin (khách đang xem trên chính điện thoại nên thường mở app ngân hàng rồi chọn ảnh QR), rồi "Tôi đã chuyển khoản"
 * kèm ảnh bill ⇒ quán xem bill và xác thực. Quán báo chưa nhận được tiền ⇒ hiện lý do, gửi lại được.
 */
function TransferBox({ d, bank, payQr, busy, q, post, say }: {
  d: DineCustomer;
  bank: NonNullable<DineCustomer["bank"]>;
  payQr: string;
  busy: boolean;
  q: { v: string; t: string; k: string };
  post: (body: Record<string, unknown>) => Promise<boolean>;
  say: (m: string) => void;
}) {
  const [proof, setProof] = useState("");
  const [up, setUp] = useState(false);
  const claim = d.payClaim;
  const changed = claim && claim.amount !== d.bill;
  const copy = (text: string, what: string) => {
    void navigator.clipboard?.writeText(text).then(() => say(`Đã chép ${what}`), () => say(text));
  };
  async function upload(file: File | undefined) {
    if (!file) return;
    setUp(true);
    try {
      const fd = new FormData();
      fd.set("v", q.v);
      fd.set("t", q.t);
      fd.set("k", q.k);
      fd.set("file", file);
      const r = await fetch("/api/qr/proof", { method: "POST", body: fd });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) say(j.error ?? "Không tải được ảnh, thử lại.");
      else setProof(j.url);
    } catch {
      say("Mất kết nối, thử lại.");
    } finally {
      setUp(false);
    }
  }
  const chip: React.CSSProperties = { cursor: "pointer", fontSize: 11, fontWeight: 800, padding: "5px 9px", borderRadius: 999, border: "1px solid oklch(0.88 0.02 160)", background: "white", color: G, fontFamily: "inherit", whiteSpace: "nowrap" };
  const row = (k: string, v: React.ReactNode, copyText?: string, what?: string) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, fontSize: 13 }}>
      <span style={{ color: DIM, flex: "none" }}>{k}</span>
      <span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
        <b style={{ minWidth: 0, overflowWrap: "anywhere", textAlign: "right" }}>{v}</b>
        {copyText && <button type="button" onClick={() => copy(copyText, what ?? k)} style={chip}>Chép</button>}
      </span>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: 14, borderRadius: 16, background: "white", border: `1.5px solid ${O}` }}>
      <b style={{ fontSize: 15, textAlign: "center" }}>Quét mã VietQR — app ngân hàng tự điền số tiền</b>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {payQr ? <img src={payQr} alt="Mã VietQR chuyển khoản" width={200} height={200} style={{ borderRadius: 10 }} /> : <div style={{ width: 200, height: 200 }} />}
        {payQr && <a href={payQr} download={`VietQR-${bank.memo.replace(/\s+/g, "-")}.png`} style={{ ...chip, textDecoration: "none", padding: "7px 12px", fontSize: 12 }}>Lưu ảnh QR (mở app ngân hàng → quét ảnh)</a>}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "10px 12px", borderRadius: 12, background: "oklch(0.975 0.006 160)" }}>
        {row("Ngân hàng", bank.name)}
        {row("Số tài khoản", <span style={{ fontFamily: "ui-monospace,monospace" }}>{bank.account}</span>, bank.account, "số tài khoản")}
        {row("Chủ tài khoản", bank.holder)}
        {row("Số tiền", <span style={{ color: "oklch(0.58 0.17 45)", fontSize: 16 }}>{money(d.bill)}</span>, String(d.bill), "số tiền")}
        {row("Nội dung", bank.memo, bank.memo, "nội dung")}
      </div>

      {claim ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "10px 12px", borderRadius: 12, background: "oklch(0.95 0.05 155)", color: "oklch(0.32 0.09 155)", fontSize: 13, lineHeight: 1.5 }}>
          <b>Đã gửi xác nhận chuyển khoản {money(claim.amount)} lúc {hm(claim.at)}</b>
          <span>Quán đang kiểm tra tài khoản, xác nhận xong bàn sẽ được đóng hoá đơn.</span>
          {changed && <span style={{ color: "oklch(0.5 0.15 45)", fontWeight: 700 }}>Hoá đơn vừa thay đổi thành {money(d.bill)} — chuyển thêm phần chênh lệch rồi gửi lại xác nhận.</span>}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {claim.proof && <img src={claim.proof} alt="Ảnh bill đã gửi" style={{ width: 90, borderRadius: 8, border: "1px solid oklch(0.85 0.04 155)" }} />}
        </div>
      ) : (
        <>
          {d.claimNote && (
            <div style={{ fontSize: 13, lineHeight: 1.5, padding: "10px 12px", borderRadius: 12, background: "oklch(0.96 0.03 28)", color: "oklch(0.48 0.17 28)" }}>
              <b>Quán chưa nhận được tiền:</b> {d.claimNote}. Kiểm tra lại giao dịch rồi gửi xác nhận lại.
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 4, borderTop: "1px dashed oklch(0.9 0.01 160)" }}>
            <b style={{ fontSize: 14 }}>Chuyển xong? Gửi ảnh bill để quán xác nhận</b>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {proof && <img src={proof} alt="Ảnh bill" style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 8, flex: "none" }} />}
              <label style={{ cursor: "pointer", flex: 1, textAlign: "center", fontSize: 13, fontWeight: 800, padding: 11, borderRadius: 12, border: "1.5px dashed oklch(0.8 0.04 158)", color: "oklch(0.35 0.07 158)" }}>
                {up ? "Đang tải ảnh…" : proof ? "Đổi ảnh bill" : "📷 Chọn ảnh bill chuyển khoản"}
                <input type="file" accept="image/*" hidden disabled={up} onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = ""; }} />
              </label>
            </div>
            <button type="button" disabled={busy || up} onClick={async () => { if (proof || window.confirm("Gửi xác nhận mà không kèm ảnh bill? Quán sẽ tự kiểm tra tài khoản.")) if (await post({ op: "claim", proof })) setProof(""); }} style={{ cursor: "pointer", textAlign: "center", fontSize: 14, fontWeight: 800, padding: 13, borderRadius: 999, background: O, color: "white", border: "none", fontFamily: "inherit", opacity: busy || up ? 0.6 : 1 }}>
              Tôi đã chuyển khoản {money(d.bill)}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * HOÁ ĐƠN (mở bằng nút "Thanh toán" / "Xem hoá đơn" ở tab Món đã gọi): chưa chọn cách trả ⇒ chọn Tiền mặt / Chuyển khoản;
 * đã chọn ⇒ hoá đơn chi tiết (gộp món, phụ thu, tổng). Tiền mặt: báo nhân viên tới thu, KHÔNG có mã QR.
 * Chuyển khoản: kèm mã VietQR đúng số tiền + gửi ảnh bill (TransferBox).
 */
function BillSheet({ d, payQr, busy, q, post, say, onClose }: {
  d: DineCustomer;
  payQr: string;
  busy: boolean;
  q: { v: string; t: string; k: string };
  post: (body: Record<string, unknown>) => Promise<boolean>;
  say: (m: string) => void;
  onClose: () => void;
}) {
  const [choosing, setChoosing] = useState(!d.payReq);
  const pick = choosing || !d.payReq;
  // Gộp món giống nhau (cùng tên + giá) qua các lần gọi; phụ thu tách riêng.
  const lines = new Map<string, { name: string; price: number; qty: number }>();
  for (const o of d.orders) if (!isFee(o)) for (const it of o.items) {
    const k = `${it.name}|${it.price}`;
    lines.set(k, { name: it.name, price: it.price, qty: (lines.get(k)?.qty ?? 0) + it.qty });
  }
  const fees = d.orders.filter(isFee).flatMap((o) => o.items);
  const food = [...lines.values()].reduce((a, l) => a + l.price * l.qty, 0);
  const choose = async (method: string) => {
    if (await post({ op: "pay", method })) setChoosing(false);
  };
  const methodBtn = (method: string, title: string, sub: string, bg: string, fg: string) => (
    <button key={method} type="button" disabled={busy} onClick={() => void choose(method)} style={{ cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2, textAlign: "left", padding: "14px 16px", borderRadius: 16, background: bg, color: fg, border: d.payReq === method ? `2px solid ${fg}` : "2px solid transparent", fontFamily: "inherit" }}>
      <b style={{ fontSize: 15 }}>{title}</b>
      <span style={{ fontSize: 12, opacity: 0.85 }}>{sub}</span>
    </button>
  );

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 8, background: "oklch(0.2 0.03 160 / .55)", display: "flex", flexDirection: "column", justifyContent: "flex-end", animation: "qrUp .2s ease both" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ maxHeight: "92%", overflowY: "auto", background: "oklch(0.985 0.004 160)", borderRadius: "22px 22px 0 0", padding: "14px 16px calc(18px + env(safe-area-inset-bottom))", display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <b style={{ fontSize: 18 }}>Hoá đơn · bàn {d.table}</b>
          <button type="button" onClick={onClose} aria-label="Đóng" style={{ ...round, width: 34, height: 34, background: "oklch(0.93 0.008 160)", color: G, fontSize: 18, flex: "none" }}>×</button>
        </div>

        {/* Hoá đơn chi tiết */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: 14, borderRadius: 16, background: "white", border: "1.5px solid oklch(0.92 0.01 160)" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: DIM }}>{d.venue}</div>
          {[...lines.values()].map((l, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 8, fontSize: 14 }}>
              <span><b>{l.qty}×</b> {l.name}<span style={{ display: "block", fontSize: 11, color: DIM }}>{money(l.price)} / phần</span></span>
              <b style={{ whiteSpace: "nowrap" }}>{money(l.price * l.qty)}</b>
            </div>
          ))}
          {fees.length > 0 && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: DIM, paddingTop: 6, borderTop: "1px dashed oklch(0.9 0.01 160)" }}><span>Tiền món</span><span>{money(food)}</span></div>
              {fees.map((f, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13 }}><span>Phụ thu · {f.name}</span><span style={{ whiteSpace: "nowrap" }}>{money(f.price * f.qty)}</span></div>
              ))}
            </>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", paddingTop: 8, borderTop: "1.5px solid oklch(0.9 0.01 160)" }}>
            <b style={{ fontSize: 15 }}>Tổng thanh toán</b>
            <b style={{ fontSize: 24, color: "oklch(0.58 0.17 45)" }}>{money(d.bill)}</b>
          </div>
        </div>

        {pick ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <b style={{ fontSize: 15 }}>Chọn hình thức thanh toán</b>
            {methodBtn("Tiền mặt", "💵 Tiền mặt tại bàn", "Báo nhân viên mang hoá đơn ra bàn thu tiền", "oklch(0.95 0.04 155)", "oklch(0.36 0.1 155)")}
            {methodBtn("Chuyển khoản", "🏦 Chuyển khoản QR", d.bank ? "Hiện mã QR có sẵn số tiền — quét bằng app ngân hàng" : "Nhân viên mang mã chuyển khoản ra bàn", "oklch(0.95 0.04 250)", "oklch(0.42 0.12 250)")}
            {d.payReq && <button type="button" onClick={() => setChoosing(false)} style={{ cursor: "pointer", alignSelf: "center", fontSize: 13, fontWeight: 700, color: DIM, background: "none", border: "none", fontFamily: "inherit" }}>Giữ cách đang chọn ({d.payReq.toLowerCase()})</button>}
          </div>
        ) : d.payReq === "Chuyển khoản" ? (
          d.bank ? <TransferBox d={d} bank={d.bank} payQr={payQr} busy={busy} q={q} post={post} say={say} /> : <div style={{ fontSize: 13, lineHeight: 1.5, padding: "12px 14px", borderRadius: 14, background: "white", border: "1.5px solid oklch(0.9 0.01 160)" }}>Quán chưa cài mã chuyển khoản — nhân viên sẽ mang mã ra bàn.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 4, padding: "12px 14px", borderRadius: 14, background: "oklch(0.95 0.04 155)", color: "oklch(0.32 0.09 155)", fontSize: 13, lineHeight: 1.5 }}>
            <b style={{ fontSize: 14 }}>💵 Thanh toán tiền mặt</b>
            <span>Đã báo nhân viên — nhân viên sẽ mang hoá đơn ra bàn. Bạn chuẩn bị <b>{money(d.bill)}</b> nhé.</span>
          </div>
        )}
        {!pick && <button type="button" onClick={() => setChoosing(true)} style={{ cursor: "pointer", alignSelf: "center", fontSize: 13, fontWeight: 800, padding: "8px 14px", borderRadius: 999, border: "1.5px solid oklch(0.88 0.015 160)", background: "white", color: G, fontFamily: "inherit" }}>Đổi hình thức thanh toán</button>}
      </div>
    </div>
  );
}
