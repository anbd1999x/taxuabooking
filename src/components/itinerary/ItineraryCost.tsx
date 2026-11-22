"use client";

import Link from "@/components/Link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useT } from "@/components/i18n/I18nProvider";
import { cn } from "@/lib/utils";
import { hLabel, planCost, costMult, type CostCat, type CostUnit, type Incl, type ItCost, type ItSub, type StopKind, type Transport } from "@/lib/itinerary";

/**
 * Lịch trình & chi phí (theo claude.ai/design `Lich trinh Chi phi Ta Xua.dc.html`):
 * chọn thời lượng (tab), cách đi (thẻ cabin / limousine), trong tuần / cuối tuần, số người, hạng cabin
 * ⇒ mỗi mục tự tính tiền theo đơn vị (người / xe / cả đoàn); bấm mục nào để bỏ khỏi dự trù.
 * Cột phải (desktop) / thanh dưới + bottom sheet (mobile) = tổng dự trù theo nhóm.
 */

export interface CostStop {
  time: string;
  end: string;
  title: string; // dòng chính (tên hoạt động hoặc tên địa điểm)
  place: string; // dòng nhỏ (địa điểm) — "" khi trùng dòng chính
  note: string;
  kind: StopKind;
  placeId: string | null;
  cost: number;
  unit: CostUnit;
  cat: Exclude<CostCat, "">;
  incl: Incl;
  subs: ItSub[];
}
export interface CostPlan {
  id: string;
  name: string;
  sub: string;
  transport: Transport;
  nights: number;
  days: { label: string; title: string; stops: CostStop[] }[];
}

const G = "oklch(0.29 0.055 160)";
const O = "oklch(0.68 0.18 45)";
const DC = ["oklch(0.45 0.08 265)", "oklch(0.62 0.16 50)", "oklch(0.5 0.12 155)", "oklch(0.55 0.13 250)"];
const DB = ["oklch(0.97 0.015 265)", "oklch(0.975 0.03 75)", "oklch(0.975 0.02 155)", "oklch(0.975 0.015 250)"];
const CATS: ["combo" | "xm" | "an" | "ve", string, string][] = [
  ["combo", "Combo xe + phòng + ăn sáng", G],
  ["xm", "Xe máy & xăng", "oklch(0.55 0.13 250)"],
  ["an", "Ăn uống", O],
  ["ve", "Vé & check-in", "oklch(0.55 0.12 155)"],
];

const M = (n: number) => Math.round(n).toLocaleString("vi-VN") + "đ";
const K = (n: number) => (n >= 1e6 ? (n / 1e6).toFixed(2).replace(/\.?0+$/, "").replace(".", ",") + "tr" : Math.round(n / 1000) + "k");

export function ItineraryCost({
  plans, cost, planId, onPlan, zalo, prep,
}: { plans: CostPlan[]; cost: ItCost; planId: string; onPlan: (id: string) => void; zalo: string; prep: string[] }) {
  const tr = useT();
  const [pax, setPax] = useState(2);
  const [weekend, setWeekend] = useState(true);
  const [cabinPrice, setCabinPrice] = useState(cost.cabinTiers[0]?.price ?? 0);
  const [skips, setSkips] = useState<Record<string, Record<string, boolean>>>({});
  const [sheet, setSheet] = useState(false);
  const [barOn, setBarOn] = useState(false);
  const secRef = useRef<HTMLElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  /** Chọn cách đi (thẻ cabin / limousine) ⇒ đổi lịch trình rồi cuộn xuống phần lịch trình. */
  const pickTransport = (id: string) => {
    onPlan(id);
    requestAnimationFrame(() => {
      const el = timelineRef.current;
      if (!el) return;
      const header = document.querySelector("header")?.getBoundingClientRect().height ?? 64;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - header - 12, behavior: reduce ? "auto" : "smooth" });
    });
  };

  const plan = plans.find((p) => p.id === planId) ?? plans[0];
  const durs = useMemo(() => [...new Set(plans.map((p) => p.name))], [plans]);
  const skip = skips[plan?.id ?? ""] ?? {};

  // Thanh tổng phía dưới (mobile) chỉ hiện khi đang xem phần lịch trình — không đè nút liên hệ ở phần khác.
  useEffect(() => {
    const el = secRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setBarOn(e.isIntersecting), { rootMargin: "-30% 0px -30% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (!sheet) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [sheet]);

  if (!plan) return null;
  const opts = { pax, weekend, cabinPrice, skip };
  const R = planCost(plan, cost, opts);
  const cards = plans.filter((p) => p.name === plan.name);
  const nightsTxt = (p: CostPlan) => (p.nights ? tr("Ở {0} đêm", [p.nights]) : tr("Trong ngày"));
  const trName = (t: Transport) => tr(cost.transports[t].name);
  const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);
  const setSkip = (k: string, v: boolean) => setSkips((s) => ({ ...s, [plan.id]: { ...(s[plan.id] ?? {}), [k]: v } }));
  const pickDur = (name: string) => {
    const same = plans.find((p) => p.name === name && p.transport === plan.transport) ?? plans.find((p) => p.name === name);
    if (same) onPlan(same.id);
  };
  const sumTitle = `${tr(plan.name)} · ${trName(plan.transport)} · ${tr("{0} người", [pax])} · ${weekend ? tr("cuối tuần") : tr("trong tuần")}`;
  const cats = CATS.map(([k, name, c]) => ({ k, name: tr(name), c, v: R.cat[k], pct: Math.round((R.cat[k] / Math.max(1, R.total)) * 100) }));
  const unitWord = (u: CostUnit) => (u === "bike" ? tr("xe") : u === "pp" ? tr("người") : tr("đoàn"));
  const timeTxt = (s: CostStop) => (s.end ? `${hLabel(s.time)} – ${hLabel(s.end)}` : hLabel(s.time));
  const comboHref = "/combo";

  return (
    <section id="lt-plan" ref={secRef} className="flex scroll-mt-20 flex-col gap-[18px]">
      <style>{`@keyframes ltc-up{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}.ltc-up{animation:ltc-up .4s ease both}@keyframes ltc-sheet{from{transform:translateY(100%)}to{transform:none}}@media (prefers-reduced-motion:reduce){.ltc-up{animation:none}}`}</style>
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-extrabold tracking-[.12em] text-[oklch(0.5_0.1_158)]">{tr("LỊCH TRÌNH & CHI PHÍ")}</span>
        <h2 className="text-balance text-[clamp(24px,3.2vw,36px)] font-extrabold leading-[1.1] tracking-[-.03em] text-ink">{tr("Lịch trình & chi phí đi Tà Xùa")}</h2>
        <p className="max-w-[680px] text-pretty text-[15px] leading-relaxed text-[oklch(0.45_0.02_160)]">
          {tr("Chọn số ngày, cách đi và số người. Chi phí tự tính lại theo từng mục, bấm vào mục nào để bỏ ra khỏi dự trù.")}
        </p>
      </div>

      {/* ĐIỀU KHIỂN */}
      <div className="flex flex-col gap-3 rounded-3xl border border-[oklch(0.92_0.01_160)] bg-white p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex gap-1 rounded-[14px] bg-[oklch(0.95_0.008_160)] p-1">
            {durs.map((name) => {
              const on = name === plan.name;
              const ref = plans.find((p) => p.name === name && p.transport === plan.transport) ?? plans.find((p) => p.name === name)!;
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => pickDur(name)}
                  className="flex flex-col items-center rounded-[11px] px-[18px] py-2 transition-all"
                  style={{ background: on ? G : "transparent", color: on ? "white" : "oklch(0.35 0.02 160)", boxShadow: on ? "0 4px 12px -6px oklch(0.2 0.05 160 / .6)" : "none" }}
                >
                  <span className="text-base font-extrabold">{tr(name)}</span>
                  <span className="whitespace-nowrap text-[11px] font-semibold opacity-75">
                    {nightsTxt(ref)}
                    {ref.transport === "cabin" ? tr(" + 1 đêm xe") : ""}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="inline-flex gap-[3px] rounded-xl bg-[oklch(0.95_0.008_160)] p-[3px]">
              {([[false, tr("Trong tuần · phòng từ {0}", [K(cost.roomWd)])], [true, tr("Cuối tuần · phòng từ {0}", [K(cost.roomWe)])]] as const).map(([we, name]) => (
                <button
                  key={String(we)}
                  type="button"
                  onClick={() => setWeekend(we)}
                  className="whitespace-nowrap rounded-[9px] px-3 py-2 text-[13px] font-extrabold"
                  style={{ background: weekend === we ? "white" : "transparent", color: weekend === we ? G : "oklch(0.45 0.02 160)", boxShadow: weekend === we ? "0 1px 4px oklch(0.2 0.03 160 / .15)" : "none" }}
                >
                  {name}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 rounded-full bg-[oklch(0.95_0.008_160)] py-1 pl-3 pr-1">
              <span className="whitespace-nowrap text-[13px] font-extrabold">{tr("Số người")}</span>
              <button type="button" aria-label={tr("Bớt người")} onClick={() => setPax((n) => Math.max(1, n - 1))} className="flex h-8 w-8 items-center justify-center rounded-full bg-white font-extrabold">−</button>
              <span className="min-w-[22px] text-center text-base font-extrabold">{pax}</span>
              <button type="button" aria-label={tr("Thêm người")} onClick={() => setPax((n) => Math.min(20, n + 1))} className="flex h-8 w-8 items-center justify-center rounded-full font-extrabold text-white" style={{ background: G }}>+</button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] gap-2.5">
          {cards.map((p) => {
            const on = p.id === plan.id;
            const RR = planCost(p, cost, { ...opts, skip: {} });
            const t = cost.transports[p.transport];
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => pickTransport(p.id)}
                className="flex flex-col gap-2.5 rounded-[20px] border-2 p-4 text-left transition-all"
                style={{ borderColor: on ? G : "oklch(0.9 0.01 160)", background: on ? "oklch(0.975 0.02 155)" : "white" }}
              >
                <div className="flex w-full items-start justify-between gap-2.5">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full border-2" style={{ borderColor: on ? G : "oklch(0.75 0.01 160)" }}>
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: on ? G : "transparent" }} />
                    </span>
                    <div>
                      <div className="text-[17px] font-extrabold">{tr("Combo {0} + phòng", [tr(t.name)])}</div>
                      {t.when && <div className="text-[13px] text-[oklch(0.48_0.02_160)]">{tr(t.when)}</div>}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] font-bold text-[oklch(0.5_0.02_160)]">{tr("Trọn chuyến / người")}</div>
                    <div className="whitespace-nowrap text-xl font-extrabold text-[oklch(0.58_0.17_45)]">{M(RR.total / pax)}</div>
                  </div>
                </div>
                {t.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {t.tags.map((g) => (
                      <span key={g} className="whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold text-[oklch(0.32_0.05_160)]" style={{ background: on ? "white" : "oklch(0.96 0.008 160)" }}>{tr(g)}</span>
                    ))}
                  </div>
                )}
                {/* Tách rõ mỗi người gồm những gì — tránh hiểu nhầm con số trên là giá xe. */}
                <div className="flex w-full flex-wrap gap-x-3 gap-y-1 border-t border-[oklch(0.92_0.01_160)] pt-2 text-[13px] font-bold text-[oklch(0.38_0.06_158)]">
                  <span>{p.transport === "cabin" ? tr("Xe cabin {0}", [M(RR.trPrice)]) : tr("Limousine {0}", [M(RR.trPrice)])}</span>
                  <span>+ {tr("Phòng {0}", [M(RR.phong / pax)])}</span>
                  <span>+ {tr("Tự túc {0}", [M((RR.cat.xm + RR.cat.an + RR.cat.ve) / pax)])}</span>
                </div>
                <div className="-mt-1.5 text-[11px] font-semibold text-[oklch(0.5_0.02_160)]">
                  {tr("Xe khứ hồi / người · phòng {0}/đêm × {1} phòng × {2} đêm, chia {3} người", [K(RR.room), RR.rooms, p.nights, pax])}
                </div>
              </button>
            );
          })}
        </div>

        {plan.transport === "cabin" && cost.cabinTiers.length > 1 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] font-extrabold text-[oklch(0.45_0.02_160)]">{tr("Hạng cabin")}</span>
            {cost.cabinTiers.map((t) => {
              const on = cabinPrice === t.price;
              return (
                <button
                  key={t.name + t.price}
                  type="button"
                  onClick={() => setCabinPrice(t.price)}
                  className="whitespace-nowrap rounded-full border-[1.5px] px-3 py-[7px] text-[13px] font-extrabold"
                  style={{ borderColor: on ? G : "oklch(0.88 0.015 160)", background: on ? G : "white", color: on ? "white" : "oklch(0.3 0.03 160)" }}
                >
                  {tr(t.name)} · {K(t.price)}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="grid items-start gap-[18px] lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* LỊCH TRÌNH */}
        <div ref={timelineRef} className="flex min-w-0 flex-col gap-3.5">
          {plan.sub && <p className="px-1 text-sm text-[oklch(0.45_0.02_160)]">{tr(plan.sub)}</p>}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[20px] px-[18px] py-3.5 text-white" style={{ background: G }}>
            <div>
              <div className="text-xs font-bold opacity-80">{tr("TRONG COMBO · đặt trên Tà Xùa Booking")}</div>
              <div className="text-base font-extrabold">
                {tr("{0} khứ hồi + {1} phòng × {2} đêm + ăn sáng", [cap(trName(plan.transport)), R.rooms, plan.nights])}
              </div>
              <div className="mt-0.5 text-xs opacity-85">
                {tr("Xe {0} × {1} người · phòng {2} × {3} phòng × {4} đêm ({5})", [K(R.trPrice), pax, K(R.room), R.rooms, plan.nights, weekend ? tr("cuối tuần") : tr("trong tuần")])}
              </div>
            </div>
            {/* Giá mỗi người lên trước (chữ to), tổng cả đoàn bên dưới (chữ nhỏ). */}
            <div className="text-right">
              <div className="whitespace-nowrap text-[22px] font-extrabold leading-tight">
                {M(R.cat.combo / pax)}
                <span className="text-sm font-bold opacity-85">{tr(" / người")}</span>
              </div>
              <div className="whitespace-nowrap text-xs opacity-85">{tr("{0} người: {1}", [pax, M(R.cat.combo)])}</div>
            </div>
          </div>

          {plan.days.map((d, di) => {
            const ci = plan.transport === "cabin" ? di : di + 1;
            const c = DC[ci % 4];
            let sum = 0;
            const rows = d.stops.map((s, si) => {
              const key = `${di}-${si}`;
              if (s.incl || (!s.subs.length && !s.cost)) return { s, key, kind: "incl" as const };
              if (s.subs.length) {
                const subs = s.subs.map((x, xi) => {
                  const k = `${key}-${xi}`;
                  const v = x.cost * costMult(x.unit, pax, cost.perBike);
                  const off = !!skip[k];
                  if (!off) sum += v;
                  return { x, k, v, off };
                });
                return { s, key, kind: "subs" as const, subs, tot: subs.reduce((a, b) => a + (b.off ? 0 : b.v), 0) };
              }
              const n = costMult(s.unit, pax, cost.perBike);
              const v = s.cost * n;
              const off = !!skip[key];
              if (!off) sum += v;
              return { s, key, kind: "cost" as const, n, v, off };
            });
            return (
              <article key={plan.id + di} className="ltc-up overflow-hidden rounded-[22px] border border-[oklch(0.92_0.01_160)] bg-white">
                <div className="flex items-center justify-between gap-2.5 border-b border-[oklch(0.93_0.01_160)] px-[18px] py-3" style={{ background: DB[ci % 4] }}>
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="whitespace-nowrap rounded-full px-[11px] py-1 text-xs font-extrabold text-white" style={{ background: c }}>{d.label ? tr(d.label) : tr("Ngày {0}", [di + 1])}</span>
                    <b className="truncate text-base">{tr(d.title)}</b>
                  </div>
                  <span className="whitespace-nowrap text-[13px] font-extrabold text-[oklch(0.4_0.04_160)]">{sum ? tr("Tự túc {0}", [M(sum)]) : tr("Trong combo")}</span>
                </div>
                <div className="px-2.5 pb-3 pt-2">
                  {rows.map((r, ri) => {
                    const last = ri === rows.length - 1;
                    const s = r.s;
                    const off = r.kind === "cost" && r.off;
                    return (
                      <div key={r.key} className="grid grid-cols-[62px_14px_minmax(0,1fr)] gap-2.5 rounded-[14px] p-2 transition-opacity hover:bg-[oklch(0.975_0.008_155)] sm:grid-cols-[96px_14px_minmax(0,1fr)]" style={{ opacity: off ? 0.45 : 1 }}>
                        <span className="whitespace-nowrap pt-0.5 text-[13px] font-extrabold text-[oklch(0.4_0.03_160)]">{timeTxt(s)}</span>
                        <span className="flex flex-col items-center">
                          <span className="mt-[3px] h-3 w-3 flex-none rounded-full border-[3px] bg-white" style={{ borderColor: c }} />
                          <span className="mt-[3px] w-0.5 flex-1" style={{ background: last ? "transparent" : "oklch(0.92 0.01 160)" }} />
                        </span>
                        <div className="flex min-w-0 flex-col gap-1">
                          <div className="flex items-start justify-between gap-2.5">
                            <div className="min-w-0">
                              <div className={cn("text-[15px] font-extrabold leading-[1.35]", off && "line-through")}>{tr(s.title)}</div>
                              {s.place && <div className="text-xs font-bold text-[oklch(0.5_0.08_158)]">{tr(s.place)}</div>}
                            </div>
                            {r.kind === "incl" ? (
                              <span
                                className="flex-none whitespace-nowrap rounded-full text-sm font-extrabold"
                                style={s.incl === "combo" ? { padding: "3px 10px", background: "oklch(0.94 0.04 155)", color: "oklch(0.36 0.1 155)" } : { color: "oklch(0.55 0.02 160)" }}
                              >
                                {s.incl === "combo" ? tr("Trong combo") : "0đ"}
                              </span>
                            ) : r.kind === "subs" ? (
                              <div className="flex flex-none flex-col items-end gap-0.5 text-right">
                                <span className="whitespace-nowrap text-sm font-extrabold">{M(r.tot)}</span>
                                <span className="whitespace-nowrap text-[11px] text-[oklch(0.52_0.02_160)]">{tr("Bấm từng điểm để bỏ")}</span>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setSkip(r.key, !r.off)}
                                title={r.off ? tr("Thêm lại vào dự trù") : tr("Bỏ mục này khỏi dự trù")}
                                className="flex flex-none flex-col items-end gap-0.5 text-right"
                              >
                                <span className={cn("whitespace-nowrap text-sm font-extrabold", r.off && "line-through")}>{M(r.v)}</span>
                                <span className="whitespace-nowrap text-[11px] text-[oklch(0.52_0.02_160)]">
                                  {r.off ? tr("Đã bỏ · bấm để thêm lại") : s.unit === "group" ? tr("cả đoàn") : `${K(s.cost)} × ${r.n} ${unitWord(s.unit)}`}
                                </span>
                              </button>
                            )}
                          </div>
                          {s.note && <div className="text-pretty text-[13px] leading-normal text-[oklch(0.45_0.02_160)]">{tr(s.note)}</div>}
                          {r.kind === "subs" && (
                            <div className="flex flex-col gap-1 rounded-xl bg-[oklch(0.975_0.006_160)] p-1.5">
                              {r.subs.map(({ x, k, v, off: so }) => (
                                <button
                                  key={k}
                                  type="button"
                                  disabled={!v}
                                  onClick={() => setSkip(k, !so)}
                                  className="flex items-center justify-between gap-2 rounded-[9px] bg-white px-2 py-1.5 text-left disabled:cursor-default"
                                  style={{ opacity: so ? 0.4 : 1 }}
                                >
                                  <span className="flex min-w-0 items-center gap-2">
                                    <span className="h-1.5 w-1.5 flex-none rounded-full" style={{ background: c }} />
                                    <span className={cn("text-[13px] font-bold", so && "line-through")}>{tr(x.name)}</span>
                                    {x.note && <span className="truncate text-[11px] text-[oklch(0.52_0.02_160)]">· {tr(x.note)}</span>}
                                  </span>
                                  <span className={cn("whitespace-nowrap text-[13px] font-extrabold", so && "line-through")} style={{ color: v ? "oklch(0.25 0.03 160)" : "oklch(0.55 0.02 160)" }}>{v ? M(v) : "0đ"}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </article>
            );
          })}
          {cost.note && <div className="px-1.5 py-1 text-[13px] leading-relaxed text-[oklch(0.48_0.02_160)]">{tr(cost.note)}</div>}
          {prep.length > 0 && (
            <div className="flex flex-col gap-2 rounded-[20px] border border-[oklch(0.92_0.01_160)] bg-white px-[18px] py-3.5">
              <div className="text-[15px] font-extrabold text-ink">{tr("Chuẩn bị trước chuyến đi")}</div>
              <div className="grid gap-x-5 gap-y-1.5 text-sm leading-normal text-ink sm:grid-cols-2">
                {prep.map((t) => (
                  <div key={t} className="flex gap-2">
                    <span className="font-extrabold text-[oklch(0.55_0.14_155)]">✓</span>
                    <span>{tr(t)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* TỔNG (desktop) */}
        <aside className="sticky top-[84px] hidden flex-col gap-3 rounded-3xl border border-[oklch(0.92_0.01_160)] bg-white p-[18px] shadow-[0_24px_50px_-30px_oklch(0.25_0.05_160/.35)] lg:flex">
          <div className="text-xs font-extrabold tracking-[.1em] text-[oklch(0.5_0.1_158)]">{tr("DỰ TRÙ CHI PHÍ")}</div>
          <div className="text-lg font-extrabold leading-[1.3]">{sumTitle}</div>
          <div className="flex flex-col gap-2">
            {cats.map((c) => (
              <div key={c.k} className="flex flex-col gap-1">
                <div className="flex justify-between gap-2 text-sm">
                  <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: c.c }} />{c.name}</span>
                  <b>{M(c.v)}</b>
                </div>
                <div className="h-1.5 overflow-hidden rounded-[3px] bg-[oklch(0.95_0.006_160)]">
                  <div className="h-full rounded-[3px] transition-[width] duration-400" style={{ width: `${c.pct}%`, background: c.c }} />
                </div>
              </div>
            ))}
          </div>
          <Totals pax={pax} total={R.total} skippedText={R.nSkip ? tr("Đã bỏ {0} mục, tiết kiệm {1}", [R.nSkip, M(R.skipped)]) : ""} />
          <Link href={comboHref} className="rounded-full p-[13px] text-center text-[15px] font-extrabold text-white transition hover:brightness-105" style={{ background: O }}>
            {tr("Đặt combo {0} này →", [tr(plan.name)])}
          </Link>
          <a href={zalo} target="_blank" rel="noopener noreferrer" className="rounded-full border-[1.5px] border-[oklch(0.85_0.03_158)] p-[11px] text-center text-sm font-extrabold text-[oklch(0.3_0.06_158)] hover:text-sunset-500">
            {tr("Nhờ tư vấn qua Zalo")}
          </a>
          <Link href={`/ban-do?plan=${encodeURIComponent(plan.id)}`} className="text-center text-[13px] font-bold text-[oklch(0.45_0.06_158)] hover:text-sunset-500">
            {tr("Xem cung đường trên bản đồ")}
          </Link>
          {R.nSkip > 0 && (
            <button type="button" onClick={() => setSkips((s) => ({ ...s, [plan.id]: {} }))} className="text-center text-[13px] font-bold text-[oklch(0.45_0.06_158)]">
              {tr("Khôi phục các mục đã bỏ")}
            </button>
          )}
        </aside>
      </div>

      {/* THANH TỔNG (mobile) */}
      <div
        className={cn(
          "fixed inset-x-2.5 bottom-2.5 z-40 flex items-center gap-2.5 rounded-[22px] py-2.5 pl-4 pr-2.5 text-white shadow-[0_16px_30px_-12px_oklch(0.15_0.04_160/.7)] transition-all duration-300 lg:hidden",
          barOn ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-[130%] opacity-0",
        )}
        style={{ background: G, marginBottom: "env(safe-area-inset-bottom)" }}
      >
        <button type="button" onClick={() => setSheet(true)} className="min-w-0 flex-1 text-left">
          <div className="truncate text-xs opacity-85">{tr(plan.name)} · {trName(plan.transport)} · {tr("{0} người", [pax])} ▴</div>
          <div className="text-lg font-extrabold">
            {M(R.total / pax)}
            <span className="text-xs font-semibold opacity-80">{tr(" / người")}</span>
          </div>
        </button>
        <Link href={comboHref} className="whitespace-nowrap rounded-full px-4 py-3 text-sm font-extrabold text-white" style={{ background: O }}>
          {tr("Đặt combo")}
        </Link>
      </div>
      {sheet && (
        <div className="lg:hidden">
          <div onClick={() => setSheet(false)} className="fixed inset-0 z-50 bg-[oklch(0.15_0.03_165/.45)]" />
          <div className="fixed inset-x-0 bottom-0 z-[51] flex max-h-[85dvh] flex-col gap-3 overflow-y-auto rounded-t-3xl bg-white px-[18px] pb-[calc(18px+env(safe-area-inset-bottom))] pt-2.5" style={{ animation: "ltc-sheet .3s cubic-bezier(.2,.8,.2,1) both" }}>
            <div className="h-[5px] w-11 self-center rounded-[3px] bg-[oklch(0.88_0.01_160)]" />
            <div className="flex items-center justify-between gap-2">
              <b className="text-[17px]">{sumTitle}</b>
              <button type="button" aria-label={tr("Đóng")} onClick={() => setSheet(false)} className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full bg-[oklch(0.95_0.005_160)] font-extrabold">×</button>
            </div>
            {cats.map((c) => (
              <div key={c.k} className="flex justify-between gap-2 text-[15px]">
                <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: c.c }} />{c.name}</span>
                <b>{M(c.v)}</b>
              </div>
            ))}
            <Totals pax={pax} total={R.total} skippedText={R.nSkip ? tr("Đã bỏ {0} mục, tiết kiệm {1}", [R.nSkip, M(R.skipped)]) : ""} />
            {R.nSkip > 0 && (
              <button type="button" onClick={() => setSkips((s) => ({ ...s, [plan.id]: {} }))} className="text-center text-[13px] font-bold text-[oklch(0.45_0.06_158)]">
                {tr("Khôi phục các mục đã bỏ")}
              </button>
            )}
            <a href={zalo} target="_blank" rel="noopener noreferrer" className="rounded-full border-[1.5px] border-[oklch(0.85_0.03_158)] p-[13px] text-center text-[15px] font-extrabold text-[oklch(0.3_0.06_158)]">
              {tr("Nhờ tư vấn qua Zalo")}
            </a>
          </div>
        </div>
      )}
    </section>
  );
}

function Totals({ pax, total, skippedText }: { pax: number; total: number; skippedText: string }) {
  const tr = useT();
  return (
    <div className="flex flex-col gap-1 rounded-2xl bg-[oklch(0.97_0.03_75)] p-3.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-extrabold">{tr("Tổng {0} người", [pax])}</span>
        <span className="whitespace-nowrap text-2xl font-extrabold text-[oklch(0.58_0.17_45)]">{M(total)}</span>
      </div>
      <div className="flex justify-between gap-2 text-sm">
        <span>{tr("Mỗi người")}</span>
        <b>{M(total / pax)}</b>
      </div>
      {skippedText && <div className="text-xs text-[oklch(0.5_0.12_45)]">{skippedText}</div>}
    </div>
  );
}
