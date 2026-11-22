"use client";

import Link from "@/components/Link";
import { useMemo, useState } from "react";
import { MediaSlider, type MediaItem } from "./MediaSlider";
import { ItineraryHero, type HeroPlan } from "./ItineraryHero";
import type { ItCost } from "@/lib/itinerary";
import { ItineraryCost, type CostPlan } from "./ItineraryCost";
import { cn } from "@/lib/utils";
import { useT } from "@/components/i18n/I18nProvider";

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

export type ViewPlan = CostPlan;

const TABS: [Tab, string][] = [
  ["checkin", "Điểm check-in"],
  ["cafe", "Quán cafe"],
  ["food", "Nhà hàng & quán ăn"],
];
const EMPTY_PLAN: ViewPlan = { id: "", name: "", sub: "", transport: "cabin", nights: 0, days: [] };

export function ItineraryView({ plans, places, cost, zalo, prep, initialPlan }: { plans: ViewPlan[]; places: ItineraryPlace[]; cost: ItCost; zalo: string; prep: string[]; initialPlan?: string }) {
  const tr = useT();
  const [planKey, setPlanKey] = useState((initialPlan && plans.some((p) => p.id === initialPlan) ? initialPlan : plans[0]?.id) ?? "");
  const [tab, setTab] = useState<Tab>("checkin");
  const [only, setOnly] = useState(false);
  const plan = plans.find((p) => p.id === planKey) ?? plans[0] ?? EMPTY_PLAN;

  // Địa điểm nào xuất hiện ở ngày nào của lịch trình đang chọn (mục "Nên ghé").
  const inPlan = useMemo(() => {
    const m = new Map<string, number[]>();
    plan.days.forEach((d, di) =>
      d.stops.forEach((s) => {
        if (!s.placeId) return;
        const a = m.get(s.placeId) ?? [];
        if (!a.includes(di + 1)) a.push(di + 1);
        m.set(s.placeId, a);
      }),
    );
    return m;
  }, [plan]);

  const go = (which: "plan" | "place") => {
    const el = document.getElementById(which === "plan" ? "lt-plan" : "lt-places");
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 76, behavior: "smooth" });
  };
  // Thẻ chọn lịch trình ở phần đầu trang: một thẻ / thời lượng (các cách đi cùng tên gộp lại).
  const heroPlans: HeroPlan[] = [...new Set(plans.map((p) => p.name))].map((name) => {
    const group = plans.filter((p) => p.name === name);
    const p = group.find((x) => x.transport === plan.transport) ?? group[0];
    return {
      id: p.id,
      name,
      title: p.nights ? tr("{0} ngày {1} đêm", [p.nights + 1, p.nights]) : tr("Trong ngày"),
      meta: group.map((x) => { const n = tr(cost.transports[x.transport].name); return n.charAt(0).toUpperCase() + n.slice(1); }).join(" · "),
    };
  });
  const activeHero = heroPlans.find((h) => h.name === plan.name)?.id ?? plan.id;
  const jumpPlan = (k: string) => { setPlanKey(k); go("plan"); };
  const jumpTab = (t: Tab) => { setTab(t); setTimeout(() => go("place"), 30); };

  // Thẻ của một tab (đã áp ô lọc "chỉ điểm có trong lịch trình").
  const cardsOf = (t: Tab) => places.filter((p) => p.kind === t && (!only || inPlan.has(p.id)));
  const cards = cardsOf(tab);

  return (
    <div className="bg-[oklch(0.975_0.01_150)]">
      <style>{`@keyframes lt-rise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}.lt-rise{animation:lt-rise .4s ease both}.lt-stop:hover{border-color:var(--lt-c)!important}@keyframes lt-blink{from{opacity:.35}to{opacity:1}}.lt-blink{animation:lt-blink .8s ease infinite alternate}@media (prefers-reduced-motion:reduce){.lt-rise,.lt-blink{animation:none}}@media (max-width:639px){.lt-compact [data-lt-card]{left:8px!important;top:8px!important;padding:5px 9px!important;border-radius:12px!important;gap:1px!important;max-width:calc(100% - 118px)!important}.lt-compact [data-lt-name]{font-size:13px!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.lt-compact [data-lt-type]{display:none!important}.lt-compact [data-lt-ctrl]{right:8px!important;top:8px!important;gap:4px!important}.lt-compact [data-lt-ctrl] button{width:30px!important;height:30px!important;font-size:12px!important}}`}</style>
      <ItineraryHero plans={heroPlans} activeId={activeHero} onPick={jumpPlan} onTab={jumpTab} />
      <div className="container-page flex flex-col gap-7 pb-14 pt-8">
        {plans.length > 0 && <ItineraryCost plans={plans} cost={cost} planId={plan.id} onPlan={setPlanKey} zalo={zalo} prep={prep} />}

        {/* ĐIỂM NÊN GHÉ */}
        <section id="lt-places" className="flex scroll-mt-20 flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-3.5">
            <div>
              <h2 className="text-[clamp(22px,2.8vw,30px)] font-extrabold tracking-[-.02em] text-ink">{tr("Nên ghé ở Tà Xùa")}</h2>
              <p className="mt-1 text-sm text-[oklch(0.48_0.02_160)]">
                {tr("Gợi ý của Tà Xùa Booking · giá tham khảo")}
              </p>
            </div>
            <label className="flex cursor-pointer items-center gap-2 whitespace-nowrap text-sm font-semibold text-ink">
              <input type="checkbox" checked={only} onChange={() => setOnly((o) => !o)} className="h-[17px] w-[17px] accent-[oklch(0.35_0.08_160)]" />
              {tr("Chỉ điểm có trong")}{" "}{tr(plan.name)}
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
                  {tr(name)}
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
                        {tr(p.name)}
                      </div>
                    )}
                    <div className="pointer-events-none absolute inset-x-2.5 top-2.5 flex justify-between gap-1.5">
                      <span className="max-w-full rounded-full bg-white px-2.5 py-[5px] text-xs font-extrabold text-ink">{tr(p.badge)}</span>
                      {daysIn && (
                        <span className="whitespace-nowrap rounded-full bg-[oklch(0.68_0.18_45)] px-2.5 py-[5px] text-xs font-extrabold text-white">
                          {tr("Ngày {0} · {1}", [daysIn.join(", "), tr(plan.name)])}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-1 flex-col gap-2 px-4 pb-4 pt-3.5">
                    <div>
                      <div className="text-[17px] font-extrabold leading-[1.3] tracking-[-.01em] text-ink">
                        {p.href ? <Link href={p.href} className="hover:text-sunset-500">{tr(p.name)}</Link> : tr(p.name)}
                      </div>
                      {p.sub && <div className="mt-0.5 text-[13px] font-semibold text-[oklch(0.5_0.02_160)]">{tr(p.sub)}</div>}
                    </div>
                    {p.desc && <div className="line-clamp-4 text-pretty text-sm leading-[1.55] text-[oklch(0.38_0.02_160)]">{tr(p.desc)}</div>}
                    {p.facts.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {p.facts.map((f) => (
                          <span key={f} className="max-w-full rounded-full bg-[oklch(0.95_0.025_155)] px-[9px] py-1 text-xs font-bold text-[oklch(0.36_0.08_155)]">{tr(f)}</span>
                        ))}
                      </div>
                    )}
                    {p.tip && (
                      <div className="text-[13px] leading-normal text-[oklch(0.48_0.13_50)]">
                        <b>{tr("Mẹo:")}</b> {tr(p.tip)}
                      </div>
                    )}
                    <div className="flex-1" />
                    <div className="flex items-center justify-between gap-3 border-t border-[oklch(0.94_0.01_160)] pt-2.5 text-sm font-bold text-[oklch(0.4_0.08_160)]">
                      <a href={p.mapUrl} target="_blank" rel="noopener noreferrer" className="hover:text-sunset-500">{tr("Chỉ đường Google Maps ↗")}</a>
                      {p.href && <Link href={p.href} className="hover:text-sunset-500">{tr("Xem quán →")}</Link>}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
          {cards.length === 0 && (
            <div className="rounded-[20px] border-[1.5px] border-dashed border-[oklch(0.85_0.02_160)] bg-white px-5 py-10 text-center text-[15px] text-[oklch(0.45_0.02_160)]">
              {tr("Lịch trình {0} chưa có điểm loại này. Bỏ tích ô lọc để xem tất cả.", [tr(plan.name)])}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
