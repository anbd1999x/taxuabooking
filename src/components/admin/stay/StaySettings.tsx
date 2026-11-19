"use client";

import { useEffect, useRef, useState } from "react";
import type { HomeData } from "@/lib/stay";
import { STAY_SOURCES, hh, type HomeConfig } from "@/lib/stay-core";
import type { CallFn } from "./StayManager";
import { Stepper } from "./StayDrawer";
import { BORDER, D, DIM, G, M, O, card, digits, input, kicker } from "./ui";

type Props = { data: HomeData; call: CallFn; say: (t: string) => void; busy: boolean; viewerRole: "ADMIN" | "PROVIDER" | "STAFF" };

/** Tab Cài đặt của Quản lý phòng: giờ & phụ phí, giá (xem), ngày lễ, dịch vụ phát sinh, nguồn khách, nhân viên. */
export function StaySettings({ data, call, busy, viewerRole }: Props) {
  const [draft, setDraft] = useState<HomeConfig>(data.cfg);
  const [svcs, setSvcs] = useState(data.cfg.svcs.map((s) => ({ name: s.name, price: String(s.price) })));
  const [nf, setNf] = useState({ name: "", username: "", phone: "", password: "" });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Dữ liệu server đổi (vd sau khi lưu) ⇒ đồng bộ bản nháp khi không còn thay đổi chờ lưu.
  useEffect(() => {
    if (!timer.current) setDraft(data.cfg);
  }, [data.cfg]);

  const patch = (p: Partial<HomeConfig>, now = false) => {
    const next = { ...draft, ...p };
    setDraft(next);
    if (timer.current) clearTimeout(timer.current);
    const run = () => {
      timer.current = null;
      void call({ op: "saveCfg", patch: next });
    };
    if (now) run();
    else timer.current = setTimeout(run, 700);
  };

  const cfgRows: [string, keyof HomeConfig, number, (v: number) => string, number, number][] = [
    ["Giờ nhận phòng", "ci", 1, (v) => hh(v), 10, 16],
    ["Giờ trả phòng", "co", 1, (v) => hh(v), 9, 14],
    ["Phí nhận sớm", "early", 50000, M, 0, 1_000_000],
    ["Phí trả muộn", "late", 50000, M, 0, 1_000_000],
    ["Giữ chỗ chưa cọc", "hold", 1, (v) => v + " giờ", 1, 48],
  ];

  const rateRows = data.types.map((t) => {
    const rs = data.rooms.filter((r) => r.typeId === t.id);
    const wdP = rs.flatMap((r) => [1, 2, 3, 4].map((i) => r.dow[i])).filter((p) => p > 0);
    const weP = rs.flatMap((r) => [5, 6].map((i) => r.dow[i])).filter((p) => p > 0);
    return { id: t.id, name: t.name, wd: wdP.length ? Math.min(...wdP) : 0, we: weP.length ? Math.min(...weP) : 0 };
  });
  const staffBox = { padding: "10px 12px", borderRadius: 12, background: "oklch(0.975 0.006 160)" };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(min(100%,360px),1fr))", gap: 12, alignItems: "start" }}>
      {data.hasSheet && (
        <div style={{ gridColumn: "1 / -1", display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap", padding: "14px 16px", borderRadius: 16, background: "oklch(0.97 0.04 75)", border: "1px solid oklch(0.88 0.07 70)", fontSize: 14, lineHeight: 1.55, color: "oklch(0.4 0.09 55)" }}>
          <b style={{ whiteSpace: "nowrap" }}>Đồng bộ Google Sheet / lịch ngoài đang bật.</b>
          <span>Sheet vẫn khoá thêm phòng được, nhưng lượt ở và ngày đóng phòng tạo ở đây luôn được giữ, sheet không xoá được.</span>
        </div>
      )}

      <div style={card}>
        <div style={{ fontSize: 16, fontWeight: 800 }}>Giờ &amp; phụ phí</div>
        {cfgRows.map(([k, key, step, fmt, mn, mx]) => {
          const v = draft[key] as number;
          return (
            <div key={key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 14, fontWeight: 700 }}>{k}</span>
              <Stepper value={fmt(v)} dec={() => patch({ [key]: Math.max(mn, v - step) } as Partial<HomeConfig>)} inc={() => patch({ [key]: Math.min(mx, v + step) } as Partial<HomeConfig>)} />
            </div>
          );
        })}
        <div style={{ fontSize: 12, color: DIM }}>Phụ thu người thêm theo mức chung của homestay: {data.extraFee ? M(data.extraFee) + "/người/đêm" : "chưa đặt"}.</div>
      </div>

      <div style={card}>
        <div style={{ fontSize: 16, fontWeight: 800 }}>Giá theo hạng phòng</div>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 100px 100px", gap: 6, fontSize: 12, fontWeight: 800, color: DIM }}>
          <span>Hạng</span><span style={{ textAlign: "right" }}>Ngày thường</span><span style={{ textAlign: "right" }}>T6 · T7</span>
        </div>
        {rateRows.map((r) => (
          <div key={r.id} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 100px 100px", gap: 6, alignItems: "center", fontSize: 14 }}>
            <span style={{ fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
            {[r.wd, r.we].map((p, i) => <span key={i} style={{ fontSize: 14, fontWeight: 700, textAlign: "right", padding: "7px 8px", borderRadius: 9, background: "oklch(0.97 0.004 160)", border: `1.5px solid ${BORDER}` }}>{p ? p.toLocaleString("vi-VN") : "—"}</span>)}
          </div>
        ))}
        <div style={{ fontSize: 12, color: DIM }}>Giá thấp nhất trong hạng. Giá từng phòng (cả giá theo thứ) do quản trị sửa ở trang Sửa homestay — áp cho trang homestay công khai và combo.</div>
        <div style={{ ...kicker, marginTop: 4 }}>NGÀY LỄ SẮP TỚI</div>
        {!data.holidays.length && <div style={{ fontSize: 13, color: DIM }}>Lịch ngày lễ chưa có ngày nào sắp tới.</div>}
        {data.holidays.map((h, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13, padding: "8px 10px", borderRadius: 10, background: "oklch(0.97 0.03 80)" }}>
            <b style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.name}</b>
            <span style={{ whiteSpace: "nowrap" }}>
              {h.yearly ? `${h.from.slice(8, 10)}/${h.from.slice(5, 7)}${h.to !== h.from ? ` → ${h.to.slice(8, 10)}/${h.to.slice(5, 7)}` : ""} · hằng năm` : `${D(h.from)}${h.to !== h.from ? ` → ${D(h.to)}` : ""}`}
            </span>
          </div>
        ))}
        {(() => {
          const withHol = data.rooms.filter((r) => r.hol > 0);
          return (
            <div style={{ fontSize: 12, lineHeight: 1.5, color: DIM }}>
              Lịch ngày lễ do quản trị khai chung cho cả sàn. Giá ngày lễ đặt riêng từng phòng ở trang <b>Sửa homestay</b> của quản trị — đêm lễ, phòng có giá lễ tính giá lễ (cả trên web lẫn đặt tay ở đây), phòng chưa có giá lễ giữ giá thường.
              {" "}{withHol.length ? `Phòng có giá lễ: ${withHol.map((r) => `${r.name} ${M(r.hol)}`).join(", ")}.` : "Chưa phòng nào có giá lễ."}
            </div>
          );
        })()}
      </div>

      <div style={card}>
        <div style={{ fontSize: 16, fontWeight: 800 }}>Dịch vụ phát sinh</div>
        {svcs.map((v, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 110px auto", gap: 6, alignItems: "center", paddingBottom: 6, borderBottom: "1px solid oklch(0.94 0.006 160)" }}>
            <input value={v.name} onChange={(e) => setSvcs(svcs.map((s, j) => (j === i ? { ...s, name: e.target.value } : s)))} style={{ ...input, fontSize: 14, padding: "7px 10px" }} />
            <input value={v.price} onChange={(e) => setSvcs(svcs.map((s, j) => (j === i ? { ...s, price: e.target.value } : s)))} inputMode="numeric" style={{ ...input, fontSize: 14, padding: "7px 10px", textAlign: "right" }} />
            <span onClick={() => setSvcs(svcs.filter((_, j) => j !== i))} style={{ cursor: "pointer", fontSize: 18, fontWeight: 800, color: DIM, padding: "0 4px" }}>×</span>
          </div>
        ))}
        <div style={{ display: "flex", gap: 8 }}>
          <div onClick={() => setSvcs([...svcs, { name: "", price: "" }])} style={{ cursor: "pointer", flex: 1, textAlign: "center", fontSize: 13, fontWeight: 800, padding: 9, borderRadius: 999, border: "1.5px solid oklch(0.88 0.015 160)" }}>+ Thêm dịch vụ</div>
          <div onClick={() => patch({ svcs: svcs.filter((s) => s.name.trim()).map((s) => ({ name: s.name.trim(), price: digits(s.price) })) }, true)} style={{ cursor: "pointer", flex: 1, textAlign: "center", fontSize: 13, fontWeight: 800, padding: 9, borderRadius: 999, background: G, color: "white", opacity: busy ? 0.6 : 1 }}>Lưu dịch vụ</div>
        </div>
        <div style={{ ...kicker, marginTop: 4 }}>NGUỒN KHÁCH</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {[...STAY_SOURCES, "Web sàn", "Combo sàn"].map((v) => <span key={v} style={{ fontSize: 12, fontWeight: 700, padding: "5px 10px", borderRadius: 999, background: "oklch(0.96 0.008 160)" }}>{v}</span>)}
        </div>
      </div>

      {viewerRole !== "STAFF" && (
        <div style={card}>
          <div style={{ fontSize: 16, fontWeight: 800 }}>Nhân viên</div>
          {!data.staff.length && <div style={{ fontSize: 13, color: DIM }}>Chưa có tài khoản lễ tân nào.</div>}
          {data.staff.map((v) => (
            <div key={v.id} style={{ ...staffBox, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", opacity: v.active ? 1 : 0.6 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 800 }}>{v.name}{!v.active && " · đã khoá"}</div>
                <div style={{ fontSize: 12, color: DIM }}>{v.username}{v.phone ? " · " + v.phone : ""}</div>
              </div>
              <div style={{ display: "flex", gap: 10, fontSize: 12, fontWeight: 800 }}>
                <span onClick={() => call({ op: "staffToggle", id: v.id })} style={{ cursor: "pointer", color: "oklch(0.4 0.08 158)" }}>{v.active ? "Khoá" : "Mở khoá"}</span>
                <span onClick={() => { const p = prompt(`Mật khẩu mới cho ${v.username} (tối thiểu 6 ký tự):`); if (p) call({ op: "staffReset", id: v.id, password: p }); }} style={{ cursor: "pointer", color: "oklch(0.4 0.08 158)" }}>Đổi MK</span>
                <span onClick={() => confirm(`Xoá tài khoản ${v.username}?`) && call({ op: "staffDelete", id: v.id })} style={{ cursor: "pointer", color: "oklch(0.5 0.17 28)" }}>Xoá</span>
              </div>
            </div>
          ))}
          {data.hasOwner ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 6 }}>
              <input value={nf.name} onChange={(e) => setNf({ ...nf, name: e.target.value })} placeholder="Họ tên" style={{ ...input, fontSize: 13, padding: "8px 10px" }} />
              <input value={nf.phone} onChange={(e) => setNf({ ...nf, phone: e.target.value })} placeholder="SĐT (không bắt buộc)" inputMode="tel" style={{ ...input, fontSize: 13, padding: "8px 10px" }} />
              <input value={nf.username} onChange={(e) => setNf({ ...nf, username: e.target.value.toLowerCase() })} placeholder="Tên đăng nhập" autoCapitalize="none" style={{ ...input, fontSize: 13, padding: "8px 10px" }} />
              <input value={nf.password} onChange={(e) => setNf({ ...nf, password: e.target.value })} placeholder="Mật khẩu" type="text" style={{ ...input, fontSize: 13, padding: "8px 10px" }} />
              <div onClick={async () => { if (await call({ op: "staffCreate", ...nf })) setNf({ name: "", username: "", phone: "", password: "" }); }} style={{ gridColumn: "1 / -1", cursor: "pointer", textAlign: "center", fontSize: 13, fontWeight: 800, padding: 9, borderRadius: 999, background: O, color: "white" }}>+ Tạo tài khoản lễ tân</div>
            </div>
          ) : (
            <div style={{ fontSize: 12, color: DIM }}>Homestay chưa gắn tài khoản chủ — admin gắn chủ dịch vụ trước khi tạo nhân viên.</div>
          )}
          <div style={{ fontSize: 12, lineHeight: 1.5, color: DIM }}>Lễ tân đăng nhập ở /admin/login, chỉ vào được trang này: đặt phòng, thu tiền, nhận/trả phòng, đổi tình trạng dọn. Không xem báo cáo, không sửa giá.</div>
        </div>
      )}
    </div>
  );
}
