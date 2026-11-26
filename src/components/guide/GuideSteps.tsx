"use client";

import { useEffect, useRef, useState } from "react";
import Link from "@/components/Link";
import { useT } from "@/components/i18n/I18nProvider";

/**
 * Trang /huong-dan — cột "Quy trình" dính bên trái (điện thoại: dải ngang dính trên đầu) + 6 thẻ bước.
 * Theo claude.ai/design `Huong dan Dat dich vu.dc.html`. Bước đang đọc (theo vị trí cuộn) được tô nổi ở cả hai nơi.
 * Chữ đã dịch sẵn ở server (truyền qua props); chỉ vài nhãn chung gọi `t()` tại đây.
 */
export type GuideStep = {
  icon: string; // path SVG
  title: string;
  lead: string;
  points: string[];
  tip?: string;
  cta?: { href: string; label: string };
  chips?: { t: string; bg: string; fg: string }[];
};

const G = "oklch(0.29 0.055 160)";
const O = "oklch(0.68 0.18 45)";

function Ico({ d, size = 22, sw = 1.8 }: { d: string; size?: number; sw?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

export function GuideSteps({ steps, phone, tel, children }: { steps: GuideStep[]; phone: string; tel: string; children?: React.ReactNode }) {
  const t = useT();
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLElement | null)[]>([]);
  const railRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onScroll = () => {
      const y = window.innerHeight * 0.38;
      let a = 0;
      refs.current.forEach((el, i) => {
        if (el && el.getBoundingClientRect().top < y) a = i;
      });
      setActive(a);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Điện thoại: dải bước cuộn ngang ⇒ tự kéo bước đang đọc vào tầm nhìn.
  // Lần dựng đầu KHÔNG cuộn gì (trang phải đứng yên ở đầu); chỉ kéo dải bước theo chiều ngang, không đụng cuộn dọc của trang.
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    const rail = railRef.current;
    const el = rail?.querySelector<HTMLElement>(`[data-step="${active}"]`);
    if (!rail || !el || rail.scrollWidth <= rail.clientWidth) return;
    rail.scrollLeft = Math.max(0, el.offsetLeft - 16);
  }, [active]);

  const go = (i: number) => {
    const el = refs.current[i];
    if (!el) return;
    const wide = window.innerWidth >= 960;
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - (wide ? 96 : 132), behavior: "smooth" });
  };

  return (
    <div className="grid items-start gap-[clamp(18px,3vw,40px)] min-[960px]:grid-cols-[250px_minmax(0,1fr)]">
      {/* Cột quy trình */}
      <aside
        ref={railRef}
        className="sticky top-[60px] z-20 -mx-4 flex gap-1 overflow-x-auto px-4 py-2 backdrop-blur-md [scrollbar-width:none] min-[960px]:top-[88px] min-[960px]:z-auto min-[960px]:mx-0 min-[960px]:flex-col min-[960px]:overflow-visible min-[960px]:p-0 min-[960px]:backdrop-blur-none max-[959px]:bg-[oklch(0.975_0.008_150_/_.95)]"
      >
        <div className="hidden px-3 pb-2 text-xs font-extrabold uppercase tracking-[.1em] min-[960px]:block" style={{ color: "oklch(0.5 0.08 158)" }}>
          {t("Quy trình")}
        </div>
        {steps.map((s, i) => {
          const on = active === i;
          const done = i < active;
          return (
            <button
              key={i}
              type="button"
              data-step={i}
              data-track-ignore
              onClick={() => go(i)}
              className="flex flex-none items-center gap-2.5 rounded-[14px] border py-[7px] pl-[7px] pr-3 text-left transition-colors min-[960px]:px-3 min-[960px]:py-[9px]"
              style={{ background: on ? "white" : "transparent", borderColor: on ? "oklch(0.88 0.03 158)" : "transparent" }}
            >
              <span
                className="flex h-7 w-7 flex-none items-center justify-center rounded-full text-xs font-extrabold transition-all"
                style={{ background: on ? O : done ? "oklch(0.45 0.1 158)" : "oklch(0.93 0.01 160)", color: on || done ? "white" : "oklch(0.45 0.02 160)" }}
              >
                {done ? "✓" : i + 1}
              </span>
              <span
                className="whitespace-nowrap text-sm leading-[1.3] min-[960px]:whitespace-normal"
                style={{ fontWeight: on ? 800 : 600, color: on ? "oklch(0.22 0.03 160)" : "oklch(0.42 0.02 160)" }}
              >
                {s.title}
              </span>
            </button>
          );
        })}
        <div className="mt-3.5 hidden flex-col gap-2 rounded-2xl p-3.5 text-white min-[960px]:flex" style={{ background: G }}>
          <b className="text-sm">{t("Cần người hướng dẫn?")}</b>
          <span className="text-xs leading-normal" style={{ color: "oklch(0.86 0.02 160)" }}>{t("Gọi hoặc nhắn Zalo, tụi mình đặt giúp bạn.")}</span>
          <a href={`tel:${tel}`} className="flex items-center justify-center gap-1.5 rounded-full bg-white p-[9px] text-[13px] font-extrabold" style={{ color: G }}>
            <Ico d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z" size={15} sw={2} />
            {phone}
          </a>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col gap-[clamp(36px,5vw,56px)]">
        <section id="quy-trinh" className="flex scroll-mt-[140px] flex-col min-[960px]:scroll-mt-24">
          {steps.map((s, i) => {
            const on = active === i;
            const last = i === steps.length - 1;
            return (
              <article
                key={i}
                id={`buoc-${i + 1}`}
                ref={(el) => {
                  refs.current[i] = el;
                }}
                className="grid scroll-mt-[140px] grid-cols-[44px_minmax(0,1fr)] gap-3 sm:grid-cols-[56px_minmax(0,1fr)] sm:gap-[18px] min-[960px]:scroll-mt-24"
              >
                <div className="flex flex-col items-center">
                  <span
                    className="flex h-11 w-11 flex-none items-center justify-center rounded-2xl transition-all duration-200 sm:h-14 sm:w-14"
                    style={{
                      background: on ? G : "white",
                      color: on ? "white" : "oklch(0.38 0.08 158)",
                      boxShadow: on ? "0 10px 22px -10px oklch(0.29 0.055 160 / .7)" : "inset 0 0 0 1.5px oklch(0.88 0.03 158)",
                    }}
                  >
                    <Ico d={s.icon} />
                  </span>
                  <span className="my-2 w-0.5 flex-1" style={{ background: last ? "transparent" : "linear-gradient(180deg, oklch(0.85 0.03 158), oklch(0.92 0.01 160))" }} />
                </div>
                <div className={`min-w-0 ${last ? "" : "pb-[18px]"}`}>
                  <div
                    className="flex flex-col gap-3 rounded-[20px] border bg-white p-[clamp(16px,2.4vw,24px)] transition-[border-color,box-shadow] duration-200"
                    style={{ borderColor: on ? "oklch(0.82 0.05 158)" : "oklch(0.92 0.01 160)", boxShadow: on ? "0 18px 40px -28px oklch(0.25 0.06 160 / .5)" : "none" }}
                  >
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-extrabold uppercase tracking-[.1em]" style={{ color: "oklch(0.6 0.16 45)" }}>{t("Bước {0}", [i + 1])}</span>
                      <h2 className="m-0 text-[clamp(19px,2vw,22px)] font-extrabold leading-tight tracking-[-.015em]">{s.title}</h2>
                      <p className="mt-0.5 text-[15px] leading-[1.6] [text-wrap:pretty]" style={{ color: "oklch(0.42 0.02 160)" }}>{s.lead}</p>
                    </div>
                    <ul className="flex flex-col gap-2">
                      {s.points.map((pt) => (
                        <li key={pt} className="grid grid-cols-[20px_minmax(0,1fr)] gap-2 text-sm leading-[1.55]" style={{ color: "oklch(0.3 0.02 160)" }}>
                          <span className="mt-px flex h-5 w-5 items-center justify-center rounded-full" style={{ background: "oklch(0.95 0.035 155)", color: "oklch(0.42 0.1 155)" }}>
                            <Ico d="M5 12.5l4.5 4.5L19 7" size={12} sw={3} />
                          </span>
                          <span>{pt}</span>
                        </li>
                      ))}
                    </ul>
                    {s.chips && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        {s.chips.map((c) => (
                          <span key={c.t} className="whitespace-nowrap rounded-full px-2.5 py-[5px] text-xs font-bold" style={{ background: c.bg, color: c.fg }}>{c.t}</span>
                        ))}
                      </div>
                    )}
                    {s.tip && (
                      <div
                        className="grid grid-cols-[20px_minmax(0,1fr)] gap-2.5 rounded-[14px] border px-3.5 py-3 text-[13px] leading-[1.55]"
                        style={{ background: "oklch(0.975 0.03 85)", borderColor: "oklch(0.92 0.05 85)", color: "oklch(0.38 0.07 65)" }}
                      >
                        <Ico d="M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18M12 11v5M12 8h.01" size={20} />
                        <span><b>{t("Lưu ý:")}</b> {s.tip}</span>
                      </div>
                    )}
                    {s.cta && (
                      <Link
                        href={s.cta.href}
                        className="flex items-center gap-1.5 self-start rounded-full px-4 py-2.5 text-sm font-extrabold transition-colors hover:brightness-95"
                        style={{ background: "oklch(0.95 0.03 155)", color: "oklch(0.33 0.08 158)" }}
                      >
                        {s.cta.label}
                      </Link>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </section>
        {children}
      </div>
    </div>
  );
}
