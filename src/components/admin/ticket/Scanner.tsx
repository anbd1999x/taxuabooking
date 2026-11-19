"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ScanKind, ScanResult, TkVenueRef } from "@/lib/ticket-core";
import { G, MUTED, inputCls } from "./ui";

/** [nền, biểu tượng, chữ, ký hiệu, chấm nhật ký] */
const R: Record<ScanKind, [string, string, string, string, string]> = {
  ok: ["oklch(0.94 0.06 155)", "oklch(0.5 0.13 155)", "oklch(0.32 0.1 155)", "✓", "oklch(0.55 0.13 155)"],
  used: ["oklch(0.96 0.05 70)", "oklch(0.68 0.16 55)", "oklch(0.45 0.13 50)", "!", "oklch(0.7 0.15 60)"],
  wrong: ["oklch(0.96 0.03 28)", "oklch(0.58 0.19 28)", "oklch(0.48 0.17 28)", "×", "oklch(0.6 0.19 28)"],
  food: ["oklch(0.95 0.03 250)", "oklch(0.55 0.13 250)", "oklch(0.4 0.12 250)", "F", "oklch(0.55 0.13 250)"],
  none: ["oklch(0.96 0.005 160)", "oklch(0.55 0.01 160)", "oklch(0.35 0.02 160)", "?", "oklch(0.6 0.01 160)"],
};
type Log = { k: ScanKind; t: string; s: string; at: string };
type Detector = { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> };

/**
 * Soát vé bằng camera điện thoại — theo mẫu tab "Soát vé" của "Ban ve - Quan tri".
 * Đọc QR bằng BarcodeDetector (Chrome / Android), không có thì dùng jsQR (Safari iOS). Mỗi vé một mã; nhập tay được mã vé / mã đơn.
 */
export function Scanner({ venues, who, initial }: { venues: TkVenueRef[]; who: string; initial: { checked: number; total: number } }) {
  const [venueId, setVenueId] = useState("");
  const [stats, setStats] = useState(initial);
  const [res, setRes] = useState<(ScanResult & { code: string }) | null>(null);
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

  const check = useCallback(async (code: string, deliver = false) => {
    setBusy(true);
    try {
      const r = await fetch("/api/admin/ticket", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ op: "scan", venueId: venueRef.current, code, deliver }) });
      const j = await r.json();
      const result: ScanResult = r.ok ? j.result : { kind: "none", title: "Không kiểm tra được", sub: j.error ?? "Mất kết nối, thử lại" };
      if (r.ok && j.stats) setStats(j.stats);
      setRes({ ...result, code });
      setLog((l) => [{ k: result.kind, t: result.title, s: result.sub.split(" · ")[0], at: new Date().toTimeString().slice(0, 5) }, ...l].slice(0, 8));
      if (navigator.vibrate) navigator.vibrate(result.kind === "ok" ? 60 : [80, 60, 80]);
    } catch {
      setRes({ kind: "none", title: "Mất kết nối", sub: "Kiểm tra mạng rồi quét lại", code });
    } finally {
      setBusy(false);
    }
  }, []);

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
  const S = res ? R[res.kind] : null;

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

      {res && S && (
        <div onClick={() => res.kind === "food" && !busy && check(res.code, true)} style={{ margin: "12px 16px 0", padding: 14, borderRadius: 20, background: S[0], display: "flex", gap: 12, alignItems: "center", animation: "tkRise .25s ease both", cursor: res.kind === "food" ? "pointer" : "default" }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", background: S[1], color: "white", fontSize: 24, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>{S[3]}</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: S[2] }}>{res.title}</div>
            <div style={{ fontSize: 13, lineHeight: 1.45, color: "oklch(0.3 0.02 160)" }}>{res.sub}</div>
          </div>
        </div>
      )}

      <form onSubmit={(e) => { e.preventDefault(); if (manual.trim() && !busy) void check(manual.trim()); }} style={{ margin: "12px 16px 0", display: "flex", gap: 6 }}>
        <input value={manual} onChange={(e) => setManual(e.target.value.toUpperCase())} placeholder="Nhập mã tay TX-VE-…" autoCapitalize="characters" autoComplete="off" style={{ ...inputCls, flex: 1, padding: "11px 14px", borderRadius: 14, fontFamily: "ui-monospace,monospace" }} />
        <button type="submit" disabled={busy} style={{ cursor: "pointer", fontSize: 14, fontWeight: 800, padding: "11px 16px", borderRadius: 14, background: G, color: "white", border: "none", fontFamily: "inherit" }}>Kiểm tra</button>
      </form>

      <div style={{ marginTop: 12, padding: "0 16px 16px", display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".08em", color: "oklch(0.5 0.08 158)" }}>VỪA QUÉT</div>
        {!log.length && <div style={{ fontSize: 13, color: MUTED }}>Chưa quét mã nào trong phiên này.</div>}
        {log.map((l, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 12, background: "oklch(0.975 0.006 160)" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: R[l.k][4], flex: "none" }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 800 }}>{l.t}</div>
              <div style={{ fontSize: 11, color: "oklch(0.5 0.02 160)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l.s}</div>
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: "oklch(0.5 0.02 160)" }}>{l.at}</span>
          </div>
        ))}
      </div>
      <style>{`@keyframes tkScan{0%{top:16%}50%{top:82%}100%{top:16%}}@keyframes tkRise{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}`}</style>
    </div>
  );
}
