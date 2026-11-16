import Link from "next/link";
import { getSession } from "@/lib/auth";
import { fleetServicesFor, loadFleet, syncFleetBookings } from "@/lib/fleet";
import { FleetManager } from "@/components/admin/fleet/FleetManager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Quản lý xe cho thuê" };

/** Quản lý đội xe cho thuê (chủ dịch vụ xe máy; admin xem được mọi nhà xe máy qua ?service=). */
export default async function FleetPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const session = (await getSession())!;
  const services = await fleetServicesFor(session);
  if (!services.length) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-dashed border-forest-200 bg-white p-8 text-center">
        <h1 className="text-xl font-bold text-ink">Quản lý xe cho thuê</h1>
        <p className="mt-2 text-sm text-gray-600">
          Tài khoản chưa có dịch vụ <b>thuê xe máy</b> nào. Liên hệ quản trị viên để gắn dịch vụ xe máy cho tài khoản của bạn.
        </p>
        {session.role === "ADMIN" && (
          <Link href="/admin/services/new?type=MOTORBIKE" className="mt-4 inline-block rounded-xl bg-forest-700 px-4 py-2 text-sm font-semibold text-white">
            + Tạo dịch vụ xe máy
          </Link>
        )}
      </div>
    );
  }
  const wanted = typeof sp.service === "string" ? sp.service : "";
  const svc = services.find((s) => s.id === wanted) ?? services[0];
  await syncFleetBookings(svc.id).catch(() => {});
  const data = await loadFleet(svc.id);

  return (
    <FleetManager
      key={svc.id}
      serviceId={svc.id}
      serviceTitle={svc.title}
      services={services.map((s) => ({ id: s.id, title: s.title }))}
      webTypes={svc.rentalVehicles.map((r) => ({ id: r.id, name: r.vehicleType }))}
      hotline={svc.contactPhone || svc.owner?.phone || ""}
      initial={data}
    />
  );
}
