"use client";

import { useState } from "react";
import Link from "@/components/Link";
import { useT } from "@/components/i18n/I18nProvider";
import type { PubCard, VenueKind } from "@/lib/ticket-core";
import { DIM, G, KEYFRAMES, LINE, PRICE, TYPE, dm, money, placeholder, wdOf } from "./tk";

/** Trang /ve: lọc theo loại + ngày, mỗi thẻ báo còn bao nhiêu vé / ghế / bàn của ngày đang chọn. */
export function TicketList({ days, cards, base = "/ve" }: { days: string[]; cards: PubCard[]; /** gốc đường dẫn trang đặt: "/ve" (trang khách) hoặc "/demo/dat-ve" (màn Trang khách của bản demo) */ base?: string }) {
  const t = useT();
  const [type, setType] = useState<"all" | VenueKind>("all");
  const [day, setDay] = useState(days[0]);
  const shown = cards.filter((c) => type === "all" || c.kind === type);
  const types: ["all" | VenueKind, string, string][] = [["all", "Tất cả", G], ["GATE", "Điểm check-in", "oklch(0.55 0.12 155)"], ["SHOW", "Show ca nhạc", "oklch(0.55 0.12 300)"], ["RESTAURANT", "Nhà hàng", "oklch(0.68 0.15 60)"]];

  const avail = (c: PubCard): [string, string, string] => {
    const a = c.days[day];
    const low: [string, string] = ["oklch(0.95 0.06 70)", "oklch(0.48 0.14 55)"], ok: [string, string] = ["white", "oklch(0.36 0.1 155)"], out: [string, string] = ["oklch(0.93 0 0)", "oklch(0.42 0 0)"];
    if (c.kind === "GATE") return !a || !a.left ? [t("Hết vé {0}", [dm(day)]), ...out] : [t("Còn {0} vé", [a.left]), ...(a.left < 30 ? low : ok)];
    if (c.kind === "SHOW") return !a ? [t("Không có suất {0}", [dm(day)]), "white", DIM] : a.left ? [t("Suất {0} · còn {1} ghế", [a.time, a.left]), ...(a.left < 20 ? low : ok)] : [t("Hết vé suất {0}", [a.time]), ...out];
    return !a ? [t("Hết giờ nhận bàn {0}", [dm(day)]), ...out] : a.left ? [t("{0} còn {1} bàn", [a.time, a.left]), ...ok] : [t("{0} đã kín bàn", [a.time]), ...out];
  };

  return (
    <main style={{ maxWidth: 1320, width: "100%", margin: "0 auto", padding: "26px clamp(16px,3vw,32px) 56px", display: "flex", flexDirection: "column", gap: 18, color: "oklch(0.22 0.03 160)" }}>
      <style>{KEYFRAMES}</style>
      <div style={{ animation: "tkRise .4s ease both" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".12em", color: "oklch(0.5 0.1 158)" }}>{t("VÉ & ĐẶT BÀN")}</div>
          <Link href="/tra-cuu" style={{ fontSize: 14, fontWeight: 800, padding: "9px 14px", borderRadius: 999, border: "1.5px solid oklch(0.88 0.02 160)", whiteSpace: "nowrap", background: "white", color: "inherit" }}>{t("Tra cứu vé")}</Link>
        </div>
        <h1 style={{ margin: "6px 0 0", fontSize: "clamp(28px,3.8vw,42px)", fontWeight: 800, letterSpacing: "-.03em", lineHeight: 1.08, textWrap: "balance" }}>{t("Vé tham quan, show và đặt bàn ở Tà Xùa")}</h1>
        <div style={{ fontSize: 16, color: "oklch(0.46 0.02 160)", marginTop: 8, maxWidth: 640, lineHeight: 1.55, textWrap: "pretty" }}>{t("Chọn ngày, xem còn bao nhiêu vé, giữ ghế hoặc bàn, đặt sẵn đồ ăn uống. Vé QR gửi về email và tra cứu được bằng mã đơn.")}</div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: 12, borderRadius: 20, background: "white", border: `1px solid ${LINE}` }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {types.map(([k, name, dot]) => (
            <div key={k} onClick={() => setType(k)} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 7, fontSize: 14, fontWeight: 800, padding: "9px 14px", borderRadius: 999, whiteSpace: "nowrap", background: type === k ? G : "oklch(0.96 0.008 160)", color: type === k ? "white" : "oklch(0.3 0.03 160)" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: dot }} />
              {t(name)} <span style={{ opacity: 0.6 }}>{k === "all" ? cards.length : cards.filter((c) => c.kind === k).length}</span>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2 }}>
          {days.map((d) => (
            <div key={d} onClick={() => setDay(d)} style={{ cursor: "pointer", flex: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 1, minWidth: 64, padding: "8px 10px", borderRadius: 14, border: `1.5px solid ${day === d ? G : "oklch(0.9 0.01 160)"}`, background: day === d ? G : "white", color: day === d ? "white" : "oklch(0.25 0.03 160)" }}>
              <span style={{ fontSize: 12, fontWeight: 700, opacity: 0.75 }}>{t(wdOf(d))}</span>
              <span style={{ fontSize: 16, fontWeight: 800 }}>{dm(d)}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(min(100%,300px),1fr))", gap: 18 }}>
        {shown.map((c, i) => {
          const a = avail(c), ty = TYPE[c.kind], rest = c.kind === "RESTAURANT";
          return (
            <Link key={c.slug} href={`${base}/${c.slug}?d=${day}`} className="tk-card" style={{ display: "flex", flexDirection: "column", background: "white", borderRadius: 22, overflow: "hidden", border: `1px solid ${LINE}`, animation: "tkRise .45s ease both", animationDelay: `${i * 0.05}s`, color: "inherit", textDecoration: "none" }}>
              <div style={{ position: "relative", aspectRatio: "16/10" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {c.coverImage ? <img src={c.coverImage} alt={c.name} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} /> : <div style={placeholder}>{c.name}</div>}
                <span style={{ position: "absolute", left: 12, top: 12, fontSize: 12, fontWeight: 800, padding: "5px 10px", borderRadius: 999, background: ty[1], color: ty[2] }}>{t(ty[0])}</span>
                <span style={{ position: "absolute", right: 12, top: 12, fontSize: 12, fontWeight: 800, padding: "5px 10px", borderRadius: 999, background: a[1], color: a[2], whiteSpace: "nowrap" }}>{a[0]}</span>
              </div>
              <div style={{ padding: "16px 18px 18px", display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
                <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-.01em", lineHeight: 1.3 }}>{t(c.name)}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: DIM }}>{[t(c.area), c.hours].filter(Boolean).join(" · ")}</div>
                <div style={{ flex: 1 }} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 10, paddingTop: 12, borderTop: "1px solid oklch(0.94 0.01 160)" }}>
                  <div>
                    <div style={{ fontSize: 12, color: DIM }}>{rest ? (c.from ? t("Cọc giữ bàn") : t("Giữ bàn")) : t("Giá từ")}</div>
                    <div style={{ fontSize: 21, fontWeight: 800, color: PRICE }}>{rest ? (c.from ? t("{0}/bàn", [money(c.from)]) : t("Miễn phí")) : c.from ? money(c.from) : t("Miễn phí")}</div>
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 800, padding: "10px 16px", borderRadius: 999, background: G, color: "white", whiteSpace: "nowrap" }}>{rest ? t("Đặt bàn") : t("Mua vé")}</span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
      {!shown.length && <div style={{ padding: "40px 20px", textAlign: "center", border: "1.5px dashed oklch(0.85 0.02 160)", borderRadius: 22, background: "white", color: "oklch(0.48 0.02 160)" }}>{t("Chưa có vé cho bộ lọc này.")}</div>}
      <style>{".tk-card{transition:box-shadow .25s}.tk-card:hover{box-shadow:0 22px 44px -24px oklch(0.25 0.06 180 / .4)}"}</style>
    </main>
  );
}
