"use client";

import { useState } from "react";
import Link from "next/link";
import { CATEGORY_LIST } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function Header({ customerName = null }: { customerName?: string | null }) {
  const [open, setOpen] = useState(false);
  const [dd, setDd] = useState(false); // dropdown "Cẩm nang" (desktop)
  const firstName = customerName ? customerName.trim().split(/\s+/).slice(-1)[0] : "";

  const GUIDE_LINKS = [
    { href: "/kinh-nghiem", label: "Kinh nghiệm Tà Xùa" },
    { href: "/nha-hang", label: "Nhà hàng Tà Xùa" },
    { href: "/cafe", label: "Cafe Tà Xùa" },
    { href: "/huong-dan", label: "Hướng dẫn đặt dịch vụ" },
    { href: "/tra-cuu", label: "Tra cứu đơn hàng" },
    { href: "/gop-y", label: "Góp ý" },
  ];

  return (
    <>
    <header className="sticky top-0 z-40 border-b border-black/5 bg-white/95 backdrop-blur">
      <div className="container-page flex h-11 items-center justify-between gap-4 sm:h-16">
        <Link href="/" className="flex items-center gap-2" onClick={() => setOpen(false)}>
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-forest-600 text-[10px] font-bold text-white sm:h-9 sm:w-9 sm:text-base">TX</span>
          <span className="whitespace-nowrap text-[15px] font-extrabold tracking-tight text-forest-800 sm:text-lg">
            Tà Xùa <span className="text-sunset-500">Booking</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-0.5 lg:flex">
          {CATEGORY_LIST.map((c) => (
            <Link
              key={c.slug}
              href={`/${c.slug}`}
              className="whitespace-nowrap rounded-lg px-2.5 py-2 text-sm font-medium text-gray-700 transition hover:bg-forest-50 hover:text-forest-700"
            >
              {c.shortLabel}
            </Link>
          ))}
          {/* Menu cấp 2: hover hoặc click mới xổ ra */}
          <div className="group relative" onMouseLeave={() => setDd(false)}>
            <button
              type="button"
              onClick={() => setDd((o) => !o)}
              className="flex items-center gap-1 whitespace-nowrap rounded-lg px-2.5 py-2 text-sm font-medium text-gray-700 transition hover:bg-forest-50 hover:text-forest-700"
            >
              Cẩm nang
              <span className="text-[10px] transition group-hover:rotate-180">▼</span>
            </button>
            {/* pt-1 làm cầu nối hover giữa nút và panel (không bị tắt khi rê chuột qua khe) */}
            <div className={cn("absolute left-0 top-full z-50 pt-1", dd ? "block" : "hidden group-hover:block")}>
              <div className="w-56 rounded-xl bg-white p-1.5 shadow-lg ring-1 ring-black/5">
                {GUIDE_LINKS.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    onClick={() => setDd(false)}
                    className="block rounded-lg px-3 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-forest-50 hover:text-forest-700"
                  >
                    {l.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </nav>

        <div className="flex flex-none items-center gap-1.5">
          <Link
            href="/tai-khoan"
            className="hidden whitespace-nowrap rounded-xl px-2.5 py-2 text-sm font-semibold text-forest-700 transition hover:bg-forest-50 lg:inline-flex"
          >
            {customerName ? firstName : "Đăng nhập"}
          </Link>
          <button
            type="button"
            aria-label="Mở menu"
            className="rounded-lg p-1 text-forest-700 hover:bg-forest-50 sm:p-2 lg:hidden"
            onClick={() => setOpen((o) => !o)}
          >
            <svg className="h-[18px] w-[18px] sm:h-6 sm:w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {open ? <path d="M18 6 6 18M6 6l12 12" /> : <path d="M3 12h18M3 6h18M3 18h18" />}
            </svg>
          </button>
        </div>
      </div>
      </header>

      {/* Menu mobile: ĐẶT NGOÀI <header>. backdrop-blur của header tạo containing
          block khiến position:fixed bám theo header (~44px) thay vì viewport,
          làm drawer bị co lại thành dải mỏng ở trên. */}
      <div className={cn("fixed inset-0 z-50 lg:hidden", open ? "" : "pointer-events-none")}>
        <div
          onClick={() => setOpen(false)}
          className={cn("absolute inset-0 bg-black/40 transition-opacity duration-300", open ? "opacity-100" : "opacity-0")}
        />
        <div
          className={cn(
            "absolute right-0 top-0 flex h-full w-[76%] max-w-[300px] flex-col bg-white shadow-2xl transition-transform duration-300 will-change-transform",
            open ? "translate-x-0" : "translate-x-full",
          )}
        >
          <div className="flex items-center justify-between border-b border-black/5 px-4 py-3">
            <span className="text-[15px] font-extrabold tracking-tight text-forest-800">
              Tà Xùa <span className="text-sunset-500">Booking</span>
            </span>
            <button
              type="button"
              aria-label="Đóng menu"
              onClick={() => setOpen(false)}
              className="flex h-8 w-8 items-center justify-center rounded-full text-xl text-gray-400 hover:bg-gray-100"
            >
              ×
            </button>
          </div>
          <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
            {CATEGORY_LIST.map((c) => (
              <Link
                key={c.slug}
                href={`/${c.slug}`}
                onClick={() => setOpen(false)}
                className="rounded-xl px-3.5 py-3 text-[15px] font-semibold text-gray-700 hover:bg-forest-50 hover:text-forest-700"
              >
                {c.shortLabel}
              </Link>
            ))}
            <div className="my-1 border-t border-black/5" />
            {GUIDE_LINKS.map((l) => (
              <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="rounded-xl px-3.5 py-3 text-[15px] font-semibold text-gray-700 hover:bg-forest-50 hover:text-forest-700">{l.label}</Link>
            ))}
            <Link href="/tai-khoan" onClick={() => setOpen(false)} className="rounded-xl px-3.5 py-3 text-[15px] font-semibold text-gray-700 hover:bg-forest-50 hover:text-forest-700">{customerName ? customerName : "Đăng nhập / Đăng ký"}</Link>
          </nav>
        </div>
      </div>
    </>
  );
}
