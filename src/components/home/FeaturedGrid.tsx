"use client";

import Link from "@/components/Link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { ServiceCategory } from "@prisma/client";
import { CATEGORIES, serviceCatSlug } from "@/lib/constants";
import { formatPrice } from "@/lib/format";
import type { ServiceCard as Data } from "@/lib/queries";
import { useT } from "@/components/i18n/I18nProvider";

/**
 * "Homestay & dịch vụ nổi bật" — thiết kế v5: thẻ ảnh mở dần khi cuộn tới, nghiêng 3D theo chuột (desktop);
 * màn hẹp = băng trượt ngang (snap giữa), thẻ hai bên thu nhỏ & xoay nhẹ, chấm chỉ vị trí.
 */
export function FeaturedGrid({ services }: { services: Data[] }) {
  const t = useT();
  const cats = Array.from(new Set(services.map((s) => s.category)));
  const [active, setActive] = useState<"ALL" | ServiceCategory>("ALL");
  const [cur, setCur] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const pills: { key: "ALL" | ServiceCategory; label: string }[] = [
    { key: "ALL", label: t("Tất cả") },
    ...cats.map((c) => ({ key: c, label: t(CATEGORIES[c].shortLabel) })),
  ];
  const shown = active === "ALL" ? services : services.filter((s) => s.category === active);

  // Đổi bộ lọc ⇒ thẻ mới dựng lại sau khi HomeReveal đã quét: cho hiện luôn.
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    trackRef.current?.querySelectorAll("[data-rv],[data-clip]").forEach((el) => el.classList.add("is-in"));
  }, [active]);

  // Băng trượt (màn < 720px): thu nhỏ/xoay thẻ theo khoảng cách tới tâm + cập nhật chấm.
  useEffect(() => {
    const tr = trackRef.current;
    if (!tr) return;
    const update = () => {
      const cards = tr.querySelectorAll<HTMLElement>("[data-card]");
      if (window.innerWidth >= 720) {
        cards.forEach((c) => {
          c.style.opacity = "";
          if (!c.dataset.tilting) c.style.transform = "";
        });
        return;
      }
      const tb = tr.getBoundingClientRect();
      const cx = tb.left + tb.width / 2;
      let best = 0;
      let bd = 1e9;
      cards.forEach((c, i) => {
        const r = c.getBoundingClientRect();
        const mid = r.left + r.width / 2;
        const d = Math.abs(mid - cx) / r.width;
        const z = Math.min(1, d);
        if (d < bd) {
          bd = d;
          best = i;
        }
        c.style.transform = `scale(${1 - z * 0.08}) rotateY(${(mid < cx ? 1 : -1) * z * 8}deg)`;
        c.style.opacity = String(1 - z * 0.35);
      });
      setCur(best);
    };
    update();
    tr.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      tr.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [shown.length, active]);

  const tilt = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse" || window.innerWidth < 720) return;
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.dataset.tilting = "1";
    el.style.transform = `rotateY(${x * 10}deg) rotateX(${-y * 10}deg) translateZ(10px)`;
  };
  const untilt = (e: React.PointerEvent<HTMLDivElement>) => {
    if (window.innerWidth < 720) return;
    delete e.currentTarget.dataset.tilting;
    e.currentTarget.style.transform = "";
  };

  return (
    <section className="mx-auto max-w-[1240px] px-[clamp(16px,4vw,40px)] pt-[clamp(56px,7vw,84px)]">
      <div data-rv className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-[clamp(26px,3vw,34px)] font-extrabold tracking-[-.025em] text-ink">{t("Homestay & dịch vụ nổi bật")}</h2>
          <p className="mt-1.5 text-sm" style={{ color: "oklch(0.48 0.02 160)" }}>
            {t("Chọn loại dịch vụ để lọc nhanh; chọn ngày ở thanh tìm kiếm phía trên để xem tình trạng.")}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {pills.map((p) => {
            const a = p.key === active;
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => {
                  setActive(p.key);
                  trackRef.current?.scrollTo({ left: 0 });
                }}
                className="whitespace-nowrap rounded-full border px-3.5 py-2 text-[13px] font-bold transition"
                style={
                  a
                    ? { background: "oklch(0.33 0.07 158)", borderColor: "oklch(0.33 0.07 158)", color: "white" }
                    : { background: "white", borderColor: "oklch(0.88 0.015 160)", color: "oklch(0.3 0.03 160)" }
                }
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="rounded-[18px] border-[1.5px] border-dashed p-10 text-center" style={{ borderColor: "oklch(0.86 0.02 160)", color: "oklch(0.5 0.02 160)" }}>
          {t("Chưa có dịch vụ nổi bật trong mục này.")}
        </div>
      ) : (
        <div
          ref={trackRef}
          key={active}
          className="-mx-[clamp(16px,4vw,40px)] grid snap-x snap-mandatory auto-cols-[76%] grid-flow-col gap-3.5 overflow-x-auto px-[clamp(16px,4vw,40px)] pb-2.5 pt-1.5 [perspective:1200px] [scrollbar-width:none] min-[720px]:mx-0 min-[720px]:snap-none min-[720px]:grid-flow-row min-[720px]:grid-cols-[repeat(auto-fill,minmax(min(100%,220px),1fr))] min-[720px]:overflow-visible min-[720px]:p-0 min-[1100px]:grid-cols-[repeat(auto-fill,minmax(min(100%,240px),1fr))]"
        >
          {shown.map((s, i) => (
            <Card key={s.id} s={s} delay={(i % 4) * 0.08} tilt={tilt} untilt={untilt} />
          ))}
        </div>
      )}

      {shown.length > 1 && (
        <div className="mt-3.5 flex justify-center gap-1.5 min-[720px]:hidden" aria-hidden>
          {shown.map((s, i) => (
            <span
              key={s.id}
              className="h-1.5 rounded-[3px] transition-all duration-300"
              style={{ width: i === cur ? 22 : 6, background: i === cur ? "oklch(0.68 0.18 45)" : "oklch(0.82 0.02 160)" }}
            />
          ))}
        </div>
      )}

      <div className="mt-[22px] flex justify-center">
        <Link
          href="/homestay"
          className="rounded-full border-[1.5px] px-[22px] py-3 text-sm font-extrabold transition hover:bg-[oklch(0.35_0.08_158)] hover:text-white"
          style={{ borderColor: "oklch(0.45 0.1 158)", color: "oklch(0.35 0.08 158)" }}
        >
          {t("Xem tất cả dịch vụ")}
        </Link>
      </div>
    </section>
  );
}

function Card({
  s,
  delay,
  tilt,
  untilt,
}: {
  s: Data;
  delay: number;
  tilt: (e: React.PointerEvent<HTMLDivElement>) => void;
  untilt: (e: React.PointerEvent<HTMLDivElement>) => void;
}) {
  const t = useT();
  const cat = CATEGORIES[s.category];
  const price = s.availability?.fromPrice ?? s.basePrice;
  const original = s.originalPrice != null && price != null && s.originalPrice > price ? s.originalPrice : null;
  const img = s.coverImage ?? s.images[0]?.url ?? null;

  return (
    <Link href={`/${serviceCatSlug(s.category)}/${s.slug}`} data-rv className="group flex snap-center" style={{ ["--d" as string]: `${delay}s` }}>
      <div
        data-card
        onPointerMove={tilt}
        onPointerLeave={untilt}
        className="flex flex-1 flex-col overflow-hidden rounded-[20px] border bg-white transition-[transform,box-shadow] duration-300 ease-[cubic-bezier(.2,.7,.2,1)] [transform-style:preserve-3d] group-hover:shadow-[0_26px_50px_-24px_oklch(0.2_0.04_160/.45)]"
        style={{ borderColor: "oklch(0.92 0.01 160)" }}
      >
        <div data-clip className="relative aspect-[4/3] overflow-hidden bg-forest-50" style={{ ["--d" as string]: `${delay}s` }}>
          {img && (
            <Image
              src={img}
              alt={t(s.title)}
              fill
              sizes="(max-width:720px) 76vw, 300px"
              className="object-cover transition-transform duration-700 ease-[cubic-bezier(.2,.7,.2,1)] group-hover:scale-[1.06]"
            />
          )}
          <div className="pointer-events-none absolute left-2.5 top-2.5 flex gap-1.5">
            <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold" style={{ color: "oklch(0.3 0.04 160)" }}>{t(cat.shortLabel)}</span>
            {s.featured && (
              <span className="rounded-full px-2.5 py-1 text-[11px] font-extrabold text-white" style={{ background: "oklch(0.68 0.18 45)" }}>{t("Nổi bật")}</span>
            )}
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-[5px] px-3.5 pb-4 pt-3">
          <div className="text-base font-extrabold tracking-[-.01em] text-ink">{t(s.title)}</div>
          {s.area && <div className="text-xs" style={{ color: "oklch(0.5 0.02 160)" }}>{t(s.area)}</div>}
          <div className="line-clamp-2 text-[13px] leading-normal" style={{ color: "oklch(0.4 0.02 160)" }}>{t(s.summary)}</div>
          <div className="flex-1" />
          <div className="mt-1.5 flex items-center justify-between gap-2">
            <span className="min-w-0">
              {original != null && <span className="mr-1 text-xs text-gray-400 line-through">{t(formatPrice(original))}</span>}
              <b className="text-lg" style={{ color: "oklch(0.45 0.1 158)" }}>{price != null ? t(formatPrice(price)) : t("Liên hệ")}</b>
              {price != null && s.priceUnit && <span className="text-xs" style={{ color: "oklch(0.5 0.02 160)" }}>{t(s.priceUnit)}</span>}
            </span>
            <span className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full font-extrabold" style={{ background: "oklch(0.95 0.025 155)", color: "oklch(0.35 0.08 158)" }}>
              →
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
