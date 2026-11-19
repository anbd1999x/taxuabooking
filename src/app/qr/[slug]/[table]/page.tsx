import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { dineCustomerState, tableForQrGuarded } from "@/lib/dine";
import { requestIp } from "@/lib/ip-block";
import { QrOrder } from "@/components/dine/QrOrder";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Gọi món tại bàn", robots: { index: false, follow: false } };
export const viewport: Viewport = { width: "device-width", initialScale: 1, maximumScale: 1, themeColor: "#1b4a36" };

/**
 * Trang khách mở khi quét mã QR dán ở bàn: /qr/<slug nhà hàng>/<tên bàn>?k=<khoá của bàn>.
 * Trang độc lập (không Header / Footer của site, chỉ tiếng Việt) — vào thẳng thực đơn của đúng bàn, không cần đăng nhập.
 */
export default async function QrTablePage({ params, searchParams }: { params: Promise<{ slug: string; table: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ slug, table }, sp] = await Promise.all([params, searchParams]);
  let t = table;
  try {
    t = decodeURIComponent(table); // tên bàn có dấu / khoảng trắng; tên chứa "%" lẻ thì giữ nguyên thay vì lỗi 500
  } catch {}
  const k = typeof sp.k === "string" ? sp.k : "";
  const q = await tableForQrGuarded(requestIp(await headers()) ?? "unknown", slug, t, k);
  if (!q) {
    return (
      <main style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: "oklch(0.96 0.008 160)", color: "oklch(0.22 0.03 160)" }}>
        <div style={{ maxWidth: 360, textAlign: "center", background: "white", borderRadius: 24, padding: 28, border: "1px solid oklch(0.92 0.008 160)" }}>
          <div style={{ fontSize: 20, fontWeight: 800 }}>Mã QR không hợp lệ</div>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: "oklch(0.5 0.02 160)", margin: "8px 0 0" }}>Bạn quét lại mã dán trên bàn, hoặc gọi nhân viên giúp mình nhé.</p>
        </div>
      </main>
    );
  }
  return <QrOrder initial={await dineCustomerState(q)} q={{ v: slug, t, k }} />;
}
