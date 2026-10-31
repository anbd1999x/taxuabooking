"use client";

import { useEffect, useState } from "react";

const G = "oklch(0.29 0.055 160)";

export function ServiceTabNav({ tabs }: { tabs: { key: string; label: string; badge?: string }[] }) {
  const [active, setActive] = useState(tabs[0]?.key ?? "");

  useEffect(() => {
    const els = tabs
      .map((t) => document.getElementById(`sec-${t.key}`))
      .filter((e): e is HTMLElement => !!e);
    if (els.length === 0) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const vis = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (vis[0]) setActive(vis[0].target.id.replace("sec-", ""));
      },
      { rootMargin: "-80px 0px -60% 0px", threshold: 0 },
    );
    els.forEach((e) => obs.observe(e));
    return () => obs.disconnect();
  }, [tabs]);

  function go(key: string) {
    const el = document.getElementById(`sec-${key}`);
    if (el) {
      setActive(key);
      window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 16, behavior: "smooth" });
    }
  }

  return (
    <nav className="flex gap-1 overflow-x-auto rounded-2xl bg-white p-1 ring-1 ring-black/5 lg:sticky lg:top-4 lg:flex-col lg:overflow-visible lg:bg-transparent lg:p-0 lg:ring-0">
      {tabs.map((t) => {
        const a = active === t.key;
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => go(t.key)}
            className="flex flex-none items-center justify-between gap-2.5 whitespace-nowrap rounded-xl px-3.5 py-2.5 text-sm font-bold transition"
            style={{
              background: a ? "white" : "transparent",
              color: a ? G : "oklch(0.42 0.02 160)",
              boxShadow: a ? "0 1px 4px oklch(0.2 0.03 160 / .12)" : "none",
            }}
          >
            <span>{t.label}</span>
            {t.badge && (
              <span
                className="rounded-full px-2 py-0.5 text-xs font-bold"
                style={{ background: a ? "oklch(0.94 0.03 155)" : "oklch(0.93 0.006 150)", color: "oklch(0.4 0.06 160)" }}
              >
                {t.badge}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
