import { prisma } from "@/lib/prisma";
import { CATEGORIES } from "@/lib/constants";
import { toNumber } from "@/lib/format";
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

  const rows: BookingRow[] = bookings.map((b) => {
    const chips: string[] = [];
    if (b.selectionLabel) chips.push(b.selectionLabel);
    if (b.nights) chips.push(`${b.nights} đêm`);
    if (b.seatsSingle) chips.push(`${b.seatsSingle} cabin đơn`);
    if (b.seatsDouble) chips.push(`${b.seatsDouble} cabin đôi`);

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
      useDate: b.useDate.toISOString().slice(0, 10),
      endDate: b.endDate ? b.endDate.toISOString().slice(0, 10) : null,
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
