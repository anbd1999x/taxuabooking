"use client";

import { useState, type ReactNode } from "react";
import { FLEET_ACC, FLEET_KINDS, diffDays, feeSum, isVehicleFree, rentalStatus, type FleetConfig, type FleetRentalVM } from "@/lib/fleet-core";
import type { Ctx } from "./drawers";
import { BORDER, G, MUTED, O, ST, Empty, MiniStat, Thumb, btn, dm, ini, money, pill, short } from "./ui";

const box = { background: "white", border: `1px solid ${BORDER}`, borderRadius: 20, padding: 16 } as const;

// ======================= ĐƠN WEB =======================
export function WebTab({ ctx }: { ctx: Ctx }) {
  const { data, call, setDr } = ctx;
  const { today: T, now: NOW, vehicles: V, rentals: Bk, config: P } = data;
  const list = Bk.filter((b) => rentalStatus(b, T, NOW) === "web");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ fontSize: 14, lineHeight: 1.5, color: "oklch(0.45 0.02 160)", maxWidth: 760 }}>Khách đặt trên trang Thuê xe máy, hệ thống đã tự xếp xe trống phù hợp. Kiểm tra, đổi xe nếu cần, rồi xác nhận và nhắn Zalo cho khách cọc.</div>
      {!list.length && <Empty>Không có đơn web nào chờ duyệt.</Empty>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(min(100%,340px),1fr))", gap: 12 }}>
        {list.map((b) => {
          const v = V.find((x) => x.id === b.vid);
          if (!v) return null;
          const alts = V.filter((x) => x.kind === v.kind && (x.id === v.id || isVehicleFree(x, b.s, b.e, Bk, T, b.id, NOW)));
          const black = P.black[b.phone];
          return (
            <div key={b.id} style={{ ...box, display: "flex", flexDirection: "column", gap: 10, border: "1.5px solid oklch(0.88 0.06 300)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}><span style={{ fontFamily: "ui-monospace,monospace", fontSize: 13, fontWeight: 700, color: "oklch(0.45 0.02 160)" }}>{b.bookingCode ?? b.code}</span><span style={{ fontSize: 12, fontWeight: 800, padding: "4px 10px", borderRadius: 999, background: "oklch(0.95 0.04 300)", color: "oklch(0.42 0.13 300)" }}>Chờ duyệt</span></div>
              <div>
                <div style={{ fontSize: 17, fontWeight: 800 }}>{b.name} <a href={"tel:" + b.phone} style={{ fontSize: 14, fontWeight: 700 }}>{b.phone}</a></div>
                <div style={{ fontSize: 14, color: "oklch(0.42 0.02 160)", marginTop: 3 }}>{dm(b.s)} {b.st} → {dm(b.e)} {b.et} · {diffDays(b.s, b.e) + 1} ngày</div>
                <div style={{ fontSize: 13, color: MUTED }}>{FLEET_KINDS[v.kind]} · {b.place}</div>
              </div>
              {black && <div style={{ fontSize: 13, fontWeight: 700, padding: "8px 10px", borderRadius: 10, background: "oklch(0.95 0.04 28)", color: "oklch(0.45 0.16 28)" }}>Danh sách đen: {black}</div>}
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".06em", color: MUTED }}>XE ĐÃ XẾP · BẤM ĐỂ ĐỔI</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {alts.map((x) => (
                  <div key={x.id} onClick={() => x.id !== v.id && call({ op: "changeVehicle", id: b.id, vehicleId: x.id })} style={{ ...pill(x.id === v.id), padding: "7px 11px" }}>{x.name} · {x.plate}</div>
                ))}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, paddingTop: 10, borderTop: "1px solid oklch(0.94 0.008 160)", flexWrap: "wrap" }}>
                <b style={{ fontSize: 18, color: "oklch(0.55 0.16 45)" }}>{money(b.total)}</b>
                <div style={{ display: "flex", gap: 6 }}>
                  <button type="button" onClick={() => confirm("Từ chối đơn này?") && call({ op: "webReject", id: b.id })} style={btn("danger")}>Từ chối</button>
                  <button type="button" onClick={() => setDr({ kind: "book", id: b.id })} style={btn()}>Chi tiết</button>
                  <button type="button" onClick={() => call({ op: "webConfirm", id: b.id })} style={btn("pri")}>Xác nhận</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ======================= THU CHI =======================
export function LedgerTab({ ctx, mob }: { ctx: Ctx; mob: boolean }) {
  const { data, setDr } = ctx;
  const { today: T, now: NOW, rentals: Bk } = data;
  const [led, setLed] = useState<"today" | "month" | "all">("month");
  const inR = (at: string) => (led === "today" ? at.startsWith(T) : led === "month" ? at.slice(0, 7) === T.slice(0, 7) : true);
  const lp = Bk.flatMap((b) => b.pays.map((y) => ({ ...y, b }))).filter((y) => inR(y.at)).sort((a, c) => c.at.localeCompare(a.at));
  const sumW = (f: (y: (typeof lp)[number]) => boolean) => lp.filter(f).reduce((a, y) => a + y.amt, 0);
  const st = (b: FleetRentalVM) => rentalStatus(b, T, NOW);
  const holding = Bk.filter((b) => ["deposit", "due", "renting", "late", "hold"].includes(st(b))).reduce((a, b) => a + b.deposit, 0);
  const owe = Bk.filter((b) => ["renting", "late", "due"].includes(st(b))).reduce((a, b) => a + Math.max(0, b.total + feeSum(b) - b.deposit), 0);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {([["today", "Hôm nay"], ["month", "Tháng " + +T.slice(5, 7)], ["all", "Tất cả"]] as const).map(([k, n]) => <div key={k} onClick={() => setLed(k)} style={pill(led === k)}>{n}</div>)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,160px),1fr))", gap: 10 }}>
        <MiniStat k="Thu tiền mặt" v={short(sumW((y) => y.amt > 0 && y.method === "Tiền mặt"))} sub="Đối chiếu két cuối ngày" c="oklch(0.3 0.03 160)" />
        <MiniStat k="Thu chuyển khoản" v={short(sumW((y) => y.amt > 0 && y.method !== "Tiền mặt"))} sub="Đối chiếu sao kê" c="oklch(0.3 0.03 160)" />
        <MiniStat k="Đã hoàn cọc" v={short(-sumW((y) => y.amt < 0))} sub="Trả lại khách" c="oklch(0.52 0.16 28)" />
        <MiniStat k="Cọc đang giữ" v={short(holding)} sub="Của đơn chưa trả xe" c="oklch(0.5 0.13 60)" />
        <MiniStat k="Còn phải thu" v={short(owe)} sub="Khi giao hoặc nhận xe" c="oklch(0.55 0.16 45)" />
      </div>
      <div style={{ ...box, padding: "6px 16px" }}>
        {!lp.length && <div style={{ padding: "30px 0", textAlign: "center", color: MUTED }}>Chưa có khoản thu chi nào trong khoảng này.</div>}
        {lp.slice(0, 120).map((y) => (
          <div key={y.id} onClick={() => setDr({ kind: "book", id: y.b.id })} style={{ cursor: "pointer", display: "grid", gridTemplateColumns: mob ? "64px minmax(0,1fr) auto" : "110px minmax(0,1fr) auto", gap: 12, alignItems: "center", padding: "11px 0", borderBottom: "1px solid oklch(0.95 0.005 160)" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "oklch(0.45 0.02 160)" }}>{dm(y.at.slice(0, 10))} {y.at.slice(11)}</span>
            <span style={{ minWidth: 0 }}><span style={{ display: "block", fontSize: 14, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{y.b.name}</span><span style={{ display: "block", fontSize: 12, color: MUTED, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{y.b.code} · {y.kind} · {y.method}{y.by ? " · " + y.by : ""}</span></span>
            <b style={{ fontSize: 15, color: y.amt < 0 ? "oklch(0.5 0.16 28)" : "oklch(0.42 0.11 155)", whiteSpace: "nowrap", textAlign: "right" }}>{y.amt < 0 ? "−" : "+"}{money(Math.abs(y.amt))}</b>
          </div>
        ))}
      </div>
    </div>
  );
}

// ======================= BẢO DƯỠNG =======================
export function MaintTab({ ctx }: { ctx: Ctx }) {
  const { data, call, setDr } = ctx;
  const { today: T, vehicles: V } = data;
  const svcMonth = V.reduce((a, v) => a + v.svc.filter((x) => x.d.slice(0, 7) === T.slice(0, 7)).reduce((c, x) => c + x.cost, 0), 0);
  const yr = T.slice(0, 4);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,160px),1fr))", gap: 10 }}>
        <MiniStat k="Đến hạn thay nhớt" v={V.filter((v) => v.mode !== "off" && v.odo - v.lastOil >= v.oilEvery * 0.9).length} sub="Từ 90% chu kỳ" c={ST.deposit[3]} />
        <MiniStat k="Bảo hiểm ≤ 30 ngày" v={V.filter((v) => v.mode !== "off" && v.insExp && diffDays(T, v.insExp) <= 30).length} sub="Gồm cả xe đã hết hạn" c={ST.late[3]} />
        <MiniStat k="Đang bảo dưỡng" v={V.filter((v) => v.mode === "maint").length} sub="Tạm ngừng cho thuê" c={ST.maint[3]} />
        <MiniStat k={"Chi phí tháng " + +T.slice(5, 7)} v={short(svcMonth)} sub="Sửa chữa, phụ tùng" c="oklch(0.3 0.03 160)" />
      </div>
      {!V.length && <Empty>Chưa có xe nào.</Empty>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(min(100%,330px),1fr))", gap: 12 }}>
        {V.map((v) => {
          const since = Math.max(0, v.odo - v.lastOil), pc = Math.min(1, since / v.oilEvery);
          const dl = v.insExp ? diffDays(T, v.insExp) : null;
          const cost = v.svc.filter((x) => x.d.slice(0, 4) === yr).reduce((a, x) => a + x.cost, 0);
          const oilBg = pc >= 1 ? ST.late[3] : pc >= 0.9 ? ST.deposit[3] : "oklch(0.6 0.12 155)";
          const ins: [string, string, string] = dl == null ? ["Chưa nhập hạn bảo hiểm", "oklch(0.95 0.005 160)", MUTED]
            : dl < 0 ? [`Bảo hiểm đã hết hạn ${-dl} ngày`, ST.late[1], "white"]
            : [`Bảo hiểm còn ${dl} ngày · hạn ${dm(v.insExp!)}/${v.insExp!.slice(0, 4)}`, dl <= 30 ? ST.deposit[1] : ST.ready[1], dl <= 30 ? ST.deposit[2] : ST.ready[2]];
          return (
            <div key={v.id} style={{ ...box, display: "flex", flexDirection: "column", gap: 10 }}>
              <div onClick={() => setDr({ kind: "veh", id: v.id })} style={{ cursor: "pointer", display: "flex", gap: 12, alignItems: "center" }}>
                <div style={{ width: 56, height: 44, borderRadius: 10, overflow: "hidden", flex: "none" }}><Thumb url={v.imageUrl} label=" " /></div>
                <div style={{ minWidth: 0, flex: 1 }}><div style={{ fontSize: 15, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{v.name}</div><div style={{ fontSize: 12, color: MUTED }}><span style={{ fontFamily: "ui-monospace,monospace", fontWeight: 700 }}>{v.plate}</span> · ODO {v.odo.toLocaleString("vi-VN")} km · {v.mode === "ready" ? "Sẵn sàng" : ST[v.mode][0]}</div></div>
              </div>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700, marginBottom: 5 }}><span>Thay nhớt</span><span style={{ color: oilBg }}>{Math.round(pc * 100)}%</span></div>
                <div style={{ height: 8, borderRadius: 4, background: "oklch(0.94 0.005 160)", overflow: "hidden" }}><div style={{ width: Math.round(pc * 100) + "%", height: "100%", borderRadius: 4, background: oilBg }} /></div>
                <div style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>{since.toLocaleString("vi-VN")} / {v.oilEvery.toLocaleString("vi-VN")} km kể từ lần thay gần nhất</div>
              </div>
              <span style={{ alignSelf: "flex-start", fontSize: 12, fontWeight: 800, padding: "5px 10px", borderRadius: 999, background: ins[1], color: ins[2] }}>{ins[0]}</span>
              <div style={{ display: "flex", flexDirection: "column", gap: 2, padding: "8px 10px", borderRadius: 12, background: "oklch(0.975 0.004 160)" }}>
                {!v.svc.length && <div style={{ fontSize: 13, color: MUTED }}>Chưa có lịch sử bảo dưỡng.</div>}
                {v.svc.slice(0, 3).map((x) => <div key={x.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13 }}><span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}><b>{dm(x.d)}</b> · {x.what}</span><span style={{ fontWeight: 700, whiteSpace: "nowrap" }}>{short(x.cost)}</span></div>)}
                <div style={{ fontSize: 12, fontWeight: 700, color: MUTED, marginTop: 2 }}>Chi phí năm {yr}: {money(cost)}</div>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button type="button" onClick={() => call({ op: "oilDone", vehicleId: v.id })} style={btn("pri")}>Đã thay nhớt</button>
                <button type="button" onClick={() => setDr({ kind: "svc", id: v.id })} style={btn()}>Ghi sửa chữa</button>
                <button type="button" onClick={() => call({ op: "insRenew", vehicleId: v.id })} style={btn()}>Gia hạn BH</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ======================= KHÁCH HÀNG =======================
export function CustTab({ ctx }: { ctx: Ctx }) {
  const { data, call, setDr } = ctx;
  const { rentals: Bk, config: P } = data;
  const [cq, setCq] = useState("");
  const [cf, setCf] = useState<"all" | "vip" | "black">("all");
  type C = { name: string; phone: string; n: number; spend: number; last: string; src: string; lateN: number };
  const cmap: Record<string, C> = {};
  for (const b of Bk.filter((x) => !x.cancelled)) {
    const c = cmap[b.phone] ?? (cmap[b.phone] = { name: b.name, phone: b.phone, n: 0, spend: 0, last: "", src: b.src, lateN: 0 });
    c.n++;
    c.spend += b.total + feeSum(b);
    if (b.s > c.last) { c.last = b.s; c.name = b.name; }
    if (b.fees.some((f) => /muộn|trễ/i.test(f.k))) c.lateN++;
  }
  // Khách trong DS đen chưa từng thuê vẫn hiện.
  for (const [ph, why] of Object.entries(P.black)) if (!cmap[ph]) cmap[ph] = { name: why ? "Khách " + ph.slice(-4) : ph, phone: ph, n: 0, spend: 0, last: "", src: "—", lateN: 0 };
  const allC = Object.values(cmap);
  const q = cq.trim().toLowerCase();
  const list = allC.filter((c) => (!q || (c.name + " " + c.phone).toLowerCase().includes(q)) && (cf === "all" || (cf === "vip" && c.n >= 2) || (cf === "black" && P.black[c.phone]))).sort((a, c) => c.spend - a.spend);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input value={cq} onChange={(e) => setCq(e.target.value)} placeholder="Tìm tên hoặc số điện thoại…" style={{ width: "min(300px,100%)", fontSize: 15, padding: "11px 14px", borderRadius: 12, border: "1.5px solid oklch(0.9 0.01 160)", background: "white", fontFamily: "inherit" }} />
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {([["all", "Tất cả · " + allC.length], ["vip", "Khách quen · " + allC.filter((c) => c.n >= 2).length], ["black", "Danh sách đen · " + allC.filter((c) => P.black[c.phone]).length]] as const).map(([k, n]) => <div key={k} onClick={() => setCf(k)} style={pill(cf === k)}>{n}</div>)}
        </div>
      </div>
      {!list.length && <Empty>Không có khách phù hợp.</Empty>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(min(100%,360px),1fr))", gap: 10 }}>
        {list.slice(0, 80).map((c) => {
          const bl = P.black[c.phone];
          return (
            <div key={c.phone} style={{ ...box, padding: 14, display: "flex", flexDirection: "column", gap: 8, border: `1.5px solid ${bl ? "oklch(0.82 0.1 28)" : BORDER}` }}>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <span style={{ width: 42, height: 42, borderRadius: "50%", flex: "none", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, background: bl ? "oklch(0.95 0.04 28)" : "oklch(0.95 0.025 155)", color: bl ? "oklch(0.5 0.16 28)" : "oklch(0.35 0.08 158)" }}>{ini(c.name)}</span>
                <div style={{ minWidth: 0, flex: 1 }}><div style={{ fontSize: 15, fontWeight: 800 }}>{c.name}</div><a href={"tel:" + c.phone} style={{ fontSize: 13, fontWeight: 700 }}>{c.phone}</a></div>
              </div>
              <div style={{ fontSize: 13, color: "oklch(0.42 0.02 160)" }}>{c.n} lần thuê · {short(c.spend)}{c.last ? " · gần nhất " + dm(c.last) : ""}</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {[c.n >= 2 ? "Khách quen" : "", c.lateN ? "Từng trả muộn " + c.lateN + " lần" : "", c.src !== "—" ? "Nguồn " + c.src : ""].filter(Boolean).map((x) => <span key={x} style={{ fontSize: 12, fontWeight: 700, padding: "3px 9px", borderRadius: 999, background: "oklch(0.96 0.006 160)", color: "oklch(0.38 0.02 160)" }}>{x}</span>)}
              </div>
              {bl && <div style={{ fontSize: 13, fontWeight: 700, color: "oklch(0.48 0.17 28)" }}>Danh sách đen: {bl}</div>}
              <div style={{ display: "flex", gap: 6 }}>
                <button type="button" style={btn("danger")} onClick={() => {
                  if (bl) return call({ op: "blacklist", phone: c.phone, reason: null });
                  const r = prompt("Lý do đưa " + c.name + " vào danh sách đen?", "Trả xe trễ, không liên lạc được");
                  if (r !== null) call({ op: "blacklist", phone: c.phone, reason: r });
                }}>{bl ? "Gỡ khỏi DS đen" : "Đưa vào DS đen"}</button>
                <button type="button" style={btn("pri")} onClick={() => setDr({ kind: "order", pre: { name: c.name, phone: c.phone, src: "Khách quen" } })}>Tạo đơn</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ======================= BÁO CÁO =======================
export function ReportTab({ ctx, wide }: { ctx: Ctx; wide: boolean }) {
  const { data, call } = ctx;
  const { today: T, now: NOW, vehicles: V, rentals: Bk, config: P } = data;
  const [ry, setRy] = useState(Number(T.slice(0, 4)));
  const RY = String(ry);
  const yb = Bk.filter((b) => !b.cancelled && !b.web && b.s.slice(0, 4) === RY);
  const sumB = (l: FleetRentalVM[]) => l.reduce((a, b) => a + b.total + feeSum(b), 0);
  const mRevs = Array.from({ length: 12 }, (_, mi) => { const l = yb.filter((b) => b.s.slice(5, 7) === String(mi + 1).padStart(2, "0")); return { r: sumB(l), n: l.length }; });
  const mx = Math.max(1, ...mRevs.map((x) => x.r));
  const yRev = sumB(yb), yFees = yb.reduce((a, b) => a + feeSum(b), 0);
  const mCost = V.reduce((a, v) => a + v.svc.filter((x) => x.d.slice(0, 4) === RY).reduce((c, x) => c + x.cost, 0), 0);
  const ctvB = yb.filter((b) => b.ctv || b.src === "CTV");
  const ctvCost = Math.round((ctvB.reduce((a, b) => a + b.total, 0) * P.ctv) / 100);
  const firstDay = Bk.length ? Bk.reduce((m, b) => (b.s < m ? b.s : m), T) : T;
  const yStart = `${RY}-01-01` > firstDay ? `${RY}-01-01` : firstDay;
  const yEnd = RY === T.slice(0, 4) ? T : `${RY}-12-31`;
  const period = Math.max(1, diffDays(yStart, yEnd) + 1);
  const ctvMap: Record<string, { n: number; rev: number }> = {};
  for (const b of ctvB) { const k = b.ctv || "CTV"; const c = ctvMap[k] ?? (ctvMap[k] = { n: 0, rev: 0 }); c.n++; c.rev += b.total; }
  const st = (b: FleetRentalVM) => rentalStatus(b, T, NOW);
  const vehRows = V.map((v) => {
    const l = yb.filter((b) => b.vid === v.id), r = sumB(l), used = l.reduce((a, b) => a + diffDays(b.s, b.e) + 1, 0);
    const mc = v.svc.filter((x) => x.d.slice(0, 4) === RY).reduce((a, x) => a + x.cost, 0), u = Math.round((used / period) * 100);
    return { v, n: l.length, r, u, mc, idle: v.mode !== "off" && u < 40 };
  }).sort((a, c) => c.r - a.r);
  void st;
  const SRC = ["Web", "CTV", "Zalo", "Khách quen"], SRCC = ["oklch(0.6 0.13 250)", "oklch(0.66 0.16 45)", "oklch(0.6 0.12 200)", "oklch(0.56 0.12 155)"];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div onClick={() => setRy(ry - 1)} style={{ cursor: "pointer", width: 36, height: 36, borderRadius: "50%", border: "1.5px solid oklch(0.9 0.01 160)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800 }}>‹</div>
        <b style={{ fontSize: 18, minWidth: 100, textAlign: "center" }}>Năm {RY}</b>
        <div onClick={() => setRy(ry + 1)} style={{ cursor: "pointer", width: 36, height: 36, borderRadius: "50%", border: "1.5px solid oklch(0.9 0.01 160)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800 }}>›</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,160px),1fr))", gap: 10 }}>
        <MiniStat k={"Doanh thu " + RY} v={short(yRev)} sub={yb.length + " đơn"} c="oklch(0.3 0.03 160)" />
        <MiniStat k="Phát sinh thu thêm" v={short(yFees)} sub="Trả muộn, xăng, hư hỏng" c="oklch(0.5 0.13 60)" />
        <MiniStat k="Chi bảo dưỡng" v={short(mCost)} sub="Sửa chữa, bảo hiểm" c="oklch(0.52 0.16 28)" />
        <MiniStat k="Hoa hồng CTV" v={short(ctvCost)} sub={P.ctv + "% doanh thu đơn CTV"} c="oklch(0.52 0.16 28)" />
        <MiniStat k="Lãi gộp" v={short(yRev - mCost - ctvCost)} sub="Chưa trừ xăng, mặt bằng" c="oklch(0.42 0.11 155)" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: wide ? "minmax(0,1.6fr) minmax(0,1fr)" : "1fr", gap: 14, alignItems: "start" }}>
        <div style={{ ...box, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 16, fontWeight: 800 }}>Doanh thu theo tháng</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(12,minmax(0,1fr))", gap: 6, alignItems: "end", height: 200 }}>
            {mRevs.map((x, mi) => (
              <div key={mi} title={x.n + " đơn"} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", gap: 4, height: "100%", minWidth: 0 }}>
                <span style={{ fontSize: 10, fontWeight: 800, whiteSpace: "nowrap" }}>{x.r ? short(x.r) : ""}</span>
                <div style={{ width: "100%", height: Math.round((x.r / mx) * 100) + "%", minHeight: 3, borderRadius: "7px 7px 3px 3px", background: `${RY}-${String(mi + 1).padStart(2, "0")}` === T.slice(0, 7) ? O : "oklch(0.62 0.1 158)" }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: MUTED }}>T{mi + 1}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ ...box, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 16, fontWeight: 800 }}>Theo nguồn khách</div>
          {SRC.map((k, i) => { const l = yb.filter((b) => b.src === k), r = sumB(l); return (
            <div key={k} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}><b>{k}</b><span>{l.length} đơn · <b>{short(r)}</b></span></div>
              <div style={{ height: 8, borderRadius: 4, background: "oklch(0.94 0.005 160)", overflow: "hidden" }}><div style={{ width: (yRev ? Math.round((r / yRev) * 100) : 0) + "%", height: "100%", background: SRCC[i], borderRadius: 4 }} /></div>
            </div>
          ); })}
        </div>
      </div>
      <div style={{ ...box, padding: "6px 0", overflowX: "auto" }}>
        <div style={{ minWidth: 640 }}>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(180px,1.6fr) repeat(5,minmax(80px,1fr))", gap: 10, padding: "10px 16px", fontSize: 12, fontWeight: 800, letterSpacing: ".04em", color: MUTED, borderBottom: "1px solid oklch(0.93 0.008 160)" }}>
            <span>XE</span><span style={{ textAlign: "right" }}>ĐƠN</span><span style={{ textAlign: "right" }}>DOANH THU</span><span style={{ textAlign: "right" }}>TỈ LỆ THUÊ</span><span style={{ textAlign: "right" }}>BẢO DƯỠNG</span><span style={{ textAlign: "right" }}>LÃI GỘP</span>
          </div>
          {vehRows.map(({ v, n, r, u, mc, idle }) => (
            <div key={v.id} style={{ display: "grid", gridTemplateColumns: "minmax(180px,1.6fr) repeat(5,minmax(80px,1fr))", gap: 10, padding: "10px 16px", alignItems: "center", fontSize: 14, borderBottom: "1px solid oklch(0.96 0.004 160)" }}>
              <span style={{ minWidth: 0 }}><b>{v.name}</b> <span style={{ fontFamily: "ui-monospace,monospace", fontSize: 11, color: MUTED }}>{v.plate}</span>{idle && <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 800, padding: "2px 7px", borderRadius: 999, background: "oklch(0.96 0.04 75)", color: "oklch(0.48 0.13 60)" }}>Ít khách</span>}</span>
              <span style={{ textAlign: "right" }}>{n}</span>
              <b style={{ textAlign: "right" }}>{short(r)}</b>
              <span style={{ textAlign: "right" }}>{u}%</span>
              <span style={{ textAlign: "right", color: "oklch(0.52 0.15 28)" }}>{short(mc)}</span>
              <b style={{ textAlign: "right", color: r - mc < 0 ? "oklch(0.52 0.18 28)" : "oklch(0.42 0.11 155)" }}>{short(r - mc)}</b>
            </div>
          ))}
        </div>
      </div>
      <div style={{ ...box, display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ fontSize: 16, fontWeight: 800 }}>Hoa hồng cộng tác viên ({P.ctv}%)</div>
        {!Object.keys(ctvMap).length && <div style={{ fontSize: 14, color: MUTED }}>Chưa có đơn từ CTV.</div>}
        {Object.entries(ctvMap).map(([name, c]) => { const paid = !!P.ctvPaid[`${RY}:${name}`]; return (
          <div key={name} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto auto", gap: 12, alignItems: "center", padding: "10px 0", borderBottom: "1px solid oklch(0.95 0.005 160)" }}>
            <span style={{ minWidth: 0 }}><b style={{ fontSize: 14 }}>{name}</b><span style={{ display: "block", fontSize: 12, color: MUTED }}>{c.n} đơn · doanh thu {short(c.rev)}</span></span>
            <b style={{ fontSize: 15, color: "oklch(0.55 0.16 45)", whiteSpace: "nowrap" }}>{money(Math.round((c.rev * P.ctv) / 100000) * 1000)}</b>
            <div onClick={() => call({ op: "ctvPaid", name: `${RY}:${name}`, paid: !paid })} style={{ cursor: "pointer", fontSize: 12, fontWeight: 800, padding: "7px 12px", borderRadius: 999, whiteSpace: "nowrap", background: paid ? "oklch(0.95 0.04 155)" : G, color: paid ? "oklch(0.38 0.1 155)" : "white" }}>{paid ? "Đã trả" : "Đánh dấu đã trả"}</div>
          </div>
        ); })}
      </div>
    </div>
  );
}

// ======================= CÀI ĐẶT =======================
export function SettingsTab({ ctx }: { ctx: Ctx }) {
  const { data, call, say } = ctx;
  const [P, setP] = useState<FleetConfig>(data.config);
  const [ns, setNs] = useState({ name: "", phone: "" });
  // Chỉ phần giá/phí sửa theo "Lưu cài đặt"; ngày lễ & nhân viên lưu ngay.
  const nums = (c: FleetConfig) => ({ wk: c.wk, hol: c.hol, md3: c.md3, md5: c.md5, U: c.U, hourly: c.hourly, late: c.late, fuel: c.fuel, far: c.far, holdH: c.holdH, ctv: c.ctv, oilCost: c.oilCost, insCost: c.insCost, acc: c.acc });
  const dirty = JSON.stringify(nums(P)) !== JSON.stringify(nums(data.config));
  const save = (next: FleetConfig, message?: string) => call({ op: "saveConfig", config: next, message });
  type UK = "wk" | "hol" | "md3" | "md5";
  const numIn = (val: number, set: (n: number) => void) => (
    <input value={String(val)} onChange={(e) => set(parseInt(e.target.value.replace(/\D/g, ""), 10) || 0)} inputMode="numeric" style={{ fontSize: 15, fontWeight: 700, textAlign: "right", padding: "9px 10px", borderRadius: 10, border: "1.5px solid oklch(0.9 0.01 160)", minWidth: 0, fontFamily: "inherit" }} />
  );
  const row = (label: string, input: ReactNode, unit: ReactNode) => (
    <label key={label} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 110px 58px", gap: 8, alignItems: "center", fontSize: 14, fontWeight: 600 }}><span>{label}</span>{input}{unit}</label>
  );
  const uRow = (label: string, k: UK) => {
    const pc = P.U[k] === "pct";
    return row(label, numIn(P[k], (n) => setP({ ...P, [k]: n })),
      <span onClick={(e) => { e.preventDefault(); setP({ ...P, U: { ...P.U, [k]: pc ? "vnd" : "pct" }, [k]: 0 }); }} title="Đổi đơn vị" style={{ cursor: "pointer", fontSize: 12, fontWeight: 700, color: "oklch(0.4 0.06 158)", textAlign: "center", padding: "5px 4px", borderRadius: 8, background: "oklch(0.96 0.02 155)", border: "1px solid oklch(0.85 0.04 155)", whiteSpace: "nowrap" }}>{pc ? "% ⇄" : "đ ⇄"}</span>);
  };
  const nRow = (label: string, val: number, set: (n: number) => void, unit: string) =>
    row(label, numIn(val, set), <span style={{ fontSize: 12, fontWeight: 700, color: "oklch(0.4 0.06 158)", textAlign: "center" }}>{unit}</span>);
  const group = (title: string, hint: string, rows: ReactNode[]) => (
    <div style={{ ...box, display: "flex", flexDirection: "column", gap: 10 }}><div><div style={{ fontSize: 16, fontWeight: 800 }}>{title}</div><div style={{ fontSize: 12, color: MUTED }}>{hint}</div></div>{rows}</div>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "10px 14px", borderRadius: 14, background: dirty ? "oklch(0.97 0.04 70)" : "oklch(0.96 0.02 155)", color: dirty ? "oklch(0.45 0.14 50)" : "oklch(0.36 0.1 155)", fontSize: 14, fontWeight: 700 }}>
        {dirty ? "Có thay đổi chưa lưu" : "Cài đặt áp dụng cho đơn tạo mới (giá) và lúc nhận lại xe (phí phát sinh)."}
        {dirty && <div style={{ display: "flex", gap: 6 }}><button type="button" style={btn()} onClick={() => setP(data.config)}>Huỷ</button><button type="button" style={btn("pri")} onClick={() => save({ ...data.config, ...nums(P) })}>Lưu cài đặt</button></div>}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(min(100%,360px),1fr))", gap: 12, alignItems: "start" }}>
        {group("Giá theo ngày", "Cộng thêm vào giá thuê của từng xe. Bấm đơn vị để đổi giữa số tiền (đ/ngày) và %", [uRow("Cuối tuần (T7, CN) · cộng thêm", "wk"), uRow("Ngày lễ · cộng thêm", "hol"), uRow("Thuê từ 3 ngày · giảm mỗi ngày", "md3"), uRow("Thuê từ 5 ngày · giảm mỗi ngày", "md5")])}
        {group("Giá thuê theo giờ", "Khách thuê trong ngày · tối đa bằng giá 1 ngày", (Object.keys(FLEET_KINDS) as (keyof typeof FLEET_KINDS)[]).map((k) => nRow(FLEET_KINDS[k], P.hourly[k], (n) => setP({ ...P, hourly: { ...P.hourly, [k]: n } }), "đ/giờ")))}
        {group("Phí phát sinh", "Tự tính khi nhận lại xe", [nRow("Trả muộn (tối đa 5 giờ)", P.late, (n) => setP({ ...P, late: n }), "đ/giờ"), nRow("Thiếu xăng", P.fuel, (n) => setP({ ...P, fuel: n }), "đ/vạch"), nRow("Giao xe xa", P.far, (n) => setP({ ...P, far: n }), "đ")])}
        {group("Đền phụ kiện", "Khi khách làm mất", FLEET_ACC.map((a) => nRow(a, P.acc[a] ?? 0, (n) => setP({ ...P, acc: { ...P.acc, [a]: n } }), "đ")))}
        {group("Giữ chỗ & CTV", "Nhắc nhả xe khi khách chưa cọc", [nRow("Nhả xe nếu chưa cọc sau", P.holdH, (n) => setP({ ...P, holdH: n }), "giờ"), nRow("Hoa hồng CTV", P.ctv, (n) => setP({ ...P, ctv: Math.min(100, n) }), "%")])}
        {group("Bảo dưỡng", "Chi phí ghi nhanh khi bấm nút ở tab Bảo dưỡng", [nRow("Thay nhớt", P.oilCost, (n) => setP({ ...P, oilCost: n }), "đ"), nRow("Gia hạn bảo hiểm TNDS", P.insCost, (n) => setP({ ...P, insCost: n }), "đ")])}
        <div style={{ ...box, display: "flex", flexDirection: "column", gap: 10 }}>
          <div><div style={{ fontSize: 16, fontWeight: 800 }}>Ngày lễ (tính giá lễ)</div><div style={{ fontSize: 12, color: MUTED }}>Bấm × để bỏ · lưu ngay</div></div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {!data.config.hols.length && <span style={{ fontSize: 13, color: MUTED }}>Chưa có ngày lễ nào.</span>}
            {data.config.hols.slice().sort().map((d) => (
              <span key={d} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, padding: "6px 6px 6px 12px", borderRadius: 999, background: "oklch(0.96 0.04 75)" }}>
                {dm(d)}/{d.slice(2, 4)}
                <span onClick={() => save({ ...data.config, hols: data.config.hols.filter((x) => x !== d) }, "Đã bỏ ngày lễ " + dm(d))} style={{ cursor: "pointer", width: 22, height: 22, borderRadius: "50%", background: "white", display: "flex", alignItems: "center", justifyContent: "center" }}>×</span>
              </span>
            ))}
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700 }}>Thêm ngày
            <input type="date" value="" onChange={(e) => { const d = e.target.value; if (d && !data.config.hols.includes(d)) save({ ...data.config, hols: [...data.config.hols, d] }, "Đã thêm ngày lễ " + dm(d)); }} style={{ fontSize: 14, padding: "8px 10px", borderRadius: 10, border: "1.5px solid oklch(0.9 0.01 160)", fontFamily: "inherit" }} />
          </label>
        </div>
        <div style={{ ...box, display: "flex", flexDirection: "column", gap: 10 }}>
          <div><div style={{ fontSize: 16, fontWeight: 800 }}>Nhân viên</div><div style={{ fontSize: 12, color: MUTED }}>Danh bạ nhân viên giao xe · lưu ngay</div></div>
          {!data.config.staff.length && <span style={{ fontSize: 13, color: MUTED }}>Chưa có nhân viên.</span>}
          {data.config.staff.map((x, i) => (
            <div key={x.phone + i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid oklch(0.95 0.005 160)" }}>
              <span style={{ width: 34, height: 34, borderRadius: "50%", background: "oklch(0.95 0.025 155)", color: "oklch(0.35 0.08 158)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, flex: "none" }}>{ini(x.name)}</span>
              <div style={{ minWidth: 0, flex: 1 }}><div style={{ fontSize: 14, fontWeight: 800 }}>{x.name}</div><div style={{ fontSize: 12, color: MUTED }}>{x.phone}</div></div>
              <span onClick={() => { const R = ["Quản lý", "Nhân viên giao xe"]; save({ ...data.config, staff: data.config.staff.map((z, j) => (j === i ? { ...z, role: R[(R.indexOf(z.role) + 1) % 2] } : z)) }); }} style={{ cursor: "pointer", fontSize: 12, fontWeight: 800, padding: "5px 10px", borderRadius: 999, background: "oklch(0.96 0.006 160)", whiteSpace: "nowrap" }}>{x.role}</span>
              <span onClick={() => confirm("Xoá " + x.name + "?") && save({ ...data.config, staff: data.config.staff.filter((_, j) => j !== i) }, "Đã xoá nhân viên")} style={{ cursor: "pointer", fontSize: 16, color: MUTED }}>×</span>
            </div>
          ))}
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr) auto", gap: 6 }}>
            <input value={ns.name} onChange={(e) => setNs({ ...ns, name: e.target.value })} placeholder="Tên" style={{ fontSize: 14, padding: "9px 10px", borderRadius: 10, border: "1.5px solid oklch(0.9 0.01 160)", minWidth: 0, fontFamily: "inherit" }} />
            <input value={ns.phone} onChange={(e) => setNs({ ...ns, phone: e.target.value })} inputMode="tel" placeholder="SĐT" style={{ fontSize: 14, padding: "9px 10px", borderRadius: 10, border: "1.5px solid oklch(0.9 0.01 160)", minWidth: 0, fontFamily: "inherit" }} />
            <button type="button" style={btn("pri")} onClick={async () => {
              const phone = ns.phone.replace(/\s/g, "");
              if (ns.name.trim().length < 2 || !/^0\d{9}$/.test(phone)) return say("Nhập tên và số điện thoại 10 số");
              const j = await save({ ...data.config, staff: [...data.config.staff, { name: ns.name.trim(), phone, role: "Nhân viên giao xe" }] }, "Đã thêm nhân viên");
              if (j) setNs({ name: "", phone: "" });
            }}>Thêm</button>
          </div>
        </div>
      </div>
    </div>
  );
}
