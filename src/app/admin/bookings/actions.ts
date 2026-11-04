"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { BookingStatus, PaymentStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { toNumber, formatPrice } from "@/lib/format";
import { bookingStatusSchema } from "@/lib/validation";
import { generateBookingCode } from "@/lib/utils";
import { BOOKING_STATUS_META } from "@/lib/constants";
import { adjustInventory, assignRoomsForBooking, statusHoldsInventory } from "@/lib/inventory";
import { canRoleAct, type BookingRole } from "@/lib/booking-flow";

export interface BookingActionState {
  ok?: boolean;
  error?: string;
  message?: string;
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

/**
 * Kiểm tra quyền thao tác một đơn, trả về VAI TRÒ (để gate theo giai đoạn) hoặc null.
 * ADMIN: mọi đơn. PROVIDER: chỉ đơn thuộc dịch vụ mình sở hữu. CTV/khác: null.
 * (Giá trị trả về vẫn dùng được như boolean: null = không có quyền.)
 */
async function canManage(bookingId: string): Promise<BookingRole | null> {
  const session = await getSession();
  if (!session) return null;
  if (session.role === "ADMIN") return "ADMIN";
  if (session.role !== "PROVIDER") return null;
  const b = await prisma.bookingRequest.findUnique({
    where: { id: bookingId },
    select: { service: { select: { ownerId: true } } },
  });
  return b && b.service?.ownerId === session.sub ? "PROVIDER" : null;
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
  const role = await canManage(id);
  if (!role) return;

  const b = await prisma.bookingRequest.findUnique({
    where: { id },
    select: { referencePrice: true, status: true, paymentStatus: true },
  });
  if (!b) return;
  // Chủ dịch vụ chỉ được ghi nhận thu tiền sau khi đơn đã xác nhận + đã có cọc (sàn thu cọc).
  if (!canRoleAct(role, b.status, b.paymentStatus, "pay")) return;
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
  if (!id || !["NEW", "CONTACTING", "CONFIRMED", "COMPLETED", "CANCELLED"].includes(status)) return;
  const role = await canManage(id);
  if (!role) return;
  const newStatus = status as BookingStatus;

  await prisma.$transaction(async (tx) => {
    const booking = await tx.bookingRequest.findUnique({ where: { id } });
    if (!booking) return;
    // Gate theo vai trò: chủ dịch vụ không xác nhận/hủy; chỉ hoàn thành đơn đã thu đủ.
    if (!canRoleAct(role, booking.status, booking.paymentStatus, "status", newStatus)) return;
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

/* ===================== Trang chi tiết đơn (thiết kế mới) ===================== */

async function sessionName(): Promise<string> {
  const s = await getSession();
  return s?.name || s?.username || "Admin";
}

function log(
  db: Prisma.TransactionClient | typeof prisma,
  bookingId: string,
  kind: "STATUS" | "PAYMENT" | "NOTE" | "SUPPLIER" | "SYSTEM",
  title: string,
  body: string | null,
  by: string,
) {
  return db.bookingLog.create({ data: { bookingId, kind, title, body, by } });
}

function revalidateDetail(id: string) {
  for (const p of [...REVALIDATE, `/admin/bookings/${id}`]) revalidatePath(p);
}

/**
 * Chuyển trạng thái NHIỀU ĐƠN (hoặc 1 đơn, từ danh sách / drawer xử lý nhanh):
 * đồng bộ tồn kho + ghi nhật ký cho từng đơn. Huỷ không bắt buộc lý do
 * (mặc định ghi "Huỷ nhanh từ danh sách").
 */
export async function bulkUpdateBookingStatus(
  _prev: BookingActionState,
  formData: FormData,
): Promise<BookingActionState> {
  let ids: string[] = [];
  try {
    ids = JSON.parse(String(formData.get("ids") ?? "[]"));
  } catch {
    /* ids hỏng ⇒ coi như rỗng */
  }
  const status = String(formData.get("status") ?? "") as BookingStatus;
  if (!Array.isArray(ids) || ids.length === 0 || !["NEW", "CONTACTING", "CONFIRMED", "COMPLETED", "CANCELLED"].includes(status)) {
    return { error: "Dữ liệu không hợp lệ." };
  }
  const cancelReason = String(formData.get("cancelReason") ?? "").trim() || "Huỷ nhanh từ danh sách";
  const by = await sessionName();
  const label = BOOKING_STATUS_META[status].label;

  let done = 0;
  for (const id of ids.slice(0, 100).map(String)) {
    const role = await canManage(id);
    if (!role) continue;
    try {
      await prisma.$transaction(async (tx) => {
        const booking = await tx.bookingRequest.findUnique({ where: { id } });
        if (!booking || booking.status === status) return;
        // Chủ dịch vụ: chỉ được hoàn thành đơn đã thu đủ (không xác nhận/hủy hàng loạt).
        if (!canRoleAct(role, booking.status, booking.paymentStatus, "status", status)) return;

        const shouldHold = statusHoldsInventory(status);
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
        await tx.bookingRequest.update({
          where: { id },
          data: {
            status,
            inventoryApplied,
            cancelReason: status === "CANCELLED" ? cancelReason : null,
            needsConfirmation: status === "NEW" ? booking.needsConfirmation : false,
          },
        });
        await log(tx, id, "STATUS", `Chuyển sang ${label}`, status === "CANCELLED" ? `Lý do: ${cancelReason}` : null, by);
        done++;
      });
    } catch {
      /* đơn lỗi (vd hết chỗ khi giữ tồn) ⇒ bỏ qua, đếm theo done */
    }
  }

  if (done === 0) return { error: "Không có đơn nào được cập nhật (có thể hết chỗ hoặc không đủ quyền)." };
  for (const p of REVALIDATE) revalidatePath(p);
  for (const id of ids) revalidatePath(`/admin/bookings/${id}`);
  return { ok: true, message: done === 1 ? `Đã chuyển đơn sang “${label}”` : `Đã chuyển ${done} đơn sang “${label}”` };
}

/**
 * Lưu TRẠNG THÁI ĐƠN từ panel chi tiết: đồng bộ tồn kho + ghi nhật ký; huỷ phải
 * kèm lý do (lưu để thống kê).
 */
export async function saveBookingStage(
  _prev: BookingActionState,
  formData: FormData,
): Promise<BookingActionState> {
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "") as BookingStatus;
  const cancelReason = String(formData.get("cancelReason") ?? "").trim();
  if (!id || !["NEW", "CONTACTING", "CONFIRMED", "COMPLETED", "CANCELLED"].includes(status)) {
    return { error: "Dữ liệu không hợp lệ." };
  }
  if (status === "CANCELLED" && !cancelReason) return { error: "Chọn lý do huỷ trước khi lưu." };
  const role = await canManage(id);
  if (!role) return { error: "Không có quyền thao tác đơn này." };
  const by = await sessionName();

  try {
    await prisma.$transaction(async (tx) => {
      const booking = await tx.bookingRequest.findUnique({ where: { id } });
      if (!booking) throw new Error("Không tìm thấy yêu cầu.");
      if (booking.status === status && status !== "CANCELLED") return;
      if (!canRoleAct(role, booking.status, booking.paymentStatus, "status", status)) {
        throw new Error("Chủ dịch vụ không có quyền chuyển sang trạng thái này.");
      }

      const shouldHold = statusHoldsInventory(status);
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
      await tx.bookingRequest.update({
        where: { id },
        data: {
          status,
          inventoryApplied,
          cancelReason: status === "CANCELLED" ? cancelReason : null,
          needsConfirmation: status === "NEW" ? booking.needsConfirmation : false,
        },
      });
      await log(
        tx, id, "STATUS",
        `Chuyển sang ${BOOKING_STATUS_META[status].label}`,
        status === "CANCELLED" ? `Lý do: ${cancelReason}` : null,
        by,
      );
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Có lỗi xảy ra." };
  }
  revalidateDetail(id);
  return { ok: true, message: `Đã chuyển đơn sang “${BOOKING_STATUS_META[status].label}”` };
}

/**
 * Ghi nhận MỘT LẦN THU TIỀN (cọc / thanh toán): cộng dồn vào amountCollected,
 * tự suy ra paymentStatus (UNPAID/DEPOSITED/PAID) và ghi nhật ký kèm hình thức.
 * mode=full ⇒ thu nốt phần còn thiếu.
 */
export async function recordBookingPayment(
  _prev: BookingActionState,
  formData: FormData,
): Promise<BookingActionState> {
  const id = String(formData.get("id") ?? "");
  const mode = String(formData.get("mode") ?? "add");
  const method = String(formData.get("method") ?? "Chuyển khoản").slice(0, 50);
  if (!id) return { error: "Dữ liệu không hợp lệ." };
  const role = await canManage(id);
  if (!role) return { error: "Không có quyền thao tác đơn này." };

  const b = await prisma.bookingRequest.findUnique({
    where: { id },
    select: { referencePrice: true, amountCollected: true, status: true, paymentStatus: true },
  });
  if (!b) return { error: "Không tìm thấy yêu cầu." };
  if (!canRoleAct(role, b.status, b.paymentStatus, "pay")) {
    return { error: "Chủ dịch vụ chỉ ghi nhận thu tiền sau khi đơn đã xác nhận & có cọc." };
  }
  const price = toNumber(b.referencePrice);
  const collected = toNumber(b.amountCollected) ?? 0;

  let amount: number;
  if (mode === "full") {
    if (price == null) return { error: "Đơn chưa có giá — nhập số tiền cụ thể." };
    amount = price - collected;
    if (amount <= 0) return { error: "Đơn đã thu đủ." };
  } else {
    amount = money(formData.get("amount")) ?? 0;
    if (amount <= 0) return { error: "Nhập số tiền đã thu." };
    if (price != null && collected + amount > price) {
      return { error: `Vượt quá giá đơn (${formatPrice(price)}).` };
    }
  }

  const total = collected + amount;
  const full = price != null && total >= price;
  const by = await sessionName();
  await prisma.bookingRequest.update({
    where: { id },
    data: {
      amountCollected: total,
      paymentStatus: full ? "PAID" : "DEPOSITED",
      paidAt: full ? new Date() : null,
    },
  });
  await log(
    prisma, id, "PAYMENT",
    `Thu ${formatPrice(amount)} · ${method}`,
    full ? "Đơn đã thanh toán đủ" : price != null ? `Còn thiếu ${formatPrice(price - total)}` : null,
    by,
  );
  revalidateDetail(id);
  return { ok: true, message: `Đã ghi nhận ${formatPrice(amount)}` };
}

/** Thêm GHI CHÚ NỘI BỘ vào nhật ký xử lý đơn. */
export async function addBookingNote(
  _prev: BookingActionState,
  formData: FormData,
): Promise<BookingActionState> {
  const id = String(formData.get("id") ?? "");
  const note = String(formData.get("note") ?? "").trim().slice(0, 1000);
  if (!id || !note) return { error: "Nhập nội dung ghi chú." };
  if (!(await canManage(id))) return { error: "Không có quyền thao tác đơn này." };
  await log(prisma, id, "NOTE", "Ghi chú", note, await sessionName());
  revalidateDetail(id);
  return { ok: true, message: "Đã thêm ghi chú" };
}

/** Bật/tắt đánh dấu NHÀ CUNG CẤP ĐÃ GIỮ CHỖ (side: room = phòng/dịch vụ, bus = nhà xe). */
export async function toggleBookingHeld(
  _prev: BookingActionState,
  formData: FormData,
): Promise<BookingActionState> {
  const id = String(formData.get("id") ?? "");
  const side = String(formData.get("side") ?? "");
  const label = String(formData.get("label") ?? "").slice(0, 200);
  if (!id || !["room", "bus"].includes(side)) return { error: "Dữ liệu không hợp lệ." };
  const role = await canManage(id);
  if (!role) return { error: "Không có quyền thao tác đơn này." };
  const b = await prisma.bookingRequest.findUnique({ where: { id }, select: { heldRoom: true, heldBus: true, status: true, paymentStatus: true } });
  if (!b) return { error: "Không tìm thấy yêu cầu." };
  if (!canRoleAct(role, b.status, b.paymentStatus, "held")) {
    return { error: "Chủ dịch vụ chỉ thao tác sau khi đơn đã xác nhận & có cọc." };
  }
  const next = side === "room" ? !b.heldRoom : !b.heldBus;
  await prisma.bookingRequest.update({
    where: { id },
    data: side === "room" ? { heldRoom: next } : { heldBus: next },
  });
  if (next) await log(prisma, id, "SUPPLIER", "Nhà cung cấp đã giữ chỗ", label || null, await sessionName());
  revalidateDetail(id);
  return { ok: true, message: next ? "Đã đánh dấu giữ chỗ" : "Đã bỏ đánh dấu giữ chỗ" };
}

/** NHÂN BẢN đơn thành yêu cầu mới (trạng thái Mới, chưa thu tiền) rồi mở đơn mới. */
export async function duplicateBooking(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const session = await getSession();
  if (!id || session?.role !== "ADMIN") return;
  const b = await prisma.bookingRequest.findUnique({ where: { id } });
  if (!b) return;

  let code = generateBookingCode();
  for (let i = 0; i < 5; i++) {
    if (!(await prisma.bookingRequest.findUnique({ where: { code } }))) break;
    code = generateBookingCode();
  }
  const copy = await prisma.bookingRequest.create({
    data: {
      code,
      category: b.category,
      serviceId: b.serviceId,
      serviceTitle: b.serviceTitle,
      customerName: b.customerName,
      phone: b.phone,
      note: b.note,
      useDate: b.useDate,
      endDate: b.endDate,
      nights: b.nights,
      quantity: b.quantity,
      roomTypeId: b.roomTypeId,
      roomId: b.roomId,
      cabinTripId: b.cabinTripId,
      cabinReturnTripId: b.cabinReturnTripId,
      seatsSingle: b.seatsSingle,
      seatsDouble: b.seatsDouble,
      rentalVehicleId: b.rentalVehicleId,
      selectionLabel: b.selectionLabel,
      referencePrice: b.referencePrice,
      roomAmount: b.roomAmount,
      busAmount: b.busAmount,
      ctvId: b.ctvId,
      commissionAmount: b.commissionAmount,
      needsConfirmation: true,
    },
  });
  await log(prisma, copy.id, "SYSTEM", "Nhân bản từ đơn " + b.code, null, await sessionName());
  revalidatePath("/admin/bookings");
  redirect(`/admin/bookings/${copy.id}`);
}

/** XOÁ HẲN yêu cầu (chỉ ADMIN): trả tồn kho nếu đang giữ rồi xoá. */
export async function deleteBooking(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const session = await getSession();
  if (!id || session?.role !== "ADMIN") return;
  await prisma.$transaction(async (tx) => {
    const booking = await tx.bookingRequest.findUnique({ where: { id } });
    if (!booking) return;
    if (booking.inventoryApplied) {
      if (booking.roomTypeId) await assignRoomsForBooking(tx, booking, false);
      if (booking.cabinTripId || booking.rentalVehicleId) await adjustInventory(tx, booking, +1);
    }
    await tx.bookingRequest.delete({ where: { id } });
  });
  for (const p of REVALIDATE) revalidatePath(p);
  redirect("/admin/bookings");
}

/**
 * XOÁ HẲN nhiều yêu cầu từ danh sách (chỉ ADMIN): trả tồn kho đơn nào đang giữ
 * rồi xoá; nhật ký đơn xoá theo (cascade). Dùng cho đơn rác/trùng/test.
 */
export async function bulkDeleteBookings(
  _prev: BookingActionState,
  formData: FormData,
): Promise<BookingActionState> {
  const session = await getSession();
  if (session?.role !== "ADMIN") return { error: "Chỉ quản trị viên được xoá yêu cầu." };
  let ids: string[] = [];
  try {
    ids = JSON.parse(String(formData.get("ids") ?? "[]"));
  } catch {
    /* ids hỏng ⇒ coi như rỗng */
  }
  if (!Array.isArray(ids) || ids.length === 0) return { error: "Dữ liệu không hợp lệ." };

  let done = 0;
  for (const id of ids.slice(0, 100).map(String)) {
    try {
      await prisma.$transaction(async (tx) => {
        const booking = await tx.bookingRequest.findUnique({ where: { id } });
        if (!booking) return;
        if (booking.inventoryApplied) {
          if (booking.roomTypeId) await assignRoomsForBooking(tx, booking, false);
          if (booking.cabinTripId || booking.rentalVehicleId) await adjustInventory(tx, booking, +1);
        }
        await tx.bookingRequest.delete({ where: { id } });
        done++;
      });
    } catch {
      /* đơn lỗi ⇒ bỏ qua, đếm theo done */
    }
  }

  if (done === 0) return { error: "Không xoá được đơn nào." };
  for (const p of REVALIDATE) revalidatePath(p);
  return { ok: true, message: done === 1 ? "Đã xoá 1 đơn" : `Đã xoá ${done} đơn` };
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
