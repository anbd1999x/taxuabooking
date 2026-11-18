import { prisma } from "@/lib/prisma";

/**
 * Giá gạch/ngày (RentalVehicle.listPrice) của các loại xe mà những đơn XE MÁY này đặt —
 * dùng với `rentalOriginalTotal` để tính tiền gốc của đơn. Trả Map<rentalVehicleId, giá gạch>.
 */
export async function rentalListPriceMap(
  bookings: { category: string; rentalVehicleId: string | null }[],
): Promise<Map<string, number>> {
  const ids = [...new Set(bookings.filter((b) => b.category === "MOTORBIKE" && b.rentalVehicleId).map((b) => b.rentalVehicleId!))];
  if (!ids.length) return new Map();
  const rows = await prisma.rentalVehicle.findMany({
    where: { id: { in: ids }, listPrice: { not: null } },
    select: { id: true, listPrice: true },
  });
  return new Map(rows.map((r) => [r.id, Number(r.listPrice)]));
}
