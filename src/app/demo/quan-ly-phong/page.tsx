import { redirect } from "next/navigation";
import { getDemoSession } from "@/lib/fleet-demo";
import { ensureStayDemo } from "@/lib/module-demo";
import { homeServicesFor, loadHome } from "@/lib/stay";
import { StayManager } from "@/components/admin/stay/StayManager";
import { DemoShell } from "@/components/demo/DemoShell";

export const dynamic = "force-dynamic";
export const metadata = { title: "Bản demo quản lý homestay", robots: { index: false, follow: false } };

/** BẢN DEMO Quản lý phòng: sơ đồ phòng của homestay mẫu — vào qua /hop-tac/demo?m=home. */
export default async function StayDemoPage() {
  const session = await getDemoSession();
  if (!session) redirect("/hop-tac/demo?m=home");
  const demo = await ensureStayDemo(false);
  if (demo.ownerId !== session.sub) redirect("/hop-tac/demo?m=home");
  const services = (await homeServicesFor(session)).filter((s) => s.id === demo.serviceId);
  const svc = services[0];
  if (!svc) redirect("/hop-tac/demo?m=home&reset=1");
  return (
    <DemoShell module="home" title="Bản demo quản lý homestay" note="Đặt phòng trên sơ đồ, ghi cọc, nhận phòng, trả phòng… Dữ liệu tự dựng lại mỗi ngày.">
      <StayManager key={svc.id} serviceId={svc.id} serviceTitle={svc.title} services={services} viewerRole="PROVIDER" initial={await loadHome(svc.id)} />
    </DemoShell>
  );
}
