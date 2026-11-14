import "server-only";
import { prisma } from "./prisma";
import { CATEGORY_LIST, type AvailabilityKind } from "./constants";
import { COMBO_DISCOUNT } from "./combo";
import { toNumber } from "./format";
import { addDays, toDateKey, today } from "./dates";
import { bookingPax } from "./occupancy";
import { bookingCabinBerths } from "./combo-pricing";
import { parseSurcharges } from "./surcharges";
import { resolveBusCommissions, resolveRoomCommissions } from "./provider-commission";
import { supplierPayouts, type PayoutSide } from "./supplier-payout";
import type { BookingStatus, ServiceCategory } from "@prisma/client";
import type { EditInit } from "@/components/admin/AdminCreateBooking";

/** Mọi thứ form "Sửa đơn" (AdminCreateBooking chế độ edit) cần — dữ liệu thuần, gửi được xuống client. */
export interface BookingEditProps {
  code: string;
  categories: { key: ServiceCategory; label: string; kind: AvailabilityKind }[];
  services: { id: string; title: string; category: ServiceCategory; published: boolean }[];
  ctvs: { id: string; name: string }[];
  todayKey: string;
  comboDiscount: number;
  edit: EditInit;
  /** Phần "xử lý nhanh" của popup: trạng thái đơn, tiền đã thu của khách, tiền đã chi cho từng dịch vụ. */
  ops: {
    status: BookingStatus;
    cancelReason: string | null;
    price: number | null; // tổng khách trả
    collected: number; // đã thu của khách
    payouts: { side: PayoutSide; kind: string; name: string; gross: number; discount: number; payable: number; paid: number; remaining: number }[];
  };
}

/**
 * Nạp dữ liệu đơn cho form SỬA ĐƠN (dùng chung cho trang /admin/bookings/[id]/sua và popup sửa
 * ngay trên trang đang xem). Trả null nếu không có đơn.
 */
export async function loadBookingEdit(id: string): Promise<BookingEditProps | null> {
  const b = await prisma.bookingRequest.findUnique({ where: { id } });
  if (!b) return null;

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
      ? prisma.cabinTrip.findUnique({ where: { id: b.cabinTripId }, select: { serviceId: true, departureDate: true, service: { select: { title: true } } } })
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

  // Sàn thanh toán cho nhà cung cấp — cùng công thức với trang chi tiết đơn.
  const [roomDisc, busDisc] = await Promise.all([resolveRoomCommissions([b]), resolveBusCommissions([b])]);
  const svcTitle = services.find((s) => s.id === b.serviceId)?.title ?? b.serviceTitle;
  const stayish = b.category === "COMBO" || b.category === "HOMESTAY" || b.category === "BUNGALOW";
  const payouts = supplierPayouts(b, roomDisc.get(b.id) ?? 0, busDisc.get(b.id) ?? 0).map((s) => ({
    ...s,
    kind: s.side === "bus" ? "Nhà xe" : stayish ? "Homestay" : "Dịch vụ",
    name: s.side === "bus" ? (outTrip?.service.title ?? svcTitle) : svcTitle,
  }));

  return {
    ops: {
      status: b.status,
      cancelReason: b.cancelReason,
      price: total,
      collected: toNumber(b.amountCollected) ?? 0,
      payouts,
    },
    code: b.code,
    categories: CATEGORY_LIST.map((c) => ({ key: c.key, label: c.shortLabel, kind: c.availabilityKind })),
    services: services.map((s) => ({
      id: s.id,
      title: s.title,
      category: s.category === "BUNGALOW" ? "HOMESTAY" : s.category, // Bungalow đã gộp vào Homestay
      published: s.published,
    })),
    ctvs: ctvs.map((c) => ({ id: c.id, name: c.name || c.username })),
    todayKey: toDateKey(today()),
    comboDiscount: COMBO_DISCOUNT,
    edit,
  };
}
