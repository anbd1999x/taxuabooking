"use client";

import { useEffect, useMemo, useState } from "react";
import { DINE_GATES, hm, money, type DineData, type DineGuestRow, type DineMenuTr, type DineMenuVM, type Tr3 } from "@/lib/dine-core";
import { showToast } from "@/components/admin/Toast";
import { Empty, G, MUTED, O } from "./ui";

/**
 * Phần mở rộng của tab "Gọi món QR": bản dịch từng món (MenuTrPanel), danh sách khách đã ghé (GuestsPanel),
 * cách hỏi thông tin ở màn "Chào mừng" (GateSetup). Các op ở đây trả dữ liệu RIÊNG (không phải dữ liệu màn quán)
 * nên gọi thẳng API bằng `dineApi` thay vì `call` của DineTab.
 */
const LINE = "oklch(0.92 0.01 160)";
const inp: React.CSSProperties = { fontSize: 13, padding: "8px 10px", borderRadius: 9, border: "1.5px solid oklch(0.88 0.015 160)", fontFamily: "inherit", minWidth: 0, width: "100%", background: "white", boxSizing: "border-box" };
const LANGS: [keyof Tr3, string][] = [["en", "English"], ["zh", "中文"], ["ko", "한국어"]];

async function dineApi<T>(venueId: string, op: string, payload: Record<string, unknown> = {}): Promise<(T & { message?: string }) | null> {
  try {
    const r = await fetch("/api/admin/dine", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...payload, venueId, op }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      showToast(j.error ?? "Có lỗi, thử lại.", "error");
      return null;
    }
    return j;
  } catch {
    showToast("Mất kết nối, thử lại.", "error");
    return null;
  }
}

/**
 * Bản dịch en / zh / ko của MỘT món: tên, nhóm món (dùng chung cho mọi món cùng nhóm) và mô tả. Mở ra mới nạp.
 * Ô trống = khách ngôn ngữ đó thấy tiếng Việt. Quán sửa tên / mô tả gốc ⇒ bản dịch cũ hết hiệu lực, phải dịch lại.
 */
export function MenuTrPanel({ m, venueId, onClose }: { m: DineMenuVM; venueId: string; onClose: () => void }) {
  const [tr, setTr] = useState<DineMenuTr | null>(null);
  const [busy, setBusy] = useState(false);
  // Khoá theo chuỗi gốc: quán vừa sửa tên / mô tả thì nạp lại (bản dịch cũ không còn khớp).
  const sig = `${m.id}|${m.name}|${m.group}|${m.desc}`;
  useEffect(() => {
    let off = false;
    void dineApi<{ tr: DineMenuTr }>(venueId, "menuTrGet", { id: m.id }).then((j) => !off && j && setTr(j.tr));
    return () => {
      off = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venueId, sig]);
  const set = (part: keyof DineMenuTr, l: keyof Tr3, v: string) => setTr((t) => (t ? { ...t, [part]: { ...t[part], [l]: v } } : t));
  async function save() {
    if (!tr || busy) return;
    setBusy(true);
    const j = await dineApi<{ tr: DineMenuTr }>(venueId, "menuTrSave", { id: m.id, tr });
    setBusy(false);
    if (j) {
      setTr(j.tr);
      showToast(j.message ?? "Đã lưu bản dịch.");
    }
  }
  const rows: [keyof DineMenuTr, string, string, boolean][] = [["name", "Tên món", m.name, false], ["group", "Nhóm món", m.group, false], ["desc", "Mô tả", m.desc, true]];
  return (
    <div style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: 10, padding: 12, borderRadius: 12, background: "oklch(0.975 0.008 155)", border: `1px solid ${LINE}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <b style={{ fontSize: 13 }}>🌐 Bản dịch cho khách nước ngoài</b>
        <span style={{ fontSize: 12, color: MUTED }}>Ô trống = khách thấy tiếng Việt · sửa tên / mô tả gốc thì phải dịch lại</span>
      </div>
      {!tr ? (
        <span style={{ fontSize: 13, color: MUTED }}>Đang tải…</span>
      ) : (
        rows.filter(([, , src]) => src).map(([part, label, src, long]) => (
          <div key={part} style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <div style={{ fontSize: 12, color: MUTED }}><b style={{ color: "oklch(0.3 0.03 160)" }}>{label}:</b> {src.length > 110 ? src.slice(0, 110) + "…" : src}{part === "group" && " · áp dụng cho mọi món cùng nhóm"}</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,190px),1fr))", gap: 6 }}>
              {LANGS.map(([l, name]) =>
                long ? (
                  <textarea key={l} value={tr[part][l]} rows={3} maxLength={800} onChange={(e) => set(part, l, e.target.value)} placeholder={name} aria-label={`${label} — ${name}`} style={{ ...inp, resize: "vertical", lineHeight: 1.4 }} />
                ) : (
                  <input key={l} value={tr[part][l]} maxLength={120} onChange={(e) => set(part, l, e.target.value)} placeholder={name} aria-label={`${label} — ${name}`} style={inp} />
                ),
              )}
            </div>
          </div>
        ))
      )}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
        <button type="button" onClick={onClose} style={{ cursor: "pointer", fontSize: 13, fontWeight: 800, padding: "8px 14px", borderRadius: 999, border: `1.5px solid ${LINE}`, background: "white", fontFamily: "inherit" }}>Đóng</button>
        <button type="button" disabled={!tr || busy} onClick={() => void save()} style={{ cursor: "pointer", fontSize: 13, fontWeight: 800, padding: "8px 16px", borderRadius: 999, border: "none", background: G, color: "white", fontFamily: "inherit", opacity: !tr || busy ? 0.6 : 1 }}>{busy ? "Đang lưu…" : "Lưu bản dịch"}</button>
      </div>
    </div>
  );
}

const dmy = (ms: number) => {
  const d = new Date(ms + 7 * 3_600_000);
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
};
const plain = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();

/** KHÁCH HÀNG: những khách đã khai tên ở màn "Chào mừng" trong 180 ngày — gom theo SĐT, lọc theo tên / số, đánh dấu khách quen. */
export function GuestsPanel({ venueId, wide }: { venueId: string; wide: boolean }) {
  const [list, setList] = useState<DineGuestRow[] | null>(null);
  const [find, setFind] = useState("");
  const [onlyBack, setOnlyBack] = useState(false);
  useEffect(() => {
    let off = false;
    void dineApi<{ guests: DineGuestRow[] }>(venueId, "guests").then((j) => !off && setList(j?.guests ?? []));
    return () => {
      off = true;
    };
  }, [venueId]);
  const shown = useMemo(() => {
    const k = plain(find.trim());
    return (list ?? []).filter((g) => (!onlyBack || g.visits > 1) && (!k || plain(g.name).includes(k) || g.phone.includes(k.replace(/\D/g, "") || "~")));
  }, [list, find, onlyBack]);
  if (!list) return <Empty>Đang tải…</Empty>;
  const back = list.filter((g) => g.visits > 1).length;
  const kpi = (k: string, v: string, c: string) => (
    <div style={{ flex: "1 1 130px", padding: "10px 12px", borderRadius: 14, border: `1.5px solid ${LINE}`, background: "white" }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: MUTED }}>{k}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: c }}>{v}</div>
    </div>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ fontSize: 13, color: MUTED }}>Khách tự khai tên / số điện thoại ở màn “Chào mừng” khi quét mã QR. Tính trong 180 ngày gần nhất, gom theo số điện thoại.</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {kpi("Khách đã ghé", String(list.length), G)}
        {kpi("Khách quay lại", String(back), O)}
        {kpi("Có số điện thoại", String(list.filter((g) => g.phone).length), "oklch(0.55 0.13 250)")}
        {kpi("Tổng đã gọi", money(list.reduce((a, g) => a + g.spent, 0)), "oklch(0.55 0.12 155)")}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input value={find} onChange={(e) => setFind(e.target.value)} placeholder="Tìm theo tên hoặc số điện thoại" style={{ ...inp, flex: "1 1 220px", width: "auto", fontSize: 14, padding: "10px 12px" }} />
        <button type="button" onClick={() => setOnlyBack(!onlyBack)} style={{ cursor: "pointer", fontSize: 13, fontWeight: 800, padding: "9px 14px", borderRadius: 999, border: `1.5px solid ${onlyBack ? O : LINE}`, background: onlyBack ? "oklch(0.97 0.04 75)" : "white", color: onlyBack ? "oklch(0.45 0.13 50)" : "inherit", fontFamily: "inherit" }}>Chỉ khách quay lại</button>
      </div>
      {!shown.length && <Empty>{list.length ? "Không có khách nào khớp." : "Chưa có khách nào khai thông tin — khách quét mã QR ở bàn, nhập tên rồi gọi món là hiện ở đây."}</Empty>}
      {shown.map((g) => (
        <div key={g.key} style={{ display: "grid", gridTemplateColumns: wide ? "minmax(0,1.4fr) minmax(0,1fr) auto" : "minmax(0,1fr) auto", gap: 10, alignItems: "center", padding: "10px 12px", borderRadius: 14, border: `1px solid ${LINE}`, background: "white" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <b style={{ fontSize: 15 }}>{g.name}</b>
              {g.visits > 1 && <span style={{ fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 999, background: "oklch(0.97 0.04 75)", color: "oklch(0.45 0.13 50)" }}>Khách quen · {g.visits} lượt</span>}
            </div>
            <div style={{ fontSize: 13, color: MUTED }}>
              {g.phone ? <a href={`tel:${g.phone}`} style={{ color: "oklch(0.4 0.1 250)", fontWeight: 700 }}>{g.phone}</a> : "Không để lại số"} · {g.pax} khách · bàn {g.lastTable}
            </div>
          </div>
          {wide && <div style={{ minWidth: 0, fontSize: 12, color: MUTED, lineHeight: 1.4 }}>Hay gọi: {g.top.join(", ") || "—"}</div>}
          <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
            <div style={{ fontSize: 15, fontWeight: 800 }}>{money(g.spent)}</div>
            <div style={{ fontSize: 12, color: MUTED }}>{dmy(g.lastAt)} {hm(g.lastAt)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Màn "Chào mừng" của trang khách hỏi gì trước khi mở thực đơn (lưu vào cấu hình quán, áp dụng ngay cho mọi bàn). */
export function GateSetup({ d, busy, call }: { d: DineData; busy: boolean; call: (op: string, payload?: Record<string, unknown>) => Promise<boolean> }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 14, borderRadius: 16, border: `1.5px solid ${LINE}`, background: "white" }}>
      <div>
        <div style={{ fontSize: 15, fontWeight: 800 }}>Hỏi thông tin khi khách quét mã</div>
        <div style={{ fontSize: 13, color: MUTED }}>Màn “Chào mừng” hiện trước thực đơn. Thông tin khách hiện ở thẻ đơn, sơ đồ bàn và mục Khách hàng.</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,210px),1fr))", gap: 8 }}>
        {DINE_GATES.map(([key, title, sub]) => {
          const on = d.venue.gate === key;
          return (
            <button key={key} type="button" disabled={busy || on} onClick={() => void call("gate", { gate: key })} style={{ cursor: on ? "default" : "pointer", display: "flex", flexDirection: "column", gap: 3, textAlign: "left", padding: "11px 12px", borderRadius: 12, border: `2px solid ${on ? G : LINE}`, background: on ? "oklch(0.96 0.03 155)" : "white", fontFamily: "inherit", color: "inherit" }}>
              <b style={{ fontSize: 14 }}>{on ? "✓ " : ""}{title}</b>
              <span style={{ fontSize: 12, color: MUTED, lineHeight: 1.4 }}>{sub}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
