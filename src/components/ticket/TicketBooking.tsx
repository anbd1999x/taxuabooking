"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "@/components/Link";
import { useLocaleRouter, useT } from "@/components/i18n/I18nProvider";
import { useSitePhone, useVoice } from "@/components/SiteContact";
import type { TFunc } from "@/lib/i18n/config";
import { DRAFT_HOLD_MIN, WEB_CONFIRM_MIN, WEB_MAX, cellType, rowName, seatClassOf, seatKey, seatName, unitWord, slotPassed, vnNow, type PubAvail, type PubVenue } from "@/lib/ticket-core";
import { DIM, G, KEYFRAMES, LINE, O, PRICE, SOFT, TYPE, ZONE_BG, dm, h2, hint, mmss, money, placeholder, section, wdOf } from "./tk";

type Food = Record<string, number>;
const HELD_BG = "repeating-linear-gradient(45deg, oklch(0.9 0.05 60) 0 3px, white 3px 6px)";
const inp: React.CSSProperties = { fontSize: 16, padding: "12px 14px", borderRadius: 12, border: "1.5px solid oklch(0.88 0.015 160)", fontFamily: "inherit", background: "white", minWidth: 0 };
const lab: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 5, fontSize: 13, fontWeight: 700 };

function Qty({ q, dec, inc, size = 36 }: { q: number; dec: () => void; inc: () => void; size?: number }) {
  const b: React.CSSProperties = { cursor: "pointer", width: size, height: size, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size / 2 + 1, fontWeight: 800, border: "none", fontFamily: "inherit", padding: 0 };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, padding: 4, borderRadius: 999, background: "oklch(0.95 0.008 160)", flex: "none" }}>
      <button type="button" onClick={dec} aria-label="−" style={{ ...b, background: "white", color: "inherit", opacity: q ? 1 : 0.35 }}>−</button>
      <span style={{ minWidth: size - 8, textAlign: "center", fontSize: 17, fontWeight: 800 }}>{q}</span>
      <button type="button" onClick={inc} aria-label="+" style={{ ...b, background: G, color: "white" }}>+</button>
    </div>
  );
}

/**
 * Đặt vé / đặt bàn — theo mẫu claude.ai/design "Ban ve - Khach": 4 bước Chọn vé → Chọn chỗ → Đồ ăn uống → Liên hệ.
 * Vé cổng bỏ bước chọn chỗ. Sang bước 3, ghế / bàn được GIỮ THẬT ở server 10 phút (đơn nháp, POST /api/ticket op hold);
 * hết giờ ⇒ nhả và quay lại chọn. Số tiền ở đây chỉ để hiển thị — server tính lại và từ chối nếu lệch (`expectedTotal`).
 */
export function TicketBooking({ venue: v, avail: a0, initialDay, base = "/ve" }: { venue: PubVenue; avail: PubAvail; initialDay: string; /** gốc đường dẫn: "/ve" hoặc "/demo/dat-ve" (bản demo) */ base?: string }) {
  const t = useT();
  const router = useLocaleRouter();
  const zalo = useSitePhone();
  const voice = useVoice();
  const T = v.kind;
  const [avail, setAvail] = useState(a0);
  const [w, setW] = useState(1280);
  const [now, setNow] = useState(() => Date.now());
  const [step, setStep] = useState(1);
  const [day, setDay] = useState(avail.days.includes(initialDay) ? initialDay : avail.days[0]);
  const gateTiers = v.tiers.filter((x) => !x.seatClass);
  const [qty, setQty] = useState<Food>(() => (T === "GATE" && gateTiers[0] ? { [gateTiers[0].id]: 2 } : {}));
  const [si, setSi] = useState(() => Math.max(0, a0.shows.findIndex((s) => s.date >= initialDay && s.free > 0 && !s.paused)));
  const [seats, setSeats] = useState<string[]>([]);
  const [zoom, setZoom] = useState(1);
  const [slot, setSlot] = useState<string | null>(null);
  const [guests, setGuests] = useState(4);
  const [tables, setTables] = useState<string[]>([]);
  const [floor, setFloor] = useState<number | "all">("all");
  const [food, setFood] = useState<Food>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [f, setF] = useState({ name: "", phone: "", email: "", note: "", arrive: "", agree: true });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  /** Đơn nháp đang giữ chỗ: khoá + hạn + các ghế / bàn nó giữ. */
  const [hold, setHold] = useState<{ token: string; until: number; keys: string[] } | null>(null);
  const holdRef = useRef(hold);
  const booked = useRef(false);
  /** Việc cần làm khi hết hạn giữ chỗ (gán trong effect để luôn là bản mới nhất). */
  const onExpire = useRef(() => {});

  const two = w >= 1040;
  const TY = TYPE[T];
  const show = avail.shows[si];
  const standTiers = T === "SHOW" ? gateTiers : [];
  const price = (cls: "vip" | "norm") => v.tiers.find((x) => x.seatClass === cls);
  const hasFood = v.menu.length > 0;

  useEffect(() => {
    const on = () => setW(window.innerWidth);
    on();
    window.addEventListener("resize", on);
    const iv = setInterval(() => {
      const n = Date.now();
      setNow(n);
      if (holdRef.current && n > holdRef.current.until) onExpire.current();
    }, 1000);
    return () => {
      window.removeEventListener("resize", on);
      clearInterval(iv);
    };
  }, []);
  useEffect(() => {
    holdRef.current = hold;
  }, [hold]);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch(`/api/ticket?slug=${encodeURIComponent(v.slug)}`, { cache: "no-store" });
      if (r.ok) setAvail((await r.json()).avail);
    } catch {
      /* mất mạng tạm thời — giữ dữ liệu cũ */
    }
  }, [v.slug]);
  // Còn chỗ thay đổi liên tục ⇒ 20 giây nạp lại một lần.
  useEffect(() => {
    const iv = setInterval(() => !document.hidden && void refresh(), 20_000);
    return () => clearInterval(iv);
  }, [refresh]);
  // Rời trang khi chưa gửi đơn ⇒ nhả chỗ đang giữ.
  useEffect(() => {
    const bye = () => {
      const h = holdRef.current;
      if (h && !booked.current) navigator.sendBeacon("/api/ticket", JSON.stringify({ op: "release", hold: h.token }));
    };
    window.addEventListener("pagehide", bye);
    return () => {
      window.removeEventListener("pagehide", bye);
      bye();
    };
  }, []);

  const mineKeys = useMemo(() => new Set(hold?.keys ?? []), [hold]);
  // Hết hạn giữ chỗ khi đang điền ⇒ nhả, quay lại bước chọn chỗ.
  useEffect(() => {
    onExpire.current = () => {
      holdRef.current = null;
      setHold(null);
      setSeats([]);
      setTables([]);
      setQty((q) => (T === "SHOW" ? {} : q));
      setStep(2);
      setErr(t("Hết {0} phút giữ chỗ nên ghế / bàn đã được nhả. Bạn chọn lại giúp mình nhé.", [DRAFT_HOLD_MIN]));
      void refresh();
    };
  }, [T, t, refresh]);

  // ---------------- Tình trạng ----------------
  const vn = vnNow(now);
  const takenSeat = (k: string) => (mineKeys.has(k) ? undefined : show?.taken[k]);
  const tableTaken = (time: string | null, id: string) => !!time && !mineKeys.has(id) && (avail.rest[`${day}|${time}`] ?? []).includes(id);
  const slotFree = (time: string) => v.tables.filter((x) => !tableTaken(time, x.id)).length;
  const gateDay = avail.gate[day];
  const gateLeft = gateDay && !gateDay.paused ? gateDay.left : 0;

  // ---------------- Tiền ----------------
  const tq = (id: string) => qty[id] ?? 0;
  const vipSeats = seats.filter((k) => seatClassOf(v.layout, k) === "vip"), normSeats = seats.filter((k) => seatClassOf(v.layout, k) === "norm");
  const myTables = v.tables.filter((x) => tables.includes(x.id));
  const capSel = myTables.reduce((n, x) => n + x.cap, 0);
  const deposit = T === "RESTAURANT" && v.policy === "deposit" ? v.amount * tables.length : 0;
  const lines: [string, string][] = [];
  let tickets = 0, listT = 0, count = 0;
  const addTier = (x: PubVenue["tiers"][number], n: number, label: string) => {
    if (!n) return;
    lines.push([label, x.price ? money(n * x.price) : t("Miễn phí")]);
    tickets += n * x.price;
    listT += n * (x.listPrice && x.listPrice > x.price ? x.listPrice : x.price);
    count += n;
  };
  // Show bán theo BÀN: ô to hơn và hiện tên bàn (P-01 / S-01) thay cho mã ghế.
  const isTable = v.seatUnit === "table", UW = unitWord(v.seatUnit);
  const sortK = (ks: string[]) => ks.slice().sort((p, q) => p.localeCompare(q, undefined, { numeric: true })).map((k) => seatName(v.layout, k, v.seatUnit)).join(", ");
  if (T === "GATE") gateTiers.forEach((x) => addTier(x, tq(x.id), `${tq(x.id)}× ${t(x.name)}`));
  if (T === "SHOW") {
    const vt = price("vip"), nt = price("norm");
    if (vt) addTier(vt, vipSeats.length, `${vipSeats.length}× ${t(vt.name)} · ${sortK(vipSeats)}`);
    if (nt) addTier(nt, normSeats.length, `${normSeats.length}× ${t(nt.name)} · ${sortK(normSeats)}`);
    standTiers.forEach((x) => addTier(x, tq(x.id), `${tq(x.id)}× ${t(x.name)}`));
  }
  if (T === "RESTAURANT" && tables.length) {
    const fl = [...new Set(myTables.map((x) => v.floors[x.floor]?.name ?? ""))].filter(Boolean).map((n) => t(n)).join(", ");
    lines.push([`${t("Bàn")} ${myTables.map((x) => x.name).join(", ")}${fl ? " · " + fl : ""} · ${t("{0} chỗ", [capSel])}`, deposit ? `${t("Cọc")} ${money(deposit)}` : t("Miễn phí")]);
    count = tables.length;
  }
  const foodTotal = v.menu.reduce((n, m) => n + (food[m.id] ?? 0) * m.price, 0);
  v.menu.forEach((m) => food[m.id] && lines.push([`${food[m.id]}× ${t(m.name)}`, money(food[m.id] * m.price)]));
  const total = T === "RESTAURANT" ? deposit + foodTotal : tickets + foodTotal;
  const payNow = v.hasBank ? (T === "SHOW" ? total : T === "RESTAURANT" ? deposit : 0) : 0;
  const payLabel = T === "RESTAURANT" ? (deposit ? (v.hasBank ? t("Cọc bàn bây giờ · món trả tại quán") : t("Quán gọi xác nhận và hướng dẫn chuyển cọc")) : t("Giữ bàn miễn phí · trả tại quán")) : T === "SHOW" && v.hasBank ? t("Chuyển khoản giữ vé") : voice(t("Thanh toán khi tụi mình gọi xác nhận"));

  // ---------------- Điều hướng ----------------
  const valid = (): string => {
    if (step === 1) {
      if (T === "GATE") {
        if (!gateLeft) return t("Ngày này đã hết vé, chọn ngày khác nhé.");
        if (!count) return t("Chọn ít nhất 1 vé.");
        if (count > gateLeft) return t("Ngày này chỉ còn {0} vé.", [gateLeft]);
      }
      if (T === "SHOW" && (!show || show.paused || !show.free)) return t("Suất này đã hết vé.");
      if (T === "RESTAURANT" && !slot) return t("Chọn khung giờ.");
    }
    if (step === 2) {
      if (T === "SHOW" && !count) return t("Chọn ít nhất 1 ghế hoặc 1 vé khu đứng.");
      if (T === "RESTAURANT") {
        if (!tables.length) return t("Chọn bàn.");
        if (capSel < guests) return t("Bàn đã chọn mới đủ {0}/{1} chỗ, chọn thêm bàn nhé.", [capSel, guests]);
      }
    }
    if (step === 3 && T === "RESTAURANT" && v.policy === "min" && foodTotal < v.amount * tables.length) return t("Mỗi bàn cần đặt trước tối thiểu {0} tiền món.", [money(v.amount)]);
    if (step === 4) {
      if (f.name.trim().length < 2) return t("Nhập họ tên.");
      if (!/^0\d{9}$/.test(f.phone.replace(/\s/g, ""))) return t("Số điện thoại chưa đúng (10 số).");
      if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) return t("Email chưa đúng, vé QR sẽ gửi về email này.");
      if (!f.agree) return t("Bạn cần đồng ý chính sách đổi/huỷ.");
    }
    return "";
  };
  const post = async (body: Record<string, unknown>) => {
    const r = await fetch("/api/ticket", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ slug: v.slug, ...body }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error ? t(j.error) : t("Có lỗi khi xử lý, thử lại giúp mình."));
    return j as { hold?: string; holdUntil?: number; token?: string };
  };
  const ticketsBody = () => (T === "GATE" ? gateTiers : standTiers).map((x) => ({ tierId: x.id, qty: tq(x.id) }));
  // Hành trình cuộn: vào trang ⇒ ở đầu trang; đổi bước ⇒ cuộn tới ĐẦU VÙNG của bước mới (chọn chỗ → đồ ăn uống → liên hệ),
  // chừa chỗ cho header dính của site. Trước đây mỗi bước đều cuộn về đầu trang ⇒ khách phải tự kéo xuống tìm.
  const stepRef = useRef<HTMLDivElement>(null);
  const firstStep = useRef(true);
  useEffect(() => {
    if (firstStep.current) {
      firstStep.current = false;
      window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior }); // Next có thể giữ / tự đặt vị trí cuộn khi chuyển từ danh sách
      return;
    }
    const el = stepRef.current;
    if (!el) return;
    const header = document.querySelector("header");
    const hb = header && getComputedStyle(header).position !== "static" ? header.getBoundingClientRect().bottom : 0;
    window.scrollTo({ top: Math.max(0, el.getBoundingClientRect().top + window.scrollY - Math.max(0, hb) - 12), behavior: "smooth" });
  }, [step]);

  async function next() {
    const e = valid();
    if (e) return setErr(e);
    if (busy) return;
    setErr("");
    if (step === 1) return setStep(T === "GATE" ? (hasFood ? 3 : 4) : 2);
    if (step === 3) return setStep(4);
    setBusy(true);
    try {
      if (step === 2) {
        const keys = T === "SHOW" ? seats : tables;
        const j = await post({ op: "hold", replace: hold?.token, date: T === "SHOW" ? show.date : day, time: T === "SHOW" ? show.time : slot, seats, tableIds: tables, tickets: ticketsBody(), guests });
        setHold({ token: j.hold!, until: j.holdUntil!, keys });
        setStep(hasFood ? 3 : 4);
      } else {
        const j = await post({
          op: "book", hold: hold?.token, date: day, tickets: ticketsBody(), guests, expectedTotal: total,
          food: v.menu.filter((m) => food[m.id]).map((m) => ({ menuId: m.id, qty: food[m.id], note: notes[m.id] ?? "" })),
          name: f.name, phone: f.phone, email: f.email, note: f.note, arrive: T === "RESTAURANT" ? f.arrive : "",
        });
        booked.current = true;
        router.push(`/ve/don/${j.token}${base === "/ve" ? "" : "?from=demo"}`);
        return; // giữ nút ở trạng thái đang gửi cho tới khi sang trang vé
      }
    } catch (x) {
      setErr(x instanceof Error ? x.message : String(x));
      void refresh();
    }
    setBusy(false);
  }
  function back() {
    setErr("");
    if (step === 1) return router.push(base);
    setStep(step === 4 && !hasFood ? (T === "GATE" ? 1 : 2) : step === 3 && T === "GATE" ? 1 : step - 1);
  }

  const stepDefs = [t("Chọn vé"), t("Chọn chỗ"), t("Đồ ăn uống"), t("Liên hệ")].map((name, i) => {
    const k = i + 1, skip = (T === "GATE" && k === 2) || (!hasFood && k === 3), done = k < step && !skip, cur = k === step;
    return { k, name, sub: skip ? t("Không cần") : k === 3 ? t("Tuỳ chọn") : "", done, cur, skip };
  });
  const stLabel = show ? `${t(wdOf(show.date))} ${dm(show.date)} · ${show.time}` : "";
  // Dòng tên show / địa điểm + ngày giờ ở đầu các bước sau — cuộn xuống vẫn thấy mình đang đặt cho show nào.
  const ctxLine = [t(v.name), T === "SHOW" ? stLabel : T === "RESTAURANT" ? [`${t(wdOf(day))} ${dm(day)}`, slot].filter(Boolean).join(" · ") : `${t(wdOf(day))} ${dm(day)}`].filter(Boolean).join(" · ");
  const ctxStyle: React.CSSProperties = { fontSize: 12, fontWeight: 800, letterSpacing: ".02em", color: "oklch(0.45 0.1 158)", marginBottom: 2 };
  const ctx = <div style={ctxStyle}>{ctxLine}</div>;
  const ctxName = <div style={ctxStyle}>{t(v.name)}</div>; // bước chọn chỗ: tiêu đề đã có ngày giờ
  const when = T === "GATE" ? [`${t(wdOf(day))}, ${dm(day)}/${day.slice(0, 4)}`, v.hours].filter(Boolean).join(" · ") : T === "SHOW" ? [stLabel, t(v.area)].filter(Boolean).join(" · ") : `${t(wdOf(day))}, ${dm(day)}${slot ? " · " + slot : ""} · ${t("{0} khách", [guests])}`;
  const cta = step === 4 ? (payNow ? t("Gửi đơn & thanh toán") : t("Gửi yêu cầu")) : step === 2 ? t("Giữ chỗ & tiếp tục") : t("Tiếp tục");
  const ctaNote = step === 2 ? t("Bấm tiếp tục, ghế/bàn được giữ riêng cho bạn {0} phút.", [DRAFT_HOLD_MIN]) : step === 4 ? (payNow ? t("Sau khi gửi, quét VietQR để thanh toán trong {0} phút (quá hạn đơn tự huỷ). Vé QR phát khi xác nhận thu tiền.", [WEB_CONFIRM_MIN]) : voice(t("Tụi mình gọi xác nhận, vé QR gửi về email.")) + " " + t("Đơn giữ chỗ {0} phút chờ xác nhận, quá hạn tự huỷ.", [WEB_CONFIRM_MIN])) : t("Giá tính lại ở máy chủ trước khi tạo đơn.");
  const holdLeft = hold ? hold.until - now : 0;
  const seatPx = Math.round((isTable ? 46 : two ? 28 : 24) * zoom), gap = Math.max(3, Math.round(5 * zoom));
  const zoneList = useMemo(() => {
    const m = new Map<string, { floor: number; zone: string; list: PubVenue["tables"] }>();
    for (const x of v.tables) {
      const key = x.floor + "|" + x.zone;
      if (!m.has(key)) m.set(key, { floor: x.floor, zone: x.zone, list: [] });
      m.get(key)!.list.push(x);
    }
    return [...m.values()];
  }, [v.tables]);
  const selFloors = [...new Set(myTables.map((x) => x.floor))];
  const groups = useMemo(() => [...new Set(v.menu.map((m) => m.group))].map((g) => ({ name: g, items: v.menu.filter((m) => m.group === g) })), [v.menu]);
  const chip = (on: boolean, off = false): React.CSSProperties => ({ flex: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: 10, borderRadius: 16, border: `2px solid ${on ? G : "oklch(0.9 0.01 160)"}`, background: on ? "oklch(0.96 0.025 155)" : "white", opacity: off ? 0.5 : 1, cursor: off ? "not-allowed" : "pointer" });

  return (
    <div style={{ display: "flex", flexDirection: "column", paddingBottom: two ? 0 : 86, color: "oklch(0.22 0.03 160)" }}>
      <style>{KEYFRAMES}</style>
      <main style={{ maxWidth: 1320, width: "100%", margin: "0 auto", padding: "18px clamp(16px,3vw,32px) 48px", display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", animation: "tkRise .35s ease both" }}>
          <div style={{ position: "relative", width: w >= 640 ? 200 : "100%", aspectRatio: "4/3", borderRadius: 16, overflow: "hidden", flex: "none" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {v.coverImage ? <img src={v.coverImage} alt={v.name} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} /> : <div style={placeholder}>{v.name}</div>}
          </div>
          <div style={{ flex: 1, minWidth: 220 }}>
            <Link href={base} style={{ fontSize: 13, fontWeight: 700, color: "oklch(0.4 0.08 160)" }}>← {t("Tất cả vé & đặt bàn")}</Link>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, fontWeight: 800, padding: "4px 10px", borderRadius: 999, background: TY[1], color: TY[2] }}>{t(TY[0])}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: DIM }}>{t(v.area)}</span>
            </div>
            <h1 style={{ margin: "6px 0 0", fontSize: "clamp(22px,2.8vw,30px)", fontWeight: 800, letterSpacing: "-.02em", lineHeight: 1.15 }}>{t(v.name)}</h1>
            {v.description && <div style={{ fontSize: 14, color: "oklch(0.45 0.02 160)", marginTop: 4, maxWidth: 720, lineHeight: 1.5 }}>{t(v.description)}</div>}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: 8, borderRadius: 18, background: "white", border: `1px solid ${LINE}`, overflowX: "auto" }}>
          {stepDefs.map((s) => (
            <div key={s.k} onClick={() => s.done && (setStep(s.k), setErr(""))} style={{ cursor: s.done ? "pointer" : "default", flex: 1, minWidth: w >= 640 ? 150 : 120, display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 12, background: s.cur ? "oklch(0.96 0.025 155)" : "transparent" }}>
              <span style={{ flex: "none", width: 26, height: 26, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, background: s.cur ? G : s.done ? "oklch(0.55 0.12 155)" : "oklch(0.93 0.01 160)", color: s.cur || s.done ? "white" : DIM }}>{s.done ? "✓" : s.k}</span>
              <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                <span style={{ fontSize: 14, fontWeight: 800, whiteSpace: "nowrap", color: s.skip ? "oklch(0.65 0.01 160)" : "oklch(0.25 0.03 160)", textDecoration: s.skip ? "line-through" : "none" }}>{s.name}</span>
                {s.sub && <span style={{ fontSize: 11, fontWeight: 600, color: "oklch(0.55 0.02 160)", whiteSpace: "nowrap" }}>{s.sub}</span>}
              </span>
            </div>
          ))}
        </div>

        <div ref={stepRef} style={{ display: "grid", gridTemplateColumns: two ? "minmax(0,1fr) 380px" : "1fr", gap: 18, alignItems: "start", scrollMarginTop: 80 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
            {/* ---------- BƯỚC 1: VÉ CỔNG ---------- */}
            {step === 1 && T === "GATE" && (
              <section style={section}>
                <div>
                  <div style={h2}>{t("Ngày tham quan")}</div>
                  {v.hours && <div style={hint}>{t("Giờ mở cửa {0}", [v.hours])}</div>}
                </div>
                <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2 }}>
                  {avail.days.map((d) => {
                    const g = avail.gate[d], n = g && !g.paused ? g.left : 0;
                    return (
                      <div key={d} onClick={() => n && (setDay(d), setErr(""))} style={{ ...chip(day === d, !n), minWidth: 84 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: DIM }}>{t(wdOf(d))}</span>
                        <span style={{ fontSize: 17, fontWeight: 800 }}>{dm(d)}</span>
                        <span style={{ fontSize: 11, fontWeight: 800, whiteSpace: "nowrap", color: !n ? "oklch(0.5 0 0)" : n < 30 ? "oklch(0.55 0.15 45)" : "oklch(0.42 0.1 155)" }}>{g?.paused ? t("Tạm đóng") : n ? t("Còn {0}", [n]) : t("Hết vé")}</span>
                      </div>
                    );
                  })}
                </div>
                <div style={h2}>{t("Số lượng vé")}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {gateTiers.map((x) => {
                    const q = tq(x.id);
                    return (
                      <div key={x.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 14px", borderRadius: 16, border: `1.5px solid ${q ? G : LINE}`, background: q ? "oklch(0.975 0.015 155)" : "white" }}>
                        <div style={{ flex: 1, minWidth: 0, fontSize: 16, fontWeight: 800 }}>{t(x.name)}</div>
                        <div style={{ textAlign: "right" }}>
                          {x.listPrice != null && x.listPrice > x.price && <div style={{ fontSize: 12, color: "oklch(0.55 0.02 160)", textDecoration: "line-through" }}>{money(x.listPrice)}</div>}
                          <div style={{ fontSize: 16, fontWeight: 800, color: PRICE, whiteSpace: "nowrap" }}>{x.price ? money(x.price) : t("Miễn phí")}</div>
                        </div>
                        <Qty q={q} dec={() => q && setQty({ ...qty, [x.id]: q - 1 })} inc={() => count < WEB_MAX.GATE && (setQty({ ...qty, [x.id]: q + 1 }), setErr(""))} />
                      </div>
                    );
                  })}
                </div>
                <Notes list={[...v.notes, t("Mỗi đơn tối đa {0} vé", [WEB_MAX.GATE])]} t={t} />
              </section>
            )}

            {/* ---------- BƯỚC 1: SHOW ---------- */}
            {step === 1 && T === "SHOW" && (
              <section style={section}>
                {v.artist && (
                  <div style={{ padding: 12, borderRadius: 16, background: SOFT }}>
                    <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".08em", color: "oklch(0.5 0.1 158)" }}>{t("NGHỆ SĨ")}</div>
                    <div style={{ fontSize: 16, fontWeight: 800 }}>{t(v.artist)}</div>
                    {v.hours && <div style={hint}>{t(v.hours)}</div>}
                  </div>
                )}
                <div style={h2}>{t("Chọn suất diễn")}</div>
                {!avail.shows.length && <div style={hint}>{t("Chưa có suất diễn nào đang mở bán.")}</div>}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(min(100%,200px),1fr))", gap: 10 }}>
                  {avail.shows.map((s, i) => {
                    const n = s.paused ? 0 : s.free, on = si === i, lc = !n ? "oklch(0.55 0 0)" : n < 20 ? O : "oklch(0.5 0.12 155)";
                    return (
                      <div key={s.date + s.time} onClick={() => n && (setSi(i), on || (setSeats([]), setQty({})), setErr(""))} style={{ cursor: n ? "pointer" : "not-allowed", padding: "14px 16px", borderRadius: 18, border: `2px solid ${on ? G : "oklch(0.9 0.01 160)"}`, background: on ? "oklch(0.96 0.025 155)" : "white", opacity: n ? 1 : 0.5, display: "flex", flexDirection: "column", gap: 4 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: DIM }}>{t(wdOf(s.date))}, {dm(s.date)}</span>
                          {on && <span style={{ width: 22, height: 22, borderRadius: "50%", background: G, color: "white", fontSize: 12, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>✓</span>}
                        </div>
                        <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-.02em", lineHeight: 1 }}>{s.time}</div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: lc }}>{n ? t("Còn {0}/{1} chỗ", [n, s.total]) : s.paused ? t("Tạm dừng bán") : t("Hết vé")}</div>
                        <div style={{ height: 5, borderRadius: 3, background: "oklch(0.93 0.01 160)", overflow: "hidden", marginTop: 4 }}>
                          <div style={{ height: "100%", width: `${Math.round((1 - n / Math.max(1, s.total)) * 100)}%`, background: lc }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,180px),1fr))", gap: 8 }}>
                  {v.tiers.map((x) => {
                    const c = x.seatClass === "vip" ? ["oklch(0.95 0.06 75)", "oklch(0.72 0.13 60)"] : x.seatClass === "norm" ? ["oklch(0.95 0.035 155)", "oklch(0.66 0.09 155)"] : ["oklch(0.93 0.04 250)", "oklch(0.62 0.1 250)"];
                    return (
                      <div key={x.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 14, border: `1px solid ${LINE}` }}>
                        <span style={{ width: 14, height: 14, borderRadius: 4, background: c[0], border: `1.5px solid ${c[1]}`, flex: "none" }} />
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 800 }}>{x.seatClass ? (isTable ? t("Bàn {0}", [t(x.name)]) : t("Ghế {0}", [t(x.name)])) : t(x.name)}</div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: PRICE }}>{money(x.price)}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {v.notes.length > 0 && <Notes list={v.notes} t={t} />}
              </section>
            )}

            {/* ---------- BƯỚC 1: NHÀ HÀNG ---------- */}
            {step === 1 && T === "RESTAURANT" && (
              <section style={section}>
                <div style={h2}>{t("Ngày")}</div>
                <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2 }}>
                  {avail.days.map((d) => (
                    <div key={d} onClick={() => (setDay(d), setTables([]), setSlot(null))} style={{ ...chip(day === d), minWidth: 72 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: DIM }}>{t(wdOf(d))}</span>
                      <span style={{ fontSize: 17, fontWeight: 800 }}>{dm(d)}</span>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <div style={h2}>{t("Khung giờ")}</div>
                  {v.hours && <span style={hint}>{t("Giờ mở cửa {0}", [v.hours])}</span>}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(min(100%,104px),1fr))", gap: 8 }}>
                  {v.slots.map((time) => {
                    const past = slotPassed(day, time, vn.today, vn.now), n = past ? 0 : slotFree(time), on = slot === time;
                    return (
                      <div key={time} onClick={() => n && (setSlot(time), setTables([]), setErr(""))} style={{ cursor: n ? "pointer" : "not-allowed", display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: 10, borderRadius: 14, border: `2px solid ${on ? G : "oklch(0.9 0.01 160)"}`, background: on ? G : "white", color: on ? "white" : "oklch(0.25 0.03 160)", opacity: n ? 1 : 0.45 }}>
                        <span style={{ fontSize: 17, fontWeight: 800 }}>{time}</span>
                        <span style={{ fontSize: 11, fontWeight: 800, opacity: 0.8, whiteSpace: "nowrap" }}>{past ? t("Đã qua") : n ? t("còn {0} bàn", [n]) : t("Kín")}</span>
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 16, background: SOFT }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 800 }}>{t("Số khách")}</div>
                    <div style={hint}>{t("Đoàn đông chọn nhiều bàn ở bước sau")}</div>
                  </div>
                  <Qty q={guests} dec={() => setGuests(Math.max(1, guests - 1))} inc={() => setGuests(Math.min(60, guests + 1))} />
                </div>
                {v.notes.length > 0 && <Notes list={v.notes} t={t} />}
              </section>
            )}

            {/* ---------- BƯỚC 2: SƠ ĐỒ GHẾ ---------- */}
            {step === 2 && T === "SHOW" && show && (
              <section style={{ ...section, gap: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <div>
                    {ctxName}
                    <div style={h2}>{isTable ? t("Chọn bàn") : t("Chọn ghế")} · {stLabel}</div>
                    <div style={hint}>{isTable ? t("Bấm vào bàn trống để chọn, bấm lại để bỏ · mỗi bàn 2–4 người") : t("Bấm vào ghế trống để chọn, bấm lại để bỏ")}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    {([["−", -0.2], ["+", 0.2]] as const).map(([s, d], i) => (
                      <span key={s} style={{ display: "contents" }}>
                        {i === 1 && <span style={{ fontSize: 12, fontWeight: 700, minWidth: 44, textAlign: "center", color: DIM }}>{Math.round(zoom * 100)}%</span>}
                        <button type="button" onClick={() => setZoom(Math.min(1.6, Math.max(0.6, +(zoom + d).toFixed(1))))} style={{ cursor: "pointer", width: 34, height: 34, borderRadius: 10, border: "1.5px solid oklch(0.9 0.01 160)", background: "white", fontSize: 18, fontWeight: 800, fontFamily: "inherit" }}>{s}</button>
                      </span>
                    ))}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  {([[t("VIP trống"), "oklch(0.95 0.06 75)", "oklch(0.72 0.13 60)"], [t("Thường trống"), "oklch(0.95 0.035 155)", "oklch(0.66 0.09 155)"], [t("Ghế của bạn"), G, G], [t("Người khác đang giữ"), HELD_BG, "oklch(0.78 0.1 60)"], [t("Đã bán"), "oklch(0.87 0.005 160)", "oklch(0.87 0.005 160)"]] as const).map(([name, bg, bd]) => (
                    <span key={name} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "oklch(0.4 0.02 160)", whiteSpace: "nowrap" }}>
                      <span style={{ width: 14, height: 14, borderRadius: "4px 4px 2px 2px", background: bg, border: `1.5px solid ${bd}` }} />
                      {name}
                    </span>
                  ))}
                </div>
                <div style={{ overflow: "auto", borderRadius: 16, background: "oklch(0.975 0.008 160)", padding: "16px 12px 18px", maxHeight: two ? 520 : 420 }}>
                  <div style={{ width: "max-content", margin: "0 auto", display: "flex", flexDirection: "column", alignItems: "center", gap }}>
                    <div style={{ width: "78%", marginBottom: 14, padding: "8px 0", borderRadius: "0 0 60px 60px / 0 0 22px 22px", background: "linear-gradient(180deg, oklch(0.35 0.06 158), oklch(0.29 0.055 160))", color: "white", textAlign: "center", fontSize: 12, fontWeight: 800, letterSpacing: ".2em" }}>{t("SÂN KHẤU")}</div>
                    {Array.from({ length: v.layout.rows }, (_, r) => (
                      <div key={r} style={{ display: "flex", alignItems: "center", gap }}>
                        <span style={{ width: 18, textAlign: "center", fontSize: 11, fontWeight: 800, color: "oklch(0.55 0.02 160)" }}>{rowName(r)}</span>
                        {Array.from({ length: v.layout.cols }, (_, c) => {
                          const ct = cellType(v.layout, r, c), k = seatKey(r, c);
                          if (ct === "aisle" || ct === "empty" || ct === "broken") return <span key={c} style={{ width: ct === "aisle" ? Math.round(seatPx * 0.7) : seatPx, height: seatPx }} />;
                          const vip = ct === "vip", st = seats.includes(k) ? "mine" : (takenSeat(k) ?? "free"), tier = price(vip ? "vip" : "norm");
                          const bg = st === "mine" ? G : st === "sold" ? "oklch(0.87 0.005 160)" : st === "held" ? HELD_BG : vip ? "oklch(0.95 0.06 75)" : "oklch(0.95 0.035 155)";
                          const bd = st === "mine" ? G : st === "sold" ? "oklch(0.87 0.005 160)" : st === "held" ? "oklch(0.78 0.1 60)" : vip ? "oklch(0.72 0.13 60)" : "oklch(0.66 0.09 155)";
                          return (
                            <div key={c} className="tk-seat" title={`${t(UW)} ${seatName(v.layout, k, v.seatUnit)}${tier ? ` · ${t(tier.name)} ${money(tier.price)}` : ""}${st === "sold" ? " · " + t("đã bán") : st === "held" ? " · " + t("người khác đang giữ") : ""}`}
                              onClick={() => {
                                if (st === "sold" || st === "held" || !tier) return;
                                if (st === "mine") return setSeats(seats.filter((x) => x !== k)), setErr("");
                                if (count >= WEB_MAX.SHOW) return setErr(t("Mỗi đơn tối đa {0} vé.", [WEB_MAX.SHOW]));
                                setSeats([...seats, k]);
                                setErr("");
                              }}
                              style={{ cursor: st === "free" || st === "mine" ? "pointer" : "not-allowed", width: seatPx, height: isTable ? Math.round(seatPx * 0.74) : seatPx, borderRadius: isTable ? 10 : "7px 7px 3px 3px", background: bg, border: `1.5px solid ${bd}`, color: isTable && st !== "mine" ? (st === "sold" ? "oklch(0.6 0.01 160)" : "oklch(0.3 0.04 160)") : "white", fontSize: isTable ? 10 : 9, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>
                              {isTable ? seatName(v.layout, k, v.seatUnit) : st === "mine" ? c + 1 : ""}
                            </div>
                          );
                        })}
                        <span style={{ width: 18, textAlign: "center", fontSize: 11, fontWeight: 800, color: "oklch(0.55 0.02 160)" }}>{rowName(r)}</span>
                      </div>
                    ))}
                  </div>
                </div>
                {standTiers.map((x) => {
                  const q = tq(x.id), left = show.standLeft[x.id];
                  return (
                    <div key={x.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 14px", borderRadius: 16, border: `1.5px solid ${q ? G : LINE}` }}>
                      <span style={{ width: 14, height: 14, borderRadius: 4, background: "oklch(0.93 0.04 250)", border: "1.5px solid oklch(0.62 0.1 250)", flex: "none" }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 15, fontWeight: 800 }}>{t(x.name)}</div>
                        <div style={hint}>{t("Không số ghế")}{left != null && ` · ${t("còn {0} vé", [Math.max(0, left - q)])}`} · <b style={{ color: PRICE }}>{money(x.price)}</b></div>
                      </div>
                      <Qty size={34} q={q} dec={() => q && setQty({ ...qty, [x.id]: q - 1 })} inc={() => count < WEB_MAX.SHOW && (left == null || q < left) && (setQty({ ...qty, [x.id]: q + 1 }), setErr(""))} />
                    </div>
                  );
                })}
              </section>
            )}

            {/* ---------- BƯỚC 2: SƠ ĐỒ BÀN ---------- */}
            {step === 2 && T === "RESTAURANT" && (
              <section style={{ ...section, gap: 14 }}>
                <div>
                  {ctxName}
                  <div style={h2}>{t("Chọn bàn")} · {dm(day)} · {slot} · {t("{0} khách", [guests])}</div>
                  <div style={hint}>{t("Đoàn đông có thể chọn nhiều bàn gần nhau")}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 14, background: capSel >= guests ? "oklch(0.96 0.03 155)" : "oklch(0.97 0.04 70)" }}>
                  <div style={{ flex: 1, height: 8, borderRadius: 4, background: "oklch(1 0 0 / .85)", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${Math.min(100, Math.round((capSel / guests) * 100))}%`, background: capSel >= guests ? "oklch(0.55 0.12 155)" : O, transition: "width .3s" }} />
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 800, color: capSel >= guests ? "oklch(0.36 0.09 155)" : "oklch(0.5 0.15 45)", whiteSpace: "nowrap" }}>
                    {!tables.length ? t("Chưa chọn bàn · cần {0} chỗ", [guests]) : capSel >= guests ? t("Đủ {0}/{1} chỗ · {2} bàn", [capSel, guests, tables.length]) : t("Đủ {0}/{1} · thiếu {2}", [capSel, guests, guests - capSel])}
                  </span>
                </div>
                {v.floors.length > 1 && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,150px),1fr))", gap: 6 }}>
                    {[{ k: "all" as const, name: t("Tất cả tầng"), sub: t("Xem toàn bộ") }, ...v.floors.map((x, i) => ({ k: i, name: t(x.name), sub: x.sub ? t(x.sub) : "" }))].map((x) => {
                      const ts = v.tables.filter((y) => x.k === "all" || y.floor === x.k), fr = ts.filter((y) => !tableTaken(slot, y.id)).length, mine = ts.filter((y) => tables.includes(y.id)).length, on = floor === x.k;
                      return (
                        <div key={x.k} onClick={() => setFloor(x.k)} style={{ cursor: "pointer", display: "flex", flexDirection: "column", gap: 2, padding: "10px 12px", borderRadius: 14, border: `2px solid ${on ? G : "oklch(0.9 0.01 160)"}`, background: on ? "oklch(0.96 0.025 155)" : "white" }}>
                          <span style={{ fontSize: 15, fontWeight: 800 }}>{x.name}</span>
                          {x.sub && <span style={{ fontSize: 11, lineHeight: 1.35, color: DIM }}>{x.sub}</span>}
                          <span style={{ fontSize: 12, fontWeight: 800, color: mine ? "oklch(0.38 0.1 155)" : fr ? "oklch(0.45 0.02 160)" : "oklch(0.55 0.17 28)", marginTop: 2 }}>{mine ? t("{0} bàn của bạn", [mine]) : t("Còn {0} bàn", [fr])}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
                {selFloors.length > 1 && <div style={{ fontSize: 13, lineHeight: 1.5, padding: "10px 14px", borderRadius: 14, background: "oklch(0.97 0.04 70)", color: "oklch(0.45 0.12 50)" }}>{t("Bàn bạn chọn nằm ở {0} tầng khác nhau. Đoàn muốn ngồi gần nhau nên chọn cùng một tầng.", [selFloors.length])}</div>}
                {zoneList.filter((z) => floor === "all" || z.floor === floor).map((z, zi) => (
                  <div key={z.floor + z.zone} style={{ display: "flex", flexDirection: "column", gap: 10, padding: 14, borderRadius: 18, background: ZONE_BG[zi % ZONE_BG.length] }}>
                    <span style={{ fontSize: 15, fontWeight: 800 }}>{floor === "all" && v.floors.length > 1 ? t(v.floors[z.floor]?.name ?? "") + " · " : ""}{t(z.zone)}</span>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      {z.list.map((x) => {
                        const bk = tableTaken(slot, x.id), on = tables.includes(x.id);
                        return (
                          <div key={x.id} className="tk-table" title={`${x.name} · ${t("{0} chỗ", [x.cap])}${bk ? " · " + t("đã có khách") : ""}`}
                            onClick={() => {
                              if (bk) return;
                              if (!on && tables.length >= WEB_MAX.RESTAURANT) return setErr(t("Mỗi đơn tối đa {0} bàn — đoàn lớn hơn vui lòng gọi quán.", [WEB_MAX.RESTAURANT]));
                              setTables(on ? tables.filter((y) => y !== x.id) : [...tables, x.id]);
                              setErr("");
                            }}
                            style={{ cursor: bk ? "not-allowed" : "pointer", width: x.cap <= 2 ? 66 : x.cap <= 4 ? 84 : x.cap <= 6 ? 104 : x.cap <= 8 ? 124 : 150, height: 66, borderRadius: x.round && x.cap <= 4 ? 999 : 16, border: `2px solid ${on ? G : bk ? "oklch(0.9 0.005 160)" : "oklch(0.7 0.08 155)"}`, background: on ? G : bk ? "oklch(0.93 0.004 160)" : "white", color: on ? "white" : bk ? "oklch(0.55 0.01 160)" : "oklch(0.25 0.03 160)", opacity: bk ? 0.6 : 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1 }}>
                            <span style={{ fontSize: 14, fontWeight: 800 }}>{x.name}</span>
                            <span style={{ fontSize: 11, fontWeight: 700, opacity: 0.8, whiteSpace: "nowrap" }}>{bk ? t("Đã đặt") : t("{0} chỗ", [x.cap])}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </section>
            )}

            {/* ---------- BƯỚC 3: ĐỒ ĂN UỐNG ---------- */}
            {step === 3 && (
              <section style={{ ...section, gap: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
                  <div>
                    {ctx}
                    <div style={h2}>{T === "RESTAURANT" ? t("Đặt món trước") : t("Đồ ăn uống kèm")}</div>
                    <div style={hint}>{T === "RESTAURANT" ? t("Bếp chuẩn bị sẵn, lên món ngay khi bạn tới") : t("Nhận tại quầy bằng mã QR, không phải xếp hàng")}</div>
                  </div>
                  {!(T === "RESTAURANT" && v.policy === "min") && <span onClick={next} style={{ cursor: "pointer", fontSize: 13, fontWeight: 800, color: "oklch(0.4 0.08 160)", whiteSpace: "nowrap" }}>{t("Bỏ qua")}</span>}
                </div>
                {T === "RESTAURANT" && (
                  <div style={{ fontSize: 13, lineHeight: 1.5, padding: "10px 14px", borderRadius: 14, background: "oklch(0.97 0.03 80)", color: "oklch(0.42 0.08 55)" }}>
                    {v.policy === "deposit" ? t("Quán thu cọc {0}/bàn để giữ chỗ. Đặt món trước không bắt buộc, tiền món trả tại quán.", [money(v.amount)]) : v.policy === "min" ? t("Mỗi bàn cần đặt trước tối thiểu {0} tiền món. Tiền món trả tại quán.", [money(v.amount)]) : t("Giữ bàn miễn phí, quán gọi xác nhận. Món đặt trước trả tại quán.")}
                  </div>
                )}
                {groups.map((g) => (
                  <div key={g.name} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {g.name && <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".08em", color: "oklch(0.5 0.08 158)", textTransform: "uppercase" }}>{t(g.name)}</div>}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(min(100%,290px),1fr))", gap: 8 }}>
                      {g.items.map((m) => {
                        const q = food[m.id] ?? 0;
                        return (
                          <div key={m.id} style={{ display: "flex", flexDirection: "column", gap: 8, padding: 10, borderRadius: 16, border: `1.5px solid ${q ? G : LINE}`, background: q ? "oklch(0.975 0.015 155)" : "white" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                              {m.images[0] && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={m.images[0]} alt="" loading="lazy" style={{ width: 64, height: 64, borderRadius: 12, objectFit: "cover", flex: "none" }} />
                              )}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 15, fontWeight: 800, lineHeight: 1.3 }}>{t(m.name)}</div>
                                {m.desc && <div style={{ fontSize: 12, color: DIM }}>{t(m.desc)}</div>}
                                <div style={{ fontSize: 14, fontWeight: 800, color: PRICE, marginTop: 2 }}>{money(m.price)}</div>
                              </div>
                              <Qty size={32} q={q} dec={() => q && setFood({ ...food, [m.id]: q - 1 })} inc={() => q < 50 && (setFood({ ...food, [m.id]: q + 1 }), setErr(""))} />
                            </div>
                            {T === "RESTAURANT" && q > 0 && <input value={notes[m.id] ?? ""} maxLength={120} onChange={(e) => setNotes({ ...notes, [m.id]: e.target.value })} placeholder={t("Ghi chú món (ít cay, không hành…)")} style={{ ...inp, fontSize: 13, padding: "8px 12px", borderRadius: 10 }} />}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </section>
            )}

            {/* ---------- BƯỚC 4: LIÊN HỆ ---------- */}
            {step === 4 && (
              <section style={{ ...section, gap: 12 }}>
                <div>
                  {ctx}
                  <div style={h2}>{t("Thông tin liên hệ")}</div>
                  <div style={hint}>{t("Vé QR gửi về email này, kèm tin nhắn Zalo")}</div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,240px),1fr))", gap: 10 }}>
                  <label style={lab}>{t("Họ và tên")} *<input value={f.name} autoComplete="name" onChange={(e) => (setF({ ...f, name: e.target.value }), setErr(""))} placeholder="Nguyễn Văn A" style={inp} /></label>
                  <label style={lab}>{t("Số điện thoại / Zalo")} *<input value={f.phone} inputMode="tel" autoComplete="tel" onChange={(e) => (setF({ ...f, phone: e.target.value }), setErr(""))} placeholder="09xx xxx xxx" style={inp} /></label>
                  <label style={lab}>{t("Email nhận vé")} *<input value={f.email} inputMode="email" autoComplete="email" onChange={(e) => (setF({ ...f, email: e.target.value }), setErr(""))} placeholder="ban@gmail.com" style={inp} /></label>
                  {T === "RESTAURANT" && (
                    <label style={lab}>{t("Giờ đến dự kiến")}
                      <select value={f.arrive} onChange={(e) => setF({ ...f, arrive: e.target.value })} style={inp}>
                        {[["", slot ?? ""], ["Sớm 15 phút", t("Sớm 15 phút")], ["Muộn 15 phút", t("Muộn 15 phút")], ["Muộn 30 phút", t("Muộn 30 phút")]].map(([val, name]) => <option key={val} value={val}>{name}</option>)}
                      </select>
                    </label>
                  )}
                </div>
                <label style={lab}>{t("Ghi chú")}<textarea value={f.note} rows={2} maxLength={400} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder={t("Có trẻ nhỏ, cần ghế em bé, đến muộn…")} style={{ ...inp, fontSize: 15, resize: "vertical" }} /></label>
                <label style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13, lineHeight: 1.5, cursor: "pointer", color: "oklch(0.38 0.02 160)" }}>
                  <input type="checkbox" checked={f.agree} onChange={() => setF({ ...f, agree: !f.agree })} style={{ width: 18, height: 18, marginTop: 1, accentColor: "oklch(0.35 0.08 158)" }} />
                  {t("Tôi đã đọc chính sách đổi/huỷ của {0}. Huỷ hoặc đổi vé liên hệ Zalo {1}.", [t(v.name), zalo])}
                </label>
              </section>
            )}

            {err && <div style={{ fontSize: 14, fontWeight: 700, padding: "12px 14px", borderRadius: 14, background: "oklch(0.96 0.03 28)", color: "oklch(0.5 0.17 28)" }}>{err}</div>}
            {two && step > 1 && <div><button type="button" onClick={back} style={{ cursor: "pointer", fontSize: 15, fontWeight: 800, padding: "14px 20px", borderRadius: 999, border: "1.5px solid oklch(0.88 0.015 160)", background: "transparent", fontFamily: "inherit", color: "inherit" }}>← {t("Quay lại")}</button></div>}
          </div>

          {/* ---------- ĐƠN CỦA BẠN ---------- */}
          <aside style={{ position: two ? "sticky" : "static", top: 84, display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ background: "white", border: `1px solid ${LINE}`, borderRadius: 22, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                <div style={{ fontSize: 16, fontWeight: 800 }}>{t("Đơn của bạn")}</div>
                {hold && step >= 3 && (
                  <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 800, padding: "5px 10px", borderRadius: 999, background: holdLeft < 120000 ? "oklch(0.96 0.04 28)" : "oklch(0.97 0.04 70)", color: holdLeft < 120000 ? "oklch(0.5 0.17 28)" : "oklch(0.5 0.15 45)", whiteSpace: "nowrap" }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: "currentColor", animation: "tkPulse 1s infinite" }} />
                    {t("Giữ chỗ {0}", [mmss(holdLeft)])}
                  </span>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, padding: "10px 12px", borderRadius: 14, background: SOFT }}>
                <div style={{ fontSize: 14, fontWeight: 800, lineHeight: 1.35 }}>{t(v.name)}</div>
                <div style={{ fontSize: 13, color: "oklch(0.45 0.02 160)" }}>{when}</div>
              </div>
              {!lines.length && <div style={{ fontSize: 14, color: DIM }}>{t("Chưa chọn gì.")}</div>}
              {lines.map(([k, val], i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 14, lineHeight: 1.45 }}>
                  <span style={{ color: "oklch(0.35 0.02 160)" }}>{k}</span>
                  <b style={{ whiteSpace: "nowrap" }}>{val}</b>
                </div>
              ))}
              <div style={{ borderTop: "1px dashed oklch(0.86 0.01 160)", paddingTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>{t("Tạm tính")}</span>
                  <span style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-.02em", color: "oklch(0.6 0.19 40)" }}>{money(total)}</span>
                </div>
                {listT > tickets && <div style={{ fontSize: 12, fontWeight: 800, color: "oklch(0.4 0.1 155)", textAlign: "right" }}>{t("Rẻ hơn giá niêm yết {0}", [money(listT - tickets)])}</div>}
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13, padding: "8px 10px", borderRadius: 10, background: "oklch(0.97 0.03 80)", color: "oklch(0.42 0.08 55)" }}>
                  <span>{payLabel}</span>
                  <b style={{ whiteSpace: "nowrap" }}>{money(payNow)}</b>
                </div>
              </div>
              {two && (
                <>
                  <button type="button" onClick={next} disabled={busy} style={{ cursor: "pointer", textAlign: "center", fontSize: 17, fontWeight: 800, padding: 15, borderRadius: 999, background: step === 4 ? O : G, color: "white", border: "none", fontFamily: "inherit", opacity: busy ? 0.6 : 1 }}>{busy ? t("Đang xử lý…") : cta}</button>
                  <div style={{ fontSize: 12, lineHeight: 1.5, color: DIM, textAlign: "center" }}>{ctaNote}</div>
                </>
              )}
            </div>
          </aside>
        </div>
      </main>

      {!two && (
        <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 40, background: "white", borderTop: `1px solid ${LINE}`, boxShadow: "0 -10px 30px -16px oklch(0.2 0.04 160 / .35)", padding: "10px 14px calc(10px + env(safe-area-inset-bottom))", display: "flex", alignItems: "center", gap: 10 }}>
          <button type="button" onClick={back} aria-label={t("Quay lại")} style={{ cursor: "pointer", width: 46, height: 46, borderRadius: "50%", border: "1.5px solid oklch(0.88 0.015 160)", background: "white", fontSize: 18, fontWeight: 800, flex: "none", fontFamily: "inherit", color: "inherit" }}>←</button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: DIM, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {hold && step >= 3 ? t("Giữ chỗ {0}", [mmss(holdLeft)]) + " · " : ""}
              {count ? (T === "RESTAURANT" ? t("{0} bàn", [count]) : t("{0} vé", [count])) + (foodTotal ? " · " + t("có đồ ăn") : "") : t("Chưa chọn")}
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "oklch(0.6 0.19 40)", lineHeight: 1.1 }}>{money(total)}</div>
          </div>
          <button type="button" onClick={next} disabled={busy} style={{ cursor: "pointer", fontSize: 15, fontWeight: 800, padding: "13px 18px", borderRadius: 999, background: step === 4 ? O : G, color: "white", whiteSpace: "nowrap", border: "none", fontFamily: "inherit", opacity: busy ? 0.6 : 1 }}>{busy ? "…" : step === 4 ? t("Gửi đơn") : t("Tiếp tục")}</button>
        </div>
      )}
      <style>{".tk-seat{transition:transform .12s}.tk-seat:hover{transform:scale(1.12)}.tk-table{transition:transform .12s}.tk-table:hover{transform:translateY(-2px)}"}</style>
    </div>
  );
}

function Notes({ list, t }: { list: string[]; t: TFunc }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "12px 14px", borderRadius: 14, background: SOFT }}>
      {list.map((x, i) => (
        <div key={i} style={{ fontSize: 13, lineHeight: 1.5, color: "oklch(0.38 0.02 160)", paddingLeft: 14, position: "relative" }}>
          <span style={{ position: "absolute", left: 0, top: 7, width: 5, height: 5, borderRadius: "50%", background: "oklch(0.55 0.1 158)" }} />
          {t(x)}
        </div>
      ))}
    </div>
  );
}
