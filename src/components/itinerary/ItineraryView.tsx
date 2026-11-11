"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { MediaSlider, type MediaItem } from "./MediaSlider";
import type { StopKind } from "@/lib/itinerary";
import { cn } from "@/lib/utils";

type Tab = "checkin" | "cafe" | "food";

export interface ItineraryPlace {
  id: string;
  kind: Tab;
  name: string;
  badge: string; // nhãn góc ảnh: khoảng cách (check-in) hoặc khu vực (quán)
  sub: string;
  desc: string;
  tip: string;
  facts: string[];
  media: MediaItem[]; // ảnh bìa + ảnh/video khác (rỗng = nền màu kèm tên)
  href: string | null; // trang chi tiết quán (điểm check-in không có)
  mapUrl: string;
}

export interface ViewPlan {
  id: string;
  name: string;
  sub: string;
  days: { title: string; stops: { time: string; name: string; note: string; kind: StopKind; placeId: string | null }[] }[];
}

// [nhãn, nền chip, chữ chip, màu chấm timeline]
const TYPE: Record<StopKind, [string, string, string, string]> = {
  checkin: ["Check-in", "oklch(0.95 0.03 250)", "oklch(0.42 0.1 250)", "oklch(0.56 0.14 250)"],
  cafe: ["Cafe", "oklch(0.95 0.05 70)", "oklch(0.46 0.13 55)", "oklch(0.66 0.16 55)"],
  food: ["Ăn uống", "oklch(0.95 0.04 28)", "oklch(0.5 0.15 28)", "oklch(0.6 0.17 28)"],
  move: ["Di chuyển", "oklch(0.95 0.005 160)", "oklch(0.45 0.02 160)", "oklch(0.6 0.02 160)"],
};
const DAY_COLORS = ["oklch(0.66 0.17 45)", "oklch(0.52 0.13 155)", "oklch(0.52 0.13 250)"];
const LINE = "oklch(0.9 0.01 160)";
const TABS: [Tab, string][] = [
  ["checkin", "Điểm check-in"],
  ["cafe", "Quán cafe"],
  ["food", "Nhà hàng & quán ăn"],
];
const EMPTY_PLAN: ViewPlan = { id: "", name: "", sub: "", days: [] };

export function ItineraryView({ plans, places, prep }: { plans: ViewPlan[]; places: ItineraryPlace[]; prep: string[] }) {
  const [planKey, setPlanKey] = useState(plans[0]?.id ?? "");
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  const [tab, setTab] = useState<Tab>("checkin");
  const [only, setOnly] = useState(false);

  const plan = plans.find((p) => p.id === planKey) ?? plans[0] ?? EMPTY_PLAN;
  const shown = useMemo(() => new Map(places.map((p) => [p.id, p])), [places]);

  // Dựng các ngày + ghi nhận địa điểm nào xuất hiện ở ngày nào của lịch trình đang chọn.
  const { days, inPlan, stats } = useMemo(() => {
    const inPlan = new Map<string, number[]>(); // id Place → các ngày
    const count: Record<StopKind, Set<string>> = { checkin: new Set(), cafe: new Set(), food: new Set(), move: new Set() };
    let meals = 0;
    const days = plan.days.map((d, di) => ({
      title: d.title,
      n: di + 1,
      color: DAY_COLORS[di % DAY_COLORS.length],
      meta: `${d.stops.length} điểm dừng · ${d.stops[0].time} – ${d.stops[d.stops.length - 1].time}`,
      stops: d.stops.map((s) => {
        if (s.placeId) {
          const a = inPlan.get(s.placeId) ?? [];
          if (!a.includes(di + 1)) a.push(di + 1);
          inPlan.set(s.placeId, a);
          count[s.kind].add(s.placeId);
        }
        if (s.kind === "food") meals++;
        // tab chứa thẻ chi tiết của điểm này (null = không có thẻ ở mục "Nên ghé")
        const target = s.placeId ? (shown.get(s.placeId)?.kind ?? null) : null;
        return { time: s.time, name: s.name, note: s.note, kind: s.kind, target };
      }),
    }));
    return { days, inPlan, stats: [
      { v: count.checkin.size, k: "Điểm check-in" },
      { v: count.cafe.size, k: "Quán cafe" },
      { v: meals, k: "Bữa ăn" },
    ] };
  }, [plan, shown]);

  const go = (which: "plan" | "place") => {
    const el = document.getElementById(which === "plan" ? "lt-plan" : "lt-places");
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 76, behavior: "smooth" });
  };
  const jumpPlan = (k: string) => { setPlanKey(k); go("plan"); };
  const jumpTab = (t: Tab) => { setTab(t); setTimeout(() => go("place"), 30); };

  // Thẻ của một tab (đã áp ô lọc "chỉ điểm có trong lịch trình").
  const cardsOf = (t: Tab) => places.filter((p) => p.kind === t && (!only || inPlan.has(p.id)));
  const cards = cardsOf(tab);

  return (
    <div className="bg-[oklch(0.975_0.01_150)]">
      <style>{`@keyframes lt-rise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}.lt-rise{animation:lt-rise .4s ease both}`}</style>
      <div className="container-page flex flex-col gap-7 pb-14 pt-5">
        {/* HERO */}
        <section
          className="lt-rise flex flex-col gap-[18px] rounded-[26px] p-[clamp(22px,4vw,40px)] text-white"
          style={{ background: "linear-gradient(160deg, oklch(0.32 0.06 165), oklch(0.24 0.045 160))" }}
        >
          <div className="text-xs font-extrabold uppercase tracking-[.12em] text-[oklch(0.85_0.1_75)]">Cẩm nang · Lịch trình gợi ý</div>
          <h1 className="max-w-[760px] text-balance text-[clamp(28px,4.4vw,46px)] font-extrabold leading-[1.08] tracking-[-.03em]">
            Đi Tà Xùa mấy ngày, đi đâu, ăn gì?
          </h1>
          <p className="max-w-[620px] text-pretty text-base leading-relaxed text-[oklch(0.88_0.03_160)]">
            Lịch trình theo giờ cho chuyến xe cabin đêm từ Hà Nội, kèm danh sách điểm check-in, quán cafe và quán ăn nên ghé.
          </p>
          <div className="flex flex-wrap gap-2">
            {([
              ...plans.map((p) => [`Lịch trình ${p.name}`, () => jumpPlan(p.id)] as const),
              ["Điểm check-in", () => jumpTab("checkin")] as const,
              ["Cafe & quán ăn", () => jumpTab("cafe")] as const,
            ]).map(([name, fn]) => (
              <button
                key={name}
                type="button"
                onClick={fn}
                className="whitespace-nowrap rounded-full border border-white/20 bg-white/[.12] px-4 py-[9px] text-sm font-bold transition hover:bg-white/20"
              >
                {name}
              </button>
            ))}
          </div>
        </section>

        {/* LỊCH TRÌNH */}
        <section id="lt-plan" className="flex scroll-mt-20 flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-3.5">
            <div>
              <h2 className="text-[clamp(22px,2.8vw,30px)] font-extrabold tracking-[-.02em] text-ink">Lịch trình gợi ý</h2>
              <p className="mt-1 text-sm text-[oklch(0.48_0.02_160)]">{plan.sub}</p>
            </div>
            <div className="inline-flex gap-1 rounded-[14px] bg-[oklch(0.93_0.01_160)] p-1">
              {plans.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPlanKey(p.id)}
                  className={cn(
                    "whitespace-nowrap rounded-[11px] px-[18px] py-2.5 text-[15px] font-extrabold transition-all",
                    p.id === plan.id ? "bg-[oklch(0.29_0.055_160)] text-white shadow" : "text-[oklch(0.4_0.02_160)]",
                  )}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="flex min-w-0 flex-col gap-3.5">
              {days.map((d, di) => {
                const id = plan.id + di;
                const open = !closed[id];
                return (
                  <article key={id} className="lt-rise overflow-hidden rounded-[22px] border border-[oklch(0.92_0.01_160)] bg-white">
                    <button
                      type="button"
                      aria-expanded={open}
                      onClick={() => setClosed((c) => ({ ...c, [id]: open }))}
                      className={cn("flex w-full items-center justify-between gap-3 px-5 py-4 text-left", open && "bg-[oklch(0.985_0.006_160)]")}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex-none whitespace-nowrap rounded-full px-[11px] py-[5px] text-xs font-extrabold text-white" style={{ background: d.color }}>
                          Ngày {d.n}
                        </span>
                        <div className="min-w-0">
                          <div className="text-[17px] font-extrabold tracking-[-.01em] text-ink">{d.title}</div>
                          <div className="text-[13px] text-[oklch(0.5_0.02_160)]">{d.meta}</div>
                        </div>
                      </div>
                      <span className={cn("flex-none text-lg font-extrabold text-[oklch(0.45_0.02_160)] transition-transform", open && "rotate-180")}>⌄</span>
                    </button>
                    {open && (
                      <div className="flex flex-col px-5 pb-[18px] pt-1.5">
                        {d.stops.map((s, si) => {
                          const t = TYPE[s.kind];
                          return (
                            <div key={si} className="grid grid-cols-[52px_22px_minmax(0,1fr)] items-stretch gap-2.5">
                              <div className="pt-3 text-sm font-extrabold text-[oklch(0.35_0.03_160)]">{s.time}</div>
                              <div className="flex flex-col items-center">
                                <span className="h-3.5 w-0.5" style={{ background: si === 0 ? "transparent" : LINE }} />
                                <span className="h-3.5 w-3.5 flex-none rounded-full bg-white" style={{ border: `3px solid ${t[3]}` }} />
                                <span className="w-0.5 flex-1" style={{ background: si === d.stops.length - 1 ? "transparent" : LINE }} />
                              </div>
                              <div className="flex min-w-0 flex-col gap-1 pb-3 pt-[9px]">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-[15px] font-extrabold text-ink">{s.name}</span>
                                  <span className="whitespace-nowrap rounded-full px-2 py-[3px] text-[11px] font-extrabold" style={{ background: t[1], color: t[2] }}>
                                    {t[0]}
                                  </span>
                                </div>
                                <div className="text-pretty text-sm leading-[1.55] text-[oklch(0.42_0.02_160)]">{s.note}</div>
                                {s.target && (
                                  <button type="button" onClick={() => jumpTab(s.target!)} className="self-start text-[13px] font-bold text-[oklch(0.45_0.1_160)] hover:text-sunset-500">
                                    Xem chi tiết điểm này ↓
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>

            <aside className="flex flex-col gap-3 lg:sticky lg:top-[84px]">
              <div className="flex flex-col gap-3.5 rounded-[22px] border border-[oklch(0.92_0.01_160)] bg-white px-5 py-[18px]">
                <div className="text-[17px] font-extrabold text-ink">{plan.name} gồm những gì</div>
                <div className="grid grid-cols-3 gap-2">
                  {stats.map((s) => (
                    <div key={s.k} className="rounded-[14px] bg-[oklch(0.97_0.008_160)] p-2.5">
                      <div className="text-xl font-extrabold text-ink">{s.v}</div>
                      <div className="text-xs font-semibold text-[oklch(0.5_0.02_160)]">{s.k}</div>
                    </div>
                  ))}
                </div>
                <div className="flex flex-col gap-2 text-sm leading-normal text-ink">
                  {prep.map((t) => (
                    <div key={t} className="flex gap-2">
                      <span className="font-extrabold text-[oklch(0.55_0.14_155)]">✓</span>
                      <span>{t}</span>
                    </div>
                  ))}
                </div>
                <Link href="/combo" className="rounded-full bg-[oklch(0.68_0.18_45)] p-[13px] text-center text-[15px] font-extrabold text-white transition hover:brightness-105">
                  Đặt combo {plan.name} →
                </Link>
                <Link href="/kinh-nghiem" className="rounded-full border-[1.5px] border-[oklch(0.88_0.015_160)] p-[11px] text-center text-sm font-bold text-[oklch(0.4_0.08_160)] transition hover:text-sunset-500">
                  Đọc thêm kinh nghiệm Tà Xùa
                </Link>
              </div>
            </aside>
          </div>
        </section>

        {/* ĐIỂM NÊN GHÉ */}
        <section id="lt-places" className="flex scroll-mt-20 flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-3.5">
            <div>
              <h2 className="text-[clamp(22px,2.8vw,30px)] font-extrabold tracking-[-.02em] text-ink">Nên ghé ở Tà Xùa</h2>
              <p className="mt-1 text-sm text-[oklch(0.48_0.02_160)]">
                Gợi ý của Tà Xùa Booking · giá tham khảo
              </p>
            </div>
            <label className="flex cursor-pointer items-center gap-2 whitespace-nowrap text-sm font-semibold text-ink">
              <input type="checkbox" checked={only} onChange={() => setOnly((o) => !o)} className="h-[17px] w-[17px] accent-[oklch(0.35_0.08_160)]" />
              Chỉ điểm có trong {plan.name}
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            {TABS.map(([k, name]) => {
              const on = tab === k;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setTab(k)}
                  className={cn(
                    "flex items-center gap-2 whitespace-nowrap rounded-full border-[1.5px] px-[18px] py-2.5 text-[15px] font-extrabold transition",
                    on ? "border-[oklch(0.29_0.055_160)] bg-[oklch(0.29_0.055_160)] text-white" : "border-[oklch(0.9_0.01_160)] bg-white text-[oklch(0.3_0.03_160)]",
                  )}
                >
                  {name}
                  <span className={cn("rounded-full px-2 py-0.5 text-xs font-extrabold", on ? "bg-white/[.18]" : "bg-[oklch(0.95_0.005_160)]")}>{cardsOf(k).length}</span>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))] gap-4">
            {cards.map((p) => {
              const daysIn = inPlan.get(p.id);
              return (
                <article
                  key={p.id}
                  className={cn(
                    "lt-rise flex flex-col overflow-hidden rounded-[20px] border bg-white transition-shadow duration-300 hover:shadow-[0_18px_40px_-22px_oklch(0.25_0.05_160/.45)]",
                    daysIn ? "border-[oklch(0.85_0.07_60)]" : "border-[oklch(0.92_0.01_160)]",
                  )}
                >
                  <div className="relative aspect-[16/10]">
                    {p.media.length ? (
                      <MediaSlider items={p.media} name={p.name} />
                    ) : (
                      <div
                        className="flex h-full w-full items-end p-4 text-lg font-extrabold leading-tight text-white/90"
                        style={{ background: "linear-gradient(160deg, oklch(0.5 0.07 200), oklch(0.34 0.06 165) 60%, oklch(0.27 0.05 160))" }}
                      >
                        {p.name}
                      </div>
                    )}
                    <div className="pointer-events-none absolute inset-x-2.5 top-2.5 flex justify-between gap-1.5">
                      <span className="whitespace-nowrap rounded-full bg-white px-2.5 py-[5px] text-xs font-extrabold text-ink">{p.badge}</span>
                      {daysIn && (
                        <span className="whitespace-nowrap rounded-full bg-[oklch(0.68_0.18_45)] px-2.5 py-[5px] text-xs font-extrabold text-white">
                          Ngày {daysIn.join(", ")} · {plan.name}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-1 flex-col gap-2 px-4 pb-4 pt-3.5">
                    <div>
                      <div className="text-[17px] font-extrabold leading-[1.3] tracking-[-.01em] text-ink">
                        {p.href ? <Link href={p.href} className="hover:text-sunset-500">{p.name}</Link> : p.name}
                      </div>
                      {p.sub && <div className="mt-0.5 text-[13px] font-semibold text-[oklch(0.5_0.02_160)]">{p.sub}</div>}
                    </div>
                    {p.desc && <div className="line-clamp-4 text-pretty text-sm leading-[1.55] text-[oklch(0.38_0.02_160)]">{p.desc}</div>}
                    {p.facts.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {p.facts.map((f) => (
                          <span key={f} className="whitespace-nowrap rounded-full bg-[oklch(0.95_0.025_155)] px-[9px] py-1 text-xs font-bold text-[oklch(0.36_0.08_155)]">{f}</span>
                        ))}
                      </div>
                    )}
                    {p.tip && (
                      <div className="text-[13px] leading-normal text-[oklch(0.48_0.13_50)]">
                        <b>Mẹo:</b> {p.tip}
                      </div>
                    )}
                    <div className="flex-1" />
                    <div className="flex items-center justify-between gap-3 border-t border-[oklch(0.94_0.01_160)] pt-2.5 text-sm font-bold text-[oklch(0.4_0.08_160)]">
                      <a href={p.mapUrl} target="_blank" rel="noopener noreferrer" className="hover:text-sunset-500">Chỉ đường Google Maps ↗</a>
                      {p.href && <Link href={p.href} className="hover:text-sunset-500">Xem quán →</Link>}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
          {cards.length === 0 && (
            <div className="rounded-[20px] border-[1.5px] border-dashed border-[oklch(0.85_0.02_160)] bg-white px-5 py-10 text-center text-[15px] text-[oklch(0.45_0.02_160)]">
              Lịch trình {plan.name} chưa có điểm loại này. Bỏ tích ô lọc để xem tất cả.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
