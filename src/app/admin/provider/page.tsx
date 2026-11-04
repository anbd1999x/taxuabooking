import Link from "next/link";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { toNumber, formatPrice } from "@/lib/format";
import { resolveRoomCommissions } from "@/lib/provider-commission";
import { OrdersTable } from "../ctv/page";

export const dynamic = "force-dynamic";

export default async function ProviderHome() {
  const session = await getSession();
  const ownerId = session!.sub;

  const [services, recent, all] = await Promise.all([
    prisma.service.findMany({ where: { ownerId }, select: { title: true } }),
    prisma.bookingRequest.findMany({
      where: { service: { ownerId } },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { service: { select: { title: true } } },
    }),
    prisma.bookingRequest.findMany({
      // Doanh thu chỉ tính đơn đã chốt (xác nhận / hoàn thành).
      where: { service: { ownerId }, status: { in: ["CONFIRMED", "COMPLETED"] } },
      select: { id: true, category: true, referencePrice: true, roomAmount: true, roomCommission: true, roomId: true, roomIds: true, useDate: true, endDate: true, amountCollected: true, paymentStatus: true },
    }),
  ]);
  // Chiết khấu hiệu lực mỗi đơn (snapshot, hoặc tính bù cho đơn cũ chưa backfill).
  const discMap = await resolveRoomCommissions(all);
  // Đơn combo: doanh thu phía homestay = PHẦN TIỀN PHÒNG (không gộp tiền vé xe);
  // coi là đã thu khi khách thanh toán đủ (tiền combo do Tà Xùa Booking thu).
  // Tiền chủ dịch vụ THỰC NHẬN = tiền bán ra − chiết khấu từng căn.
  const grossOf = (b: (typeof all)[number]) =>
    b.category === "COMBO" ? toNumber(b.roomAmount) ?? 0 : toNumber(b.referencePrice) ?? 0;
  const discOf = (b: (typeof all)[number]) => discMap.get(b.id) ?? 0;
  const netOf = (b: (typeof all)[number]) => Math.max(0, grossOf(b) - discOf(b));
  const total = all.reduce((n, b) => n + netOf(b), 0);
  const discount = all.reduce((n, b) => n + discOf(b), 0);
  const collected = all.reduce((n, b) => {
    const net = netOf(b);
    const raw = b.category === "COMBO" ? (b.paymentStatus === "PAID" ? net : 0) : toNumber(b.amountCollected) ?? 0;
    return n + Math.min(raw, net); // tiền đã thu quy về thực nhận, không vượt quá
  }, 0);

  return (
    <div>
      <h1 className="text-2xl font-bold text-ink">Xin chào, {session!.name}</h1>
      <p className="mt-1 text-sm text-gray-500">
        {services.length} dịch vụ của bạn. Doanh thu tính trên đơn đã giữ phòng/hoàn thành.
      </p>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Đơn đã chốt" value={String(all.length)} />
        <Stat label={discount > 0 ? "Thực nhận (sau chiết khấu)" : "Doanh thu"} value={formatPrice(total)} sub={discount > 0 ? `đã trừ chiết khấu ${formatPrice(discount)}` : undefined} />
        <Stat label="Đã thu" value={formatPrice(collected)} tone="ok" />
        <Stat label="Còn thiếu" value={formatPrice(Math.max(0, total - collected))} tone="warn" />
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/admin/provider/don" className="rounded-xl border border-forest-200 px-5 py-3 text-sm font-semibold text-forest-700 hover:bg-forest-50">Đơn & xác nhận</Link>
        <Link href="/admin/provider/thong-ke" className="rounded-xl border border-forest-200 px-5 py-3 text-sm font-semibold text-forest-700 hover:bg-forest-50">Thống kê chi tiết</Link>
      </div>

      <h2 className="mt-8 text-lg font-semibold text-ink">Đơn gần đây</h2>
      <OrdersTable bookings={recent} />
    </div>
  );
}

function Stat({ label, value, tone, sub }: { label: string; value: string; tone?: "ok" | "warn"; sub?: string }) {
  return (
    <div className={`rounded-2xl p-4 shadow-sm ring-1 ${tone === "ok" ? "bg-forest-50 ring-forest-200" : tone === "warn" ? "bg-amber-50 ring-amber-200" : "bg-white ring-black/5"}`}>
      <p className="text-xl font-extrabold text-ink">{value}</p>
      <p className="mt-1 text-xs text-gray-500">{label}</p>
      {sub && <p className="mt-0.5 text-[11px] text-gray-400">{sub}</p>}
    </div>
  );
}
