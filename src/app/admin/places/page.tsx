import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/format";
import { PlacesManager } from "@/components/admin/PlacesManager";
import { approvePlaceReview, deletePlaceReview } from "./actions";
import { toDTO } from "./place-dto";

export const dynamic = "force-dynamic";

export default async function PlacesAdminPage() {
  const [places, areaRows, pendingReviews] = await Promise.all([
    prisma.place.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.place.findMany({ select: { area: true }, distinct: ["area"] }),
    prisma.placeReview.findMany({
      where: { approved: false },
      orderBy: { createdAt: "desc" },
      include: { place: { select: { name: true } } },
    }),
  ]);

  const dtos = places.map(toDTO);
  const areas = areaRows.map((a) => a.area).filter(Boolean);

  return (
    <div>
      {pendingReviews.length > 0 && (
        <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div className="text-sm font-extrabold text-amber-800">🔔 {pendingReviews.length} đánh giá chờ duyệt</div>
          <div className="mt-2.5 space-y-2">
            {pendingReviews.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center gap-2.5 rounded-xl bg-white p-3 ring-1 ring-black/5">
                <div className="min-w-0 flex-1">
                  <div className="text-sm">
                    <b>{r.name}</b> · {"⭐".repeat(r.rating)} · <span className="text-gray-500">{r.place.name}</span>{" "}
                    <span className="text-xs text-gray-400">{formatDate(r.createdAt)}</span>
                  </div>
                  <p className="mt-0.5 text-sm text-gray-700">{r.content}</p>
                </div>
                <form action={approvePlaceReview}>
                  <input type="hidden" name="id" value={r.id} />
                  <button className="rounded-lg bg-forest-600 px-3 py-1.5 text-xs font-bold text-white">Duyệt</button>
                </form>
                <form action={deletePlaceReview}>
                  <input type="hidden" name="id" value={r.id} />
                  <button className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50">Xoá</button>
                </form>
              </div>
            ))}
          </div>
        </div>
      )}

      <PlacesManager initialPlaces={dtos} areas={areas} />
    </div>
  );
}
