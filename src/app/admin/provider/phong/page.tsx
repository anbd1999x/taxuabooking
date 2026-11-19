import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { forViewer, homeServicesFor, loadHome, releaseExpiredStayHolds, syncHomeBookings } from "@/lib/stay";
import { StayManager } from "@/components/admin/stay/StayManager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Quản lý phòng" };

/** Quản lý phòng của chủ homestay (lễ tân / admin xem được; admin chọn homestay qua ?service=). */
export default async function RoomPmsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const session = (await getSession())!;
  const services = await homeServicesFor(session);
  if (!services.length) {
    // Nhân viên không phải lễ tân phòng (vd nhân viên giao xe) ⇒ về trang của mình.
    if (session.role === "STAFF") redirect("/admin/provider/xe");
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-dashed border-forest-200 bg-white p-8 text-center">
        <h1 className="text-xl font-bold text-ink">Quản lý phòng</h1>
        <p className="mt-2 text-sm text-gray-600">
          Tài khoản chưa có <b>homestay</b> nào. Liên hệ quản trị viên để gắn homestay cho tài khoản của bạn.
        </p>
        {session.role === "ADMIN" && (
          <Link href="/admin/services/new?type=HOMESTAY" className="mt-4 inline-block rounded-xl bg-forest-700 px-4 py-2 text-sm font-semibold text-white">
            + Tạo homestay
          </Link>
        )}
      </div>
    );
  }
  const wanted = typeof sp.service === "string" ? sp.service : "";
  const svc = services.find((s) => s.id === wanted) ?? services[0];
  await releaseExpiredStayHolds(svc.id).catch(() => 0);
  await syncHomeBookings(svc.id).catch((e) => console.error("[stay] sync", e));
  const data = forViewer(await loadHome(svc.id), session.role);

  return (
    <StayManager
      key={svc.id}
      serviceId={svc.id}
      serviceTitle={svc.title}
      services={services}
      viewerRole={session.role === "STAFF" ? "STAFF" : session.role === "PROVIDER" ? "PROVIDER" : "ADMIN"}
      initial={data}
    />
  );
}
