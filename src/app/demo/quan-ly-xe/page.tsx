import { redirect } from "next/navigation";
import { FleetManager } from "@/components/admin/fleet/FleetManager";
import { DemoShell } from "@/components/demo/DemoShell";
import { loadFleet } from "@/lib/fleet";
import { ensureFleetDemo, getDemoSession } from "@/lib/fleet-demo";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const metadata = { title: "Bản demo quản lý xe máy", robots: { index: false, follow: false } };

/**
 * BẢN DEMO quản lý xe — trang độc lập (ngoài /admin) trong khung demo chung (`DemoShell`: menu trái có đủ các chức năng demo):
 * màn hình quản lý đội xe của nhà xe mẫu. Vào qua /hop-tac/demo?m=xe (hoặc /hop-tac/xe-may/demo) — đặt cookie demo riêng.
 */
export default async function FleetDemoPage() {
  const session = await getDemoSession();
  if (!session) redirect("/hop-tac/demo?m=xe");
  const demo = await ensureFleetDemo(false);
  if (demo.ownerId !== session.sub) redirect("/hop-tac/demo?m=xe");
  const [svc, data] = await Promise.all([
    prisma.service.findUniqueOrThrow({ where: { id: demo.serviceId }, select: { id: true, title: true, contactPhone: true, rentalVehicles: { select: { id: true, vehicleType: true } } } }),
    loadFleet(demo.serviceId),
  ]);

  return (
    <DemoShell module="xe" title="Bản demo quản lý xe máy" note="Tạo đơn, giao xe, nhận xe, ghi cọc… Dữ liệu tự dựng lại mỗi ngày.">
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
    </DemoShell>
  );
}
