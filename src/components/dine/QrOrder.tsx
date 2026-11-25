"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { DINE_CATS, DINE_NOTE_CHIPS, DINE_STAFF_NEEDS, hm, isFee, money, type DineCustomer, type DineGuest, type DineStatus } from "@/lib/dine-core";
import { QR_LANGS, qrT, type QrLang, type QrTF } from "./qr-i18n";

// Bố cục theo mẫu, màu theo thương hiệu Tà Xùa Booking: xanh núi rừng (forest) chủ đạo, cam (sunset) cho nút hành động chính + giá.
const INK = "#16241d";
const G = "#226e4b"; // xanh chủ đạo (nút +, chip, viền nhấn)
const O = "#ea580c"; // nút hành động chính
const PRICE = "#1b583d"; // chữ nhấn (xanh thương hiệu)
const MONEY = "#c2410c"; // giá tiền (cam điểm nhấn)
const DIM = "#64748b";
const LINE = "#e2e8f0";
const BG = "#f6f8f7";
const CREAM = "#f0f9f3";
const CREAM2 = "#dcf0e2";
const GRAD = "linear-gradient(100deg,#226e4b 0%,#1b583d 55%,#164632 100%)";
/** [nhãn, nền, chữ, bước] */
const SS: Record<Exclude<DineStatus, "paid" | "cancel">, [string, string, string, number]> = {
  new: ["Đã gửi bếp", "#fef3c7", "#b45309", 0],
  cooking: ["Bếp đang làm", "#dbeafe", "#1d4ed8", 1],
  served: ["Đã lên món", "#dcfce7", "#15803d", 2],
};
const round: React.CSSProperties = { cursor: "pointer", width: 34, height: 34, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, border: "none", fontFamily: "inherit", fontSize: 18, padding: 0, flex: "none" };
const cta: React.CSSProperties = { cursor: "pointer", width: "100%", textAlign: "center", fontSize: 16, fontWeight: 800, padding: "15px 16px", borderRadius: 16, background: O, color: "white", border: "none", fontFamily: "inherit", boxShadow: "0 6px 14px -6px rgba(234,88,12,.7)" };
const field: React.CSSProperties = { width: "100%", boxSizing: "border-box", fontSize: 16, padding: "14px 16px", borderRadius: 16, border: `1.5px solid ${LINE}`, background: "white", color: INK, fontFamily: "inherit", outline: "none" };

const GUEST_TTL = 8 * 3_600_000, CART_TTL = 3 * 3_600_000;
const LANG_KEY = "qr-lang";
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();
/** Biểu tượng của nhóm món (đoán theo tên nhóm quán đặt). */
const CAT_ICONS: [RegExp, string][] = [[/lau/, "🍲"], [/nuong|thit/, "🥩"], [/hai san|tom/, "🦐"], [/khai vi|an vat|an choi/, "🍤"], [/com|mi|bun|pho|mien|chao/, "🍜"], [/rau|an kem|salad|goi/, "🥬"], [/bia/, "🍻"], [/ruou/, "🍶"], [/ca phe|cafe|coffee/, "☕"], [/tra|soda|sinh to|nuoc ep/, "🍹"], [/uong|nuoc/, "🥤"], [/trang mieng|banh|kem|che/, "🍮"], [/chinh/, "🍛"]];
const catIcon = (c: string) => CAT_ICONS.find(([re]) => re.test(norm(c)))?.[1] ?? "🍴";
const load = <T,>(key: string, ttl: number): T | null => {
  try {
    const j = JSON.parse(localStorage.getItem(key) ?? "null");
    return j && Date.now() - j.at < ttl ? (j as T) : null;
  } catch {
    return null;
  }
};
const save = (key: string, v: object | null) => {
  try {
    if (v) localStorage.setItem(key, JSON.stringify({ ...v, at: Date.now() }));
    else localStorage.removeItem(key);
  } catch {
    /* trình duyệt chặn lưu — trang vẫn chạy */
  }
};
/** Ngôn ngữ đã chọn lần trước; chưa chọn thì theo ngôn ngữ máy (máy tiếng Việt ⇒ vi, Trung / Hàn ⇒ zh / ko, còn lại ⇒ en). */
function firstLang(): QrLang {
  try {
    const s = localStorage.getItem(LANG_KEY);
    if (QR_LANGS.some((l) => l.code === s)) return s as QrLang;
  } catch {}
  const n = (typeof navigator !== "undefined" ? navigator.language : "vi").toLowerCase();
  return n.startsWith("vi") ? "vi" : n.startsWith("zh") ? "zh" : n.startsWith("ko") ? "ko" : "en";
}
const Ico = ({ d, size = 20, sw = 2 }: { d: string; size?: number; sw?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flex: "none" }}><path d={d} /></svg>
);
const I = {
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  x: "M6 6l12 12M18 6L6 18",
  check: "M5 12l5 5L20 7",
  search: "M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16zM21 21l-4.3-4.3",
  bell: "M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a2 2 0 0 0 3.4 0M4 2C2.8 3.7 2 5.7 2 8M22 8c0-2.3-.8-4.3-2-6",
  cart: "M6 6h15l-1.5 9h-12zM6 6L5 2H2M9 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM18 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2z",
  bill: "M6 2h12v20l-3-2-3 2-3-2-3 2zM9 7h6M9 11h6M9 15h4",
  arrow: "M5 12h14M13 6l6 6-6 6",
  user: "M20 21a8 8 0 0 0-16 0M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  phone: "M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z",
  users: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8",
  cup: "M17 8h1a4 4 0 1 1 0 8h-1M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4zM6 2v2M10 2v2M14 2v2",
  globe: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20",
};

/** `t` = chữ giao diện (khoá là chuỗi tiếng Việt); `tc` = nội dung quán nhập (tên món, nhóm, mô tả) theo bản dịch trong DB. */
const Lang = createContext<{ t: QrTF; tc: (s: string) => string; lang: QrLang }>({ t: qrT("vi"), tc: (s) => s, lang: "vi" });
const useLang = () => useContext(Lang);

type Sheet = null | "cart" | "confirm" | "orders" | "staff" | "bill";
type Q = { v: string; t: string; k: string };
type Post = (body: Record<string, unknown>, okMsg?: string) => Promise<boolean>;

/**
 * Điện thoại khách sau khi quét QR ở bàn — bố cục theo mẫu app.tramdungchill.vn (lưới món 2 cột), màu xanh thương hiệu.
 * Màn "Chào mừng" (tên · SĐT · số khách; quán chọn hỏi đủ / chỉ tên + số khách / không hỏi — `d.gate`) → thực đơn (tìm món, nhóm món, xem chi tiết) → giỏ hàng (ghi chú nhanh từng món)
 * → hộp xác nhận "Gửi order vào bếp?" → "Đơn đã gọi" (tiến trình, gọi thêm 1 phần, huỷ khi bếp chưa làm, thanh toán).
 * Nút nổi "Gọi NV" mở bảng "Bạn cần gì?". Trạng thái nạp lại 5 giây một lần qua GET /api/qr.
 * ĐA NGÔN NGỮ (vi / en / zh / ko): chữ giao diện ở `qr-i18n.ts`; tên món / nhóm / mô tả tra bản dịch trong bảng Translation
 * (GET /api/qr?…&l=<ngôn ngữ>&tr=1), thiếu thì hiện tiếng Việt. Ghi chú gửi bếp + yêu cầu gửi quán LUÔN là tiếng Việt.
 */
export function QrOrder({ initial, q }: { initial: DineCustomer; q: Q }) {
  const [d, setD] = useState(initial);
  /** undefined = chưa đọc bộ nhớ máy · null = chưa khai (hiện màn Chào mừng). */
  const [guest, setGuest] = useState<DineGuest | null | undefined>(undefined);
  const [lang, setLang] = useState<QrLang>("vi");
  const [tr, setTr] = useState<Record<string, string>>({});
  const [langOpen, setLangOpen] = useState(false);
  const [sheet, setSheet] = useState<Sheet>(null);
  // Nhóm món: Món chính → Ăn kèm → Đồ uống trước, nhóm quán tự đặt theo sau.
  const cats = useMemo(() => {
    const rank = (c: string) => (DINE_CATS.indexOf(c) + 1 || DINE_CATS.length + 1);
    return [...new Set(d.menu.map((m) => m.group || "Khác"))].sort((x, y) => rank(x) - rank(y));
  }, [d.menu]);
  const [cat, setCat] = useState("");
  const [find, setFind] = useState("");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);
  const [payQr, setPayQr] = useState("");
  /** Món đang xem chi tiết. */
  const [detail, setDetail] = useState<{ id: string; i: number } | null>(null);
  // "Đã thanh toán · Cảm ơn" chỉ cho máy đã thấy món của bàn trong lần mở trang này — khách mới ngồi vào quét mã
  // trong 30 phút sau khi bàn trước thu tiền không bị báo "đã thanh toán".
  const [hadOrders, setHadOrders] = useState(initial.orders.length > 0);
  if (d.orders.length > 0 && !hadOrders) setHadOrders(true);
  const showPaid = d.paid && hadOrders;
  const toastT = useRef<ReturnType<typeof setTimeout>>(undefined);
  const listRef = useRef<HTMLDivElement>(null);
  const qs = `v=${encodeURIComponent(q.v)}&t=${encodeURIComponent(q.t)}&k=${encodeURIComponent(q.k)}`;
  const gKey = `qrg:${q.v}:${q.t.toLowerCase()}`, cKey = `qrc:${q.v}:${q.t.toLowerCase()}`;
  const t = useMemo(() => qrT(lang), [lang]);
  const tc = useCallback((s: string) => (lang === "vi" ? s : (tr[s] ?? (s === "Khác" ? t("Khác") : s))), [lang, tr, t]);
  const langCtx = useMemo(() => ({ t, tc, lang }), [t, tc, lang]);

  const say = useCallback((m: string) => {
    clearTimeout(toastT.current);
    setToast(m);
    toastT.current = setTimeout(() => setToast(""), 2600);
  }, []);
  // Đọc lại ngôn ngữ, thông tin khách + giỏ đang chọn dở (tải lại trang / lỡ tay đóng tab không mất).
  useEffect(() => {
    let off = false;
    // Bộ nhớ máy chỉ đọc được sau khi trang đã dựng ở trình duyệt ⇒ nạp ở nhịp kế tiếp.
    void Promise.resolve().then(() => {
      if (off) return;
      const l = firstLang();
      setLang(l);
      setGuest(load<DineGuest>(gKey, GUEST_TTL));
      const c = load<{ cart: Record<string, number>; notes: Record<string, string>; note: string }>(cKey, CART_TTL);
      if (c && Object.values(c.cart ?? {}).some((n) => n > 0)) {
        setCart(c.cart);
        setNotes(c.notes ?? {});
        setNote(c.note ?? "");
        say(qrT(l)("Đã khôi phục món bạn chọn trước đó"));
      }
    });
    return () => {
      off = true;
    };
  }, [gKey, cKey, say]);
  const loaded = guest !== undefined;
  useEffect(() => {
    if (loaded) save(cKey, Object.values(cart).some((n) => n > 0) ? { cart, notes, note } : null);
  }, [loaded, cKey, cart, notes, note]);
  // Bàn đã thu tiền ⇒ lượt khách này xong: lần quét sau hỏi lại thông tin.
  useEffect(() => {
    if (showPaid) save(gKey, null);
  }, [showPaid, gKey]);
  useEffect(() => {
    document.documentElement.lang = lang === "zh" ? "zh-CN" : lang;
  }, [lang]);
  // Bản dịch tên món / nhóm / mô tả: nạp khi đổi ngôn ngữ hoặc thực đơn / món đã gọi đổi.
  const trSig = useMemo(() => d.menu.map((m) => `${m.id}:${m.name}:${m.desc.length}`).join("|") + "#" + d.orders.map((o) => o.id).join(","), [d.menu, d.orders]);
  useEffect(() => {
    if (lang === "vi") return;
    let off = false;
    fetch(`/api/qr?${qs}&l=${lang}&tr=1`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => !off && j?.tr && setTr(j.tr))
      .catch(() => {});
    return () => {
      off = true;
    };
  }, [lang, qs, trSig]);
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

  /** Gửi thao tác lên quán. Thông báo lỗi của server là tiếng Việt ⇒ ngôn ngữ khác hiện câu chung. */
  const post: Post = async (body, okMsg) => {
    if (busy) return false;
    setBusy(true);
    try {
      const r = await fetch("/api/qr", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...q, ...body }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        say(lang === "vi" ? (j.error ?? "Có lỗi, thử lại giúp mình.") : t("Chưa thực hiện được — thử lại hoặc gọi nhân viên giúp mình."));
        return false;
      }
      setD(j);
      if (okMsg) say(okMsg);
      return true;
    } catch {
      say(t("Mất kết nối, thử lại giúp mình."));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const item = (id: string) => d.menu.find((m) => m.id === id);
  // Món vừa bị tắt / xoá khỏi thực đơn thì rơi khỏi giỏ.
  const ids = Object.keys(cart).filter((k) => cart[k] > 0 && item(k)?.avail);
  const cartN = ids.reduce((a, k) => a + cart[k], 0);
  const cartTotal = ids.reduce((a, k) => a + cart[k] * (item(k)?.price ?? 0), 0);
  const setQ = (id: string, n: number) => setCart((c) => ({ ...c, [id]: Math.max(0, Math.min(50, n)) }));
  const calls = d.orders.filter((o) => !isFee(o));
  /** Số phần bàn đã gọi của từng món (theo tên chụp lại trên đơn). */
  const ordered = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of d.orders) if (!isFee(o)) for (const it of o.items) m.set(it.name, (m.get(it.name) ?? 0) + it.qty);
    return m;
  }, [d.orders]);
  const curCat = cats.includes(cat) ? cat : "";
  const key = norm(find.trim());
  // Tìm theo cả tên gốc lẫn tên đã dịch.
  const shown = d.menu.filter((m) => (key ? norm(`${m.name} ${m.group} ${m.desc} ${tc(m.name)} ${tc(m.group || "Khác")}`).includes(key) : !curCat || (m.group || "Khác") === curCat));
  // "Tất cả": xếp theo nhóm để chèn tiêu đề nhóm.
  if (!key && !curCat) shown.sort((x, y) => cats.indexOf(x.group || "Khác") - cats.indexOf(y.group || "Khác"));
  const pickCat = (c: string) => {
    setCat(c);
    setFind("");
    listRef.current?.scrollTo({ top: 0 });
  };
  const toggleChip = (id: string, chip: string) =>
    setNotes((ns) => {
      const parts = (ns[id] ?? "").split(",").map((x) => x.trim()).filter(Boolean);
      const next = parts.includes(chip) ? parts.filter((x) => x !== chip) : [...parts, chip];
      return { ...ns, [id]: next.join(", ").slice(0, 120) };
    });
  const pickLang = (l: QrLang) => {
    setLang(l);
    setLangOpen(false);
    try {
      localStorage.setItem(LANG_KEY, l);
    } catch {}
  };

  async function send() {
    if (!cartN) return;
    if (await post({ op: "order", note, guest, items: ids.map((k) => ({ menuId: k, qty: cart[k], note: notes[k] ?? "" })) }, t("Đã gửi {0} món tới bếp", [cartN]))) {
      setCart({});
      setNotes({});
      setNote("");
      setSheet("orders");
    } else setSheet("cart");
  }
  const again = (name: string) => {
    const m = d.menu.find((x) => x.name === name && x.avail);
    if (!m) return say(t("{0} hiện đã hết — chọn món khác giúp mình nhé", [tc(name)]));
    setQ(m.id, (cart[m.id] ?? 0) + 1);
    say(t("Đã thêm {0} vào giỏ", [tc(m.name)]));
  };
  const dm = detail ? item(detail.id) : undefined;
  const dn = dm ? (cart[dm.id] ?? 0) : 0;
  const repeats = ids.map((k) => item(k)!.name).filter((n) => ordered.has(n));
  const langBtn = (dark: boolean) => (
    <button type="button" className="qr-tap" onClick={() => setLangOpen(true)} aria-label={t("Chọn ngôn ngữ")} style={{ cursor: "pointer", flex: "none", display: "flex", alignItems: "center", gap: 5, fontSize: 13, fontWeight: 800, padding: "9px 11px", borderRadius: 999, background: dark ? "rgba(255,255,255,.2)" : "white", border: dark ? "1.5px solid rgba(255,255,255,.45)" : "2px solid #8cc9a6", color: dark ? "white" : PRICE, fontFamily: "inherit" }}>
      <Ico d={I.globe} size={16} />
      {lang.toUpperCase()}
    </button>
  );

  const frame = (children: React.ReactNode, bg = BG) => (
    <Lang.Provider value={langCtx}>
      <div style={{ minHeight: "100dvh", background: "#e2e8f0", display: "flex", justifyContent: "center", color: INK }}>
        <style>{"@keyframes qrUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}@keyframes qrSheet{from{transform:translateY(100%)}to{transform:none}}@keyframes qrFade{from{opacity:0}to{opacity:1}}@keyframes qrDrop{from{opacity:0;transform:translateY(-16px)}to{opacity:1;transform:none}}.qr-noscroll{scrollbar-width:none}.qr-noscroll::-webkit-scrollbar{display:none}.qr-in:focus{border-color:#328a5f!important;box-shadow:0 0 0 3px rgba(50,138,95,.2)}.qr-tap{transition:transform .12s}.qr-tap:active{transform:scale(.96)}"}</style>
        <div style={{ position: "relative", width: "100%", maxWidth: 480, height: "100dvh", display: "flex", flexDirection: "column", background: bg, overflow: "hidden" }}>
          {children}
          {langOpen && (
            <SheetBox z={20} title={t("Chọn ngôn ngữ")} sub={t("Đổi ngôn ngữ hiển thị — món và giá vẫn y nguyên.")} onClose={() => setLangOpen(false)}>
              {QR_LANGS.map((l) => (
                <button key={l.code} type="button" className="qr-tap" onClick={() => pickLang(l.code)} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 12, textAlign: "left", fontSize: 17, fontWeight: 800, padding: "15px 16px", borderRadius: 16, border: `2px solid ${lang === l.code ? "#328a5f" : LINE}`, background: lang === l.code ? CREAM : "white", color: INK, fontFamily: "inherit" }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: DIM, width: 24 }}>{l.code.toUpperCase()}</span>
                  <span style={{ flex: 1 }}>{l.name}</span>
                  {lang === l.code && <span style={{ color: G, display: "flex" }}><Ico d={I.check} size={20} sw={2.6} /></span>}
                </button>
              ))}
            </SheetBox>
          )}
          {toast && <div role="status" style={{ position: "absolute", left: 16, right: 16, top: 16, padding: "12px 14px", borderRadius: 14, background: INK, color: "white", fontSize: 14, fontWeight: 700, textAlign: "center", animation: "qrDrop .25s ease both", zIndex: 30, boxShadow: "0 10px 24px -10px rgba(15,23,42,.6)" }}>{toast}</div>}
        </div>
      </div>
    </Lang.Provider>
  );

  if (!loaded) return frame(null, CREAM);
  if (showPaid)
    return frame(
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, padding: 28, textAlign: "center", animation: "qrUp .3s ease both" }}>
        <div style={{ width: 84, height: 84, borderRadius: "50%", background: "#dcfce7", color: "#15803d", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40, fontWeight: 800 }}>✓</div>
        <div style={{ fontSize: 24, fontWeight: 800 }}>{t("Đã thanh toán")}</div>
        <div style={{ fontSize: 16, lineHeight: 1.5, color: DIM }}>{t("Cảm ơn {0} đã ghé {1} 🥰", [guest?.name || t("quý khách"), tc(d.venue)])}<br />{t("Hẹn gặp lại ở Tà Xùa.")}</div>
        <button type="button" className="qr-tap" onClick={() => setHadOrders(false)} style={{ ...cta, width: "auto", marginTop: 12, padding: "13px 22px", background: "white", color: PRICE, border: "2px solid #328a5f", boxShadow: "none" }}>{t("Gọi món tiếp")}</button>
      </div>,
      CREAM,
    );
  // Quán tắt màn Chào mừng (gate off) ⇒ vào thẳng thực đơn, đơn không kèm thông tin khách.
  if (!guest && d.gate !== "off") return frame(<Welcome venue={tc(d.venue)} table={d.table} lite={d.gate === "lite"} langBtn={langBtn(false)} onDone={(g) => { save(gKey, g); setGuest(g); }} />, CREAM);

  return frame(
    <>
      {/* Đầu trang: quán · bàn · ngôn ngữ · đơn đã gọi · tìm món · nhóm món */}
      <div style={{ background: GRAD, color: "white", padding: "14px 14px 0", flex: "none", boxShadow: "0 4px 14px -6px rgba(22,70,50,.6)", zIndex: 2 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", opacity: 0.92, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tc(d.venue)}</div>
            <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.2 }}>{t("Bàn {0}", [d.table])}</div>
          </div>
          {langBtn(true)}
          <button type="button" className="qr-tap" onClick={() => setSheet("orders")} style={{ cursor: "pointer", flex: "none", display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 800, padding: "9px 12px", borderRadius: 999, background: "rgba(255,255,255,.2)", border: "1.5px solid rgba(255,255,255,.45)", color: "white", fontFamily: "inherit" }}>
            <Ico d={I.bill} size={17} />
            {t("Đơn đã gọi")}
            {calls.length > 0 && <span style={{ minWidth: 20, height: 20, padding: "0 5px", boxSizing: "border-box", borderRadius: 999, background: "white", color: PRICE, fontSize: 12, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{calls.length}</span>}
          </button>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, padding: "0 14px", borderRadius: 14, background: "white", color: PRICE, boxShadow: "0 2px 6px rgba(0,0,0,.12)" }}>
          <Ico d={I.search} size={19} />
          <input value={find} onChange={(e) => setFind(e.target.value)} placeholder={t("Tìm món (vd: bò, lẩu, trà…)")} enterKeyHint="search" style={{ flex: 1, minWidth: 0, fontSize: 16, padding: "12px 0", border: "none", outline: "none", background: "transparent", color: INK, fontFamily: "inherit" }} />
          {find && <button type="button" onClick={() => setFind("")} aria-label={t("Xoá tìm kiếm")} style={{ ...round, width: 26, height: 26, background: "#f1f5f9", color: DIM }}><Ico d={I.x} size={13} sw={2.6} /></button>}
        </label>
        <div className="qr-noscroll" style={{ display: "flex", gap: 8, overflowX: "auto", padding: "12px 14px 14px", margin: "0 -14px" }}>
          {["", ...cats].map((c) => {
            const on = !key && curCat === c;
            return (
              <button key={c || "all"} type="button" onClick={() => pickCat(c)} style={{ cursor: "pointer", flex: "none", display: "flex", alignItems: "center", gap: 6, fontSize: 14, fontWeight: 800, padding: "9px 14px", borderRadius: 999, border: "none", fontFamily: "inherit", background: on ? "white" : "rgba(255,255,255,.22)", color: on ? PRICE : "white", boxShadow: on ? "0 2px 6px rgba(0,0,0,.15)" : "none" }}>
                <span aria-hidden>{c ? catIcon(c) : "🍽️"}</span>
                {c ? tc(c) : t("Tất cả")}
              </button>
            );
          })}
        </div>
      </div>

      {/* Lưới món 2 cột */}
      <div ref={listRef} style={{ flex: 1, overflowY: "auto", padding: "14px 12px 170px" }}>
        {!d.menu.length && <div style={{ padding: "32px 14px", textAlign: "center", fontSize: 15, color: DIM }}>{t("Quán chưa đưa thực đơn lên. Bạn bấm “Gọi NV” giúp mình nhé.")}</div>}
        {d.menu.length > 0 && !shown.length && <div style={{ padding: "32px 14px", textAlign: "center", fontSize: 15, color: DIM }}>{t("Không tìm thấy món nào.")}</div>}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {shown.map((m, idx) => {
            const n = cart[m.id] ?? 0, had = ordered.get(m.name) ?? 0, g = m.group || "Khác", name = tc(m.name);
            const head = !key && !curCat && (idx === 0 || (shown[idx - 1].group || "Khác") !== g);
            return (
              <div key={m.id} style={{ display: "contents" }}>
                {head && <div style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 8, fontSize: 16, fontWeight: 800, padding: idx ? "10px 2px 0" : "0 2px" }}><span aria-hidden>{catIcon(g)}</span>{tc(g)}</div>}
                <div style={{ display: "flex", flexDirection: "column", borderRadius: 18, overflow: "hidden", background: n ? CREAM : "white", border: `2px solid ${n ? "#56a97d" : "transparent"}`, boxShadow: "0 1px 4px rgba(15,23,42,.1)", opacity: m.avail ? 1 : 0.55 }}>
                  <div style={{ position: "relative", aspectRatio: "1 / 1", background: CREAM2, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 54 }}>
                    {m.images.length ? <Slides images={m.images} alt={name} onTap={(i) => setDetail({ id: m.id, i })} /> : <span aria-hidden onClick={() => setDetail({ id: m.id, i: 0 })} style={{ cursor: "pointer" }}>{catIcon(g)}</span>}
                    {m.hot && m.avail && <span style={{ position: "absolute", left: 8, top: 8, fontSize: 11, fontWeight: 800, padding: "3px 8px", borderRadius: 7, background: "#e11d48", color: "white", pointerEvents: "none" }}>🔥 Hot</span>}
                    {!m.avail && <span style={{ position: "absolute", left: 8, top: 8, fontSize: 11, fontWeight: 800, padding: "3px 8px", borderRadius: 7, background: INK, color: "white", pointerEvents: "none" }}>{t("Hết món")}</span>}
                    {had > 0 && <span style={{ position: "absolute", left: 8, bottom: 8, fontSize: 11, fontWeight: 800, padding: "3px 8px", borderRadius: 7, background: "rgba(15,23,42,.72)", color: "white", pointerEvents: "none" }}>{t("Đã gọi ×{0}", [had])}</span>}
                  </div>
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8, padding: "10px 12px 12px" }}>
                    <div onClick={() => setDetail({ id: m.id, i: 0 })} style={{ cursor: "pointer", flex: 1, fontSize: 15, fontWeight: 700, lineHeight: 1.35, minHeight: "2.7em", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{name}</div>
                    <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "6px 4px", minHeight: 44 }}>
                      <b style={{ fontSize: 15.5, color: MONEY, whiteSpace: "nowrap" }}>{money(m.price)}</b>
                      {m.avail && (n > 0 ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 1, marginLeft: "auto" }}>
                          <button type="button" onClick={() => setQ(m.id, n - 1)} style={{ ...round, width: 32, height: 32, background: "white", color: PRICE, border: "1.5px solid #8cc9a6" }} aria-label={t("Bớt {0}", [name])}><Ico d={I.minus} size={15} sw={2.4} /></button>
                          <span style={{ minWidth: 20, textAlign: "center", fontSize: 15, fontWeight: 800 }}>{n}</span>
                          <button type="button" onClick={() => setQ(m.id, n + 1)} style={{ ...round, width: 32, height: 32, background: G, color: "white" }} aria-label={t("Thêm {0}", [name])}><Ico d={I.plus} size={16} sw={2.4} /></button>
                        </div>
                      ) : (
                        <button type="button" className="qr-tap" onClick={() => setQ(m.id, 1)} style={{ ...round, width: 44, height: 44, background: G, color: "white", boxShadow: "0 4px 10px -4px rgba(34,110,75,.9)" }} aria-label={t("Thêm {0}", [name])}><Ico d={I.plus} size={22} sw={2.2} /></button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Nút nổi gọi nhân viên + thanh giỏ hàng */}
      <button type="button" className="qr-tap" onClick={() => setSheet("staff")} style={{ position: "absolute", right: 12, bottom: `calc(${cartN ? 92 : 16}px + env(safe-area-inset-bottom))`, zIndex: 3, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, fontSize: 15, fontWeight: 800, padding: "11px 18px", borderRadius: 999, background: "white", color: PRICE, border: "2px solid #328a5f", fontFamily: "inherit", boxShadow: "0 8px 18px -8px rgba(15,23,42,.45)", transition: "bottom .2s" }}>
        <Ico d={I.bell} size={20} />
        {d.staffAsked ? t("Đã gọi NV") : t("Gọi NV")}
      </button>
      {cartN > 0 && (
        <button type="button" className="qr-tap" onClick={() => setSheet("cart")} style={{ position: "absolute", left: 12, right: 12, bottom: "calc(12px + env(safe-area-inset-bottom))", zIndex: 3, cursor: "pointer", display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 18, background: O, color: "white", border: "none", fontFamily: "inherit", textAlign: "left", boxShadow: "0 12px 24px -10px rgba(234,88,12,.9)", animation: "qrUp .25s ease both" }}>
          <span style={{ position: "relative", display: "flex" }}>
            <Ico d={I.cart} size={28} />
            <span style={{ position: "absolute", right: -8, top: -8, minWidth: 20, height: 20, padding: "0 4px", boxSizing: "border-box", borderRadius: 999, background: "white", color: MONEY, fontSize: 12, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{cartN}</span>
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: ".06em", opacity: 0.9, textTransform: "uppercase" }}>{t("Giỏ hàng")}</span>
            <span style={{ display: "block", fontSize: 18, fontWeight: 800 }}>{money(cartTotal)}</span>
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 16, fontWeight: 800, whiteSpace: "nowrap" }}>{t("Xem & Gọi món")} <Ico d={I.arrow} size={18} sw={2.4} /></span>
        </button>
      )}

      {/* Chi tiết món */}
      {detail && dm && (
        <div style={{ position: "absolute", inset: 0, zIndex: 10, background: "white", display: "flex", flexDirection: "column", animation: "qrUp .2s ease both" }}>
          <div style={{ position: "relative", height: "44%", flex: "none", background: CREAM2, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 96 }}>
            {dm.images.length ? <Slides key={dm.id} images={dm.images} alt={tc(dm.name)} start={detail.i} big fill /> : <span aria-hidden>{catIcon(dm.group || "Khác")}</span>}
            <button type="button" onClick={() => setDetail(null)} aria-label={t("Đóng")} style={{ ...round, position: "absolute", right: 14, top: 14, width: 42, height: 42, background: "rgba(15,23,42,.6)", color: "white" }}><Ico d={I.x} size={18} sw={2.4} /></button>
          </div>
          <div style={{ flex: 1, minHeight: 0, overflowY: "auto", marginTop: -22, borderRadius: "24px 24px 0 0", background: "white", position: "relative", padding: "22px 20px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.25 }}>{tc(dm.name)}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: MONEY }}>{money(dm.price)}</div>
            {dm.desc && <div style={{ fontSize: 15.5, lineHeight: 1.55, color: DIM, fontStyle: "italic", whiteSpace: "pre-line" }}>{tc(dm.desc)}</div>}
            {(ordered.get(dm.name) ?? 0) > 0 && <div style={{ fontSize: 14, fontWeight: 700, padding: "10px 12px", borderRadius: 12, background: CREAM2, color: "#164632" }}>{t("Bàn mình đã gọi {0} phần món này rồi.", [ordered.get(dm.name)])}</div>}
            <div style={{ fontSize: 14, lineHeight: 1.5, padding: "12px 14px", borderRadius: 14, background: BG, border: `1px solid ${LINE}`, color: "#475569" }}>💡 {t("Muốn “không cay”, “ít ngọt”… bạn ghi chú cho từng món ở giỏ hàng trước khi gửi bếp.")}</div>
          </div>
          <div style={{ flex: "none", padding: "12px 16px calc(14px + env(safe-area-inset-bottom))", borderTop: `1px solid ${LINE}`, display: "flex", alignItems: "center", gap: 12 }}>
            {!dm.avail ? (
              <div style={{ flex: 1, textAlign: "center", fontSize: 16, fontWeight: 800, padding: 15, borderRadius: 16, background: "#f1f5f9", color: DIM }}>{t("Món này đang hết")}</div>
            ) : dn > 0 ? (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <button type="button" onClick={() => setQ(dm.id, dn - 1)} style={{ ...round, width: 46, height: 46, background: "#f1f5f9", color: INK }} aria-label={t("Bớt")}><Ico d={I.minus} size={18} sw={2.4} /></button>
                  <span style={{ minWidth: 28, textAlign: "center", fontSize: 19, fontWeight: 800 }}>{dn}</span>
                  <button type="button" onClick={() => setQ(dm.id, dn + 1)} style={{ ...round, width: 46, height: 46, background: G, color: "white" }} aria-label={t("Thêm")}><Ico d={I.plus} size={20} sw={2.4} /></button>
                </div>
                <button type="button" className="qr-tap" onClick={() => setDetail(null)} style={{ ...cta, flex: 1, width: "auto" }}>{t("Xong")} · {money(dm.price * dn)}</button>
              </>
            ) : (
              <button type="button" className="qr-tap" onClick={() => { setQ(dm.id, 1); say(t("Đã thêm {0} vào giỏ", [tc(dm.name)])); }} style={{ ...cta, background: G, boxShadow: "0 6px 14px -6px rgba(34,110,75,.8)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}><Ico d={I.plus} size={20} sw={2.4} /> {t("Thêm vào giỏ")} — {money(dm.price)}</button>
            )}
          </div>
        </div>
      )}

      {/* Giỏ hàng */}
      {sheet === "cart" && (
        <SheetBox title={`${t("Giỏ hàng")} — ${t("Bàn {0}", [d.table])}`} onClose={() => setSheet(null)} foot={ids.length > 0 && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontSize: 16, color: DIM }}>{t("Tổng")}</span>
              <b style={{ fontSize: 26, color: MONEY }}>{money(cartTotal)}</b>
            </div>
            <button type="button" className="qr-tap" disabled={busy} onClick={() => setSheet("confirm")} style={cta}>{t("Gọi món")} · {money(cartTotal)}</button>
          </>
        )}>
          {!ids.length && <Empty icon="🛒" title={t("Giỏ hàng trống")} sub={t("Quay lại menu để chọn món.")} />}
          {ids.map((k) => {
            const m = item(k)!;
            const picked = (notes[k] ?? "").split(",").map((x) => x.trim());
            return (
              <div key={k} style={{ display: "flex", flexDirection: "column", gap: 8, paddingBottom: 14, borderBottom: `1px solid ${LINE}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 15.5, fontWeight: 700, lineHeight: 1.3 }}>{tc(m.name)}</div>
                    <div style={{ fontSize: 13, color: DIM }}>{money(m.price)} × {cart[k]} = {money(m.price * cart[k])}</div>
                  </div>
                  <button type="button" onClick={() => setQ(k, cart[k] - 1)} style={{ ...round, width: 38, height: 38, background: "#f1f5f9", color: INK }} aria-label={t("Bớt")}><Ico d={I.minus} size={16} sw={2.4} /></button>
                  <span style={{ minWidth: 22, textAlign: "center", fontSize: 16, fontWeight: 800 }}>{cart[k]}</span>
                  <button type="button" onClick={() => setQ(k, cart[k] + 1)} style={{ ...round, width: 38, height: 38, background: G, color: "white" }} aria-label={t("Thêm")}><Ico d={I.plus} size={17} sw={2.4} /></button>
                </div>
                <div className="qr-noscroll" style={{ display: "flex", gap: 6, overflowX: "auto" }}>
                  {DINE_NOTE_CHIPS.map((c) => {
                    const on = picked.includes(c);
                    return <button key={c} type="button" onClick={() => toggleChip(k, c)} style={{ cursor: "pointer", flex: "none", fontSize: 13, fontWeight: 700, padding: "7px 12px", borderRadius: 999, border: `1.5px solid ${on ? "#328a5f" : "#cbd5e1"}`, background: on ? CREAM2 : "white", color: on ? "#164632" : "#475569", fontFamily: "inherit" }}>{on ? "✓" : "+"} {t(c)}</button>;
                  })}
                </div>
                <input className="qr-in" value={notes[k] ?? ""} maxLength={120} onChange={(e) => setNotes({ ...notes, [k]: e.target.value })} placeholder={t("Ghi chú món (vd: ít cay, không hành…)")} style={{ ...field, fontSize: 15, padding: "11px 14px", borderRadius: 12, background: BG }} />
              </div>
            );
          })}
          {ids.length > 0 && (
            <>
              <textarea className="qr-in" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} rows={2} placeholder={t("Ghi chú chung cả đơn (không bắt buộc)")} style={{ ...field, fontSize: 15, padding: "11px 14px", borderRadius: 12, background: BG, resize: "none" }} />
              {lang !== "vi" && <div style={{ fontSize: 13, fontStyle: "italic", color: DIM }}>{t("Ghi chú gửi xuống bếp bằng tiếng Việt — bấm các gợi ý ở trên là chắc nhất.")}</div>}
              <div style={{ fontSize: 14, lineHeight: 1.45, padding: "11px 14px", borderRadius: 12, background: "#ecfdf5", border: "1px solid #a7f3d0", color: "#065f46" }}>{t("Món vào bếp ngay sau khi bạn bấm Gọi món. Thanh toán tại bàn khi ăn xong.")}</div>
            </>
          )}
        </SheetBox>
      )}

      {/* Hộp xác nhận gửi bếp */}
      {sheet === "confirm" && (
        <SheetBox bare onClose={() => !busy && setSheet("cart")} foot={
          <>
            <button type="button" className="qr-tap" disabled={busy} onClick={() => void send()} style={{ ...cta, opacity: busy ? 0.65 : 1 }}>{busy ? t("Đang gửi vô bếp…") : `✅ ${t("Đúng — Gửi bếp")}`}</button>
            <button type="button" disabled={busy} onClick={() => setSheet("cart")} style={{ ...cta, background: "white", color: "#334155", border: "1.5px solid #cbd5e1", boxShadow: "none", padding: "13px 16px" }}>← {t("Sửa lại đơn")}</button>
          </>
        }>
          <div style={{ margin: "-16px -18px 0", padding: "22px 20px 18px", background: CREAM, borderBottom: "2px solid #8cc9a6", display: "flex", flexDirection: "column", alignItems: "center", gap: 10, textAlign: "center" }}>
            <div style={{ fontSize: 44, lineHeight: 1 }} aria-hidden>🍽️</div>
            <div style={{ fontSize: 19, fontWeight: 800, color: "#164632" }}>{t("Gửi order vào bếp?")}</div>
            <div style={{ alignSelf: "stretch", padding: "12px 14px", borderRadius: 14, background: "#fee2e2", border: "2px solid #f87171", color: "#b91c1c" }}>
              <div style={{ fontSize: 17, fontWeight: 800, lineHeight: 1.3 }}>⚠️ {t("Bếp bắt đầu làm là KHÔNG huỷ được")}</div>
              <div style={{ fontSize: 13.5, fontWeight: 700, marginTop: 4 }}>{t("Vui lòng kiểm tra kỹ trước khi bấm “Đúng — Gửi bếp”.")}</div>
            </div>
            {repeats.length > 0 && <div style={{ alignSelf: "stretch", fontSize: 13.5, fontWeight: 700, lineHeight: 1.45, padding: "10px 12px", borderRadius: 12, background: "#fef3c7", color: "#92400e" }}>{t("Bàn mình đã gọi {0} ở đơn trước rồi — gửi là gọi THÊM nhé.", [repeats.map(tc).join(", ")])}</div>}
          </div>
          {ids.map((k) => {
            const m = item(k)!;
            return (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 12, paddingBottom: 12, borderBottom: `1px solid ${LINE}` }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.3 }}>{tc(m.name)}</div>
                  {notes[k] && <div style={{ fontSize: 13, color: "#b45309", marginTop: 2 }}>↳ {notes[k]}</div>}
                </div>
                <div style={{ textAlign: "right", flex: "none" }}>
                  <div style={{ fontSize: 15, fontWeight: 800 }}>×{cart[k]}</div>
                  <div style={{ fontSize: 13, color: DIM }}>{money(m.price * cart[k])}</div>
                </div>
              </div>
            );
          })}
          {note && <div style={{ fontSize: 13.5, padding: "9px 12px", borderRadius: 10, background: CREAM2, color: "#164632" }}>{t("Ghi chú")}: {note}</div>}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", margin: "0 -18px", padding: "14px 20px", background: BG, borderTop: `1px solid ${LINE}`, borderBottom: `1px solid ${LINE}` }}>
            <span style={{ fontSize: 15, color: DIM }}>{t("Tổng đơn")}</span>
            <b style={{ fontSize: 26, color: MONEY }}>{money(cartTotal)}</b>
          </div>
        </SheetBox>
      )}

      {/* Đơn đã gọi */}
      {sheet === "orders" && (
        <SheetBox tall title={`${t("Đơn đã gọi")} — ${t("Bàn {0}", [d.table])}`} sub={calls.length ? t("{0} lần gọi · Tổng: {1}", [calls.length, money(d.bill)]) : undefined} onClose={() => setSheet(null)} foot={d.orders.length > 0 ? (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontSize: 15, color: DIM }}>{t("Tổng cộng đã gọi")}</span>
              <b style={{ fontSize: 26, color: MONEY }}>{money(d.bill)}</b>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1.3fr", gap: 8 }}>
              <button type="button" onClick={() => setSheet(null)} style={{ ...cta, background: "white", color: PRICE, border: "2px solid #328a5f", boxShadow: "none", fontSize: 15, padding: "13px 8px" }}>+ {t("Gọi thêm món")}</button>
              <button type="button" className="qr-tap" onClick={() => setSheet("bill")} style={{ ...cta, fontSize: 15, padding: "13px 8px" }}>{d.payReq ? t("Xem hoá đơn") : t("Thanh toán")}</button>
            </div>
          </>
        ) : undefined}>
          {!d.orders.length && (
            <>
              <Empty icon="🧾" title={t("Chưa có đơn nào")} sub={t("Quay lại menu để gọi món đầu tiên.")} />
              <button type="button" onClick={() => setSheet(null)} style={{ ...cta, background: G, boxShadow: "none" }}>{t("Quay lại menu")}</button>
            </>
          )}
          {/* Đã chọn cách thanh toán: báo trạng thái — hoá đơn chi tiết (+ mã QR nếu chuyển khoản) mở bằng "Xem hoá đơn". */}
          {d.payReq && d.orders.length > 0 && (
            <div onClick={() => setSheet("bill")} style={{ cursor: "pointer", fontSize: 14, fontWeight: 700, lineHeight: 1.45, padding: "11px 14px", borderRadius: 12, background: d.claimNote ? "#fee2e2" : d.payClaim ? "#dcfce7" : "#fef3c7", color: d.claimNote ? "#b91c1c" : d.payClaim ? "#166534" : "#92400e" }}>
              {d.claimNote ? t("Quán chưa nhận được tiền chuyển khoản — mở hoá đơn để xem") : d.payClaim ? t("Đã gửi xác nhận chuyển khoản · chờ quán kiểm tra") : d.payReq === "Chuyển khoản" ? t("Đã chọn chuyển khoản · mở hoá đơn để quét mã QR") : t("Đã báo nhân viên · thanh toán tiền mặt tại bàn")} →
            </div>
          )}
          {calls.map((o, i) => {
            const S = SS[o.status as keyof typeof SS] ?? SS.new;
            return (
              <div key={o.id} style={{ display: "flex", flexDirection: "column", gap: 10, padding: 14, borderRadius: 16, background: "white", border: `1.5px solid ${o.status === "served" ? "#86efac" : LINE}`, boxShadow: "0 1px 3px rgba(15,23,42,.06)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <b style={{ fontSize: 15 }}>{t("Lần gọi {0}", [i + 1])} · {hm(o.at)}</b>
                  <span style={{ fontSize: 12, fontWeight: 800, padding: "4px 10px", borderRadius: 999, background: S[1], color: S[2] }}>{t(S[0])}</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 4 }}>
                  {["Đã gửi", "Đang làm", "Lên món"].map((name, j) => (
                    <div key={name} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <div style={{ height: 5, borderRadius: 3, background: j <= S[3] ? (S[3] === 2 ? "#22c55e" : "#f59e0b") : LINE }} />
                      <span style={{ fontSize: 11, fontWeight: 700, color: j <= S[3] ? INK : "#94a3b8" }}>{t(name)}</span>
                    </div>
                  ))}
                </div>
                {o.items.map((it, n) => (
                  <div key={n} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0, fontSize: 14.5, lineHeight: 1.35 }}>
                      <b>{it.qty}×</b> {tc(it.name)} <span style={{ color: DIM, whiteSpace: "nowrap" }}>· {money(it.price * it.qty)}</span>
                      {it.note && <span style={{ display: "block", fontSize: 12.5, color: "#b45309" }}>↳ {it.note}</span>}
                    </div>
                    <button type="button" onClick={() => again(it.name)} style={{ cursor: "pointer", flex: "none", fontSize: 12, fontWeight: 800, padding: "7px 10px", borderRadius: 999, border: "1.5px solid #8cc9a6", background: CREAM, color: PRICE, fontFamily: "inherit", whiteSpace: "nowrap" }}>+ {t("Gọi thêm 1")}</button>
                  </div>
                ))}
                {o.note && <div style={{ fontSize: 13, padding: "7px 10px", borderRadius: 9, background: CREAM2, color: "#164632" }}>{t("Ghi chú")}: {o.note}</div>}
                {/* Bếp chưa bấm "Đang làm" ⇒ khách tự huỷ được lần gọi này. */}
                {o.status === "new" && (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, paddingTop: 10, borderTop: `1px dashed ${LINE}` }}>
                    <span style={{ fontSize: 12, color: DIM }}>{t("Bếp chưa bắt đầu làm — còn huỷ được")}</span>
                    <button type="button" disabled={busy} onClick={() => window.confirm(t("Huỷ lần gọi {0} ({1} món)?", [i + 1, o.items.reduce((a, it) => a + it.qty, 0)])) && post({ op: "cancel", orderId: o.id }, t("Đã huỷ lần gọi món"))} style={{ cursor: "pointer", fontSize: 12.5, fontWeight: 800, padding: "7px 12px", borderRadius: 999, border: "1.5px solid #fca5a5", color: "#dc2626", background: "white", fontFamily: "inherit", whiteSpace: "nowrap" }}>{t("Huỷ lần gọi")}</button>
                  </div>
                )}
              </div>
            );
          })}
          {/* Phụ thu quán thêm vào hoá đơn (phí phục vụ, ngày lễ…) — không phải lần gọi món. */}
          {d.orders.some(isFee) && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: 14, borderRadius: 16, background: "white", border: `1.5px solid ${LINE}` }}>
              <b style={{ fontSize: 15 }}>{t("Phụ thu")}</b>
              {d.orders.filter(isFee).flatMap((o) => o.items).map((it, n) => (
                <div key={n} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 14 }}>
                  <span>{tc(it.name)}</span>
                  <span style={{ whiteSpace: "nowrap" }}>{money(it.price * it.qty)}</span>
                </div>
              ))}
            </div>
          )}
        </SheetBox>
      )}

      {/* Gọi nhân viên */}
      {sheet === "staff" && (
        <SheetBox title={t("Bạn cần gì?")} sub={`${t("Bàn {0}", [d.table])} · ${t("nhân viên nhận thông báo trong vài giây")}`} onClose={() => setSheet(null)}>
          {d.staffAsked && <div style={{ fontSize: 14.5, fontWeight: 700, lineHeight: 1.45, padding: "12px 14px", borderRadius: 14, background: "#dcfce7", color: "#166534" }}>✓ {t("Đã gọi nhân viên")}{d.staffNote ? ` · ${t(d.staffNote)}` : ""}. {t("Bấm 1 lần là đủ — bấm lại không tạo yêu cầu mới.")}</div>}
          <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: ".06em", color: DIM, textTransform: "uppercase" }}>{t("Gọi nhân viên")}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {DINE_STAFF_NEEDS.map((n, i) => (
              <button key={n} type="button" className="qr-tap" disabled={busy} onClick={async () => { if (await post({ op: "staff", need: n }, t("Đã gọi nhân viên tới bàn {0}", [d.table]))) setSheet(null); }} style={{ cursor: "pointer", gridColumn: i === DINE_STAFF_NEEDS.length - 1 && DINE_STAFF_NEEDS.length % 2 ? "1 / -1" : undefined, display: "flex", alignItems: "center", gap: 8, textAlign: "left", fontSize: 14.5, fontWeight: 700, lineHeight: 1.3, padding: "14px 12px", borderRadius: 14, border: `1.5px solid ${d.staffNote === n ? "#328a5f" : LINE}`, background: d.staffNote === n ? CREAM : "white", color: INK, fontFamily: "inherit" }}>
                <span aria-hidden style={{ fontSize: 20 }}>{["🍜", "🥢", "🧊", "🪑", "🔔"][i] ?? "🔔"}</span>
                {t(n)}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: ".06em", color: DIM, marginTop: 4, textTransform: "uppercase" }}>{t("Thanh toán")}</div>
          <button type="button" className="qr-tap" disabled={!d.orders.length} onClick={() => setSheet("bill")} style={{ cursor: d.orders.length ? "pointer" : "default", display: "flex", alignItems: "center", gap: 12, textAlign: "left", padding: "14px 16px", borderRadius: 16, border: "none", background: d.orders.length ? O : "#f1f5f9", color: d.orders.length ? "white" : "#94a3b8", fontFamily: "inherit" }}>
            <span aria-hidden style={{ fontSize: 26 }}>💳</span>
            <span style={{ flex: 1 }}>
              <b style={{ display: "block", fontSize: 16 }}>{d.payReq ? t("Xem hoá đơn") : t("Cần thanh toán")}{d.orders.length > 0 && ` · ${money(d.bill)}`}</b>
              <span style={{ fontSize: 13, opacity: 0.9 }}>{d.orders.length ? t("Chọn tiền mặt / chuyển khoản → nhân viên ra bàn xử lý") : t("Bàn chưa gọi món nào")}</span>
            </span>
            {d.orders.length > 0 && <Ico d={I.arrow} size={20} sw={2.4} />}
          </button>
        </SheetBox>
      )}

      {sheet === "bill" && d.orders.length > 0 && <BillSheet d={d} payQr={payQr} busy={busy} q={q} post={post} say={say} onClose={() => setSheet("orders")} />}
    </>,
  );
}

/** Màn "Chào mừng": khách khai tên · SĐT · số khách rồi mới mở thực đơn (quán biết ai đang ngồi bàn nào). */
function Welcome({ venue, table, lite, langBtn, onDone }: { venue: string; table: string; /** quán chỉ hỏi tên + số khách (không xin SĐT) */ lite: boolean; langBtn: React.ReactNode; onDone: (g: DineGuest) => void }) {
  const { t } = useLang();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [pax, setPax] = useState("");
  const [err, setErr] = useState<{ name?: string; phone?: string; pax?: string }>({});
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const n = name.replace(/\s+/g, " ").trim(), p = phone.replace(/\D/g, ""), k = Math.round(Number(pax));
    const bad = {
      name: n ? undefined : "Vui lòng nhập tên",
      phone: lite || (p.length >= 9 && p.length <= 11) ? undefined : "Số điện thoại không hợp lệ (9–11 chữ số)",
      pax: k >= 1 && k <= 99 ? undefined : "Vui lòng nhập số khách",
    };
    setErr(bad);
    if (!bad.name && !bad.phone && !bad.pax) onDone({ name: n.slice(0, 40), phone: lite ? "" : p, pax: k });
  };
  const label = (icon: string, text: string) => (
    <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 15.5, fontWeight: 700, color: "#1e293b" }}><Ico d={icon} size={18} /> {text} *</span>
  );
  const msg = (m?: string) => m && <span style={{ fontSize: 13, fontWeight: 700, color: "#dc2626" }}>{t(m)}</span>;
  const box = (bad?: string): React.CSSProperties => ({ ...field, borderColor: bad ? "#f87171" : LINE });
  return (
    <form onSubmit={submit} noValidate style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 22px 20px", display: "flex", flexDirection: "column", gap: 18, animation: "qrUp .3s ease both" }}>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>{langBtn}</div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, textAlign: "center" }}>
          <div style={{ width: 84, height: 84, borderRadius: "50%", background: CREAM2, color: O, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 6 }}><Ico d={I.cup} size={42} sw={2.2} /></div>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: DIM }}>{venue}</div>
          <div style={{ fontSize: 24, fontWeight: 800 }}>{t("Chào mừng quý khách!")}</div>
          <div style={{ fontSize: 30, fontWeight: 800, color: PRICE, lineHeight: 1.1 }}>{t("Bàn {0}", [table])}</div>
        </div>
        <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.5, textAlign: "center", padding: "14px 16px", borderRadius: 16, background: CREAM2, border: "2px solid #8cc9a6", color: "#1e293b" }}>
          {t("Nhập thông tin để mở bàn gọi món — nhân viên dựa vào đây để phục vụ đúng bàn và liên hệ khi cần.")}
        </div>
        <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {label(I.user, t("Tên"))}
          <input className="qr-in" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoComplete="name" placeholder={t("VD: Nguyễn Tuấn")} style={box(err.name)} />
          {msg(err.name)}
        </label>
        {!lite && <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {label(I.phone, t("Số điện thoại"))}
          <input className="qr-in" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={15} type="tel" inputMode="tel" autoComplete="tel" placeholder={t("VD: 0901234567")} style={box(err.phone)} />
          {msg(err.phone)}
        </label>}
        <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {label(I.users, t("Quý khách đi mấy người?"))}
          <input className="qr-in" value={pax} onChange={(e) => setPax(e.target.value.replace(/\D/g, "").slice(0, 2))} inputMode="numeric" placeholder={t("VD: 4")} style={box(err.pax)} />
          {msg(err.pax)}
        </label>
      </div>
      <div style={{ flex: "none", padding: "14px 22px calc(16px + env(safe-area-inset-bottom))", borderTop: "1px solid #bbe1c9" }}>
        <button type="submit" className="qr-tap" style={{ ...cta, display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}><Ico d={I.arrow} size={20} sw={2.4} /> {t("Mở bàn gọi món")}</button>
      </div>
    </form>
  );
}

const Empty = ({ icon, title, sub }: { icon: string; title: string; sub: string }) => (
  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "26px 14px", textAlign: "center" }}>
    <div style={{ fontSize: 44 }} aria-hidden>{icon}</div>
    <b style={{ fontSize: 17 }}>{title}</b>
    <span style={{ fontSize: 14, color: DIM }}>{sub}</span>
  </div>
);

/** Bảng trượt từ đáy: tiêu đề + nút đóng, thân cuộn, chân dính (tổng tiền + nút chính). `bare` = không có hàng tiêu đề. */
function SheetBox({ title, sub, onClose, children, foot, tall, bare, z = 12 }: { title?: string; sub?: string; onClose: () => void; children: React.ReactNode; foot?: React.ReactNode; tall?: boolean; bare?: boolean; z?: number }) {
  const { t } = useLang();
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: z, background: "rgba(15,23,42,.55)", display: "flex", flexDirection: "column", justifyContent: "flex-end", animation: "qrFade .2s ease both" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ maxHeight: "92%", height: tall ? "92%" : undefined, display: "flex", flexDirection: "column", background: "white", borderRadius: "26px 26px 0 0", overflow: "hidden", animation: "qrSheet .26s cubic-bezier(.2,.8,.2,1) both" }}>
        {!bare && (
          <div style={{ flex: "none", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "18px 18px 14px", borderBottom: `1px solid ${LINE}` }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 20, fontWeight: 800 }}>{title}</div>
              {sub && <div style={{ fontSize: 13, color: DIM, marginTop: 2 }}>{sub}</div>}
            </div>
            <button type="button" onClick={onClose} aria-label={t("Đóng")} style={{ ...round, width: 38, height: 38, background: "#f1f5f9", color: INK }}><Ico d={I.x} size={17} sw={2.4} /></button>
          </div>
        )}
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 14, background: tall ? BG : "white" }}>{children}</div>
        {foot && <div style={{ flex: "none", display: "flex", flexDirection: "column", gap: 10, padding: "12px 18px calc(14px + env(safe-area-inset-bottom))", borderTop: `1px solid ${LINE}`, background: "white" }}>{foot}</div>}
      </div>
    </div>
  );
}

/**
 * Ảnh của món dạng TRƯỢT (vuốt ngang, scroll-snap): chấm báo vị trí + số ảnh. `big` = bản xem lớn (ảnh hiện trọn, không cắt);
 * `fill` = bản lớn nhưng ảnh phủ kín khung (màn chi tiết món). Không có ảnh ⇒ không dựng gì (khung cha tự hiện nền).
 */
function Slides({ images, alt, onTap, start = 0, big, fill }: { images: string[]; alt: string; onTap?: (i: number) => void; start?: number; big?: boolean; fill?: boolean }) {
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
          <img key={u} src={u} alt={i ? "" : alt} loading={i ? "lazy" : undefined} onClick={() => onTap?.(i)} style={{ flex: "none", width: "100%", height: "100%", objectFit: big && !fill ? "contain" : "cover", scrollSnapAlign: "center", cursor: onTap ? "pointer" : "default" }} />
        ))}
      </div>
      {images.length > 1 && (
        <>
          <span style={{ position: "absolute", right: fill ? undefined : big ? 12 : 4, left: fill ? 14 : undefined, top: fill ? 16 : big ? 8 : 4, fontSize: big ? 12 : 9, fontWeight: 800, padding: big ? "3px 9px" : "1px 5px", borderRadius: 999, background: "rgba(15,23,42,.7)", color: "white", pointerEvents: "none" }}>{cur + 1}/{images.length}</span>
          <div style={{ position: "absolute", left: 0, right: 0, bottom: fill ? 32 : big ? 10 : 4, display: "flex", justifyContent: "center", gap: big ? 6 : 3, pointerEvents: "none" }}>
            {images.map((u, i) => <span key={u} style={{ width: big ? 8 : 5, height: big ? 8 : 5, borderRadius: "50%", background: i === cur ? "white" : "rgba(255,255,255,.45)", boxShadow: "0 0 2px rgba(0,0,0,.5)" }} />)}
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
function TransferBox({ d, bank, payQr, busy, q, post, say }: { d: DineCustomer; bank: NonNullable<DineCustomer["bank"]>; payQr: string; busy: boolean; q: Q; post: Post; say: (m: string) => void }) {
  const { t } = useLang();
  const [proof, setProof] = useState("");
  const [up, setUp] = useState(false);
  const claim = d.payClaim;
  const changed = claim && claim.amount !== d.bill;
  const copy = (text: string, what: string) => {
    void navigator.clipboard?.writeText(text).then(() => say(t("Đã chép {0}", [what])), () => say(text));
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
      if (!r.ok) say(t("Không tải được ảnh, thử lại."));
      else setProof(j.url);
    } catch {
      say(t("Mất kết nối, thử lại giúp mình."));
    } finally {
      setUp(false);
    }
  }
  const chip: React.CSSProperties = { cursor: "pointer", fontSize: 11, fontWeight: 800, padding: "5px 9px", borderRadius: 999, border: "1px solid #bbe1c9", background: "white", color: PRICE, fontFamily: "inherit", whiteSpace: "nowrap" };
  const row = (k: string, v: React.ReactNode, copyText?: string) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, fontSize: 13 }}>
      <span style={{ color: DIM, flex: "none" }}>{k}</span>
      <span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
        <b style={{ minWidth: 0, overflowWrap: "anywhere", textAlign: "right" }}>{v}</b>
        {copyText && <button type="button" onClick={() => copy(copyText, k.toLowerCase())} style={chip}>{t("Chép")}</button>}
      </span>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: 14, borderRadius: 16, background: "white", border: `1.5px solid ${G}` }}>
      <b style={{ fontSize: 15, textAlign: "center" }}>{t("Quét mã VietQR — app ngân hàng tự điền số tiền")}</b>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {payQr ? <img src={payQr} alt="VietQR" width={200} height={200} style={{ borderRadius: 10 }} /> : <div style={{ width: 200, height: 200 }} />}
        {payQr && <a href={payQr} download={`VietQR-${bank.memo.replace(/\s+/g, "-")}.png`} style={{ ...chip, textDecoration: "none", padding: "7px 12px", fontSize: 12 }}>{t("Lưu ảnh QR (mở app ngân hàng → quét ảnh)")}</a>}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "10px 12px", borderRadius: 12, background: BG }}>
        {row(t("Ngân hàng"), bank.name)}
        {row(t("Số tài khoản"), <span style={{ fontFamily: "ui-monospace,monospace" }}>{bank.account}</span>, bank.account)}
        {row(t("Chủ tài khoản"), bank.holder)}
        {row(t("Số tiền"), <span style={{ color: MONEY, fontSize: 16 }}>{money(d.bill)}</span>, String(d.bill))}
        {row(t("Nội dung"), bank.memo, bank.memo)}
      </div>

      {claim ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "10px 12px", borderRadius: 12, background: "#dcfce7", color: "#166534", fontSize: 13, lineHeight: 1.5 }}>
          <b>{t("Đã gửi xác nhận chuyển khoản {0} lúc {1}", [money(claim.amount), hm(claim.at)])}</b>
          <span>{t("Quán đang kiểm tra tài khoản, xác nhận xong bàn sẽ được đóng hoá đơn.")}</span>
          {changed && <span style={{ color: "#b45309", fontWeight: 700 }}>{t("Hoá đơn vừa thay đổi thành {0} — chuyển thêm phần chênh lệch rồi gửi lại xác nhận.", [money(d.bill)])}</span>}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {claim.proof && <img src={claim.proof} alt="" style={{ width: 90, borderRadius: 8, border: "1px solid #86efac" }} />}
        </div>
      ) : (
        <>
          {d.claimNote && (
            <div style={{ fontSize: 13, lineHeight: 1.5, padding: "10px 12px", borderRadius: 12, background: "#fee2e2", color: "#b91c1c" }}>
              <b>{t("Quán chưa nhận được tiền:")}</b> {d.claimNote}. {t("Kiểm tra lại giao dịch rồi gửi xác nhận lại.")}
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 4, borderTop: `1px dashed ${LINE}` }}>
            <b style={{ fontSize: 14 }}>{t("Chuyển xong? Gửi ảnh bill để quán xác nhận")}</b>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {proof && <img src={proof} alt="" style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 8, flex: "none" }} />}
              <label style={{ cursor: "pointer", flex: 1, textAlign: "center", fontSize: 13, fontWeight: 800, padding: 11, borderRadius: 12, border: "1.5px dashed #8cc9a6", color: PRICE }}>
                {up ? t("Đang tải ảnh…") : proof ? t("Đổi ảnh bill") : `📷 ${t("Chọn ảnh bill chuyển khoản")}`}
                <input type="file" accept="image/*" hidden disabled={up} onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = ""; }} />
              </label>
            </div>
            <button type="button" disabled={busy || up} onClick={async () => { if (proof || window.confirm(t("Gửi xác nhận mà không kèm ảnh bill? Quán sẽ tự kiểm tra tài khoản."))) if (await post({ op: "claim", proof }, t("Đã gửi xác nhận chuyển khoản · chờ quán kiểm tra"))) setProof(""); }} style={{ ...cta, fontSize: 14, padding: 13, borderRadius: 999, opacity: busy || up ? 0.6 : 1 }}>
              {t("Tôi đã chuyển khoản {0}", [money(d.bill)])}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * HOÁ ĐƠN (mở bằng nút "Thanh toán" / "Xem hoá đơn"): chưa chọn cách trả ⇒ chọn Tiền mặt / Chuyển khoản;
 * đã chọn ⇒ hoá đơn chi tiết (gộp món, phụ thu, tổng). Tiền mặt: báo nhân viên tới thu, KHÔNG có mã QR.
 * Chuyển khoản: kèm mã VietQR đúng số tiền + gửi ảnh bill (TransferBox).
 */
function BillSheet({ d, payQr, busy, q, post, say, onClose }: { d: DineCustomer; payQr: string; busy: boolean; q: Q; post: Post; say: (m: string) => void; onClose: () => void }) {
  const { t, tc } = useLang();
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
    <div style={{ position: "absolute", inset: 0, zIndex: 14, background: "rgba(15,23,42,.55)", display: "flex", flexDirection: "column", justifyContent: "flex-end", animation: "qrFade .2s ease both" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ maxHeight: "92%", overflowY: "auto", background: BG, borderRadius: "26px 26px 0 0", padding: "16px 16px calc(18px + env(safe-area-inset-bottom))", display: "flex", flexDirection: "column", gap: 12, animation: "qrSheet .26s cubic-bezier(.2,.8,.2,1) both" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <b style={{ fontSize: 18 }}>{t("Hoá đơn")} · {t("Bàn {0}", [d.table])}</b>
          <button type="button" onClick={onClose} aria-label={t("Đóng")} style={{ ...round, width: 38, height: 38, background: "#e2e8f0", color: INK }}><Ico d={I.x} size={17} sw={2.4} /></button>
        </div>

        {/* Hoá đơn chi tiết */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: 14, borderRadius: 16, background: "white", border: `1.5px solid ${LINE}` }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: DIM }}>{tc(d.venue)}</div>
          {[...lines.values()].map((l, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 8, fontSize: 14 }}>
              <span><b>{l.qty}×</b> {tc(l.name)}<span style={{ display: "block", fontSize: 11, color: DIM }}>{money(l.price)} {t("/ phần")}</span></span>
              <b style={{ whiteSpace: "nowrap" }}>{money(l.price * l.qty)}</b>
            </div>
          ))}
          {fees.length > 0 && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: DIM, paddingTop: 6, borderTop: `1px dashed ${LINE}` }}><span>{t("Tiền món")}</span><span>{money(food)}</span></div>
              {fees.map((f, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13 }}><span>{t("Phụ thu")} · {tc(f.name)}</span><span style={{ whiteSpace: "nowrap" }}>{money(f.price * f.qty)}</span></div>
              ))}
            </>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", paddingTop: 8, borderTop: `1.5px solid ${LINE}` }}>
            <b style={{ fontSize: 15 }}>{t("Tổng thanh toán")}</b>
            <b style={{ fontSize: 24, color: MONEY }}>{money(d.bill)}</b>
          </div>
        </div>

        {pick ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <b style={{ fontSize: 15 }}>{t("Chọn hình thức thanh toán")}</b>
            {methodBtn("Tiền mặt", `💵 ${t("Tiền mặt tại bàn")}`, t("Báo nhân viên mang hoá đơn ra bàn thu tiền"), "#dcfce7", "#166534")}
            {methodBtn("Chuyển khoản", `🏦 ${t("Chuyển khoản QR")}`, d.bank ? t("Hiện mã QR có sẵn số tiền — quét bằng app ngân hàng") : t("Nhân viên mang mã chuyển khoản ra bàn"), "#dbeafe", "#1d4ed8")}
            {d.payReq && <button type="button" onClick={() => setChoosing(false)} style={{ cursor: "pointer", alignSelf: "center", fontSize: 13, fontWeight: 700, color: DIM, background: "none", border: "none", fontFamily: "inherit" }}>{t("Giữ cách đang chọn ({0})", [t(d.payReq).toLowerCase()])}</button>}
          </div>
        ) : d.payReq === "Chuyển khoản" ? (
          d.bank ? <TransferBox d={d} bank={d.bank} payQr={payQr} busy={busy} q={q} post={post} say={say} /> : <div style={{ fontSize: 13, lineHeight: 1.5, padding: "12px 14px", borderRadius: 14, background: "white", border: `1.5px solid ${LINE}` }}>{t("Quán chưa cài mã chuyển khoản — nhân viên sẽ mang mã ra bàn.")}</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 4, padding: "12px 14px", borderRadius: 14, background: "#dcfce7", color: "#166534", fontSize: 13, lineHeight: 1.5 }}>
            <b style={{ fontSize: 14 }}>💵 {t("Thanh toán tiền mặt")}</b>
            <span>{t("Đã báo nhân viên — nhân viên sẽ mang hoá đơn ra bàn. Bạn chuẩn bị {0} nhé.", [money(d.bill)])}</span>
          </div>
        )}
        {!pick && <button type="button" onClick={() => setChoosing(true)} style={{ cursor: "pointer", alignSelf: "center", fontSize: 13, fontWeight: 800, padding: "8px 14px", borderRadius: 999, border: `1.5px solid ${LINE}`, background: "white", color: PRICE, fontFamily: "inherit" }}>{t("Đổi hình thức thanh toán")}</button>}
      </div>
    </div>
  );
}
