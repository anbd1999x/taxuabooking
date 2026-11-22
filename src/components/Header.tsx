"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "@/components/Link";
import { CATEGORY_LIST } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useT } from "@/components/i18n/I18nProvider";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { useSitePhone } from "@/components/SiteContact";

/** Dòng phụ dưới mỗi dịch vụ trong menu mobile (thiết kế "Trang chủ v5"). */
const MENU_SUB: Record<string, string> = {
  COMBO: "Xe + phòng",
  CABIN: "21:00 mỗi tối",
  HOMESTAY: "View biển mây",
  MOTORBIKE: "Giao tận nơi",
  XEOM: "Tài xế bản địa",
  TAXI: "4–7 chỗ",
};

/** Trang chủ (kể cả /en, /zh, /ko): header trong suốt nằm đè lên ảnh hero, cuộn xuống mới hiện nền. */
const isHomePath = (p: string) => /^\/(en|zh|ko)?\/?$/.test(p);

/** `showCommitment` = công tắc "Hiện menu & link cam kết" ở /admin/popup (tách riêng với công tắc popup). */
export function Header({ customerName = null, showCommitment = true, showTickets = false }: { customerName?: string | null; showCommitment?: boolean; /** có địa điểm bán vé / đặt bàn đang mở bán ⇒ hiện mục "Vé & đặt bàn" */ showTickets?: boolean }) {
  const t = useT();
  const pathname = usePathname() || "/";
  const home = isHomePath(pathname);
  const phone = useSitePhone();
  const [open, setOpen] = useState(false);
  const [dd, setDd] = useState<"" | "guide" | "partner">(""); // dropdown đang mở (desktop): Cẩm nang / Hợp tác
  const [scrolled, setScrolled] = useState(false);
  const progRef = useRef<HTMLDivElement>(null);
  const firstName = customerName ? customerName.trim().split(/\s+/).slice(-1)[0] : "";
  const initials = customerName
    ? customerName.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("")
    : "TX";

  // Thanh tiến độ đọc + đổi nền header khi cuộn qua hero.
  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const sy = window.scrollY || 0;
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      if (progRef.current) progRef.current.style.width = `${Math.min(1, sy / max) * 100}%`;
      setScrolled(sy > window.innerHeight * 0.5);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [pathname]);

  // Mở menu ⇒ khoá cuộn trang (link trong menu tự đóng menu khi bấm).
  useEffect(() => {
    document.documentElement.style.overflow = open ? "hidden" : "";
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, [open]);

  // Menu mobile: báo còn mục bên dưới (mép mờ + nút "Vuốt xem thêm" nhún) cho tới khi cuộn gần hết.
  const menuScrollRef = useRef<HTMLDivElement>(null);
  const [moreBelow, setMoreBelow] = useState(false);
  // Menu mobile: mục "Cẩm nang Tà Xùa" / "Về chúng tôi" bấm mới xổ xuống (mở menu ⇒ cả hai đóng, xem nút mở menu).
  const [acc, setAcc] = useState<"" | "guide" | "about">("");
  const checkMore = () => {
    const el = menuScrollRef.current;
    if (el) setMoreBelow(el.scrollHeight - el.scrollTop - el.clientHeight > 24);
  };
  useEffect(() => {
    const el = menuScrollRef.current;
    if (!open || !el) return;
    el.scrollTop = 0;
    checkMore();
    window.addEventListener("resize", checkMore);
    return () => window.removeEventListener("resize", checkMore);
  }, [open]);
  // Xổ / thu ⇒ chiều cao đổi: đo lại sau hiệu ứng để nút "Vuốt xem thêm" đúng.
  useEffect(() => {
    const id = setTimeout(checkMore, 320);
    return () => clearTimeout(id);
  }, [acc]);

  const solid = !home || scrolled;
  const onDark = !solid;

  const GUIDE_LINKS = [
    { href: "/lich-trinh", label: t("Lịch trình & chi phí") },
    { href: "/ban-do", label: t("Bản đồ check-in") },
    { href: "/kinh-nghiem", label: t("Kinh nghiệm Tà Xùa") },
    { href: "/nha-hang", label: t("Nhà hàng Tà Xùa") },
    { href: "/cafe", label: t("Cafe Tà Xùa") },
    { href: "/huong-dan", label: t("Hướng dẫn đặt dịch vụ") },
    { href: "/tra-cuu", label: t("Tra cứu đơn hàng") },
  ];
  // Menu cha "Về chúng tôi": Cam kết (với khách) + Hợp tác (với chủ dịch vụ, trang /hop-tac) + Góp ý.
  const ABOUT_LINKS = [
    ...(showCommitment ? [{ href: "/cam-ket", label: t("Cam kết"), sub: t("Đền tới 100tr nếu dịch vụ sai cam kết") }] : []),
    { href: "/hop-tac", label: t("Hợp tác"), sub: t("Phần mềm miễn phí cho chủ dịch vụ") },
    { href: "/gop-y", label: t("Góp ý"), sub: t("Gửi góp ý để Tà Xùa Booking phục vụ tốt hơn") },
  ];

  const navItem = cn(
    "whitespace-nowrap rounded-full px-3 py-2 text-sm font-semibold transition",
    onDark ? "text-white hover:bg-white/10" : "text-gray-700 hover:bg-forest-50 hover:text-forest-700",
  );
  const zaloNum = phone.replace(/\D/g, "");

  return (
    <>
      <header
        className={cn(
          "z-40 transition-[background,box-shadow,color] duration-300",
          home ? "fixed inset-x-0 top-0" : "sticky top-0",
          solid
            ? "bg-[oklch(0.99_0.004_150/.94)] text-ink shadow-[0_1px_0_oklch(0.9_0.01_160)] backdrop-blur-md"
            : "bg-transparent text-white",
        )}
      >
        <div
          ref={progRef}
          aria-hidden
          className="pointer-events-none absolute bottom-0 left-0 h-0.5 w-0"
          style={{ background: "linear-gradient(90deg, oklch(0.8 0.14 75), oklch(0.68 0.18 45))" }}
        />
        <div className="container-page flex h-14 items-center justify-between gap-4 lg:h-[70px]">
          <Link href="/" className="flex items-center gap-2.5 whitespace-nowrap text-[17px] font-extrabold sm:text-lg">
            <span
              className={cn(
                "flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full border-2 text-[13px] text-white",
                onDark ? "border-white/70" : "border-white",
              )}
              style={{ background: "oklch(0.35 0.08 158)" }}
            >
              TX
            </span>
            <span className={onDark ? "text-white" : "text-forest-800"} style={onDark ? { textShadow: "0 1px 10px oklch(0.15 0.03 180 / .5)" } : undefined}>
              {t("Tà Xùa")} <span style={{ color: "oklch(0.72 0.17 50)" }}>Booking</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex" style={onDark ? { textShadow: "0 1px 10px oklch(0.15 0.03 180 / .45)" } : undefined}>
            {CATEGORY_LIST.map((c) => (
              <Link key={c.slug} href={`/${c.slug}`} className={navItem}>
                {t(c.shortLabel)}
              </Link>
            ))}
            {showTickets && (
              <Link href="/ve" className={navItem}>
                {t("Vé & đặt bàn")}
              </Link>
            )}
            {/* Menu cấp 2: hover hoặc click mới xổ ra */}
            {([["guide", t("Cẩm nang"), GUIDE_LINKS]] as const).map(([key, label, links]) => (
              <div key={key} className="group relative" onMouseLeave={() => setDd("")}>
                <button type="button" onClick={() => setDd((o) => (o === key ? "" : key))} className={cn(navItem, "flex items-center gap-1")}>
                  {label}
                  <span className="text-[10px] transition group-hover:rotate-180">▼</span>
                </button>
                {/* pt-1 làm cầu nối hover giữa nút và panel (không bị tắt khi rê chuột qua khe) */}
                <div className={cn("absolute top-full left-0 z-50 pt-1", dd === key ? "block" : "hidden group-hover:block")}>
                  <div className="w-56 rounded-2xl bg-white p-1.5 text-ink shadow-lg ring-1 ring-black/5" style={{ textShadow: "none" }}>
                    {links.map((l) => (
                      <Link
                        key={l.href}
                        href={l.href}
                        onClick={() => setDd("")}
                        className="block rounded-xl px-3 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-forest-50 hover:text-forest-700"
                      >
                        {l.label}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            ))}
            {/* Menu cha "Về chúng tôi" (Cam kết · Hợp tác) */}
            <div className="group relative" onMouseLeave={() => setDd("")}>
              <button type="button" onClick={() => setDd((o) => (o === "partner" ? "" : "partner"))} className={cn(navItem, "flex items-center gap-1")}>
                {t("Về chúng tôi")}
                <span className="text-[10px] transition group-hover:rotate-180">▼</span>
              </button>
              <div className={cn("absolute right-0 top-full z-50 pt-1", dd === "partner" ? "block" : "hidden group-hover:block")}>
                <div className="w-72 rounded-2xl bg-white p-1.5 text-ink shadow-lg ring-1 ring-black/5" style={{ textShadow: "none" }}>
                  {ABOUT_LINKS.map((l) => (
                    <Link
                      key={l.href}
                      href={l.href}
                      onClick={() => setDd("")}
                      className="flex flex-col rounded-xl px-3 py-2.5 transition hover:bg-forest-50"
                    >
                      <span className="text-sm font-semibold text-gray-800">{l.label}</span>
                      <span className="text-xs text-gray-500">{l.sub}</span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </nav>

          <div className="flex flex-none items-center gap-2 lg:gap-3.5">
            <div className="hidden lg:block">
              <LanguageSwitcher onDark={onDark} />
            </div>
            <Link
              href="/tai-khoan"
              className={cn(
                "hidden whitespace-nowrap rounded-full px-3 py-2 text-sm font-bold transition lg:inline-flex",
                onDark ? "text-white hover:bg-white/10" : "text-forest-700 hover:bg-forest-50",
              )}
            >
              {customerName ? firstName : t("Đăng nhập")}
            </Link>
            <div className="lg:hidden">
              <LanguageSwitcher variant="pill" onDark={onDark} />
            </div>
            <button
              type="button"
              aria-label={t("Mở menu")}
              onClick={() => { setAcc(""); setOpen(true); }}
              className="flex h-10 w-10 flex-none flex-col items-center justify-center gap-1 rounded-full lg:hidden"
              style={{ background: "oklch(0.68 0.17 45)", boxShadow: "0 6px 16px -6px oklch(0.4 0.12 45 / .6)" }}
            >
              <span className="h-0.5 w-4 rounded-sm bg-white" />
              <span className="ml-1.5 h-0.5 w-2.5 rounded-sm bg-white" />
            </button>
          </div>
        </div>
      </header>

      {/* Menu mobile: ĐẶT NGOÀI <header> (backdrop-blur của header tạo containing block cho position:fixed). */}
      <div className={cn("fixed inset-0 z-[60] lg:hidden", !open && "pointer-events-none")} aria-hidden={!open}>
        <div
          onClick={() => setOpen(false)}
          className={cn("absolute inset-0 backdrop-blur-[3px] transition-opacity duration-500", open ? "opacity-100" : "opacity-0")}
          style={{ background: "oklch(0.15 0.03 165 / .5)" }}
        />
        <div
          className={cn(
            "absolute bottom-0 right-0 top-0 flex w-[min(420px,100vw)] flex-col transition-transform duration-[600ms] ease-[cubic-bezier(.22,.9,.24,1)]",
            open ? "translate-x-0" : "translate-x-[105%]",
          )}
          style={{
            background: "linear-gradient(180deg, oklch(0.27 0.045 160) 0%, oklch(0.21 0.035 165) 100%)",
            color: "oklch(0.96 0.015 90)",
            boxShadow: "-30px 0 60px -20px oklch(0.1 0.03 165 / .6)",
          }}
        >
          {/* dải hoa văn thổ cẩm */}
          <div
            className="h-1.5 flex-none"
            style={{
              background:
                "repeating-linear-gradient(90deg, oklch(0.55 0.15 30) 0 14px, oklch(0.82 0.11 78) 14px 20px, oklch(0.35 0.08 250) 20px 34px, oklch(0.82 0.11 78) 34px 40px)",
            }}
          />
          <div className="flex flex-none items-center justify-between px-[18px] py-3.5">
            <span className="flex items-center gap-2.5 text-lg font-extrabold">
              <span
                className="flex h-[34px] w-[34px] items-center justify-center rounded-full border-[1.5px] border-white/50 text-[13px]"
                style={{ background: "oklch(0.35 0.07 158)" }}
              >
                TX
              </span>
              {t("Tà Xùa")} <span style={{ color: "oklch(0.68 0.17 45)" }}>Booking</span>
            </span>
            <button
              type="button"
              aria-label={t("Đóng menu")}
              onClick={() => setOpen(false)}
              className="relative h-10 w-10 rounded-full border border-white/15 bg-white/10"
            >
              <span className="absolute left-[13px] top-[19px] h-0.5 w-3.5 rotate-45 rounded-sm bg-current" />
              <span className="absolute left-[13px] top-[19px] h-0.5 w-3.5 -rotate-45 rounded-sm bg-current" />
            </button>
          </div>

          <div className="relative flex min-h-0 flex-1 flex-col">
          <div
            ref={menuScrollRef}
            onScroll={checkMore}
            className="flex flex-1 flex-col gap-[22px] overflow-y-auto overscroll-contain px-[18px] pb-[22px] pt-1"
          >
            <div className="flex flex-col gap-2.5">
              <MenuTitle>{t("Đặt dịch vụ")}</MenuTitle>
              <div className="grid grid-cols-2 gap-2">
                {CATEGORY_LIST.map((c, i) => (
                  <Link
                    key={c.slug}
                    href={`/${c.slug}`}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex flex-col gap-0.5 rounded-2xl border px-3.5 py-[13px] text-white transition-[opacity,transform,background] duration-500",
                      i === 0 ? "border-transparent" : "border-white/10 bg-white/[.06] hover:bg-white/[.12]",
                      open ? "translate-x-0 opacity-100" : "translate-x-[30px] opacity-0",
                    )}
                    style={{ ...(i === 0 ? { background: "oklch(0.68 0.17 45)" } : {}), transitionDelay: open ? `${0.12 + i * 0.04}s` : "0s" }}
                  >
                    <span className="text-base font-extrabold tracking-tight">{t(c.shortLabel)}</span>
                    {MENU_SUB[c.key] && <span className="text-xs opacity-70">{t(MENU_SUB[c.key])}</span>}
                  </Link>
                ))}
                {showTickets && <Link
                  href="/ve"
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex flex-col gap-0.5 rounded-2xl border border-white/10 bg-white/[.06] px-3.5 py-[13px] text-white transition-[opacity,transform,background] duration-500 hover:bg-white/[.12]",
                    open ? "translate-x-0 opacity-100" : "translate-x-[30px] opacity-0",
                  )}
                  style={{ transitionDelay: open ? `${0.12 + CATEGORY_LIST.length * 0.04}s` : "0s" }}
                >
                  <span className="text-base font-extrabold tracking-tight">{t("Vé & đặt bàn")}</span>
                  <span className="text-xs opacity-70">{t("Check-in, show, nhà hàng")}</span>
                </Link>}
              </div>
            </div>

            <div
              className={cn("flex flex-col gap-1 transition-[opacity,transform] duration-700", open ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0")}
              style={{ transitionDelay: open ? ".45s" : "0s" }}
            >
              <Accordion title={t("Cẩm nang Tà Xùa")} sub={t("{0} mục", [GUIDE_LINKS.length])} on={acc === "guide"} onToggle={() => setAcc((a) => (a === "guide" ? "" : "guide"))}>
                {GUIDE_LINKS.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className="flex items-center justify-between gap-2.5 border-b border-white/[.08] px-0.5 py-3 text-[15px] font-semibold last:border-b-0"
                    style={{ color: "oklch(0.94 0.015 90)" }}
                  >
                    <span>{l.label}</span>
                    <span className="text-sm opacity-45">›</span>
                  </Link>
                ))}
              </Accordion>
            </div>

            <div
              className={cn("flex flex-col gap-1 transition-[opacity,transform] duration-700", open ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0")}
              style={{ transitionDelay: open ? ".5s" : "0s" }}
            >
              <Accordion title={t("Về chúng tôi")} sub={ABOUT_LINKS.map((l) => l.label).join(" · ")} on={acc === "about"} onToggle={() => setAcc((a) => (a === "about" ? "" : "about"))}>
              {showCommitment && (
                <Link
                  href="/cam-ket"
                  onClick={() => setOpen(false)}
                  className="mb-1 mt-1 flex items-center justify-between gap-2.5 rounded-2xl border px-4 py-[13px]"
                  style={{
                    background: "oklch(0.82 0.11 78 / .12)",
                    borderColor: "oklch(0.82 0.11 78 / .35)",
                    color: "oklch(0.82 0.11 78)",
                  }}
                >
                  <span className="text-[15px] font-extrabold">{t("Cam kết")}</span>
                  <span className="text-xs font-bold opacity-85">{t("Đền tới 100tr →")}</span>
                </Link>
              )}
              {ABOUT_LINKS.filter((l) => l.href !== "/cam-ket").map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-between gap-2.5 border-b border-white/[.08] px-0.5 py-3 text-[15px] font-semibold"
                  style={{ color: "oklch(0.94 0.015 90)" }}
                >
                  <span className="flex flex-col">
                    <span>{l.label}</span>
                    <span className="text-xs font-normal opacity-60">{l.sub}</span>
                  </span>
                  <span className="text-sm opacity-45">›</span>
                </Link>
              ))}
              </Accordion>
            </div>

            <div className={cn("flex flex-col gap-2.5 transition-opacity duration-500", open ? "opacity-100" : "opacity-0")} style={{ transitionDelay: open ? ".55s" : "0s" }}>
              <MenuTitle>{t("Ngôn ngữ")}</MenuTitle>
              <LanguageSwitcher variant="segment" />
            </div>
          </div>

            {/* Gợi ý còn chức năng bên dưới: mép mờ dần + nút nhún, bấm để cuộn xuống; tự ẩn khi đã cuộn gần cuối. */}
            <div
              aria-hidden
              className={cn("pointer-events-none absolute inset-x-0 bottom-0 h-24 transition-opacity duration-300", moreBelow ? "opacity-100" : "opacity-0")}
              style={{ background: "linear-gradient(180deg, transparent, oklch(0.21 0.035 165) 85%)" }}
            />
            <button
              type="button"
              tabIndex={moreBelow ? 0 : -1}
              onClick={() => menuScrollRef.current?.scrollBy({ top: menuScrollRef.current.clientHeight * 0.7, behavior: "smooth" })}
              className={cn(
                "absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-bold transition-opacity duration-300",
                moreBelow && open ? "opacity-100" : "pointer-events-none opacity-0",
              )}
              style={{ background: "oklch(0.3 0.05 160 / .92)", borderColor: "oklch(0.82 0.11 78 / .4)", color: "oklch(0.86 0.1 78)" }}
            >
              {t("Vuốt xem thêm")}
              <svg width="12" height="12" viewBox="0 0 12 12" className="animate-bounce" aria-hidden>
                <path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          <div
            className="flex flex-none items-center gap-3 border-t border-white/[.08] px-[18px] pt-3"
            style={{ background: "oklch(0.19 0.03 165)", paddingBottom: "calc(14px + env(safe-area-inset-bottom))" }}
          >
            <Link href="/tai-khoan" onClick={() => setOpen(false)} className="flex min-w-0 flex-1 items-center gap-3">
              <span className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-full text-[13px] font-extrabold text-white" style={{ background: "oklch(0.68 0.17 45)" }}>
                {initials}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[15px] font-extrabold">{customerName ?? t("Đăng nhập / Đăng ký")}</span>
                <span className="block text-xs opacity-65">{customerName ? t("Tài khoản của bạn") : t("Theo dõi đơn đã đặt")}</span>
              </span>
            </Link>
            <a href={`tel:${zaloNum}`} className="rounded-full border border-white/25 px-3.5 py-2 text-[13px] font-extrabold text-white">
              {t("Gọi")}
            </a>
            <a
              href={`https://zalo.me/${zaloNum}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full px-3.5 py-2 text-[13px] font-extrabold text-white"
              style={{ background: "oklch(0.68 0.17 45)" }}
            >
              Zalo
            </a>
          </div>
        </div>
      </div>
    </>
  );
}

/** Mục xổ xuống của menu mobile: bấm tiêu đề để mở / thu (trượt mượt bằng grid-rows 0fr → 1fr). */
function Accordion({ title, sub, on, onToggle, children }: { title: string; sub: string; on: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div className={cn("rounded-2xl border transition-colors duration-300", on ? "border-white/15 bg-white/[.06]" : "border-white/10 bg-white/[.03]")}>
      <button type="button" aria-expanded={on} onClick={onToggle} className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left">
        <span className="min-w-0">
          <span className="block text-[11px] font-extrabold uppercase tracking-[.2em]" style={{ color: "oklch(0.82 0.11 78)" }}>{title}</span>
          <span className="mt-0.5 block truncate text-xs opacity-60">{sub}</span>
        </span>
        <span
          aria-hidden
          className={cn("flex h-8 w-8 flex-none items-center justify-center rounded-full border border-white/15 transition-transform duration-300", on && "rotate-180")}
        >
          <svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </span>
      </button>
      <div className={cn("grid transition-[grid-template-rows] duration-300 ease-out", on ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
        <div className="min-h-0 overflow-hidden">
          <div className={cn("flex flex-col px-4 pb-2 transition-opacity duration-300", on ? "opacity-100" : "opacity-0")} inert={!on}>{children}</div>
        </div>
      </div>
    </div>
  );
}

function MenuTitle({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("text-[11px] font-extrabold uppercase tracking-[.2em]", className)} style={{ color: "oklch(0.82 0.11 78)" }}>
      {children}
    </div>
  );
}
