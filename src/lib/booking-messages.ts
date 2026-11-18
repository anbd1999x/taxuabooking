import "server-only";
import type { CabinTrip, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatPrice, formatDate, toNumber } from "@/lib/format";
import { SITE } from "@/lib/site";
import { getSettings } from "@/lib/queries";
import { sitePhoneOf, parseTrustPopup, TRUST_POPUP_KEY } from "@/lib/trust-popup";
import { formatPhone } from "@/lib/trust-popup";
import { AUTO_CANCEL_FROM, getAutoCancelHours } from "@/lib/booking-auto-cancel";
import { hoursLabel } from "@/lib/auto-cancel-config";
import { supplierPayouts, type SidePayout } from "@/lib/supplier-payout";
import { CATEGORIES } from "@/lib/constants";
import { resolveBusCommissions, resolveRoomCommissions } from "@/lib/provider-commission";
import { isRentalCategory, durationLabel } from "@/lib/occupancy";
import { bookingRentalDays, rentalDaysLabel } from "@/lib/rental-days";
import { bookingCabinBerths, bookingBusSeats, comboSelfTravelGuests, cabinBerthsLabel, comboBikeFacts } from "@/lib/combo-pricing";
import { roomGroups, roomGroupLines, roomGroupsFull, extraGuestNote } from "@/lib/booking-rooms";
import { parseSurcharges } from "@/lib/surcharges";

/**
 * Các tin nhắn mẫu của một đơn (dán thẳng Zalo): tin đã nhận yêu cầu, tin xác nhận chốt đơn gửi KHÁCH,
 * và tin gửi CHỦ DỊCH VỤ (combo tách nhà xe / homestay). Dùng chung cho trang chi tiết đơn và ngăn
 * "Xử lý nhanh" ở danh sách yêu cầu đặt.
 */

// Giờ nhận / trả phòng chuẩn ghi trong tin nhắn gửi khách (homestay có quy định riêng thì báo thêm).
const STAY_CHECKIN_TIME = "14:00";
const STAY_CHECKOUT_TIME = "12:00";
// Tỉ lệ cọc giữ chỗ ghi trong tin nhắn gửi khách.
const DEPOSIT_RATE = 0.5;

type MsgBooking = Prisma.BookingRequestGetPayload<{ include: { service: true; ctv: true } }>;
type MsgRoom = Prisma.RoomGetPayload<{ include: { roomType: true } }>;
type MsgTrip = Prisma.CabinTripGetPayload<{ include: { service: true } }>;

export type ProviderMsg = { key: string; label: string; text: string };
/** Phần tiền sàn trả cho từng bên (nhà xe / homestay) kèm nhãn hiển thị. */
export type QuickPayout = SidePayout & { kind: string; name: string };
/** Dữ liệu đơn có cấu trúc (cho email gửi khách): từng khối dịch vụ + tiền + hạn tự huỷ. */
export type BookingFacts = {
  code: string;
  customerName: string;
  phone: string;
  categoryLabel: string;
  partyLabel: string; // "Số khách" | "Số xe"
  party: string;
  /** Khối dịch vụ: `tag` = loại (XE CABIN / HOMESTAY…), `name` = tên đối tác, `amount` = tiền phần đó (combo). */
  sections: { tag: string; name: string; rows: [string, string][]; amount: number | null }[];
  /** Mốc bắt đầu chuyến: nhãn (Khởi hành / Nhận phòng / Nhận xe / Ngày dùng) + ngày dd/mm/yyyy. */
  startLabel: string;
  startDate: string;
  /** Nhắc giờ có mặt ở điểm đón (đơn có xe cabin), null nếu không áp dụng. */
  boardNote: string | null;
  surcharges: { label: string; amount: number }[];
  price: number | null;
  collected: number;
  due: number | null;
  deposit: number | null; // tiền cọc đề nghị (50%)
  /** Câu nhắc đơn tự huỷ (null = không áp dụng). */
  autoCancelNote: string | null;
  hotline: string;
  mapUrl: string | null;
  note: string | null;
  /** Lý do huỷ (đơn đã huỷ), null nếu không có. */
  cancelReason: string | null;
};
export type BookingMessages = { customerMsg: string; confirmMsg: string; providerMsgs: ProviderMsg[]; payouts: QuickPayout[]; facts: BookingFacts };

/**
 * SĐT chung toàn web. `getSettings()` dùng cache của Next — khi chạy ngoài một request (bộ hẹn giờ tự huỷ
 * đơn trong instrumentation) cache có thể chưa sẵn ⇒ đọc thẳng DB để email huỷ đơn vẫn dựng được.
 */
async function sitePhone(): Promise<string | null> {
  try {
    return (await getSettings()).contactPhone || null;
  } catch {
    const row = await prisma.siteSetting.findUnique({ where: { key: TRUST_POPUP_KEY } }).catch(() => null);
    const viaPopup = sitePhoneOf(parseTrustPopup(row?.value));
    if (viaPopup) return viaPopup;
    const p = await prisma.siteSetting.findUnique({ where: { key: "contactPhone" } }).catch(() => null);
    return p?.value || null;
  }
}

export async function buildBookingMessages(
  b: MsgBooking,
  rooms: MsgRoom[],
  outTrip: MsgTrip | null,
  retTrip: CabinTrip | null,
): Promise<BookingMessages> {
  // Ghi chú khách bị trộn thêm "Đón: … · Trả: … · Tạm tính: …" khi đặt cabin → tách điểm đón/trả khách chọn.
  const noteSegs = (b.note ?? "").split(" · ").map((s) => s.trim()).filter(Boolean);
  const pickupChosen =
    noteSegs.find((s) => s.startsWith("Đón:"))?.slice(4).trim() ||
    b.selectionLabel?.match(/\btừ ([^·(]+?)\s*(?:\(|·|$)/)?.[1]?.trim() ||
    b.selectionLabel?.match(/đón tại ([^·()]+?)\s*(?:\)|·|$)/)?.[1]?.trim() ||
    null;
  const dropChosen = noteSegs.find((s) => s.startsWith("Trả:"))?.slice(4).trim() || null;
  const price = toNumber(b.referencePrice);
  const surchargeLines = parseSurcharges(b.surcharges).map((s) => `Phụ thu ${s.label}: +${formatPrice(s.amount)}`);
  const collected = toNumber(b.amountCollected) ?? 0;
  const due = price != null ? Math.max(0, price - collected) : null;

  // Cách nằm theo người: cabin đôi (nằm ghép) / cabin đơn (nằm riêng, ×2 giá).
  const berths = bookingCabinBerths(b);
  const seatsLabel = berths
    ? cabinBerthsLabel(berths)
    : [
        b.seatsSingle ? `${b.seatsSingle} chỗ` : "",
        b.seatsDouble ? `${b.seatsDouble} cabin đôi` : "",
      ].filter(Boolean).join(" + ") || `${b.quantity} chỗ`;

  // Hotline = SĐT chung toàn web (chủ sở hữu được chọn ở /admin/popup), không gõ cứng.
  const hotline = formatPhone((await sitePhone()) || SITE.defaultPhone);
  // Đơn còn chờ & chưa thu tiền sẽ tự huỷ sau số giờ admin thiết lập ở /admin/bookings (0 = tắt).
  const autoCancelHours = await getAutoCancelHours();
  // Giờ hạn chót luôn hiển thị theo giờ Việt Nam (máy chủ có thể chạy múi giờ khác).
  const VN_TIME = new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" });
  const autoCancelAt =
    autoCancelHours > 0 && (b.status === "NEW" || b.status === "CONTACTING") && b.paymentStatus === "UNPAID" && b.createdAt >= AUTO_CANCEL_FROM
      ? new Date(b.createdAt.getTime() + autoCancelHours * 3_600_000)
      : null;
  const mapUrl = b.service?.mapUrl || null;
  const ctvLine = b.ctv ? `${b.ctv.name}${b.ctv.phone ? ` · ${b.ctv.phone}` : ""}` : null;
  // Phòng gom theo hạng: 1 phòng "Phòng đôi (P201)"; nhiều phòng "2× Phòng đôi (P201, P202) + 1× Gia đình (F1)".
  const rGroups = roomGroups(rooms);
  const roomsConfirmLabel = !rooms.length
    ? null
    : rooms.length === 1
      ? `${rooms[0].roomType.name} (${rooms[0].name})`
      : roomGroupsFull(rGroups);
  // Tin nhắn / email nhiều phòng: mỗi hạng 1 dòng riêng cho dễ đọc.
  const roomMsgLines = (dash: string): string[] =>
    !rooms.length
      ? []
      : rooms.length === 1
        ? [`${dash}Phòng: ${roomsConfirmLabel}`]
        : [`${dash}Phòng (${rooms.length} phòng):`, ...roomGroupLines(rGroups).map((l) => `   • ${l}`)];
  const extraNote = b.category === "COMBO" ? extraGuestNote(b.selectionLabel) : null;
  const extraShort = extraNote?.replace(" khách ở ghép", " khách") ?? null; // "+1 khách · phụ thu 150.000đ"
  const extraMsgLines = (dash: string): string[] => (extraShort ? [`${dash}Ở ghép: ${extraShort}`] : []);
  // Số người ĐI XE (combo tự chọn có thể khác số khách ở homestay) + số khách tự đi xe riêng.
  const busSeats = bookingBusSeats(b);
  const selfTravel = comboSelfTravelGuests(b);
  const selfTravelLines = (dash: string): string[] =>
    selfTravel > 0 ? [`${dash}Lưu ý: ${selfTravel} khách tự đi xe riêng (không có vé xe trong đơn)`] : [];
  const isRental = isRentalCategory(b.category);
  const isStay = !isRental && b.nights != null && b.endDate != null;
  const rentDaysText = `${rentalDaysLabel(bookingRentalDays(b))} thuê`;
  const rentLines = [
    `Nhận xe: ${b.pickupTime ? `${b.pickupTime} · ` : ""}${formatDate(b.useDate)}`,
    `Trả xe: ${b.returnTime ? `${b.returnTime} · ` : ""}${formatDate(b.endDate ?? b.useDate)} (${rentDaysText})`,
  ];
  const countKey = isRental ? "Số xe" : "Số khách";

  const brandHeader = "Tà Xùa Booking (taxuabooking.com) xác nhận booking của quý khách:";
  const partyLabelStr = (() => {
    if (isRental) return `${b.quantity} xe${b.selectionLabel ? ` ${b.selectionLabel}` : ""}`;
    if (b.adults != null) {
      const kids = b.childrenAges ?? [];
      const parts = [`${b.adults} người lớn`];
      if (kids.length) parts.push(`${kids.length} trẻ em (${kids.join(", ")} tuổi)`);
      return parts.join(" · ");
    }
    return `${b.quantity} khách`;
  })();
  const outPickup2 = outTrip ? pickupChosen || outTrip.pickupPoint : null;

  // 1) Tin nhắn ĐÃ NHẬN yêu cầu (gửi sớm, mời cọc). Tách bạch XE và HOMESTAY, ghi rõ ngày + giờ:
  //    xe đi/về hôm nào mấy giờ, đón ở đâu; nhận/trả phòng hôm nào mấy giờ (combo: xe đi tối hôm
  //    trước ngày nhận phòng nên không gộp chung một dòng "Ngày").
  const stayName = b.service?.title ?? b.serviceTitle;
  const hasRoom = !!(b.roomTypeId || b.roomId || b.roomIds.length > 0);
  const busLines = outTrip
    ? [
        `🚐 XE CABIN: ${outTrip.service.title}`,
        `- Đi: ${outTrip.departureTime} ngày ${formatDate(outTrip.departureDate)}${outPickup2 ? `, đón tại ${outPickup2}` : ""}${outTrip.dropoffPoint ? ` → ${outTrip.dropoffPoint}` : ""}`,
        ...(retTrip
          ? [`- Về: ${retTrip.departureTime} ngày ${formatDate(retTrip.departureDate)}${retTrip.pickupPoint ? `, từ ${retTrip.pickupPoint}` : ""}${dropChosen || pickupChosen || retTrip.dropoffPoint ? ` → ${dropChosen || pickupChosen || retTrip.dropoffPoint}` : ""}`]
          : ["- Vé một chiều (chưa gồm chiều về)"]),
        ...(seatsLabel ? [`- Chỗ nằm: ${seatsLabel}`] : []),
        ...selfTravelLines("- "),
      ]
    : [];
  const stayLines =
    hasRoom && isStay
      ? [
          `🏠 HOMESTAY: ${stayName}`,
          ...roomMsgLines("- "),
          ...extraMsgLines("- "),
          `- Nhận phòng: từ ${STAY_CHECKIN_TIME} ngày ${formatDate(b.useDate)}`,
          `- Trả phòng: trước ${STAY_CHECKOUT_TIME} ngày ${formatDate(b.endDate!)} (${b.nights} đêm)`,
        ]
      : [];
  // Combo có thuê xe máy kèm (dịch vụ tính riêng, không nằm trong bill) ⇒ ghi rõ trong mọi tin gửi khách.
  const bike = comboBikeFacts(b);
  const bikeLines = bike
    ? [
        `🏍️ THUÊ XE MÁY KÈM: ${bike.name}`,
        `- ${bike.count} xe × ${rentalDaysLabel(bike.days)}${bike.pickup && bike.ret ? ` (nhận ${bike.pickup}, trả ${bike.ret})` : ""}`,
        ...(bike.amount != null ? [`- Giá tham khảo: ${formatPrice(bike.amount)} (chưa phải giá cuối, tính theo giờ sử dụng xe thực tế)`] : []),
        `- Tính riêng, không nằm trong bill combo — thanh toán trực tiếp khi giao xe`,
      ]
    : [];
  // Tiền cọc giữ chỗ = 50% tổng tiền (làm tròn lên nghìn đồng), tự tính theo giá đơn.
  const deposit = price != null && price > 0 ? Math.ceil((price * DEPOSIT_RATE) / 1000) * 1000 : null;
  const depositLines =
    deposit == null || due == null || due <= 0
      ? []
      : collected >= deposit
        ? [`Đã nhận cọc ${formatPrice(collected)}, còn lại ${formatPrice(due)}.`]
        : collected > 0
          ? [`Vui lòng cọc 50% = ${formatPrice(deposit)} để giữ chỗ (đã nhận ${formatPrice(collected)}, cần chuyển thêm ${formatPrice(deposit - collected)}).`]
          : [`Vui lòng cọc 50% = ${formatPrice(deposit)} để giữ chỗ.`];
  const customerMsg = [
    `Chào ${b.customerName},`,
    `Tà Xùa Booking đã nhận yêu cầu ${b.code}:`,
    ...(busLines.length || stayLines.length
      ? [...(busLines.length ? ["", ...busLines] : []), ...(stayLines.length ? ["", ...stayLines] : []), ...(bikeLines.length ? ["", ...bikeLines] : []), ""]
      : [
          `• Dịch vụ: ${b.serviceTitle}`,
          `• Ngày: ${formatDate(b.useDate)}${b.endDate ? ` → ${formatDate(b.endDate)}` : ""}${durationLabel(b) ? ` (${durationLabel(b)})` : ""}`,
        ]),
    `• ${countKey}: ${partyLabelStr}`,
    price != null ? `• Tạm tính: ${formatPrice(price)}` : `• Giá: đang xác nhận`,
    ...depositLines,
    ...(autoCancelAt
      ? [
          `Lưu ý: đơn sẽ tự huỷ sau ${hoursLabel(autoCancelHours)} giờ kể từ lúc đặt (trước ${VN_TIME.format(autoCancelAt)}) nếu chưa xác nhận cọc/thanh toán` +
            (hasRoom ? ", hoặc ngay khi phòng đã được người khác đặt trước." : "."),
        ]
      : []),
    `Cảm ơn bạn! Hotline ${hotline}.`,
  ].join("\n");

  // 2) Tin nhắn XÁC NHẬN CHỐT ĐƠN (gửi khi đã chốt/cọc). Thương hiệu Tà Xùa Booking đứng ra xác nhận;
  //    nội dung theo loại đơn: vé xe riêng / homestay riêng / combo (gộp cả 2 nhưng tách bạch từng phần).
  let confirmLines: string[];
  if (b.category === "COMBO") {
    // Combo: gộp cả XE + HOMESTAY, tách bạch từng phần + tiền từng bên.
    confirmLines = [
      brandHeader,
      `Tên khách: ${b.customerName}`,
      `Sđt: ${b.phone}`,
      ...(ctvLine ? [`Hỗ trợ: ${ctvLine}`] : []),
      `Số khách: ${partyLabelStr}`,
    ];
    if (outTrip) {
      confirmLines.push(
        "",
        `🚐 XE CABIN: ${outTrip.service.title}`,
        `- Loại vé: ${retTrip ? "Khứ hồi" : "Một chiều"}${seatsLabel ? ` · ${seatsLabel}` : ""}`,
        ...(outPickup2 ? [`- Đón tại: ${outPickup2}`] : []),
        `- Giờ đi: ${formatDate(outTrip.departureDate)} ${outTrip.departureTime}`,
        ...(retTrip ? [`- Giờ về: ${formatDate(retTrip.departureDate)} ${retTrip.departureTime}`] : []),
        ...selfTravelLines("- "),
        ...(b.busAmount != null ? [`- Tiền vé: ${formatPrice(b.busAmount)}`] : []),
      );
    }
    if (roomsConfirmLabel || isStay) {
      confirmLines.push(
        "",
        `🏠 HOMESTAY: ${b.service?.title ?? b.serviceTitle}`,
        ...roomMsgLines("- "),
        ...extraMsgLines("- "),
        ...(isStay ? [`- Nhận phòng: ${formatDate(b.useDate)}`, `- Trả phòng: ${formatDate(b.endDate!)}`] : []),
        ...(mapUrl ? [`- Định vị: ${mapUrl}`] : []),
        ...(b.roomAmount != null ? [`- Tiền phòng: ${formatPrice(b.roomAmount)}`] : []),
      );
    }
    if (bikeLines.length) confirmLines.push("", ...bikeLines);
    confirmLines.push(
      "",
      ...surchargeLines,
      `Tổng số tiền: ${price != null ? formatPrice(price) : "Chờ xác nhận"}`,
      `Đã cọc: ${collected > 0 ? formatPrice(collected) : "Chưa cọc"}`,
      ...(due != null ? [`Còn lại thanh toán: ${formatPrice(due)}`] : []),
      `Hotline: ${hotline}`,
      "--------------",
    );
  } else if (b.category === "CABIN" && outTrip) {
    // Vé xe đặt riêng: rõ nhà xe, điểm đón, giờ đi/về, số khách, cọc, còn thiếu lên xe.
    confirmLines = [
      brandHeader,
      `Tên khách: ${b.customerName}`,
      `Sđt: ${b.phone}`,
      ...(ctvLine ? [`Hỗ trợ: ${ctvLine}`] : []),
      `Nhà xe: ${outTrip.service.title}`,
      `Loại vé: ${retTrip ? "Khứ hồi" : "Một chiều"}${seatsLabel ? ` · ${seatsLabel}` : ""}`,
      ...(outPickup2 ? [`Đón tại: ${outPickup2}`] : []),
      `Giờ đón (chiều đi): ${formatDate(outTrip.departureDate)} ${outTrip.departureTime}`,
      ...(retTrip ? [`Giờ về (chiều về): ${formatDate(retTrip.departureDate)} ${retTrip.departureTime}`] : []),
      `Số khách: ${partyLabelStr}`,
      ...surchargeLines,
      `Tổng số tiền: ${price != null ? formatPrice(price) : "Chờ xác nhận"}`,
      `Đã cọc: ${collected > 0 ? formatPrice(collected) : "Chưa cọc"}`,
      ...(due != null ? [`Còn thiếu (thanh toán khi lên xe): ${formatPrice(due)}`] : []),
      `Hotline: ${hotline}`,
      "--------------",
    ];
  } else {
    // Homestay / lưu trú khác.
    confirmLines = [
      brandHeader,
      `Tên khách: ${b.customerName}`,
      `Sđt: ${b.phone}`,
      ...(ctvLine ? [`Hỗ trợ: ${ctvLine}`] : []),
      `${isRental ? "Thuê xe máy" : "Homestay"}: ${b.service?.title ?? b.serviceTitle}`,
      ...(rooms.length > 1 ? roomMsgLines("") : roomsConfirmLabel ? [`Số phòng: ${roomsConfirmLabel}`] : []),
      ...(isRental
        ? rentLines
        : isStay
        ? [`Nhận phòng: ${formatDate(b.useDate)}`, `Trả phòng: ${formatDate(b.endDate!)}`]
        : [`Ngày dùng: ${formatDate(b.useDate)}${b.endDate ? ` → ${formatDate(b.endDate)}` : ""}`]),
      `${isRental ? "Số xe" : "Số người"}: ${partyLabelStr}`,
      ...surchargeLines,
      `Tổng số tiền: ${price != null ? formatPrice(price) : "Chờ xác nhận"}`,
      `Đã cọc: ${collected > 0 ? formatPrice(collected) : "Chưa cọc"}`,
      ...(due != null ? [`Còn lại thanh toán lúc nhận phòng: ${formatPrice(due)}`] : []),
      `Hotline: ${hotline}`,
      ...(mapUrl ? [`Định vị: ${mapUrl}`] : []),
      "--------------",
    ];
  }
  const confirmMsg = confirmLines.join("\n");

  // ----- Tin nhắn gửi CHỦ DỊCH VỤ (dán Zalo): mỗi bên một tin riêng — combo tách NHÀ XE / HOMESTAY. -----
  // Không kèm hotline. Tin HOMESTAY/dịch vụ khác: tiền ghi theo phần THỰC NHẬN (bán ra − chiết khấu sàn),
  // SĐT khách chỉ kèm khi đơn đã cọc / thanh toán. Tin NHÀ XE: luôn kèm SĐT khách, không ghi tiền.
  const [roomDiscMap, busDiscMap] = await Promise.all([resolveRoomCommissions([b]), resolveBusCommissions([b])]);
  const payouts = supplierPayouts(b, roomDiscMap.get(b.id) ?? 0, busDiscMap.get(b.id) ?? 0);
  const showGuestPhone = b.paymentStatus !== "UNPAID" || b.status === "COMPLETED";
  const guestLine = `- Khách: ${b.customerName}${showGuestPhone ? ` · ${b.phone}` : ""}`;
  const moneyLines = (side: "room" | "bus", what: string) => {
    const p = payouts.find((x) => x.side === side);
    if (!p || p.gross <= 0) return [`- ${what}: chờ xác nhận giá`];
    return [
      p.discount > 0
        ? `- ${what} thực nhận: ${formatPrice(p.payable)} (giá bán ${formatPrice(p.gross)} − chiết khấu ${formatPrice(p.discount)})`
        : `- ${what}: ${formatPrice(p.payable)}`,
      // Tiền cọc báo cho chủ dịch vụ = đúng số Tà Xùa Booking đã chuyển cho họ.
      ...(p.paid > 0 ? [`- Đã cọc: ${formatPrice(p.paid)} (Tà Xùa Booking đã chuyển) · còn lại ${formatPrice(p.remaining)}`] : []),
    ];
  };
  const guestNote = b.note?.split(" · ").filter((x) => !x.startsWith("Tạm tính:")).join(" · ") || "";
  const noteLine = guestNote ? [`- Ghi chú của khách: ${guestNote}`] : [];
  const providerMsgs: ProviderMsg[] = [];
  const hasBusSide = !!outTrip && (b.category === "COMBO" || b.category === "CABIN");
  if (hasBusSide && outTrip) {
    providerMsgs.push({
      key: "bus",
      label: b.category === "COMBO" ? "Chép tin cho nhà xe" : "Chép tin cho chủ dịch vụ",
      text: [
        `Tà Xùa Booking gửi ${outTrip.service.title} đơn ${b.code}:`,
        // Nhà xe cần SĐT để gọi đón khách ⇒ luôn kèm, kể cả đơn chưa cọc. Không ghi tiền (bán ra / thực nhận).
        `- Khách: ${b.customerName} · ${b.phone}`,
        `- Số khách đi xe: ${busSeats} khách${seatsLabel ? ` · ${seatsLabel}` : ""}`,
        `- Loại vé: ${retTrip ? "Khứ hồi" : "Một chiều"}`,
        `- Chiều đi: ${outTrip.departureTime} ngày ${formatDate(outTrip.departureDate)}${outPickup2 ? `, đón tại ${outPickup2}` : ""}`,
        ...(retTrip
          ? [`- Chiều về: ${retTrip.departureTime} ngày ${formatDate(retTrip.departureDate)}${dropChosen || pickupChosen ? `, trả tại ${dropChosen || pickupChosen}` : ""}`]
          : []),
        ...(b.category === "CABIN" ? noteLine : []),
        "Nhờ nhà xe giữ chỗ giúp. Cảm ơn!",
      ].join("\n"),
    });
  }
  if (b.category !== "CABIN") {
    const svcName = b.service?.title ?? b.serviceTitle;
    const stayish = b.category === "COMBO" || b.category === "HOMESTAY" || b.category === "BUNGALOW";
    providerMsgs.push({
      key: "room",
      label: b.category === "COMBO" ? "Chép tin cho homestay" : "Chép tin cho chủ dịch vụ",
      text: [
        `Tà Xùa Booking gửi ${svcName} đơn ${b.code}:`,
        guestLine,
        ...(stayish
          ? [
              ...roomMsgLines("- "),
              ...extraMsgLines("- "),
              ...(isStay
                ? [
                    `- Nhận phòng: từ ${STAY_CHECKIN_TIME} ngày ${formatDate(b.useDate)}`,
                    `- Trả phòng: trước ${STAY_CHECKOUT_TIME} ngày ${formatDate(b.endDate!)} (${b.nights} đêm)`,
                  ]
                : [`- Ngày: ${formatDate(b.useDate)}`]),
              `- Số khách: ${partyLabelStr}`,
            ]
          : isRental
            ? [...rentLines.map((l) => `- ${l}`), `- Số xe: ${partyLabelStr}`]
            : [
                `- Ngày: ${formatDate(b.useDate)}${b.endDate ? ` → ${formatDate(b.endDate)}` : ""}`,
                ...(b.selectionLabel ? [`- Dịch vụ: ${b.selectionLabel}`] : []),
                `- Số lượng: ${partyLabelStr}`,
              ]),
        ...moneyLines("room", stayish ? "Tiền phòng" : "Tiền dịch vụ"),
        ...noteLine,
        stayish ? "Nhờ home giữ phòng giúp. Cảm ơn!" : "Nhờ anh/chị xác nhận giúp. Cảm ơn!",
      ].join("\n"),
    });
  }

  const stayCat = b.category === "COMBO" || b.category === "HOMESTAY" || b.category === "BUNGALOW";
  const quickPayouts: QuickPayout[] = payouts.map((p) => ({
    ...p,
    kind: p.side === "bus" ? "Nhà xe" : stayCat ? "Homestay" : CATEGORIES[b.category].label,
    name: p.side === "bus" ? (outTrip?.service.title ?? b.service?.title ?? b.serviceTitle) : (b.service?.title ?? b.serviceTitle),
  }));

  // ----- Dữ liệu có cấu trúc cho email gửi khách -----
  const isCombo = b.category === "COMBO";
  const rentalParts = (b.selectionLabel ?? "").split(" · ").map((x) => x.trim()).filter(Boolean);
  const rentalColor = rentalParts.find((x) => x.startsWith("màu "))?.slice(4) ?? null;
  const sections: BookingFacts["sections"] = [];
  if (outTrip) {
    sections.push({
      tag: "Xe cabin",
      name: outTrip.service.title,
      amount: isCombo ? toNumber(b.busAmount) : null,
      rows: [
        ["Loại vé", retTrip ? "Khứ hồi" : "Một chiều"],
        ...(seatsLabel ? ([["Chỗ nằm", seatsLabel]] as [string, string][]) : []),
        ["Chiều đi", `${outTrip.departureTime} · ${formatDate(outTrip.departureDate)}`],
        ...(outPickup2 ? ([["Điểm đón", outPickup2]] as [string, string][]) : []),
        ...(retTrip ? ([["Chiều về", `${retTrip.departureTime} · ${formatDate(retTrip.departureDate)}`]] as [string, string][]) : []),
        ...(retTrip && (dropChosen || pickupChosen) ? ([["Điểm trả", (dropChosen || pickupChosen)!]] as [string, string][]) : []),
        ...(selfTravel > 0 ? ([["Lưu ý", `${selfTravel} khách tự đi xe riêng (không có vé xe trong đơn)`]] as [string, string][]) : []),
        ...(isCombo && b.busAmount != null ? ([["Tiền vé", formatPrice(b.busAmount)]] as [string, string][]) : []),
      ],
    });
  }
  if (hasRoom && isStay) {
    sections.push({
      tag: "Homestay",
      name: stayName,
      amount: isCombo ? toNumber(b.roomAmount) : null,
      rows: [
        ...(rooms.length > 1
          ? ([["Số phòng", `${rooms.length} phòng`], ...rGroups.map((g) => [`${g.names.length}× ${g.typeName}`, g.names.join(", ")])] as [string, string][])
          : roomsConfirmLabel
            ? ([["Phòng", roomsConfirmLabel]] as [string, string][])
            : []),
        ...(extraShort ? ([["Ở ghép", extraShort]] as [string, string][]) : []),
        ["Nhận phòng", `từ ${STAY_CHECKIN_TIME} · ${formatDate(b.useDate)}`],
        ["Trả phòng", `trước ${STAY_CHECKOUT_TIME} · ${formatDate(b.endDate!)}`],
        ["Số đêm", `${b.nights} đêm`],
        ...(isCombo && b.roomAmount != null ? ([["Tiền phòng", formatPrice(b.roomAmount)]] as [string, string][]) : []),
      ],
    });
  } else if (!outTrip || !["CABIN", "COMBO"].includes(b.category)) {
    sections.push({
      tag: CATEGORIES[b.category].label,
      name: stayName,
      amount: null,
      rows: isRental
        ? [
            // selectionLabel: "Honda PG1 · màu Đỏ · nhận 06:00 – trả 12:00 · tính 1,5 ngày" ⇒ lấy loại xe + màu.
            ...(rentalParts[0] ? ([["Loại xe", `${rentalParts[0]} × ${b.quantity} xe`]] as [string, string][]) : []),
            ...(rentalColor ? ([["Màu xe", rentalColor]] as [string, string][]) : []),
            ["Nhận xe", `${b.pickupTime ? `${b.pickupTime} · ` : ""}${formatDate(b.useDate)}`],
            ["Trả xe", `${b.returnTime ? `${b.returnTime} · ` : ""}${formatDate(b.endDate ?? b.useDate)}`],
            ["Thời gian tính tiền", rentDaysText],
          ]
        : [
            ["Ngày", `${formatDate(b.useDate)}${b.endDate ? ` → ${formatDate(b.endDate)}` : ""}${durationLabel(b) ? ` (${durationLabel(b)})` : ""}`],
            ...(b.selectionLabel ? ([["Lựa chọn", b.selectionLabel]] as [string, string][]) : []),
          ],
    });
  }
  // Combo có thuê xe máy kèm: lưu trong mô tả lựa chọn ("… · DỊCH VỤ KÈM (tính riêng…): thuê xe máy 2 xe × 2 ngày
  // = 300.000đ — khách thanh toán khi giao xe"; đơn cũ: "thuê xe máy: …") ⇒ thêm 1 khối riêng trong email.
  const label = b.selectionLabel ?? "";
  // Ngoặc nhận/trả: đơn cũ chỉ có giờ "(nhận 06:00, trả 06:00)"; đơn mới có cả ngày "(nhận 06:00 12/12/2026, trả 18:00 13/12/2026)".
  const motoOld = bike ? null : /(?:^| · )thuê xe máy: ([^·]+)/.exec(label);
  if (b.category === "COMBO" && (bike || motoOld)) {
    sections.push({
      tag: "Thuê xe máy",
      name: bike ? `${bike.name} (thuê kèm)` : "Xe máy thuê kèm",
      amount: null,
      rows: bike
        ? [
            ["Số xe", `${bike.count} xe`],
            ...(bike.pickup && bike.ret
              ? /\//.test(bike.pickup + bike.ret)
                ? ([["Nhận xe", bike.pickup], ["Trả xe", bike.ret]] as [string, string][])
                : ([["Giờ nhận – trả", `${bike.pickup} – ${bike.ret}`]] as [string, string][])
              : []),
            ["Thời gian tính tiền", rentalDaysLabel(bike.days)],
            ["Thanh toán", "Trả khi nhận xe — tính riêng, không gồm trong bill combo"],
            ["Lưu ý", "Giá tham khảo, chưa phải giá cuối — giá chính thức tính theo giờ sử dụng xe thực tế"],
            ...(bike.amount != null ? ([["Tiền thuê xe (tham khảo)", formatPrice(bike.amount)]] as [string, string][]) : []),
          ]
        : [["Chi tiết", motoOld![1].trim()]],
    });
  }

  const facts: BookingFacts = {
    code: b.code,
    customerName: b.customerName,
    phone: b.phone,
    categoryLabel: CATEGORIES[b.category].label,
    partyLabel: countKey,
    party: partyLabelStr,
    sections,
    startLabel: outTrip ? "Khởi hành" : isRental ? "Nhận xe" : hasRoom && isStay ? "Nhận phòng" : "Ngày dùng",
    startDate: formatDate(outTrip ? outTrip.departureDate : b.useDate),
    boardNote: (() => {
      if (!outTrip) return null;
      const m = /^(\d{1,2}):(\d{2})/.exec(outTrip.departureTime ?? "");
      if (!m) return null;
      // Có mặt trước giờ xe chạy 15 phút.
      const t = Number(m[1]) * 60 + Number(m[2]) - 15;
      // Xe chạy ngay sau nửa đêm ⇒ mốc "trước 15 phút" rơi vào hôm trước: nhắc chung, không ghi giờ.
      if (t < 0) return "Có mặt tại điểm đón trước giờ xe chạy 15 phút và xuất trình mã đơn cho nhà xe.";
      const hhmm = `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
      return `Có mặt tại điểm đón trước ${hhmm} ngày ${formatDate(outTrip.departureDate)} và xuất trình mã đơn cho nhà xe.`;
    })(),
    surcharges: parseSurcharges(b.surcharges).map((x) => ({ label: x.label, amount: x.amount })),
    price,
    collected,
    due,
    deposit,
    autoCancelNote: autoCancelAt
      ? `Đơn sẽ tự huỷ sau ${hoursLabel(autoCancelHours)} giờ kể từ lúc đặt (trước ${VN_TIME.format(autoCancelAt)}) nếu chưa xác nhận cọc/thanh toán` +
        (hasRoom ? ", hoặc ngay khi phòng đã được người khác đặt trước." : ".")
      : null,
    hotline,
    mapUrl,
    note: guestNote || null,
    cancelReason: b.status === "CANCELLED" ? b.cancelReason || null : null,
  };

  return { customerMsg, confirmMsg, providerMsgs, payouts: quickPayouts, facts };
}

/** Nạp đơn theo id rồi dựng tin nhắn (cho ngăn "Xử lý nhanh"). Không có đơn ⇒ null. */
export async function bookingMessagesById(id: string): Promise<BookingMessages | null> {
  const b = await prisma.bookingRequest.findUnique({ where: { id }, include: { service: true, ctv: true } });
  if (!b) return null;
  const roomIdList = b.roomIds?.length ? b.roomIds : b.roomId ? [b.roomId] : [];
  const [rooms, outTrip, retTrip] = await Promise.all([
    roomIdList.length
      ? prisma.room.findMany({ where: { id: { in: roomIdList } }, include: { roomType: true } })
      : Promise.resolve([]),
    b.cabinTripId ? prisma.cabinTrip.findUnique({ where: { id: b.cabinTripId }, include: { service: true } }) : null,
    b.cabinReturnTripId ? prisma.cabinTrip.findUnique({ where: { id: b.cabinReturnTripId } }) : null,
  ]);
  return buildBookingMessages(b, rooms, outTrip, retTrip);
}
