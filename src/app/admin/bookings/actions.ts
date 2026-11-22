"use server";

import { dmy } from "@/lib/date-format";
import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import type { BookingStatus, PaymentStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession, requireAdmin } from "@/lib/auth";
import { toNumber, formatPrice } from "@/lib/format";
import { bookingStatusSchema } from "@/lib/validation";
import { generateBookingCode, normalizeFacebookUrl } from "@/lib/utils";
import { BOOKING_STATUS_META } from "@/lib/constants";
import { adjustInventory, assignRoomsForBooking, lockBooking, statusHoldsInventory, RoomConflictError } from "@/lib/inventory";
import { canRoleAct, type BookingRole } from "@/lib/booking-flow";
import { enumerateNights, isValidDateKey, parseDateOnly, toDateKey } from "@/lib/dates";
import { parseSurcharges, type BookingSurcharge } from "@/lib/surcharges";
import { AUTO_CANCEL_HOURS_KEY, MAX_AUTO_CANCEL_HOURS } from "@/lib/auto-cancel-config";
import { supplierPayouts, collectorOf, PROVIDER_EXTRA_ID, PROVIDER_EXTRA_LABEL } from "@/lib/supplier-payout";
import { bookingMessagesById, type BookingMessages } from "@/lib/booking-messages";
import { sendConfirmEmailIfDue } from "@/lib/booking-email";
import { assignComboBikeService, syncFleetForBooking } from "@/lib/fleet";
import { syncStaysForBooking } from "@/lib/stay";
import { syncRoomTypeAvailability } from "@/lib/room-availability";
import { resolveBusCommissions, resolveRoomCommissions } from "@/lib/provider-commission";

export interface BookingActionState {
  ok?: boolean;
  error?: string;
  message?: string;
  /** Phòng đang bị khoá: `error` là cảnh báo tình trạng hiện tại — admin đồng ý thì gửi lại kèm force=1 để ghi đè. */
  needConfirm?: boolean;
}

const OVERRIDE_ASK = "\n\nVẫn lưu và GHI ĐÈ lên lịch phòng hiện tại?";

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
  await advanceBookingStatusResult(formData);
}

/**
 * Như advanceBookingStatus nhưng TRẢ LỖI thay vì ném (vd phòng đã kín khi xác nhận)
 * — để giao diện hiện thông báo rõ ràng thay vì trang lỗi (prod ẩn message lỗi ném ra).
 */
export async function advanceBookingStatusResult(formData: FormData): Promise<{ error?: string }> {
  const id = formData.get("id") ? String(formData.get("id")) : "";
  const status = String(formData.get("status") ?? "");
  if (!id || !["NEW", "CONTACTING", "CONFIRMED", "COMPLETED", "CANCELLED"].includes(status)) return { error: "Dữ liệu không hợp lệ." };
  const role = await canManage(id);
  if (!role) return { error: "Không có quyền thao tác đơn này." };
  const newStatus = status as BookingStatus;

  try {
    await advanceTx(id, role, newStatus);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Có lỗi xảy ra." };
  }
  void sendConfirmEmailIfDue(id); // đơn vừa xác nhận + khách có email ⇒ gửi thư xác nhận (1 lần)
  void syncFleetForBooking(id).catch(() => {}); void syncStaysForBooking(id).catch(() => {}); // đơn xe máy: đồng bộ đội xe (huỷ ⇒ nhả xe)
  for (const p of [...REVALIDATE, `/admin/bookings/${id}`]) revalidatePath(p);
  return {};
}

async function advanceTx(id: string, role: BookingRole, newStatus: BookingStatus): Promise<void> {
  const by = await sessionName();
  await prisma.$transaction(async (tx) => {
    await lockBooking(tx, id); // chống 2 lần xác nhận song song cùng trừ tồn (BK-3)
    const booking = await tx.bookingRequest.findUnique({ where: { id } });
    if (!booking) throw new Error("Không tìm thấy yêu cầu.");
    if (booking.status === newStatus) return;
    // Gate theo vai trò: chủ dịch vụ không xác nhận/hủy; chỉ hoàn thành đơn đã thu đủ.
    // (Trước đây trả về im lặng ⇒ giao diện báo thành công dù không đổi gì.)
    if (!canRoleAct(role, booking.status, booking.paymentStatus, "status", newStatus, booking.category === "COMBO")) {
      throw new Error("Bạn không có quyền chuyển đơn sang trạng thái này.");
    }
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
    // Như saveBookingStage/bulkUpdateBookingStatus: rời trạng thái Mới ⇒ bỏ cờ "Cần xác nhận lại"
    // (trước đây đơn đã xác nhận từ thẻ quản lý vẫn hiện badge này) + ghi nhật ký.
    await tx.bookingRequest.update({
      where: { id },
      data: { status: newStatus, inventoryApplied, needsConfirmation: newStatus === "NEW" ? booking.needsConfirmation : false },
    });
    await log(tx, id, "STATUS", `Chuyển sang ${BOOKING_STATUS_META[newStatus].label}`, null, by);
  });
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
  void syncFleetForBooking(id).catch(() => {}); void syncStaysForBooking(id).catch(() => {}); // đơn xe máy: đồng bộ đội xe
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
  const wantForce = formData.get("force") === "1";
  const conflicts: string[] = []; // đơn bị chặn vì phòng đang khoá (admin có thể đồng ý ghi đè)

  let done = 0;
  for (const id of ids.slice(0, 100).map(String)) {
    const role = await canManage(id);
    if (!role) continue;
    const force = wantForce && role === "ADMIN"; // chỉ admin được ghi đè lịch phòng
    try {
      await prisma.$transaction(async (tx) => {
        await lockBooking(tx, id); // chống 2 lần xác nhận song song cùng trừ tồn (BK-3)
        const booking = await tx.bookingRequest.findUnique({ where: { id } });
        if (!booking || booking.status === status) return;
        // Chủ dịch vụ: chỉ được hoàn thành đơn đã thu đủ (không xác nhận/hủy hàng loạt).
        if (!canRoleAct(role, booking.status, booking.paymentStatus, "status", status, booking.category === "COMBO")) return;

        const shouldHold = statusHoldsInventory(status);
        let inventoryApplied = booking.inventoryApplied;
        if (shouldHold && !booking.inventoryApplied) {
          if (booking.roomTypeId) {
            try {
              await assignRoomsForBooking(tx, booking, true);
            } catch (err) {
              if (!(err instanceof RoomConflictError) || role !== "ADMIN") throw err;
              if (!force) {
                conflicts.push(`Đơn ${booking.code}: ${err.message}`);
                throw err;
              }
              await assignRoomsForBooking(tx, booking, true, { force: true });
              await log(tx, id, "SYSTEM", "Ghi đè lịch phòng đang khoá", err.message, by);
            }
          }
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

  if (conflicts.length) {
    for (const p of REVALIDATE) revalidatePath(p);
    return {
      needConfirm: true,
      error:
        (done > 0 ? `Đã chuyển ${done} đơn; còn ${conflicts.length} đơn có phòng đang bị khoá:\n\n` : "") +
        conflicts.slice(0, 5).join("\n\n") +
        (conflicts.length > 5 ? `\n\n… và ${conflicts.length - 5} đơn khác` : "") +
        OVERRIDE_ASK,
    };
  }
  if (done === 0) return { error: "Không có đơn nào được cập nhật (có thể hết chỗ hoặc không đủ quyền)." };
  for (const p of REVALIDATE) revalidatePath(p);
  for (const id of ids) revalidatePath(`/admin/bookings/${id}`);
  for (const id of ids.slice(0, 100).map(String)) { void sendConfirmEmailIfDue(id); void syncFleetForBooking(id).catch(() => {}); void syncStaysForBooking(id).catch(() => {}); }
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
  const force = formData.get("force") === "1" && role === "ADMIN"; // chỉ admin được ghi đè lịch phòng

  try {
    await prisma.$transaction(async (tx) => {
      await lockBooking(tx, id); // chống 2 lần xác nhận song song cùng trừ tồn (BK-3)
      const booking = await tx.bookingRequest.findUnique({ where: { id } });
      if (!booking) throw new Error("Không tìm thấy yêu cầu.");
      if (booking.status === status && status !== "CANCELLED") return;
      if (!canRoleAct(role, booking.status, booking.paymentStatus, "status", status, booking.category === "COMBO")) {
        throw new Error("Chủ dịch vụ không có quyền chuyển sang trạng thái này.");
      }

      const shouldHold = statusHoldsInventory(status);
      let inventoryApplied = booking.inventoryApplied;
      if (shouldHold && !booking.inventoryApplied) {
        if (booking.roomTypeId) {
          try {
            await assignRoomsForBooking(tx, booking, true);
          } catch (err) {
            // Phòng đang khoá: admin đã đồng ý (force) ⇒ ghi đè + ghi nhật ký; chưa thì ném ra để hỏi.
            if (!(err instanceof RoomConflictError) || !force) throw err;
            await assignRoomsForBooking(tx, booking, true, { force: true });
            await log(tx, id, "SYSTEM", "Ghi đè lịch phòng đang khoá", err.message, by);
          }
        }
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
    // Admin: phòng đang khoá ⇒ trả cảnh báo tình trạng hiện tại để hỏi có ghi đè không.
    if (err instanceof RoomConflictError && role === "ADMIN") {
      return { needConfirm: true, error: err.message + OVERRIDE_ASK };
    }
    return { error: err instanceof Error ? err.message : "Có lỗi xảy ra." };
  }
  void sendConfirmEmailIfDue(id);
  revalidateDetail(id); // đã gọi syncFleetForBooking + syncStaysForBooking
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
    select: { referencePrice: true, amountCollected: true, status: true, paymentStatus: true, updatedAt: true, collector: true, category: true },
  });
  if (!b) return { error: "Không tìm thấy yêu cầu." };
  // Đơn admin giao CHỦ DỊCH VỤ THU: chủ dịch vụ được ghi nhận thu ngay khi đơn đã xác nhận (không cần sàn cọc trước).
  const selfCollect = role === "PROVIDER" && collectorOf(b) === "PROVIDER" && b.status === "CONFIRMED";
  if (!selfCollect && !canRoleAct(role, b.status, b.paymentStatus, "pay")) {
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
  // Khoá lạc quan theo updatedAt (như saveBookingSurcharge): 2 lần ghi thu cùng lúc (bấm đúp,
  // admin + chủ dịch vụ) trước đây cùng đọc số cũ ⇒ lần sau ĐÈ mất khoản thu của lần trước.
  const r = await prisma.bookingRequest.updateMany({
    where: { id, updatedAt: b.updatedAt },
    data: {
      amountCollected: total,
      paymentStatus: full ? "PAID" : "DEPOSITED",
      paidAt: full ? new Date() : null,
    },
  });
  if (r.count === 0) return { error: "Đơn vừa được cập nhật ở nơi khác — tải lại trang rồi thử lại." };
  await log(
    prisma, id, "PAYMENT",
    `Thu ${formatPrice(amount)} · ${method}`,
    full ? "Đơn đã thanh toán đủ" : price != null ? `Còn thiếu ${formatPrice(price - total)}` : null,
    by,
  );
  revalidateDetail(id);
  return { ok: true, message: `Đã ghi nhận ${formatPrice(amount)}` };
}

/**
 * Ghi nhận SÀN THANH TOÁN CHO NHÀ CUNG CẤP trong một đơn (side: room = homestay/dịch vụ
 * chính, bus = nhà xe). Cộng dồn vào paidToRoom / paidToBus + ghi nhật ký. Chỉ ADMIN.
 * mode: add = trả thêm số tiền nhập · full = trả nốt phần còn lại · reset = đặt lại về 0 (nhập nhầm).
 */
export async function recordSupplierPayout(
  _prev: BookingActionState,
  formData: FormData,
): Promise<BookingActionState> {
  const id = String(formData.get("id") ?? "");
  const side = String(formData.get("side") ?? "");
  const mode = String(formData.get("mode") ?? "add");
  const label = String(formData.get("label") ?? "").slice(0, 120) || (side === "bus" ? "nhà xe" : "nhà cung cấp");
  if (!id || (side !== "room" && side !== "bus")) return { error: "Dữ liệu không hợp lệ." };
  const session = await getSession();
  if (session?.role !== "ADMIN") return { error: "Chỉ admin ghi nhận thanh toán cho nhà cung cấp." };

  const b = await prisma.bookingRequest.findUnique({ where: { id } });
  if (!b) return { error: "Không tìm thấy yêu cầu." };
  const [roomDisc, busDisc] = await Promise.all([resolveRoomCommissions([b]), resolveBusCommissions([b])]);
  const cur = supplierPayouts(b, roomDisc.get(id) ?? 0, busDisc.get(id) ?? 0).find((s) => s.side === side);
  if (!cur) return { error: "Đơn này không có phần tiền của bên đó." };

  let total: number;
  let title: string;
  if (mode === "reset") {
    if (cur.paid <= 0) return { error: "Chưa có khoản thanh toán nào để xoá." };
    total = 0;
    title = `Đặt lại tiền đã trả ${label} về 0 (trước đó ${formatPrice(cur.paid)})`;
  } else {
    const amount = mode === "full" ? cur.remaining : (money(formData.get("amount")) ?? 0);
    if (amount <= 0) return { error: mode === "full" ? "Đã thanh toán đủ cho bên này." : "Nhập số tiền đã thanh toán." };
    if (cur.paid + amount > cur.payable) {
      return { error: `Vượt quá số phải trả (${formatPrice(cur.payable)}, đã trả ${formatPrice(cur.paid)}).` };
    }
    total = cur.paid + amount;
    title = `Trả ${label} ${formatPrice(amount)}`;
  }

  // Khoá lạc quan theo updatedAt — tránh 2 lần ghi cùng lúc đè mất nhau.
  const r = await prisma.bookingRequest.updateMany({
    where: { id, updatedAt: b.updatedAt },
    data: side === "room" ? { paidToRoom: total } : { paidToBus: total },
  });
  if (r.count === 0) return { error: "Đơn vừa được cập nhật ở nơi khác — tải lại trang rồi thử lại." };
  await log(
    prisma, id, "SUPPLIER", title,
    mode === "reset" ? null : total >= cur.payable ? "Đã thanh toán đủ cho bên này" : `Còn phải trả ${formatPrice(cur.payable - total)}`,
    await sessionName(),
  );
  revalidateDetail(id);
  return { ok: true, message: mode === "reset" ? "Đã đặt lại về 0" : "Đã ghi nhận thanh toán cho nhà cung cấp" };
}

/**
 * SỬA TAY số tiền PHẢI TRẢ cho nhà cung cấp của một đơn (side: room | bus) — dùng khi hệ thống tính
 * chưa đúng (thoả thuận riêng, lễ tết…). mode=auto ⇒ bỏ số sửa tay, quay về hệ thống tự tính.
 * Số sửa tay được dùng ở mọi nơi: chi tiết đơn, trang chủ dịch vụ, báo cáo thanh toán. Chỉ ADMIN.
 */
export async function setSupplierPayable(
  _prev: BookingActionState,
  formData: FormData,
): Promise<BookingActionState> {
  const id = String(formData.get("id") ?? "");
  const side = String(formData.get("side") ?? "");
  const mode = String(formData.get("mode") ?? "set");
  const label = String(formData.get("label") ?? "").slice(0, 120) || (side === "bus" ? "nhà xe" : "nhà cung cấp");
  if (!id || (side !== "room" && side !== "bus")) return { error: "Dữ liệu không hợp lệ." };
  const session = await getSession();
  if (session?.role !== "ADMIN") return { error: "Chỉ admin sửa số tiền phải trả cho nhà cung cấp." };

  const b = await prisma.bookingRequest.findUnique({ where: { id } });
  if (!b) return { error: "Không tìm thấy yêu cầu." };
  const [roomDisc, busDisc] = await Promise.all([resolveRoomCommissions([b]), resolveBusCommissions([b])]);
  const cur = supplierPayouts(b, roomDisc.get(id) ?? 0, busDisc.get(id) ?? 0).find((s) => s.side === side);
  if (!cur) return { error: "Đơn này không có phần tiền của bên đó." };

  let value: number | null;
  let title: string;
  if (mode === "auto") {
    if (!cur.overridden) return { error: "Số phải trả đang do hệ thống tự tính." };
    value = null;
    title = `Bỏ số phải trả sửa tay của ${label}: ${formatPrice(cur.payable)} → hệ thống tính ${formatPrice(cur.autoPayable)}`;
  } else {
    const amount = money(formData.get("amount"));
    if (amount == null) return { error: "Nhập số tiền phải trả." };
    if (amount === cur.payable) return { error: "Số phải trả không đổi." };
    value = amount;
    title = `Sửa số phải trả ${label}: ${formatPrice(cur.payable)} → ${formatPrice(amount)}`;
  }
  const next = value ?? cur.autoPayable;

  const r = await prisma.bookingRequest.updateMany({
    where: { id, updatedAt: b.updatedAt },
    data: side === "room" ? { payableRoomOverride: value } : { payableBusOverride: value },
  });
  if (r.count === 0) return { error: "Đơn vừa được cập nhật ở nơi khác — tải lại trang rồi thử lại." };
  await log(
    prisma, id, "SUPPLIER", title,
    cur.paid > next
      ? `Lưu ý: đã trả ${formatPrice(cur.paid)}, nhiều hơn số phải trả mới ${formatPrice(cur.paid - next)}`
      : value != null ? `Hệ thống tự tính: ${formatPrice(cur.autoPayable)}` : null,
    await sessionName(),
  );
  revalidateDetail(id);
  return { ok: true, message: value == null ? "Đã quay về số hệ thống tự tính" : `Đã sửa số phải trả thành ${formatPrice(value)}` };
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

/**
 * THÊM / XOÁ PHỤ THU (ADMIN & chủ dịch vụ của đơn). referencePrice ĐÃ GỒM phụ thu ⇒ thêm
 * thì cộng, xoá thì trừ (combo: cộng/trừ cả phần tiền của bên được chọn) — nhờ vậy "còn
 * thiếu", thanh toán, báo cáo… tự đúng mà không phải sửa nơi khác.
 */
export async function saveBookingSurcharge(
  _prev: BookingActionState,
  formData: FormData,
): Promise<BookingActionState> {
  const id = String(formData.get("id") ?? "");
  const op = String(formData.get("op") ?? "add");
  if (!id) return { error: "Thiếu mã đơn." };
  const role = await canManage(id);
  if (!role) return { error: "Không có quyền thao tác đơn này." };
  const b = await prisma.bookingRequest.findUnique({
    where: { id },
    select: {
      category: true,
      referencePrice: true,
      roomAmount: true,
      busAmount: true,
      surcharges: true,
      amountCollected: true,
      paymentStatus: true,
      updatedAt: true,
    },
  });
  if (!b) return { error: "Không tìm thấy đơn." };
  const list = parseSurcharges(b.surcharges);
  const isCombo = b.category === "COMBO";
  // Combo do sàn điều phối (tách tiền 2 bên) ⇒ chỉ admin chỉnh phụ thu.
  if (isCombo && role !== "ADMIN") return { error: "Đơn combo do sàn điều phối — liên hệ admin để thêm phụ thu." };
  const price = toNumber(b.referencePrice);

  let item: BookingSurcharge;
  let next: BookingSurcharge[];
  let sign: 1 | -1;
  if (op === "remove") {
    const sid = String(formData.get("sid") ?? "");
    const found = list.find((s) => s.id === sid);
    if (!found) return { error: "Không tìm thấy khoản phụ thu." };
    item = found;
    next = list.filter((s) => s.id !== sid);
    sign = -1;
  } else {
    // Chưa có giá ⇒ cộng phụ thu sẽ biến tổng thành chỉ tiền phụ thu (sai) ⇒ bắt nhập giá trước.
    if (price == null) return { error: "Đơn chưa có giá — sửa thông tin đơn để nhập giá trước khi thêm phụ thu." };
    const label = String(formData.get("label") ?? "").trim().slice(0, 120) || "Phụ thu";
    const amount = money(formData.get("amount"));
    if (!amount) return { error: "Nhập số tiền phụ thu." };
    const sideRaw = String(formData.get("side") ?? "");
    const side = isCombo ? (sideRaw === "bus" ? "bus" : "room") : undefined;
    item = { id: Math.random().toString(36).slice(2, 10), label, amount, ...(side ? { side } : {}) };
    next = [...list, item];
    sign = 1;
  }

  const delta = sign * item.amount;
  // null giữ nguyên null: đơn chưa có giá / combo cũ chưa tách tiền 2 bên không bị ghi
  // thành "chỉ tiền phụ thu" (comboSideView sẽ hiểu sai phần tiền của bên đó).
  const bump = (v: unknown) => {
    const n = toNumber(v as never);
    return n == null ? undefined : Math.max(0, n + delta);
  };
  const newPrice = bump(b.referencePrice);
  // Đồng bộ trạng thái thanh toán theo tổng mới (cùng quy tắc recordBookingPayment):
  // đã thu đủ mà thêm phụ thu ⇒ về "Đã cọc"; xoá phụ thu làm số đã thu ≥ tổng ⇒ "Đã thu đủ".
  const collected = toNumber(b.amountCollected) ?? 0;
  let payData: Prisma.BookingRequestUpdateInput = {};
  if (newPrice != null && collected > 0) {
    const full = collected >= newPrice;
    if (full && b.paymentStatus !== "PAID") payData = { paymentStatus: "PAID", paidAt: new Date() };
    if (!full && b.paymentStatus === "PAID") payData = { paymentStatus: "DEPOSITED", paidAt: null };
  }
  const data: Prisma.BookingRequestUpdateInput = {
    surcharges: next as unknown as Prisma.InputJsonValue,
    ...(newPrice !== undefined ? { referencePrice: newPrice } : {}),
    ...(isCombo && item.side === "bus" && bump(b.busAmount) !== undefined ? { busAmount: bump(b.busAmount) } : {}),
    ...(isCombo && item.side !== "bus" && item.side !== "extra" && bump(b.roomAmount) !== undefined ? { roomAmount: bump(b.roomAmount) } : {}),
    ...payData,
  };
  const sideTxt = isCombo ? (item.side === "bus" ? " (nhà xe)" : item.side === "extra" ? " (dịch vụ thêm)" : " (homestay)") : "";
  try {
    await prisma.$transaction(async (tx) => {
      // Khoá lạc quan theo updatedAt: 2 thao tác cùng lúc không đè mất phụ thu của nhau.
      const r = await tx.bookingRequest.updateMany({ where: { id, updatedAt: b.updatedAt }, data: data as Prisma.BookingRequestUpdateManyMutationInput });
      if (r.count === 0) throw new Error("Đơn vừa được cập nhật ở nơi khác — tải lại trang rồi thử lại.");
      await log(
      tx,
      id,
      "SYSTEM",
      sign > 0 ? "Thêm phụ thu" : "Xoá phụ thu",
      `${item.label}${sideTxt}: ${sign > 0 ? "+" : "−"}${formatPrice(item.amount)}` +
        (payData.paymentStatus === "DEPOSITED" ? " · chuyển về Đã cọc (còn thiếu tiền phụ thu)" : ""),
      await sessionName(),
    );
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Có lỗi xảy ra." };
  }
  revalidateDetail(id);
  return { ok: true, message: sign > 0 ? `Đã thêm phụ thu ${formatPrice(item.amount)}` : "Đã xoá phụ thu" };
}

/**
 * SỬA THÔNG TIN ĐƠN (chỉ ADMIN): khách (tên/SĐT/Facebook/ghi chú), ngày, số khách,
 * mô tả lựa chọn, giá (+ tách tiền phòng/xe của combo). Đơn ĐANG GIỮ CHỖ mà đổi ngày/số
 * lượng ⇒ trả chỗ theo thông tin cũ rồi giữ lại theo thông tin mới trong cùng transaction
 * (không đủ chỗ ⇒ báo lỗi, không lưu gì). Ghi nhật ký các trường đã đổi.
 */
export async function updateBookingInfo(
  _prev: BookingActionState,
  formData: FormData,
): Promise<BookingActionState> {
  const session = await getSession();
  if (session?.role !== "ADMIN") return { error: "Chỉ admin được sửa thông tin đơn." };
  const id = String(formData.get("id") ?? "");
  const get = (k: string) => String(formData.get(k) ?? "").trim();

  const customerName = get("customerName").slice(0, 120);
  const phone = get("phone");
  const customerFacebook = normalizeFacebookUrl(get("customerFacebook"));
  const useDateKey = get("useDate");
  const endDateKey = get("endDate");
  const quantity = parseInt(get("quantity"), 10);
  if (!customerName) return { error: "Nhập tên khách." };
  if (!/^[0-9+().\s-]{8,15}$/.test(phone)) return { error: "Số điện thoại không hợp lệ." };
  if (customerFacebook === undefined) return { error: "Link Facebook không hợp lệ." };
  if (!isValidDateKey(useDateKey)) return { error: "Ngày sử dụng không hợp lệ." };
  if (endDateKey && (!isValidDateKey(endDateKey) || endDateKey < useDateKey)) {
    return { error: "Ngày kết thúc phải từ ngày bắt đầu trở đi." };
  }
  if (!Number.isFinite(quantity) || quantity < 1 || quantity > 500) return { error: "Số lượng không hợp lệ." };

  const b = await prisma.bookingRequest.findUnique({ where: { id } });
  if (!b) return { error: "Không tìm thấy đơn." };

  const useDate = parseDateOnly(useDateKey);
  const endDate = endDateKey && endDateKey !== useDateKey ? parseDateOnly(endDateKey) : null;
  const isStay = Boolean(b.roomTypeId);
  // Lưu trú không có ngày trả = 1 đêm (giữ phòng cũng tính useDate+1) — trước đây giữ số đêm cũ.
  const nights = isStay ? (endDate ? enumerateNights(useDate, endDate).length : 1) : b.nights;
  // Homestay (đặt theo phòng): quantity = 1 phòng, số khách nằm ở adults.
  const qtyData = isStay && b.category !== "COMBO" ? { adults: quantity } : { quantity, ...(b.adults != null ? { adults: quantity } : {}) };
  // Cabin / combo giữ chỗ theo seatsSingle (số người đi xe). CHỈ đổi khi số khách đổi, và dời theo
  // ĐỘ CHÊNH (combo tự chọn có thể ít vé hơn khách — giữ nguyên khoảng chênh khách–vé); cập nhật luôn
  // cabinShared/cabinSolo vì bookingBusSeats ưu tiên 2 cột này (lịch vé, tin nhắn nhà xe).
  const seatsData: { seatsSingle?: number; cabinShared?: number; cabinSolo?: number } = {};
  if (b.cabinTripId && b.seatsDouble === 0 && quantity !== b.quantity) {
    const oldSeats = b.seatsSingle ?? b.quantity;
    const newSeats = Math.max(1, oldSeats + (quantity - b.quantity));
    seatsData.seatsSingle = newSeats;
    if (b.cabinShared != null || b.cabinSolo != null) {
      let shared = Math.max(0, b.cabinShared ?? 0);
      let solo = Math.max(0, b.cabinSolo ?? 0);
      const d = newSeats - (shared + solo);
      if (d > 0) shared += d; // khách thêm mặc định nằm ghép (giá do admin nhập ở ô Giá)
      else if (d < 0) {
        const cut = Math.min(shared, -d);
        shared -= cut;
        solo = Math.max(0, solo - (-d - cut));
      }
      seatsData.cabinShared = shared;
      seatsData.cabinSolo = solo;
    }
  }
  // Chiết khấu nhà xe tính theo đầu khách ⇒ đổi số khách thì quy đổi tỉ lệ theo snapshot cũ.
  const oldBusComm = toNumber(b.busCommission);
  const busCommData =
    oldBusComm != null && b.cabinTripId && b.quantity > 0 && b.quantity !== quantity
      ? { busCommission: Math.round((oldBusComm / b.quantity) * quantity) }
      : {};

  const data: Prisma.BookingRequestUpdateInput = {
    customerName,
    phone,
    customerFacebook,
    note: get("note").slice(0, 2000) || null,
    selectionLabel: get("selectionLabel").slice(0, 1000) || null,
    useDate,
    endDate,
    nights,
    ...qtyData,
    ...seatsData,
    ...busCommData,
    referencePrice: money(formData.get("referencePrice")),
    ...(b.category === "COMBO"
      ? { roomAmount: money(formData.get("roomAmount")), busAmount: money(formData.get("busAmount")) }
      : {}),
  };

  // Các trường đổi → nhật ký. So ngày bằng KHOÁ yyyy-mm-dd (form gửi key, DB là Date) — trước đây
  // so dmy với key nên lần lưu nào cũng tính là "đổi ngày" ⇒ nhả rồi giữ lại tồn + nhật ký giả (BK-4).
  const oldUseKey = toDateKey(b.useDate);
  const oldEndKey = b.endDate ? toDateKey(b.endDate) : "";
  const newEndKey = endDate ? endDateKey : "";
  const changes: string[] = [];
  const diff = (label: string, a: unknown, c: unknown) => {
    if (String(a ?? "") !== String(c ?? "")) changes.push(`${label}: ${a ?? "—"} → ${c ?? "—"}`);
  };
  diff("Tên", b.customerName, customerName);
  diff("SĐT", b.phone, phone);
  diff("Facebook", b.customerFacebook, customerFacebook);
  diff("Ngày", dmy(oldUseKey), dmy(useDateKey));
  diff("Đến ngày", oldEndKey ? dmy(oldEndKey) : "—", newEndKey ? dmy(newEndKey) : "—");
  diff("Số lượng", isStay && b.category !== "COMBO" ? b.adults : b.quantity, quantity);
  if (seatsData.seatsSingle !== undefined) diff("Số người đi xe", b.seatsSingle ?? b.quantity, seatsData.seatsSingle);
  diff("Lựa chọn", b.selectionLabel, data.selectionLabel);
  diff("Ghi chú", b.note, data.note);
  diff("Giá", toNumber(b.referencePrice), data.referencePrice);
  if (b.category === "COMBO") {
    diff("Tiền phòng", toNumber(b.roomAmount), data.roomAmount);
    diff("Tiền xe", toNumber(b.busAmount), data.busAmount);
  }
  if (changes.length === 0) return { ok: true, message: "Không có thay đổi" };

  const inventoryChanged =
    b.inventoryApplied &&
    (oldUseKey !== useDateKey ||
      oldEndKey !== newEndKey ||
      (!isStay && b.quantity !== quantity) ||
      (b.cabinTripId != null && seatsData.seatsSingle !== undefined && seatsData.seatsSingle !== (b.seatsSingle ?? b.quantity)));

  try {
    await prisma.$transaction(async (tx) => {
      // Khoá đơn + kiểm đơn chưa bị đổi từ lúc đọc (vd vừa xác nhận / huỷ ở tab khác): `b` và
      // `inventoryChanged` tính từ bản đọc NGOÀI transaction, lệch ⇒ trả/giữ tồn sai (BK-3).
      await lockBooking(tx, id);
      const cur = await tx.bookingRequest.findUnique({ where: { id }, select: { updatedAt: true } });
      if (!cur || cur.updatedAt.getTime() !== b.updatedAt.getTime()) {
        throw new Error("Đơn vừa được cập nhật ở nơi khác — tải lại trang rồi sửa lại.");
      }
      if (inventoryChanged) {
        // Trả chỗ theo thông tin CŨ…
        if (b.roomTypeId) await assignRoomsForBooking(tx, b, false);
        if (b.cabinTripId || b.rentalVehicleId) await adjustInventory(tx, b, +1);
      }
      const nb = await tx.bookingRequest.update({ where: { id }, data });
      if (inventoryChanged) {
        // …rồi giữ lại theo thông tin MỚI (thiếu chỗ ⇒ throw ⇒ rollback toàn bộ).
        if (nb.roomTypeId) await assignRoomsForBooking(tx, nb, true);
        if (nb.cabinTripId || nb.rentalVehicleId) await adjustInventory(tx, nb, -1);
      }
      await log(tx, id, "SYSTEM", "Sửa thông tin đơn", changes.join("\n"), await sessionName());
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Có lỗi xảy ra." };
  }
  revalidateDetail(id);
  return { ok: true, message: inventoryChanged ? "Đã lưu & giữ chỗ lại theo ngày mới" : "Đã lưu thông tin đơn" };
}

/** Admin PHÂN xe máy thuê kèm combo cho một nhà xe (khối "Xe máy thuê kèm" ở trang chi tiết đơn). */
export async function assignComboBike(_prev: BookingActionState, formData: FormData): Promise<BookingActionState> {
  const session = await getSession();
  if (session?.role !== "ADMIN") return { error: "Chỉ admin được phân nhà xe." };
  const id = String(formData.get("id") ?? "");
  const serviceId = String(formData.get("bikeServiceId") ?? "");
  if (!serviceId) return { error: "Chọn nhà xe để phân." };
  const r = await assignComboBikeService(id, serviceId, await sessionName());
  if ("error" in r) return { error: r.error };
  revalidatePath("/admin/provider/xe");
  revalidateDetail(id);
  return {
    ok: true,
    message: r.assigned < r.need ? `Đã phân cho ${r.title}: mới xếp được ${r.assigned}/${r.need} xe` : `Đã phân ${r.assigned} xe cho ${r.title} · chờ nhà xe duyệt`,
  };
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

  let code = generateBookingCode(b.category);
  for (let i = 0; i < 5; i++) {
    if (!(await prisma.bookingRequest.findUnique({ where: { code } }))) break;
    code = generateBookingCode(b.category);
  }
  const copy = await prisma.bookingRequest.create({
    data: {
      code,
      category: b.category,
      serviceId: b.serviceId,
      serviceTitle: b.serviceTitle,
      customerName: b.customerName,
      phone: b.phone,
      customerFacebook: b.customerFacebook,
      note: b.note,
      useDate: b.useDate,
      endDate: b.endDate,
      nights: b.nights,
      quantity: b.quantity,
      adults: b.adults,
      childrenAges: b.childrenAges,
      roomTypeId: b.roomTypeId,
      roomId: b.roomId,
      roomIds: b.roomIds, // combo ghép nhiều phòng — thiếu thì bản sao chỉ giữ 1 phòng
      cabinTripId: b.cabinTripId,
      cabinReturnTripId: b.cabinReturnTripId,
      seatsSingle: b.seatsSingle,
      seatsDouble: b.seatsDouble,
      rentalVehicleId: b.rentalVehicleId,
      selectionLabel: b.selectionLabel,
      referencePrice: b.referencePrice,
      roomAmount: b.roomAmount,
      busAmount: b.busAmount,
      surcharges: b.surcharges ?? [], // giá nhân bản đã gồm phụ thu ⇒ mang theo danh sách để khớp
      ctvId: b.ctvId,
      commissionAmount: b.commissionAmount,
      roomCommission: b.roomCommission,
      busCommission: b.busCommission,
      needsConfirmation: true,
    },
  });
  await log(prisma, copy.id, "SYSTEM", "Nhân bản từ đơn " + b.code, null, await sessionName());
  revalidatePath("/admin/bookings");
  redirect(`/admin/bookings/${copy.id}`);
}

/**
 * Xoá hẳn MỘT đơn mà không để lại chỗ giữ mồ côi (BK-1). RoomDayStatus.bookingId / RoomStay.bookingId
 * không có FK (không cascade), FleetRental chỉ SetNull ⇒ xoá thẳng sẽ để lại ô PENDING chủ nhà giữ hộ,
 * lượt ở còn sống trên sơ đồ phòng và lượt thuê xe thành "tạo tay" vẫn giữ xe.
 * Cách làm: trả tồn + chuyển đơn sang Huỷ ⇒ gọi đồng bộ lượt ở / đội xe (như mọi luồng huỷ khác:
 * huỷ lượt ở chưa nhận phòng, nhả xe chưa giao) ⇒ dọn nốt ô lịch còn gắn đơn rồi mới xoá.
 * Bước đồng bộ lỗi ⇒ ném ra, đơn còn ở trạng thái Huỷ (không giữ gì), xoá lại sau được.
 * Trả false nếu đơn không tồn tại. Đơn KHÔNG được xoá (ném PurgeBlocked, không đổi gì):
 *  - đã Hoàn thành: xoá làm mất doanh thu báo cáo (sàn + Quản lý phòng) ⇒ huỷ trước hoặc giữ đơn;
 *  - có lượt ở ĐÃ nhận phòng: huỷ lượt ở / xoá ô BOOKED của khách đang ở làm phòng hiện trống sai.
 */
class PurgeBlocked extends Error {}

async function purgeBooking(id: string): Promise<boolean> {
  const found = await prisma.$transaction(async (tx) => {
    await lockBooking(tx, id); // chống 2 lần xác nhận/xoá song song cùng trả tồn (BK-3)
    const booking = await tx.bookingRequest.findUnique({ where: { id } });
    if (!booking) return false;
    if (booking.status === "COMPLETED") {
      throw new PurgeBlocked(`Đơn ${booking.code} đã hoàn thành — không xoá để giữ doanh thu báo cáo (huỷ trước hoặc giữ đơn).`);
    }
    if (await tx.roomStay.count({ where: { bookingId: id, checkedInAt: { not: null } } })) {
      throw new PurgeBlocked(`Đơn ${booking.code} có lượt ở khách đã nhận phòng — không xoá được (giữ đơn để còn lịch phòng & doanh thu).`);
    }
    if (booking.inventoryApplied) {
      if (booking.roomTypeId) await assignRoomsForBooking(tx, booking, false);
      if (booking.cabinTripId || booking.rentalVehicleId) await adjustInventory(tx, booking, +1);
    }
    if (booking.status !== "CANCELLED" || booking.inventoryApplied || booking.heldRoom) {
      await tx.bookingRequest.update({
        where: { id },
        data: { status: "CANCELLED", inventoryApplied: false, heldRoom: false, needsConfirmation: false },
      });
    }
    return true;
  });
  if (!found) return false;
  await syncStaysForBooking(id);
  await syncFleetForBooking(id);
  await prisma.$transaction(async (tx) => {
    await lockBooking(tx, id);
    // Ô còn gắn đơn (kể cả PENDING, phòng nằm ngoài phạm vi đồng bộ) ⇒ xoá + tính lại tồn từng hạng/đêm.
    const cells = await tx.roomDayStatus.findMany({
      where: { bookingId: id },
      select: { date: true, room: { select: { roomTypeId: true } } },
    });
    if (cells.length) {
      await tx.roomDayStatus.deleteMany({ where: { bookingId: id } });
      const pairs = new Map<string, { tid: string; date: Date }>();
      for (const c of cells) pairs.set(`${c.room.roomTypeId}|${toDateKey(c.date)}`, { tid: c.room.roomTypeId, date: c.date });
      for (const p of pairs.values()) await syncRoomTypeAvailability(p.tid, p.date, tx);
    }
    await tx.bookingRequest.deleteMany({ where: { id } });
  });
  return true;
}

/** XOÁ HẲN yêu cầu (chỉ ADMIN): trả tồn kho, nhả lượt ở / xe / ô lịch của đơn rồi xoá. */
export async function deleteBooking(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const session = await getSession();
  if (!id || session?.role !== "ADMIN") return;
  try {
    await purgeBooking(id);
  } catch (err) {
    if (!(err instanceof PurgeBlocked)) throw err;
    // Nút xoá là form thường (không có toast) ⇒ ghi lý do vào lịch sử đơn để admin thấy, ở lại trang đơn.
    await log(prisma, id, "SYSTEM", "Không xoá được đơn", err.message, await sessionName());
    revalidateDetail(id);
    return;
  }
  for (const p of REVALIDATE) revalidatePath(p);
  revalidatePath("/admin/provider/phong");
  revalidatePath("/admin/provider/xe");
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
  const blocked: string[] = [];
  for (const id of ids.slice(0, 100).map(String)) {
    try {
      if (await purgeBooking(id)) done++;
    } catch (err) {
      if (err instanceof PurgeBlocked) blocked.push(err.message);
      /* đơn lỗi khác ⇒ bỏ qua, đếm theo done */
    }
  }

  const more = blocked.length > 5 ? `\n… và ${blocked.length - 5} đơn khác` : "";
  const blockedNote = blocked.length ? `\n\n${blocked.slice(0, 5).join("\n")}${more}` : "";
  if (done === 0) return { error: "Không xoá được đơn nào." + blockedNote };
  revalidatePath("/admin/provider/phong");
  revalidatePath("/admin/provider/xe");
  for (const p of REVALIDATE) revalidatePath(p);
  if (blocked.length) return { ok: true, message: `Đã xoá ${done} đơn; ${blocked.length} đơn được giữ lại.` + blockedNote };
  return { ok: true, message: done === 1 ? "Đã xoá 1 đơn" : `Đã xoá ${done} đơn` };
}

export async function updateBookingStatus(
  _prev: BookingActionState,
  formData: FormData,
): Promise<BookingActionState> {
  await requireAdmin();
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
      await lockBooking(tx, id); // chống 2 lần xác nhận song song cùng trừ tồn (BK-3)
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
        data: {
          status,
          adminNote: adminNote ?? null,
          inventoryApplied,
          needsConfirmation: status === "NEW" ? booking.needsConfirmation : false,
        },
      });
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Có lỗi xảy ra." };
  }

  void sendConfirmEmailIfDue(id);
  void syncFleetForBooking(id).catch(() => {}); void syncStaysForBooking(id).catch(() => {}); // đơn xe máy: đồng bộ đội xe (huỷ ⇒ nhả xe)
  revalidatePath("/admin/bookings");
  revalidatePath(`/admin/bookings/${id}`);
  revalidatePath("/admin/inventory");
  revalidatePath("/admin/availability");
  return { ok: true };
}

/** Lưu số giờ tự huỷ đơn chưa thanh toán (0 = tắt). Chỉ ADMIN. */
export async function saveAutoCancelHours(
  _prev: { ok?: boolean; error?: string; message?: string },
  fd: FormData,
): Promise<{ ok?: boolean; error?: string; message?: string }> {
  await requireAdmin();
  const raw = String(fd.get("hours") ?? "").trim().replace(",", ".");
  const n = Number(raw);
  if (raw === "" || !Number.isFinite(n) || n < 0 || n > MAX_AUTO_CANCEL_HOURS) {
    return { error: `Nhập số giờ từ 0 đến ${MAX_AUTO_CANCEL_HOURS} (0 = tắt tự huỷ).` };
  }
  const value = String(Math.round(n * 2) / 2);
  await prisma.siteSetting.upsert({ where: { key: AUTO_CANCEL_HOURS_KEY }, create: { key: AUTO_CANCEL_HOURS_KEY, value }, update: { value } });
  updateTag("settings");
  revalidatePath("/admin/bookings");
  revalidatePath("/tra-cuu");
  return { ok: true, message: value === "0" ? "Đã tắt tự huỷ theo thời gian." : `Đơn chưa thanh toán sẽ tự huỷ sau ${value.replace(".", ",")} giờ.` };
}

/** Tin nhắn mẫu của một đơn (khách / chốt đơn / chủ dịch vụ) cho ngăn "Xử lý nhanh" — chỉ admin. */
export async function getBookingMessages(id: string): Promise<BookingMessages | null> {
  await requireAdmin();
  return bookingMessagesById(id);
}

/**
 * Chọn AI THU TIỀN KHÁCH của một đơn: "PLATFORM" (sàn thu) | "PROVIDER" (chủ dịch vụ thu). Chỉ ADMIN,
 * không áp cho đơn combo (combo do sàn điều phối & thu).
 */
export async function setBookingCollector(_prev: BookingActionState, formData: FormData): Promise<BookingActionState> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const collector = formData.get("collector") === "PROVIDER" ? "PROVIDER" : "PLATFORM";
  const b = await prisma.bookingRequest.findUnique({ where: { id }, select: { category: true, collector: true } });
  if (!b) return { error: "Không tìm thấy yêu cầu." };
  if (b.category === "COMBO") return { error: "Đơn combo do sàn thu — không đổi được." };
  if (b.collector === collector) return { ok: true, message: "Không có thay đổi." };
  await prisma.bookingRequest.update({ where: { id }, data: { collector } });
  await log(prisma, id, "PAYMENT", "Đổi bên thu tiền khách", collector === "PROVIDER" ? "Chủ dịch vụ thu của khách, chuyển lại sàn phần chiết khấu" : "Sàn thu của khách, chuyển chủ dịch vụ phần thực nhận", await sessionName());
  revalidateDetail(id);
  return { ok: true, message: collector === "PROVIDER" ? "Đã đặt: chủ dịch vụ thu tiền khách" : "Đã đặt: sàn thu tiền khách" };
}

/**
 * CHỦ DỊCH VỤ (hoặc admin) nhập TIỀN THU THÊM của khách ở một đơn (vd khách trả xe quá giờ). Lưu thành một
 * khoản phụ thu cố định (id PROVIDER_EXTRA_ID): cộng vào giá đơn và vào số đã thu (chủ dịch vụ đã cầm tiền),
 * chịu chiết khấu cùng tỉ lệ với đơn. Nhập 0 = xoá. Chỉ đơn đã xác nhận / hoàn thành, không phải combo.
 */
export async function saveProviderExtra(_prev: BookingActionState, formData: FormData): Promise<BookingActionState> {
  const id = String(formData.get("id") ?? "");
  const amount = money(formData.get("amount")) ?? 0;
  if (!id) return { error: "Thiếu mã đơn." };
  const role = await canManage(id);
  if (!role) return { error: "Không có quyền thao tác đơn này." };
  if (amount > 50_000_000) return { error: "Số tiền quá lớn." };
  const b = await prisma.bookingRequest.findUnique({
    where: { id },
    select: { category: true, status: true, referencePrice: true, amountCollected: true, paymentStatus: true, surcharges: true, updatedAt: true },
  });
  if (!b) return { error: "Không tìm thấy yêu cầu." };
  if (b.category === "COMBO") return { error: "Đơn combo do sàn điều phối — không nhập thu thêm ở đây." };
  if (b.status !== "CONFIRMED" && b.status !== "COMPLETED") return { error: "Chỉ nhập thu thêm khi đơn đã xác nhận." };

  const list = parseSurcharges(b.surcharges);
  const old = list.find((s) => s.id === PROVIDER_EXTRA_ID)?.amount ?? 0;
  const delta = amount - old;
  if (delta === 0) return { ok: true, message: "Không có thay đổi." };
  const next: BookingSurcharge[] = [
    ...list.filter((s) => s.id !== PROVIDER_EXTRA_ID),
    ...(amount > 0 ? [{ id: PROVIDER_EXTRA_ID, label: PROVIDER_EXTRA_LABEL, amount }] : []),
  ];
  const price = Math.max(0, (toNumber(b.referencePrice) ?? 0) + delta);
  const collected = Math.max(0, (toNumber(b.amountCollected) ?? 0) + delta); // chủ dịch vụ đã cầm khoản này
  const full = price > 0 && collected >= price;
  const r = await prisma.bookingRequest.updateMany({
    where: { id, updatedAt: b.updatedAt },
    data: {
      surcharges: next as unknown as Prisma.InputJsonValue,
      referencePrice: price,
      amountCollected: collected,
      paymentStatus: collected <= 0 ? "UNPAID" : full ? "PAID" : "DEPOSITED",
      paidAt: full ? new Date() : null,
    },
  });
  if (r.count === 0) return { error: "Đơn vừa được cập nhật ở nơi khác — tải lại trang rồi thử lại." };
  await log(prisma, id, "PAYMENT", "Chủ dịch vụ thu thêm của khách", amount > 0 ? `${formatPrice(amount)}${old > 0 ? ` (trước đó ${formatPrice(old)})` : ""}` : `Xoá khoản thu thêm ${formatPrice(old)}`, await sessionName());
  revalidateDetail(id);
  for (const p of REVALIDATE) revalidatePath(p);
  return { ok: true, message: amount > 0 ? `Đã ghi thu thêm ${formatPrice(amount)}` : "Đã xoá khoản thu thêm" };
}

/** Xoá một ảnh uỷ nhiệm chi (tải nhầm). Không đổi số tiền đã trả. Chỉ ADMIN. */
export async function deletePayoutProof(proofId: string): Promise<BookingActionState> {
  const session = await getSession();
  if (session?.role !== "ADMIN") return { error: "Chỉ admin xoá chứng từ thanh toán." };
  const p = await prisma.supplierPayoutProof.findUnique({ where: { id: proofId } });
  if (!p) return { error: "Ảnh đã bị xoá." };
  await prisma.supplierPayoutProof.delete({ where: { id: proofId } });
  if (p.side === "customer") await log(prisma, p.bookingId, "PAYMENT", "Xoá ảnh chuyển khoản của khách", null, await sessionName());
  else await log(prisma, p.bookingId, "SUPPLIER", `Xoá ảnh uỷ nhiệm chi (${p.side === "bus" ? "nhà xe" : "nhà cung cấp"})`, null, await sessionName());
  revalidatePath(`/admin/bookings/${p.bookingId}`);
  return { ok: true, message: "Đã xoá ảnh" };
}
