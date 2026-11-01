import Link from "next/link";
import { prisma } from "@/lib/prisma";

/** Lưới thẻ quán (nhà hàng/cafe) đọc từ DB + chip lọc khu vực (server component). */
export async function PlaceDirectory({
  kind,
  basePath,
  selectedArea,
}: {
  kind: "RESTAURANT" | "CAFE";
  basePath: string; // "/nha-hang" | "/cafe"
  selectedArea?: string;
}) {
  const places = await prisma.place.findMany({
    where: { kind, published: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  // Chip khu vực dựng từ dữ liệu thật (theo số lượng giảm dần).
  const counts = new Map<string, number>();
  for (const p of places) counts.set(p.area, (counts.get(p.area) ?? 0) + 1);
  const areas = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([a]) => a);
  const area = selectedArea && areas.includes(selectedArea) ? selectedArea : "";
  const list = area ? places.filter((p) => p.area === area) : places;

  return (
    <>
      <div className="mt-6 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <Link
          href={basePath}
          className={`flex-none whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition ${
            !area ? "bg-forest-700 text-white" : "bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-forest-50"
          }`}
        >
          Tất cả ({places.length})
        </Link>
        {areas.map((a) => (
          <Link
            key={a}
            href={`${basePath}?khu=${encodeURIComponent(a)}`}
            className={`flex-none whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition ${
              area === a ? "bg-forest-700 text-white" : "bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-forest-50"
            }`}
          >
            {a} ({counts.get(a)})
          </Link>
        ))}
      </div>

      {list.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-gray-300 bg-white py-14 text-center text-gray-500">
          Chưa có địa điểm nào.
        </p>
      ) : (
        <div className="mt-5 grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((p) => {
            const tags = (p.tags ?? "").split(",").map((t) => t.trim()).filter(Boolean);
            return (
              <div key={p.id} className="flex flex-col gap-2.5 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-[16px] font-extrabold leading-snug text-ink">{p.name}</h2>
                  {p.price && <span className="flex-none whitespace-nowrap rounded-full bg-sunset-50 px-2.5 py-1 text-xs font-bold text-sunset-600">{p.price}</span>}
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-gray-500">
                  <span>📍 {p.address || `${p.area}, Tà Xùa`}</span>
                  {p.hours && <span>🕐 {p.hours}</span>}
                </div>
                {p.desc && <p className="text-[13.5px] leading-relaxed text-gray-600">{p.desc}</p>}
                <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
                  {tags.map((t) => (
                    <span key={t} className="rounded-full bg-forest-50 px-2.5 py-1 text-[11px] font-semibold text-forest-700">{t}</span>
                  ))}
                  {p.phone && (
                    <a href={`tel:${p.phone.replace(/\s/g, "")}`} className="ml-auto rounded-full bg-sunset-500 px-3 py-1 text-[11px] font-bold text-white hover:bg-sunset-600">
                      📞 {p.phone}
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
