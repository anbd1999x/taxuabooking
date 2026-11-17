import { redirect } from "next/navigation";
import { FleetManager } from "@/components/admin/fleet/FleetManager";
import { loadFleet } from "@/lib/fleet";
import { ensureFleetDemo, getDemoSession } from "@/lib/fleet-demo";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const metadata = { title: "Bản demo quản lý xe máy", robots: { index: false, follow: false } };

const G = "oklch(0.29 0.055 160)";

/**
 * BẢN DEMO quản lý xe — trang độc lập (ngoài /admin, không menu quản trị): chỉ màn hình quản lý đội xe
 * của nhà xe mẫu. Vào qua /hop-tac/xe-may/demo (đặt cookie demo riêng).
 */
export default async function FleetDemoPage() {
  const session = await getDemoSession();
  if (!session) redirect("/hop-tac/xe-may/demo");
  const demo = await ensureFleetDemo(false);
  if (demo.ownerId !== session.sub) redirect("/hop-tac/xe-may/demo");
  const [svc, data] = await Promise.all([
    prisma.service.findUniqueOrThrow({ where: { id: demo.serviceId }, select: { id: true, title: true, contactPhone: true, rentalVehicles: { select: { id: true, vehicleType: true } } } }),
    loadFleet(demo.serviceId),
  ]);

  // --fleet-sticky-top: thanh tab của FleetManager dính sát mép trên (trang demo không có header dính).
  return (
    <div style={{ ["--fleet-sticky-top" as string]: "0px", minHeight: "100vh", background: "oklch(0.975 0.008 150)", fontFamily: "var(--font-be-vietnam), 'Be Vietnam Pro', system-ui, sans-serif", color: "oklch(0.22 0.03 160)" }}>
      <header style={{ background: G, color: "white" }}>
        <div style={{ maxWidth: 1600, margin: "0 auto", padding: "10px clamp(14px,2.5vw,28px)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 800, fontSize: 16, whiteSpace: "nowrap" }}>
            <span style={{ width: 34, height: 34, borderRadius: "50%", background: "oklch(0.38 0.07 158)", border: "1.5px solid oklch(1 0 0 / .5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>TX</span>
            <span>Tà Xùa <span style={{ color: "oklch(0.72 0.17 50)" }}>Booking</span> <span style={{ fontWeight: 600, opacity: 0.8 }}>· Bản demo quản lý xe</span></span>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- route handler thoát phiên demo */}
            <a href="/hop-tac/xe-may/demo?exit=1" style={{ fontSize: 13, fontWeight: 700, padding: "8px 14px", borderRadius: 999, border: "1px solid oklch(1 0 0 / .3)", color: "white", whiteSpace: "nowrap" }}>← Trang giới thiệu</a>
            <a href="https://zalo.me/0397943155" target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, fontWeight: 800, padding: "8px 14px", borderRadius: 999, background: "oklch(0.68 0.18 45)", color: "white", whiteSpace: "nowrap" }}>Đăng ký dùng thử</a>
          </div>
        </div>
      </header>
      {/* FleetManager có lề âm -m-4/lg:-m-6 (khớp vùng <main> của AdminShell) ⇒ bù lại bằng padding. */}
      <div className="p-4 lg:p-6">
      <FleetManager
        key={svc.id}
        serviceId={svc.id}
        serviceTitle={svc.title}
        services={[{ id: svc.id, title: svc.title }]}
        webTypes={svc.rentalVehicles.map((r) => ({ id: r.id, name: r.vehicleType }))}
        hotline={svc.contactPhone || ""}
        viewerRole="PROVIDER"
        demo
        initial={data}
      />
      </div>
    </div>
  );
}
