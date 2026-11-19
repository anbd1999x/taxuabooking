"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { DINE_CATS, DINE_LATE_MIN, DINE_MAX_IMAGES, ago, hm, money, orderQty, tableState, type DineData, type DineMenuVM, type DineOrderVM, type DineStatus, type TableState } from "@/lib/dine-core";
import { showToast } from "@/components/admin/Toast";
import { Empty, G, Head, MUTED, O, RED, VenuePick, h, printHtml, short, useWidth, type Ctx } from "./ui";

type Sub = "live" | "tables" | "menu" | "qr";
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
  const [nm, setNm] = useState({ name: "", group: DINE_CATS[0], price: "" });
  const [ntZone, setNtZone] = useState("");
  /** Bàn vừa "Đổi mã QR" — làm nổi thẻ mới để in lại. */
  const [rotated, setRotated] = useState<string | null>(null);

  const take = useCallback((data: DineData) => {
    const ids = [...data.orders.filter((o) => o.status === "new").map((o) => o.id), ...data.reqs.map((r) => r.id)];
    const seen = SEEN.get(data.venue.id);
    if (seen) {
      const freshO = data.orders.filter((o) => o.status === "new" && !seen.has(o.id)).pop();
      const freshR = data.reqs.filter((r) => !seen.has(r.id)).pop();
      if (freshO) setNotice({ id: freshO.id, title: `Bàn ${freshO.table} vừa gọi ${orderQty(freshO)} món`, sub: freshO.items.map((i) => `${i.qty}× ${i.name}`).join(", ") });
      else if (freshR) setNotice({ id: freshR.id, title: freshR.kind === "pay" ? `Bàn ${freshR.table} muốn thanh toán` : `Bàn ${freshR.table} gọi nhân viên`, sub: freshR.kind === "pay" ? freshR.method : "Khách bấm nút trên điện thoại" });
      if (freshO || freshR) beep();
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
    const body = Object.values(rows).map((r) => `<tr><td>${h(r.name)}</td><td style="text-align:right">${r.qty}</td><td style="text-align:right">${money(r.price)}</td><td style="text-align:right">${money(r.price * r.qty)}</td></tr>`).join("");
    if (!printHtml(`Hoá đơn bàn ${selT.name}`, `<h1>${h(d!.venue.name)}</h1><p>Hoá đơn bàn ${h(selT.name)} · ${new Date().toLocaleString("vi-VN")}</p><table><tr><th>Món</th><th>SL</th><th>Đơn giá</th><th>Thành tiền</th></tr>${body}<tr><th colspan="3" style="text-align:right">Tổng</th><th style="text-align:right">${money(sumT(selT.id))}</th></tr></table>`))
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
  const subTabs: [Sub, string, number][] = [["live", "Order trực tiếp", count("new") + d.reqs.length], ["tables", "Sơ đồ bàn & thu tiền", 0], ["menu", "Thực đơn", 0], ["qr", "Bàn & mã QR", 0]];

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
          <div style={{ display: "flex", gap: 4, padding: 3, borderRadius: 12, background: "oklch(0.95 0.006 160)", overflowX: "auto", maxWidth: "100%" }}>
            {subTabs.map(([k, name, badge]) => (
              <div key={k} onClick={() => setSub(k)} style={{ cursor: "pointer", flex: "none", display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 800, padding: "8px 12px", borderRadius: 9, whiteSpace: "nowrap", background: sub === k ? "white" : "transparent", color: sub === k ? G : "oklch(0.42 0.02 160)", boxShadow: sub === k ? "0 1px 4px oklch(0.2 0.03 160 / .15)" : "none" }}>
                {name}
                {badge > 0 && <span style={{ fontSize: 11, fontWeight: 800, padding: "1px 7px", borderRadius: 999, background: O, color: "white" }}>{badge}</span>}
              </div>
            ))}
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
                    return (
                      <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 14, background: pay ? "oklch(0.96 0.04 250)" : "oklch(0.97 0.04 75)", border: `1.5px solid ${pay ? "oklch(0.8 0.08 250)" : "oklch(0.85 0.08 70)"}`, animation: "dnUp .3s ease both" }}>
                        <span style={{ flex: "none", minWidth: 44, textAlign: "center", padding: "6px 4px", borderRadius: 10, background: "white", fontSize: 14, fontWeight: 800 }}>{r.table}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 800 }}>{pay ? `Yêu cầu thanh toán · ${r.method}` : "Gọi nhân viên"}</div>
                          <div style={{ fontSize: 12, color: "oklch(0.45 0.02 160)" }}>{ago(now, r.at)} trước{r.tableId ? ` · tạm tính ${money(sumT(r.tableId))}` : ""}</div>
                        </div>
                        <button type="button" disabled={busy} onClick={() => { if (pay && r.tableId) { setSub("tables"); setSel(r.tableId); setPayMethod(r.method || "Tiền mặt"); } else void call("reqDone", { id: r.id }); if (notice?.id === r.id) setNotice(null); }} style={{ cursor: "pointer", fontSize: 12, fontWeight: 800, padding: "8px 12px", borderRadius: 999, background: G, color: "white", whiteSpace: "nowrap", border: "none", fontFamily: "inherit" }}>{pay ? "Mở hoá đơn" : "Đã tới bàn"}</button>
                      </div>
                    );
                  })}
                </div>
              )}
              <div style={{ display: "grid", gridTemplateColumns: inner >= 800 ? "repeat(3,minmax(0,1fr))" : "1fr", gap: 10, alignItems: "start" }}>
                {COL.map(([k, name, c, bg]) => {
                  const all = d.orders.filter((o) => o.status === k);
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
                        return (
                          <div key={t.id} onClick={() => setSel(t.id)} style={{ cursor: "pointer", display: "flex", flexDirection: "column", gap: 3, padding: 10, borderRadius: 14, border: `2px solid ${S[2]}`, background: S[1], color: S[3], boxShadow: sel === t.id ? `0 0 0 3px ${O}` : "none", animation: k === "pay" ? "dnFlash 1.4s ease infinite" : "none" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><span style={{ fontSize: 17, fontWeight: 800 }}>{t.name}</span><span style={{ fontSize: 11, fontWeight: 700, opacity: 0.8 }}>{t.cap} chỗ</span></div>
                            <span style={{ fontSize: 11, fontWeight: 800 }}>{S[0]}</span>
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
                  for (const o of os) for (const i of o.items) {
                    const k = `${i.name}|${i.price}|${o.status}`;
                    agg.set(k, { name: i.name, price: i.price, st: o.status, qty: (agg.get(k)?.qty ?? 0) + i.qty });
                  }
                  return (
                    <>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ fontSize: 20, fontWeight: 800 }}>Hoá đơn bàn {selT.name}</div>
                        {os.length > 0 && <span style={{ fontSize: 12, fontWeight: 700, color: MUTED }}>Ngồi từ {hm(Math.min(...os.map((o) => o.at)))}</span>}
                      </div>
                      {!os.length && <div style={{ fontSize: 14, color: MUTED }}>Bàn đang trống, chưa có món.</div>}
                      {[...agg.values()].map((r, n) => (
                        <div key={n} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 14, padding: "4px 0", borderBottom: "1px dashed oklch(0.92 0.01 160)" }}>
                          <span><b>{r.qty}×</b> {r.name} <span style={{ fontSize: 11, color: SS[r.st]?.[1] }}>· {SS[r.st]?.[0]}</span></span>
                          <b style={{ whiteSpace: "nowrap" }}>{money(r.qty * r.price)}</b>
                        </div>
                      ))}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", paddingTop: 6 }}>
                        <span style={{ fontWeight: 800 }}>Tổng</span>
                        <span style={{ fontSize: 24, fontWeight: 800, color: "oklch(0.58 0.17 45)" }}>{money(sumT(selT.id))}</span>
                      </div>
                      {os.length > 0 && (
                        <>
                          {os.some((o) => o.status !== "served") && <div style={{ fontSize: 12, fontWeight: 700, color: "oklch(0.48 0.14 55)" }}>Còn món chưa lên — thu tiền sẽ đóng luôn các lần gọi này.</div>}
                          <div style={{ display: "flex", gap: 4, padding: 3, borderRadius: 12, background: "oklch(0.95 0.006 160)" }}>
                            {["Tiền mặt", "Chuyển khoản"].map((n) => <div key={n} onClick={() => setPayMethod(n)} style={{ flex: 1, textAlign: "center", cursor: "pointer", fontSize: 13, fontWeight: 800, padding: 8, borderRadius: 9, background: payMethod === n ? G : "transparent", color: payMethod === n ? "white" : "oklch(0.35 0.02 160)" }}>{n}</div>)}
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 6 }}>
                            <button type="button" onClick={printBill} style={{ cursor: "pointer", fontSize: 13, fontWeight: 800, padding: "12px 14px", borderRadius: 999, border: "1.5px solid oklch(0.88 0.015 160)", background: "white", fontFamily: "inherit" }}>In hoá đơn</button>
                            <button type="button" disabled={busy} onClick={async () => {
                              // Gửi kèm các lần gọi đang thấy: bàn vừa gọi thêm thì server từ chối, nạp lại để xem tổng mới.
                              if (await call("pay", { tableId: selT.id, method: payMethod, orderIds: os.map((o) => o.id) })) setSel(null);
                              else void call("load");
                            }} style={{ cursor: "pointer", textAlign: "center", fontSize: 14, fontWeight: 800, padding: 12, borderRadius: 999, background: O, color: "white", border: "none", fontFamily: "inherit" }}>Đã thu · dọn bàn</button>
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
              <div style={{ fontSize: 13, color: MUTED }}>Đổi giá, bật hết món là điện thoại khách cập nhật ngay. Bấm ô ảnh để tải ảnh món.</div>
              {d.menu.map((m) => <MenuRow key={m.id} m={m} wide={inner >= 640} busy={busy} venueId={venueId} call={call} />)}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,150px),1fr))", gap: 6, padding: 12, borderRadius: 14, background: "oklch(0.975 0.008 155)" }}>
                <input value={nm.name} onChange={(e) => setNm({ ...nm, name: e.target.value })} placeholder="Tên món mới" style={inp} />
                <input value={nm.group} list="dn-groups" onChange={(e) => setNm({ ...nm, group: e.target.value })} placeholder="Nhóm món" style={inp} />
                <datalist id="dn-groups">{groups.map((g) => <option key={g} value={g} />)}</datalist>
                <input value={nm.price ? Number(nm.price).toLocaleString("vi-VN") : ""} onChange={(e) => setNm({ ...nm, price: e.target.value.replace(/\D/g, "") })} inputMode="numeric" placeholder="Giá" style={inp} />
                <button type="button" disabled={busy} onClick={async () => (await call("menuAdd", nm)) && setNm({ ...nm, name: "", price: "" })} style={{ cursor: "pointer", textAlign: "center", fontSize: 14, fontWeight: 800, padding: 10, borderRadius: 10, background: G, color: "white", border: "none", fontFamily: "inherit" }}>+ Thêm món</button>
              </div>
            </div>
          )}

          {/* ---------- BÀN & MÃ QR ---------- */}
          {sub === "qr" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
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
        <div style={{ fontSize: 12, color: MUTED }}>{m.group || "Chưa có nhóm"} · đã bán {m.sold}</div>
        <input value={desc} maxLength={160} onChange={(e) => setDesc(e.target.value)} onBlur={() => desc !== m.desc && call("menuPatch", { id: m.id, desc })} placeholder="Mô tả ngắn (VD: nồi 3–4 người)" style={{ width: "100%", fontSize: 12, padding: "4px 6px", marginTop: 3, borderRadius: 7, border: "1px solid oklch(0.92 0.01 160)", fontFamily: "inherit", color: "oklch(0.35 0.02 160)" }} />
      </div>
      <input value={Number(price || 0).toLocaleString("vi-VN")} inputMode="numeric" onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))} onBlur={() => Number(price) !== m.price && call("menuPatch", { id: m.id, price })} style={{ ...inp, fontWeight: 800, textAlign: "right", padding: "8px 10px" }} />
      <div style={{ display: "flex", gap: 4, justifyContent: "flex-end", gridColumn: wide ? "auto" : "1 / -1", alignItems: "center" }}>
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
    </div>
  );
}
