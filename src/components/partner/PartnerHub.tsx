"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { DemoModule } from "@/lib/module-demo";
import { HUB, HUB_ORDER } from "./hub-data";

const G = "oklch(0.29 0.055 160)";
const O = "oklch(0.68 0.18 45)";
const DIM = "oklch(0.5 0.02 160)";
const LINE = "oklch(0.92 0.01 160)";
const DOTS = ["oklch(0.55 0.12 155)", O, "oklch(0.55 0.13 250)", "oklch(0.55 0.13 300)"];
const PEOPLE: [string, string, string][] = [["Bùi An", "0397 943 155", "0397943155"], ["Tăng Linh", "0357 452 952", "0357452952"]];
const wrap: React.CSSProperties = { maxWidth: 1200, width: "100%", margin: "0 auto" };
const mock: React.CSSProperties = { background: "white", borderRadius: 26, border: `1px solid ${LINE}`, boxShadow: "0 40px 80px -40px oklch(0.25 0.05 160 / .45)", padding: 16, display: "flex", flexDirection: "column", gap: 10 };

/**
 * Trang "Hợp tác" (/hop-tac) — giới thiệu 4 module cho chủ dịch vụ theo claude.ai/design "Gioi thieu Module Hop tac":
 * thanh chuyển module → hero kèm hình minh hoạ → vấn đề → 4 bước (tự chạy 6 giây/bước) → tính năng → một ngày → hỏi đáp → liên hệ.
 * Nút "Mở bản demo" dẫn tới /hop-tac/demo?m=… (route handler dựng dữ liệu mẫu + cấp phiên demo). Chỉ tiếng Việt.
 */
export function PartnerHub({ initial }: { initial: DemoModule }) {
  const [mod, setMod] = useState<DemoModule>(initial);
  const [step, setStep] = useState(0);
  const [manual, setManual] = useState(false);
  const [faq, setFaq] = useState(0);
  const p = HUB[mod];
  const demo = `/hop-tac/demo?m=${mod}`;

  // 4 bước tự chạy; bấm vào một bước thì dừng tự chạy.
  useEffect(() => {
    if (manual) return;
    const iv = setInterval(() => setStep((s) => (s + 1) % 4), 6000);
    return () => clearInterval(iv);
  }, [manual, mod]);

  function pick(k: DemoModule) {
    setMod(k);
    setStep(0);
    setFaq(0);
    setManual(false);
    window.history.replaceState(null, "", `${window.location.pathname}?m=${k}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  const h2: React.CSSProperties = { margin: 0, fontSize: "clamp(26px,3.6vw,40px)", fontWeight: 800, lineHeight: 1.15, letterSpacing: "-.025em" };
  const kick = (c: string): React.CSSProperties => ({ fontSize: 13, fontWeight: 800, letterSpacing: ".14em", color: c });
  const pad = "clamp(16px,4vw,32px)";

  return (
    <div className="ph" style={{ display: "flex", flexDirection: "column", background: "oklch(0.975 0.008 150)", color: "oklch(0.22 0.03 160)" }}>
      <style>{CSS}</style>

      {/* Thanh riêng của trang: tên đối tượng + nút demo */}
      <div style={{ ...wrap, padding: `16px ${pad} 0`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ fontWeight: 800, fontSize: 17 }}>Phần mềm cho chủ dịch vụ <span style={{ fontWeight: 600, color: DIM }}>· {p.for}</span></div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <a href="#cach-dung" className="ph-wide" style={{ fontSize: 14, fontWeight: 700, padding: "9px 14px", color: "oklch(0.3 0.03 160)", whiteSpace: "nowrap" }}>Cách dùng</a>
          <a href="#tinh-nang" className="ph-wide" style={{ fontSize: 14, fontWeight: 700, padding: "9px 14px", color: "oklch(0.3 0.03 160)", whiteSpace: "nowrap" }}>Tính năng</a>
          <a href={demo} rel="nofollow" style={{ fontSize: 14, fontWeight: 800, padding: "10px 16px", borderRadius: 999, background: O, color: "white", whiteSpace: "nowrap" }}>Xem bản demo</a>
        </div>
      </div>

      {/* Chuyển module */}
      <div style={{ ...wrap, padding: `14px ${pad} 0` }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,200px),1fr))", gap: 8 }}>
          {HUB_ORDER.map((k) => (
            <a key={k} href={`/hop-tac?m=${k}`} onClick={(e) => { e.preventDefault(); pick(k); }} style={{ display: "flex", flexDirection: "column", gap: 2, padding: "12px 14px", borderRadius: 16, border: `2px solid ${mod === k ? G : "oklch(0.9 0.01 160)"}`, background: mod === k ? "oklch(0.96 0.025 155)" : "white", color: "oklch(0.22 0.03 160)" }}>
              <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".08em", color: mod === k ? "oklch(0.5 0.15 45)" : "oklch(0.5 0.08 158)" }}>{HUB[k].kick}</span>
              <span style={{ fontSize: 15, fontWeight: 800 }}>{HUB[k].name}</span>
            </a>
          ))}
        </div>
      </div>

      {/* HERO */}
      <section className="ph-hero" style={{ ...wrap, padding: `clamp(24px,4vw,48px) ${pad} clamp(40px,6vw,80px)`, display: "grid", gap: "clamp(28px,5vw,64px)", alignItems: "center" }}>
        <div key={mod} style={{ display: "flex", flexDirection: "column", gap: 20, animation: "phUp .6s ease both" }}>
          <span style={{ alignSelf: "flex-start", fontSize: 13, fontWeight: 800, padding: "7px 14px", borderRadius: 999, background: "oklch(0.95 0.03 155)", color: "oklch(0.36 0.09 158)" }}>{p.badge}</span>
          <h1 style={{ margin: 0, fontSize: "clamp(34px,5.2vw,58px)", fontWeight: 800, lineHeight: 1.05, letterSpacing: "-.035em", textWrap: "balance" }}>{p.h1a} <span style={{ color: "oklch(0.62 0.18 45)" }}>{p.h1b}</span></h1>
          <p style={{ margin: 0, fontSize: "clamp(16px,1.6vw,19px)", lineHeight: 1.6, color: "oklch(0.42 0.02 160)", maxWidth: 520, textWrap: "pretty" }}>{p.lead}</p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <a href={demo} rel="nofollow" style={{ fontSize: 16, fontWeight: 800, padding: "14px 22px", borderRadius: 999, background: G, color: "white" }}>Mở bản demo →</a>
            {/* Mọi module: tự đăng ký tài khoản (/hop-tac/dang-ky) — vào là có đủ 4 chức năng. */}
            <Link href="/hop-tac/dang-ky" style={{ fontSize: 16, fontWeight: 800, padding: "14px 22px", borderRadius: 999, border: "1.5px solid oklch(0.85 0.02 160)", color: "oklch(0.25 0.03 160)" }}>Đăng ký dùng miễn phí</Link>
          </div>
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
            {p.proof.map(([v, k]) => (
              <div key={k}><div style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-.02em" }}>{v}</div><div style={{ fontSize: 13, color: DIM }}>{k}</div></div>
            ))}
          </div>
        </div>
        <div key={mod + "m"} style={{ position: "relative", animation: "phUp .7s .1s ease both", minWidth: 0 }}>
          {mod === "home" ? <HomeMock /> : mod === "ticket" ? <TicketMock /> : mod === "xe" ? <XeMock /> : <QrMock />}
        </div>
      </section>

      {/* VẤN ĐỀ */}
      <section style={{ background: "oklch(0.22 0.045 165)", color: "white" }}>
        <div style={{ ...wrap, padding: `clamp(48px,7vw,88px) ${pad}`, display: "flex", flexDirection: "column", gap: 28 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 640 }}><span style={kick("oklch(0.85 0.1 78)")}>{p.painKick}</span><h2 style={h2}>{p.painTitle}</h2></div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,250px),1fr))", gap: 12 }}>
            {p.pains.map(([t, d]) => (
              <div key={t} style={{ padding: 20, borderRadius: 20, background: "oklch(1 0 0 / .06)", border: "1px solid oklch(1 0 0 / .1)", display: "flex", flexDirection: "column", gap: 8 }}><b style={{ fontSize: 17, lineHeight: 1.35 }}>{t}</b><span style={{ fontSize: 14, lineHeight: 1.6, color: "oklch(0.85 0.02 160)" }}>{d}</span></div>
            ))}
          </div>
        </div>
      </section>

      {/* CÁCH DÙNG */}
      <section id="cach-dung" style={{ ...wrap, padding: `clamp(56px,8vw,100px) ${pad}`, display: "flex", flexDirection: "column", gap: 28, scrollMarginTop: 80 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 640 }}><span style={kick("oklch(0.5 0.1 158)")}>CÁCH DÙNG · 4 BƯỚC</span><h2 style={h2}>{p.howTitle}</h2></div>
        <div className="ph-steps" style={{ display: "grid", gap: 12 }}>
          {p.steps.map(([n, t, d, bul], i) => {
            const on = step === i;
            return (
              <div key={n} onClick={() => { setStep(i); setManual(true); }} style={{ cursor: "pointer", display: "flex", flexDirection: "column", gap: 10, padding: 20, borderRadius: 22, background: on ? G : "white", color: on ? "white" : "oklch(0.22 0.03 160)", border: `1px solid ${on ? G : LINE}`, transition: "all .3s" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-.03em", color: on ? "oklch(0.85 0.12 75)" : "oklch(0.75 0.03 158)" }}>{n}</span>
                  <div style={{ width: 60, height: 4, borderRadius: 2, background: on ? "oklch(1 0 0 / .2)" : "oklch(0.93 0.01 160)", overflow: "hidden" }}>
                    {on && <div key={`${mod}${i}${manual}`} style={{ height: "100%", background: O, width: manual ? "100%" : undefined, animation: manual ? undefined : "phFill 6s linear both" }} />}
                  </div>
                </div>
                <b style={{ fontSize: 18, lineHeight: 1.3 }}>{t}</b>
                <span style={{ fontSize: 14, lineHeight: 1.6, opacity: 0.85 }}>{d}</span>
                {on && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingTop: 4, animation: "phUp .4s ease both" }}>
                    {bul.map((b) => <span key={b} style={{ display: "flex", gap: 8, fontSize: 13, fontWeight: 600, lineHeight: 1.45 }}><span style={{ color: "oklch(0.82 0.13 70)" }}>✓</span>{b}</span>)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* TÍNH NĂNG */}
      <section id="tinh-nang" style={{ background: "white", borderTop: `1px solid ${LINE}`, borderBottom: `1px solid ${LINE}`, scrollMarginTop: 80 }}>
        <div style={{ ...wrap, padding: `clamp(56px,8vw,100px) ${pad}`, display: "flex", flexDirection: "column", gap: 28 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 640 }}><span style={kick("oklch(0.5 0.1 158)")}>{p.featKick}</span><h2 style={h2}>{p.featTitle}</h2></div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(min(100%,260px),1fr))", gap: 12 }}>
            {p.feats.map(([t, d], i) => (
              <div key={t} style={{ padding: 20, borderRadius: 20, background: "oklch(0.98 0.006 150)", border: `1px solid ${LINE}`, display: "flex", flexDirection: "column", gap: 8 }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: DOTS[i % 4] }} />
                <b style={{ fontSize: 16, lineHeight: 1.35 }}>{t}</b>
                <span style={{ fontSize: 14, lineHeight: 1.6, color: "oklch(0.45 0.02 160)" }}>{d}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* MỘT NGÀY */}
      <section style={{ background: "oklch(0.22 0.045 165)", color: "white" }}>
        <div className="ph-day" style={{ ...wrap, padding: `clamp(56px,8vw,100px) ${pad}`, display: "grid", gap: "clamp(24px,5vw,64px)", alignItems: "start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}><span style={kick("oklch(0.85 0.1 78)")}>{p.dayKick}</span><h2 style={h2}>{p.dayTitle}</h2></div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {p.day.map(([t, hd, d]) => (
              <div key={t + hd} style={{ display: "grid", gridTemplateColumns: "64px 16px minmax(0,1fr)", gap: 14 }}>
                <b style={{ fontSize: 17, paddingTop: 2 }}>{t}</b>
                <span style={{ display: "flex", flexDirection: "column", alignItems: "center" }}><span style={{ width: 12, height: 12, borderRadius: "50%", background: O, marginTop: 6, flex: "none" }} /><span style={{ flex: 1, width: 2, background: "oklch(1 0 0 / .15)" }} /></span>
                <div style={{ paddingBottom: 22 }}><b style={{ display: "block", fontSize: 16 }}>{hd}</b><span style={{ fontSize: 14, lineHeight: 1.6, color: "oklch(0.85 0.02 160)" }}>{d}</span></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HỎI ĐÁP */}
      <section style={{ maxWidth: 860, width: "100%", margin: "0 auto", padding: `clamp(56px,8vw,100px) ${pad}`, display: "flex", flexDirection: "column", gap: 20 }}>
        <h2 style={{ ...h2, fontSize: "clamp(26px,3.6vw,36px)" }}>Câu hỏi thường gặp</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {p.faq.map(([q, a], i) => (
            <div key={q} style={{ borderRadius: 18, background: "white", border: `1px solid ${LINE}`, overflow: "hidden" }}>
              <button type="button" onClick={() => setFaq(faq === i ? -1 : i)} aria-expanded={faq === i} style={{ cursor: "pointer", width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "16px 18px", background: "none", border: "none", textAlign: "left", fontFamily: "inherit", color: "inherit" }}>
                <b style={{ fontSize: 16, lineHeight: 1.4 }}>{q}</b>
                <span style={{ fontSize: 20, fontWeight: 800, color: "oklch(0.45 0.08 158)", flex: "none" }}>{faq === i ? "−" : "+"}</span>
              </button>
              {faq === i && <div style={{ padding: "0 18px 16px", fontSize: 15, lineHeight: 1.6, color: "oklch(0.42 0.02 160)" }}>{a}</div>}
            </div>
          ))}
        </div>
      </section>

      {/* LIÊN HỆ */}
      <section id="lien-he" style={{ ...wrap, padding: `0 ${pad} clamp(48px,7vw,80px)`, scrollMarginTop: 80 }}>
        <div className="ph-cta" style={{ display: "grid", gap: "clamp(20px,4vw,48px)", padding: "clamp(28px,5vw,56px)", borderRadius: 32, background: G, color: "white", alignItems: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <h2 style={{ margin: 0, fontSize: "clamp(28px,4vw,44px)", fontWeight: 800, lineHeight: 1.1, letterSpacing: "-.03em" }}>{p.ctaTitle}</h2>
            <p style={{ margin: 0, fontSize: 16, lineHeight: 1.6, color: "oklch(0.88 0.02 160)", maxWidth: 460 }}>{p.ctaText}</p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Link href="/hop-tac/dang-ky" style={{ fontSize: 15, fontWeight: 800, padding: "13px 22px", borderRadius: 999, background: O, color: "white" }}>Đăng ký dùng miễn phí →</Link>
              <a href={demo} rel="nofollow" style={{ fontSize: 15, fontWeight: 800, padding: "13px 22px", borderRadius: 999, background: "white", color: G }}>Mở bản demo</a>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {PEOPLE.map(([name, phone, n]) => (
              <div key={n} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 12px 12px 16px", borderRadius: 18, background: "oklch(1 0 0 / .08)", border: "1px solid oklch(1 0 0 / .14)" }}>
                <div style={{ flex: 1, minWidth: 0 }}><b style={{ display: "block", fontSize: 15 }}>{name}</b><span style={{ fontSize: 13, color: "oklch(0.85 0.02 160)" }}>{phone}</span></div>
                <a href={`tel:${n}`} style={{ fontSize: 13, fontWeight: 800, padding: "9px 14px", borderRadius: 999, border: "1px solid oklch(1 0 0 / .3)", color: "white" }}>Gọi</a>
                <a href={`https://zalo.me/${n}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, fontWeight: 800, padding: "9px 14px", borderRadius: 999, background: O, color: "white" }}>Zalo</a>
              </div>
            ))}
            <div style={{ fontSize: 13, lineHeight: 1.5, color: "oklch(0.85 0.02 160)", padding: "4px 4px 0" }}>{p.ctaNote}</div>
          </div>
        </div>
      </section>
    </div>
  );
}

const CSS = `
.ph a{text-decoration:none}
@keyframes phUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
@keyframes phFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
@keyframes phPing{0%{box-shadow:0 0 0 0 oklch(0.68 0.18 45 / .6)}80%{box-shadow:0 0 0 14px oklch(0.68 0.18 45 / 0)}100%{box-shadow:0 0 0 0 oklch(0.68 0.18 45 / 0)}}
@keyframes phGrow{from{transform:scaleX(0)}to{transform:scaleX(1)}}
@keyframes phFill{from{width:0}to{width:100%}}
.ph-hero,.ph-day,.ph-cta,.ph-steps{grid-template-columns:1fr}
.ph-wide{display:none}
@media(min-width:600px){.ph-steps{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(min-width:860px){.ph-cta{grid-template-columns:minmax(0,1.1fr) minmax(0,1fr)}}
@media(min-width:900px){.ph-hero{grid-template-columns:minmax(0,1fr) minmax(0,1.05fr)}.ph-day{grid-template-columns:minmax(0,.9fr) minmax(0,1.1fr)}.ph-wide{display:inline}}
@media(min-width:1000px){.ph-steps{grid-template-columns:repeat(4,minmax(0,1fr))}}
@media(prefers-reduced-motion:reduce){.ph *{animation:none!important}}
`;

// ----------------------------- Hình minh hoạ từng module -----------------------------
const IN = "oklch(0.45 0.1 158)", DEP = "oklch(0.6 0.12 250)", HOLD = "oklch(0.96 0.05 75)", DUE = "oklch(0.55 0.13 300)";
type Bar = [number, number, string, string, string, string, boolean, number];
const float = (side: "left" | "right", bg: string): React.CSSProperties => ({ position: "absolute", [side]: -8, bottom: -22, padding: "12px 14px", borderRadius: 18, background: bg, color: "white", boxShadow: "0 20px 40px -20px oklch(0.15 0.04 160 / .7)", animation: "phFloat 4s ease-in-out infinite", maxWidth: 240 });

function HomeMock() {
  const rows: [string, Bar[]][] = [
    ["101", [[0, 2, IN, IN, "white", "Thu Trang", false, 0.1], [3, 3, DEP, DEP, "white", "Đoàn Mai Anh", false, 0.3]]],
    ["102", [[1, 2, DUE, DUE, "white", "Minh Châu", false, 0.15], [4, 2, HOLD, "oklch(0.72 0.13 60)", "oklch(0.45 0.12 55)", "Chưa cọc", true, 0.35]]],
    ["201", [[2, 4, O, O, "white", "Gia Huy · đến", false, 0.2]]],
    ["202", [[0, 2, "oklch(0.58 0.19 28)", "oklch(0.58 0.19 28)", "white", "Quá giờ", false, 0.1], [5, 3, DEP, DEP, "white", "Lan Anh", false, 0.4]]],
    ["BG1", [[1, 3, IN, IN, "white", "Quốc Bảo", false, 0.25], [6, 2, "white", O, "oklch(0.5 0.15 45)", "Đơn web", true, 0.45]]],
    ["TT", [[0, 5, "repeating-linear-gradient(45deg, oklch(0.9 0.005 160) 0 5px, oklch(0.96 0.003 160) 5px 10px)", "oklch(0.82 0.005 160)", "oklch(0.35 0.02 160)", "Bảo trì", false, 0.2]]],
  ];
  return (
    <>
      <div style={mock}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><b style={{ fontSize: 15 }}>Sơ đồ phòng · Tháng 11</b><span style={{ fontSize: 12, fontWeight: 800, padding: "4px 10px", borderRadius: 999, background: "oklch(0.94 0.05 155)", color: "oklch(0.36 0.1 155)" }}>6/8 phòng có khách</span></div>
        <div style={{ display: "grid", gridTemplateColumns: "44px repeat(10,1fr)", fontSize: 10, fontWeight: 700, color: "oklch(0.55 0.02 160)" }}><span />{[17, 18, 19, 20, 21, 22, 23, 24, 25, 26].map((n) => <span key={n} style={{ textAlign: "center", color: n === 19 ? "oklch(0.55 0.17 45)" : undefined }}>{n}</span>)}</div>
        {rows.map(([name, bars]) => (
          <div key={name} style={{ display: "grid", gridTemplateColumns: "44px minmax(0,1fr)", alignItems: "center" }}>
            <b style={{ fontSize: 12 }}>{name}</b>
            <div style={{ position: "relative", height: 30, borderRadius: 8, background: "repeating-linear-gradient(90deg, oklch(0.975 0.004 160) 0 calc(10% - 1px), oklch(0.93 0.005 160) calc(10% - 1px) 10%)" }}>
              {bars.map(([l, wd, bg, bd, fg, label, dashed, d]) => (
                <div key={label} style={{ position: "absolute", top: 4, bottom: 4, left: `${l * 10 + 5}%`, width: `${wd * 10 - 1}%`, borderRadius: 7, background: bg, border: `1.5px ${dashed ? "dashed" : "solid"} ${bd}`, color: fg, fontSize: 10, fontWeight: 800, display: "flex", alignItems: "center", padding: "0 6px", overflow: "hidden", whiteSpace: "nowrap", transformOrigin: "left", animation: "phGrow .7s cubic-bezier(.2,.7,.2,1) both", animationDelay: `${d}s` }}>{label}</div>
              ))}
            </div>
          </div>
        ))}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{([["Đang ở", IN], ["Đã cọc", DEP], ["Đến hôm nay", O], ["Trả hôm nay", DUE]] as const).map(([n, c]) => <span key={n} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, color: "oklch(0.42 0.02 160)" }}><span style={{ width: 12, height: 8, borderRadius: 3, background: c }} />{n}</span>)}</div>
      </div>
      <div style={float("right", G)}><div style={{ fontSize: 11, opacity: 0.8 }}>Trả phòng · 202</div><div style={{ fontSize: 15, fontWeight: 800 }}>Thu nốt 1.450.000đ</div><div style={{ fontSize: 11, opacity: 0.8 }}>Phòng tự chuyển &quot;Chưa dọn&quot;</div></div>
    </>
  );
}

function TicketMock() {
  const seat = (r: number, c: number) => {
    const v = Math.abs((Math.sin(r * 31 + c * 7) * 1000) % 1), sold = v < 0.72, mine = r === 3 && (c === 5 || c === 6);
    return { bg: mine ? G : sold ? "oklch(0.87 0.005 160)" : r < 2 ? "oklch(0.95 0.06 75)" : "oklch(0.95 0.035 155)", bd: mine ? G : sold ? "oklch(0.87 0.005 160)" : r < 2 ? "oklch(0.72 0.13 60)" : "oklch(0.66 0.09 155)" };
  };
  return (
    <>
      <div style={{ ...mock, alignItems: "center" }}>
        <div style={{ alignSelf: "stretch", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}><b style={{ fontSize: 15 }}>Đêm nhạc Mây · T7 21/11 · 20:00</b><span style={{ fontSize: 12, fontWeight: 800, color: "oklch(0.55 0.17 45)", whiteSpace: "nowrap" }}>Còn 9 ghế</span></div>
        <div style={{ width: "72%", padding: "5px 0", borderRadius: "0 0 40px 40px / 0 0 14px 14px", background: G, color: "white", textAlign: "center", fontSize: 10, fontWeight: 800, letterSpacing: ".2em" }}>SÂN KHẤU</div>
        {[0, 1, 2, 3, 4, 5].map((r) => (
          <div key={r} style={{ display: "flex", gap: 4 }}>{Array.from({ length: 12 }, (_, c) => { const s = seat(r, c); return <span key={c} style={{ width: 18, height: 18, borderRadius: "5px 5px 2px 2px", background: s.bg, border: `1.5px solid ${s.bd}`, marginRight: c === 2 || c === 8 ? 10 : 0 }} />; })}</div>
        ))}
        <div style={{ alignSelf: "stretch", display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6, marginTop: 4 }}>{([["103/112", "Đã bán"], ["94%", "Đã vào cổng"], ["3", "Đang giữ"]] as const).map(([v, k]) => <div key={k} style={{ padding: "8px 10px", borderRadius: 12, background: "oklch(0.975 0.006 160)" }}><div style={{ fontSize: 16, fontWeight: 800 }}>{v}</div><div style={{ fontSize: 11, color: DIM }}>{k}</div></div>)}</div>
      </div>
      <div style={{ position: "absolute", left: -10, bottom: -24, display: "flex", gap: 10, alignItems: "center", padding: "10px 14px 10px 10px", borderRadius: 18, background: "oklch(0.94 0.06 155)", boxShadow: "0 20px 40px -20px oklch(0.2 0.05 160 / .5)", animation: "phFloat 4s ease-in-out infinite" }}>
        <span style={{ width: 38, height: 38, borderRadius: "50%", background: "oklch(0.5 0.13 155)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 800 }}>✓</span>
        <div><div style={{ fontSize: 14, fontWeight: 800, color: "oklch(0.32 0.1 155)" }}>Hợp lệ · mời vào</div><div style={{ fontSize: 11, color: "oklch(0.35 0.04 160)" }}>Ghế C7 · quét lúc 19:51</div></div>
      </div>
    </>
  );
}

function XeMock() {
  const stats: [string, string, string, string][] = [["4", "Rảnh", "oklch(0.4 0.1 155)", "oklch(0.95 0.04 155)"], ["6", "Đang thuê", "oklch(0.36 0.09 158)", "oklch(0.95 0.02 158)"], ["1", "Đã cọc", "oklch(0.42 0.12 250)", "oklch(0.95 0.03 250)"], ["1", "Đang sửa", "oklch(0.45 0.02 160)", "oklch(0.95 0.004 160)"]];
  const rows: [string, string, string, string, string, string, string][] = [
    ["SỐ", "Wave Alpha", "29B1-468.21", "Rảnh · vừa rửa xe", "Rảnh", "oklch(0.94 0.05 155)", "oklch(0.36 0.1 155)"],
    ["GA", "Vision 2023", "26B1-210.55", "Phạm Minh Đức · trả 20/11 17:00", "Đang thuê", "oklch(0.45 0.1 158)", "white"],
    ["CÔN", "Exciter 155", "29H1-903.18", "Lê Hoàng Nam · trễ 2 giờ", "Quá hạn", "oklch(0.58 0.19 28)", "white"],
    ["SỐ", "Sirius", "29B1-552.07", "Vũ Hải Yến · nhận 20/11 · cọc 500k", "Đã cọc", "oklch(0.6 0.12 250)", "white"],
    ["GA", "Air Blade", "26B1-117.42", "Thay má phanh · xong 21/11", "Đang sửa", "oklch(0.93 0.005 160)", "oklch(0.35 0.02 160)"],
  ];
  return (
    <>
      <div style={mock}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}><b style={{ fontSize: 15 }}>Đội xe hôm nay · 19/11</b><span style={{ fontSize: 12, fontWeight: 800, padding: "4px 10px", borderRadius: 999, background: "oklch(0.94 0.05 155)", color: "oklch(0.36 0.1 155)", whiteSpace: "nowrap" }}>4/12 xe rảnh</span></div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 6 }}>{stats.map(([v, k, c, bg]) => <div key={k} style={{ padding: 8, borderRadius: 12, background: bg }}><div style={{ fontSize: 18, fontWeight: 800, color: c }}>{v}</div><div style={{ fontSize: 10, fontWeight: 700, color: "oklch(0.45 0.02 160)" }}>{k}</div></div>)}</div>
        {rows.map(([kind, name, plate, who, st, sBg, sFg], i) => (
          <div key={plate} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 14, border: "1px solid oklch(0.93 0.008 160)", animation: "phUp .5s ease both", animationDelay: `${i * 0.08}s` }}>
            <span style={{ flex: "none", width: 36, height: 36, borderRadius: 10, background: kind === "CÔN" ? "oklch(0.95 0.05 60)" : kind === "GA" ? "oklch(0.95 0.03 250)" : "oklch(0.95 0.04 155)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color: kind === "CÔN" ? "oklch(0.48 0.14 50)" : kind === "GA" ? "oklch(0.42 0.12 250)" : "oklch(0.36 0.1 155)" }}>{kind}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name} <span style={{ fontWeight: 600, color: DIM, fontFamily: "ui-monospace,monospace", fontSize: 11 }}>{plate}</span></div>
              <div style={{ fontSize: 11, color: DIM, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{who}</div>
            </div>
            <span style={{ flex: "none", fontSize: 10, fontWeight: 800, padding: "4px 9px", borderRadius: 999, background: sBg, color: sFg, whiteSpace: "nowrap" }}>{st}</span>
          </div>
        ))}
      </div>
      <div style={float("right", G)}><div style={{ fontSize: 11, opacity: 0.8 }}>Đơn mới 20/11 → 22/11 · 2 xe số</div><div style={{ fontSize: 15, fontWeight: 800 }}>Đã tự xếp 29B1-468.21, 29B1-552.07</div></div>
    </>
  );
}

function QrMock() {
  const menu: [string, string, string, string, string][] = [["Lẩu gà đen", "450k", "oklch(0.7 0.12 45)", "1", G], ["Cơm lam", "40k", "oklch(0.75 0.1 120)", "2", G], ["Rượu táo mèo", "120k", "oklch(0.65 0.12 20)", "+", "oklch(0.75 0.01 160)"], ["Trà Shan tuyết", "50k", "oklch(0.7 0.1 140)", "+", "oklch(0.75 0.01 160)"]];
  const cols: [string, string, string, string[]][] = [["Mới", O, "oklch(0.97 0.03 75)", ["B3", "BC1"]], ["Đang làm", "oklch(0.55 0.13 250)", "oklch(0.97 0.015 250)", ["B1", "B5"]], ["Đã lên", "oklch(0.55 0.12 155)", "oklch(0.97 0.015 155)", ["B2"]]];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,200px) minmax(0,1fr)", gap: 14, alignItems: "end" }}>
      <div style={{ borderRadius: 30, padding: 7, background: "oklch(0.2 0.02 160)", boxShadow: "0 30px 60px -30px oklch(0.1 0.03 160 / .6)" }}>
        <div style={{ borderRadius: 24, overflow: "hidden", background: "oklch(0.98 0.006 80)", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "10px 12px", background: G, color: "white" }}><div style={{ fontSize: 10, opacity: 0.8 }}>Nhà hàng Mây Ngàn</div><div style={{ fontSize: 15, fontWeight: 800 }}>Bàn B3</div></div>
          <div style={{ padding: 8, display: "flex", flexDirection: "column", gap: 6 }}>
            {menu.map(([n, pr, c, q, bb]) => (
              <div key={n} style={{ display: "flex", alignItems: "center", gap: 6, padding: 6, borderRadius: 10, background: "white", border: "1px solid oklch(0.93 0.008 160)" }}>
                <span style={{ width: 28, height: 28, borderRadius: 7, background: c, flex: "none" }} />
                <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 10, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{n}</div><div style={{ fontSize: 9, fontWeight: 800, color: "oklch(0.58 0.17 45)" }}>{pr}</div></div>
                <span style={{ width: 18, height: 18, borderRadius: "50%", background: bb, color: "white", fontSize: 10, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{q}</span>
              </div>
            ))}
          </div>
          <div style={{ margin: "0 8px 10px", padding: "8px 10px", borderRadius: 999, background: G, color: "white", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 10, fontWeight: 800 }}><span>3 món · 530k</span><span style={{ padding: "4px 8px", borderRadius: 999, background: O }}>Gửi bếp</span></div>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 18, background: O, color: "white", animation: "phPing 1.6s ease infinite" }}><span style={{ fontSize: 20 }}>🔔</span><div style={{ minWidth: 0 }}><div style={{ fontSize: 14, fontWeight: 800 }}>Bàn B3 vừa gọi 3 món</div><div style={{ fontSize: 11, opacity: 0.9 }}>Lẩu gà đen ít cay, 2 cơm lam</div></div></div>
        <div style={{ background: "white", borderRadius: 20, border: `1px solid ${LINE}`, padding: 12, display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 6 }}>
          {cols.map(([n, c, bg, ts]) => (
            <div key={n} style={{ display: "flex", flexDirection: "column", gap: 5, padding: 7, borderRadius: 12, background: bg }}>
              <span style={{ fontSize: 10, fontWeight: 800, color: c }}>{n}</span>
              {ts.map((x) => <span key={x} style={{ fontSize: 11, fontWeight: 800, padding: 6, borderRadius: 8, background: "white", border: `1px solid ${LINE}` }}>{x}</span>)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
