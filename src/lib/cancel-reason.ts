/**
 * Lý do huỷ "HẾT PHÒNG": đơn chưa xác nhận bị hệ thống tự huỷ vì lịch đồng bộ của chủ nhà (sheet / API)
 * cho thấy phòng khách chọn đã có người khác đặt (xem cancelBookingsBlockedBySheet). File thuần, dùng được ở client.
 */
export const SOLD_OUT_PREFIX = "Hết phòng";

/** Câu lý do lưu vào đơn — LUÔN bắt đầu bằng SOLD_OUT_PREFIX để nhận diện ở danh sách / trang tra cứu. */
export function soldOutReason(roomName: string, nightDmy: string): string {
  return `${SOLD_OUT_PREFIX}: phòng "${roomName}" đã có khách khác đặt đêm ${nightDmy} (theo lịch đồng bộ của chủ nhà)`;
}

/** Đơn bị huỷ vì hết phòng? (gồm cả câu lý do kiểu cũ, trước khi có tiền tố). */
export function isSoldOutCancel(reason: string | null | undefined): boolean {
  if (!reason) return false;
  return reason.startsWith(SOLD_OUT_PREFIX) || /đã có khách (khác )?đặt đêm/.test(reason);
}
