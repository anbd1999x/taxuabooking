"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { logoutAction } from "@/app/admin/actions";
import { cn } from "@/lib/utils";
import { ToastHost } from "./Toast";

type NavItem = { href: string; label: string; exact?: boolean };

const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "Tổng quan", exact: true },
  { href: "/admin/services", label: "Quản lý dịch vụ" },
  { href: "/admin/availability", label: "Lịch giá & tình trạng" },
  { href: "/admin/bookings", label: "Yêu cầu đặt" },
  { href: "/admin/articles", label: "Bài viết (SEO)" },
  { href: "/admin/reviews", label: "Đánh giá" },
  { href: "/admin/accounts", label: "Tài khoản (CTV / Chủ)" },
  { href: "/admin/reports", label: "Thống kê & thanh toán" },
];
const CTV_NAV: NavItem[] = [
  { href: "/admin/ctv", label: "Tổng quan", exact: true },
  { href: "/admin/ctv/don", label: "Đơn của tôi" },
  { href: "/", label: "↗ Đặt đơn (trang web)" },
];
const PROVIDER_NAV: NavItem[] = [
  { href: "/admin/provider", label: "Tổng quan", exact: true },
  { href: "/admin/availability", label: "Lịch giá & tình trạng" },
  { href: "/admin/provider/don", label: "Đơn & thanh toán" },
  { href: "/admin/provider/ctv", label: "CTV của tôi" },
];

export function AdminShell({
  adminName,
  role = "ADMIN",
  children,
}: {
  adminName: string;
  role?: "ADMIN" | "CTV" | "PROVIDER";
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const NAV = role === "CTV" ? CTV_NAV : role === "PROVIDER" ? PROVIDER_NAV : ADMIN_NAV;
  const roleLabel = role === "CTV" ? "CTV" : role === "PROVIDER" ? "Chủ dịch vụ" : "Quản trị";

  function isActive(item: NavItem) {
    return item.exact ? pathname === item.href : pathname.startsWith(item.href);
  }

  return (
    <div className="flex min-h-screen bg-cloud">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 w-64 transform bg-forest-900 text-forest-100 transition-transform lg:static lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 items-center gap-2 px-5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white font-bold text-forest-800">TX</span>
          <span className="font-bold text-white">Tà Xùa · {roleLabel}</span>
        </div>
        <nav className="mt-2 space-y-1 px-3">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={cn(
                "block rounded-lg px-3 py-2.5 text-sm font-medium transition",
                isActive(item)
                  ? "bg-white/15 text-white"
                  : "text-forest-200 hover:bg-white/10 hover:text-white",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="absolute bottom-0 w-full border-t border-white/10 p-3">
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
          <div className="ml-auto text-sm text-gray-600">
            Xin chào, <span className="font-semibold text-forest-700">{adminName}</span>
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </div>
      <ToastHost />
    </div>
  );
}
