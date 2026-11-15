"use client";

import { useEffect, useRef, useState } from "react";
import Link from "@/components/Link";
import { useT } from "@/components/i18n/I18nProvider";
import { useSitePhone } from "@/components/SiteContact";

/**
 * Các lớp chuyển động dùng chung của trang chủ v5:
 * - <HomeSky/>: nền trời cố định phía sau trang, mây mờ trôi ngang & trôi theo cuộn.
 * - <HomeReveal/>: phần tử [data-rv] trồi lên, [data-clip] mở ảnh, [data-px] parallax khi cuộn tới.
 * - <HomeMobileBar/>: thanh Gọi / Zalo / Đặt combo nổi ở đáy (màn hẹp), hiện sau khi cuộn qua hero.
 */

const GLIDE = Array.from({ length: 16 }, (_, i) => {
  const d = i % 3;
  return {
    sp: [0.15, 0.35, 0.6][d],
    x: (i * 41 + 7) % 100,
    y: (i * 29 + 11) % 100,
    w: ["34vw", "44vw", "58vw"][d],
    a: [0.7, 0.8, 0.9][d],
    a2: [0.35, 0.45, 0.55][d],
    bl: [18, 14, 10][d],
  };
});

const reduced = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

export function HomeSky() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const sky = ref.current;
    if (!sky) return;
    const R = reduced();
    const els = sky.querySelectorAll<HTMLElement>("[data-glide]");
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const t = (now - t0) / 1000;
      const W = window.innerWidth;
      const vh = window.innerHeight;
      const sy = window.scrollY || 0;
      const span = vh + 600;
      els.forEach((c, i) => {
        const g = GLIDE[i];
        const bx = (g.x / 100) * (W + 400) - 200;
        const by = (g.y / 100) * span;
        const y = (((by - sy * g.sp) % span) + span) % span - 300;
        const x = (((bx + (R ? 0 : t * (8 + g.sp * 30))) % (W + 600)) + (W + 600)) % (W + 600) - 400;
        c.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${1 + (R ? 0 : Math.sin(t * 0.2 + i) * 0.04)})`;
      });
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      style={{ background: "linear-gradient(180deg, oklch(0.955 0.022 225) 0%, oklch(0.97 0.014 190) 55%, oklch(0.975 0.01 150) 100%)" }}
    >
      {GLIDE.map((c, i) => (
        <div
          key={i}
          data-glide
          className="absolute left-0 top-0 rounded-full will-change-transform"
          style={{
            width: c.w,
            aspectRatio: "2.6",
            background: `radial-gradient(ellipse at 50% 45%, oklch(1 0 0 / ${c.a}) 0%, oklch(1 0 0 / ${c.a2}) 45%, oklch(1 0 0 / 0) 70%)`,
            filter: `blur(${c.bl}px)`,
            transform: "translate3d(-200vw,0,0)",
          }}
        />
      ))}
    </div>
  );
}

/** CSS trạng thái ban đầu + đã hiện của các phần tử cuộn-tới-mới-hiện. */
export const REVEAL_CSS = `
[data-rv]{opacity:0;transform:translateY(40px);transition:opacity .9s var(--d,0s),transform .9s cubic-bezier(.2,.7,.2,1) var(--d,0s)}
[data-rv].is-in{opacity:1;transform:none}
[data-clip]{clip-path:inset(0 0 100% 0);transition:clip-path 1.1s cubic-bezier(.7,0,.2,1) var(--d,0s)}
[data-clip][data-clip-up]{clip-path:inset(100% 0 0 0)}
[data-clip].is-in{clip-path:inset(0 0 0 0)}
@keyframes twinkle{0%,100%{opacity:.25}50%{opacity:1}}
[data-tw]{animation:twinkle var(--tw,3s) ease-in-out infinite}
@media (prefers-reduced-motion: reduce){[data-rv],[data-clip]{opacity:1!important;transform:none!important;clip-path:none!important;transition:none!important}[data-tw]{animation:none;opacity:.7}}
`;

export function HomeReveal() {
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>("[data-rv],[data-clip]");
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("is-in");
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 60% -8% 0px", threshold: 0 },
    );
    els.forEach((el) => io.observe(el));

    // Parallax nhẹ cho [data-px] (ảnh bài viết, dải mây trong khối cabin).
    const R = reduced();
    const pxs = [...document.querySelectorAll<HTMLElement>("[data-px]")];
    let raf = 0;
    const update = () => {
      raf = 0;
      const vh = window.innerHeight;
      for (const el of pxs) {
        const r = el.parentElement!.getBoundingClientRect();
        if (r.bottom < -200 || r.top > vh + 200) continue;
        el.style.transform = R ? "none" : `translate3d(0, ${(r.top + r.height / 2 - vh / 2) * Number(el.dataset.px)}px, 0)`;
      }
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    if (pxs.length) {
      update();
      window.addEventListener("scroll", onScroll, { passive: true });
    }
    return () => {
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);
  return null;
}

export function HomeMobileBar() {
  const t = useT();
  const phone = useSitePhone().replace(/\D/g, "");
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => {
      const sy = window.scrollY || 0;
      const vh = window.innerHeight;
      const docH = document.documentElement.scrollHeight;
      setShow(sy > vh * 0.62 && sy < docH - vh - 260);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const btn = "flex items-center justify-center rounded-full px-4 py-3 text-sm font-extrabold";
  return (
    <div
      className="fixed inset-x-3 z-[45] grid grid-cols-[auto_auto_minmax(0,1fr)] gap-1.5 rounded-full p-1.5 backdrop-blur-xl transition-transform duration-500 ease-[cubic-bezier(.2,.8,.2,1)] min-[1080px]:hidden"
      style={{
        bottom: "calc(12px + env(safe-area-inset-bottom))",
        background: "oklch(1 0 0 / .86)",
        boxShadow: "0 18px 40px -16px oklch(0.2 0.04 180 / .5), 0 0 0 1px oklch(0.92 0.01 160)",
        transform: show ? "translateY(0)" : "translateY(160%)",
      }}
    >
      <a href={`tel:${phone}`} className={btn} style={{ background: "oklch(0.95 0.02 155)", color: "oklch(0.3 0.06 158)" }}>
        {t("Gọi")}
      </a>
      <a href={`https://zalo.me/${phone}`} target="_blank" rel="noopener noreferrer" className={btn} style={{ background: "oklch(0.95 0.02 155)", color: "oklch(0.3 0.06 158)" }}>
        Zalo
      </a>
      <Link href="/combo" className={`${btn} whitespace-nowrap text-white`} style={{ background: "oklch(0.68 0.18 45)" }}>
        {t("Đặt combo →")}
      </Link>
    </div>
  );
}
