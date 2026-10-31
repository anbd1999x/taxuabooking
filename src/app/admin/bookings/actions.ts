"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { bookingStatusSchema } from "@/lib/validation";
import { adjustInventory, assignRoomsForBooking, statusHoldsInventory } from "@/lib/inventory";

export interface BookingActionState {
  ok?: boolean;
  error?: string;
}

/** Đánh dấu đơn đã / chưa thanh toán (đối soát với chủ dịch vụ). */
export async function setBookingPayment(formData: FormData): Promise<void> {
  const id = formData.get("id") ? String(formData.get("id")) : "";
  if (!id) return;
  const paid = formData.get("paid") === "true";
  await prisma.bookingRequest.update({
    where: { id },
    data: { paymentStatus: paid ? "PAID" : "UNPAID", paidAt: paid ? new Date() : null },
  });
  for (const p of ["/admin/bookings", `/admin/bookings/${id}`, "/admin/reports", "/admin/ctv", "/admin/provider"]) {
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
