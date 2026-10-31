import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { OrdersTable } from "../page";

export const dynamic = "force-dynamic";

export default async function CtvOrders() {
  const session = await getSession();
  const bookings = await prisma.bookingRequest.findMany({
    where: { ctvId: session!.sub },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { service: { select: { title: true } } },
  });
  return (
    <div>
      <h1 className="text-2xl font-bold text-ink">Đơn của tôi</h1>
      <OrdersTable bookings={bookings} />
    </div>
  );
}
