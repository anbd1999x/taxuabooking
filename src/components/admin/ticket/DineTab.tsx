"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { DINE_CATS, DINE_DESC_MAX, DINE_FEE_PRESETS, DINE_LATE_MIN, DINE_MAX_IMAGES, isFee, ago, hm, money, orderQty, tableState, type DineData, type DineMenuVM, type DineOrderVM, type DineStatus, type TableState } from "@/lib/dine-core";
import { BANKS, bankName, vietQrPayload } from "@/lib/ticket-core";
import { showToast } from "@/components/admin/Toast";
import { MoneyTextInput } from "@/components/admin/MoneyInput";
import { usePublishTabs } from "@/components/admin/module-tabs";
import { Empty, G, Head, MUTED, O, RED, VenuePick, h, printHtml, short, useWidth, type Ctx } from "./ui";
import { GateSetup, GuestsPanel, MenuTrPanel } from "./DineExtras";

type Sub = "live" | "tables" | "menu" | "qr" | "pay" | "guests";
const SUBS: [Sub, string][] = [["live", "Order trực tiếp"], ["tables", "Sơ đồ bàn & thu tiền"], ["menu", "Thực đơn"], ["qr", "Bàn & mã QR"], ["pay", "Thanh toán"], ["guests", "Khách hàng"]];
const BLUE = "oklch(0.55 0.13 250)";
const SS: Record<string, [string, string]> = { new: ["Đã gửi bếp", "oklch(0.48 0.14 55)"], cooking: ["Bếp đang làm", "oklch(0.42 0.12 250)"], served: ["Đã lên món", "oklch(0.36 0.1 155)"] };
/** [nhãn, nền, viền, chữ] */
const TS: Record<TableState, [string, string, string, string]> = {
  free: ["Trống", "white", "oklch(0.85 0.03 155)", "oklch(0.4 0.02 160)"],
  wait: ["Đang chờ món", "oklch(0.96 0.05 75)", "oklch(0.75 0.13 60)", "oklch(0.42 0.12 55)"],
  eat: ["Đang dùng bữa", "oklch(0.45 0.1 158)", "oklch(0.45 0.1 158)", "white"],
  pay: ["Chờ thanh toán", BLUE, BLUE, "white"],
};
const ZONE_BG = ["oklch(0.975 0.008 155)", "oklch(0.965 0.02 230)", "oklch(0.97 0.03 70)", "oklch(0.965 0.02 300)"];
const KEYS = "@keyframes dnUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}@keyframes dnFlash{0%{box-shadow:0 0 0 0 oklch(0.68 0.18 45 / .7)}70%{box-shadow:0 0 0 14px oklch(0.68 0.18 45 / 0)}100%{box-shadow:0 0 0 0 oklch(0.68 0.18 45 / 0)}}@keyframes dnBlink{0%,100%{opacity:1}50%{opacity:.35}}@keyframes dnDrop{from{opacity:0;transform:translateY(-16px)}to{opacity:1;transform:none}}";
const inp: React.CSSProperties = { fontSize: 14, padding: 10, borderRadius: 10, border: "1.5px solid oklch(0.88 0.015 160)", fontFamily: "inherit", minWidth: 0, width: "100%", background: "white" };

/** Đơn mới + yêu cầu ĐÃ THẤY của từng quán — cái nào chưa có trong này là "mới tới". Chưa có mục = lần nạp đầu (không báo). */
const SEEN = new Map<string, Set<string>>();

/** Tiếng "ting" báo đơn mới (trình duyệt chỉ cho phát sau khi người dùng đã chạm vào trang). */
function beep() {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ac = new AC(), o = ac.createOscillator(), g = ac.createGain();
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.15, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.5);
    o.connect(g).connect(ac.destination);
    o.onended = () => void ac.close().catch(() => {});
    o.start();
    o.stop(ac.currentTime + 0.5);
  } catch {
    /* không có âm thanh cũng không sao */
  }
}

/**
 * Tab GỌI MÓN QR (nhà hàng) — màn hình quán theo mẫu claude.ai/design "Nha hang QR Order":
 * Order trực tiếp (3 cột Đơn mới → Bếp đang làm → Đã lên món) · Sơ đồ bàn & thu tiền · Thực đơn · Bàn & mã QR.
 * Dữ liệu riêng (POST /api/admin/dine), nạp lại 5 giây một lần; đơn / yêu cầu mới ⇒ thông báo cam 🔔 + tiếng ting.
 */
export function DineTab({ ctx }: { ctx: Ctx }) {
  const venueId = ctx.data.venue.id;
  const w = useWidth();
  const inner = w - (w >= 1024 ? 256 : 0);
  const [d, setD] = useState<DineData | null>(null);
  const [sub, setSub] = useState<Sub>("live");
  const [now, setNow] = useState(() => Date.now());
  const [notice, setNotice] = useState<{ title: string; sub: string; id: string } | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [payMethod, setPayMethod] = useState("Tiền mặt");
  const [busy, setBusy] = useState(false);
  const [qrs, setQrs] = useState<Record<string, string>>({});
  const [nm, setNm] = useState({ name: "", group: DINE_CATS[0], price: "", desc: "" });
  const [ntZone, setNtZone] = useState("");
  /** Bàn vừa "Đổi mã QR" — làm nổi thẻ mới để in lại. */
  const [rotated, setRotated] = useState<string | null>(null);

  const take = useCallback((data: DineData) => {
    const cx = (id: string) => "x:" + id; // khoá "đã thấy" của lần khách huỷ
    const ck = (r: { id: string; claim: { at: number } | null }) => `c:${r.id}:${r.claim?.at}`; // khoá "đã thấy" của lần khách báo đã CK
    const ids = [...data.orders.filter((o) => o.status === "new").map((o) => o.id), ...data.reqs.map((r) => r.id), ...data.reqs.filter((r) => r.claim).map(ck), ...data.guestCancels.map((c) => cx(c.id))];
    const seen = SEEN.get(data.venue.id);
    if (seen) {
      const freshO = data.orders.filter((o) => o.status === "new" && !seen.has(o.id)).pop();
      const freshR = data.reqs.filter((r) => !seen.has(r.id)).pop();
      const freshC = data.guestCancels.find((c) => !seen.has(cx(c.id)));
      const freshK = data.reqs.find((r) => r.claim && !seen.has(ck(r)));
      // Khách huỷ báo trước tiên: bếp cần biết để KHÔNG làm món đó.
      if (freshC) setNotice({ id: cx(freshC.id), title: `Bàn ${freshC.table} đã HUỶ lần gọi ${freshC.qty} món`, sub: `Khách tự huỷ trên điện thoại · ${freshC.summary}` });
      else if (freshK && freshK.claim) setNotice({ id: freshK.id, title: `Bàn ${freshK.table} báo đã chuyển khoản ${money(freshK.claim.amount)}`, sub: freshK.claim.proof ? "Có ảnh bill — mở hoá đơn để xem và xác thực" : "Không kèm ảnh — kiểm tra tài khoản rồi xác thực" });
      else if (freshO) setNotice({ id: freshO.id, title: `Bàn ${freshO.table} vừa gọi ${orderQty(freshO)} món`, sub: freshO.items.map((i) => `${i.qty}× ${i.name}`).join(", ") });
      else if (freshR) setNotice({ id: freshR.id, title: freshR.kind === "pay" ? `Bàn ${freshR.table} muốn thanh toán` : `Bàn ${freshR.table} gọi nhân viên`, sub: freshR.kind === "pay" ? freshR.method : "Khách bấm nút trên điện thoại" });
      if (freshO || freshR || freshC || freshK) beep();
    }
    SEEN.set(data.venue.id, new Set(ids));
    setD(data);
    setNow(Date.now());
  }, []);
  const call = useCallback(async (op: string, payload: Record<string, unknown> = {}): Promise<boolean> => {
    const quiet = op === "load";
    if (!quiet) setBusy(true);
    try {
      const r = await fetch("/api/admin/dine", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...payload, venueId, op }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        if (!quiet) showToast(j.error ?? "Có lỗi, thử lại.", "error");
        return false;
      }
      take(j as DineData);
      if (j.message) showToast(j.message);
      return true;
    } catch {
      if (!quiet) showToast("Mất kết nối, thử lại.", "error");
      return false;
    } finally {
      if (!quiet) setBusy(false);
    }
  }, [venueId, take]);

  useEffect(() => {
    const first = setTimeout(() => void call("load"), 0);
    // Tab trình duyệt bị ẩn (nhân viên đang mở Zalo web…) vẫn phải nhận đơn + kêu "ting" ⇒ vẫn nạp, thưa hơn (15 giây).
    let last = Date.now();
    const poll = setInterval(() => {
      if (document.hidden && Date.now() - last < 15_000) return;
      last = Date.now();
      void call("load");
    }, 5000);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearTimeout(first);
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [call]);

  // Mã QR của từng bàn (nội dung = đường dẫn gọi món đầy đủ, kèm khoá).
  const tableKey = d?.tables.map((t) => t.url).join("|") ?? "";
  useEffect(() => {
    if (!d) return;
    let off = false;
    // Khoá theo đường dẫn (không theo id bàn): đổi mã QR ⇒ ảnh cũ không còn khớp, không lỡ in thẻ cũ trong lúc dựng ảnh mới.
    Promise.all(d.tables.map(async (t) => [t.url, await QRCode.toDataURL(window.location.origin + t.url, { margin: 1, width: 260 })] as const)).then((rows) => !off && setQrs(Object.fromEntries(rows)), () => {});
    return () => {
      off = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableKey]);

  const zones = useMemo(() => [...new Set((d?.tables ?? []).map((t) => t.zone))], [d]);
  const groups = useMemo(() => [...new Set([...(d?.menu ?? []).map((m) => m.group).filter(Boolean), ...DINE_CATS])], [d]);

  // Mục của Gọi món QR = mục con cấp 2 dưới "Gọi món QR" ở menu trái (không còn thanh tab ngang).
  const liveBadge = d ? d.orders.filter((o) => o.status === "new").length + d.reqs.length : 0;
  usePublishTabs(SUBS.map(([key, label]) => ({ key, label, badge: key === "live" ? liveBadge : 0 })), sub, (k) => setSub(k as Sub), "qr");

  const head = <Head title={`${ctx.data.venue.name} · gọi món QR`} note="Khách quét mã ở bàn để gọi món, quán nhận đơn trực tiếp ở đây" right={<VenuePick ctx={ctx} />} />;
  if (!d) return <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>{head}<Empty>Đang tải…</Empty></div>;

  const byT = (id: string) => d.orders.filter((o) => o.tableId === id);
  const sumT = (id: string) => byT(id).reduce((a, o) => a + o.total, 0);
  const count = (s: DineStatus) => d.orders.filter((o) => o.status === s).length;
  const selT = d.tables.find((t) => t.id === sel);
  const shortUrl = (url: string) => `${typeof window === "undefined" ? "" : window.location.host}${url.split("?")[0]}`;

  function printBill() {
    if (!selT) return;
    const rows = byT(selT.id).flatMap((o) => o.items).reduce<Record<string, { name: string; qty: number; price: number }>>((m, i) => {
      const k = i.name + "|" + i.price;
      m[k] = { name: i.name, price: i.price, qty: (m[k]?.qty ?? 0) + i.qty };
      return m;
    }, {});
    // Khách khai ở màn Chào mừng (lần gọi mới nhất có thông tin).
    const pg = [...byT(selT.id)].reverse().find((o) => o.guest)?.guest;
    const guestLine = pg ? `<p>Khách: ${h(pg.name)} · ${pg.pax} khách${pg.phone ? " · " + h(pg.phone) : ""}</p>` : "";
    const body = Object.values(rows).map((r) => `<tr><td>${h(r.name)}</td><td style="text-align:right">${r.qty}</td><td style="text-align:right">${money(r.price)}</td><td style="text-align:right">${money(r.price * r.qty)}</td></tr>`).join("");
    if (!printHtml(`Hoá đơn bàn ${selT.name}`, `<h1>${h(d!.venue.name)}</h1><p>Hoá đơn bàn ${h(selT.name)} · ${new Date().toLocaleString("vi-VN")}</p>${guestLine}<table><tr><th>Món</th><th>SL</th><th>Đơn giá</th><th>Thành tiền</th></tr>${body}<tr><th colspan="3" style="text-align:right">Tổng</th><th style="text-align:right">${money(sumT(selT.id))}</th></tr></table>`))
      showToast("Trình duyệt chặn cửa sổ in — cho phép pop-up.", "error");
  }
  function printCards(ids: string[]) {
    const cards = d!.tables.filter((t) => ids.includes(t.id) && qrs[t.url]).map((t) => `<div style="display:inline-block;width:62mm;margin:0 4mm 6mm 0;padding:6mm 4mm;border-radius:6mm;background:#1b4a36;color:#fff;text-align:center;page-break-inside:avoid;-webkit-print-color-adjust:exact;print-color-adjust:exact"><div style="font-size:9pt;font-weight:800;letter-spacing:.12em;opacity:.85">${h(d!.venue.name.toUpperCase())}</div><div style="font-size:24pt;font-weight:800;line-height:1.1;margin:2mm 0 3mm">Bàn ${h(t.name)}</div><div style="display:inline-block;padding:2.5mm;border-radius:3mm;background:#fff"><img src="${qrs[t.url]}" style="width:38mm;height:38mm;display:block" alt=""></div><div style="font-size:12pt;font-weight:800;margin-top:3mm">Quét để gọi món</div><div style="font-size:7pt;opacity:.8;font-family:monospace;margin-top:1mm">${h(shortUrl(t.url))}</div></div>`).join("");
    if (!cards) return showToast("Mã QR đang được tạo — thử lại sau giây lát.", "error");
    if (!printHtml("Thẻ QR bàn", cards)) showToast("Trình duyệt chặn cửa sổ in — cho phép pop-up.", "error");
  }
  async function rotateQr(id: string, name: string) {
    if (busy) return;
    if (!window.confirm(`Đổi mã QR bàn ${name}?\n\nThẻ QR đang dán ở bàn sẽ KHÔNG dùng được nữa (khách quét sẽ báo không tìm thấy bàn). Sau khi đổi, in thẻ mới và thay ngay.`)) return;
    if (await call("rotateQr", { id })) setRotated(id);
  }

  const card = (o: DineOrderVM) => {
    const late = o.status !== "served" && (now - o.at) / 60000 > DINE_LATE_MIN, flash = o.status === "new" && notice?.id === o.id;
    return (
      <div key={o.id} style={{ display: "flex", flexDirection: "column", gap: 8, padding: 12, borderRadius: 14, background: "white", border: `1.5px solid ${flash ? O : late ? "oklch(0.85 0.08 28)" : "oklch(0.92 0.01 160)"}`, animation: flash ? "dnFlash 1.2s ease 3, dnUp .3s ease both" : "dnUp .3s ease both" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 18, fontWeight: 800 }}>{o.table}</span>
          <span style={{ fontSize: 12, fontWeight: 800, color: late ? "oklch(0.55 0.19 28)" : MUTED, whiteSpace: "nowrap" }}>{o.status === "served" ? `Lên lúc ${hm(o.servedAt ?? o.at)}` : ago(now, o.at)}</span>
        </div>
        {o.guest && <div style={{ fontSize: 12, fontWeight: 700, color: MUTED }}>👤 {o.guest.name} · {o.guest.pax} khách{o.guest.phone && <> · <a href={`tel:${o.guest.phone}`} style={{ color: "inherit" }}>{o.guest.phone}</a></>}</div>}
        {o.items.map((i, n) => (
          <div key={n} style={{ fontSize: 14, lineHeight: 1.35 }}>
            <b>{i.qty}×</b> {i.name}
            {i.note && <span style={{ display: "block", fontSize: 12, fontWeight: 700, color: "oklch(0.52 0.15 45)" }}>↳ {i.note}</span>}
          </div>
        ))}
        {o.note && <div style={{ fontSize: 12, padding: "6px 8px", borderRadius: 8, background: "oklch(0.97 0.03 80)", color: "oklch(0.42 0.08 55)" }}>{o.note}</div>}
        {o.status !== "served" && (
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <button type="button" disabled={busy} onClick={async () => { if ((await call("advance", { id: o.id })) && notice?.id === o.id) setNotice(null); }} style={{ flex: 1, cursor: "pointer", textAlign: "center", fontSize: 13, fontWeight: 800, padding: 10, borderRadius: 999, background: o.status === "new" ? O : G, color: "white", border: "none", fontFamily: "inherit" }}>{o.status === "new" ? "Nhận đơn · bắt đầu làm" : "Đã lên món"}</button>
            <span onClick={() => !busy && window.confirm(`Huỷ lần gọi này của bàn ${o.table}?`) && call("cancelOrder", { id: o.id })} style={{ cursor: "pointer", fontSize: 12, fontWeight: 800, color: RED, padding: "0 4px" }}>Huỷ</span>
          </div>
        )}
      </div>
    );
  };
  const COL: [DineStatus, string, string, string][] = [["new", "Đơn mới", O, "oklch(0.97 0.03 75)"], ["cooking", "Bếp đang làm", BLUE, "oklch(0.97 0.015 250)"], ["served", "Đã lên món", "oklch(0.55 0.12 155)", "oklch(0.97 0.015 155)"]];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <style>{KEYS}</style>
      {head}
      <div style={{ minWidth: 0, background: "white", border: "1px solid oklch(0.92 0.008 160)", borderRadius: 24, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "14px 18px", borderBottom: "1px solid oklch(0.93 0.008 160)", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 800, padding: "5px 10px", borderRadius: 999, background: "oklch(0.94 0.05 155)", color: "oklch(0.36 0.1 155)", whiteSpace: "nowrap" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "oklch(0.55 0.14 155)", animation: "dnBlink 1.4s infinite" }} />
              Đang nhận order trực tiếp
            </span>
            <span style={{ fontSize: 13, color: MUTED, whiteSpace: "nowrap" }}>{new Date(now).toLocaleTimeString("vi-VN")}</span>
          </div>
        </div>

        {notice && (
          <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "12px 18px 0", padding: "12px 14px", borderRadius: 16, background: O, color: "white", animation: "dnDrop .3s ease both, dnFlash 1.2s ease 2" }}>
            <span style={{ fontSize: 22, fontWeight: 800 }}>🔔</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 800 }}>{notice.title}</div>
              <div style={{ fontSize: 12, opacity: 0.9, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{notice.sub}</div>
            </div>
            <div onClick={() => setNotice(null)} style={{ cursor: "pointer", fontSize: 13, fontWeight: 800, padding: "8px 12px", borderRadius: 999, background: "white", color: "oklch(0.5 0.15 45)", whiteSpace: "nowrap" }}>Đã thấy</div>
          </div>
        )}

        <div style={{ padding: "16px 18px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
          {/* ---------- ORDER TRỰC TIẾP ---------- */}
          {sub === "live" && (
            <>
              {d.guestCancels.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "10px 12px", borderRadius: 14, background: "oklch(0.97 0.025 28)", border: "1px solid oklch(0.88 0.06 28)" }}>
                  <b style={{ fontSize: 13, color: "oklch(0.48 0.17 28)" }}>Khách vừa huỷ (10 phút qua) — bếp không làm các món này</b>
                  {d.guestCancels.map((c) => (
                    <div key={c.id} style={{ fontSize: 13, display: "flex", gap: 8, justifyContent: "space-between", flexWrap: "wrap" }}>
                      <span><b>Bàn {c.table}</b> · {c.summary}</span>
                      <span style={{ color: MUTED, whiteSpace: "nowrap" }}>huỷ lúc {hm(c.at)}</span>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,130px),1fr))", gap: 8 }}>
                {([["Bàn có khách", `${d.tables.filter((t) => byT(t.id).length).length}/${d.tables.length}`, G], ["Đơn mới", count("new"), O], ["Đang làm", count("cooking"), BLUE], ["Chờ thanh toán", d.reqs.filter((r) => r.kind === "pay").length, BLUE], ["Doanh thu hôm nay", short(d.revenueToday), "oklch(0.55 0.12 155)"]] as const).map(([k, v, c]) => (
                  <div key={k} style={{ padding: "10px 14px", borderRadius: 14, background: "oklch(0.975 0.006 160)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "oklch(0.45 0.02 160)" }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: c }} />{k}</div>
                    <div style={{ fontSize: 22, fontWeight: 800, marginTop: 2 }}>{v}</div>
                  </div>
                ))}
              </div>
              {d.reqs.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {d.reqs.map((r) => {
                    const pay = r.kind === "pay";
                    const cl = pay ? r.claim : null;
                    return (
                      <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 14, background: cl ? "oklch(0.95 0.05 155)" : pay ? "oklch(0.96 0.04 250)" : "oklch(0.97 0.04 75)", border: `1.5px solid ${cl ? "oklch(0.75 0.1 155)" : pay ? "oklch(0.8 0.08 250)" : "oklch(0.85 0.08 70)"}`, animation: "dnUp .3s ease both" }}>
                        <span style={{ flex: "none", minWidth: 44, textAlign: "center", padding: "6px 4px", borderRadius: 10, background: "white", fontSize: 14, fontWeight: 800 }}>{r.table}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 800 }}>{cl ? `Khách báo ĐÃ chuyển khoản ${money(cl.amount)}${cl.proof ? " · có ảnh bill" : ""}` : pay ? `Yêu cầu thanh toán · ${r.method}` : r.note ? `Gọi nhân viên · ${r.note}` : "Gọi nhân viên"}</div>
                          <div style={{ fontSize: 12, color: "oklch(0.45 0.02 160)" }}>{ago(now, r.at)} trước{r.tableId ? ` · tạm tính ${money(sumT(r.tableId))}` : ""}</div>
                        </div>
                        <button type="button" disabled={busy} onClick={() => { if (pay && r.tableId) { setSub("tables"); setSel(r.tableId); setPayMethod(r.method || "Tiền mặt"); } else void call("reqDone", { id: r.id }); if (notice?.id === r.id) setNotice(null); }} style={{ cursor: "pointer", fontSize: 12, fontWeight: 800, padding: "8px 12px", borderRadius: 999, background: G, color: "white", whiteSpace: "nowrap", border: "none", fontFamily: "inherit" }}>{cl ? "Xem bill · xác thực" : pay ? "Mở hoá đơn" : "Đã tới bàn"}</button>
                      </div>
                    );
                  })}
                </div>
              )}
              <div style={{ display: "grid", gridTemplateColumns: inner >= 800 ? "repeat(3,minmax(0,1fr))" : "1fr", gap: 10, alignItems: "start" }}>
                {COL.map(([k, name, c, bg]) => {
                  const all = d.orders.filter((o) => o.status === k && !isFee(o));
                  const list = k === "served" ? all.slice().sort((a, b) => (b.servedAt ?? b.at) - (a.servedAt ?? a.at)).slice(0, 6) : all;
                  return (
                    <div key={k} style={{ display: "flex", flexDirection: "column", gap: 8, padding: 10, borderRadius: 18, background: bg, minHeight: 180 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "2px 4px" }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, fontWeight: 800 }}><span style={{ width: 9, height: 9, borderRadius: "50%", background: c }} />{name}</span>
                        <span style={{ fontSize: 13, fontWeight: 800, color: c }}>{all.length}</span>
                      </div>
                      {!list.length && <div style={{ fontSize: 12, color: "oklch(0.55 0.02 160)", padding: "10px 4px" }}>Trống</div>}
                      {list.map(card)}
                    </div>
                  );
                })}
              </div>
              {!d.tables.length && <Empty>Chưa có bàn nào. Vào <b>Bàn &amp; mã QR</b> để thêm bàn và in thẻ QR dán lên bàn.</Empty>}
            </>
          )}

          {/* ---------- SƠ ĐỒ BÀN & THU TIỀN ---------- */}
          {sub === "tables" && (
            <div style={{ display: "grid", gridTemplateColumns: inner >= 1000 ? "minmax(0,1fr) 340px" : "1fr", gap: 14, alignItems: "start" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  {(Object.keys(TS) as TableState[]).map((k) => (
                    <span key={k} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "oklch(0.42 0.02 160)" }}><span style={{ width: 12, height: 12, borderRadius: 4, background: TS[k][1], border: `1.5px solid ${TS[k][2]}` }} />{TS[k][0]}</span>
                  ))}
                </div>
                {zones.map((z, zi) => (
                  <div key={z} style={{ display: "flex", flexDirection: "column", gap: 8, padding: 12, borderRadius: 16, background: ZONE_BG[zi % ZONE_BG.length] }}>
                    <div style={{ fontSize: 14, fontWeight: 800 }}>{z}</div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(118px,1fr))", gap: 8 }}>
                      {d.tables.filter((t) => t.zone === z).map((t) => {
                        const k = tableState(d.orders, d.reqs, t.id), S = TS[k];
                        const tg = [...byT(t.id)].reverse().find((o) => o.guest)?.guest;
                        return (
                          <div key={t.id} onClick={() => setSel(t.id)} style={{ cursor: "pointer", display: "flex", flexDirection: "column", gap: 3, padding: 10, borderRadius: 14, border: `2px solid ${S[2]}`, background: S[1], color: S[3], boxShadow: sel === t.id ? `0 0 0 3px ${O}` : "none", animation: k === "pay" ? "dnFlash 1.4s ease infinite" : "none" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><span style={{ fontSize: 17, fontWeight: 800 }}>{t.name}</span><span style={{ fontSize: 11, fontWeight: 700, opacity: 0.8 }}>{t.cap} chỗ</span></div>
                            <span style={{ fontSize: 11, fontWeight: 800 }}>{S[0]}</span>
                            {tg && <span title={tg.phone || undefined} style={{ fontSize: 11, fontWeight: 700, opacity: 0.9, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>👤 {tg.name} · {tg.pax}</span>}
                            <span style={{ fontSize: 13, fontWeight: 800 }}>{byT(t.id).length ? money(sumT(t.id)) : "—"}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
                {!d.tables.length && <Empty>Chưa có bàn nào — thêm ở <b>Bàn &amp; mã QR</b>.</Empty>}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: 16, borderRadius: 18, border: "1.5px solid oklch(0.92 0.01 160)", position: "sticky", top: 84 }}>
                {!selT ? (
                  <div style={{ fontSize: 14, lineHeight: 1.55, color: MUTED }}>Bấm một bàn để xem hoá đơn và thu tiền tại bàn.</div>
                ) : (() => {
                  const os = byT(selT.id);
                  const agg = new Map<string, { name: string; qty: number; price: number; st: string }>();
                  for (const o of os) if (!isFee(o)) for (const i of o.items) {
                    const k = `${i.name}|${i.price}|${o.status}`;
                    agg.set(k, { name: i.name, price: i.price, st: o.status, qty: (agg.get(k)?.qty ?? 0) + i.qty });
                  }
                  const fees = os.filter(isFee);
                  const total = sumT(selT.id);
                  const payReq = d.reqs.find((r) => r.tableId === selT.id && r.kind === "pay");
                  const claim = payReq?.claim ?? null;
                  const confirmPay = async (method: string) => {
                    // Gửi kèm các lần gọi đang thấy: bàn vừa gọi thêm thì server từ chối, nạp lại để xem tổng mới.
                    if (await call("pay", { tableId: selT.id, method, orderIds: os.map((o) => o.id) })) setSel(null);
                    else void call("load");
                  };
                  return (
                    <>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ fontSize: 20, fontWeight: 800 }}>Hoá đơn bàn {selT.name}</div>
                        {os.length > 0 && <span style={{ fontSize: 12, fontWeight: 700, color: MUTED }}>Ngồi từ {hm(Math.min(...os.map((o) => o.at)))}</span>}
                      </div>
                      {(() => { const g = os.find((o) => o.guest)?.guest; return g ? <div style={{ fontSize: 13, fontWeight: 700, color: MUTED }}>👤 {g.name} · {g.pax} khách{g.phone && <> · <a href={`tel:${g.phone}`} style={{ color: "inherit" }}>{g.phone}</a></>}</div> : null; })()}
                      {!os.length && <div style={{ fontSize: 14, color: MUTED }}>Bàn đang trống, chưa có món.</div>}
                      {[...agg.values()].map((r, n) => (
                        <div key={n} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 14, padding: "4px 0", borderBottom: "1px dashed oklch(0.92 0.01 160)" }}>
                          <span><b>{r.qty}×</b> {r.name} <span style={{ fontSize: 11, color: SS[r.st]?.[1] }}>· {SS[r.st]?.[0]}</span></span>
                          <b style={{ whiteSpace: "nowrap" }}>{money(r.qty * r.price)}</b>
                        </div>
                      ))}
                      {fees.map((o) => (
                        <div key={o.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, fontSize: 14, padding: "4px 0", borderBottom: "1px dashed oklch(0.92 0.01 160)" }}>
                          <span><span style={{ fontSize: 11, fontWeight: 800, padding: "2px 7px", borderRadius: 999, background: "oklch(0.95 0.04 75)", color: "oklch(0.48 0.12 55)" }}>Phụ thu</span> {o.items[0]?.name}</span>
                          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <b style={{ whiteSpace: "nowrap" }}>{money(o.total)}</b>
                            <span onClick={() => !busy && window.confirm(`Bỏ phụ thu "${o.items[0]?.name}"?`) && call("feeRemove", { id: o.id })} title="Bỏ phụ thu" style={{ cursor: "pointer", fontSize: 13, fontWeight: 800, color: RED }}>×</span>
                          </span>
                        </div>
                      ))}
                      {os.some((o) => !isFee(o)) && <FeeForm busy={busy} onAdd={(reason, amount) => call("feeAdd", { tableId: selT.id, reason, amount })} />}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", paddingTop: 6 }}>
                        <span style={{ fontWeight: 800 }}>Tổng</span>
                        <span style={{ fontSize: 24, fontWeight: 800, color: "oklch(0.58 0.17 45)" }}>{money(total)}</span>
                      </div>
                      {/* Khách báo đã chuyển khoản: xem bill rồi xác thực (thu tiền, đóng bàn) hoặc báo chưa nhận được. */}
                      {claim && payReq && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 12, borderRadius: 14, background: "oklch(0.96 0.04 155)", border: "1.5px solid oklch(0.78 0.09 155)" }}>
                          <b style={{ fontSize: 14, color: "oklch(0.32 0.09 155)" }}>Khách báo đã chuyển khoản {money(claim.amount)} · {hm(claim.at)}</b>
                          {claim.amount !== total && <div style={{ fontSize: 12, fontWeight: 800, color: "oklch(0.52 0.17 40)" }}>Lệch với hoá đơn hiện tại ({money(total)}) — hoá đơn đổi sau khi khách chuyển. Kiểm tra số tiền thực nhận.</div>}
                          {claim.proof ? (
                            <a href={claim.proof} target="_blank" rel="noreferrer" title="Mở ảnh bill cỡ lớn">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={claim.proof} alt="Ảnh bill chuyển khoản của khách" style={{ display: "block", width: "100%", maxHeight: 320, objectFit: "contain", borderRadius: 10, background: "white", border: "1px solid oklch(0.88 0.03 155)" }} />
                            </a>
                          ) : (
                            <div style={{ fontSize: 12, color: MUTED }}>Khách không kèm ảnh bill — kiểm tra biến động số dư tài khoản (nội dung “BAN {selT.name}”).</div>
                          )}
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                            <button type="button" disabled={busy} onClick={() => { const note = window.prompt("Báo khách lý do (khách sẽ thấy để kiểm tra):", "Quán chưa thấy tiền về tài khoản"); if (note !== null) void call("claimReject", { id: payReq.id, note }); }} style={{ cursor: "pointer", fontSize: 13, fontWeight: 800, padding: 11, borderRadius: 999, border: "1.5px solid oklch(0.85 0.08 28)", color: "oklch(0.5 0.18 28)", background: "white", fontFamily: "inherit" }}>Chưa nhận được tiền</button>
                            <button type="button" disabled={busy} onClick={() => window.confirm(`Đã nhận đủ ${money(total)} chuyển khoản của bàn ${selT.name}? Hoá đơn sẽ đóng, bàn trống lại.`) && void confirmPay("Chuyển khoản")} style={{ cursor: "pointer", fontSize: 13, fontWeight: 800, padding: 11, borderRadius: 999, background: "oklch(0.5 0.13 155)", color: "white", border: "none", fontFamily: "inherit" }}>Xác thực · hoàn thành</button>
                          </div>
                        </div>
                      )}
                      {os.length > 0 && (
                        <>
                          {os.some((o) => o.status !== "served") && <div style={{ fontSize: 12, fontWeight: 700, color: "oklch(0.48 0.14 55)" }}>Còn món chưa lên — thu tiền sẽ đóng luôn các lần gọi này.</div>}
                          <div style={{ display: "flex", gap: 4, padding: 3, borderRadius: 12, background: "oklch(0.95 0.006 160)" }}>
                            {["Tiền mặt", "Chuyển khoản"].map((n) => <div key={n} onClick={() => setPayMethod(n)} style={{ flex: 1, textAlign: "center", cursor: "pointer", fontSize: 13, fontWeight: 800, padding: 8, borderRadius: 9, background: payMethod === n ? G : "transparent", color: payMethod === n ? "white" : "oklch(0.35 0.02 160)" }}>{n}</div>)}
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 6 }}>
                            <button type="button" onClick={printBill} style={{ cursor: "pointer", fontSize: 13, fontWeight: 800, padding: "12px 14px", borderRadius: 999, border: "1.5px solid oklch(0.88 0.015 160)", background: "white", fontFamily: "inherit" }}>In hoá đơn</button>
                            <button type="button" disabled={busy} onClick={() => void confirmPay(payMethod)} style={{ cursor: "pointer", textAlign: "center", fontSize: 14, fontWeight: 800, padding: 12, borderRadius: 999, background: O, color: "white", border: "none", fontFamily: "inherit" }}>Đã thu · dọn bàn</button>
                          </div>
                        </>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          )}

          {/* ---------- THỰC ĐƠN ---------- */}
          {sub === "menu" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {/* Thêm món — nằm TRÊN CÙNG */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 12, borderRadius: 14, background: "oklch(0.975 0.008 155)", border: "1px solid oklch(0.92 0.02 155)" }}>
                <div style={{ fontSize: 14, fontWeight: 800 }}>+ Thêm món mới</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,150px),1fr))", gap: 6 }}>
                  <input value={nm.name} onChange={(e) => setNm({ ...nm, name: e.target.value })} placeholder="Tên món" style={inp} />
                  <input value={nm.group} list="dn-groups" onChange={(e) => setNm({ ...nm, group: e.target.value })} placeholder="Nhóm món" style={inp} />
                  <datalist id="dn-groups">{groups.map((g) => <option key={g} value={g} />)}</datalist>
                  <MoneyTextInput value={nm.price} onChange={(d) => setNm({ ...nm, price: d })} placeholder="Giá" style={inp} />
                </div>
                <textarea value={nm.desc} maxLength={DINE_DESC_MAX} rows={3} onChange={(e) => setNm({ ...nm, desc: e.target.value })} placeholder="Mô tả chi tiết món: nguyên liệu, khẩu phần (VD: nồi 3–4 người), độ cay, cách chế biến…" style={{ ...inp, resize: "vertical", lineHeight: 1.45 }} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12, color: MUTED }}>{nm.desc.length}/{DINE_DESC_MAX} ký tự · thêm xong bấm ô ảnh của món để tải ảnh</span>
                  <button type="button" disabled={busy} onClick={async () => (await call("menuAdd", nm)) && setNm({ ...nm, name: "", price: "", desc: "" })} style={{ cursor: "pointer", textAlign: "center", fontSize: 14, fontWeight: 800, padding: "10px 18px", borderRadius: 10, background: G, color: "white", border: "none", fontFamily: "inherit" }}>+ Thêm món</button>
                </div>
              </div>
              <div style={{ fontSize: 13, color: MUTED }}>Đổi giá, mô tả, bật hết món là điện thoại khách cập nhật ngay. Bấm ô ảnh để tải ảnh món; bấm <b>🌐 Dịch</b> để nhập tên món / mô tả tiếng Anh · Trung · Hàn cho khách nước ngoài.</div>
              {d.menu.map((m) => <MenuRow key={m.id} m={m} wide={inner >= 640} busy={busy} venueId={venueId} call={call} />)}
            </div>
          )}

          {/* ---------- THANH TOÁN (tài khoản chuyển khoản) ---------- */}
          {sub === "guests" && <GuestsPanel venueId={venueId} wide={inner >= 720} />}
          {sub === "pay" && <BankSetup key={d.venue.bankBin + "|" + d.venue.bankAcc} d={d} busy={busy} call={call} />}

          {/* ---------- BÀN & MÃ QR ---------- */}
          {sub === "qr" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <GateSetup d={d} busy={busy} call={call} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <div style={{ fontSize: 13, color: MUTED, maxWidth: 520 }}>In thẻ QR, dán lên từng bàn. Khách quét là vào đúng thực đơn của bàn đó, không cần tải app. Số chỗ, tầng của bàn sửa ở tab Thiết lập.</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <input value={ntZone} list="dn-zones" onChange={(e) => setNtZone(e.target.value)} placeholder={zones[0] ?? "Trong nhà"} style={{ ...inp, width: 150, fontSize: 13, fontWeight: 700, padding: "9px 12px", borderRadius: 999 }} />
                  <datalist id="dn-zones">{zones.map((z) => <option key={z} value={z} />)}</datalist>
                  <button type="button" disabled={busy} onClick={() => call("tableAdd", { zone: ntZone || zones[0] || "Trong nhà" })} style={{ cursor: "pointer", fontSize: 13, fontWeight: 800, padding: "9px 14px", borderRadius: 999, border: "1.5px solid oklch(0.85 0.04 158)", color: "oklch(0.35 0.08 158)", background: "white", fontFamily: "inherit" }}>+ Thêm bàn</button>
                  <button type="button" onClick={() => printCards(d.tables.map((t) => t.id))} style={{ cursor: "pointer", fontSize: 13, fontWeight: 800, padding: "9px 14px", borderRadius: 999, background: G, color: "white", border: "none", fontFamily: "inherit" }}>In tất cả {d.tables.length} thẻ</button>
                </div>
              </div>
              {rotated && d.tables.some((t) => t.id === rotated) && (() => {
                const rt = d.tables.find((t) => t.id === rotated)!;
                return (
                  <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "12px 14px", borderRadius: 16, border: `2px solid ${O}`, background: "oklch(0.97 0.04 75)" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {qrs[rt.url] ? <img src={qrs[rt.url]} alt={`QR mới bàn ${rt.name}`} width={84} height={84} style={{ display: "block", borderRadius: 8 }} /> : <div style={{ width: 84, height: 84 }} />}
                    <div style={{ flex: 1, minWidth: 180 }}>
                      <div style={{ fontSize: 15, fontWeight: 800 }}>Đã đổi mã QR bàn {rt.name}</div>
                      <div style={{ fontSize: 13, color: MUTED }}>Thẻ cũ đã hết dùng. In thẻ mới rồi thay lên bàn ngay để khách gọi món được.</div>
                    </div>
                    <button type="button" disabled={!qrs[rt.url]} onClick={() => printCards([rt.id])} style={{ cursor: "pointer", fontSize: 13, fontWeight: 800, padding: "9px 14px", borderRadius: 999, background: O, color: "white", border: "none", fontFamily: "inherit" }}>In thẻ mới</button>
                    <button type="button" onClick={() => setRotated(null)} style={{ cursor: "pointer", fontSize: 13, fontWeight: 800, padding: "9px 12px", borderRadius: 999, background: "white", border: "1.5px solid oklch(0.88 0.015 160)", fontFamily: "inherit" }}>Xong</button>
                  </div>
                );
              })()}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(min(100%,190px),1fr))", gap: 12 }}>
                {d.tables.map((t) => (
                  <div key={t.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "16px 14px 12px", borderRadius: 20, background: G, color: "white", textAlign: "center", boxShadow: rotated === t.id ? `0 0 0 3px ${O}` : "none" }}>
                    {rotated === t.id && <div style={{ fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 999, background: O }}>MÃ MỚI · in lại thẻ này</div>}
                    <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".12em", opacity: 0.8 }}>{d.venue.name.toUpperCase()}</div>
                    <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1 }}>Bàn {t.name}</div>
                    <div style={{ padding: 8, borderRadius: 12, background: "white" }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {qrs[t.url] ? <img src={qrs[t.url]} alt={`QR bàn ${t.name}`} width={112} height={112} style={{ display: "block" }} /> : <div style={{ width: 112, height: 112 }} />}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 800 }}>Quét để gọi món</div>
                    <div style={{ fontSize: 10, opacity: 0.75, fontFamily: "ui-monospace,monospace", wordBreak: "break-all" }}>{shortUrl(t.url)}</div>
                    <div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap", justifyContent: "center" }}>
                      <a href={t.url} target="_blank" rel="noreferrer" style={{ fontSize: 11, fontWeight: 800, padding: "6px 10px", borderRadius: 999, background: "oklch(1 0 0 / .16)", color: "white" }}>Thử quét</a>
                      <span onClick={() => printCards([t.id])} style={{ cursor: "pointer", fontSize: 11, fontWeight: 800, padding: "6px 10px", borderRadius: 999, background: rotated === t.id ? O : "oklch(1 0 0 / .16)" }}>{rotated === t.id ? "In thẻ mới" : "In thẻ"}</span>
                      <span onClick={() => rotateQr(t.id, t.name)} style={{ cursor: "pointer", fontSize: 11, fontWeight: 800, padding: "6px 10px", borderRadius: 999, background: "oklch(1 0 0 / .1)" }}>Đổi mã QR</span>
                      <span onClick={() => !busy && window.confirm(`Xoá bàn ${t.name}? Thẻ QR đã in của bàn này sẽ hết dùng được.`) && call("tableDelete", { id: t.id })} style={{ cursor: "pointer", fontSize: 11, fontWeight: 800, padding: "6px 10px", borderRadius: 999, background: "oklch(1 0 0 / .1)", color: "oklch(0.9 0.05 28)" }}>Xoá</span>
                    </div>
                  </div>
                ))}
              </div>
              {!d.tables.length && <Empty>Chưa có bàn nào. Gõ tên khu (VD: Trong nhà, Ban công) rồi bấm <b>+ Thêm bàn</b>.</Empty>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Một dòng thực đơn: ảnh (nhiều ảnh, ảnh đầu là bìa), tên + mô tả, giá, Bán chạy, Còn món / Hết món. Sửa xong rời ô là lưu. */
function MenuRow({ m, wide, busy, venueId, call }: { m: DineMenuVM; wide: boolean; busy: boolean; venueId: string; call: (op: string, payload?: Record<string, unknown>) => Promise<boolean> }) {
  const [price, setPrice] = useState(String(m.price));
  const [desc, setDesc] = useState(m.desc);
  const [up, setUp] = useState(false);
  /** Đang mở ô nhập bản dịch en / zh / ko của món. */
  const [trOpen, setTrOpen] = useState(false);
  /** Tải một hay nhiều ảnh rồi nối vào cuối danh sách ảnh của món. */
  async function upload(files: FileList | null) {
    const room = DINE_MAX_IMAGES - m.images.length;
    const list = [...(files ?? [])].slice(0, Math.max(0, room));
    if (!list.length) return void (files?.length && showToast(`Mỗi món tối đa ${DINE_MAX_IMAGES} ảnh.`, "error"));
    setUp(true);
    try {
      const urls: string[] = [];
      for (const file of list) {
        const fd = new FormData();
        fd.set("venueId", venueId);
        fd.set("file", file);
        const r = await fetch("/api/admin/ticket/upload", { method: "POST", body: fd });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) showToast(j.error ?? "Không tải được ảnh.", "error");
        else urls.push(j.url);
      }
      if (urls.length) await call("menuPatch", { id: m.id, images: [...m.images, ...urls] });
    } finally {
      setUp(false);
    }
  }
  const setImages = (images: string[]) => !busy && call("menuPatch", { id: m.id, images });
  const chip = (on: boolean, color: string, fg: string): React.CSSProperties => ({ cursor: "pointer", fontSize: 11, fontWeight: 800, padding: "7px 9px", borderRadius: 999, background: on ? color : "oklch(0.95 0.006 160)", color: on ? fg : "oklch(0.4 0.02 160)", whiteSpace: "nowrap", border: "none", fontFamily: "inherit" });
  return (
    <div style={{ display: "grid", gridTemplateColumns: wide ? "52px minmax(0,1fr) 110px auto" : "52px minmax(0,1fr) 90px", gap: 10, alignItems: "center", padding: "8px 10px", borderRadius: 14, border: "1px solid oklch(0.92 0.01 160)", opacity: m.avail ? 1 : 0.6 }}>
      <label title="Bấm để tải ảnh món" style={{ cursor: "pointer", position: "relative", width: 52, height: 52, borderRadius: 10, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: MUTED, background: "repeating-linear-gradient(-45deg, oklch(0.95 0.02 160) 0 8px, oklch(0.975 0.01 160) 8px 16px)" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {m.images[0] ? <img src={m.images[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : up ? "…" : "+ ảnh"}
        {m.images.length > 1 && <span style={{ position: "absolute", right: 2, bottom: 2, fontSize: 9, fontWeight: 800, padding: "1px 5px", borderRadius: 999, background: "oklch(0.2 0.02 160 / .75)", color: "white" }}>{m.images.length}</span>}
        <input type="file" accept="image/*" multiple hidden disabled={up} onChange={(e) => { void upload(e.target.files); e.target.value = ""; }} />
      </label>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 800 }}>{m.name}</div>
        <div style={{ fontSize: 12, color: MUTED }}>{m.group || "Chưa có nhóm"} · đã bán {m.sold} (30 ngày)</div>
        <textarea value={desc} maxLength={DINE_DESC_MAX} rows={desc.length > 70 ? 3 : 2} onChange={(e) => setDesc(e.target.value)} onBlur={() => desc !== m.desc && call("menuPatch", { id: m.id, desc })} placeholder="Mô tả chi tiết món (nguyên liệu, khẩu phần, độ cay…)" style={{ width: "100%", fontSize: 12, lineHeight: 1.4, padding: "4px 6px", marginTop: 3, borderRadius: 7, border: "1px solid oklch(0.92 0.01 160)", fontFamily: "inherit", color: "oklch(0.35 0.02 160)", resize: "vertical" }} />
      </div>
      <MoneyTextInput value={String(price ?? "")} placeholder="0" onChange={setPrice} onBlur={() => Number(price) !== m.price && call("menuPatch", { id: m.id, price })} style={{ ...inp, fontWeight: 800, textAlign: "right", padding: "8px 10px" }} />
      <div style={{ display: "flex", gap: 4, justifyContent: "flex-end", gridColumn: wide ? "auto" : "1 / -1", alignItems: "center" }}>
        <button type="button" onClick={() => setTrOpen(!trOpen)} title="Dịch tên món / mô tả sang English · 中文 · 한국어" style={chip(trOpen, G, "white")}>🌐 Dịch</button>
        <button type="button" disabled={busy} onClick={() => call("menuPatch", { id: m.id, hot: !m.hot })} style={chip(m.hot, O, "white")}>Bán chạy</button>
        <button type="button" disabled={busy} onClick={() => call("menuPatch", { id: m.id, avail: !m.avail })} style={chip(m.avail, "oklch(0.94 0.05 155)", "oklch(0.36 0.1 155)")}>{m.avail ? "Còn món" : "Hết món"}</button>
        <span onClick={() => !busy && window.confirm(`Xoá món "${m.name}" khỏi thực đơn?`) && call("menuDelete", { id: m.id })} style={{ cursor: "pointer", fontSize: 12, fontWeight: 800, color: RED, padding: "0 4px" }}>Xoá</span>
      </div>
      {m.images.length > 0 && (
        <div style={{ gridColumn: "1 / -1", display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          {m.images.map((u, i) => (
            <div key={u} style={{ position: "relative", width: 64, height: 48, borderRadius: 8, overflow: "hidden", border: i === 0 ? `2px solid ${G}` : "1px solid oklch(0.9 0.01 160)" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u} alt="" title={i === 0 ? "Ảnh bìa" : "Bấm để đặt làm ảnh bìa"} onClick={() => i > 0 && setImages([u, ...m.images.filter((x) => x !== u)])} style={{ width: "100%", height: "100%", objectFit: "cover", cursor: i ? "pointer" : "default" }} />
              <button type="button" aria-label="Bỏ ảnh này" onClick={() => setImages(m.images.filter((x) => x !== u))} style={{ position: "absolute", top: 1, right: 1, width: 18, height: 18, borderRadius: "50%", border: "none", background: "oklch(0.2 0.02 160 / .75)", color: "white", fontSize: 11, fontWeight: 800, lineHeight: 1, cursor: "pointer", padding: 0 }}>×</button>
              {i === 0 && <span style={{ position: "absolute", left: 0, right: 0, bottom: 0, fontSize: 9, fontWeight: 800, textAlign: "center", background: "oklch(0.29 0.055 160 / .85)", color: "white" }}>Bìa</span>}
            </div>
          ))}
          {m.images.length < DINE_MAX_IMAGES && (
            <label style={{ cursor: "pointer", fontSize: 12, fontWeight: 800, padding: "7px 10px", borderRadius: 999, border: "1.5px dashed oklch(0.8 0.03 158)", color: "oklch(0.38 0.08 158)", whiteSpace: "nowrap" }}>
              {up ? "Đang tải…" : "+ Thêm ảnh"}
              <input type="file" accept="image/*" multiple hidden disabled={up} onChange={(e) => { void upload(e.target.files); e.target.value = ""; }} />
            </label>
          )}
          <span style={{ fontSize: 11, color: MUTED }}>{m.images.length}/{DINE_MAX_IMAGES} ảnh · bấm ảnh để đặt làm bìa</span>
        </div>
      )}
      {trOpen && <MenuTrPanel m={m} venueId={venueId} onClose={() => setTrOpen(false)} />}
    </div>
  );
}

/** Thêm PHỤ THU vào hoá đơn bàn: lý do (chọn nhanh / tự gõ) + số tiền. */
function FeeForm({ busy, onAdd }: { busy: boolean; onAdd: (reason: string, amount: number) => Promise<boolean> }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [amount, setAmount] = useState("");
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} style={{ cursor: "pointer", alignSelf: "flex-start", fontSize: 12, fontWeight: 800, padding: "6px 12px", borderRadius: 999, border: "1.5px dashed oklch(0.8 0.06 70)", color: "oklch(0.48 0.12 55)", background: "white", fontFamily: "inherit" }}>+ Thêm phụ thu</button>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: 10, borderRadius: 12, background: "oklch(0.975 0.02 75)" }}>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {DINE_FEE_PRESETS.map((p) => (
          <span key={p} onClick={() => setReason(p)} style={{ cursor: "pointer", fontSize: 11, fontWeight: 800, padding: "4px 9px", borderRadius: 999, background: reason === p ? O : "white", color: reason === p ? "white" : "oklch(0.42 0.04 60)", border: "1px solid oklch(0.88 0.04 70)" }}>{p}</span>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 110px", gap: 6 }}>
        <input value={reason} maxLength={60} onChange={(e) => setReason(e.target.value)} placeholder="Lý do phụ thu" style={{ ...inp, padding: 8, fontSize: 13 }} />
        <MoneyTextInput value={amount} onChange={setAmount} placeholder="Số tiền" style={{ ...inp, padding: 8, fontSize: 13, textAlign: "right", fontWeight: 800 }} />
      </div>
      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
        <button type="button" onClick={() => setOpen(false)} style={{ cursor: "pointer", fontSize: 12, fontWeight: 800, padding: "7px 12px", borderRadius: 999, border: "1px solid oklch(0.88 0.015 160)", background: "white", fontFamily: "inherit" }}>Đóng</button>
        <button type="button" disabled={busy} onClick={async () => { if (await onAdd(reason, Number(amount))) { setReason(""); setAmount(""); setOpen(false); } }} style={{ cursor: "pointer", fontSize: 12, fontWeight: 800, padding: "7px 14px", borderRadius: 999, background: G, color: "white", border: "none", fontFamily: "inherit" }}>Cộng vào hoá đơn</button>
      </div>
    </div>
  );
}

/**
 * Cấu hình CHUYỂN KHOẢN của quán: ngân hàng (mã BIN chuẩn VietQR), số tài khoản, chủ tài khoản. Khách chọn "Chuyển khoản QR"
 * sẽ thấy mã VietQR đã kèm đúng số tiền hoá đơn (quét là ra số tiền), nội dung "BAN <tên bàn>". Có mã xem trước để thử quét.
 */
function BankSetup({ d, busy, call }: { d: DineData; busy: boolean; call: (op: string, payload?: Record<string, unknown>) => Promise<boolean> }) {
  const [bin, setBin] = useState(d.venue.bankBin || BANKS[0][0]);
  const [acc, setAcc] = useState(d.venue.bankAcc);
  const [holder, setHolder] = useState(d.venue.bankHolder);
  const [preview, setPreview] = useState("");
  const on = !!(d.venue.bankBin && d.venue.bankAcc);
  const sampleText = acc.trim().length >= 4 ? vietQrPayload({ bin, account: acc.trim(), amount: 100000, memo: "BAN THU" }) : "";
  useEffect(() => {
    let off = false;
    if (sampleText) QRCode.toDataURL(sampleText, { margin: 1, width: 200 }).then((u) => !off && setPreview(u), () => {});
    return () => {
      off = true;
    };
  }, [sampleText]);
  const lab: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontWeight: 700, color: MUTED };
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,300px),1fr))", gap: 16, alignItems: "start" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <b style={{ fontSize: 16 }}>Nhận chuyển khoản qua mã VietQR</b>
          <span style={{ fontSize: 11, fontWeight: 800, padding: "3px 9px", borderRadius: 999, background: on ? "oklch(0.94 0.05 155)" : "oklch(0.95 0.006 160)", color: on ? "oklch(0.36 0.1 155)" : MUTED }}>{on ? `Đang bật · ${bankName(d.venue.bankBin)}` : "Chưa bật"}</span>
        </div>
        <div style={{ fontSize: 13, color: MUTED, lineHeight: 1.55 }}>
          Khách bấm “Yêu cầu thanh toán → Chuyển khoản QR” sẽ thấy mã QR đã điền sẵn <b>đúng số tiền hoá đơn</b> (kể cả phụ thu) và nội dung “BAN &lt;tên bàn&gt;”. Chuyển xong khách gửi ảnh bill, quán xem rồi bấm <b>Xác thực</b>.
        </div>
        <label style={lab}>Ngân hàng
          <select value={bin} onChange={(e) => setBin(e.target.value)} style={inp}>
            {BANKS.map(([b, name]) => <option key={b} value={b}>{name}</option>)}
          </select>
        </label>
        <label style={lab}>Số tài khoản
          <input value={acc} inputMode="numeric" maxLength={19} onChange={(e) => setAcc(e.target.value.replace(/[^0-9A-Za-z]/g, ""))} placeholder="VD: 0123456789" style={{ ...inp, fontFamily: "ui-monospace,monospace", fontWeight: 800 }} />
        </label>
        <label style={lab}>Tên chủ tài khoản (không dấu, như trên app ngân hàng)
          <input value={holder} maxLength={50} onChange={(e) => setHolder(e.target.value.toUpperCase())} placeholder="NGUYEN VAN A" style={inp} />
        </label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" disabled={busy} onClick={() => void call("bank", { bin, acc, holder })} style={{ cursor: "pointer", fontSize: 14, fontWeight: 800, padding: "11px 18px", borderRadius: 999, background: G, color: "white", border: "none", fontFamily: "inherit" }}>Lưu tài khoản</button>
          {on && (
            <button type="button" disabled={busy} onClick={() => { if (window.confirm("Tắt nhận chuyển khoản? Khách sẽ chỉ còn trả tiền mặt.")) void call("bank", { bin, acc: "", holder: "" }); }} style={{ cursor: "pointer", fontSize: 13, fontWeight: 800, padding: "11px 16px", borderRadius: 999, border: "1.5px solid oklch(0.85 0.08 28)", color: "oklch(0.5 0.18 28)", background: "white", fontFamily: "inherit" }}>Tắt chuyển khoản</button>
          )}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: 16, borderRadius: 18, background: "oklch(0.975 0.006 160)" }}>
        <b style={{ fontSize: 14 }}>Mã xem trước (100.000đ)</b>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {sampleText && preview ? <img src={preview} alt="Mã VietQR xem trước" width={180} height={180} style={{ borderRadius: 10, background: "white" }} /> : <div style={{ width: 180, height: 180, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", fontSize: 12, color: MUTED, borderRadius: 10, border: "1.5px dashed oklch(0.86 0.02 160)" }}>Nhập số tài khoản để xem mã</div>}
        <div style={{ fontSize: 12, color: MUTED, textAlign: "center", lineHeight: 1.5 }}>Quét thử bằng app ngân hàng: phải ra đúng tên chủ tài khoản và số tiền 100.000đ. Không cần chuyển thật.</div>
      </div>
    </div>
  );
}
