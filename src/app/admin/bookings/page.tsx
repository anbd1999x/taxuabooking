import { prisma } from "@/lib/prisma";
import { CATEGORIES } from "@/lib/constants";
import { toNumber } from "@/lib/format";
import { addDays, parseDateOnly } from "@/lib/dates";
import type { Prisma } from "@prisma/client";
import BookingsListClient, { type BookingRow, type BookingsView } from "@/components/admin/BookingsListClient";
import { bookingPax, isRentalCategory, durationLabel } from "@/lib/occupancy";
import { bookingCabinBerths } from "@/lib/combo-pricing";
import { getAutoCancelHours } from "@/lib/booking-auto-cancel";
import { AutoCancelSetting } from "@/components/admin/AutoCancelSetting";

export const dynamic = "force-dynamic";

/** Số đơn gần nhất nạp vào danh sách (lọc/sắp xếp chạy phía client). */
const TAKE = 400;

function str(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Lọc theo CHỦ DỊCH VỤ (+ khoảng ngày tạo đơn) — link từ bảng "Theo chủ dịch vụ" ở trang
 * Thống kê. Khớp đúng cách đếm của `computeStats`: đơn của dịch vụ họ sở hữu (combo tính
 * cho chủ homestay) + đơn combo đi qua CHUYẾN ĐI của nhà xe họ. owner="_none" = chưa gán chủ.
 */
async function ownerFilter(owner: string): Promise<Prisma.BookingRequestWhereInput> {
  const ownerId = owner === "_none" ? null : owner;
  const trips = await prisma.cabinTrip.findMany({
    where: { service: { ownerId, category: "CABIN" } },
    select: { id: true },
  });
  const tripIds = trips.map((t) => t.id);
  const OR: Prisma.BookingRequestWhereInput[] = [{ service: { ownerId } }];
  if (tripIds.length) OR.push({ category: "COMBO", cabinTripId: { in: tripIds } });
  if (!ownerId) OR.push({ serviceId: null }, { category: "COMBO", cabinTripId: null });
  return { OR };
}

export default async function AdminBookingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const owner = str(sp.owner)?.trim() || null;
  const fromKey = str(sp.from);
  const toKey = str(sp.to);
  const where: Prisma.BookingRequestWhereInput = {};
  let filterLabel: string | null = null;
  if (owner) {
    Object.assign(where, await ownerFilter(owner));
    const ownerName =
      owner === "_none"
        ? "Chưa gán chủ dịch vụ"
        : (await prisma.adminUser.findUnique({ where: { id: owner }, select: { name: true } }))?.name ?? "Chủ dịch vụ";
    const fmt = (k: string) => `${k.slice(8, 10)}/${k.slice(5, 7)}/${k.slice(0, 4)}`;
    const created: Prisma.DateTimeFilter = {};
    if (fromKey && DATE_RE.test(fromKey)) created.gte = parseDateOnly(fromKey);
    if (toKey && DATE_RE.test(toKey)) created.lt = addDays(parseDateOnly(toKey), 1);
    if (created.gte || created.lt) where.createdAt = created;
    const rangeLabel =
      created.gte && created.lt ? ` · tạo từ ${fmt(fromKey!)} đến ${fmt(toKey!)}` : "";
    filterLabel = `Chủ dịch vụ: ${ownerName}${rangeLabel}`;
  }

  // Hôm nay theo giờ Việt Nam (server có thể chạy UTC) — mốc cho chế độ lịch.
  const now = new Date();
  const todayKey = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(now);
  const viewParam = str(sp.view);
  const initialView: BookingsView =
    viewParam === "month" || viewParam === "agenda" || viewParam === "year" ? viewParam : "list";

  const [bookings, totalInDb, calBookings] = await Promise.all([
    prisma.bookingRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      // Đang lọc theo chủ dịch vụ ⇒ lấy đủ đơn để khớp số ở trang Thống kê.
      ...(owner ? {} : { take: TAKE }),
      include: { ctv: { select: { name: true } } },
    }),
    prisma.bookingRequest.count({ where }),
    // Chế độ lịch: lấy theo NGÀY DÙNG (từ đầu năm ngoái trở đi) thay vì 400 đơn mới tạo nhất,
    // để lịch tháng / cả năm không thiếu đơn.
    prisma.bookingRequest.findMany({
      where: { AND: [where, { useDate: { gte: parseDateOnly(`${Number(todayKey.slice(0, 4)) - 1}-01-01`) } }] },
      orderBy: { useDate: "asc" },
      take: 5000,
      include: { ctv: { select: { name: true } } },
    }),
  ]);

  // Ngày LÊN XE / XE VỀ thực của đơn có chuyến cabin (cabin + combo) — lấy từ CabinTrip.
  const tripIds = [
    ...new Set(
      [...bookings, ...calBookings].flatMap((b) => [b.cabinTripId, b.cabinReturnTripId]).filter((x): x is string => !!x),
    ),
  ];
  const tripDate = new Map(
    (tripIds.length
      ? await prisma.cabinTrip.findMany({ where: { id: { in: tripIds } }, select: { id: true, departureDate: true } })
      : []
    ).map((t) => [t.id, t.departureDate]),
  );

  const toRow = (b: (typeof bookings)[number]): BookingRow => {
    const chips: string[] = [];
    if (b.selectionLabel) chips.push(b.selectionLabel);
    // Xe máy: nights = số NGÀY thuê ⇒ "2 ngày thuê", không phải "2 đêm".
    const dur = durationLabel(b);
    if (dur) chips.push(dur);
    const berths = bookingCabinBerths(b);
    if (berths) {
      if (berths.shared) chips.push(`${berths.shared} cabin đôi`);
      if (berths.solo) chips.push(`${berths.solo} cabin đơn`);
    } else {
      if (b.seatsSingle) chips.push(`${b.seatsSingle} chỗ`);
      if (b.seatsDouble) chips.push(`${b.seatsDouble} cabin đôi`);
    }
    // Combo: useDate lưu NGÀY NHẬN PHÒNG (giữ phòng đúng đêm) → danh sách hiện theo NGÀY
    // LÊN XE / XE VỀ của chuyến trong đơn (chưa gán chuyến thì = nhận phòng − 1 / trả phòng).
    // Cabin: cũng ưu tiên ngày của chuyến (trùng useDate/endDate trong trường hợp thường).
    const isCombo = b.category === "COMBO";
    const outDate = b.cabinTripId ? tripDate.get(b.cabinTripId) : undefined;
    const retDate = b.cabinReturnTripId ? tripDate.get(b.cabinReturnTripId) : undefined;
    const startDate = outDate ?? (isCombo ? addDays(b.useDate, -1) : b.useDate);
    const finishDate = retDate ?? b.endDate;
    if (isCombo) chips.push(`nhận phòng ${b.useDate.toISOString().slice(8, 10)}/${b.useDate.toISOString().slice(5, 7)}`);

    const price = toNumber(b.referencePrice);
    const collected = toNumber(b.amountCollected) ?? 0;
    const pay: BookingRow["pay"] =
      b.paymentStatus === "PAID" ? "full" : b.paymentStatus === "DEPOSITED" || collected > 0 ? "dep" : "none";
    const paxUnit = ["HOMESTAY", "BUNGALOW", "COMBO", "CABIN"].includes(b.category) ? "khách" : "SL";

    return {
      id: b.id,
      code: b.code,
      name: b.customerName,
      phone: b.phone,
      cat: b.category,
      catLabel: CATEGORIES[b.category].label,
      title: b.serviceTitle,
      chips,
      useDate: startDate.toISOString().slice(0, 10),
      endDate: finishDate ? finishDate.toISOString().slice(0, 10) : null,
      qty: b.quantity,
      pax: paxUnit === "SL" ? b.quantity : bookingPax(b),
      paxLabel: isRentalCategory(b.category) ? `${b.quantity} xe` : paxUnit === "SL" ? `SL ${b.quantity}` : `${bookingPax(b)} khách`,
      price,
      collected,
      pay,
      status: b.status,
      ctvName: b.ctv?.name ?? null,
      createdAt: b.createdAt.toISOString(),
      note: b.note,
    };
  };
  const rows = bookings.map(toRow);
  const calRows = calBookings.map(toRow);

  return (
    <>
      <AutoCancelSetting hours={await getAutoCancelHours()} />
      <BookingsListClient
        rows={rows}
        totalInDb={totalInDb}
        filterLabel={filterLabel}
        calRows={calRows}
        todayKey={todayKey}
        nowMs={now.getTime()}
        initialView={initialView}
      />
    </>
  );
}
