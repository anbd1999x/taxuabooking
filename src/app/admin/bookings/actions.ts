"use server";

import { revalidatePath } from "next/cache";
import type { BookingStatus, PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { toNumber } from "@/lib/format";
import { bookingStatusSchema } from "@/lib/validation";
import { adjustInventory, assignRoomsForBooking, statusHoldsInventory } from "@/lib/inventory";

export interface BookingActionState {
  ok?: boolean;
  error?: string;
}

const REVALIDATE = [
  "/admin/bookings",
  "/admin/reports",
  "/admin/ctv",
  "/admin/ctv/don",
  "/admin/provider",
  "/admin/provider/don",
  "/admin/availability",
];

/** Kiểm tra quyền thao tác một đơn: ADMIN toàn quyền; PROVIDER chỉ đơn của dịch vụ mình. */
async function canManage(bookingId: string): Promise<boolean> {
  const session = await getSession();
  if (!session) return false;
  if (session.role === "ADMIN") return true;
  if (session.role !== "PROVIDER") return false;
  const b = await prisma.bookingRequest.findUnique({
    where: { id: bookingId },
    select: { service: { select: { ownerId: true } } },
  });
  return !!b && b.service?.ownerId === session.sub;
}

/** Số tiền (đồng) từ ô nhập; rỗng ⇒ null. */
function money(v: FormDataEntryValue | null): number | null {
  const t = v == null ? "" : String(v).replace(/[^\d]/g, "");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/**
 * Cập nhật TIẾN ĐỘ THANH TOÁN của khách: Chưa thu → Đã cọc → Đã thanh toán đủ.
 * Ghi nhận số tiền đã thu để tính "còn thiếu". ADMIN & chủ dịch vụ (đơn của mình).
 */
export async function setBookingPaymentStep(formData: FormData): Promise<void> {
  const id = formData.get("id") ? String(formData.get("id")) : "";
  const status = String(formData.get("status") ?? "");
  if (!id || !["UNPAID", "DEPOSITED", "PAID"].includes(status)) return;
  if (!(await canManage(id))) return;

  const b = await prisma.bookingRequest.findUnique({ where: { id }, select: { referencePrice: true } });
  if (!b) return;
  const entered = money(formData.get("amountCollected"));

  let amountCollected: number | null = null;
  let paidAt: Date | null = null;
  if (status === "DEPOSITED") {
    amountCollected = entered ?? 0;
  } else if (status === "PAID") {
    // Thanh toán đủ ⇒ đã thu = giá đơn (nếu có), còn thiếu = 0.
    amountCollected = toNumber(b.referencePrice) ?? entered ?? 0;
    paidAt = new Date();
  }

  await prisma.bookingRequest.update({
    where: { id },
    data: { paymentStatus: status as PaymentStatus, amountCollected, paidAt },
  });
  for (const p of [...REVALIDATE, `/admin/bookings/${id}`]) revalidatePath(p);
}

/**
 * Chuyển TRẠNG THÁI ĐƠN (vòng đời) kèm đồng bộ tồn kho: NEW → CONFIRMED (giữ phòng) →
 * COMPLETED, hoặc CANCELLED (trả phòng). ADMIN & chủ dịch vụ (đơn của mình).
 */
export async function advanceBookingStatus(formData: FormData): Promise<void> {
  const id = formData.get("id") ? String(formData.get("id")) : "";
  const status = String(formData.get("status") ?? "");
  if (!id || !["NEW", "CONFIRMED", "COMPLETED", "CANCELLED"].includes(status)) return;
  if (!(await canManage(id))) return;
  const newStatus = status as BookingStatus;

  await prisma.$transaction(async (tx) => {
    const booking = await tx.bookingRequest.findUnique({ where: { id } });
    if (!booking) return;
    const shouldHold = statusHoldsInventory(newStatus);
    let inventoryApplied = booking.inventoryApplied;
    if (shouldHold && !booking.inventoryApplied) {
      if (booking.roomTypeId) await assignRoomsForBooking(tx, booking, true);
      if (booking.cabinTripId || booking.rentalVehicleId) await adjustInventory(tx, booking, -1);
      inventoryApplied = true;
    } else if (!shouldHold && booking.inventoryApplied) {
      if (booking.roomTypeId) await assignRoomsForBooking(tx, booking, false);
      if (booking.cabinTripId || booking.rentalVehicleId) await adjustInventory(tx, booking, +1);
      inventoryApplied = false;
    }
    await tx.bookingRequest.update({ where: { id }, data: { status: newStatus, inventoryApplied } });
  });
  for (const p of [...REVALIDATE, `/admin/bookings/${id}`]) revalidatePath(p);
}

/**
 * Đánh dấu đã / chưa TRẢ HOA HỒNG cho CTV của đơn.
 * ADMIN: toàn quyền. PROVIDER: chỉ đơn thuộc dịch vụ mình sở hữu. CTV: không được.
 */
export async function setBookingCommissionPaid(formData: FormData): Promise<void> {
  const id = formData.get("id") ? String(formData.get("id")) : "";
  if (!id) return;
  const paid = formData.get("paid") === "true";
  const session = await getSession();
  if (!session) return;
  const b = await prisma.bookingRequest.findUnique({
    where: { id },
    select: { service: { select: { ownerId: true } } },
  });
  if (!b) return;
  if (session.role === "PROVIDER") {
    if (b.service?.ownerId !== session.sub) return;
  } else if (session.role !== "ADMIN") {
    return;
  }
  await prisma.bookingRequest.update({
    where: { id },
    data: { commissionPaid: paid, commissionPaidAt: paid ? new Date() : null },
  });
  for (const p of ["/admin/bookings", `/admin/bookings/${id}`, "/admin/reports", "/admin/ctv", "/admin/ctv/don", "/admin/provider", "/admin/provider/don"]) {
    revalidatePath(p);
  }
}

export async function updateBookingStatus(
  _prev: BookingActionState,
  formData: FormData,
): Promise<BookingActionState> {
  const parsed = bookingStatusSchema.safeParse({
    id: formData.get("id"),
    status: formData.get("status"),
    adminNote: formData.get("adminNote") ? String(formData.get("adminNote")) : null,
  });
  if (!parsed.success) {
    return { error: "Dữ liệu không hợp lệ." };
  }
  const { id, status, adminNote } = parsed.data;

  try {
    await prisma.$transaction(async (tx) => {
      const booking = await tx.bookingRequest.findUnique({ where: { id } });
      if (!booking) throw new Error("Không tìm thấy yêu cầu.");

      const shouldHold = statusHoldsInventory(status);
      let inventoryApplied = booking.inventoryApplied;

      // Đồng bộ tồn kho theo trạng thái mới.
      // Homestay: gán/trả phòng riêng. Cabin/xe máy: cộng/trừ số lượng.
      // COMBO có CẢ phòng lẫn chuyến xe → phải làm cả hai (không else-if).
      if (shouldHold && !booking.inventoryApplied) {
        if (booking.roomTypeId) await assignRoomsForBooking(tx, booking, true);
        if (booking.cabinTripId || booking.rentalVehicleId) await adjustInventory(tx, booking, -1);
        inventoryApplied = true;
      } else if (!shouldHold && booking.inventoryApplied) {
        if (booking.roomTypeId) await assignRoomsForBooking(tx, booking, false);
        if (booking.cabinTripId || booking.rentalVehicleId) await adjustInventory(tx, booking, +1);
        inventoryApplied = false;
      }

      await tx.bookingRequest.update({
        where: { id },
        data: { status, adminNote: adminNote ?? null, inventoryApplied },
      });
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Có lỗi xảy ra." };
  }

  revalidatePath("/admin/bookings");
  revalidatePath(`/admin/bookings/${id}`);
  revalidatePath("/admin/inventory");
  revalidatePath("/admin/availability");
  return { ok: true };
}
