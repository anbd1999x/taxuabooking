import { getSession } from "@/lib/auth";
import { scanStats, ticketOwnerOf, venuesFor } from "@/lib/ticket";
import { Scanner } from "@/components/admin/ticket/Scanner";

export const dynamic = "force-dynamic";
export const metadata = { title: "Soát vé" };

/** Soát vé trên điện thoại — trang duy nhất nhân viên (STAFF) của chủ địa điểm vào được trong module vé. */
export default async function ScanPage() {
  const session = (await getSession())!;
  const owner = await ticketOwnerOf(session);
  const venues = (await venuesFor(session)).filter((v) => v.kind !== "RESTAURANT");
  if (!owner || !venues.length) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-dashed border-forest-200 bg-white p-8 text-center">
        <h1 className="text-xl font-bold text-ink">Soát vé</h1>
        <p className="mt-2 text-sm text-gray-600">Tài khoản chưa gắn với địa điểm bán vé nào (vé cổng / show).</p>
      </div>
    );
  }
  return (
    <div className="flex justify-center">
      <Scanner venues={venues} who={session.name || session.username} initial={await scanStats(owner)} />
    </div>
  );
}
