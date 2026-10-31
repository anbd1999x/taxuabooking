"use client";

import { useState } from "react";
import Link from "next/link";
import { CATEGORY_LIST } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function Header({ phone }: { phone: string }) {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-black/5 bg-white/95 backdrop-blur">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2" onClick={() => setOpen(false)}>
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-forest-600 font-bold text-white">TX</span>
          <span className="text-lg font-extrabold tracking-tight text-forest-800">
            Tà Xùa <span className="text-sunset-500">Booking</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {CATEGORY_LIST.map((c) => (
            <Link
              key={c.slug}
              href={`/${c.slug}`}
              className="rounded-lg px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-forest-50 hover:text-forest-700"
            >
              {c.shortLabel}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <a
            href={`tel:${phone.replace(/\s/g, "")}`}
            className="hidden rounded-xl bg-sunset-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sunset-600 sm:inline-flex"
          >
            📞 {phone}
          </a>
          <button
            type="button"
            aria-label="Mở menu"
            className="rounded-lg p-2 text-forest-700 hover:bg-forest-50 lg:hidden"
            onClick={() => setOpen((o) => !o)}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {open ? <path d="M18 6 6 18M6 6l12 12" /> : <path d="M3 12h18M3 6h18M3 18h18" />}
            </svg>
          </button>
        </div>
      </div>

      {/* Menu mobile */}
      <div className={cn("lg:hidden", open ? "block" : "hidden")}>
        <nav className="container-page grid grid-cols-2 gap-2 border-t border-black/5 py-3">
          {CATEGORY_LIST.map((c) => (
            <Link
              key={c.slug}
              href={`/${c.slug}`}
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-forest-50 hover:text-forest-700"
            >
              {c.shortLabel}
            </Link>
          ))}
          <a
            href={`tel:${phone.replace(/\s/g, "")}`}
            className="col-span-2 mt-1 rounded-xl bg-sunset-500 px-4 py-2.5 text-center text-sm font-semibold text-white"
          >
            📞 Gọi {phone}
          </a>
        </nav>
      </div>
    </header>
  );
}
