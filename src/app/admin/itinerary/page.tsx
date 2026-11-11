import { prisma } from "@/lib/prisma";
import { loadItinerary } from "@/lib/itinerary-store";
import { buildDefaultConfig, PLACE_KIND_TO_STOP } from "@/lib/itinerary";
import { ItineraryManager, type PlaceOption } from "@/components/admin/ItineraryManager";

export const dynamic = "force-dynamic";

export default async function AdminItineraryPage() {
  const rows = await prisma.place.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, slug: true, kind: true, name: true, area: true, published: true },
  });
  const { config, saved } = await loadItinerary(rows);
  const options: PlaceOption[] = rows.flatMap((p) => {
    const kind = PLACE_KIND_TO_STOP[p.kind];
    return kind ? [{ id: p.id, kind, name: p.name, area: p.area, published: p.published }] : [];
  });

  return <ItineraryManager initial={config} defaults={buildDefaultConfig(rows)} places={options} saved={saved} />;
}
