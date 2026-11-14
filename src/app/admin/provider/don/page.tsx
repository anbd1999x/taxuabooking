import { dmy, vnDateTime } from "@/lib/date-format";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/format";
import { comboSideCollected } from "@/lib/combo-pricing";
import { toDateKey, today } from "@/lib/dates";
import { resolveRoomInfo, resolveRoomCommissions, resolveBusCommissions } from "@/lib/provider-commission";
import { supplierPayouts } from "@/lib/supplier-payout";
import { providerUnlocked } from "@/lib/booking-flow";
import { ProviderOrders, type ProviderOrderVM, type POStatus } from "@/components/admin/ProviderOrders";
import { durationLabel, bookingCountLabel } from "@/lib/occupancy";

export const dynamic = "force-dynamic";

const DOW = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const cal = (d: Date) => ({ mon: "TH " + (d.getUTCMonth() + 1), day: d.getUTCDate(), dow: DOW[d.getUTCDay()] });
const two = (n: number) => String(n).padStart(2, "0");

function mapStatus(status: string, pay: string): POStatus {
  if (status === "CANCELLED") return "cancel";
  if (status === "COMPLETED") return "done";
  if (pay === "PAID") return "paid";
  if (pay === "DEPOSITED") return "dep";
  if (status === "CONFIRMED") return "held";
  return "new";
}

export default async function ProviderOrdersPage() {
  const session = await getSession();
  const sub = session!.sub;
  const isAdmin = session!.role === "ADMIN";

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

  // Chiết khấu hiệu lực + nhãn phòng thực của mỗi đơn (snapshot, hoặc tính bù đơn cũ).
  const [infoMap, roomDiscMap, busDiscMap] = await Promise.all([
    resolveRoomInfo(bookings),
    resolveRoomCommissions(bookings),
    resolveBusCommissions(bookings),
  ]);

  const orders: ProviderOrderVM[] = bookings.map((b) => {
    const isCombo = b.category === "COMBO";
    const homeSide = b.service?.ownerId === sub;
    const ci = b.useDate;
    const co = b.endDate;
    const c = cal(ci);
    const stay =
      (co ? `${dmy(ci)} → ${dmy(co)}` : dmy(ci)) +
      (durationLabel(b) ? ` · ${durationLabel(b)}` : "") +
      ` · ${bookingCountLabel(b)}`;

    let gross: number, discount: number, mainTag: "PH" | "XE", room: string, moneyLabel: string, showBusLine: boolean, canStatus: boolean, canPay: boolean, canCancel: boolean, busLabel: string, busPrice: number, collected: number;

    // Chủ dịch vụ chỉ được thao tác sau khi SÀN đã xác nhận + ghi nhận cọc.
    const unlocked = providerUnlocked(b.status, b.paymentStatus);

    if (isCombo && !homeSide) {
      // Phía nhà xe: chỉ phần tiền vé, thuần xem (phòng & trạng thái do chủ homestay/sàn lo).
      gross = toNumber(b.busAmount) ?? 0;
      discount = busDiscMap.get(b.id) ?? 0; // chiết khấu nhà xe để lại cho sàn
      mainTag = "XE";
      room = "Vé xe cabin (combo)";
      moneyLabel = "Tiền vé của bạn";
      showBusLine = false;
      canStatus = false;
      canPay = false;
      canCancel = false;
      busLabel = "";
      busPrice = 0;
      const net0 = Math.max(0, gross - discount);
      collected = comboSideCollected(b.paymentStatus, toNumber(b.amountCollected), gross, net0);
    } else {
      const info = infoMap.get(b.id);
      gross = isCombo ? toNumber(b.roomAmount) ?? 0 : toNumber(b.referencePrice) ?? 0;
      // Đơn vé cabin: trừ chiết khấu NHÀ XE; còn lại (homestay/combo phía home): chiết khấu từng căn.
      discount = b.category === "CABIN" ? busDiscMap.get(b.id) ?? 0 : info?.discount ?? 0;
      mainTag = "PH";
      // Tên phòng thực (vd "Phòng đôi (P201) + Phòng đôi (P202)"); fallback nhãn lựa chọn / tên dịch vụ.
      room = info?.label || b.selectionLabel || b.service?.title || b.serviceTitle;
      moneyLabel = isCombo ? "Tiền phòng của bạn" : "Tiền của bạn";
      showBusLine = isCombo;
      // SÀN (admin) xác nhận & ghi cọc; chủ dịch vụ chỉ mở khoá sau khi đơn đã xác nhận + có cọc.
      // Khi đó: thu nốt (không combo — sàn thu combo) → hoàn thành. Huỷ: chỉ sàn.
      canStatus = isAdmin ? true : unlocked;
      canPay = !isCombo && (isAdmin ? true : unlocked);
      canCancel = isAdmin;
      busLabel = isCombo ? b.selectionLabel ?? "Xe cabin trong combo" : "";
      busPrice = isCombo ? toNumber(b.busAmount) ?? 0 : 0;
      const net0 = Math.max(0, gross - discount);
      collected = isCombo
        ? comboSideCollected(b.paymentStatus, toNumber(b.amountCollected), gross, net0)
        : Math.min(toNumber(b.amountCollected) ?? 0, net0);
    }
    // Sàn thanh toán cho bên mình: cùng công thức với trang chi tiết đơn của admin.
    const mySide = (isCombo ? !homeSide : b.category === "CABIN") ? "bus" : "room";
    const po = supplierPayouts(b, roomDiscMap.get(b.id) ?? 0, busDiscMap.get(b.id) ?? 0).find((s) => s.side === mySide);
    // Admin đã sửa tay số phải trả ⇒ tiền thực nhận hiển thị theo đúng số đó.
    if (po?.overridden) {
      discount = po.discount;
      collected = Math.min(collected, po.payable);
    }
    const net = Math.max(0, gross - discount);
    const chot = b.status === "CONFIRMED" || b.status === "COMPLETED";

    // Chủ dịch vụ chỉ thấy SĐT khách sau khi đơn Đã cọc / Đã thanh toán đủ / Hoàn thành.
    // Admin (sàn) luôn thấy. Ẩn ngay từ server để không lộ SĐT xuống client.
    const st = mapStatus(b.status, b.paymentStatus);
    const phoneLocked = !isAdmin && !(st === "dep" || st === "paid" || st === "done");

    return {
      id: b.id,
      code: b.code,
      createdText: vnDateTime(b.createdAt), // giờ VN, dd/mm/yyyy
      createdSort: b.createdAt.toISOString(),
      st,
      src: b.ctvId ? "ctv" : "web",
      combo: isCombo,
      canStatus,
      canPay,
      canCancel,
      name: b.customerName,
      phone: phoneLocked ? "" : b.phone,
      phoneLocked,
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
      payoutDue: po?.payable ?? 0,
      payoutReceived: po?.paid ?? 0,
      payoutOwed: chot ? (po?.remaining ?? 0) : 0,
    };
  });

  const scopeLabel = myServices.length === 1 ? myServices[0].title : `${myServices.length} dịch vụ`;
  const now = new Date();
  const todayText = `Hôm nay ${vnDateTime(now).split(" ")[1]}`;

  return <ProviderOrders orders={orders} scopeLabel={scopeLabel} todayText={todayText} todayKey={toDateKey(today())} />;
}
