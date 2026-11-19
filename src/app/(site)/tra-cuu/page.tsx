import type { Metadata } from "next";
import { pageMeta } from "@/lib/og";
import { AUTO_CANCEL_HOURS_KEY, parseAutoCancelHours } from "@/lib/auto-cancel-config";
import type { BookingStatus, ServiceCategory } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/format";
import { toDateKey } from "@/lib/dates";
import { SITE } from "@/lib/site";
import { CATEGORIES } from "@/lib/constants";
import { getSettings } from "@/lib/queries";
import { isSoldOutCancel } from "@/lib/cancel-reason";
import { bookingCabinBerths, bookingBusSeats, comboSelfTravelGuests, cabinBerthsLabel, cabinBerthLines, comboBikeFacts } from "@/lib/combo-pricing";
import { roomGroups, roomGroupLines, extraGuestNote } from "@/lib/booking-rooms";
import { partyLabel } from "@/lib/occupancy";
import { rentalDaysLabel } from "@/lib/rental-days";
import { TraCuuLookup, type LookupOrder, type LookupPart, type LookupStatus } from "@/components/TraCuuLookup";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { normalizeVnPhone } from "@/lib/phone";
import { requestIp } from "@/lib/ip-block";
import { rateLimit, underLimit } from "@/lib/rate-limit";
import { getT, lp } from "@/lib/i18n/server";
import { i18nMeta } from "@/lib/i18n/meta";

export const dynamic = "force-dynamic";

export const generateMetadata = () => i18nMeta({
  title: "Tra cứu đơn đặt",
  description: "Tra cứu tình trạng đơn đặt dịch vụ Tà Xùa bằng số điện thoại hoặc mã đơn.",
  path: "/tra-cuu",
});

const STATUS_MAP: Record<BookingStatus, LookupStatus> = {
  NEW: "new",
  CONTACTING: "contact",
  CONFIRMED: "confirmed",
  COMPLETED: "done",
  CANCELLED: "cancel",
};

/** Nhãn chip ở đầu thẻ + đơn vị số lượng theo loại dịch vụ. */
const CAT_META: Record<ServiceCategory, { ic: string; unit: string }> = {
  CABIN: { ic: "XE", unit: "khách" },
  HOMESTAY: { ic: "HS", unit: "phòng" },
  BUNGALOW: { ic: "HS", unit: "phòng" },
  MOTORBIKE: { ic: "XM", unit: "xe" },
  XEOM: { ic: "XÔ", unit: "chuyến" },
  TAXI: { ic: "TX", unit: "chuyến" },
  COMBO: { ic: "CB", unit: "khách" },
};

function fmtD(d: Date | null): string {
  if (!d) return "";
  const [y, m, day] = toDateKey(d).split("-");
  return `${day}/${m}/${y}`;
}

/** "06/11 → 08/11/2026" — gọn như thiết kế (ngày đầu bỏ năm nếu cùng năm). */
function fmtRange(from: Date, to: Date | null): string {
  const f = fmtD(from);
  if (!to) return f;
  const t = fmtD(to);
  const [fd, fm, fy] = f.split("/");
  return fy === t.split("/")[2] ? `${fd}/${fm} → ${t}` : `${f} → ${t}`;
}

const vndText = (n: number) => n.toLocaleString("vi-VN") + "đ";

function str(v:string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

export default async function LookupPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const tr = await getT();
  const sp = await searchParams;
  const q = str(sp.q).trim();
  const code = q.toUpperCase();
  // SĐT phải KHỚP ĐÚNG số di động 10 số (chuẩn hoá +84/84 → 0) — trước đây khớp chuỗi con 8 số ⇒ dò được đơn người khác.
  const ph = normalizeVnPhone(q);
  const phoneVariants = /^0\d{9}$/.test(ph) ? [ph, `84${ph.slice(1)}`, `+84${ph.slice(1)}`] : [];

  // Chống dò mã đơn (5 ký tự) / SĐT: mọi lượt tra ≤ 30 / 10 phút / IP; tra KHÔNG ra kết quả ≤ 10 / giờ / IP
  // (khách thật hiếm khi gõ sai nhiều lần, kẻ dò thì trượt gần như mọi lượt).
  const ip = requestIp(await headers()) ?? "unknown";
  const searching = q.length >= 4;
  const limited = searching && (!underLimit(`tracuu-miss:${ip}`, 10, 60 * 60_000) || !rateLimit(`tracuu:${ip}`, 30, 10 * 60_000));
  const miss = () => rateLimit(`tracuu-miss:${ip}`, 10, 60 * 60_000);

  // Mã đơn vé / đặt bàn (TX-VE-XXXXX, module Vé & đặt bàn) ⇒ mở thẳng trang vé điện tử của đơn.
  if (!limited && /^TX-VE-[A-Z0-9]{5}$/.test(code)) {
    const tk = await prisma.ticketOrder.findFirst({ where: { code, status: { not: "draft" } }, select: { token: true } });
    if (tk) redirect(await lp(`/ve/don/${tk.token}`));
  }

  // Tra theo SĐT (đúng số) hoặc theo mã đơn (TX-...). Tránh trả toàn bộ khi để trống.
  const bookings =
    searching && !limited
      ? await prisma.bookingRequest.findMany({
          where: { OR: [...(phoneVariants.length ? [{ phone: { in: phoneVariants } }] : []), { code }] },
          orderBy: { createdAt: "desc" },
          take: 30,
          include: { service: { select: { slug: true, category: true, title: true } } },
        })
      : [];
  if (searching && !limited && !bookings.length) miss();

  // Phòng cụ thể của các đơn combo (để hiện từng hạng phòng trên một dòng riêng).
  const comboRoomIds = [...new Set(bookings.filter((b) => b.category === "COMBO").flatMap((b) => (b.roomIds.length ? b.roomIds : b.roomId ? [b.roomId] : [])))];
  const roomRows = comboRoomIds.length
    ? await prisma.room.findMany({ where: { id: { in: comboRoomIds } }, select: { id: true, name: true, roomType: { select: { name: true } } } })
    : [];
  const roomById = new Map(roomRows.map((r) => [r.id, r]));

  const settings = await getSettings();
  const phone = settings.contactPhone || SITE.defaultPhone;
  const zalo = settings.contactZalo || SITE.defaultZalo;

  const orders: LookupOrder[] = bookings.map((b) => {
    const meta = CAT_META[b.category];
    const total = toNumber(b.referencePrice);
    const collected = toNumber(b.amountCollected);

    // Đơn combo: tách 2 phần (vé xe / phòng) theo busAmount + roomAmount;
    // tên từng bên lấy từ selectionLabel ("Combo: xe … (…) + Homestay · …, …").
    const parts: LookupPart[] = [];
    const busAmount = toNumber(b.busAmount);
    const roomAmount = toNumber(b.roomAmount);
    // Cách nằm xe cabin: cabin đôi (nằm ghép) / cabin đơn (nằm riêng, ×2 giá vé).
    const berths = bookingCabinBerths(b);
    const comboLabel = b.selectionLabel?.replace(/^Combo:\s*/i, "");
    const plusAt = comboLabel?.indexOf(" + ") ?? -1;
    if (b.category === "COMBO" && comboLabel && plusAt > 0) {
      // Phần XE: "xe Nhà xe X (đi dd/mm/yyyy hh:mm, về …, đón tại …)" ⇒ tên nhà xe riêng, lịch xe xuống dòng mô tả.
      const busRaw = comboLabel.slice(0, plusAt).trim().replace(/^xe\s+/i, "");
      const busHead = /^(.+?) \((.+)\)$/.exec(busRaw);
      const selfTravel = comboSelfTravelGuests(b);
      // Phần PHÒNG: đủ dữ liệu phòng ⇒ tên homestay + từng hạng phòng một dòng; thiếu (phòng đã xoá) ⇒ nhãn cũ.
      const ids = b.roomIds.length ? b.roomIds : b.roomId ? [b.roomId] : [];
      const rooms = ids.map((id) => roomById.get(id)).filter((r): r is NonNullable<typeof r> => !!r);
      const roomsOk = rooms.length > 0 && rooms.length === ids.length;
      const extraNote = extraGuestNote(b.selectionLabel);
      // Nhãn cũ của phần phòng: bỏ đuôi "· xe nằm: …" (đã hiện ở phần vé xe).
      const stayLegacy = comboLabel.slice(plusAt + 3).replace(/\s*·\s*xe nằm:.*$/i, "").trim();
      const guests = b.adults != null ? partyLabel(b.adults, b.childrenAges ?? [], tr) : `${b.quantity} ${tr("khách")}`;
      parts.push(
        {
          k: "XE",
          name: busHead ? busHead[1] : busRaw,
          d:
            [busHead ? busHead[2] : null, berths ? tr("Vé khứ hồi · {0}", [cabinBerthsLabel(berths, tr)]) : null]
              .filter(Boolean)
              .join(" · ") || null,
          lines: [
            ...(berths ? cabinBerthLines(berths, busAmount) : []),
            ...(selfTravel > 0 ? [tr("{0} khách tự đi xe riêng (không có vé xe trong đơn)", [selfTravel])] : []),
          ],
          price: busAmount,
        },
        roomsOk
          ? {
              k: "HS",
              name: b.service?.title ?? stayLegacy.split(" · ")[0],
              d: tr("Nhận phòng {0} · Trả phòng {1} · {2} đêm · {3}", [fmtD(b.useDate), fmtD(b.endDate), b.nights ?? 1, guests]),
              lines: [...roomGroupLines(roomGroups(rooms)), ...(extraNote ? [extraNote] : [])],
              price: roomAmount,
            }
          : { k: "HS", name: stayLegacy, d: null, price: roomAmount },
      );
      // Xe máy thuê kèm (dịch vụ tính riêng, không nằm trong tổng đơn) — hiện như màn "Đã gửi yêu cầu combo".
      const bike = comboBikeFacts(b);
      if (bike) {
        const days = rentalDaysLabel(bike.days, tr);
        parts.push({
          k: "XM",
          name: `${tr("🏍️ Thuê xe máy")} ${tr(bike.name)} ${tr("(dịch vụ kèm · tính riêng)")}`,
          d:
            (bike.pickup && bike.ret && bike.perDay
              ? tr("{0} · {1} xe × {2} × {3} · nhận {4}, trả {5}", [tr(bike.name), bike.count, days, vndText(bike.perDay), bike.pickup, bike.ret])
              : `${bike.count} xe × ${days}`) +
            " — " +
            tr("giá tham khảo, chưa phải giá cuối") +
            tr(". Dịch vụ đi kèm, tính riêng, không nằm trong bill combo; giá chính thức tính theo giờ sử dụng xe thực tế, thanh toán trực tiếp khi giao xe."),
          price: bike.amount,
        });
      }
    } else {
      parts.push({
        k: meta.ic,
        name: b.serviceTitle,
        d: b.selectionLabel,
        lines: b.category === "CABIN" && berths ? cabinBerthLines(berths, total) : undefined,
        price: total,
      });
    }
    const berthsShort = berths
      ? [berths.shared ? tr("{0} cabin đôi", [berths.shared]) : null, berths.solo ? tr("{0} cabin đơn", [berths.solo]) : null]
          .filter(Boolean)
          .join(" + ")
      : "";

    const payTone = b.paymentStatus === "PAID" ? "paid" : b.paymentStatus === "DEPOSITED" ? "part" : "unpaid";
    const payLabel =
      b.paymentStatus === "PAID"
        ? tr("Đã thanh toán")
        : b.paymentStatus === "DEPOSITED"
          ? tr("Đã cọc{0}", [collected ? " " + collected.toLocaleString("vi-VN") + tr("đ") : ""])
          : tr("Chưa thanh toán");

    // "Đặt lại": combo về trang combo; còn lại về trang dịch vụ (nếu còn) / danh mục.
    const catSlug = CATEGORIES[(b.service?.category ?? b.category) as ServiceCategory].slug;
    const svcHref = b.service?.slug ? `/${catSlug}/${b.service.slug}` : `/${catSlug}`;
    const rebookHref = b.category === "COMBO" ? "/combo" : svcHref;

    return {
      code: b.code,
      st: STATUS_MAP[b.status],
      ic: meta.ic,
      title: b.serviceTitle,
      when: fmtRange(b.useDate, b.endDate),
      pax:
        `${b.quantity} ${meta.unit}` +
        (b.category === "COMBO" && bookingBusSeats(b) !== b.quantity ? ` · ${bookingBusSeats(b)} vé xe` : "") +
        (berthsShort && (b.category === "CABIN" || b.category === "COMBO") ? ` (${berthsShort})` : ""),
      created: fmtD(b.createdAt),
      total,
      payLabel,
      payTone,
      name: b.customerName,
      phone: b.phone,
      note: b.note,
      // Đơn đã huỷ: lý do (để khách biết vì sao) + cờ "hết phòng" khi phòng đã có khách khác đặt.
      cancelReason: b.status === "CANCELLED" ? b.cancelReason ?? null : null,
      soldOut: b.status === "CANCELLED" && isSoldOutCancel(b.cancelReason),
      parts,
      rebookHref,
      reviewHref: b.service?.slug ? svcHref : null,
    };
  });

  return (
    <>
      {limited && (
        <div role="alert" className="mx-auto mt-4 max-w-3xl rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {tr("Bạn tra cứu quá nhiều lần. Vui lòng thử lại sau ít phút hoặc gọi {0} để được hỗ trợ.", [phone])}
        </div>
      )}
      <TraCuuLookup initialQ={q} orders={orders} phone={phone} zalo={zalo} autoCancelHours={parseAutoCancelHours(settings[AUTO_CANCEL_HOURS_KEY])} />
    </>
  );
}
