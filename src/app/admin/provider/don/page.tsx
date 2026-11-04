import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/format";
import { toDateKey, today } from "@/lib/dates";
import { resolveRoomCommissions } from "@/lib/provider-commission";
import { ProviderOrders, type ProviderOrderVM, type POStatus } from "@/components/admin/ProviderOrders";

export const dynamic = "force-dynamic";

const DOW = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const cal = (d: Date) => ({ mon: "TH " + (d.getUTCMonth() + 1), day: d.getUTCDate(), dow: DOW[d.getUTCDay()] });
const dmy = (d: Date) => d.getUTCDate() + "/" + (d.getUTCMonth() + 1);
const two = (n: number) => String(n).padStart(2, "0");

function mapStatus(status: string, pay: string): POStatus {
  if (status === "CANCELLED") return "cancel";
  if (pay === "PAID") return "paid";
  if (pay === "DEPOSITED") return "dep";
  if (status === "CONFIRMED" || status === "COMPLETED") return "held";
  return "new";
}

export default async function ProviderOrdersPage() {
  const session = await getSession();
  const sub = session!.sub;

  // Nhà xe cabin: đơn COMBO gắn serviceId homestay nhưng đi qua CHUYẾN của nhà xe.
  const myTrips = await prisma.cabinTrip.findMany({
    where: { service: { ownerId: sub, category: "CABIN" } },
    select: { id: true },
  });
  const tripIds = myTrips.map((t) => t.id);

  const [bookings, myServices] = await Promise.all([
    prisma.bookingRequest.findMany({
      where: tripIds.length
        ? { OR: [{ service: { ownerId: sub } }, { cabinTripId: { in: tripIds } }, { cabinReturnTripId: { in: tripIds } }] }
        : { service: { ownerId: sub } },
      orderBy: { createdAt: "desc" },
      take: 300,
      include: { service: { select: { title: true, ownerId: true } }, ctv: { select: { name: true } } },
    }),
    prisma.service.findMany({ where: { ownerId: sub }, select: { title: true } }),
  ]);

  // Chiết khấu hiệu lực mỗi đơn (snapshot, hoặc tính bù cho đơn cũ chưa backfill).
  const discMap = await resolveRoomCommissions(bookings);

  const orders: ProviderOrderVM[] = bookings.map((b) => {
    const isCombo = b.category === "COMBO";
    const homeSide = b.service?.ownerId === sub;
    const ci = b.useDate;
    const co = b.endDate;
    const c = cal(ci);
    const stay =
      (co ? `${dmy(ci)} → ${dmy(co)}` : dmy(ci)) +
      (b.nights ? ` · ${b.nights} đêm` : "") +
      ` · ${b.quantity} người`;

    let gross: number, discount: number, mainTag: "PH" | "XE", room: string, moneyLabel: string, showBusLine: boolean, viewOnly: boolean, busLabel: string, busPrice: number, collected: number;

    if (isCombo && !homeSide) {
      // Phía nhà xe: chỉ phần tiền vé, chỉ xem.
      gross = toNumber(b.busAmount) ?? 0;
      discount = 0;
      mainTag = "XE";
      room = "Vé xe cabin (combo)";
      moneyLabel = "Tiền vé của bạn";
      showBusLine = false;
      viewOnly = true;
      busLabel = "";
      busPrice = 0;
      const net0 = gross;
      collected = b.paymentStatus === "PAID" ? net0 : 0;
    } else {
      gross = isCombo ? toNumber(b.roomAmount) ?? 0 : toNumber(b.referencePrice) ?? 0;
      discount = discMap.get(b.id) ?? 0;
      mainTag = "PH";
      room = isCombo ? b.service?.title ?? b.serviceTitle : b.selectionLabel ?? b.service?.title ?? b.serviceTitle;
      moneyLabel = isCombo ? "Tiền phòng của bạn" : "Tiền của bạn";
      showBusLine = isCombo;
      viewOnly = isCombo;
      busLabel = isCombo ? b.selectionLabel ?? "Xe cabin trong combo" : "";
      busPrice = isCombo ? toNumber(b.busAmount) ?? 0 : 0;
      const net0 = Math.max(0, gross - discount);
      collected = isCombo ? (b.paymentStatus === "PAID" ? net0 : 0) : Math.min(toNumber(b.amountCollected) ?? 0, net0);
    }
    const net = Math.max(0, gross - discount);

    return {
      id: b.id,
      code: b.code,
      createdText: `${dmy(b.createdAt)} ${two(b.createdAt.getHours())}:${two(b.createdAt.getMinutes())}`,
      createdSort: b.createdAt.toISOString(),
      st: mapStatus(b.status, b.paymentStatus),
      src: b.ctvId ? "ctv" : "web",
      combo: isCombo,
      viewOnly,
      name: b.customerName,
      phone: b.phone,
      ciKey: toDateKey(ci),
      calMon: c.mon,
      calDay: c.day,
      calDow: c.dow,
      room,
      stay,
      gross,
      discount,
      net,
      collected,
      moneyLabel,
      mainTag,
      showBusLine,
      ctv: homeSide ? b.ctv?.name ?? "" : "",
      comm: homeSide ? toNumber(b.commissionAmount) ?? 0 : 0,
      ctvPaid: b.commissionPaid,
      guestNote: b.note ?? "",
      adminNote: b.adminNote ?? "",
      busLabel,
      busPrice,
    };
  });

  const scopeLabel = myServices.length === 1 ? myServices[0].title : `${myServices.length} dịch vụ`;
  const now = new Date();
  const todayText = `Hôm nay ${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`;

  return <ProviderOrders orders={orders} scopeLabel={scopeLabel} todayText={todayText} todayKey={toDateKey(today())} />;
}
