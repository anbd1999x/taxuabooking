"use client";

import Link from "next/link";
import Image from "next/image";
import { useMemo, useState } from "react";
import { MediaSlider, type MediaItem } from "./MediaSlider";
import { ItineraryScene, type SceneStop } from "./ItineraryScene";
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

export interface ViewStop {
  time: string; // HH:MM
  name: string;
  note: string;
  kind: StopKind;
  placeId: string | null;
  km: number | null; // khoảng cách tới trung tâm (ước lượng chặng di chuyển)
  thumb: string | null; // ảnh nhỏ của địa điểm
  fact: string | null; // giá / vé tham khảo
}

export interface ViewPlan {
  id: string;
  name: string;
  sub: string;
  days: { title: string; stops: ViewStop[] }[];
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

const mins = (t: string) => +t.slice(0, 2) * 60 + +t.slice(3, 5);
const period = (t: string) => {
  const x = mins(t) / 60;
  return x < 5 ? "Rạng sáng" : x < 8 ? "Bình minh" : x < 11 ? "Buổi sáng" : x < 13.5 ? "Buổi trưa" : x < 17 ? "Buổi chiều" : x < 19 ? "Hoàng hôn" : "Buổi tối";
};
const hm = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} giờ${m % 60 ? ` ${m % 60} phút` : ""}` : `${m} phút`);

export function ItineraryView({ plans, places, prep }: { plans: ViewPlan[]; places: ItineraryPlace[]; prep: string[] }) {
  const [planKey, setPlanKey] = useState(plans[0]?.id ?? "");
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  const [tab, setTab] = useState<Tab>("checkin");
  const [only, setOnly] = useState(false);
  const [cur, setCur] = useState(0); // cảnh đang chiếu (chỉ số điểm dừng đã trải phẳng)
  const [playing, setPlaying] = useState(true);

  const plan = plans.find((p) => p.id === planKey) ?? plans[0] ?? EMPTY_PLAN;
  const shown = useMemo(() => new Map(places.map((p) => [p.id, p])), [places]);

  // Trải phẳng các điểm dừng thành danh sách cảnh cho "phim lịch trình".
  const flat = useMemo<SceneStop[]>(() => {
    const total = plan.days.reduce((a, d) => a + d.stops.length, 0);
    const out: SceneStop[] = [];
    plan.days.forEach((d, di) =>
      d.stops.forEach((s, si) => {
        const gi = out.length;
        const mode = s.kind !== "move" ? "spot" : gi === 0 ? "arrive" : gi === total - 1 ? "leave" : "spot";
        const n = s.name.toLowerCase();
        const prop =
          mode !== "spot" ? "stop" :
          s.kind === "move" ? "none" :
          s.kind !== "checkin" ? "hut" :
          /cây cô đơn/.test(n) ? "tree" :
          /chè/.test(n) ? "tea" :
          /(^|\s)bản\s/.test(n) ? "hut" : "flag";
        out.push({ di, si, time: s.time, name: s.name, note: s.note, kind: s.kind, mode, sit: s.kind === "cafe" || s.kind === "food", prop });
      }),
    );
    return out;
  }, [plan]);
  const ci = cur < flat.length ? cur : 0;
  const curDay = flat[ci]?.di ?? 0;

  // Dựng các ngày + ghi nhận địa điểm nào xuất hiện ở ngày nào của lịch trình đang chọn.
  const { days, inPlan, stats } = useMemo(() => {
    const inPlan = new Map<string, number[]>(); // id Place → các ngày
    const count: Record<StopKind, Set<string>> = { checkin: new Set(), cafe: new Set(), food: new Set(), move: new Set() };
    let meals = 0;
    let gi = 0;
    const last = plan.days.reduce((a, d) => a + d.stops.length, 0) - 1;
    const days = plan.days.map((d, di) => {
      let dayKm = 0;
      const stops = d.stops.map((s, si) => {
        if (s.placeId) {
          const a = inPlan.get(s.placeId) ?? [];
          if (!a.includes(di + 1)) a.push(di + 1);
          inPlan.set(s.placeId, a);
          count[s.kind].add(s.placeId);
        }
        if (s.kind === "food") meals++;
        const nx = d.stops[si + 1];
        const stay = nx ? mins(nx.time) - mins(s.time) : 0;
        const chips: string[] = [];
        if (stay > 0) chips.push(`Ở lại ${hm(stay)}`);
        if (s.fact) chips.push(s.fact);
        // chặng di chuyển tới điểm kế: ước lượng theo chênh lệch khoảng cách tới trung tâm
        let travel: { mode: string; text: string; bg: string; fg: string } | null = null;
        if (nx) {
          const shuttle = (s.kind === "move" && gi === 0) || (nx.kind === "move" && gi + 1 === last);
          const dist = s.km != null && nx.km != null ? Math.max(1, Math.abs(s.km - nx.km)) : null;
          if (dist != null) dayKm += dist;
          const km = dist != null ? `${String(dist).replace(".", ",")} km` : "";
          travel = shuttle
            ? { mode: "Xe trung chuyển", text: gi === 0 ? "~40 phút lên Tà Xùa" : "Ra điểm đón xe", bg: "oklch(0.95 0.03 250)", fg: "oklch(0.42 0.1 250)" }
            : dist == null
              ? { mode: "Di chuyển", text: "", bg: "oklch(0.95 0.005 160)", fg: "oklch(0.45 0.02 160)" }
              : dist <= 1.5
                ? { mode: "Đi bộ", text: `~${Math.round(dist * 12)} phút · ${km}`, bg: "oklch(0.95 0.04 155)", fg: "oklch(0.4 0.1 155)" }
                : { mode: "Xe máy", text: `~${Math.round(dist * 3 + 5)} phút · ${km}`, bg: "oklch(0.95 0.05 70)", fg: "oklch(0.48 0.14 50)" };
        }
        // tab chứa thẻ chi tiết của điểm này (null = không có thẻ ở mục "Nên ghé")
        const target = s.placeId ? (shown.get(s.placeId)?.kind ?? null) : null;
        const row = { gi, time: s.time, period: period(s.time), name: s.name, note: s.note, t: TYPE[s.kind], thumb: s.thumb, chips, travel, target, on: gi === ci, done: gi < ci };
        gi++;
        return row;
      });
      const nCheck = d.stops.filter((s) => s.kind === "checkin").length;
      const nEat = d.stops.filter((s) => s.kind === "cafe" || s.kind === "food").length;
      const id = plan.id + di;
      const isCur = curDay === di;
      return {
        id,
        title: d.title,
        n: di + 1,
        color: DAY_COLORS[di % DAY_COLORS.length],
        isCur,
        open: !closed[id] || isCur, // ngày đang chiếu luôn mở
        chips: [
          `${d.stops[0].time} → ${d.stops[d.stops.length - 1].time}`,
          ...(nCheck ? [`${nCheck} điểm check-in`] : []),
          ...(nEat ? [`${nEat} quán ăn & cafe`] : []),
          ...(dayKm >= 1 ? [`~${Math.round(dayKm)} km xe máy`] : []),
        ],
        stops,
      };
    });
    return { days, inPlan, stats: [
      { v: count.checkin.size, k: "Điểm check-in" },
      { v: count.cafe.size, k: "Quán cafe" },
      { v: meals, k: "Bữa ăn" },
    ] };
  }, [plan, shown, ci, curDay, closed]);

  const go = (which: "plan" | "place") => {
    const el = document.getElementById(which === "plan" ? "lt-plan" : "lt-places");
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 76, behavior: "smooth" });
  };
  const pickPlan = (k: string) => { setPlanKey(k); setCur(0); };
  const jumpPlan = (k: string) => { pickPlan(k); go("plan"); };
  const jumpTab = (t: Tab) => { setTab(t); setTimeout(() => go("place"), 30); };
  // Chiếu cảnh của một điểm dừng; cảnh đang khuất phía trên thì cuộn lên cho thấy.
  const jumpTo = (i: number) => {
    setCur(i);
    setPlaying(true);
    const el = document.getElementById("lt-scene");
    if (el && el.getBoundingClientRect().top < 60) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 84, behavior: "smooth" });
  };

  // Thẻ của một tab (đã áp ô lọc "chỉ điểm có trong lịch trình").
  const cardsOf = (t: Tab) => places.filter((p) => p.kind === t && (!only || inPlan.has(p.id)));
  const cards = cardsOf(tab);

  return (
    <div className="bg-[oklch(0.975_0.01_150)]">
      <style>{`@keyframes lt-rise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}.lt-rise{animation:lt-rise .4s ease both}.lt-stop:hover{border-color:var(--lt-c)!important}@keyframes lt-blink{from{opacity:.35}to{opacity:1}}.lt-blink{animation:lt-blink .8s ease infinite alternate}@media (prefers-reduced-motion:reduce){.lt-rise,.lt-blink{animation:none}}`}</style>
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
                  onClick={() => pickPlan(p.id)}
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

          <div className="flex flex-col gap-2">
            <ItineraryScene
              flat={flat}
              cur={ci}
              playing={playing}
              onAdvance={() => setCur((c) => (c + 1) % (flat.length || 1))}
              onPrev={() => setCur((ci - 1 + flat.length) % (flat.length || 1))}
              onNext={() => setCur((ci + 1) % (flat.length || 1))}
              onToggle={() => setPlaying((p) => !p)}
              onJump={jumpTo}
            />
            <div className="text-[13px] text-[oklch(0.5_0.02_160)]">
              Phim lịch trình tự chạy qua từng điểm. Bấm một điểm trong lịch trình bên dưới để xem cảnh đó.
            </div>
          </div>

          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="flex min-w-0 flex-col gap-3.5">
              {days.map((d) => (
                <article
                  key={d.id}
                  className="lt-rise overflow-hidden rounded-3xl border bg-white transition-[box-shadow,border-color] duration-300"
                  style={{
                    borderColor: d.isCur ? `color-mix(in oklch, ${d.color} 45%, white)` : "oklch(0.92 0.01 160)",
                    boxShadow: d.isCur ? "0 18px 40px -26px oklch(0.3 0.06 160 / .5)" : "none",
                  }}
                >
                  <button
                    type="button"
                    aria-expanded={d.open}
                    onClick={() => setClosed((c) => ({ ...c, [d.id]: d.open }))}
                    className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3.5 px-[18px] py-4 text-left"
                    style={{ background: `linear-gradient(90deg, color-mix(in oklch, ${d.color} 10%, white), white 70%)` }}
                  >
                    <div
                      className="flex h-[58px] w-[58px] flex-col items-center justify-center rounded-[18px] leading-none text-white"
                      style={{ background: d.color, boxShadow: `0 8px 16px -8px ${d.color}` }}
                    >
                      <span className="text-[10px] font-extrabold tracking-[.12em] opacity-85">NGÀY</span>
                      <span className="mt-0.5 text-[26px] font-extrabold">{d.n}</span>
                    </div>
                    <div className="flex min-w-0 flex-col gap-1.5">
                      <div className="text-lg font-extrabold leading-tight tracking-[-.015em] text-ink">{d.title}</div>
                      <div className="flex flex-wrap gap-1.5">
                        {d.chips.map((c) => (
                          <span key={c} className="whitespace-nowrap rounded-full border border-[oklch(0.9_0.01_160)] bg-white px-[9px] py-1 text-xs font-bold text-[oklch(0.38_0.02_160)]">{c}</span>
                        ))}
                      </div>
                      <div className="flex max-w-[260px] gap-[3px]">
                        {d.stops.map((s) => (
                          <span key={s.gi} className="h-[5px] flex-1 rounded-[3px]" style={{ background: s.t[3], opacity: s.on || s.done ? 1 : 0.35 }} />
                        ))}
                      </div>
                    </div>
                    <span className={cn("flex h-[34px] w-[34px] items-center justify-center rounded-full border border-[oklch(0.9_0.01_160)] bg-white text-base font-extrabold text-[oklch(0.4_0.02_160)] transition-transform duration-200", d.open && "rotate-180")}>⌄</span>
                  </button>
                  {d.open && (
                    <div className="flex flex-col px-[18px] pb-5 pt-2">
                      {d.stops.map((s, si) => (
                        <div key={s.gi} className="grid grid-cols-[50px_30px_minmax(0,1fr)] gap-3 min-[560px]:grid-cols-[64px_30px_minmax(0,1fr)]">
                          <div className="pt-4 text-right">
                            <div className="text-[17px] font-extrabold tracking-[-.01em]" style={{ color: s.on ? "oklch(0.6 0.18 45)" : "oklch(0.3 0.03 160)" }}>{s.time}</div>
                            <div className="mt-0.5 text-[11px] font-bold text-[oklch(0.55_0.02_160)]">{s.period}</div>
                          </div>
                          <div className="flex flex-col items-center">
                            <span className="h-4 w-0.5" style={{ background: si === 0 ? "transparent" : LINE }} />
                            <span
                              className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-full text-xs font-extrabold transition-all duration-300"
                              style={{
                                background: s.on || s.done ? s.t[3] : "white",
                                color: s.on || s.done ? "white" : s.t[3],
                                border: `2.5px solid ${s.t[3]}`,
                                boxShadow: s.on ? `0 0 0 5px color-mix(in oklch, ${s.t[3]} 22%, transparent)` : "none",
                              }}
                            >
                              {si + 1}
                            </span>
                            <span className="mt-0.5 w-0.5 flex-1" style={{ background: si === d.stops.length - 1 ? "transparent" : LINE }} />
                          </div>
                          <div className="flex min-w-0 flex-col gap-2 pb-1 pt-2">
                            <div
                              role="button"
                              tabIndex={0}
                              onClick={() => jumpTo(s.gi)}
                              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); jumpTo(s.gi); } }}
                              className={cn(
                                "lt-stop grid cursor-pointer items-start gap-3 rounded-[18px] border-[1.5px] p-3 transition-all duration-200 hover:-translate-y-px",
                                s.thumb && "min-[560px]:grid-cols-[76px_minmax(0,1fr)]",
                              )}
                              style={{ background: s.on ? "oklch(0.985 0.02 70)" : "white", borderColor: s.on ? "oklch(0.8 0.12 60)" : "oklch(0.93 0.01 160)", ["--lt-c" as string]: s.t[3] }}
                            >
                              {s.thumb && (
                                <div className="relative hidden h-[76px] w-[76px] flex-none overflow-hidden rounded-[14px] min-[560px]:block">
                                  <Image src={s.thumb} alt="" fill sizes="76px" className="object-cover" />
                                </div>
                              )}
                              <div className="flex min-w-0 flex-col gap-[5px]">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="whitespace-nowrap rounded-full px-2 py-[3px] text-[11px] font-extrabold" style={{ background: s.t[1], color: s.t[2] }}>{s.t[0]}</span>
                                  {s.on && (
                                    <span className="flex items-center gap-[5px] whitespace-nowrap rounded-full bg-[oklch(0.68_0.18_45)] px-2 py-[3px] text-[11px] font-extrabold text-white">
                                      <span className="lt-blink h-1.5 w-1.5 rounded-full bg-white" />
                                      Đang chiếu
                                    </span>
                                  )}
                                </div>
                                <div className="text-base font-extrabold leading-[1.3] text-ink">{s.name}</div>
                                {s.note && <div className="text-pretty text-sm leading-normal text-[oklch(0.42_0.02_160)]">{s.note}</div>}
                                {(s.chips.length > 0 || s.target) && (
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    {s.chips.map((c) => (
                                      <span key={c} className="whitespace-nowrap rounded-full bg-[oklch(0.96_0.008_160)] px-[9px] py-[3px] text-xs font-bold text-[oklch(0.4_0.02_160)]">{c}</span>
                                    ))}
                                    {s.target && (
                                      <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); jumpTab(s.target!); }}
                                        className="whitespace-nowrap text-xs font-extrabold text-[oklch(0.45_0.1_160)] hover:text-sunset-500"
                                      >
                                        Chi tiết ↓
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                            {s.travel && (
                              <div className="flex items-center gap-2 pb-1 pl-3 pt-0.5 text-xs font-bold text-[oklch(0.5_0.02_160)]">
                                <span className="flex h-[22px] items-center justify-center whitespace-nowrap rounded-full px-[9px]" style={{ background: s.travel.bg, color: s.travel.fg }}>{s.travel.mode}</span>
                                {s.travel.text && <span className="whitespace-nowrap">{s.travel.text}</span>}
                                <span className="h-0 min-w-5 flex-1 border-t-2 border-dashed border-[oklch(0.88_0.015_160)]" />
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </article>
              ))}
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
