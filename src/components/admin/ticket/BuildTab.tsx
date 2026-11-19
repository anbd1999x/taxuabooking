"use client";

import { useRef, useState } from "react";
import { MAX_COLS, MAX_ROWS, cellType, countCells, rowName, unitWord, type CellType, type SeatLayout } from "@/lib/ticket-core";
import { Act, G, Head, MUTED, Stepper, VenuePick, card, money, useWidth, type Ctx } from "./ui";

/** [nền, viền, kiểu viền, ký hiệu] */
const CELL: Record<CellType, [string, string, string, string]> = {
  vip: ["oklch(0.95 0.06 75)", "oklch(0.72 0.13 60)", "solid", ""],
  norm: ["oklch(0.95 0.035 155)", "oklch(0.66 0.09 155)", "solid", ""],
  aisle: ["transparent", "oklch(0.88 0.01 160)", "dashed", ""],
  broken: ["oklch(0.96 0.02 28)", "oklch(0.7 0.12 28)", "solid", "×"],
  empty: ["transparent", "transparent", "solid", ""],
};

/** Tab DỰNG SƠ ĐỒ: chọn số hàng × cột, chọn công cụ rồi bấm / kéo qua các ô để tô. */
export function BuildTab({ ctx }: { ctx: Ctx }) {
  const { data, call, busy } = ctx;
  const w = useWidth();
  const inner = w - (w >= 1024 ? 256 : 0);
  const [layout, setLayout] = useState<SeatLayout>(data.venue.layout);
  const [brush, setBrush] = useState<CellType>("vip");
  const [dirty, setDirty] = useState(false);
  const painting = useRef(false);

  const price = (cls: "vip" | "norm") => data.tiers.find((t) => t.seatClass === cls)?.price ?? 0;
  const cnt = countCells(layout);
  const paint = (r: number, c: number) => {
    setLayout((l) => {
      if (cellType(l, r, c) === brush) return l;
      const cells = { ...l.cells };
      if (brush === "norm") delete cells[`${r}-${c}`];
      else cells[`${r}-${c}`] = brush;
      return { ...l, cells };
    });
    setDirty(true);
  };
  /** Chạm / kéo: tìm ô dưới con trỏ (pointerenter không chạy khi kéo bằng tay trên màn cảm ứng). */
  const paintAt = (x: number, y: number) => {
    const el = (document.elementFromPoint(x, y) as HTMLElement | null)?.closest<HTMLElement>("[data-cell]");
    if (!el) return;
    const [r, c] = el.dataset.cell!.split("-").map(Number);
    paint(r, c);
  };
  const dim = (key: "rows" | "cols", d: number) => {
    setLayout((l) => {
      const v = Math.min(key === "rows" ? MAX_ROWS : MAX_COLS, Math.max(1, l[key] + d));
      const next = { ...l, [key]: v };
      const cells: Record<string, CellType> = {};
      for (const [k, t] of Object.entries(l.cells)) {
        const [r, c] = k.split("-").map(Number);
        if (r < next.rows && c < next.cols) cells[k] = t;
      }
      return { ...next, cells };
    });
    setDirty(true);
  };

  const W = unitWord(data.venue.config.seatUnit);
  const B: [CellType, string, string][] = [
    ["vip", `${W} ${data.tiers.find((t) => t.seatClass === "vip")?.name ?? "VIP"}`, money(price("vip"))],
    ["norm", `${W} ${data.tiers.find((t) => t.seatClass === "norm")?.name ?? "Thường"}`, money(price("norm"))],
    ["aisle", "Lối đi", "Không bán"],
    ["broken", `${W} hỏng`, "Tạm khoá, không bán"],
    ["empty", "Xoá ô", "Để trống hoàn toàn"],
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Head title={`Dựng sơ đồ ${W.toLowerCase()} · ${data.venue.name}`} note="Chọn số hàng × cột, rồi chọn công cụ và bấm hoặc kéo qua các ô để tô" right={<VenuePick ctx={ctx} />} />
      <div style={{ display: "grid", gridTemplateColumns: inner >= 900 ? "300px minmax(0,1fr)" : "1fr", gap: 14, alignItems: "start" }}>
        <div style={{ ...card, gap: 14 }}>
          {([["Số hàng", "rows"], ["Số cột", "cols"]] as const).map(([k, key]) => (
            <div key={key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 14, fontWeight: 800 }}>{k}</span>
              <Stepper value={layout[key]} onDec={() => dim(key, -1)} onInc={() => dim(key, 1)} />
            </div>
          ))}
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".08em", color: "oklch(0.5 0.08 158)" }}>CÔNG CỤ</div>
          {B.map(([k, name, note]) => (
            <div key={k} onClick={() => setBrush(k)} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 14, border: `2px solid ${brush === k ? G : "oklch(0.92 0.01 160)"}`, background: brush === k ? "oklch(0.97 0.02 155)" : "white" }}>
              <span style={{ width: 20, height: 20, borderRadius: "5px 5px 2px 2px", background: k === "aisle" || k === "empty" ? "white" : CELL[k][0], border: `1.5px solid ${k === "empty" ? "oklch(0.92 0.005 160)" : k === "aisle" ? "oklch(0.8 0.01 160)" : CELL[k][1]}`, flex: "none" }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 800 }}>{name}</div>
                <div style={{ fontSize: 12, color: "oklch(0.5 0.02 160)" }}>{note}</div>
              </div>
              <span style={{ fontSize: 13, fontWeight: 800, color: "oklch(0.45 0.02 160)" }}>{cnt[k]}</span>
            </div>
          ))}
          <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: 12, borderRadius: 14, background: "oklch(0.975 0.012 155)", fontSize: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span>Tổng {W.toLowerCase()} bán được</span><b>{cnt.vip + cnt.norm}</b></div>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span>Doanh thu tối đa</span><b style={{ color: "oklch(0.58 0.17 45)" }}>{money(cnt.vip * price("vip") + cnt.norm * price("norm"))}</b></div>
          </div>
          <Act kind="pri" block disabled={busy || !dirty} onClick={async () => { if (await call("saveLayout", { layout })) setDirty(false); }}>{dirty ? "Lưu sơ đồ" : "Sơ đồ đã lưu"}</Act>
          <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.5 }}>Giá ghế VIP / Thường sửa ở tab Thiết lập. Ghế đang có đơn ở suất sắp tới không bỏ được.</div>
        </div>
        <div
          onPointerDown={(e) => { painting.current = true; paintAt(e.clientX, e.clientY); }}
          onPointerMove={(e) => painting.current && paintAt(e.clientX, e.clientY)}
          onPointerUp={() => (painting.current = false)}
          onPointerLeave={() => (painting.current = false)}
          onPointerCancel={() => (painting.current = false)}
          style={{ background: "white", border: "1px solid oklch(0.92 0.008 160)", borderRadius: 20, padding: 14, overflow: "auto", touchAction: "none", userSelect: "none", minWidth: 0 }}
        >
          <div style={{ width: "max-content", margin: "0 auto", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <div style={{ width: "80%", marginBottom: 10, padding: "6px 0", borderRadius: "0 0 50px 50px / 0 0 18px 18px", background: G, color: "white", textAlign: "center", fontSize: 11, fontWeight: 800, letterSpacing: ".2em" }}>SÂN KHẤU</div>
            {Array.from({ length: layout.rows }, (_, r) => (
              <div key={r} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 16, fontSize: 11, fontWeight: 800, color: "oklch(0.55 0.02 160)", textAlign: "center" }}>{rowName(r)}</span>
                {Array.from({ length: layout.cols }, (_, c) => {
                  const t = cellType(layout, r, c), S = CELL[t];
                  return (
                    <div key={c} data-cell={`${r}-${c}`} style={{ cursor: "crosshair", width: 26, height: 26, borderRadius: t === "aisle" || t === "empty" ? 4 : "7px 7px 3px 3px", background: S[0], border: `1.5px ${S[2]} ${t === "empty" ? "oklch(0.94 0.005 160)" : S[1]}`, color: "oklch(0.5 0.1 28)", fontSize: 12, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {S[3]}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
