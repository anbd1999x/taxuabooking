"use client";

import { dmy } from "@/lib/date-format";
import { useEffect, useState } from "react";
import type { RoomStatus } from "@prisma/client";
import type { RoomGroup } from "./RoomGrid";

const G = "oklch(0.29 0.055 160)";
const O = "oklch(0.68 0.18 45)";
const M = "oklch(0.48 0.02 160)";

// Màu ô vuông + nhãn theo đúng thiết kế v2.
const SQ: Record<RoomStatus, [string, string]> = {
  AVAILABLE: ["oklch(0.66 0.14 155)", "none"],
  BOOKED: ["oklch(0.86 0.01 160)", "none"],
  PENDING: ["oklch(0.8 0.13 75)", "none"],
  CLOSED: ["oklch(0.55 0 0)", "none"],
};
const STATUS_NAME: Record<RoomStatus, string> = {
  AVAILABLE: "Trống",
  BOOKED: "Đã đặt",
  PENDING: "Chờ xác nhận",
  CLOSED: "Đóng",
};
const LEGEND_ORDER: RoomStatus[] = ["AVAILABLE", "BOOKED", "PENDING", "CLOSED"];
const SORT_ORDER: RoomStatus[] = ["AVAILABLE", "PENDING", "BOOKED", "CLOSED"];
const WDS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

function vnd(n: number | null | undefined) {
  if (n == null || n <= 0) return "—";
  return new Intl.NumberFormat("vi-VN").format(n) + "đ";
}
function dow(dateKey: string) {
  return new Date(dateKey + "T00:00:00Z").getUTCDay(); // 0=CN..6=T7
}

interface FlatRoom { id: string; name: string; typeName: string; type: string }

export function MonthOverview({
  groups,
  days,
  statuses,
  prices,
  monthLabel,
  todayKey,
}: {
  groups: RoomGroup[];
  days: string[];
  statuses: Record<string, RoomStatus>;
  prices: Record<string, number>;
  monthLabel: string;
  todayKey: string | null;
}) {
  const [sel, setSel] = useState<string | null>(null);
  const [w, setW] = useState(1440);
  useEffect(() => {
    const on = () => setW(window.innerWidth);
    on();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);

  const flat: FlatRoom[] = groups.flatMap((g) =>
    g.rooms.map((r) => ({ id: r.id, name: r.name, typeName: g.typeName, type: g.typeName })),
  );
  const total = flat.length;
  const stOf = (roomId: string, date: string): RoomStatus => statuses[`${roomId}|${date}`] ?? "AVAILABLE";
  const freeOf = (date: string) => flat.reduce((n, r) => n + (stOf(r.id, date) === "AVAILABLE" ? 1 : 0), 0);

  let monthFree = 0, fullDays = 0;
  for (const d of days) { const f = freeOf(d); monthFree += f; if (f === 0) fullDays++; }

  const mobile = w < 860;
  const cellH = mobile ? 66 : 84;
  const numSize = w < 520 ? 11 : 14;
  const sqSize = w < 520 ? 6 : 9;
  const calGap = mobile ? 4 : 6;

  const firstOffset = days.length ? (dow(days[0]) + 6) % 7 : 0;

  const freeColor = (f: number) => (f === 0 ? "oklch(0.55 0.19 28)" : f <= 2 ? "oklch(0.55 0.15 50)" : "oklch(0.42 0.12 155)");

  const card: React.CSSProperties = {
    background: "white",
    border: "1px solid oklch(0.91 0.01 150)",
    borderRadius: 18,
    padding: mobile ? 12 : 18,
    display: "flex",
    flexDirection: "column",
    gap: 12,
    minWidth: 0,
  };

  const groupLegend = groups.map((g, i) => `Hàng ${i + 1}: ${g.typeName}`);

  const calendar = (
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: "-.01em" }}>Phòng trống trong tháng</div>
          <div style={{ fontSize: 13, color: M, marginTop: 2 }}>Mỗi ô vuông nhỏ là một phòng. Bấm vào ngày để xem phòng nào trống.</div>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: 12, fontWeight: 600, color: "oklch(0.4 0.02 160)" }}>
          {groupLegend.map((g) => <span key={g} style={{ whiteSpace: "nowrap" }}>{g}</span>)}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,minmax(0,1fr))", gap: calGap }}>
        {WDS.map((n, i) => (
          <div key={n} style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: i >= 4 && i <= 5 ? "oklch(0.5 0.13 45)" : "oklch(0.5 0.02 160)", padding: "2px 0 4px" }}>{n}</div>
        ))}
        {Array.from({ length: firstOffset }).map((_, i) => <div key={`b${i}`} style={{ visibility: "hidden" }} />)}
        {days.map((date) => {
          const f = freeOf(date);
          const on = sel === date;
          const isToday = date === todayKey;
          const full = f === 0;
          return (
            <div
              key={date}
              onClick={() => setSel(on ? null : date)}
              style={{
                height: cellH, borderRadius: 12, padding: "6px 7px", display: "flex", flexDirection: "column",
                justifyContent: "space-between", gap: 4, cursor: "pointer",
                background: full ? "oklch(0.97 0.012 28)" : "white",
                border: isToday ? `2px solid ${O}` : "1px solid oklch(0.91 0.01 150)",
                boxShadow: on ? `0 0 0 2.5px ${O}` : "none",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: "oklch(0.3 0.02 160)" }}>{Number(date.slice(8, 10))}</span>
                <span style={{ fontSize: numSize, fontWeight: 800, letterSpacing: "-.02em", color: freeColor(f), whiteSpace: "nowrap" }}>{f}/{total}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {groups.map((g) => (
                  <div key={g.typeId} style={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
                    {g.rooms.map((r) => {
                      const [bg, bd] = SQ[stOf(r.id, date)];
                      return <span key={r.id} style={{ width: sqSize, height: sqSize, borderRadius: 2, background: bg, border: bd }} />;
                    })}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 12, fontWeight: 600, color: "oklch(0.4 0.02 160)" }}>
        {LEGEND_ORDER.map((k) => (
          <span key={k} style={{ display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: SQ[k][0], border: SQ[k][1] }} />{STATUS_NAME[k]}
          </span>
        ))}
      </div>
    </div>
  );

  // ---- Danh sách trong panel / sheet ----
  const listRows = sel
    ? [...flat].sort((a, b) => SORT_ORDER.indexOf(stOf(a.id, sel)) - SORT_ORDER.indexOf(stOf(b.id, sel))).map((r) => {
        const st = stOf(r.id, sel);
        const p = prices[`${r.id}|${sel}`];
        const showP = st === "AVAILABLE" || st === "PENDING";
        return {
          id: r.id, name: r.name,
          sub: STATUS_NAME[st] + (showP ? " · " + vnd(p) : ""),
          v: st === "AVAILABLE" ? "Trống" : "",
          vc: "oklch(0.42 0.12 155)", sq: SQ[st][0], sqbd: SQ[st][1],
        };
      })
    : groups.flatMap((g) => g.rooms.map((r) => {
        let f = 0; for (const d of days) if (stOf(r.id, d) === "AVAILABLE") f++;
        return {
          id: r.id, name: r.name, sub: g.typeName,
          v: `${f} đêm trống`,
          vc: f === 0 ? "oklch(0.55 0.19 28)" : f <= 3 ? "oklch(0.55 0.15 50)" : "oklch(0.42 0.12 155)",
          sq: "oklch(0.66 0.14 155)", sqbd: "none",
        };
      }));

  const selWd = sel ? ["CN", "T2", "T3", "T4", "T5", "T6", "T7"][dow(sel)] : "";
  const panelTitle = sel ? `${selWd}, ${dmy(sel)}` : "Đêm còn trống theo phòng";
  const panelSub = sel ? `${freeOf(sel)}/${total} phòng trống` : monthLabel;

  const listItems = (
    <>
      {listRows.map((r) => (
        <div key={r.id} style={{ display: "grid", gridTemplateColumns: "12px minmax(0,1fr) auto", gap: 10, alignItems: "center", padding: 10, borderRadius: 12, border: "1px solid oklch(0.93 0.01 150)" }}>
          <span style={{ width: 12, height: 12, borderRadius: 3, background: r.sq, border: r.sqbd }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, whiteSpace: "nowrap" }}>{r.name}</div>
            <div style={{ fontSize: 12, color: M, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.sub}</div>
          </div>
          <div style={{ fontSize: 14, fontWeight: 800, whiteSpace: "nowrap", color: r.vc }}>{r.v}</div>
        </div>
      ))}
    </>
  );

  const panel = (
    <div style={{ position: "sticky", top: 16, ...card, gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
        <div style={{ fontSize: 16, fontWeight: 800 }}>{panelTitle}</div>
        {sel && <div onClick={() => setSel(null)} style={{ cursor: "pointer", fontSize: 13, fontWeight: 700, color: M }}>Cả tháng</div>}
      </div>
      <div style={{ fontSize: 12, color: M, marginTop: -6 }}>{panelSub}</div>
      {listItems}
      {!sel && <div style={{ fontSize: 12, lineHeight: 1.5, color: M }}>Bấm vào ngày để xem từng phòng trống/đã đặt và giá đêm đó. Sửa tình trạng ở chế độ “Theo từng phòng”.</div>}
    </div>
  );

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: mobile ? "minmax(0,1fr)" : "minmax(0,1fr) 320px", gap: 16, alignItems: "start" }}>
        {calendar}
        {!mobile && panel}
      </div>

      {/* Mobile: bottom sheet khi chọn ngày */}
      {mobile && sel && (
        <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 20, background: "white", borderRadius: "22px 22px 0 0", boxShadow: "0 -14px 40px -12px oklch(0.2 0.03 160 / .35)", padding: "10px 16px 18px", display: "flex", flexDirection: "column", gap: 10, maxHeight: "66vh", overflowY: "auto" }}>
          <div style={{ alignSelf: "center", width: 40, height: 4, borderRadius: 2, background: "oklch(0.85 0.01 150)" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <div><div style={{ fontSize: 16, fontWeight: 800 }}>{panelTitle}</div><div style={{ fontSize: 12, color: M }}>{panelSub}</div></div>
            <div onClick={() => setSel(null)} style={{ cursor: "pointer", fontSize: 14, fontWeight: 700, padding: "9px 14px", borderRadius: 10, background: "oklch(0.95 0.01 150)" }}>Đóng</div>
          </div>
          {listItems}
        </div>
      )}
    </>
  );
}
