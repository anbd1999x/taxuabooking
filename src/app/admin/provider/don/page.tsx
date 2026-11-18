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
import { rentalOriginalTotal } from "@/lib/rental-days";
import { rentalListPriceMap } from "@/lib/rental-list-price";

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

export default async function ProviderOrdersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // ?open=<id đơn>: mở sẵn chi tiết đơn (bấm từ "Đơn gần đây" ở trang tổng quan).
  const sp = await searchParams;
  const openId = typeof sp.open === "string" ? sp.open : null;
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
      include: { service: { select: { title: true, ownerId: true, originalPrice: true } }, ctv: { select: { name: true } } },
    }),
    prisma.service.findMany({ where: { ownerId: sub }, select: { title: true } }),
  ]);

  // Chiết khấu hiệu lực + nhãn phòng thực của mỗi đơn (snapshot, hoặc tính bù đơn cũ).
  const [infoMap, roomDiscMap, busDiscMap, listPrices] = await Promise.all([
    resolveRoomInfo(bookings),
    resolveRoomCommissions(bookings),
    resolveBusCommissions(bookings),
    rentalListPriceMap(bookings),
  ]);

  const orders: ProviderOrderVM[] = bookings.map((b) => {
    const isCombo = b.category === "COMBO";
    const homeSide = b.service?.ownerId === sub;
    const ci = b.useDate;
    const co = b.endDate;
    const c = cal(ci);
    // (1) Thuê xe có giờ nhận/trả ⇒ hiện kèm giờ: "06:00 22/11/2026 → 12:00 24/11/2026".
    const tIn = b.pickupTime ? `${b.pickupTime} ` : "";
    const tOut = b.returnTime ? `${b.returnTime} ` : "";
    const stay =
      (co ? `${tIn}${dmy(ci)} → ${tOut}${dmy(co)}` : `${tIn}${dmy(ci)}${tOut ? ` → ${tOut.trim()} cùng ngày` : ""}`) +
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
      // Xe máy & dịch vụ khác không có phòng: chiết khấu lấy từ roomDiscMap (snapshot / tính bù theo mức đ/xe/ngày).
      discount = b.category === "CABIN" ? busDiscMap.get(b.id) ?? 0 : info?.discount ?? roomDiscMap.get(b.id) ?? 0;
      mainTag = b.category === "MOTORBIKE" || b.category === "CABIN" || b.category === "TAXI" || b.category === "XEOM" ? "XE" : "PH"; // biểu tượng dòng dịch vụ
      // Tên phòng thực (vd "Phòng đôi (P201) + Phòng đôi (P202)"); fallback nhãn lựa chọn / tên dịch vụ.
      room = info?.label || b.selectionLabel || b.service?.title || b.serviceTitle;
      moneyLabel = isCombo ? "Tiền phòng của bạn" : "Tiền của bạn";
      showBusLine = isCombo;
      // SÀN (admin) xác nhận & ghi cọc; chủ dịch vụ chỉ mở khoá sau khi đơn đã xác nhận + có cọc.
      // Khi đó: thu nốt (không combo — sàn thu combo) → hoàn thành. Huỷ: chỉ sàn.
      canStatus = isAdmin ? true : unlocked;
      canPay = !isCombo && (isAdmin ? true : unlocked);
      // Chủ dịch vụ được huỷ đơn của mình (kèm lý do) khi chưa hoàn thành; combo thì chỉ sàn huỷ.
      canCancel = isAdmin || (!isCombo && b.status !== "COMPLETED" && b.status !== "CANCELLED");
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
    // Chiết khấu hiệu lực lấy theo đúng công thức đối soát (gồm chiết khấu phần chủ dịch vụ thu thêm;
    // admin sửa tay số phải trả ⇒ theo số đó).
    if (po) {
      discount = po.discount;
      collected = Math.min(collected, po.payable);
    }
    // Chủ dịch vụ tự thu tiền khách ở đơn này ⇒ được ghi nhận thu ngay khi đơn đã xác nhận.
    const selfCollect = !isCombo && po?.collector === "PROVIDER";
    if (selfCollect && b.status === "CONFIRMED") canPay = true;
    const net = Math.max(0, gross - discount);
    const chot = b.status === "CONFIRMED" || b.status === "COMPLETED";

    // Chủ dịch vụ thấy SĐT khách ngay khi SÀN đã XÁC NHẬN đơn (kể cả chưa cọc) — và các bước sau đó
    // (đã cọc / thanh toán đủ / hoàn thành). Đơn mới chưa xác nhận hoặc đã huỷ thì ẩn.
    // Admin (sàn) luôn thấy. Ẩn ngay từ server để không lộ SĐT xuống client.
    const st = mapStatus(b.status, b.paymentStatus);
    const phoneLocked = !isAdmin && !(b.status === "CONFIRMED" || b.status === "COMPLETED");

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
      canRestore: isAdmin, // khôi phục đơn đã huỷ: chỉ sàn
      cancelReason: b.status === "CANCELLED" ? b.cancelReason ?? "" : "",
      name: b.customerName,
      phone: phoneLocked ? "" : b.phone,
      phoneLocked,
      ciKey: toDateKey(ci),
      calMon: c.mon,
      calDay: c.day,
      calDow: c.dow,
      room,
      stay,
      // Đơn vị giữ chỗ để ghi chữ đúng: thuê xe máy = "xe", vé cabin / phía nhà xe = "chỗ", còn lại = "phòng".
      unit: b.category === "MOTORBIKE" ? "xe" : mainTag === "XE" || b.category === "CABIN" || b.category === "TAXI" || b.category === "XEOM" ? "chỗ" : "phòng",
      gross,
      discount,
      // Số gạch ngang: giá gốc cấu hình ở admin (xe máy) — không có thì giá bán khi đơn có chiết khấu.
      strike: rentalOriginalTotal(b, listPrices.get(b.rentalVehicleId ?? "")) ?? (discount > 0 ? gross : null),
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
      // Ai thu tiền khách + tiền chủ dịch vụ thu thêm + số chủ dịch vụ phải chuyển lại sàn.
      selfCollect,
      extra: po?.extra ?? 0,
      providerOwes: chot ? (po?.providerOwes ?? 0) : 0,
      canExtra: !isCombo && chot && mySide === (b.category === "CABIN" ? "bus" : "room"),
    };
  });

  const scopeLabel = myServices.length === 1 ? myServices[0].title : `${myServices.length} dịch vụ`;
  const now = new Date();
  const todayText = `Hôm nay ${vnDateTime(now).split(" ")[1]}`;

  return <ProviderOrders orders={orders} scopeLabel={scopeLabel} todayText={todayText} todayKey={toDateKey(today())} initialOpenId={openId && orders.some((o) => o.id === openId) ? openId : null} />;
}
