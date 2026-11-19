"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ModuleSubNav, useActiveTabLabel } from "@/components/admin/module-tabs";

/** Mọi chức năng có bản demo — hiện hết ở menu bên trái, bấm là chuyển (dùng chung một phiên demo). */
const ITEMS: [string, string, string][] = [
  ["/demo/goi-mon", "Gọi món QR", "Order tại bàn"],
  ["/demo/ve", "Vé & đặt bàn", "Vé cổng · show · nhà hàng"],
  ["/demo/quan-ly-xe", "Quản lý xe máy", "Tiệm cho thuê xe"],
  ["/demo/quan-ly-phong", "Quản lý phòng", "Homestay"],
  // Màn khách xem (không phải màn quản lý) ⇒ để cuối danh sách.
  ["/demo/dat-ve", "Trang khách đặt vé", "Khách thấy gì khi mua vé, đặt bàn"],
];

/**
 * Menu của khung demo — giống menu quản trị (AdminShell): cột trái cố định trên máy tính; điện thoại = cùng cột đó
 * trượt ra từ trái khi bấm nút ☰ ở thanh trên (bấm nền tối / chọn chức năng là đóng).
 */
export function DemoNav({ exitHref, resetHref }: { exitHref: string; resetHref: string }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const foot = "block rounded-lg px-3 py-2 text-sm text-forest-200 hover:bg-white/10 hover:text-white";
  const current = ITEMS.find(([href]) => path.startsWith(href));
  const tabLabel = useActiveTabLabel();
  return (
    <>
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex h-dvh w-64 flex-none transform flex-col bg-forest-900 text-forest-100 transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex h-16 flex-none items-center gap-2 px-5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-forest-500 font-bold text-white ring-2 ring-white/80">TX</span>
          <span className="font-bold text-white">Tà Xùa · Bản demo</span>
        </div>
        <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain px-3 pb-3 pt-2">
          <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-forest-300">Dùng thử các chức năng</div>
          {ITEMS.map(([href, name, sub]) => {
            const on = path.startsWith(href);
            return (
              <div key={href}>
                <Link href={href} onClick={() => setOpen(false)} className={`flex flex-col rounded-lg px-3 py-2.5 transition ${on ? "bg-white/15 text-white" : "text-forest-200 hover:bg-white/10 hover:text-white"}`}>
                  <span className="text-sm font-semibold">{name}</span>
                  <span className="text-xs opacity-70">{sub}</span>
                </Link>
                {/* Tab của chức năng đang mở = mục con (thay thanh tab cuộn ngang). */}
                {on && <ModuleSubNav onPick={() => setOpen(false)} />}
              </div>
            );
          })}
        </nav>
        <div className="flex-none border-t border-white/10 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          {/* <a> thường: route handler làm mới / thoát phiên demo, không được prefetch. */}
          <a href={resetHref} className={foot}>↻ Làm mới dữ liệu mẫu</a>
          <a href={exitHref} className={foot}>← Trang giới thiệu</a>
          <a href="/hop-tac/dang-ky" className="mt-2 block rounded-full px-3 py-2.5 text-center text-sm font-extrabold text-white" style={{ background: "oklch(0.68 0.18 45)" }}>Đăng ký dùng thử</a>
        </div>
      </aside>

      {open && <div className="fixed inset-0 z-30 bg-black/30 lg:hidden" onClick={() => setOpen(false)} />}

      {/* Điện thoại: thanh trên có nút mở menu trái */}
      <div className="flex h-14 items-center gap-2 bg-forest-900 px-2 text-white lg:hidden">
        <button type="button" onClick={() => setOpen(true)} aria-label="Mở menu" className="rounded-lg p-2 hover:bg-white/10">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12h18M3 6h18M3 18h18" /></svg>
        </button>
        <button type="button" onClick={() => setOpen(true)} className="flex min-w-0 flex-1 items-center gap-1 text-left text-sm font-bold">
          <span className="truncate">{current ? current[1] : "Bản demo"}{tabLabel ? <span className="font-normal text-forest-200"> · {tabLabel}</span> : <span className="font-normal text-forest-200"> · Bản demo</span>}</span>
          <span aria-hidden="true" className="text-forest-200">▾</span>
        </button>
        <a href={resetHref} className="flex-none px-2 text-xs font-semibold text-forest-200">↻ Làm mới</a>
      </div>
    </>
  );
}
