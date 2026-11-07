import { prisma } from "@/lib/prisma";
import { CATEGORIES } from "@/lib/constants";
import { toNumber } from "@/lib/format";
import { addDays } from "@/lib/dates";
import BookingsListClient, { type BookingRow } from "@/components/admin/BookingsListClient";

export const dynamic = "force-dynamic";

/** Số đơn gần nhất nạp vào danh sách (lọc/sắp xếp chạy phía client). */
const TAKE = 400;

export default async function AdminBookingsPage() {
  const [bookings, totalInDb] = await Promise.all([
    prisma.bookingRequest.findMany({
      orderBy: { createdAt: "desc" },
      take: TAKE,
      include: { ctv: { select: { name: true } } },
    }),
    prisma.bookingRequest.count(),
  ]);

  // Ngày LÊN XE / XE VỀ thực của đơn có chuyến cabin (cabin + combo) — lấy từ CabinTrip.
  const tripIds = [
    ...new Set(bookings.flatMap((b) => [b.cabinTripId, b.cabinReturnTripId]).filter((x): x is string => !!x)),
  ];
  const tripDate = new Map(
    (tripIds.length
      ? await prisma.cabinTrip.findMany({ where: { id: { in: tripIds } }, select: { id: true, departureDate: true } })
      : []
    ).map((t) => [t.id, t.departureDate]),
  );

  const rows: BookingRow[] = bookings.map((b) => {
    const chips: string[] = [];
    if (b.selectionLabel) chips.push(b.selectionLabel);
    if (b.nights) chips.push(`${b.nights} đêm`);
    if (b.seatsSingle) chips.push(`${b.seatsSingle} chỗ`);
    if (b.seatsDouble) chips.push(`${b.seatsDouble} cabin đôi`);
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
      paxLabel: paxUnit === "SL" ? `SL ${b.quantity}` : `${b.quantity} khách`,
      price,
      collected,
      pay,
      status: b.status,
      ctvName: b.ctv?.name ?? null,
      createdAt: b.createdAt.toISOString(),
      note: b.note,
    };
  });

  return <BookingsListClient rows={rows} totalInDb={totalInDb} />;
}
