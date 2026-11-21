"use client";

import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import type { ScanDetail, ScanKind, ScanResult, TkVenueRef } from "@/lib/ticket-core";
import { vnDateTime } from "@/lib/date-format";
import { G, MUTED, inputCls } from "./ui";

/** [nền, biểu tượng, chữ, ký hiệu, chấm nhật ký] */
const R: Record<ScanKind, [string, string, string, string, string]> = {
  ok: ["oklch(0.94 0.06 155)", "oklch(0.5 0.13 155)", "oklch(0.32 0.1 155)", "✓", "oklch(0.55 0.13 155)"],
  used: ["oklch(0.96 0.05 70)", "oklch(0.68 0.16 55)", "oklch(0.45 0.13 50)", "!", "oklch(0.7 0.15 60)"],
  wrong: ["oklch(0.96 0.03 28)", "oklch(0.58 0.19 28)", "oklch(0.48 0.17 28)", "×", "oklch(0.6 0.19 28)"],
  food: ["oklch(0.95 0.03 250)", "oklch(0.55 0.13 250)", "oklch(0.4 0.12 250)", "F", "oklch(0.55 0.13 250)"],
  none: ["oklch(0.96 0.005 160)", "oklch(0.55 0.01 160)", "oklch(0.35 0.02 160)", "?", "oklch(0.6 0.01 160)"],
};
type Res = ScanResult & { code: string };
type Log = { k: ScanKind; t: string; s: string; at: string; res: Res };
/** Vé hợp lệ tự đóng popup sau ngần này ms (bấm vào popup để giữ lại). */
const OK_CLOSE_MS = 4500;
type Detector = { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> };

/**
 * Soát vé bằng camera điện thoại — theo mẫu tab "Soát vé" của "Ban ve - Quan tri".
 * Đọc QR bằng BarcodeDetector (Chrome / Android), không có thì dùng jsQR (Safari iOS). Mỗi vé một mã; nhập tay được mã vé / mã đơn.
 */
export function Scanner({ venues, who, initial }: { venues: TkVenueRef[]; who: string; initial: { checked: number; total: number } }) {
  const [venueId, setVenueId] = useState("");
  const [stats, setStats] = useState(initial);
  const [res, setRes] = useState<Res | null>(null);
  /** Popup đang mở ⇒ tạm ngừng đọc camera (tránh quét lại mã khi nhân viên còn đang xem). */
  const openRef = useRef(false);
  useEffect(() => {
    openRef.current = !!res;
  }, [res]);
  const [log, setLog] = useState<Log[]>([]);
  const [manual, setManual] = useState("");
  const [cam, setCam] = useState<"off" | "on" | "error">("off");
  const [camErr, setCamErr] = useState("");
  const [busy, setBusy] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const last = useRef({ code: "", at: 0 });
  const venueRef = useRef(venueId);
  useEffect(() => {
    venueRef.current = venueId;
  }, [venueId]);

  // TK-5: show nhiều suất / ngày ⇒ cho chọn suất đang soát (tuỳ chọn; để trống = tự chọn theo giờ mở cổng).
  const showVenue = venueId ? venues.find((v) => v.id === venueId) : venues.length === 1 ? venues[0] : undefined;
  const showVenueId = showVenue?.kind === "SHOW" ? showVenue.id : "";
  const [shows, setShows] = useState<{ venueId: string; list: { id: string; time: string; paused: boolean }[] }>({ venueId: "", list: [] });
  const [sessionId, setSessionId] = useState("");
  const sessionRef = useRef("");
  useEffect(() => {
    sessionRef.current = shows.venueId === showVenueId ? sessionId : "";
  }, [sessionId, shows.venueId, showVenueId]);
  useEffect(() => {
    if (!showVenueId) return;
    let off = false;
    // Lấy suất hôm nay của địa điểm; tài khoản không xem được (nhân viên) ⇒ không hiện ô chọn, giữ tự chọn suất.
    fetch("/api/admin/ticket", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ op: "reload", venueId: showVenueId }) })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { today?: string; sessions?: { id: string; date: string; time: string; status: string }[] } | null) => {
        if (off) return;
        const list = (j?.sessions ?? []).filter((s) => s.date === j?.today && s.time).map((s) => ({ id: s.id, time: s.time, paused: s.status === "paused" }));
        setShows({ venueId: showVenueId, list });
        setSessionId("");
      })
      .catch(() => {});
    return () => {
      off = true;
    };
  }, [showVenueId]);
  const sessionOpts = shows.venueId === showVenueId ? shows.list : [];

  const check = useCallback(async (code: string, deliver = false) => {
    // Súng quét gõ như bàn phím: bộ gõ tiếng Việt (Unikey/EVKey) đang bật sẽ biến "aa" thành "â"… ⇒ mã hỏng, báo rõ cách sửa.
    if (/[^\x20-\x7e]/.test(code)) {
      openRef.current = true;
      setRes({ kind: "none", title: "Mã bị bộ gõ tiếng Việt làm sai", sub: "Tắt Unikey / EVKey (chuyển sang gõ tiếng Anh) rồi quét lại", code });
      return;
    }
    setBusy(true);
    try {
      const r = await fetch("/api/admin/ticket", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ op: "scan", venueId: venueRef.current, code, deliver, sessionId: sessionRef.current || undefined }) });
      const j = await r.json();
      const result: ScanResult = r.ok ? j.result : { kind: "none", title: "Không kiểm tra được", sub: j.error ?? "Mất kết nối, thử lại" };
      if (r.ok && j.stats) setStats(j.stats);
      const full = { ...result, code };
      openRef.current = true;
      setRes(full);
      const d = result.detail;
      const s = d ? [d.label, d.customer].filter(Boolean).join(" · ") : result.sub.split(" · ")[0];
      setLog((l) => [{ k: result.kind, t: result.title, s, at: new Date().toTimeString().slice(0, 5), res: full }, ...l].slice(0, 8));
      if (navigator.vibrate) navigator.vibrate(result.kind === "ok" ? 60 : [80, 60, 80]);
    } catch {
      openRef.current = true;
      setRes({ kind: "none", title: "Mất kết nối", sub: "Kiểm tra mạng rồi quét lại", code });
    } finally {
      setBusy(false);
    }
  }, []);

  // Đóng popup: mã vừa xem phải chờ thêm 4 giây mới quét lại (camera thường vẫn đang chĩa vào mã đó).
  const closePop = useCallback(() => {
    openRef.current = false;
    last.current = { code: last.current.code, at: Date.now() };
    setRes(null);
  }, []);

  // Súng quét QR cầm tay (USB / Bluetooth, chế độ bàn phím): súng "gõ" nội dung mã rất nhanh rồi Enter.
  // Bắt ở cấp trang để quét được cả khi popup kết quả đang mở / con trỏ không nằm trong ô nhập.
  // Ô nhập tay (hoặc ô khác) đang được chọn ⇒ để form của ô đó xử lý.
  useEffect(() => {
    let buf = "", lastAt = 0;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const now = Date.now();
      if (now - lastAt > 100) buf = ""; // người gõ tay chậm hơn nhiều so với súng (vài ms / ký tự)
      lastAt = now;
      if (e.key === "Enter") {
        if (buf.length >= 6) {
          e.preventDefault(); // không để Enter bấm nhầm nút đang được chọn trong popup
          last.current = { code: buf, at: now };
          void check(buf);
        }
        buf = "";
      } else if (e.key === "Backspace") buf = buf.slice(0, -1);
      else if (e.key.length === 1) buf += e.key;
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [check]);

  // Camera + vòng đọc QR.
  useEffect(() => {
    if (cam !== "on") return;
    let stop = false, stream: MediaStream | null = null, timer: ReturnType<typeof setTimeout>;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
        const v = video.current;
        if (stop || !v) return stream.getTracks().forEach((t) => t.stop());
        v.srcObject = stream;
        await v.play();
        const BD = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
        const det = BD ? new BD({ formats: ["qr_code"] }) : null;
        const jsQR = det ? null : (await import("jsqr")).default;
        const canvas = document.createElement("canvas");
        const tick = async () => {
          if (stop) return;
          try {
            let code = "";
            if (v.readyState >= 2 && v.videoWidth) {
              if (det) code = (await det.detect(v))[0]?.rawValue ?? "";
              else if (jsQR) {
                const s = Math.min(1, 640 / v.videoWidth);
                canvas.width = Math.round(v.videoWidth * s);
                canvas.height = Math.round(v.videoHeight * s);
                const g = canvas.getContext("2d", { willReadFrequently: true })!;
                g.drawImage(v, 0, 0, canvas.width, canvas.height);
                code = jsQR(g.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height)?.data ?? "";
              }
            }
            // Cùng một mã: 4 giây mới kiểm tra lại (tránh báo "đã dùng" ngay sau khi vừa cho vào).
            if (openRef.current) code = "";
            if (code && (code !== last.current.code || Date.now() - last.current.at > 4000)) {
              last.current = { code, at: Date.now() };
              await check(code);
            }
          } catch {
            /* khung hình lỗi — bỏ qua */
          }
          timer = setTimeout(tick, 220);
        };
        tick();
      } catch (e) {
        setCam("error");
        setCamErr(e instanceof Error && e.name === "NotAllowedError" ? "Chưa cho phép dùng camera. Mở cài đặt trình duyệt để cấp quyền, hoặc nhập mã tay." : "Không mở được camera trên máy này — nhập mã tay bên dưới.");
      }
    })();
    return () => {
      stop = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [cam, check]);

  const pct = Math.round((stats.checked / Math.max(1, stats.total)) * 100);

  return (
    <div style={{ width: 420, maxWidth: "100%", borderRadius: 28, overflow: "hidden", background: "white", border: "1px solid oklch(0.92 0.008 160)", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "16px 16px 10px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "oklch(0.5 0.02 160)" }}>Soát vé · {who}</div>
          {venues.length > 1 ? (
            <select value={venueId} onChange={(e) => setVenueId(e.target.value)} style={{ fontSize: 16, fontWeight: 800, border: "none", background: "transparent", fontFamily: "inherit", padding: 0, maxWidth: "100%", color: "inherit" }}>
              <option value="">Tất cả địa điểm · hôm nay</option>
              {venues.filter((v) => v.kind !== "RESTAURANT").map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          ) : (
            <div style={{ fontSize: 16, fontWeight: 800 }}>{venues[0]?.name ?? "Vé hôm nay"}</div>
          )}
          {sessionOpts.length > 1 && (
            <select value={sessionId} onChange={(e) => setSessionId(e.target.value)} aria-label="Suất đang soát" style={{ display: "block", marginTop: 2, fontSize: 13, fontWeight: 700, border: "none", background: "transparent", fontFamily: "inherit", padding: 0, maxWidth: "100%", color: "oklch(0.4 0.1 155)" }}>
              <option value="">Suất: tự chọn theo giờ</option>
              {sessionOpts.map((s) => <option key={s.id} value={s.id}>Suất {s.time}{s.paused ? " · tạm dừng" : ""}</option>)}
            </select>
          )}
        </div>
        <div style={{ textAlign: "right", flex: "none" }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: "oklch(0.4 0.1 155)" }}>{stats.checked}/{stats.total}</div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "oklch(0.5 0.02 160)" }}>đã vào</div>
        </div>
      </div>
      <div style={{ height: 6, margin: "0 16px 12px", borderRadius: 3, background: "oklch(0.94 0.01 160)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: "oklch(0.55 0.12 155)", transition: "width .4s" }} />
      </div>

      <div style={{ position: "relative", margin: "0 16px", height: 300, borderRadius: 24, overflow: "hidden", background: "radial-gradient(circle at 50% 40%, oklch(0.36 0.02 200), oklch(0.16 0.02 200))" }}>
        <video ref={video} playsInline muted style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", display: cam === "on" ? "block" : "none" }} />
        <div style={{ position: "absolute", left: "18%", right: "18%", top: "14%", bottom: "14%", borderRadius: 20, boxShadow: "0 0 0 999px oklch(0 0 0 / .35)" }} />
        {(["top", "bottom"] as const).flatMap((v) => (["left", "right"] as const).map((hz) => (
          <div key={v + hz} style={{ position: "absolute", [v]: "14%", [hz]: "18%", width: 34, height: 34, [`border${v === "top" ? "Top" : "Bottom"}`]: "4px solid white", [`border${hz === "left" ? "Left" : "Right"}`]: "4px solid white", [`border${v === "top" ? "Top" : "Bottom"}${hz === "left" ? "Left" : "Right"}Radius`]: 20 }} />
        )))}
        {cam === "on" && <div style={{ position: "absolute", left: "20%", right: "20%", height: 3, borderRadius: 2, background: "oklch(0.75 0.16 155)", boxShadow: "0 0 12px 2px oklch(0.75 0.16 155 / .7)", animation: "tkScan 2.2s ease-in-out infinite" }} />}
        {cam !== "on" && (
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, padding: 24, textAlign: "center" }}>
            {cam === "error" && <div style={{ fontSize: 13, fontWeight: 700, color: "white", lineHeight: 1.5 }}>{camErr}</div>}
            <button type="button" onClick={() => setCam("on")} style={{ cursor: "pointer", fontSize: 15, fontWeight: 800, padding: "12px 20px", borderRadius: 999, background: "white", color: G, border: "none", fontFamily: "inherit" }}>{cam === "error" ? "Thử mở lại camera" : "Bật camera để quét"}</button>
          </div>
        )}
        {cam === "on" && <div style={{ position: "absolute", left: 0, right: 0, bottom: 12, textAlign: "center", fontSize: 12, fontWeight: 700, color: "white", opacity: 0.85 }}>Đưa mã QR vào khung</div>}
      </div>

      <form onSubmit={(e) => { e.preventDefault(); if (manual.trim() && !busy) { void check(manual.trim()); setManual(""); } }} style={{ margin: "12px 16px 0", display: "flex", gap: 6 }}>
        {/* KHÔNG đổi chữ hoa: nội dung QR (token) phân biệt hoa thường — súng quét gõ vào ô này. Mã TX-VE-… máy chủ tự so không phân biệt hoa thường. */}
        <input value={manual} onChange={(e) => setManual(e.target.value)} placeholder="Nhập mã tay TX-VE-… / bắn súng quét" autoCapitalize="characters" autoComplete="off" style={{ ...inputCls, flex: 1, padding: "11px 14px", borderRadius: 14, fontFamily: "ui-monospace,monospace" }} />
        <button type="submit" disabled={busy} style={{ cursor: "pointer", fontSize: 14, fontWeight: 800, padding: "11px 16px", borderRadius: 14, background: G, color: "white", border: "none", fontFamily: "inherit" }}>Kiểm tra</button>
      </form>

      <div style={{ marginTop: 12, padding: "0 16px 16px", display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".08em", color: "oklch(0.5 0.08 158)" }}>VỪA QUÉT</div>
        {!log.length && <div style={{ fontSize: 13, color: MUTED }}>Chưa quét mã nào trong phiên này.</div>}
        {log.map((l, i) => (
          <button type="button" key={i} onClick={() => setRes(l.res)} title="Xem lại chi tiết" style={{ cursor: "pointer", textAlign: "left", font: "inherit", color: "inherit", border: "none", display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 12, background: "oklch(0.975 0.006 160)" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: R[l.k][4], flex: "none" }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 800 }}>{l.t}</div>
              <div style={{ fontSize: 11, color: "oklch(0.5 0.02 160)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l.s}</div>
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: "oklch(0.5 0.02 160)" }}>{l.at}</span>
          </button>
        ))}
      </div>
      {res && (
        <ScanPopup
          res={res}
          busy={busy}
          onClose={closePop}
          onDeliver={() => void check(res.code, true)}
        />
      )}
      <style>{`@keyframes tkScan{0%{top:16%}50%{top:82%}100%{top:16%}}@keyframes tkRise{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}`}</style>
    </div>
  );
}

/** "12 phút trước" / "2 giờ 5 phút trước" / "3 ngày trước". */
function ago(iso: string): string {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 1) return "vừa xong";
  if (m < 60) return `${m} phút trước`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} giờ ${m % 60 ? `${m % 60} phút ` : ""}trước`;
  return `${Math.floor(h / 24)} ngày trước`;
}

const HEAD: Record<ScanKind, string> = { ok: "HỢP LỆ", used: "ĐÃ SỬ DỤNG", wrong: "KHÔNG HỢP LỆ", food: "VOUCHER", none: "KHÔNG TÌM THẤY" };

function Row({ k, v, strong }: { k: string; v: ReactNode; strong?: boolean }) {
  return (
    <div style={{ display: "flex", gap: 12, padding: "9px 0", borderTop: "1px dashed oklch(0.9 0.01 160)" }}>
      <div style={{ width: 92, flex: "none", fontSize: 12.5, fontWeight: 700, color: "oklch(0.52 0.02 160)", paddingTop: 1 }}>{k}</div>
      <div style={{ flex: 1, minWidth: 0, fontSize: 14, lineHeight: 1.45, fontWeight: strong ? 800 : 600, color: "oklch(0.25 0.02 160)", overflowWrap: "anywhere" }}>{v}</div>
    </div>
  );
}

/** Popup kết quả quét: trạng thái lớn + chi tiết vé (khách, suất, đơn, lúc đã quét…). */
function ScanPopup({ res, busy, onClose, onDeliver }: { res: Res; busy: boolean; onClose: () => void; onDeliver: () => void }) {
  const S = R[res.kind];
  const d: ScanDetail | undefined = res.detail;
  const [hold, setHold] = useState(false);
  const auto = res.kind === "ok" && !hold;
  useEffect(() => {
    if (!auto) return;
    const id = setTimeout(onClose, OK_CLOSE_MS);
    return () => clearTimeout(id);
  }, [auto, onClose, res]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);

  const usedLine = d?.usedAt ? (
    <>
      <b>{vnDateTime(d.usedAt)}</b> · {ago(d.usedAt)}
      {d.usedBy ? (
        <>
          {" · bởi "}
          <b>{d.usedBy}</b>
        </>
      ) : null}
    </>
  ) : null;

  return (
    <div role="dialog" aria-modal="true" className="tkPopWrap" onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 80, background: "oklch(0.15 0.02 200 / .55)", display: "flex", justifyContent: "center", padding: 16 }}>
      <div className="tkPop" onClick={(e) => { e.stopPropagation(); setHold(true); }} style={{ width: 440, maxWidth: "100%", maxHeight: "calc(100dvh - 32px)", overflowY: "auto", background: "white", borderRadius: 26, boxShadow: "0 24px 60px oklch(0 0 0 / .3)", animation: "tkPopIn .22s ease both" }}>
        {/* Đầu popup: trạng thái */}
        <div style={{ position: "relative", background: S[0], padding: "22px 20px 18px", textAlign: "center", overflow: "hidden" }}>
          <div style={{ width: 68, height: 68, margin: "0 auto 10px", borderRadius: "50%", background: S[1], color: "white", fontSize: 34, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 0 8px color-mix(in oklch, ${S[1]} 18%, transparent)` }}>{S[3]}</div>
          <div style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: ".14em", color: S[1] }}>{HEAD[res.kind]}</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: S[2], lineHeight: 1.2, marginTop: 2 }}>{res.title}</div>
          {(res.kind === "wrong" || res.kind === "none" || !d) && <div style={{ marginTop: 6, fontSize: 14, lineHeight: 1.45, color: "oklch(0.32 0.03 160)" }}>{d?.orderState ?? res.sub}</div>}
          {auto && <div style={{ position: "absolute", left: 0, bottom: 0, height: 4, background: S[1], animation: `tkPopBar ${OK_CLOSE_MS}ms linear both` }} />}
        </div>

        <div style={{ padding: "16px 20px 6px" }}>
          {/* Đã dùng: nêu bật lúc / người quét */}
          {res.kind === "used" && usedLine && (
            <div style={{ marginBottom: 14, padding: "12px 14px", borderRadius: 16, background: "oklch(0.97 0.04 70)", border: "1px solid oklch(0.88 0.08 65)", fontSize: 14, lineHeight: 1.5, color: "oklch(0.38 0.1 50)" }}>
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".06em", marginBottom: 2 }}>{d?.ticketKind === "food" ? "ĐÃ GIAO LÚC" : "ĐÃ QUÉT VÀO LÚC"}</div>
              {usedLine}
            </div>
          )}

          {d ? (
            <>
              {/* Thẻ vé */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 16, background: "oklch(0.975 0.006 160)", marginBottom: 6 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 17, fontWeight: 900, color: "oklch(0.25 0.03 160)", lineHeight: 1.3 }}>{d.label}</div>
                  <div style={{ marginTop: 2, fontSize: 12.5, fontWeight: 700, fontFamily: "ui-monospace,monospace", color: "oklch(0.5 0.02 160)" }}>{d.ticketCode}</div>
                </div>
                {d.ticketKind === "entry" && d.count > 0 && (
                  <div style={{ flex: "none", textAlign: "center", padding: "6px 10px", borderRadius: 12, background: "white", border: "1px solid oklch(0.9 0.01 160)" }}>
                    <div style={{ fontSize: 18, fontWeight: 900, color: G, lineHeight: 1 }}>{d.index}/{d.count}</div>
                    <div style={{ fontSize: 10.5, fontWeight: 700, color: MUTED, marginTop: 2 }}>vé của đơn</div>
                  </div>
                )}
                {d.ticketKind === "food" && <span style={{ flex: "none", fontSize: 11.5, fontWeight: 800, padding: "4px 10px", borderRadius: 999, background: R.food[0], color: R.food[2] }}>Đồ ăn uống</span>}
              </div>

              <Row k="Khách hàng" strong v={<>{d.customer}{d.phone && <span style={{ color: MUTED, fontWeight: 600 }}>{" · " + d.phone}</span>}</>} />
              <Row k="Địa điểm" v={d.venue} />
              <Row k={d.time ? "Suất" : "Ngày"} v={d.time ? `${d.time} · ${d.date}` : d.date} />
              <Row k="Mã đơn" v={<span style={{ fontFamily: "ui-monospace,monospace" }}>{d.orderCode}</span>} />
              {d.items && <Row k="Đơn gồm" v={d.items} />}
              {d.ticketKind === "entry" && d.count > 1 && (
                <Row
                  k="Đã vào"
                  v={
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span>{d.usedCount}/{d.count} người</span>
                      <span style={{ display: "inline-flex", gap: 3, flexWrap: "wrap" }}>
                        {Array.from({ length: Math.min(d.count, 20) }, (_, i) => (
                          <span key={i} style={{ width: 9, height: 9, borderRadius: 3, background: i < d.usedCount ? "oklch(0.55 0.13 155)" : "oklch(0.9 0.01 160)" }} />
                        ))}
                      </span>
                    </span>
                  }
                />
              )}
              {res.kind === "ok" && usedLine && <Row k={d.ticketKind === "food" ? "Giao lúc" : "Vào lúc"} v={usedLine} />}
              {res.kind !== "used" && res.kind !== "ok" && usedLine && <Row k="Đã quét" v={usedLine} />}
              {d.note && <Row k="Ghi chú" v={<span style={{ fontStyle: "italic" }}>{d.note}</span>} />}
            </>
          ) : (
            !!res.code && (
              <div style={{ padding: "12px 14px", borderRadius: 16, background: "oklch(0.975 0.006 160)", fontSize: 13, color: "oklch(0.4 0.02 160)", lineHeight: 1.5 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: MUTED, marginBottom: 2 }}>Nội dung đã quét</div>
                <div style={{ fontFamily: "ui-monospace,monospace", overflowWrap: "anywhere" }}>{res.code.length > 120 ? res.code.slice(0, 120) + "…" : res.code}</div>
              </div>
            )
          )}
        </div>

        <div style={{ padding: "12px 20px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
          {res.kind === "food" && (
            <button type="button" disabled={busy} onClick={onDeliver} style={{ cursor: "pointer", fontSize: 15, fontWeight: 800, padding: "13px 16px", borderRadius: 16, background: R.food[1], color: "white", border: "none", fontFamily: "inherit", opacity: busy ? 0.6 : 1 }}>
              {busy ? "Đang lưu…" : "Xác nhận đã giao voucher"}
            </button>
          )}
          <button type="button" onClick={onClose} autoFocus style={{ cursor: "pointer", fontSize: 15, fontWeight: 800, padding: "13px 16px", borderRadius: 16, background: res.kind === "food" ? "oklch(0.95 0.01 160)" : G, color: res.kind === "food" ? "oklch(0.3 0.02 160)" : "white", border: "none", fontFamily: "inherit" }}>
            {res.kind === "food" ? "Để sau" : "Đóng · quét tiếp"}
          </button>
          {auto && <div style={{ textAlign: "center", fontSize: 11.5, color: MUTED }}>Tự đóng sau vài giây — chạm vào để giữ lại</div>}
        </div>
      </div>
      <style>{`.tkPopWrap{align-items:center}@media (max-width:640px){.tkPopWrap{align-items:flex-end;padding:0!important}.tkPop{border-radius:26px 26px 0 0!important;max-height:92dvh!important}}@keyframes tkPopIn{from{opacity:0;transform:translateY(16px) scale(.98)}to{opacity:1;transform:none}}@keyframes tkPopBar{from{width:100%}to{width:0}}`}</style>
    </div>
  );
}
