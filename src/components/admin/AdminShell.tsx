"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { logoutAction } from "@/app/admin/actions";
import { cn } from "@/lib/utils";
import { ToastHost } from "./Toast";
import { PushToggle } from "./PushToggle";

type NavItem = { href: string; label: string; exact?: boolean };
/** Nhóm menu CHA → các mục CON. title = null: mục đứng riêng, không có tiêu đề nhóm. */
type NavGroup = { title: string | null; items: NavItem[] };

const ADMIN_NAV: NavGroup[] = [
  { title: null, items: [{ href: "/admin", label: "Tổng quan", exact: true }] },
  {
    title: "Đặt chỗ",
    items: [
      { href: "/admin/bookings", label: "Yêu cầu đặt" },
      { href: "/admin/availability", label: "Lịch giá & tình trạng" },
      { href: "/admin/sheet-sync", label: "Đồng bộ Sheet" },
    ],
  },
  {
    title: "Dịch vụ & nội dung",
    items: [
      { href: "/admin/services", label: "Quản lý dịch vụ" },
      { href: "/admin/places", label: "Nhà hàng & Cafe" },
      { href: "/admin/articles", label: "Bài viết (SEO)" },
      { href: "/admin/popup", label: "Popup uy tín" },
    ],
  },
  {
    title: "Khách hàng",
    items: [
      { href: "/admin/reviews", label: "Đánh giá" },
      { href: "/admin/feedback", label: "Góp ý" },
    ],
  },
  {
    title: "Kinh doanh",
    items: [
      { href: "/admin/reports", label: "Thống kê & thanh toán" },
      { href: "/admin/accounts", label: "Tài khoản (CTV / Chủ)" },
      { href: "/admin/visits", label: "Lượt truy cập" },
      { href: "/admin/ip-block", label: "Chặn IP" },
    ],
  },
];
const CTV_NAV: NavGroup[] = [
  {
    title: null,
    items: [
      { href: "/admin/ctv", label: "Tổng quan", exact: true },
      { href: "/admin/ctv/don", label: "Đơn của tôi" },
      { href: "/", label: "↗ Đặt đơn (trang web)" },
    ],
  },
];
const PROVIDER_NAV: NavGroup[] = [
  {
    title: null,
    items: [
      { href: "/admin/provider", label: "Tổng quan", exact: true },
      { href: "/admin/availability", label: "Lịch giá & tình trạng" },
      { href: "/admin/provider/don", label: "Đơn & xác nhận" },
      { href: "/admin/provider/thong-ke", label: "Thống kê" },
      { href: "/admin/provider/ctv", label: "CTV của tôi" },
    ],
  },
];

export function AdminShell({
  adminName,
  role = "ADMIN",
  badges,
  vapidKey = "",
  children,
}: {
  adminName: string;
  role?: "ADMIN" | "CTV" | "PROVIDER";
  badges?: Record<string, number>;
  /** VAPID public key — có thì hiện nút bật Web Push thông báo đơn mới (ADMIN). */
  vapidKey?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  // Nhóm do người dùng bấm mở/thu gọn; chưa bấm → mở nhóm chứa trang hiện tại.
  const [toggled, setToggled] = useState<Record<string, boolean>>({});
  const NAV = role === "CTV" ? CTV_NAV : role === "PROVIDER" ? PROVIDER_NAV : ADMIN_NAV;
  const roleLabel = role === "CTV" ? "CTV" : role === "PROVIDER" ? "Chủ dịch vụ" : "Quản trị";

  function isActive(item: NavItem) {
    return item.exact ? pathname === item.href : pathname.startsWith(item.href);
  }
  const groupOpen = (g: NavGroup) => g.title == null || (toggled[g.title] ?? g.items.some(isActive));

  function renderItem(item: NavItem, child: boolean) {
    const badge = badges?.[item.href] ?? 0;
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => setOpen(false)}
        className={cn(
          "flex items-center justify-between gap-2 rounded-lg py-2.5 pr-3 text-sm font-medium transition",
          child ? "pl-6" : "pl-3",
          isActive(item) ? "bg-white/15 text-white" : "text-forest-200 hover:bg-white/10 hover:text-white",
        )}
      >
        <span>{item.label}</span>
        {badge > 0 && (
          <span
            className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-500 px-1.5 text-xs font-bold text-white"
            title={`${badge} đơn chưa xử lý`}
          >
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </Link>
    );
  }

  return (
    <div className="flex min-h-screen bg-cloud">
      {/* Sidebar: cột flex cao đúng màn hình — menu ở giữa CUỘN ĐƯỢC, chân menu không đè lên */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 flex h-dvh w-64 transform flex-col bg-forest-900 text-forest-100 transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 flex-none items-center gap-2 px-5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-forest-500 font-bold text-white ring-2 ring-white/80">TX</span>
          <span className="font-bold text-white">Tà Xùa · {roleLabel}</span>
        </div>
        <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain px-3 pb-3 pt-2">
          {NAV.map((g, gi) => {
            if (g.title == null) {
              return (
                <div key={gi} className="space-y-1">
                  {g.items.map((it) => renderItem(it, false))}
                </div>
              );
            }
            const title = g.title;
            const isOpen = groupOpen(g);
            const sum = g.items.reduce((n, it) => n + (badges?.[it.href] ?? 0), 0);
            const hasActive = g.items.some(isActive);
            return (
              <div key={gi} className="pt-1">
                <button
                  type="button"
                  onClick={() => setToggled((t) => ({ ...t, [title]: !isOpen }))}
                  aria-expanded={isOpen}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wider transition hover:bg-white/5",
                    hasActive ? "text-white" : "text-forest-300",
                  )}
                >
                  <span>{title}</span>
                  <span className="flex items-center gap-1.5">
                    {/* Nhóm đang thu gọn mà có đơn chưa xử lý → hiện tổng ở tiêu đề nhóm */}
                    {!isOpen && sum > 0 && (
                      <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-500 px-1.5 text-xs font-bold normal-case tracking-normal text-white">
                        {sum > 99 ? "99+" : sum}
                      </span>
                    )}
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      className={cn("transition-transform", isOpen ? "rotate-180" : "")}
                      aria-hidden="true"
                    >
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </span>
                </button>
                {isOpen && <div className="mt-0.5 space-y-0.5">{g.items.map((it) => renderItem(it, true))}</div>}
              </div>
            );
          })}
        </nav>
        <div className="flex-none border-t border-white/10 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <Link href="/" target="_blank" className="block rounded-lg px-3 py-2 text-sm text-forest-200 hover:bg-white/10 hover:text-white">
            ↗ Xem website
          </Link>
          <form action={logoutAction}>
            <button type="submit" className="mt-1 w-full rounded-lg px-3 py-2 text-left text-sm text-forest-200 hover:bg-white/10 hover:text-white">
              Đăng xuất
            </button>
          </form>
        </div>
      </aside>

      {open && (
        <div className="fixed inset-0 z-20 bg-black/30 lg:hidden" onClick={() => setOpen(false)} />
      )}

      {/* Nội dung */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-black/5 bg-white px-4 lg:px-6">
          <button
            type="button"
            className="rounded-lg p-2 text-forest-700 hover:bg-forest-50 lg:hidden"
            onClick={() => setOpen(true)}
            aria-label="Mở menu"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12h18M3 6h18M3 18h18" /></svg>
          </button>
          <div className="ml-auto flex items-center gap-3">
            {role === "ADMIN" && <PushToggle vapidKey={vapidKey} />}
            <div className="text-sm text-gray-600">
              Xin chào, <span className="font-semibold text-forest-700">{adminName}</span>
            </div>
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </div>
      <ToastHost />
    </div>
  );
}
