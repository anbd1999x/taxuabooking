import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSelfSignupProvider } from "@/lib/partner-access";
import { toNumber, formatPrice } from "@/lib/format";
import { comboSideCollected } from "@/lib/combo-pricing";
import { resolveBusCommissions, resolveRoomCommissions } from "@/lib/provider-commission";
import { effectiveDiscounts } from "@/lib/supplier-payout";
import { OrdersTable } from "../ctv/page";
import { rentalOriginalTotal } from "@/lib/rental-days";
import { rentalListPriceMap } from "@/lib/rental-list-price";
import { ownerBookingIds } from "@/lib/stats";

export const dynamic = "force-dynamic";

export default async function ProviderHome() {
  const session = await getSession();
  const ownerId = session!.sub;
  // Chủ homestay tự đăng ký chưa tạo homestay nào ⇒ đưa thẳng tới bước tạo homestay.
  if (!(await prisma.service.count({ where: { ownerId } })) && (await isSelfSignupProvider(session))) redirect("/admin/services");

  // Nhà xe: đơn COMBO gắn serviceId homestay nhưng đi qua CHUYẾN của nhà xe → vẫn là đơn của mình.
  // Lọc phạm vi trong DB (subquery chuyến), không nạp toàn bộ id CabinTrip.
  const [recentIds, allIds] = await Promise.all([
    ownerBookingIds(ownerId, { limit: 10 }),
    // Doanh thu chỉ tính đơn đã chốt (xác nhận / hoàn thành).
    ownerBookingIds(ownerId, { statuses: ["CONFIRMED", "COMPLETED"] }),
  ]);

  const [services, recent, all] = await Promise.all([
    prisma.service.findMany({ where: { ownerId }, select: { title: true } }),
    prisma.bookingRequest.findMany({
      where: { id: { in: recentIds } },
      orderBy: { createdAt: "desc" },
      include: { service: { select: { title: true, ownerId: true, originalPrice: true } } },
    }),
    prisma.bookingRequest.findMany({
      where: { id: { in: allIds } },
      include: { service: { select: { ownerId: true, originalPrice: true } } },
    }),
  ]);
  // Chiết khấu hiệu lực mỗi đơn (snapshot, hoặc tính bù cho đơn cũ chưa backfill).
  const both = [...all, ...recent];
  const [roomDisc, busDisc, listPrices] = await Promise.all([resolveRoomCommissions(both), resolveBusCommissions(both), rentalListPriceMap(both)]);

  // Tiền chủ dịch vụ THỰC NHẬN = phần tiền bán ra của bên mình − chiết khấu bên mình để lại cho sàn.
  //  - Homestay (và đơn combo phía home): tiền phòng − chiết khấu từng căn.
  //  - Nhà xe (đơn vé cabin, đơn combo đi qua chuyến của mình): tiền vé − chiết khấu nhà xe.
  type B = (typeof both)[number];
  const busSide = (b: B) => (b.category === "COMBO" ? b.service?.ownerId !== ownerId : b.category === "CABIN");
  const grossOf = (b: B) =>
    b.category === "COMBO" ? toNumber(busSide(b) ? b.busAmount : b.roomAmount) ?? 0 : toNumber(b.referencePrice) ?? 0;
  // Chiết khấu hiệu lực (admin sửa tay số phải trả ⇒ bán ra − số sửa tay).
  const discOf = (b: B) => {
    const eff = effectiveDiscounts(b, roomDisc.get(b.id) ?? 0, busDisc.get(b.id) ?? 0);
    return busSide(b) ? eff.bus : eff.room;
  };
  const netOf = (b: B) => Math.max(0, grossOf(b) - discOf(b));

  const total = all.reduce((n, b) => n + netOf(b), 0);
  const discount = all.reduce((n, b) => n + discOf(b), 0);
  const collected = all.reduce((n, b) => {
    const net = netOf(b);
    // Combo do sàn thu hộ: đã thu = 50% phần của mình khi khách cọc, đủ phần khi thanh toán đủ.
    const raw =
      b.category === "COMBO"
        ? comboSideCollected(b.paymentStatus, toNumber(b.amountCollected), grossOf(b), net)
        : toNumber(b.amountCollected) ?? 0;
    return n + Math.min(raw, net); // tiền đã thu quy về thực nhận, không vượt quá
  }, 0);
  // Số gạch ngang: giá gạch của loại xe cấu hình ở admin (xe máy); không có thì giá bán khi đơn có chiết khấu.
  const strikeOf = (b: B) => rentalOriginalTotal(b, listPrices.get(b.rentalVehicleId ?? "")) ?? (discOf(b) > 0 ? grossOf(b) : null);
  const amounts = Object.fromEntries(recent.map((b) => [b.id, { net: netOf(b), discount: discOf(b), strike: strikeOf(b) }]));
  const gross = all.reduce((n, b) => n + grossOf(b), 0);
  const strikeTotal = all.reduce((n, b) => n + (strikeOf(b) ?? netOf(b)), 0);

  return (
    <div>
      <h1 className="text-2xl font-bold text-ink">Xin chào, {session!.name}</h1>
      <p className="mt-1 text-sm text-gray-500">
        {services.length} dịch vụ của bạn. Doanh thu tính trên đơn đã giữ phòng/hoàn thành.
      </p>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Đơn đã chốt" value={String(all.length)} />
        <Stat label={discount > 0 ? "Thực nhận (sau chiết khấu)" : "Doanh thu"} value={formatPrice(total)} strike={strikeTotal > total ? formatPrice(strikeTotal) : undefined} sub={discount > 0 ? `giá bán ${formatPrice(gross)} − chiết khấu ${formatPrice(discount)}` : undefined} />
        <Stat label="Đã thu" value={formatPrice(collected)} tone="ok" />
        <Stat label="Còn thiếu" value={formatPrice(Math.max(0, total - collected))} tone="warn" />
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/admin/provider/don" className="rounded-xl border border-forest-200 px-5 py-3 text-sm font-semibold text-forest-700 hover:bg-forest-50">Đơn & xác nhận</Link>
        <Link href="/admin/provider/thong-ke" className="rounded-xl border border-forest-200 px-5 py-3 text-sm font-semibold text-forest-700 hover:bg-forest-50">Thống kê chi tiết</Link>
      </div>

      <h2 className="mt-8 text-lg font-semibold text-ink">Đơn gần đây</h2>
      {/* Đơn combo phía nhà xe: hoa hồng CTV là việc của homestay → không hiện cho nhà xe. */}
      <OrdersTable
        bookings={recent.map((b) => (b.category === "COMBO" && busSide(b) ? { ...b, commissionAmount: null } : b))}
        amounts={amounts}
        amountLabel="Thực nhận"
        detailHref="/admin/provider/don?open="
      />
    </div>
  );
}

function Stat({ label, value, tone, sub, strike }: { label: string; value: string; tone?: "ok" | "warn"; sub?: string; strike?: string }) {
  return (
    <div className={`rounded-2xl p-4 shadow-sm ring-1 ${tone === "ok" ? "bg-forest-50 ring-forest-200" : tone === "warn" ? "bg-amber-50 ring-amber-200" : "bg-white ring-black/5"}`}>
      {strike && <p className="text-sm font-semibold leading-none text-gray-400 line-through">{strike}</p>}
      <p className="text-xl font-extrabold text-ink">{value}</p>
      <p className="mt-1 text-xs text-gray-500">{label}</p>
      {sub && <p className="mt-0.5 text-[11px] text-gray-400">{sub}</p>}
    </div>
  );
}
