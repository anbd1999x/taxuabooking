import "server-only";
import { prisma } from "./prisma";
import { toNumber } from "./format";

/**
 * Số tiền hoa hồng CỐ ĐỊNH cho một đơn do CTV đặt.
 * Thứ tự ưu tiên: Service.ctvCommission (ghi đè theo dịch vụ) ?? CTV.commissionPerOrder (mặc định) ?? 0.
 * Không có CTV ⇒ 0. Trả về number (đồng) để snapshot vào BookingRequest.commissionAmount.
 */
export async function resolveCommission(
  serviceId: string | null | undefined,
  ctvId: string | null | undefined,
): Promise<number> {
  if (!ctvId) return 0;
  const [svc, ctv] = await Promise.all([
    serviceId
      ? prisma.service.findUnique({ where: { id: serviceId }, select: { ctvCommission: true } })
      : Promise.resolve(null),
    prisma.adminUser.findUnique({ where: { id: ctvId }, select: { commissionPerOrder: true } }),
  ]);
  return pickCommission(svc?.ctvCommission, ctv?.commissionPerOrder);
}

/** Chọn mức hoa hồng từ giá trị đã tải sẵn (tránh query lại khi đã có service/ctv). */
export function pickCommission(serviceOverride: unknown, ctvDefault: unknown): number {
  const override = toNumber(serviceOverride as never);
  if (override != null) return override;
  return toNumber(ctvDefault as never) ?? 0;
}
