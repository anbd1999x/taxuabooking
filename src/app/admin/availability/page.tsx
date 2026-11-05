import Link from "next/link";
import type { RoomStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { toDateKey } from "@/lib/dates";
import { RoomGrid, type RoomGroup } from "@/components/admin/RoomGrid";
import { SheetSyncAll } from "@/components/admin/SheetSyncAll";
import { MonthOverview } from "@/components/admin/MonthOverview";
import { CabinMonth, type CabinDay } from "@/components/admin/CabinMonth";
import { AvailabilityEditor } from "@/components/admin/AvailabilityEditor";
import { toNumber } from "@/lib/format";
import { parseDateOnly } from "@/lib/dates";
import { roomPricing, priceForDay } from "@/lib/availability";

export const dynamic = "force-dynamic";

function str(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}
function monthKey(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
function shiftMonth(ym: string, delta: number) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return monthKey(d);
}

export default async function AvailabilityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const now = new Date();
  const month = str(sp.month) || monthKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)));
  const view = str(sp.view) === "overview" ? "overview" : "grid";

  // Danh sách homestay + nhà cho thuê xe + nhà xe cabin.
  // Chủ dịch vụ (PROVIDER) chỉ thấy & thao tác dịch vụ của chính mình.
  const session = await getSession();
  const isProvider = session?.role === "PROVIDER";
  const ownerFilter = isProvider ? { ownerId: session!.sub } : {};
  const services = await prisma.service.findMany({
    where: { category: { in: ["HOMESTAY", "MOTORBIKE", "CABIN"] }, ...ownerFilter },
    orderBy: [{ category: "asc" }, { title: "asc" }],
    select: { id: true, title: true, category: true },
  });

  // Chủ dịch vụ thường chỉ có 1–2 dịch vụ → không bắt chọn lại: mặc định mở lịch
  // dịch vụ đầu tiên đang quản lý ngay khi vào trang.
  const serviceId = str(sp.service) || (isProvider ? services[0]?.id : undefined);
  const selected = serviceId ? services.find((s) => s.id === serviceId) : undefined;

  // Homestay có link Google Sheet — cho nút "Đồng bộ tất cả" (PROVIDER chỉ thấy của mình).
  const sheetServices = await prisma.service.findMany({
    where: { category: { in: ["HOMESTAY", "BUNGALOW"] }, sheetUrl: { not: null }, ...ownerFilter },
    orderBy: { title: "asc" },
    select: { id: true, title: true, sheetSyncResult: true },
  });

  // Khoảng ngày của tháng
  const [y, m] = month.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const first = new Date(Date.UTC(y, m - 1, 1));
  const last = new Date(Date.UTC(y, m - 1, daysInMonth));
  const days = Array.from({ length: daysInMonth }, (_, i) => toDateKey(new Date(Date.UTC(y, m - 1, i + 1))));

  // Dữ liệu lưới
  let groups: RoomGroup[] = [];
  const initial: Record<string, RoomStatus> = {};
  const priceMap: Record<string, number> = {}; // roomId|dateKey -> giá/đêm (cho chế độ tổng quan)
  let vehicleTargets: { id: string; name: string }[] = [];
  const cabinData: Record<string, CabinDay> = {};
  let ctvOptions: { id: string; name: string }[] = [];

  if (selected?.category === "HOMESTAY") {
    const roomTypes = await prisma.roomType.findMany({
      where: { serviceId: selected.id },
      include: { rooms: { orderBy: { sortOrder: "asc" } } },
      orderBy: { sortOrder: "asc" },
    });
    // Cột phòng chạy trái→phải theo "Thứ tự hiển thị" TOÀN CỤC (giống trang khách);
    // các phòng liền kề cùng hạng được gom chung một nhãn hạng (hạng có thể lặp lại).
    const flatSorted = roomTypes
      .flatMap((rt) => rt.rooms.map((r) => ({ rt, r })))
      .sort((a, b) => a.r.sortOrder - b.r.sortOrder);
    groups = [];
    for (const { rt, r } of flatSorted) {
      const last = groups[groups.length - 1];
      if (last && last.typeId.startsWith(`${rt.id}#`)) {
        last.rooms.push({ id: r.id, name: r.name });
      } else {
        groups.push({ typeId: `${rt.id}#${groups.length}`, typeName: rt.name, rooms: [{ id: r.id, name: r.name }] });
      }
    }
    const roomIds = groups.flatMap((g) => g.rooms.map((r) => r.id));
    if (roomIds.length) {
      const rows = await prisma.roomDayStatus.findMany({
        where: { roomId: { in: roomIds }, date: { gte: first, lte: last } },
      });
      for (const r of rows) initial[`${r.roomId}|${toDateKey(r.date)}`] = r.status;
    }
    // Giá mỗi phòng/đêm cho chế độ tổng quan (giá-theo-thứ ?? chiết khấu ?? thường).
    const dayDates = days.map((d) => parseDateOnly(d));
    for (const rt of roomTypes) {
      for (const room of rt.rooms) {
        const pricing = roomPricing(room);
        for (let i = 0; i < days.length; i++) {
          priceMap[`${room.id}|${days[i]}`] = priceForDay(dayDates[i], pricing, null);
        }
      }
    }
  } else if (selected?.category === "MOTORBIKE") {
    const vehicles = await prisma.rentalVehicle.findMany({
      where: { serviceId: selected.id },
      orderBy: { sortOrder: "asc" },
    });
    vehicleTargets = vehicles.map((v) => ({ id: v.id, name: `${v.vehicleType} (còn ${toNumber(v.totalUnits) ?? v.totalUnits} xe)` }));
  } else if (selected?.category === "CABIN") {
    const trips = await prisma.cabinTrip.findMany({
      where: { serviceId: selected.id, departureDate: { gte: first, lte: last } },
      orderBy: [{ departureDate: "asc" }, { departureTime: "asc" }],
    });
    const tripIds = trips.map((t) => t.id);
    const bookings = tripIds.length
      ? await prisma.bookingRequest.findMany({
          where: { OR: [{ cabinTripId: { in: tripIds } }, { cabinReturnTripId: { in: tripIds } }] },
          include: { ctv: { select: { name: true } } },
          orderBy: { createdAt: "desc" },
        })
      : [];
    const byTrip = new Map<string, typeof bookings>();
    for (const b of bookings) {
      for (const tid of [b.cabinTripId, b.cabinReturnTripId]) {
        if (tid && tripIds.includes(tid)) {
          const arr = byTrip.get(tid) ?? [];
          arr.push(b);
          byTrip.set(tid, arr);
        }
      }
    }
    for (const t of trips) {
      const dk = toDateKey(t.departureDate);
      const dirKey = t.direction === "RETURN" ? "ve" : "di";
      const tickets = (byTrip.get(t.id) ?? []).map((b) => ({
        id: b.id,
        code: b.code,
        name: b.customerName,
        phone: b.phone,
        seats: b.quantity,
        status: (b.status === "CANCELLED" ? "cancel" : b.status === "NEW" ? "new" : "ok") as "new" | "ok" | "cancel",
        isCtv: Boolean(b.ctvId),
        srcLabel: b.ctvId ? b.ctv?.name ?? "CTV" : "Khách",
      }));
      // "Đã đặt" theo tồn kho thực (tổng − còn trống), nhất quán với web khách.
      const booked = Math.max(0, t.seatsTotal - t.seatsAvailable);
      const dir = {
        tripId: t.id,
        // Tạm dừng = SOLD_OUT nhưng vẫn còn chỗ; hết chỗ tự nhiên vẫn coi là đang bán.
        open: !(t.status === "SOLD_OUT" && t.seatsAvailable > 0),
        total: t.seatsTotal,
        booked,
        price: toNumber(t.price) ?? 0,
        time: t.departureTime,
        route: t.route,
        tickets,
      };
      const existing = cabinData[dk] ?? { di: null, ve: null };
      // Giữ chuyến sớm nhất mỗi chiều (dữ liệu có thể có nhiều chuyến/ngày).
      if (!existing[dirKey]) existing[dirKey] = dir;
      cabinData[dk] = existing;
    }
    ctvOptions = await prisma.adminUser.findMany({
      // PROVIDER chỉ thấy CTV của chính mình.
      where: { role: "CTV", ...(session?.role === "PROVIDER" ? { providerId: session.sub } : {}) },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
  }

  // Hôm nay (nếu nằm trong tháng đang xem) + tổng hợp cho chế độ tổng quan.
  const todayKey = toDateKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())));
  const todayInMonth = days.includes(todayKey) ? todayKey : null;
  let ovMonthFree = 0;
  let ovFullDays = 0;
  if (selected?.category === "HOMESTAY" && groups.length) {
    const flatIds = groups.flatMap((g) => g.rooms.map((r) => r.id));
    for (const d of days) {
      let f = 0;
      for (const id of flatIds) if ((initial[`${id}|${d}`] ?? "AVAILABLE") === "AVAILABLE") f++;
      ovMonthFree += f;
      if (f === 0) ovFullDays++;
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-ink">Lịch giá & tình trạng</h1>
      <p className="mt-1 text-sm text-gray-500">
        Chọn dịch vụ để quản lý. Homestay có 2 chế độ: <strong>Tổng quan tháng</strong> (xem nhanh phòng trống cả tháng) và <strong>Theo từng phòng</strong>. Xe máy quản lý theo số xe; xe cabin theo chuyến từng ngày.
      </p>

      {/* Chọn dịch vụ: chủ dịch vụ (ít dịch vụ) hiện dạng TAB, admin dùng dropdown. */}
      {isProvider ? (
        services.length > 1 ? (
          <div className="mt-4 inline-flex flex-wrap gap-1 rounded-xl p-1" style={{ background: "oklch(0.93 0.008 150)" }}>
            {services.map((s) => {
              const active = s.id === serviceId;
              return (
                <Link
                  key={s.id}
                  href={`/admin/availability?service=${s.id}&month=${month}&view=${view}`}
                  className="rounded-[9px] px-3.5 py-2 text-sm font-bold"
                  style={
                    active
                      ? { background: "white", color: "oklch(0.29 0.055 160)", boxShadow: "0 1px 3px oklch(0.2 0.03 160 / .15)" }
                      : { background: "transparent", color: "oklch(0.42 0.02 160)" }
                  }
                >
                  {s.title}
                </Link>
              );
            })}
          </div>
        ) : null
      ) : (
        <form className="mt-4 flex flex-wrap items-end gap-2" action="/admin/availability">
          <label className="block">
            <span className="text-xs font-medium text-gray-500">Homestay / nhà cung cấp</span>
            <select name="service" defaultValue={serviceId ?? ""} className="mt-1 block rounded-xl border border-gray-200 px-3 py-2.5 text-sm">
              <option value="">— Chọn —</option>
              <optgroup label="Homestay">
                {services.filter((s) => s.category === "HOMESTAY").map((s) => (
                  <option key={s.id} value={s.id}>{s.title}</option>
                ))}
              </optgroup>
              <optgroup label="Thuê xe máy">
                {services.filter((s) => s.category === "MOTORBIKE").map((s) => (
                  <option key={s.id} value={s.id}>{s.title}</option>
                ))}
              </optgroup>
              <optgroup label="Xe cabin">
                {services.filter((s) => s.category === "CABIN").map((s) => (
                  <option key={s.id} value={s.id}>{s.title}</option>
                ))}
              </optgroup>
            </select>
          </label>
          <input type="hidden" name="month" value={month} />
          <input type="hidden" name="view" value={view} />
          <button className="rounded-xl bg-forest-100 px-4 py-2.5 text-sm font-medium text-forest-700">Chọn</button>
        </form>
      )}

      <SheetSyncAll
        items={sheetServices.map((s) => ({ id: s.id, title: s.title, last: s.sheetSyncResult }))}
        historyHref={session?.role === "ADMIN" ? "/admin/sheet-sync" : undefined}
      />

      {!selected ? (
        <p className="mt-8 rounded-2xl border border-dashed border-gray-300 bg-white py-12 text-center text-gray-500">
          Chọn một homestay để xem lịch từng phòng.
        </p>
      ) : selected.category === "HOMESTAY" ? (
        <div className="mt-5">
          {/* Hàng điều khiển trên: tên + điều hướng tháng (nút tròn) */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-ink">{selected.title}</h2>
            <div className="flex items-center gap-1.5">
              <Link href={`/admin/availability?service=${selected.id}&month=${shiftMonth(month, -1)}&view=${view}`} aria-label="Tháng trước" className="flex h-[38px] w-[38px] items-center justify-center rounded-[10px] border border-gray-200 bg-white text-lg hover:bg-gray-50">‹</Link>
              <span className="min-w-[118px] text-center text-base font-extrabold">Tháng {m}/{y}</span>
              <Link href={`/admin/availability?service=${selected.id}&month=${shiftMonth(month, 1)}&view=${view}`} aria-label="Tháng sau" className="flex h-[38px] w-[38px] items-center justify-center rounded-[10px] border border-gray-200 bg-white text-lg hover:bg-gray-50">›</Link>
            </div>
          </div>

          {groups.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-gray-300 bg-white py-12 text-center text-gray-500">
              Homestay này chưa có phòng riêng. Vào trang sửa bài đăng để thêm phòng cho từng hạng.
            </p>
          ) : (
            <>
              {/* Hàng điều khiển dưới: chuyển chế độ + tóm tắt */}
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="inline-flex gap-1 rounded-xl p-1" style={{ background: "oklch(0.93 0.008 150)" }}>
                  {([["overview", "Tổng quan tháng"], ["grid", "Theo từng phòng"]] as const).map(([k, label]) => (
                    <Link
                      key={k}
                      href={`/admin/availability?service=${selected.id}&month=${month}&view=${k}`}
                      className="rounded-[9px] px-3.5 py-2 text-sm font-bold"
                      style={
                        view === k
                          ? { background: "white", color: "oklch(0.29 0.055 160)", boxShadow: "0 1px 3px oklch(0.2 0.03 160 / .15)" }
                          : { background: "transparent", color: "oklch(0.42 0.02 160)" }
                      }
                    >
                      {label}
                    </Link>
                  ))}
                </div>
                {view === "overview" && (
                  <div style={{ fontSize: 13, color: "oklch(0.48 0.02 160)" }}>
                    {ovMonthFree} phòng-đêm còn trống · {ovFullDays} ngày kín phòng
                  </div>
                )}
              </div>
              {/* key theo dịch vụ+tháng: buộc remount khi đổi tháng để state trong
                  component không giữ dữ liệu tháng cũ (lưới tháng mới từng hiện trống sai). */}
              {view === "overview" ? (
                <MonthOverview key={`${selected.id}|${month}`} groups={groups} days={days} statuses={initial} prices={priceMap} monthLabel={`Tháng ${m}/${y}`} todayKey={todayInMonth} />
              ) : (
                <RoomGrid key={`${selected.id}|${month}`} groups={groups} days={days} initial={initial} />
              )}
            </>
          )}
        </div>
      ) : selected.category === "MOTORBIKE" ? (
        <div className="mt-6 max-w-2xl rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
          <h2 className="mb-1 text-lg font-semibold text-ink">{selected.title}</h2>
          <p className="mb-4 text-sm text-gray-500">Cập nhật số xe còn trống theo khoảng ngày.</p>
          {vehicleTargets.length === 0 ? (
            <p className="text-sm text-gray-500">Chưa có loại xe nào.</p>
          ) : (
            <AvailabilityEditor
              serviceId={selected.id}
              targetType="RENTAL"
              targets={vehicleTargets}
              unitLabel="xe"
              defaultStart={days[0]}
              defaultEnd={days[days.length - 1]}
            />
          )}
        </div>
      ) : (
        <div className="mt-5">
          <h2 className="mb-3 text-lg font-bold text-ink">{selected.title}</h2>
          <CabinMonth
            key={`${selected.id}|${month}`}
            serviceId={selected.id}
            month={month}
            monthLabel={`Tháng ${m}/${y}`}
            days={days}
            data={cabinData}
            ctvOptions={ctvOptions}
            todayKey={todayInMonth}
            prevMonth={shiftMonth(month, -1)}
            nextMonth={shiftMonth(month, 1)}
          />
        </div>
      )}
    </div>
  );
}
