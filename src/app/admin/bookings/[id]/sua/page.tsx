import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { CATEGORY_LIST } from "@/lib/constants";
import { COMBO_DISCOUNT } from "@/lib/combo";
import { toNumber } from "@/lib/format";
import { addDays, toDateKey, today } from "@/lib/dates";
import { bookingPax } from "@/lib/occupancy";
import { bookingCabinBerths } from "@/lib/combo-pricing";
import { parseSurcharges } from "@/lib/surcharges";
import AdminCreateBooking, { type EditInit } from "@/components/admin/AdminCreateBooking";

export const dynamic = "force-dynamic";

/**
 * SỬA ĐƠN (admin) — cùng form "Tạo đơn hộ khách", nạp sẵn dữ liệu đơn: đổi được danh mục,
 * homestay, phòng, nhà xe, chuyến, cách nằm, tuyến đón, ngày, số khách, khách, CTV, tiền.
 */
export default async function EditBookingPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const b = await prisma.bookingRequest.findUnique({ where: { id } });
  if (!b) notFound();

  const [services, ctvs, outTrip] = await Promise.all([
    prisma.service.findMany({
      select: { id: true, title: true, category: true, published: true },
      orderBy: [{ published: "desc" }, { priorityOrder: "desc" }, { title: "asc" }],
    }),
    prisma.adminUser.findMany({
      where: { role: "CTV" },
      select: { id: true, name: true, username: true },
      orderBy: { name: "asc" },
    }),
    b.cabinTripId
      ? prisma.cabinTrip.findUnique({ where: { id: b.cabinTripId }, select: { serviceId: true, departureDate: true } })
      : null,
  ]);

  const isCombo = b.category === "COMBO";
  // Ghi chú: tách "Đón: …" (điểm đón → ô tuyến) và "Tạm tính: …" (tự sinh) khỏi ghi chú khách.
  const segs = (b.note ?? "").split(" · ").map((x) => x.trim()).filter(Boolean);
  const origin =
    segs.find((x) => x.startsWith("Đón:"))?.slice(4).trim() ||
    b.selectionLabel?.match(/\btừ ([^·(]+?)\s*(?:\(|·|$)/)?.[1]?.trim() ||
    b.selectionLabel?.match(/đón tại ([^·()]+?)\s*(?:\)|·|$)/)?.[1]?.trim() ||
    "";
  const note = segs.filter((x) => !x.startsWith("Đón:") && !x.startsWith("Tạm tính:")).join(" · ");

  const berths = bookingCabinBerths(b);
  const surchargeTotal = parseSurcharges(b.surcharges).reduce((n, x) => n + x.amount, 0);
  const total = toNumber(b.referencePrice);
  const price = total != null ? Math.max(0, total - surchargeTotal) : null; // giá chưa gồm phụ thu
  const roomAmt = toNumber(b.roomAmount);
  const busAmt = toNumber(b.busAmount);
  const roomIds = b.roomIds.length ? b.roomIds : b.roomId ? [b.roomId] : [];
  // Combo: ngày đi = ngày xe chạy chiều đi (thiếu chuyến thì = nhận phòng − 1).
  const fromDate = isCombo ? (outTrip?.departureDate ?? addDays(b.useDate, -1)) : b.useDate;

  const edit: EditInit = {
    bookingId: b.id,
    cat: b.category === "BUNGALOW" ? "HOMESTAY" : b.category,
    serviceId: b.serviceId ?? "",
    busId: isCombo ? (outTrip?.serviceId ?? "") : "",
    from: toDateKey(fromDate),
    to: b.endDate ? toDateKey(b.endDate) : "",
    qty: b.category === "HOMESTAY" || b.category === "BUNGALOW" ? bookingPax(b) : b.quantity,
    shared: berths ? berths.shared : b.quantity,
    solo: berths ? berths.solo : 0,
    pick: b.rentalVehicleId ?? "",
    pickIds: roomIds,
    outId: b.cabinTripId ?? "",
    retId: b.cabinReturnTripId ?? "",
    origin,
    price,
    roomAmt,
    busAmt,
    // Giảm giá combo = tiền phòng + tiền vé − giá (chưa phụ thu).
    discount: isCombo && price != null ? Math.max(0, (roomAmt ?? 0) + (busAmt ?? 0) - price) : 0,
    surchargeTotal,
    customerName: b.customerName,
    phone: b.phone,
    customerFacebook: b.customerFacebook ?? "",
    ctvId: b.ctvId ?? "",
    note,
    adminNote: b.adminNote ?? "",
    inventoryApplied: b.inventoryApplied,
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href={`/admin/bookings/${b.id}`} className="text-sm font-semibold text-gray-500 hover:text-ink">
          ← Đơn {b.code}
        </Link>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-ink">Sửa đơn {b.code}</h1>
        <p className="mt-1 text-sm text-gray-500">
          Đổi được mọi thông tin: dịch vụ, homestay &amp; phòng, nhà xe &amp; chuyến, cách nằm, tuyến đón, ngày, số khách,
          khách hàng, CTV, tiền. Mọi thay đổi được ghi vào lịch sử đơn.
        </p>
      </div>
      <AdminCreateBooking
        categories={CATEGORY_LIST.map((c) => ({ key: c.key, label: c.shortLabel, kind: c.availabilityKind }))}
        services={services.map((s) => ({
          id: s.id,
          title: s.title,
          category: s.category === "BUNGALOW" ? "HOMESTAY" : s.category,
          published: s.published,
        }))}
        ctvs={ctvs.map((c) => ({ id: c.id, name: c.name || c.username }))}
        todayKey={toDateKey(today())}
        comboDiscount={COMBO_DISCOUNT}
        edit={edit}
      />
    </div>
  );
}
