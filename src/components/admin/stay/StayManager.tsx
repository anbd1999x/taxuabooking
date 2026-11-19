"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { usePublishTabs } from "@/components/admin/module-tabs";
import type { HomeData } from "@/lib/stay";
import {
  EXP_CATS,
  addDaysKey,
  billOf,
  diffDays,
  dowOf,
  hh,
  isLive,
  isMoveSplit,
  paidOf,
  rawPaid,
  roomFree,
  stayStatus,
  vnNow,
  type HkStatus,
  type StayStatus,
  type StayVM,
} from "@/lib/stay-core";
import { BORDER, D, DIM, G, HATCH, HK, INK, M, O, RED, ST, WD, WDL, copyText, input, lastWord, seg, short, digits } from "./ui";
import { StayDrawer } from "./StayDrawer";
import { StaySettings } from "./StaySettings";

export type Dr = null | { kind: "new"; room?: string; ci?: string } | { kind: "stay" | "in" | "out" | "edit"; id: string } | { kind: "close" };
export type CallFn = (payload: Record<string, unknown>) => Promise<(HomeData & { message?: string }) | null>;
type Tab = "today" | "map" | "web" | "hk" | "ledger" | "cust" | "report" | "settings";

type Props = {
  serviceId: string;
  serviceTitle: string;
  services: { id: string; title: string; rooms: number }[];
  viewerRole: "ADMIN" | "PROVIDER" | "STAFF";
  initial: HomeData;
};

const sectionCard: CSSProperties = { background: "white", border: `1px solid ${BORDER}`, borderRadius: 20, padding: 14, display: "flex", flexDirection: "column", gap: 8 };

/** Quản lý phòng của chủ homestay — theo mẫu claude.ai/design "Admin Quan ly Phong". */
export function StayManager({ serviceId, serviceTitle, services, viewerRole, initial }: Props) {
  const router = useRouter();
  const [raw, setRaw] = useState<HomeData>(initial);
  const [clock, setClock] = useState({ today: initial.today, now: initial.now });
  const [w, setW] = useState(1200);
  const [role, setRole] = useState<"owner" | "staff">(viewerRole === "STAFF" ? "staff" : "owner");
  const [tab, setTab] = useState<Tab>("today");
  const [view, setView] = useState<"day" | "month" | "year">("month");
  const [y, setY] = useState(Number(initial.today.slice(0, 4)));
  const [m, setM] = useState(Number(initial.today.slice(5, 7)) - 1);
  const [date, setDate] = useState(initial.today);
  const [dr, setDr] = useState<Dr>(null);
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);
  const [range, setRange] = useState<"today" | "month">("month");
  const [expOpen, setExpOpen] = useState(false);
  const [ex, setEx] = useState({ cat: "Điện nước", amt: "", note: "" });
  const [cq, setCq] = useState("");
  const [log, setLog] = useState({ room: initial.rooms[0]?.id ?? "", what: "", cost: "" });
  const [webRoom, setWebRoom] = useState<Record<string, string>>({});
  const rootRef = useRef<HTMLDivElement>(null);
  const inflight = useRef(false);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    const t = setInterval(() => setClock(vnNow()), 60_000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const say = (t: string) => setToast(t);
  const call: CallFn = async (payload) => {
    // Bấm đúp (mobile) không gửi 2 thao tác — vd ghi thu 2 lần, trả phòng 2 lần.
    if (inflight.current) return null;
    inflight.current = true;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/stay", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ serviceId, ...payload }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        say(j.error ?? "Có lỗi xảy ra");
        return null;
      }
      const { message, ...rest } = j;
      setRaw(rest as HomeData);
      setClock({ today: j.today, now: j.now });
      if (message) say(message);
      return j;
    } catch {
      say("Mất kết nối, thử lại");
      return null;
    } finally {
      inflight.current = false;
      setBusy(false);
    }
  };

  const data = useMemo(() => ({ ...raw, ...clock }), [raw, clock]);
  const { rooms, types, stays, web, closes, locks, exps, logs, cfg } = data;
  const T = data.today, NOW = data.now;
  const mob = w < 640;
  const isStaff = role === "staff";
  const roomById = useMemo(() => new Map(rooms.map((r) => [r.id, r])), [rooms]);
  const rName = (id: string) => roomById.get(id)?.name ?? "?";
  const typeName = (id: string) => types.find((t) => t.id === id)?.name ?? "";
  const stat = (x: StayVM): StayStatus => stayStatus(x, stays, T, NOW, cfg);
  const paid = (x: StayVM) => paidOf(x, stays);
  const L = stays.filter(isLive);
  const occ = (d: string) => L.filter((x) => x.ci <= d && d < x.co);
  /** Số phòng bận đêm d: lượt ở + ngày khoá từ Sheet / OTA / khoá tay (mỗi phòng tính một lần). */
  const busyRooms = (d: string) => new Set([...occ(d).map((x) => x.roomId), ...locks.filter((l) => l.from <= d && d < l.to).map((l) => l.roomId)]).size;
  const closedOn = (roomId: string, d: string) => closes.find((c) => c.roomIds.includes(roomId) && c.from <= d && d <= c.to);
  const lockOn = (roomId: string, d: string) => locks.find((l) => l.roomId === roomId && l.from <= d && d < l.to);
  const free = (roomId: string, ci: string, co: string, except?: string) => roomFree(roomId, ci, co, { stays, closes, locks }, except);
  const openStay = (x: StayVM) => setDr({ kind: "stay", id: x.id });
  const startIn = (x: StayVM) => setDr({ kind: "in", id: x.id });
  const startOut = (x: StayVM) => setDr({ kind: "out", id: x.id });
  const openNew = (room?: string, ci?: string) => setDr({ kind: "new", room, ci: ci && ci >= T ? ci : T });
  const webPending = web;

  // ---------- TODAY ----------
  const tonight = new Set(occ(T).map((x) => x.roomId));
  const freeRooms = rooms.filter((r) => !tonight.has(r.id) && !closedOn(r.id, T) && !lockOn(r.id, T));
  const arr = L.filter((x) => stat(x) === "arriving");
  const dep = L.filter((x) => ["dueout", "overdue"].includes(stat(x)));
  const inh = L.filter((x) => ["inhouse", "dueout", "overdue"].includes(stat(x)));
  const nowMs = Date.now();
  const holds = L.filter((x) => stat(x) === "hold" && x.holdUntil && !x.bookingId)
    .sort((a, b) => (a.holdUntil! < b.holdUntil! ? -1 : 1))
    .slice(0, 5);
  const due = (x: StayVM) => Math.max(0, billOf(x) - paid(x));
  const owe = L.filter((x) => ["arriving", "inhouse", "dueout", "overdue"].includes(stat(x))).reduce((a, x) => a + due(x), 0);
  const dirty = rooms.filter((r) => r.hk === "dirty" || r.hk === "cleaning").length;
  const hoursLeft = (iso: string) => Math.max(0, Math.ceil((Date.parse(iso) - nowMs) / 3_600_000));
  const waitH = (iso: string) => Math.max(0, Math.floor((nowMs - Date.parse(iso)) / 3_600_000));
  const btn = (name: string, go: () => void, pri?: boolean) => ({ btn: name, go, bBg: pri ? G : "white", bFg: pri ? "white" : INK });
  const remind = async (x: StayVM) => {
    const msg = `Chào ${x.name}, ${serviceTitle} đang giữ phòng ${rName(x.roomId)} cho anh/chị từ ${D(x.ci)} đến ${D(x.co)} (${M(billOf(x))}). Phòng sẽ tự nhả lúc ${new Date(x.holdUntil!).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })} nếu chưa nhận được cọc. Anh/chị chuyển cọc giúp em nhé!`;
    say((await copyText(msg)) ? `Đã chép tin nhắc cọc cho ${x.name}` : "Không chép được, thử lại");
  };
  const tasks = [
    { title: "Khách đến hôm nay", c: O, items: arr.map((x) => ({ room: rName(x.roomId), name: x.name, sub: `${x.guests} khách · ${diffDays(x.ci, x.co)} đêm · ${paid(x) ? "đã cọc " + M(paid(x)) : "chưa cọc"}`, open: () => openStay(x), ...btn("Nhận phòng", () => startIn(x), true) })) },
    { title: "Quá giờ trả phòng", c: "oklch(0.58 0.19 28)", items: L.filter((x) => stat(x) === "overdue").map((x) => ({ room: rName(x.roomId), name: x.name, sub: `Giờ trả ${hh(cfg.co)} · còn thu ${M(due(x))}`, open: () => openStay(x), ...btn("Trả phòng", () => startOut(x), true) })) },
    { title: "Cần trả phòng hôm nay", c: "oklch(0.55 0.13 300)", items: L.filter((x) => stat(x) === "dueout").map((x) => ({ room: rName(x.roomId), name: x.name, sub: `Trước ${hh(cfg.co)} · còn thu ${M(due(x))}`, open: () => openStay(x), ...btn("Trả phòng", () => startOut(x), true) })) },
    { title: "Giữ chỗ chưa cọc sắp hết hạn", c: "oklch(0.7 0.15 60)", items: holds.map((x) => ({ room: rName(x.roomId), name: x.name, sub: `${D(x.ci)} · tự nhả sau ${hoursLeft(x.holdUntil!)} giờ · ${x.phone}`, open: () => openStay(x), ...btn("Nhắc cọc", () => remind(x)) })) },
    { title: "Đơn web chờ xác nhận", c: "oklch(0.55 0.13 250)", items: webPending.map((o) => ({ room: o.roomIds.map(rName).join(", "), name: o.name, sub: `${o.code} · ${D(o.ci)} → ${D(o.co)} · chờ ${waitH(o.createdAt)} giờ`, open: () => setTab("web"), ...btn("Xem đơn", () => setTab("web"), true) })) },
  ];

  // ---------- MAP ----------
  const m0 = `${y}-${String(m + 1).padStart(2, "0")}-01`;
  const N = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const mEndKey = addDaysKey(m0, N);
  const cw = mob ? 34 : w >= 1300 ? 42 : 38;
  const labelW = mob ? 96 : 176;
  const mDays = Array.from({ length: N }, (_, i) => {
    const d = addDaysKey(m0, i), wdI = dowOf(d), isT = d === T, we = wdI === 5 || wdI === 6;
    return { d, n: i + 1, wd: WD[wdI], bg: isT ? "oklch(0.96 0.05 70)" : we ? "oklch(0.985 0.008 155)" : "white", wc: we ? "oklch(0.5 0.12 45)" : DIM, fc: isT ? "oklch(0.55 0.17 45)" : INK };
  });
  type Bar = { key: string; l: number; w: number; bg: string; bd: string; fg: string; bs: string; grp: boolean; label: string; tip: string; open: () => void };
  const barsOf = (roomId: string): Bar[] => {
    const bars: Bar[] = [];
    const span = (ci: string, co: string) => {
      const a = diffDays(m0, ci), b = diffDays(m0, co);
      const l = Math.max(0, (a + 0.5) * cw), r = Math.min(N * cw, (b + 0.5) * cw);
      return { l, w: Math.max(14, r - l - 2), len: r - l };
    };
    for (const x of L.filter((s) => s.roomId === roomId && s.ci < mEndKey && s.co > m0)) {
      const st = stat(x), S = ST[st], sp = span(x.ci, x.co);
      const nm = x.name.split(" (")[0];
      bars.push({ key: x.id, l: sp.l, w: sp.w, bg: S[1], bd: S[2], fg: S[3], bs: S[4], grp: !!x.groupId, label: (sp.len > 70 ? nm : lastWord(nm)) + (st === "hold" ? " · chưa cọc" : ""), tip: `${x.name} · ${D(x.ci)} → ${D(x.co)} · ${S[0]}`, open: () => openStay(x) });
    }
    for (const o of web.filter((o) => o.roomIds.includes(roomId) && o.status !== "CONFIRMED" && o.ci < mEndKey && o.co > m0)) {
      const S = ST.web, sp = span(o.ci, o.co);
      bars.push({ key: "w" + o.id, l: sp.l, w: sp.w, bg: S[1], bd: S[2], fg: S[3], bs: S[4], grp: false, label: (sp.len > 70 ? o.name : lastWord(o.name)) + " · web", tip: `${o.code} · ${o.name} · ${D(o.ci)} → ${D(o.co)} · chờ xác nhận`, open: () => setTab("web") });
    }
    // Khoá / đóng phòng vẽ theo ĐÊM như lượt ở (đêm d = nửa sau ô d → nửa đầu ô d+1) để các thanh liền nhau không chồng lên nhau.
    const hatch = (key: string, from: string, toExcl: string, label: string, tip: string, open: () => void) => {
      const sp = span(from, toExcl);
      if (sp.len <= 0) return;
      bars.push({ key, l: sp.l, w: sp.w, bg: HATCH, bd: "oklch(0.8 0.005 160)", fg: "oklch(0.35 0.02 160)", bs: "solid", grp: false, label: sp.len > 70 ? label : label.split(" · ").pop() ?? label, tip, open });
    };
    for (const c of closes.filter((c) => c.roomIds.includes(roomId) && c.from < mEndKey && c.to >= m0)) hatch("c" + c.id, c.from, addDaysKey(c.to, 1), "Đóng · " + c.reason, `Đóng phòng ${c.reason} · ${D(c.from)} → ${D(c.to)}`, () => setDr({ kind: "close" }));
    for (const lk of locks.filter((l) => l.roomId === roomId && l.from < mEndKey && l.to > m0)) hatch("l" + lk.from + lk.label, lk.from, lk.to, "Khoá · " + lk.label, `Khoá từ ${lk.label} · ${D(lk.from)} → ${D(lk.to)} (sửa ở nguồn đó)`, () => say(lk.label === "Sheet" ? "Ngày này do Google Sheet khoá — sửa trong sheet" : lk.label === "OTA" ? "Ngày này do lịch OTA khoá" : "Ngày này đang khoá ở Lịch giá & tình trạng"));
    return bars;
  };
  const groups = types.map((t) => {
    const rs = rooms.filter((r) => r.typeId === t.id);
    const prices = rs.flatMap((r) => r.dow).filter((p) => p > 0);
    return { id: t.id, name: t.name.toUpperCase(), meta: `${rs.length} phòng${prices.length ? " · " + M(Math.min(...prices)) + (Math.max(...prices) !== Math.min(...prices) ? "–" + M(Math.max(...prices)) : "") : ""}`, rows: rs };
  });
  const dd = date;
  const dayCards = rooms.map((r) => {
    const x = L.find((s) => s.roomId === r.id && ((s.ci <= dd && dd < s.co) || (s.co === dd && s.inAt && !s.outAt)));
    const inc = L.find((s) => s.roomId === r.id && s.ci === dd);
    const cl = closedOn(r.id, dd), lk = lockOn(r.id, dd);
    const st = x ? stat(x) : null, S = st ? ST[st] : null;
    let status = "Trống", sBg = "oklch(0.94 0.05 155)", sFg = "oklch(0.36 0.1 155)", who = "", sub = "", cta = "Đặt phòng →", bd = "oklch(0.92 0.01 160)";
    let go = () => openNew(r.id, dd);
    if (cl) { status = "Đóng · " + cl.reason; sBg = "oklch(0.93 0.005 160)"; sFg = "oklch(0.35 0.02 160)"; who = "—"; sub = `${D(cl.from)} → ${D(cl.to)}`; cta = "Xem"; go = () => setDr({ kind: "close" }); }
    else if (x && S && st) {
      status = S[0]; sBg = S[1]; sFg = S[3]; who = x.name; sub = `${x.guests} khách · ${D(x.ci)} → ${D(x.co)}`; bd = S[2];
      cta = st === "arriving" ? "Nhận phòng →" : st === "dueout" || st === "overdue" ? "Trả phòng →" : "Chi tiết →";
      go = st === "arriving" ? () => startIn(x) : st === "dueout" || st === "overdue" ? () => startOut(x) : () => openStay(x);
      if (inc && inc.id !== x.id) sub += " · khách mới tới " + lastWord(inc.name);
    } else if (lk) { status = "Khoá · " + lk.label; sBg = "oklch(0.93 0.005 160)"; sFg = "oklch(0.35 0.02 160)"; who = "—"; sub = `${D(lk.from)} → ${D(lk.to)}`; cta = "Xem"; go = () => say("Ngày này đang bị khoá từ " + lk.label); }
    return { id: r.id, name: r.name, type: typeName(r.typeId), status, sBg, sFg, who: who || "Chưa có khách", sub, cta, go, bd, hk: HK[r.hk] };
  });
  const HL = ["oklch(0.955 0.006 160)", "oklch(0.9 0.05 155)", "oklch(0.8 0.09 155)", "oklch(0.65 0.11 155)", "oklch(0.48 0.1 158)"];
  const months = Array.from({ length: 12 }, (_, mi) => {
    const f = `${y}-${String(mi + 1).padStart(2, "0")}-01`, o = (dowOf(f) + 6) % 7, n = new Date(Date.UTC(y, mi + 1, 0)).getUTCDate();
    let sum = 0;
    const days = Array.from({ length: n }, (_, i) => {
      const d = addDaysKey(f, i), c = busyRooms(d), r = rooms.length ? c / rooms.length : 0;
      sum += r;
      const lv = r === 0 ? 0 : r < 0.3 ? 1 : r < 0.6 ? 2 : r < 0.85 ? 3 : 4;
      return { d, n: i + 1, bg: HL[lv], fg: lv >= 3 ? "white" : "oklch(0.35 0.03 160)", ring: d === T ? "0 0 0 2px " + O : "none", tip: `${D(d)} · ${c}/${rooms.length} phòng` };
    });
    return { mi, name: "Tháng " + (mi + 1), occ: Math.round((sum / n) * 100) + "%", bd: mi === Number(T.slice(5, 7)) - 1 && y === Number(T.slice(0, 4)) ? O : BORDER, offset: o, days };
  });
  const shift = (n: number) => {
    if (view === "year") return setY(y + n);
    if (view === "day") return setDate(addDaysKey(date, n));
    const d = new Date(Date.UTC(y, m + n, 1));
    setY(d.getUTCFullYear());
    setM(d.getUTCMonth());
  };
  const goToday = () => { setY(Number(T.slice(0, 4))); setM(Number(T.slice(5, 7)) - 1); setDate(T); };
  const periodLabel = view === "year" ? "Năm " + y : view === "day" ? `${WD[dowOf(date)]}, ${D(date)}` : `Tháng ${m + 1}, ${y}`;
  const legend = (["hold", "deposit", "arriving", "inhouse", "dueout", "overdue", "web", "out"] as StayStatus[]).map((k) => ({ name: ST[k][0], bg: ST[k][1], bd: ST[k][2], bs: ST[k][4] }))
    .concat([{ name: "Đóng / khoá phòng", bg: "repeating-linear-gradient(45deg, oklch(0.88 0.005 160) 0 3px, white 3px 6px)", bd: "oklch(0.8 0.005 160)", bs: "solid" }]);

  // ---------- HK ----------
  const hkRooms = rooms.map((r) => {
    const h = HK[r.hk];
    const x = L.find((s) => s.roomId === r.id && s.ci <= T && T < s.co && s.inAt && !s.outAt);
    const nx = L.filter((s) => s.roomId === r.id && s.ci >= T && !s.inAt).sort((a, b) => (a.ci < b.ci ? -1 : 1))[0];
    return { r, h, note: x ? `Có khách: ${lastWord(x.name)} · trả ${D(x.co)}` : nx ? `Khách tới tiếp: ${D(nx.ci)}${nx.ci === T ? " (hôm nay)" : ""}` : "Không có khách sắp tới" };
  });
  const cleanList = rooms.filter((r) => r.hk === "dirty" || r.hk === "cleaning" || dep.some((x) => x.roomId === r.id)).map((r) => {
    const urgent = arr.some((x) => x.roomId === r.id);
    return { r, why: dep.some((x) => x.roomId === r.id) ? "Khách trả hôm nay" : HK[r.hk][0], pri: urgent ? "Gấp · có khách tới" : "Trong ngày", pc: urgent ? RED : DIM, bg: urgent ? "oklch(0.97 0.03 28)" : "oklch(0.975 0.006 160)" };
  });

  // ---------- LEDGER ----------
  const inRange = (d: string) => (range === "today" ? d === T : d.slice(0, 7) === T.slice(0, 7));
  type Entry = { key: string; date: string; title: string; sub: string; method: string; amt: number; exp: boolean; open?: () => void };
  const entries: Entry[] = [];
  for (const x of stays) for (const p of x.pays) entries.push({ key: p.id, date: p.at.slice(0, 10), title: `${rName(x.roomId)} · ${x.name}`, sub: `${p.kind} · ${x.code}${x.bookingCode ? " · " + x.bookingCode : ""}`, method: p.method, amt: p.amt, exp: false, open: () => openStay(x) });
  for (const e of exps) entries.push({ key: e.id, date: e.date, title: e.cat, sub: (e.note || "Chi phí vận hành") + " · bấm để xoá", method: "Chi", amt: -e.amt, exp: true, open: () => { if (confirm(`Xoá khoản chi ${e.cat} ${M(e.amt)}?`)) void call({ op: "expense", deleteId: e.id }); } });
  const shown = entries.filter((e) => inRange(e.date)).sort((a, b) => (a.date < b.date ? 1 : -1));
  // "Sàn thu hộ" = tiền khách trả cho sàn (sàn đối soát sau) — không phải tiền đang ở quỹ của nhà, tách riêng khỏi "Đã thu".
  const platformIn = shown.filter((e) => !e.exp && e.method === "Sàn thu hộ").reduce((a, e) => a + e.amt, 0);
  const income = shown.filter((e) => !e.exp && e.method !== "Sàn thu hộ").reduce((a, e) => a + e.amt, 0);
  const spend = shown.filter((e) => e.exp).reduce((a, e) => a - e.amt, 0);
  const held = L.filter((x) => ["hold", "deposit", "arriving"].includes(stat(x))).reduce((a, x) => a + paid(x), 0);
  const MC: Record<string, [string, string]> = { "Tiền mặt": ["oklch(0.94 0.05 155)", "oklch(0.36 0.1 155)"], "Chuyển khoản": ["oklch(0.94 0.04 250)", "oklch(0.42 0.12 250)"], "Sàn thu hộ": ["oklch(0.96 0.05 75)", "oklch(0.48 0.14 55)"], Chi: ["oklch(0.96 0.03 28)", "oklch(0.5 0.17 28)"] };

  // ---------- CUSTOMERS ----------
  const byP: Record<string, { name: string; phone: string; n: number; spent: number; last: string }> = {};
  for (const x of stays.filter((s) => s.state !== "reject")) {
    const c = (byP[x.phone] ??= { name: x.name.split(" (")[0], phone: x.phone, n: 0, spent: 0, last: "" });
    // Lượt lịch sử tách khi đổi phòng không phải lượt khách mới ⇒ không đếm thêm lượt.
    if (isLive(x)) { if (!isMoveSplit(x)) c.n++; c.spent += rawPaid(x); if (x.ci > c.last) c.last = x.ci; }
  }
  const custs = Object.values(byP)
    .filter((c) => !cq || (c.name + c.phone).toLowerCase().includes(cq.toLowerCase()))
    .sort((a, b) => b.spent - a.spent)
    .slice(0, 30);

  // ---------- REPORT ----------
  const mStart = m0, mEnd = mEndKey, nDays = N;
  let sold = 0, roomRev = 0, comm = 0, closedN = 0;
  const bySrc: Record<string, number> = {}, byRoom: Record<string, number> = {};
  for (const x of L) {
    const nights = Math.max(1, diffDays(x.ci, x.co)), per = x.total / nights, cPer = x.comm / nights;
    for (let d = x.ci < mStart ? mStart : x.ci; d < x.co && d < mEnd; d = addDaysKey(d, 1)) {
      sold++; roomRev += per; comm += cPer;
      bySrc[x.src] = (bySrc[x.src] || 0) + per;
      byRoom[rName(x.roomId)] = (byRoom[rName(x.roomId)] || 0) + per;
    }
  }
  let lockN = 0;
  for (const r of rooms) for (let d = mStart; d < mEnd; d = addDaysKey(d, 1)) {
    if (closedOn(r.id, d)) closedN++;
    else if (lockOn(r.id, d) && !L.some((x) => x.roomId === r.id && x.ci <= d && d < x.co)) lockN++;
  }
  const avail = Math.max(1, rooms.length * nDays - closedN);
  const monthExp = exps.filter((e) => e.date >= mStart && e.date < mEnd).reduce((a, e) => a + e.amt, 0);
  const bars = (obj: Record<string, number>, c: string) => {
    const mx = Math.max(1, ...Object.values(obj));
    return Object.entries(obj).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ k, v: short(v), pct: Math.round((v / mx) * 100) + "%", c }));
  };

  const tabsDef: [Tab, string, number?][] = isStaff
    ? [["today", "Hôm nay"], ["map", "Sơ đồ phòng"], ["web", "Đơn web", webPending.length], ["hk", "Buồng phòng", dirty]]
    : [["today", "Hôm nay"], ["map", "Sơ đồ phòng"], ["web", "Đơn web", webPending.length], ["hk", "Buồng phòng", dirty], ["ledger", "Thu chi"], ["cust", "Khách hàng"], ["report", "Báo cáo"], ["settings", "Cài đặt"]];
  const curTab: Tab = tabsDef.some((t) => t[0] === tab) ? tab : "today";
  // Tab hiện thành MỤC CON ở menu trái (không còn thanh tab cuộn ngang).
  usePublishTabs(tabsDef.map(([key, label, badge]) => ({ key, label, badge })), curTab, (k) => setTab(k as Tab));
  const kpis = [
    { k: "Phòng trống đêm nay", v: `${freeRooms.length}/${rooms.length}`, sub: freeRooms.map((r) => r.name).join(", ") || "Kín phòng", c: "oklch(0.55 0.12 155)", pick: () => { setTab("map"); setView("day"); setDate(T); } },
    { k: "Đang ở", v: String(inh.length), sub: inh.reduce((a, s) => a + s.guests, 0) + " khách", c: "oklch(0.45 0.1 158)", pick: () => { setTab("map"); setView("day"); setDate(T); } },
    { k: "Khách đến hôm nay", v: String(arr.length), sub: arr.map((s) => rName(s.roomId)).join(", ") || "—", c: O, pick: () => {} },
    { k: "Khách đi hôm nay", v: String(dep.length), sub: dep.filter((s) => stat(s) === "overdue").length ? dep.filter((s) => stat(s) === "overdue").length + " quá giờ" : "Trước " + hh(cfg.co), c: "oklch(0.55 0.13 300)", pick: () => {} },
    { k: "Phòng chưa dọn", v: String(dirty), sub: "Bấm để xem buồng", c: "oklch(0.58 0.19 28)", pick: () => setTab("hk") },
    ...(isStaff ? [] : [{ k: "Còn phải thu", v: short(owe), sub: "Khách đang ở & tới hôm nay", c: "oklch(0.6 0.12 250)", pick: () => setTab("ledger") }]),
  ];

  if (!rooms.length) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-dashed border-forest-200 bg-white p-8 text-center">
        <h1 className="text-xl font-bold text-ink">Quản lý phòng · {serviceTitle}</h1>
        <p className="mt-2 text-sm text-gray-600">Homestay chưa có phòng nào. Thêm hạng phòng và phòng ở trang sửa homestay trước.</p>
      </div>
    );
  }

  const todayLabel = mob ? D(T).slice(0, 5) : `${WDL[dowOf(T)]}, ${D(T)} · ${NOW}`;
  const pill = (bg: string, fg: string): CSSProperties => ({ fontSize: 11, fontWeight: 800, padding: "3px 9px", borderRadius: 999, background: bg, color: fg, whiteSpace: "nowrap" });

  return (
    <div ref={rootRef} className="stay-root -m-4 lg:-m-6" style={{ color: "oklch(0.22 0.03 160)", minHeight: "100%", background: "oklch(0.975 0.004 160)" }}>
      <style>{`@keyframes stayUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}@keyframes staySlide{from{transform:translateX(40px);opacity:0}to{transform:none;opacity:1}}.stay-root *{box-sizing:border-box}.stay-root input,.stay-root select,.stay-root textarea{font-family:inherit}.stay-hov:hover{filter:brightness(1.06)}.stay-cell:hover{background:oklch(0.95 0.03 155)!important}`}</style>
      {/* thanh trên */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "12px clamp(14px,2.5vw,28px)", background: "white", borderBottom: "1px solid oklch(0.93 0.008 160)", flexWrap: "wrap" }}>
        {services.length > 1 ? (
          <select value={serviceId} onChange={(e) => router.push(`/admin/provider/phong?service=${e.target.value}`)} style={{ fontSize: 14, fontWeight: 800, padding: "8px 12px", borderRadius: 999, border: 0, background: "oklch(0.95 0.025 155)", color: "oklch(0.35 0.08 158)", maxWidth: "100%" }}>
            {services.map((s) => <option key={s.id} value={s.id}>{s.title} · {s.rooms} phòng</option>)}
          </select>
        ) : (
          <span style={{ fontSize: 14, fontWeight: 800, padding: "8px 12px", borderRadius: 999, background: "oklch(0.95 0.025 155)", color: "oklch(0.35 0.08 158)", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{serviceTitle} · {rooms.length} phòng</span>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {viewerRole !== "STAFF" && (
            <select value={role} onChange={(e) => { const r = e.target.value as "owner" | "staff"; setRole(r); if (r === "staff" && !["today", "map", "web", "hk"].includes(tab)) setTab("today"); }} style={{ fontSize: 13, fontWeight: 700, padding: "8px 10px", borderRadius: 999, border: "1.5px solid oklch(0.9 0.01 160)", background: "white" }}>
              <option value="owner">Chủ homestay</option>
              <option value="staff">Lễ tân / buồng phòng</option>
            </select>
          )}
          <span style={{ fontSize: 14, color: DIM, whiteSpace: "nowrap" }}>{todayLabel}</span>
          <div onClick={() => openNew()} className="stay-hov" style={{ cursor: "pointer", fontSize: 14, fontWeight: 800, padding: "10px 16px", borderRadius: 999, background: O, color: "white", whiteSpace: "nowrap" }}>+ Đặt phòng</div>
        </div>
      </div>

      <div style={{ padding: "clamp(14px,2.5vw,28px)", display: "flex", flexDirection: "column", gap: 16 }}>
        {isStaff && <div style={{ padding: "12px 16px", borderRadius: 14, background: "oklch(0.95 0.03 250)", color: "oklch(0.38 0.1 250)", fontSize: 14, lineHeight: 1.5 }}>Đang xem với quyền <b>Lễ tân / buồng phòng</b>: đặt phòng, thu tiền, nhận/trả phòng, dọn phòng. Báo cáo, giá và cài đặt được ẩn.</div>}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 14, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: "clamp(24px,2.6vw,30px)", fontWeight: 800, letterSpacing: "-.02em" }}>Quản lý phòng</h1>
            <div style={{ fontSize: 15, color: "oklch(0.48 0.02 160)", marginTop: 4 }}>Một lịch phòng duy nhất cho khách gọi điện, vãng lai và đơn web. Đặt ở đây, web tự báo hết phòng.</div>
          </div>
        </div>

        {/* ===== HÔM NAY ===== */}
        {curTab === "today" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,150px),1fr))", gap: 10 }}>
              {kpis.map((s) => (
                <div key={s.k} onClick={s.pick} style={{ cursor: "pointer", padding: "12px 16px", borderRadius: 16, background: "white", border: `1px solid ${BORDER}`, animation: "stayUp .35s ease both" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: "oklch(0.45 0.02 160)" }}><span style={{ width: 9, height: 9, borderRadius: "50%", background: s.c }} />{s.k}</div>
                  <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-.02em", marginTop: 2 }}>{s.v}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "oklch(0.52 0.02 160)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.sub}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(min(100%,360px),1fr))", gap: 12, alignItems: "start" }}>
              {tasks.map((g) => (
                <section key={g.title} style={sectionCard}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 15, fontWeight: 800 }}><span style={{ width: 10, height: 10, borderRadius: "50%", background: g.c }} />{g.title}</span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: g.c }}>{g.items.length}</span>
                  </div>
                  {!g.items.length && <div style={{ fontSize: 13, color: "oklch(0.55 0.02 160)", padding: "6px 2px" }}>Không có việc nào.</div>}
                  {g.items.map((x, i) => (
                    <div key={i} style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px 12px", borderRadius: 14, background: "oklch(0.975 0.006 160)" }}>
                      <span style={{ flex: "none", minWidth: 42, maxWidth: 96, padding: "6px 4px", borderRadius: 10, background: "white", textAlign: "center", fontSize: 13, fontWeight: 800, border: `1.5px solid ${g.c}`, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.room}</span>
                      <div onClick={x.open} style={{ cursor: "pointer", flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{x.name}</div>
                        <div style={{ fontSize: 12, color: "oklch(0.48 0.02 160)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{x.sub}</div>
                      </div>
                      <div onClick={x.go} style={{ cursor: "pointer", flex: "none", fontSize: 12, fontWeight: 800, padding: "8px 12px", borderRadius: 999, background: x.bBg, color: x.bFg, whiteSpace: "nowrap", border: x.bBg === "white" ? "1.5px solid oklch(0.88 0.015 160)" : "none" }}>{x.btn}</div>
                    </div>
                  ))}
                </section>
              ))}
            </div>
          </div>
        )}

        {/* ===== SƠ ĐỒ PHÒNG ===== */}
        {curTab === "map" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "10px 12px", borderRadius: 18, background: "white", border: `1px solid ${BORDER}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div onClick={() => shift(-1)} style={navBtn}>‹</div>
                <div style={{ minWidth: 150, textAlign: "center", fontSize: 17, fontWeight: 800, whiteSpace: "nowrap" }}>{periodLabel}</div>
                <div onClick={() => shift(1)} style={navBtn}>›</div>
                <div onClick={goToday} style={{ cursor: "pointer", fontSize: 13, fontWeight: 800, padding: "8px 12px", borderRadius: 999, background: "oklch(0.95 0.025 155)", color: "oklch(0.35 0.08 158)", whiteSpace: "nowrap" }}>Hôm nay</div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ display: "inline-flex", gap: 3, padding: 3, borderRadius: 12, background: "oklch(0.95 0.006 160)" }}>
                  {([["day", "Ngày"], ["month", "Tháng"], ["year", "Năm"]] as const).map(([k, name]) => <div key={k} onClick={() => setView(k)} style={seg(view === k)}>{name}</div>)}
                </div>
                <div onClick={() => setDr({ kind: "close" })} style={{ cursor: "pointer", fontSize: 13, fontWeight: 800, padding: "8px 12px", borderRadius: 999, border: "1.5px solid oklch(0.88 0.015 160)", whiteSpace: "nowrap" }}>Đóng phòng</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {legend.map((l) => (
                <span key={l.name} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "oklch(0.42 0.02 160)", whiteSpace: "nowrap" }}>
                  <span style={{ width: 16, height: 10, borderRadius: 4, background: l.bg, border: `1.5px ${l.bs} ${l.bd}` }} />{l.name}
                </span>
              ))}
            </div>

            {view === "month" && (
              <>
                <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 20, overflow: "auto", maxHeight: "75vh" }}>
                  <div style={{ width: "max-content", minWidth: "100%" }}>
                    <div style={{ display: "flex", position: "sticky", top: 0, zIndex: 3, background: "white", borderBottom: "1px solid oklch(0.93 0.008 160)" }}>
                      <div style={{ position: "sticky", left: 0, zIndex: 2, width: labelW, flex: "none", background: "white", padding: "8px 12px", fontSize: 12, fontWeight: 800, color: DIM, borderRight: "1px solid oklch(0.93 0.008 160)" }}>Phòng</div>
                      {mDays.map((d) => (
                        <div key={d.d} style={{ width: cw, flex: "none", textAlign: "center", padding: "6px 0", background: d.bg, borderRight: "1px solid oklch(0.95 0.005 160)" }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: d.wc }}>{d.wd}</div>
                          <div style={{ fontSize: 13, fontWeight: 800, color: d.fc }}>{d.n}</div>
                        </div>
                      ))}
                    </div>
                    {groups.map((g) => (
                      <div key={g.id}>
                        <div style={{ display: "flex", background: "oklch(0.975 0.008 155)", borderBottom: "1px solid oklch(0.93 0.008 160)" }}>
                          <div style={{ position: "sticky", left: 0, zIndex: 2, padding: "6px 12px", fontSize: 12, fontWeight: 800, letterSpacing: ".04em", color: "oklch(0.4 0.06 158)", background: "oklch(0.975 0.008 155)", whiteSpace: "nowrap" }}>
                            {g.name} <span style={{ fontWeight: 600, color: "oklch(0.55 0.02 160)" }}>· {g.meta}</span>
                          </div>
                        </div>
                        {g.rows.map((r) => (
                          <div key={r.id} style={{ display: "flex", borderBottom: "1px solid oklch(0.94 0.006 160)" }}>
                            <div onClick={() => { setView("day"); setDate(T); }} title={r.name} style={{ cursor: "pointer", position: "sticky", left: 0, zIndex: 2, width: labelW, flex: "none", background: "white", padding: "8px 12px", display: "flex", alignItems: "center", gap: 8, borderRight: "1px solid oklch(0.93 0.008 160)", minWidth: 0 }}>
                              <span title={HK[r.hk][0]} style={{ width: 8, height: 8, borderRadius: "50%", background: HK[r.hk][1], flex: "none" }} />
                              <span style={{ display: "flex", flexDirection: "column", minWidth: 0, lineHeight: 1.2 }}>
                                <span style={{ fontSize: mob ? 13 : 14, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
                                <span style={{ fontSize: 11, color: "oklch(0.55 0.02 160)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.cap} khách{mob ? "" : " · " + HK[r.hk][0].toLowerCase()}</span>
                              </span>
                            </div>
                            <div style={{ position: "relative", display: "flex", height: 46 }}>
                              {mDays.map((d) => (
                                <div key={d.d} className="stay-cell" onClick={() => openNew(r.id, d.d)} title={`${r.name} · ${D(d.d)} · bấm để đặt`} style={{ cursor: "pointer", width: cw, flex: "none", height: "100%", background: "transparent", borderRight: "1px solid oklch(0.95 0.005 160)" }} />
                              ))}
                              {barsOf(r.id).map((b) => (
                                <div key={b.key} className="stay-hov" onClick={b.open} title={b.tip} style={{ cursor: "pointer", position: "absolute", top: 7, bottom: 7, left: b.l, width: b.w, borderRadius: 9, background: b.bg, border: `1.5px ${b.bs} ${b.bd}`, color: b.fg, display: "flex", alignItems: "center", gap: 5, padding: "0 8px", overflow: "hidden", fontSize: 12, fontWeight: 800, whiteSpace: "nowrap", boxShadow: "0 2px 6px -3px oklch(0.2 0.03 160 / .4)", transition: "filter .15s" }}>
                                  {b.grp && <span style={{ fontSize: 10, padding: "1px 5px", borderRadius: 5, background: "oklch(1 0 0 / .3)" }}>Đoàn</span>}
                                  <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{b.label}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ fontSize: 12, color: DIM }}>Bấm ô trống để đặt phòng ngày đó · bấm thanh để xem lượt ở · chấm cạnh tên phòng là tình trạng buồng</div>
              </>
            )}

            {view === "day" && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(min(100%,230px),1fr))", gap: 10 }}>
                {dayCards.map((c) => (
                  <div key={c.id} onClick={c.go} style={{ cursor: "pointer", display: "flex", flexDirection: "column", gap: 8, padding: 14, borderRadius: 18, background: "white", border: `2px solid ${c.bd}`, animation: "stayUp .3s ease both" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-.02em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{c.name}</span>
                      <span style={pill(c.sBg, c.sFg)}>{c.status}</span>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: DIM }}>{c.type}</div>
                    <div style={{ fontSize: 15, fontWeight: 800, minHeight: 20 }}>{c.who}</div>
                    <div style={{ fontSize: 12, color: "oklch(0.45 0.02 160)", minHeight: 16 }}>{c.sub}</div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6, paddingTop: 8, borderTop: "1px dashed oklch(0.88 0.01 160)" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: c.hk[1] }} />{c.hk[0]}</span>
                      <span style={{ fontSize: 12, fontWeight: 800, color: "oklch(0.4 0.08 158)" }}>{c.cta}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {view === "year" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 700, color: DIM, flexWrap: "wrap" }}>
                  Công suất phòng · 0%{HL.map((c) => <span key={c} style={{ width: 14, height: 14, borderRadius: 4, background: c }} />)}100% · bấm ngày để xem
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(min(100%,240px),1fr))", gap: 10 }}>
                  {months.map((mo) => (
                    <div key={mo.mi} style={{ background: "white", border: `1.5px solid ${mo.bd}`, borderRadius: 18, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                      <div onClick={() => { setView("month"); setM(mo.mi); }} style={{ cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                        <span style={{ fontSize: 15, fontWeight: 800 }}>{mo.name}</span>
                        <span style={{ fontSize: 12, fontWeight: 800, color: "oklch(0.4 0.08 158)" }}>{mo.occ}</span>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,minmax(0,1fr))", gap: 3 }}>
                        {Array.from({ length: mo.offset }, (_, i) => <div key={"o" + i} />)}
                        {mo.days.map((d) => (
                          <div key={d.d} onClick={() => { setView("day"); setDate(d.d); }} title={d.tip} style={{ cursor: "pointer", aspectRatio: "1", borderRadius: 5, background: d.bg, color: d.fg, fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: d.ring }}>{d.n}</div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===== ĐƠN WEB ===== */}
        {curTab === "web" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontSize: 14, lineHeight: 1.55, color: "oklch(0.45 0.02 160)", maxWidth: 760 }}>Đơn từ Tà Xùa Booking (homestay lẻ hoặc combo) cho nhà này. Xác nhận là phòng được giữ trên lịch và báo về sàn; từ chối thì sàn tìm phòng khác cho khách.</div>
            {!webPending.length && <div style={{ padding: 30, textAlign: "center", border: "1.5px dashed oklch(0.86 0.02 160)", borderRadius: 20, background: "white", color: DIM }}>Không còn đơn web nào chờ xác nhận.</div>}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(min(100%,420px),1fr))", gap: 12 }}>
              {webPending.map((o) => {
                const single = o.roomIds.length === 1;
                const cur = webRoom[o.id] ?? o.roomIds[0];
                const typeId = roomById.get(o.roomIds[0])?.typeId;
                const opts = single ? rooms.filter((r) => r.typeId === typeId) : [];
                // Đơn sàn đã chốt có sẵn lượt ở của chính nó ⇒ không tính là trùng.
                const own = stays.find((s) => s.bookingId === o.id && isLive(s))?.id;
                return (
                  <div key={o.id} style={{ background: "white", border: "1.5px solid oklch(0.85 0.08 70)", borderRadius: 20, padding: 16, display: "flex", flexDirection: "column", gap: 10, animation: "stayUp .3s ease both" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontFamily: "ui-monospace,monospace", fontSize: 12, fontWeight: 700, color: "oklch(0.45 0.02 160)" }}>{o.code} · {o.kind}</span>
                      <span style={{ fontSize: 12, fontWeight: 800, color: "oklch(0.52 0.15 45)" }}>
                        {o.status === "CONFIRMED" ? "Sàn đã chốt cọc · phòng đang giữ trên lịch" : `Chờ ${waitH(o.createdAt)} giờ · sàn tự huỷ sau ${data.autoCancelHours} giờ nếu chưa cọc`}
                      </span>
                    </div>
                    <div style={{ fontSize: 17, fontWeight: 800 }}>{o.name} <span style={{ fontWeight: 600, color: DIM }}>· {o.phone}</span></div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {[`${D(o.ci)} → ${D(o.co)}`, `${diffDays(o.ci, o.co)} đêm`, `${o.guests} khách`, ...(single ? [typeName(typeId ?? "")] : o.roomIds.map(rName))].filter(Boolean).map((c) => (
                        <span key={c} style={{ fontSize: 12, fontWeight: 700, padding: "4px 10px", borderRadius: 999, background: "oklch(0.96 0.008 160)" }}>{c}</span>
                      ))}
                    </div>
                    {o.note && <div style={{ fontSize: 13, color: "oklch(0.45 0.02 160)" }}>“{o.note}”</div>}
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 14 }}><span style={{ color: DIM }}>Giá sàn bán · sàn đã thu</span><b>{M(o.total)} · {M(o.collected)}</b></div>
                    {single && (
                      <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 12, fontWeight: 700, color: "oklch(0.45 0.02 160)" }}>
                        Xếp vào phòng
                        <select value={cur} onChange={(e) => setWebRoom({ ...webRoom, [o.id]: e.target.value })} style={{ fontSize: 15, fontWeight: 700, padding: "10px 12px", borderRadius: 12, border: "1.5px solid oklch(0.88 0.015 160)", background: "white" }}>
                          {opts.map((r) => <option key={r.id} value={r.id}>{r.name}{free(r.id, o.ci, o.co, own) ? " · trống" : " · bận"}</option>)}
                        </select>
                      </label>
                    )}
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <div onClick={() => !busy && call({ op: "webConfirm", bookingId: o.id, roomId: single ? cur : undefined })} style={{ flex: 1, cursor: "pointer", textAlign: "center", fontSize: 14, fontWeight: 800, padding: 12, borderRadius: 999, background: G, color: "white", opacity: busy ? 0.6 : 1 }}>Xác nhận còn phòng</div>
                      <select value="" onChange={(e) => { const v = e.target.value; if (v && confirm(`Từ chối đơn ${o.code}? Sàn sẽ tìm phòng khác cho khách.`)) call({ op: "webReject", bookingId: o.id, reason: v }); }} style={{ fontSize: 13, fontWeight: 800, padding: "10px 12px", borderRadius: 999, border: "1.5px solid oklch(0.88 0.015 160)", background: "white", color: "oklch(0.5 0.17 28)" }}>
                        <option value="">Từ chối…</option>
                        <option value="Hết phòng thực tế">Hết phòng thực tế</option>
                        <option value="Đang bảo trì">Đang bảo trì</option>
                        <option value="Giá đã đổi">Giá đã đổi</option>
                        <option value="Lý do khác">Lý do khác</option>
                      </select>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ===== BUỒNG PHÒNG ===== */}
        {curTab === "hk" && (
          <div style={{ display: "grid", gridTemplateColumns: w >= 1100 ? "minmax(0,1fr) 360px" : "1fr", gap: 14, alignItems: "start" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(min(100%,250px),1fr))", gap: 10 }}>
              {hkRooms.map(({ r, h, note }) => (
                <div key={r.id} style={{ background: "white", border: `2px solid ${r.hk === "dirty" ? "oklch(0.85 0.08 28)" : "oklch(0.92 0.01 160)"}`, borderRadius: 18, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 20, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{r.name}</span>
                    <span style={pill(h[2], h[3])}>{h[0]}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "oklch(0.48 0.02 160)", minHeight: 16 }}>{note}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 4 }}>
                    {(Object.entries(HK) as [HkStatus, (typeof HK)[HkStatus]][]).map(([k, v]) => (
                      <div key={k} onClick={() => r.hk !== k && call({ op: "setHk", roomId: r.id, hk: k })} style={{ cursor: "pointer", textAlign: "center", fontSize: 11, fontWeight: 800, padding: "7px 2px", borderRadius: 9, background: r.hk === k ? v[1] : "oklch(0.96 0.005 160)", color: r.hk === k ? "white" : "oklch(0.35 0.02 160)", whiteSpace: "nowrap" }}>{v[0]}</div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <aside style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ ...sectionCard, padding: 16 }}>
                <div style={{ fontSize: 16, fontWeight: 800 }}>Cần dọn hôm nay</div>
                {!cleanList.length && <div style={{ fontSize: 13, color: DIM }}>Không có phòng cần dọn.</div>}
                {cleanList.map((c) => (
                  <div key={c.r.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 10px", borderRadius: 12, background: c.bg }}>
                    <b style={{ minWidth: 36, maxWidth: 110, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.r.name}</b>
                    <span style={{ flex: 1, fontSize: 13 }}>{c.why}</span>
                    <span style={{ fontSize: 11, fontWeight: 800, color: c.pc }}>{c.pri}</span>
                  </div>
                ))}
              </div>
              <div style={{ ...sectionCard, padding: 16 }}>
                <div style={{ fontSize: 16, fontWeight: 800 }}>Sự cố &amp; sửa chữa</div>
                {logs.map((l) => (
                  <div key={l.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13, padding: "8px 0", borderBottom: "1px solid oklch(0.94 0.006 160)" }}>
                    <span><b>{rName(l.roomId)}</b> · {l.what}<span style={{ display: "block", fontSize: 11, color: "oklch(0.55 0.02 160)" }}>{D(l.date)}</span></span>
                    <b style={{ whiteSpace: "nowrap" }}>{M(l.cost)}</b>
                  </div>
                ))}
                <div style={{ display: "grid", gridTemplateColumns: "minmax(70px,auto) minmax(0,1fr) 100px", gap: 6 }}>
                  <select value={log.room} onChange={(e) => setLog({ ...log, room: e.target.value })} style={{ fontSize: 13, padding: 8, borderRadius: 10, border: "1.5px solid oklch(0.88 0.015 160)", maxWidth: 120 }}>
                    {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                  <input value={log.what} onChange={(e) => setLog({ ...log, what: e.target.value })} placeholder="Hỏng bình nóng lạnh…" style={{ fontSize: 13, padding: "8px 10px", borderRadius: 10, border: "1.5px solid oklch(0.88 0.015 160)", minWidth: 0 }} />
                  <input value={log.cost} onChange={(e) => setLog({ ...log, cost: e.target.value })} inputMode="numeric" placeholder="Chi phí" style={{ fontSize: 13, padding: "8px 10px", borderRadius: 10, border: "1.5px solid oklch(0.88 0.015 160)", minWidth: 0 }} />
                </div>
                <div onClick={async () => { if (!log.what.trim()) return say("Ghi nội dung sự cố"); if (await call({ op: "svcLog", roomId: log.room, what: log.what, cost: digits(log.cost) })) setLog({ ...log, what: "", cost: "" }); }} style={{ cursor: "pointer", textAlign: "center", fontSize: 13, fontWeight: 800, padding: 10, borderRadius: 999, border: "1.5px solid oklch(0.85 0.04 158)", color: "oklch(0.35 0.08 158)" }}>+ Ghi sự cố (cộng vào chi phí)</div>
              </div>
            </aside>
          </div>
        )}

        {/* ===== THU CHI ===== */}
        {curTab === "ledger" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ display: "inline-flex", gap: 3, padding: 3, borderRadius: 12, background: "oklch(0.93 0.008 160)" }}>
                {([["today", "Hôm nay"], ["month", "Tháng này"]] as const).map(([k, name]) => <div key={k} onClick={() => setRange(k)} style={{ ...seg(range === k), padding: "7px 14px", boxShadow: "none" }}>{name}</div>)}
              </div>
              <div onClick={() => setExpOpen(!expOpen)} style={{ cursor: "pointer", fontSize: 13, fontWeight: 800, padding: "9px 14px", borderRadius: 999, background: G, color: "white" }}>+ Ghi khoản chi</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,160px),1fr))", gap: 10 }}>
              {[
                { k: "Đã thu", v: M(income), c: "oklch(0.55 0.12 155)", vc: "oklch(0.36 0.1 155)" },
                { k: "Chi phí", v: M(spend), c: "oklch(0.58 0.19 28)", vc: "oklch(0.5 0.17 28)" },
                { k: "Còn lại", v: M(income - spend), c: G, vc: INK },
                ...(platformIn ? [{ k: "Sàn thu hộ (chờ đối soát)", v: M(platformIn), c: "oklch(0.7 0.14 60)", vc: "oklch(0.48 0.14 55)" }] : []),
                { k: "Cọc đang giữ", v: M(held), c: "oklch(0.6 0.12 250)", vc: "oklch(0.42 0.12 250)" },
                { k: "Còn phải thu", v: M(owe), c: O, vc: "oklch(0.52 0.15 45)" },
              ].map((s) => (
                <div key={s.k} style={{ padding: "12px 16px", borderRadius: 16, background: "white", border: `1px solid ${BORDER}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: "oklch(0.45 0.02 160)" }}><span style={{ width: 9, height: 9, borderRadius: "50%", background: s.c }} />{s.k}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, marginTop: 2, color: s.vc }}>{s.v}</div>
                </div>
              ))}
            </div>
            {expOpen && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,160px),1fr))", gap: 8, padding: 14, borderRadius: 18, background: "white", border: `2px solid ${G}`, animation: "stayUp .25s ease both" }}>
                <select value={ex.cat} onChange={(e) => setEx({ ...ex, cat: e.target.value })} style={{ ...input, fontSize: 14, padding: 10 }}>{EXP_CATS.map((c) => <option key={c} value={c}>{c}</option>)}</select>
                <input value={ex.amt} onChange={(e) => setEx({ ...ex, amt: e.target.value })} inputMode="numeric" placeholder="Số tiền" style={{ ...input, fontSize: 14, padding: 10 }} />
                <input value={ex.note} onChange={(e) => setEx({ ...ex, note: e.target.value })} placeholder="Ghi chú" style={{ ...input, fontSize: 14, padding: 10 }} />
                <div onClick={async () => { const a = digits(ex.amt); if (!a) return say("Nhập số tiền"); if (await call({ op: "expense", cat: ex.cat, amt: a, note: ex.note })) { setEx({ ...ex, amt: "", note: "" }); setExpOpen(false); } }} style={{ cursor: "pointer", textAlign: "center", fontSize: 14, fontWeight: 800, padding: 10, borderRadius: 12, background: O, color: "white" }}>Lưu khoản chi</div>
              </div>
            )}
            <div style={{ background: "white", border: `1px solid ${BORDER}`, borderRadius: 20, overflow: "hidden" }}>
              {!shown.length && <div style={{ padding: 24, textAlign: "center", color: DIM, fontSize: 14 }}>Chưa có khoản thu chi nào {range === "today" ? "hôm nay" : "tháng này"}.</div>}
              {shown.slice(0, 80).map((e) => (
                <div key={e.key} onClick={e.open} style={{ cursor: e.open ? "pointer" : "default", display: "grid", gridTemplateColumns: mob ? "50px minmax(0,1fr) auto" : "90px minmax(0,1fr) 120px 120px", gap: 10, alignItems: "center", padding: "11px 16px", borderBottom: "1px solid oklch(0.94 0.006 160)" }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: DIM }}>{mob ? D(e.date).slice(0, 5) : D(e.date)}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.title}</div>
                    <div style={{ fontSize: 12, color: DIM, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.sub}</div>
                  </div>
                  {!mob && <span style={{ ...pill((MC[e.method] ?? MC.Chi)[0], (MC[e.method] ?? MC.Chi)[1]), justifySelf: "start" }}>{e.method}</span>}
                  <b style={{ textAlign: "right", whiteSpace: "nowrap", color: e.amt >= 0 ? "oklch(0.36 0.1 155)" : "oklch(0.5 0.17 28)" }}>{(e.amt > 0 ? "+" : "") + M(e.amt)}</b>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ===== KHÁCH HÀNG ===== */}
        {curTab === "cust" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <input value={cq} onChange={(e) => setCq(e.target.value)} placeholder="Tìm tên hoặc số điện thoại…" style={{ fontSize: 15, padding: "12px 16px", borderRadius: 14, border: "1.5px solid oklch(0.88 0.015 160)", maxWidth: 420 }} />
            {!custs.length && <div style={{ padding: 24, textAlign: "center", color: DIM, fontSize: 14 }}>Chưa có khách nào.</div>}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(min(100%,300px),1fr))", gap: 10 }}>
              {custs.map((c) => {
                const f = cfg.flags[c.phone];
                const tag = f === "vip" ? "Khách quen" : f === "black" ? "Danh sách đen" : c.n >= 4 ? `Ở ${c.n} lần` : "";
                return (
                  <div key={c.phone} style={{ background: "white", border: `1.5px solid ${f === "black" ? "oklch(0.85 0.08 28)" : f === "vip" ? "oklch(0.75 0.08 155)" : "oklch(0.92 0.01 160)"}`, borderRadius: 18, padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 16, fontWeight: 800 }}>{c.name}</div>
                        <a href={`tel:${c.phone}`} style={{ fontSize: 13, color: DIM }}>{c.phone}</a>
                      </div>
                      {tag && <span style={pill(f === "black" ? "oklch(0.96 0.03 28)" : "oklch(0.94 0.05 155)", f === "black" ? "oklch(0.5 0.17 28)" : "oklch(0.36 0.1 155)")}>{tag}</span>}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 6 }}>
                      {[{ k: "Lần ở", v: String(c.n) }, { k: "Tổng chi", v: short(c.spent) }, { k: "Gần nhất", v: c.last ? D(c.last) : "—" }].map((x) => (
                        <div key={x.k} style={{ padding: 8, borderRadius: 10, background: "oklch(0.975 0.006 160)" }}>
                          <div style={{ fontSize: 15, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{x.v}</div>
                          <div style={{ fontSize: 11, color: DIM }}>{x.k}</div>
                        </div>
                      ))}
                    </div>
                    {/^0\d{9}$/.test(c.phone) && (
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <div onClick={() => call({ op: "flag", phone: c.phone, flag: f === "vip" ? "" : "vip" })} style={{ cursor: "pointer", fontSize: 12, fontWeight: 800, padding: "7px 12px", borderRadius: 999, border: "1.5px solid oklch(0.88 0.015 160)" }}>{f === "vip" ? "Bỏ khách quen" : "Đánh dấu khách quen"}</div>
                        <div onClick={() => call({ op: "flag", phone: c.phone, flag: f === "black" ? "" : "black" })} style={{ cursor: "pointer", fontSize: 12, fontWeight: 800, padding: "7px 12px", borderRadius: 999, border: "1.5px solid oklch(0.88 0.05 28)", color: "oklch(0.5 0.17 28)" }}>{f === "black" ? "Gỡ danh sách đen" : "Danh sách đen"}</div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ===== BÁO CÁO ===== */}
        {curTab === "report" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <div onClick={() => shift(-1)} style={navBtn}>‹</div>
              <b style={{ fontSize: 16, minWidth: 120, textAlign: "center" }}>Tháng {m + 1}/{y}</b>
              <div onClick={() => shift(1)} style={navBtn}>›</div>
              <span style={{ fontSize: 14, color: "oklch(0.48 0.02 160)" }}>Tính theo đêm ở, không theo ngày tạo đơn · tiền phòng chia đều theo đêm{lockN ? " · đêm khoá từ Sheet/OTA không có giá nên không vào doanh thu" : ""}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,170px),1fr))", gap: 10 }}>
              {[
                { k: "Công suất phòng", v: Math.round(((sold + lockN) / avail) * 100) + "%", sub: `${sold + lockN}/${avail} đêm phòng khả dụng${lockN ? ` · gồm ${lockN} đêm khoá từ Sheet/OTA` : ""}`, c: G },
                { k: "Giá bán bình quân", v: M(sold ? roomRev / sold : 0), sub: "mỗi đêm phòng (ADR)", c: INK },
                { k: "Doanh thu / phòng khả dụng", v: M(roomRev / avail), sub: "RevPAR", c: INK },
                { k: "Doanh thu phòng", v: short(roomRev), sub: "Chưa gồm dịch vụ", c: "oklch(0.58 0.17 45)" },
                { k: "Thực nhận", v: short(roomRev - comm), sub: "Sau chiết khấu sàn " + short(comm), c: "oklch(0.36 0.1 155)" },
                { k: "Lãi sau chi phí", v: short(roomRev - comm - monthExp), sub: "Chi phí tháng " + short(monthExp), c: "oklch(0.36 0.1 155)" },
              ].map((s) => (
                <div key={s.k} style={{ padding: "14px 16px", borderRadius: 16, background: "white", border: `1px solid ${BORDER}` }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "oklch(0.45 0.02 160)" }}>{s.k}</div>
                  <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-.02em", marginTop: 2, color: s.c }}>{s.v}</div>
                  <div style={{ fontSize: 12, color: "oklch(0.52 0.02 160)" }}>{s.sub}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(min(100%,380px),1fr))", gap: 12 }}>
              {[{ title: "Doanh thu theo nguồn khách", rows: bars(bySrc, O) }, { title: "Doanh thu theo phòng", rows: bars(byRoom, "oklch(0.45 0.1 158)") }].map((g) => (
                <div key={g.title} style={{ ...sectionCard, padding: 16, gap: 10 }}>
                  <div style={{ fontSize: 16, fontWeight: 800 }}>{g.title}</div>
                  {!g.rows.length && <div style={{ fontSize: 13, color: DIM }}>Chưa có đêm ở nào trong tháng.</div>}
                  {g.rows.map((r) => (
                    <div key={r.k} style={{ display: "grid", gridTemplateColumns: "110px minmax(0,1fr) 90px", gap: 10, alignItems: "center", fontSize: 13 }}>
                      <span style={{ fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.k}</span>
                      <div style={{ height: 12, borderRadius: 6, background: "oklch(0.95 0.006 160)", overflow: "hidden" }}><div style={{ height: "100%", width: r.pct, background: r.c, borderRadius: 6 }} /></div>
                      <b style={{ textAlign: "right" }}>{r.v}</b>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ===== CÀI ĐẶT ===== */}
        {curTab === "settings" && <StaySettings data={data} call={call} say={say} busy={busy} viewerRole={viewerRole} />}
      </div>

      {dr && (
        <StayDrawer
          key={dr.kind + ("id" in dr ? dr.id : "") + (dr.kind === "new" ? (dr.room ?? "") + (dr.ci ?? "") : "")}
          dr={dr}
          setDr={setDr}
          data={data}
          call={call}
          say={say}
          busy={busy}
          mob={mob}
          serviceTitle={serviceTitle}
        />
      )}

      {toast && (
        <div style={{ position: "fixed", left: "50%", bottom: 24, transform: "translateX(-50%)", zIndex: 90, fontSize: 14, fontWeight: 700, padding: "12px 20px", borderRadius: 999, background: "oklch(0.25 0.04 160)", color: "white", boxShadow: "0 12px 30px -10px oklch(0.1 0.03 160 / .6)", animation: "stayUp .25s ease both", maxWidth: "92vw", textAlign: "center", whiteSpace: "pre-line" }}>{toast}</div>
      )}
    </div>
  );
}

const navBtn: CSSProperties = { cursor: "pointer", width: 36, height: 36, borderRadius: "50%", border: "1.5px solid oklch(0.9 0.01 160)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 800, background: "white", flex: "none" };
