import Link from "next/link";
import { notFound } from "next/navigation";
import type { BookingStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { CATEGORIES } from "@/lib/constants";
import { formatPrice, formatDate, formatDateTime, toNumber } from "@/lib/format";
import { today } from "@/lib/dates";
import { SITE } from "@/lib/site";
import { ActionForm } from "@/components/admin/ActionForm";
import {
  CopyChip,
  StatusPanel,
  PaymentRecordForm,
  NoteForm,
  DeleteBookingButton,
} from "@/components/admin/BookingDetailClient";
import {
  toggleBookingHeld,
  duplicateBooking,
  setBookingCommissionPaid,
} from "../actions";

export const dynamic = "force-dynamic";

const STEPS: { value: BookingStatus; name: string; bar: string }[] = [
  { value: "NEW", name: "Mới", bar: "bg-sky-500" },
  { value: "CONTACTING", name: "Đang liên hệ", bar: "bg-amber-500" },
  { value: "CONFIRMED", name: "Đã xác nhận", bar: "bg-forest-500" },
  { value: "COMPLETED", name: "Hoàn thành", bar: "bg-forest-700" },
  { value: "CANCELLED", name: "Đã huỷ", bar: "bg-red-500" },
];

const LOG_DOT: Record<string, string> = {
  STATUS: "bg-forest-500",
  PAYMENT: "bg-forest-600",
  NOTE: "bg-gray-400",
  SUPPLIER: "bg-sky-500",
  SYSTEM: "bg-gray-300",
};

export default async function BookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const b = await prisma.bookingRequest.findUnique({
    where: { id },
    include: {
      service: { include: { owner: true } },
      ctv: true,
      logs: { orderBy: { createdAt: "desc" }, take: 100 },
    },
  });
  if (!b) notFound();

  // Tham chiếu phòng / chuyến xe (scalar id, không có relation trong schema).
  // Combo/đoàn đông có thể giữ NHIỀU phòng (roomIds) → nạp hết để hiện đủ.
  const roomIdList = b.roomIds?.length ? b.roomIds : b.roomId ? [b.roomId] : [];
  const [rooms, outTrip, retTrip, prevB, nextB, newerCount, total, pastCount] = await Promise.all([
    roomIdList.length
      ? prisma.room.findMany({ where: { id: { in: roomIdList } }, include: { roomType: true } })
      : Promise.resolve([]),
    b.cabinTripId
      ? prisma.cabinTrip.findUnique({ where: { id: b.cabinTripId }, include: { service: { include: { owner: true } } } })
      : null,
    b.cabinReturnTripId ? prisma.cabinTrip.findUnique({ where: { id: b.cabinReturnTripId } }) : null,
    prisma.bookingRequest.findFirst({
      where: { createdAt: { gt: b.createdAt } },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    }),
    prisma.bookingRequest.findFirst({
      where: { createdAt: { lt: b.createdAt } },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    }),
    prisma.bookingRequest.count({ where: { createdAt: { gt: b.createdAt } } }),
    prisma.bookingRequest.count(),
    prisma.bookingRequest.count({ where: { phone: b.phone, id: { not: b.id } } }),
  ]);

  const cat = CATEGORIES[b.category];
  // Ghi chú khách bị trộn thêm "Đón: … · Trả: … · Tạm tính: …" khi đặt cabin.
  // Tách ra: điểm đón/trả khách tự chọn + ghi chú thật (sạch cho phần hiển thị).
  const noteSegs = (b.note ?? "").split(" · ").map((s) => s.trim()).filter(Boolean);
  const pickupChosen = noteSegs.find((s) => s.startsWith("Đón:"))?.slice(4).trim() || null;
  const dropChosen = noteSegs.find((s) => s.startsWith("Trả:"))?.slice(4).trim() || null;
  const customerNote =
    noteSegs
      .filter((s) => !s.startsWith("Đón:") && !s.startsWith("Trả:") && !s.startsWith("Tạm tính:"))
      .join(" · ") || null;
  const price = toNumber(b.referencePrice);
  const collected = toNumber(b.amountCollected) ?? 0;
  const due = price != null ? Math.max(0, price - collected) : null;
  const phoneDigits = b.phone.replace(/\D/g, "");

  // Badge thanh toán.
  const payText =
    b.paymentStatus === "PAID"
      ? "Đã thu đủ"
      : collected > 0
        ? `Đã cọc ${formatPrice(collected)}`
        : "Chưa thu";
  const payTone =
    b.paymentStatus === "PAID"
      ? "bg-forest-100 text-forest-700"
      : collected > 0
        ? "bg-amber-100 text-amber-700"
        : "bg-red-50 text-red-600";

  // Badge trạng thái.
  const stepIdx = STEPS.findIndex((s) => s.value === b.status);
  const stTone =
    b.status === "CANCELLED"
      ? "bg-red-50 text-red-600"
      : b.status === "CONFIRMED" || b.status === "COMPLETED"
        ? "bg-forest-100 text-forest-700"
        : b.status === "CONTACTING"
          ? "bg-amber-100 text-amber-700"
          : "bg-sky-100 text-sky-700";

  // Dòng nhắc việc: còn bao lâu tới ngày dùng + tình trạng cọc.
  const daysUntil = Math.round((b.useDate.getTime() - today().getTime()) / 86_400_000);
  let urgText = "";
  let urgTone = "text-gray-500";
  if (b.status !== "CANCELLED" && b.status !== "COMPLETED") {
    const when = daysUntil < 0 ? "Đã qua ngày sử dụng" : daysUntil === 0 ? "Khởi hành HÔM NAY" : `Khởi hành sau ${daysUntil} ngày`;
    if (b.paymentStatus === "PAID") {
      urgText = `${when} · đã thu đủ, nhớ gửi lịch trình cho khách`;
      urgTone = "text-forest-700";
    } else if (collected > 0) {
      urgText = `${when} · đã cọc, thu nốt ${due != null ? formatPrice(due) : "phần còn lại"} trước ngày đi`;
      urgTone = "text-forest-700";
    } else {
      urgText = `${when} · chưa cọc, hẹn khách cọc sớm để giữ chỗ`;
      urgTone = "text-sunset-600";
    }
  }

  // Các phần dịch vụ trong đơn (combo tách 2 bên).
  type Part = {
    key: string;
    ic: string;
    icTone: string;
    name: string;
    detail: string;
    routeLines: string[];
    chips: string[];
    price: number | null;
    heldSide: "room" | "bus";
    held: boolean;
  };
  const parts: Part[] = [];
  const seatsLabel = [
    b.seatsSingle ? `${b.seatsSingle} chỗ` : "",
    b.seatsDouble ? `${b.seatsDouble} cabin đôi` : "",
  ].filter(Boolean).join(" + ") || `${b.quantity} chỗ`;

  if (outTrip) {
    // Lộ trình từng lượt: điểm đón → điểm trả của chuyến + ngày giờ khởi hành.
    // Ưu tiên điểm khách tự chọn (lưu trong note) nếu khác lộ trình mặc định.
    const outPickup = pickupChosen || outTrip.pickupPoint;
    const routeLines = [
      `${retTrip ? "Lượt đi · " : ""}${outPickup} → ${outTrip.dropoffPoint} · ${formatDate(outTrip.departureDate)} ${outTrip.departureTime}`,
      ...(retTrip
        ? [`Lượt về · ${retTrip.pickupPoint} → ${retTrip.dropoffPoint} · ${formatDate(retTrip.departureDate)} ${retTrip.departureTime}`]
        : []),
    ];
    parts.push({
      key: "bus",
      ic: "XE",
      icTone: "bg-sky-100 text-sky-700",
      name: `${outTrip.service.title}${retTrip ? " · Cabin khứ hồi" : " · Xe cabin"}`,
      detail: seatsLabel,
      routeLines,
      chips: [
        retTrip ? "Khứ hồi" : "Một chiều",
        `${b.quantity} khách`,
        ...(dropChosen ? [`Trả khách: ${dropChosen}`] : []),
      ],
      price: b.category === "COMBO" ? toNumber(b.busAmount) : price,
      heldSide: "bus",
      held: b.heldBus,
    });
  }
  if (rooms.length || (b.category !== "CABIN" && b.category !== "COMBO") || (b.category === "COMBO" && b.serviceId)) {
    // Gộp phòng theo hạng để hiện đủ các căn đã giữ: "Phòng Đơn (Mây) + Phòng Đôi (Couple 1)".
    const roomsLabel = rooms.length
      ? rooms.map((r) => `${r.roomType.name} (${r.name})`).join(" + ")
      : "";
    const stay = roomsLabel ? `${b.service?.title ?? b.serviceTitle} · ${roomsLabel}` : b.serviceTitle;
    const isStay = b.nights != null && b.endDate != null;
    const roomChips = rooms.length > 1 ? [`${rooms.length} phòng`] : [];
    parts.push({
      key: "room",
      ic: b.category === "COMBO" || b.category === "HOMESTAY" ? "HS" : cat.shortLabel.slice(0, 2).toUpperCase(),
      icTone: "bg-forest-100 text-forest-700",
      name: stay,
      detail: isStay
        ? `Nhận ${formatDate(b.useDate)} · Trả ${formatDate(b.endDate!)} · ${b.nights} đêm · ${b.quantity} người`
        : `${formatDate(b.useDate)}${b.endDate ? ` → ${formatDate(b.endDate)}` : ""} · SL ${b.quantity}${b.selectionLabel && !rooms.length ? ` · ${b.selectionLabel}` : ""}`,
      routeLines: [],
      chips: isStay ? [...roomChips, `${b.nights} đêm`, `${b.quantity} người`] : [cat.shortLabel],
      price: b.category === "COMBO" ? toNumber(b.roomAmount) : outTrip ? null : price,
      heldSide: "room",
      held: b.heldRoom,
    });
  }

  // Phòng hờ: tham chiếu chuyến/phòng đã bị xoá ⇒ vẫn hiện 1 dòng từ snapshot.
  if (parts.length === 0) {
    parts.push({
      key: "generic",
      ic: cat.shortLabel.slice(0, 2).toUpperCase(),
      icTone: "bg-gray-100 text-gray-600",
      name: b.serviceTitle,
      detail: `${formatDate(b.useDate)}${b.endDate ? ` → ${formatDate(b.endDate)}` : ""} · SL ${b.quantity}${b.selectionLabel ? ` · ${b.selectionLabel}` : ""}`,
      routeLines: [],
      chips: [cat.shortLabel],
      price,
      heldSide: "room",
      held: b.heldRoom,
    });
  }

  // Nhà cung cấp (combo: cả nhà xe lẫn homestay).
  type Sup = {
    kind: string;
    name: string;
    owner: string | null;
    phone: string | null;
    zalo: string | null;
    serviceId: string;
    slug: string;
    catSlug: string;
    held: boolean;
    hasCalendar: boolean;
  };
  const sups: Sup[] = [];
  if (outTrip) {
    sups.push({
      kind: "Xe cabin",
      name: outTrip.service.title,
      owner: outTrip.service.contactName || outTrip.service.owner?.name || null,
      phone: outTrip.service.contactPhone,
      zalo: outTrip.service.contactZalo,
      serviceId: outTrip.service.id,
      slug: outTrip.service.slug,
      catSlug: "xe-cabin",
      held: b.heldBus,
      hasCalendar: true,
    });
  }
  if (b.service && (b.category !== "CABIN" || b.service.id !== outTrip?.service.id)) {
    sups.push({
      kind: b.category === "COMBO" ? "Homestay" : cat.label,
      name: b.service.title,
      owner: b.service.contactName || b.service.owner?.name || null,
      phone: b.service.contactPhone,
      zalo: b.service.contactZalo,
      serviceId: b.service.id,
      slug: b.service.slug,
      catSlug: CATEGORIES[b.service.category].slug,
      held: b.heldRoom,
      hasCalendar: ["HOMESTAY", "BUNGALOW", "CABIN"].includes(b.service.category),
    });
  }

  // Văn bản sao chép.
  const partLines = parts
    .map((p) => `- ${p.name}: ${[...p.routeLines, p.detail].filter(Boolean).join(" · ")}`)
    .join("\n");
  const summaryText =
    `Đơn ${b.code} · ${b.customerName} · ${b.phone} · ${b.quantity} khách\n${partLines}\n` +
    `${price != null ? `Tổng ${formatPrice(price)}` : "Giá chờ xác nhận"} · ${payText}`;
  // ----- Tin nhắn gửi khách (format sẵn, dán thẳng Zalo) -----
  const hotline = SITE.defaultPhone;
  const mapUrl = b.service?.mapUrl || null;
  const ctvLine = b.ctv ? `${b.ctv.name}${b.ctv.phone ? ` · ${b.ctv.phone}` : ""}` : null;
  const roomsConfirmLabel = rooms.length
    ? rooms.map((r) => `${r.roomType.name} (${r.name})`).join(", ")
    : null;
  const isStay = b.nights != null && b.endDate != null;

  // 1) Tin nhắn ĐÃ NHẬN yêu cầu (gửi sớm, mời cọc) — bản rút gọn, nhiều dòng cho dễ đọc.
  const customerMsg = [
    `Chào ${b.customerName},`,
    `Tà Xùa Booking đã nhận yêu cầu ${b.code}:`,
    `• Dịch vụ: ${b.serviceTitle}`,
    `• Ngày: ${formatDate(b.useDate)}${b.endDate ? ` → ${formatDate(b.endDate)}` : ""}${b.nights ? ` (${b.nights} đêm)` : ""}`,
    `• Số khách: ${b.quantity}`,
    price != null ? `• Tạm tính: ${formatPrice(price)}` : `• Giá: đang xác nhận`,
    ...(due != null && due > 0 ? [`Vui lòng cọc để giữ chỗ (còn thiếu ${formatPrice(due)}).`] : []),
    `Cảm ơn bạn! Hotline ${hotline}.`,
  ].join("\n");

  // 2) Tin nhắn XÁC NHẬN CHỐT ĐƠN (gửi khi đã chốt/cọc). Thương hiệu Tà Xùa Booking
  //    đứng ra xác nhận; nội dung theo loại đơn: vé xe riêng / homestay riêng / combo
  //    (gộp cả 2 nhưng tách bạch từng phần). Gắn đúng tên dịch vụ + cọc + còn lại.
  const brandHeader = "Tà Xùa Booking (taxuabooking.com) xác nhận booking của quý khách:";
  const partyLabelStr = (() => {
    if (b.adults != null) {
      const kids = b.childrenAges ?? [];
      const parts = [`${b.adults} người lớn`];
      if (kids.length) parts.push(`${kids.length} trẻ em (${kids.join(", ")} tuổi)`);
      return parts.join(" · ");
    }
    return `${b.quantity} khách`;
  })();
  const outPickup2 = outTrip ? pickupChosen || outTrip.pickupPoint : null;

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
        ...(b.busAmount != null ? [`- Tiền vé: ${formatPrice(b.busAmount)}`] : []),
      );
    }
    if (roomsConfirmLabel || isStay) {
      confirmLines.push(
        "",
        `🏠 HOMESTAY: ${b.service?.title ?? b.serviceTitle}`,
        ...(roomsConfirmLabel ? [`- Phòng: ${roomsConfirmLabel}`] : []),
        ...(isStay ? [`- Nhận phòng: ${formatDate(b.useDate)}`, `- Trả phòng: ${formatDate(b.endDate!)}`] : []),
        ...(mapUrl ? [`- Định vị: ${mapUrl}`] : []),
        ...(b.roomAmount != null ? [`- Tiền phòng: ${formatPrice(b.roomAmount)}`] : []),
      );
    }
    confirmLines.push(
      "",
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
      `Homestay: ${b.service?.title ?? b.serviceTitle}`,
      ...(roomsConfirmLabel ? [`Số phòng: ${roomsConfirmLabel}`] : []),
      ...(isStay
        ? [`Nhận phòng: ${formatDate(b.useDate)}`, `Trả phòng: ${formatDate(b.endDate!)}`]
        : [`Ngày dùng: ${formatDate(b.useDate)}${b.endDate ? ` → ${formatDate(b.endDate)}` : ""}`]),
      `Số người: ${partyLabelStr}`,
      `Tổng số tiền: ${price != null ? formatPrice(price) : "Chờ xác nhận"}`,
      `Đã cọc: ${collected > 0 ? formatPrice(collected) : "Chưa cọc"}`,
      ...(due != null ? [`Còn lại thanh toán lúc nhận phòng: ${formatPrice(due)}`] : []),
      `Hotline: ${hotline}`,
      ...(mapUrl ? [`Định vị: ${mapUrl}`] : []),
      "--------------",
    ];
  }
  const confirmMsg = confirmLines.join("\n");

  // Nhật ký: thêm 2 dòng ảo — ghi chú cũ (nếu có) + thời điểm nhận yêu cầu.
  const logs = [
    ...b.logs.map((l) => ({
      id: l.id,
      dot: LOG_DOT[l.kind] ?? "bg-gray-300",
      title: l.title,
      body: l.body,
      when: formatDateTime(l.createdAt),
      who: l.by ?? "Hệ thống",
    })),
    ...(b.adminNote
      ? [{ id: "legacy-note", dot: "bg-gray-400", title: "Ghi chú", body: b.adminNote, when: "", who: "Admin" }]
      : []),
    {
      id: "created",
      dot: "bg-gray-300",
      title: `Yêu cầu mới từ ${b.ctv ? "CTV" : "website"}`,
      body: null as string | null,
      when: formatDateTime(b.createdAt),
      who: "Hệ thống",
    },
  ];

  const payPct = price != null && price > 0 ? Math.min(100, Math.round((collected / price) * 100)) : 0;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      {/* Thanh trên: quay lại + điều hướng đơn + sao chép */}
      <div className="flex flex-wrap items-center gap-2.5">
        <Link
          href="/admin/bookings"
          className="flex items-center gap-1.5 whitespace-nowrap rounded-full border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-ink hover:bg-gray-50"
        >
          <span className="text-base leading-none">←</span>Yêu cầu đặt
        </Link>
        <div className="flex items-center gap-1.5 text-[13px] text-gray-500">
          {prevB ? (
            <Link href={`/admin/bookings/${prevB.id}`} className="whitespace-nowrap rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 hover:bg-gray-50">‹ Trước</Link>
          ) : (
            <span className="whitespace-nowrap rounded-lg border border-gray-100 bg-gray-50 px-2.5 py-1.5 text-gray-300">‹ Trước</span>
          )}
          <span className="whitespace-nowrap">Đơn {newerCount + 1} / {total}</span>
          {nextB ? (
            <Link href={`/admin/bookings/${nextB.id}`} className="whitespace-nowrap rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 hover:bg-gray-50">Sau ›</Link>
          ) : (
            <span className="whitespace-nowrap rounded-lg border border-gray-100 bg-gray-50 px-2.5 py-1.5 text-gray-300">Sau ›</span>
          )}
        </div>
        <span className="flex-1" />
        <CopyChip text={b.code} label={`Chép mã ${b.code}`} toast="Đã chép mã đơn" />
        <CopyChip text={summaryText} label="Chép tóm tắt cho nhà xe" toast="Đã chép tóm tắt, dán vào Zalo nhà cung cấp" />
      </div>

      {/* Thẻ đầu: mã + badge + liên hệ + stepper */}
      <div className="flex flex-col gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="font-mono text-2xl font-extrabold tracking-tight text-ink sm:text-[28px]">{b.code}</h1>
              <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${stTone}`}>{STEPS[stepIdx]?.name ?? b.status}</span>
              <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${payTone}`}>{payText}</span>
              {b.needsConfirmation && (
                <span className="rounded-full bg-sky-100 px-2.5 py-1 text-xs font-bold text-sky-700">Cần xác nhận lại</span>
              )}
            </div>
            <p className="text-sm text-gray-500">
              Gửi lúc {formatDateTime(b.createdAt)} · từ website ·{" "}
              {b.ctv ? (
                <b className="text-ink">CTV {b.ctv.name}{b.ctv.phone ? ` · ${b.ctv.phone}` : ""}</b>
              ) : (
                <b className="text-ink">Khách tự đặt</b>
              )}{!b.ctv && " (không qua CTV)"}
            </p>
            {urgText && <p className={`text-sm font-semibold ${urgTone}`}>{urgText}</p>}
            {b.status === "CANCELLED" && b.cancelReason && (
              <p className="text-sm font-semibold text-red-600">Lý do huỷ: {b.cancelReason}</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href={`tel:${phoneDigits}`}
              className="flex items-center gap-2 whitespace-nowrap rounded-full bg-forest-700 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-sunset-500"
            >
              Gọi khách · {b.phone}
            </a>
            <a
              href={`https://zalo.me/${phoneDigits}`}
              target="_blank"
              rel="noopener noreferrer"
              className="whitespace-nowrap rounded-full bg-sunset-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-sunset-600"
            >
              Zalo
            </a>
            <CopyChip text={customerMsg} label="Chép tin nhắn cho khách" toast="Đã chép tin nhắn mẫu" className="border-[1.5px] py-2.5" />
            <CopyChip text={confirmMsg} label="Chép xác nhận chốt đơn" toast="Đã chép nội dung xác nhận gửi khách" className="border-[1.5px] border-forest-300 bg-forest-50 py-2.5 text-forest-700 hover:bg-forest-100" />
          </div>
        </div>

        {/* Stepper tiến trình */}
        <div className="grid grid-cols-5 gap-1">
          {STEPS.map((st, i) => {
            const cancelled = b.status === "CANCELLED";
            const active = cancelled ? i === 4 : i <= stepIdx;
            return (
              <div key={st.value} className="flex flex-col gap-1.5 px-0.5">
                <div className={`h-1.5 rounded-full ${active ? st.bar : "bg-gray-200"}`} />
                <div className={`truncate text-xs font-bold ${active ? "text-ink" : "text-gray-400"}`}>{st.name}</div>
                <div className="truncate text-[11px] text-gray-400">
                  {i === 0
                    ? formatDateTime(b.createdAt)
                    : (cancelled ? i === 4 : i === stepIdx)
                      ? formatDateTime(b.updatedAt)
                      : !cancelled && i === stepIdx + 1
                        ? "Bước tiếp theo"
                        : ""}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* CỘT TRÁI */}
        <div className="flex min-w-0 flex-col gap-4">
          {/* Khách hàng */}
          <section className="flex flex-col gap-3 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5 sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-extrabold text-ink">Khách hàng</h2>
              <span className="text-xs font-semibold text-gray-500">
                {pastCount > 0 ? `Đã đặt ${pastCount} lần trước` : "Khách mới, lần đầu đặt"}
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-forest-500 font-extrabold text-white">
                  {b.customerName.trim().charAt(0).toUpperCase() || "?"}
                </div>
                <div>
                  <div className="text-xs text-gray-500">Tên khách</div>
                  <div className="font-bold text-ink">{b.customerName}</div>
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Số điện thoại</div>
                <a href={`tel:${phoneDigits}`} className="font-mono font-bold text-forest-700">{b.phone}</a>
              </div>
              <div>
                <div className="text-xs text-gray-500">Số khách</div>
                <div className="font-bold text-ink">{b.quantity} {b.category === "HOMESTAY" || b.category === "COMBO" ? "người" : ""}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Ghi chú của khách</div>
                <div className={`text-sm font-semibold ${customerNote ? "text-ink" : "italic text-gray-400"}`}>{customerNote || "Không có"}</div>
              </div>
            </div>
          </section>

          {/* Dịch vụ trong đơn */}
          <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
            <div className="flex flex-wrap items-start justify-between gap-2 px-5 pb-3 pt-5 sm:px-6">
              <div>
                <div className="text-xs font-bold uppercase tracking-wide text-gray-500">{cat.label}</div>
                <h2 className="mt-1 text-lg font-extrabold tracking-tight text-ink">{b.serviceTitle}</h2>
              </div>
              <div className="text-right">
                <div className="text-xs text-gray-500">Dùng dịch vụ</div>
                <div className="font-extrabold text-ink">
                  {formatDate(b.useDate)}{b.endDate ? ` → ${formatDate(b.endDate)}` : ""}
                </div>
              </div>
            </div>
            <div className="flex flex-col">
              {parts.map((p) => (
                <div key={p.key} className="grid gap-3 border-t border-gray-100 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:px-6">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className={`flex h-10 w-10 flex-none items-center justify-center rounded-xl text-xs font-extrabold ${p.icTone}`}>{p.ic}</div>
                    <div className="min-w-0">
                      <div className="font-bold text-ink">{p.name}</div>
                      {p.routeLines.length > 0 && (
                        <div className="mt-1 flex flex-col gap-1">
                          {p.routeLines.map((r) => (
                            <div key={r} className="flex items-center gap-1.5 text-[13px] font-semibold text-ink">
                              <span className="flex-none text-sky-500">📍</span>
                              <span className="leading-snug">{r}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="mt-0.5 text-[13px] leading-relaxed text-gray-500">{p.detail}</div>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {p.chips.map((c) => (
                          <span key={c} className="whitespace-nowrap rounded-full bg-forest-50 px-2.5 py-1 text-xs font-semibold text-forest-700">{c}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-start gap-1.5 sm:items-end">
                    <div className="whitespace-nowrap font-extrabold text-ink">{p.price != null ? formatPrice(p.price) : "—"}</div>
                    <div className={`flex items-center gap-1.5 whitespace-nowrap text-xs font-bold ${b.inventoryApplied ? "text-forest-600" : "text-amber-600"}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${b.inventoryApplied ? "bg-forest-500" : "bg-amber-500"}`} />
                      {b.inventoryApplied ? "Đã trừ tồn kho" : "Chưa trừ tồn (xác nhận để giữ)"}
                    </div>
                    <ActionForm action={toggleBookingHeld}>
                      <input type="hidden" name="id" value={b.id} />
                      <input type="hidden" name="side" value={p.heldSide} />
                      <input type="hidden" name="label" value={p.name} />
                      <button
                        className={`whitespace-nowrap rounded-full border-[1.5px] px-2.5 py-1 text-xs font-bold transition ${
                          p.held
                            ? "border-forest-400 bg-forest-50 text-forest-700"
                            : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                        }`}
                      >
                        {p.held ? "Nhà cung cấp đã giữ ✓" : "Đánh dấu đã giữ chỗ"}
                      </button>
                    </ActionForm>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 bg-gray-50 px-5 py-3.5 sm:px-6">
              <div className="text-[13px] text-gray-500">Giá tham khảo tại thời điểm đặt · chưa gồm phụ thu nếu có</div>
              <div className="flex items-baseline gap-2">
                <span className="text-[13px] text-gray-500">Tổng</span>
                <span className="text-[22px] font-extrabold tracking-tight text-sunset-600">{formatPrice(price)}</span>
              </div>
            </div>
          </section>

          {/* Nhật ký xử lý */}
          <section className="flex flex-col gap-3.5 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5 sm:px-6">
            <h2 className="text-base font-extrabold text-ink">Nhật ký xử lý</h2>
            <NoteForm id={b.id} />
            <div className="flex flex-col">
              {logs.map((l) => (
                <div key={l.id} className="grid grid-cols-[18px_minmax(0,1fr)] gap-3 border-t border-gray-100 py-2.5">
                  <div className="flex flex-col items-center pt-1.5">
                    <span className={`h-2.5 w-2.5 flex-none rounded-full ${l.dot}`} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap justify-between gap-x-2">
                      <span className="text-sm font-bold text-ink">{l.title}</span>
                      <span className="whitespace-nowrap text-xs text-gray-400">{l.when}{l.when && " · "}{l.who}</span>
                    </div>
                    {l.body && <div className="mt-0.5 text-sm leading-relaxed text-gray-600">{l.body}</div>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* CỘT PHẢI */}
        <div className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-4">
          {/* Trạng thái đơn */}
          <section className="flex flex-col gap-3 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
            <h2 className="text-base font-extrabold text-ink">Trạng thái đơn</h2>
            <StatusPanel id={b.id} status={b.status} cancelReason={b.cancelReason} />
          </section>

          {/* Thanh toán */}
          <section className="flex flex-col gap-3 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-extrabold text-ink">Thanh toán</h2>
              <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${payTone}`}>{payText}</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-gray-100">
              <div className="h-full rounded-full bg-forest-500 transition-all" style={{ width: `${payPct}%` }} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <div className="text-[11px] text-gray-500">Giá đơn</div>
                <div className="text-[15px] font-extrabold text-ink">{formatPrice(price)}</div>
              </div>
              <div>
                <div className="text-[11px] text-gray-500">Đã thu</div>
                <div className="text-[15px] font-extrabold text-forest-700">{formatPrice(collected)}</div>
              </div>
              <div>
                <div className="text-[11px] text-gray-500">Còn thiếu</div>
                <div className={`text-[15px] font-extrabold ${due != null && due > 0 ? "text-sunset-600" : "text-forest-700"}`}>
                  {due != null ? formatPrice(due) : "—"}
                </div>
              </div>
            </div>
            <PaymentRecordForm id={b.id} price={price} collected={collected} />
            {b.category === "COMBO" && (b.roomAmount != null || b.busAmount != null) && (
              <div className="flex flex-col gap-1.5 text-[13px]">
                <div className="text-xs font-bold text-gray-500">Chia tiền cho nhà cung cấp</div>
                {outTrip && (
                  <div className="flex justify-between gap-2">
                    <span className="text-gray-500">{outTrip.service.title} (vé)</span>
                    <b className="text-ink">{formatPrice(b.busAmount)}</b>
                  </div>
                )}
                {b.service && (
                  <div className="flex justify-between gap-2">
                    <span className="text-gray-500">{b.service.title} (phòng)</span>
                    <b className="text-ink">{formatPrice(b.roomAmount)}</b>
                  </div>
                )}
                {price != null && (
                  <div className="flex justify-between gap-2 border-t border-dashed border-gray-200 pt-1.5">
                    <span className="text-gray-500">Giảm combo</span>
                    <b className="text-red-600">
                      −{formatPrice((toNumber(b.roomAmount) ?? 0) + (toNumber(b.busAmount) ?? 0) - price)}
                    </b>
                  </div>
                )}
              </div>
            )}
            {b.ctv ? (
              <div className="rounded-xl bg-gray-50 p-3 text-[13px]">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-gray-500">Hoa hồng CTV:</span>
                  <b className="text-forest-700">{formatPrice(toNumber(b.commissionAmount) ?? 0)}</b>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${b.commissionPaid ? "bg-forest-100 text-forest-700" : "bg-amber-100 text-amber-700"}`}>
                    {b.commissionPaid ? `Đã trả${b.commissionPaidAt ? ` · ${formatDate(b.commissionPaidAt)}` : ""}` : "Chưa trả"}
                  </span>
                </div>
                <form action={setBookingCommissionPaid} className="pt-2">
                  <input type="hidden" name="id" value={b.id} />
                  <input type="hidden" name="paid" value={b.commissionPaid ? "false" : "true"} />
                  {b.commissionPaid ? (
                    <button className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50">↩ Đánh dấu CHƯA trả hoa hồng</button>
                  ) : (
                    <button className="rounded-lg bg-forest-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-forest-800">✓ Đã trả hoa hồng cho CTV</button>
                  )}
                </form>
              </div>
            ) : (
              <div className="text-xs text-gray-500">CTV: Khách tự đặt → không tính hoa hồng</div>
            )}
          </section>

          {/* Nhà cung cấp */}
          <section className="flex flex-col gap-3 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
            <h2 className="text-base font-extrabold text-ink">Nhà cung cấp</h2>
            {sups.length === 0 && (
              <p className="text-sm text-gray-500">Bài đăng đã bị xoá. Tên lúc đặt: {b.serviceTitle}</p>
            )}
            {sups.map((su) => (
              <div key={su.serviceId + su.kind} className="flex flex-col gap-2 rounded-xl border border-gray-200 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs text-gray-500">{su.kind}</div>
                    <Link href={`/admin/services/${su.serviceId}`} className="font-bold text-ink hover:text-forest-700">{su.name}</Link>
                    {su.owner && <div className="text-[13px] text-gray-500">{su.owner}</div>}
                  </div>
                  <span className={`whitespace-nowrap rounded-full px-2 py-1 text-[11px] font-bold ${su.held ? "bg-forest-100 text-forest-700" : "bg-amber-100 text-amber-700"}`}>
                    {su.held ? "Đã giữ chỗ" : "Chờ nhà cung cấp"}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {su.phone && (
                    <a href={`tel:${su.phone.replace(/\s/g, "")}`} className="whitespace-nowrap rounded-full bg-forest-700 px-3 py-1.5 text-[13px] font-bold text-white hover:bg-forest-800">
                      Gọi {su.phone}
                    </a>
                  )}
                  {su.zalo && (
                    <a href={`https://zalo.me/${su.zalo.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="whitespace-nowrap rounded-full bg-sunset-500 px-3 py-1.5 text-[13px] font-bold text-white hover:bg-sunset-600">
                      Zalo
                    </a>
                  )}
                  <Link href={`/admin/services/${su.serviceId}`} className="whitespace-nowrap rounded-full border-[1.5px] border-gray-200 px-3 py-1.5 text-[13px] font-bold text-gray-700 hover:bg-gray-50">
                    Bài đăng
                  </Link>
                  {su.hasCalendar && (
                    <Link href={`/admin/availability?service=${su.serviceId}`} className="whitespace-nowrap rounded-full border-[1.5px] border-gray-200 px-3 py-1.5 text-[13px] font-bold text-gray-700 hover:bg-gray-50">
                      Lịch chỗ
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </section>

          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <form action={duplicateBooking}>
              <input type="hidden" name="id" value={b.id} />
              <button className="text-[13px] font-bold text-forest-700 hover:text-forest-800">Nhân bản đơn</button>
            </form>
            <DeleteBookingButton id={b.id} code={b.code} />
          </div>
        </div>
      </div>
    </div>
  );
}
