import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { AVAILABILITY_META } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { today, addDays, toDateKey } from "@/lib/dates";
import type { AvailabilityStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const WD = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const STRIP_DAYS = 7;
const CABIN_DAYS = 14;

function toneClass(tone: string) {
  switch (tone) {
    case "ok": return "bg-forest-100 text-forest-700";
    case "warn": return "bg-amber-100 text-amber-700";
    case "danger": return "bg-red-100 text-red-700";
    case "info": return "bg-sky-100 text-sky-700";
    default: return "bg-gray-100 text-gray-500";
  }
}

export default async function InventoryPage() {
  const start = today();
  const stripEnd = addDays(start, STRIP_DAYS - 1);
  const cabinEnd = addDays(start, CABIN_DAYS - 1);

  const [trips, vehicles, rooms] = await Promise.all([
    prisma.cabinTrip.findMany({
      where: { departureDate: { gte: start, lte: cabinEnd }, service: { published: true } },
      include: { service: { select: { id: true, title: true, slug: true } } },
      orderBy: [{ service: { title: "asc" } }, { departureDate: "asc" }, { departureTime: "asc" }],
    }),
    prisma.rentalVehicle.findMany({
      include: {
        service: { select: { title: true } },
        availabilities: { where: { date: { gte: start, lte: stripEnd } } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.roomType.findMany({
      where: { service: { category: { in: ["HOMESTAY", "BUNGALOW"] } } },
      include: {
        service: { select: { title: true } },
        availabilities: { where: { date: { gte: start, lte: stripEnd } } },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  // Nhóm chuyến cabin theo nhà xe
  const byOperator = new Map<string, { title: string; slug: string; trips: typeof trips }>();
  for (const t of trips) {
    const k = t.service.id;
    if (!byOperator.has(k)) byOperator.set(k, { title: t.service.title, slug: t.service.slug, trips: [] });
    byOperator.get(k)!.trips.push(t);
  }

  const stripDays = Array.from({ length: STRIP_DAYS }, (_, i) => {
    const d = addDays(start, i);
    return { key: toDateKey(d), wd: WD[d.getUTCDay()], n: toDateKey(d).slice(8, 10) };
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-ink">Tồn kho vé / phòng / xe</h1>
        <p className="mt-1 text-sm text-gray-500">
          Số còn lại tự động trừ khi yêu cầu đặt chuyển sang “Đã xác nhận”, và cộng lại khi “Đã huỷ”.
        </p>
      </div>

      {/* ============ XE CABIN ============ */}
      <section>
        <h2 className="text-lg font-semibold text-ink">🚐 Xe cabin — theo nhà xe ({CABIN_DAYS} ngày tới)</h2>
        {byOperator.size === 0 ? (
          <Empty>Chưa có chuyến nào trong {CABIN_DAYS} ngày tới.</Empty>
        ) : (
          <div className="mt-3 space-y-5">
            {[...byOperator.values()].map((op) => (
              <div key={op.slug} className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
                <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                  <h3 className="font-semibold text-forest-800">{op.title}</h3>
                  <Link href={`/admin/services/${op.trips[0].serviceId}`} className="text-sm font-medium text-forest-700 hover:underline">
                    Sửa chuyến →
                  </Link>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                    <tr>
                      <th className="px-4 py-2">Ngày</th>
                      <th className="px-4 py-2">Giờ</th>
                      <th className="px-4 py-2 text-center">Tổng</th>
                      <th className="px-4 py-2 text-center">Đã đặt</th>
                      <th className="px-4 py-2 text-center">Còn</th>
                      <th className="px-4 py-2">Tình trạng</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {op.trips.map((t) => {
                      const booked = t.seatsTotal - t.seatsAvailable;
                      const meta = AVAILABILITY_META[t.status];
                      return (
                        <tr key={t.id} className="hover:bg-gray-50">
                          <td className="px-4 py-2">{formatDate(t.departureDate)}</td>
                          <td className="px-4 py-2">{t.departureTime}</td>
                          <td className="px-4 py-2 text-center">{t.seatsTotal}</td>
                          <td className="px-4 py-2 text-center font-medium text-sunset-600">{booked}</td>
                          <td className="px-4 py-2 text-center font-bold text-forest-700">{t.seatsAvailable}</td>
                          <td className="px-4 py-2"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${toneClass(meta.tone)}`}>{meta.label}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ============ XE MÁY ============ */}
      <section>
        <h2 className="text-lg font-semibold text-ink">🏍️ Xe máy — theo bên cung cấp ({STRIP_DAYS} ngày tới)</h2>
        {vehicles.length === 0 ? (
          <Empty>Chưa có loại xe nào.</Empty>
        ) : (
          <StripTable
            stripDays={stripDays}
            rows={vehicles.map((v) => ({
              id: v.id,
              provider: v.service.title,
              name: v.vehicleType,
              total: v.totalUnits,
              map: mapAvail(v.availabilities, (a) => ({ n: a.availableUnits, status: a.status })),
            }))}
            unit="xe"
          />
        )}
      </section>

      {/* ============ HOMESTAY ============ */}
      <section>
        <h2 className="text-lg font-semibold text-ink">🏠 Homestay / Bungalow — theo hạng phòng ({STRIP_DAYS} ngày tới)</h2>
        {rooms.length === 0 ? (
          <Empty>Chưa có hạng phòng nào.</Empty>
        ) : (
          <StripTable
            stripDays={stripDays}
            rows={rooms.map((r) => ({
              id: r.id,
              provider: r.service.title,
              name: r.name,
              total: r.totalRooms,
              map: mapAvail(r.availabilities, (a) => ({ n: a.availableRooms, status: a.status })),
            }))}
            unit="phòng"
          />
        )}
      </section>
    </div>
  );
}

function mapAvail<T extends { date: Date; status: AvailabilityStatus }>(
  rows: T[],
  pick: (r: T) => { n: number; status: AvailabilityStatus },
): Map<string, { n: number; status: AvailabilityStatus }> {
  return new Map(rows.map((r) => [toDateKey(r.date), pick(r)]));
}

function StripTable({
  stripDays,
  rows,
  unit,
}: {
  stripDays: { key: string; wd: string; n: string }[];
  rows: { id: string; provider: string; name: string; total: number; map: Map<string, { n: number; status: AvailabilityStatus }> }[];
  unit: string;
}) {
  return (
    <div className="mt-3 overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="bg-gray-50 text-xs uppercase text-gray-500">
          <tr>
            <th className="px-4 py-2 text-left">Bên cung cấp / hạng</th>
            {stripDays.map((d) => (
              <th key={d.key} className="px-2 py-2 text-center">{d.wd}<br />{d.n}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row) => (
            <tr key={row.id} className="hover:bg-gray-50">
              <td className="px-4 py-2">
                <div className="font-medium text-ink">{row.name}</div>
                <div className="text-xs text-gray-400">{row.provider} · tổng {row.total}</div>
              </td>
              {stripDays.map((d) => {
                const cell = row.map.get(d.key);
                if (!cell || cell.status === "NOT_UPDATED") {
                  return <td key={d.key} className="px-2 py-2 text-center"><span className="text-xs text-gray-300">—</span></td>;
                }
                const tone = AVAILABILITY_META[cell.status].tone;
                return (
                  <td key={d.key} className="px-2 py-2 text-center">
                    <span className={`inline-block min-w-7 rounded-md px-1.5 py-1 text-xs font-bold ${toneClass(tone)}`}>
                      {cell.n}
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="px-4 py-2 text-xs text-gray-400">Số trong ô = số {unit} còn trống ngày đó. “—” = chưa cập nhật.</p>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-3 rounded-2xl border border-dashed border-gray-300 bg-white py-10 text-center text-sm text-gray-500">
      {children}
    </p>
  );
}
