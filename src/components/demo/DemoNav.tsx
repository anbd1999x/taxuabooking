"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Mọi chức năng có bản demo — hiện hết ở menu bên trái, bấm là chuyển (dùng chung một phiên demo). */
const ITEMS: [string, string, string][] = [
  ["/demo/goi-mon", "Gọi món QR", "Order tại bàn"],
  ["/demo/ve", "Vé & đặt bàn", "Vé cổng · show · nhà hàng"],
  ["/demo/dat-ve", "Trang khách đặt vé", "Khách thấy gì khi mua vé, đặt bàn"],
  ["/demo/quan-ly-xe", "Quản lý xe máy", "Tiệm cho thuê xe"],
  ["/demo/quan-ly-phong", "Quản lý phòng", "Homestay"],
];

/** Menu của khung demo: cột trái trên máy tính (giống menu quản trị), dải ngang cuộn được trên điện thoại. */
export function DemoNav({ exitHref, resetHref }: { exitHref: string; resetHref: string }) {
  const path = usePathname();
  const foot = "block rounded-lg px-3 py-2 text-sm text-forest-200 hover:bg-white/10 hover:text-white";
  return (
    <>
      {/* Máy tính: cột trái */}
      <aside className="sticky top-0 hidden h-screen w-64 flex-none flex-col bg-forest-900 text-forest-100 lg:flex">
        <div className="flex h-16 flex-none items-center gap-2 px-5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-forest-500 font-bold text-white ring-2 ring-white/80">TX</span>
          <span className="font-bold text-white">Tà Xùa · Bản demo</span>
        </div>
        <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 pb-3 pt-2">
          <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-forest-300">Dùng thử các chức năng</div>
          {ITEMS.map(([href, name, sub]) => {
            const on = path.startsWith(href);
            return (
              <Link key={href} href={href} className={`flex flex-col rounded-lg px-3 py-2.5 transition ${on ? "bg-white/15 text-white" : "text-forest-200 hover:bg-white/10 hover:text-white"}`}>
                <span className="text-sm font-semibold">{name}</span>
                <span className="text-xs opacity-70">{sub}</span>
              </Link>
            );
          })}
        </nav>
        <div className="flex-none border-t border-white/10 p-3">
          {/* <a> thường: route handler làm mới / thoát phiên demo, không được prefetch. */}
          <a href={resetHref} className={foot}>↻ Làm mới dữ liệu mẫu</a>
          <a href={exitHref} className={foot}>← Trang giới thiệu</a>
          <a href="https://zalo.me/0397943155" target="_blank" rel="noopener noreferrer" className="mt-2 block rounded-full px-3 py-2.5 text-center text-sm font-extrabold text-white" style={{ background: "oklch(0.68 0.18 45)" }}>Đăng ký dùng thử</a>
        </div>
      </aside>

      {/* Điện thoại: dải ngang */}
      <div className="bg-forest-900 text-white lg:hidden">
        <div className="flex items-center justify-between gap-2 px-4 pt-3">
          <span className="text-sm font-bold">Tà Xùa Booking · Bản demo</span>
          <span className="flex gap-3 text-xs font-semibold text-forest-200">
            <a href={resetHref}>↻ Làm mới</a>
            <a href={exitHref}>← Giới thiệu</a>
          </span>
        </div>
        <div className="flex gap-1.5 overflow-x-auto px-3 py-2.5" style={{ scrollbarWidth: "none" }}>
          {ITEMS.map(([href, name]) => (
            <Link key={href} href={href} className={`flex-none whitespace-nowrap rounded-full px-3.5 py-2 text-[13px] font-bold ${path.startsWith(href) ? "bg-white text-forest-800" : "bg-white/10 text-white"}`}>{name}</Link>
          ))}
        </div>
      </div>
    </>
  );
}
