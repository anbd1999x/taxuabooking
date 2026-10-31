import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { OrdersTable } from "../../ctv/page";

export const dynamic = "force-dynamic";

export default async function ProviderOrders() {
  const session = await getSession();
  const bookings = await prisma.bookingRequest.findMany({
    where: { service: { ownerId: session!.sub } },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { service: { select: { title: true } } },
  });
  return (
    <div>
      <h1 className="text-2xl font-bold text-ink">Đơn & thanh toán</h1>
      <p className="mt-1 text-sm text-gray-500">Trạng thái thanh toán do quản trị viên đối soát & cập nhật.</p>
      <OrdersTable bookings={bookings} />
    </div>
  );
}
