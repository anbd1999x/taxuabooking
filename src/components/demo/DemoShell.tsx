import { VisitTracker } from "@/components/VisitTracker";
import { ToastHost } from "@/components/admin/Toast";
import type { DemoModule } from "@/lib/module-demo";
import { DemoNav } from "./DemoNav";

/**
 * Khung của các trang BẢN DEMO (/demo/…): trang độc lập ngoài /admin nhưng bố cục như khu quản trị — MENU BÊN TRÁI liệt kê
 * mọi chức năng có demo (xe máy · phòng · vé & đặt bàn · gọi món QR), bấm là chuyển vì dùng chung một phiên demo;
 * mỗi trang tự dựng dữ liệu mẫu của mình khi được mở lần đầu.
 */
export function DemoShell({ module, title, note, children }: { module: DemoModule; title: string; note?: string; children: React.ReactNode }) {
  return (
    // --fleet-sticky-top: thanh tab của FleetManager dính sát mép trên (trang demo không có header dính).
    <div className="admin-ui flex min-h-screen flex-col bg-cloud lg:flex-row" style={{ ["--fleet-sticky-top" as string]: "0px", fontFamily: "var(--font-be-vietnam), 'Be Vietnam Pro', system-ui, sans-serif", color: "oklch(0.22 0.03 160)" }}>
      {/* Trang nằm ngoài layout (site) ⇒ tự gắn bộ ghi lượt xem (PageView kèm IP, xem ở /admin/visits). */}
      <VisitTracker />
      <DemoNav exitHref={`/hop-tac/demo?m=${module}&exit=1`} resetHref={`/hop-tac/demo?m=${module}&reset=1`} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex min-h-14 flex-wrap items-center justify-between gap-2 border-b border-black/5 bg-white px-4 py-2 lg:px-6">
          <div className="text-sm text-gray-600">
            <b className="text-forest-700">{title}</b>
            {note && <span className="ml-2 hidden text-gray-500 md:inline">· {note}</span>}
          </div>
          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">Dữ liệu mẫu · bấm thử thoải mái</span>
        </header>
        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </div>
      <ToastHost />
    </div>
  );
}
