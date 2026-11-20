import Link from "next/link";
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
  // Đối tác tự đăng ký: thẻ "4 chức năng" ở đầu trang để bắt đầu từ bất kỳ module nào.
  const starter = (await isSelfSignupProvider(session)) ? await starterState(ownerId) : null;

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

      {starter && <StarterModules s={starter} />}

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

/** Đối tác tự đăng ký đã thiết lập tới đâu ở từng chức năng. */
async function starterState(ownerId: string) {
  const [homes, motos, venues, rest] = await Promise.all([
    prisma.service.count({ where: { ownerId, category: { in: ["HOMESTAY", "BUNGALOW"] } } }),
    prisma.service.count({ where: { ownerId, category: "MOTORBIKE" } }),
    prisma.ticketVenue.count({ where: { ownerId, kind: { not: "RESTAURANT" } } }),
    prisma.ticketVenue.count({ where: { ownerId, kind: "RESTAURANT" } }),
  ]);
  return { homes, motos, venues, rest };
}

/** 4 chức năng miễn phí của đối tác tự đăng ký — mỗi thẻ dẫn vào module, chưa thiết lập thì ghi bước đầu tiên. */
function StarterModules({ s }: { s: Awaited<ReturnType<typeof starterState>> }) {
  const mods = [
    { href: s.homes ? "/admin/provider/phong" : "/admin/services/new?type=HOMESTAY", icon: "🏡", name: "Quản lý homestay", done: s.homes > 0, doneText: `${s.homes} homestay · lịch phòng, đơn, thu chi`, todo: "Tạo homestay đầu tiên" },
    { href: "/admin/provider/xe", icon: "🛵", name: "Quản lý thuê xe máy", done: s.motos > 0, doneText: "Đội xe, lượt thuê, giao nhận, thu chi", todo: "Tạo tiệm xe máy" },
    { href: "/admin/provider/ve", icon: "🎟️", name: "Bán vé & đặt bàn", done: s.venues + s.rest > 0, doneText: `${s.venues + s.rest} địa điểm · vé cổng, show, đặt bàn`, todo: "Tạo điểm bán vé / nhà hàng" },
    { href: "/admin/provider/ve", icon: "📱", name: "Gọi món QR tại bàn", done: s.rest > 0, doneText: "Thực đơn, mã QR từng bàn, order bếp", todo: "Tạo nhà hàng để có thực đơn QR" },
  ];
  return (
    <section className="mt-5 rounded-2xl bg-gradient-to-br from-forest-50 to-white p-4 ring-1 ring-forest-100 sm:p-5">
      <h2 className="text-base font-bold text-ink">4 chức năng miễn phí của bạn</h2>
      <p className="mt-0.5 text-sm text-gray-500">Dùng chức năng nào thì bắt đầu từ chức năng đó — không bắt buộc dùng hết.</p>
      <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
        {mods.map((m) => (
          <Link key={m.name} href={m.href} className="flex items-center gap-3 rounded-xl bg-white p-3 ring-1 ring-black/5 transition hover:ring-forest-300">
            <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-forest-50 text-xl" aria-hidden>{m.icon}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-ink">{m.name}</span>
              <span className={`block truncate text-xs ${m.done ? "text-forest-700" : "text-amber-700"}`}>{m.done ? "✓ " + m.doneText : m.todo + " →"}</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
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
