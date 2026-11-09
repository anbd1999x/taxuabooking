import type { Metadata } from "next";
import type { BookingStatus, ServiceCategory } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/format";
import { toDateKey } from "@/lib/dates";
import { SITE } from "@/lib/site";
import { CATEGORIES } from "@/lib/constants";
import { getSettings } from "@/lib/queries";
import { bookingCabinBerths, cabinBerthsLabel, cabinBerthLines } from "@/lib/combo-pricing";
import { TraCuuLookup, type LookupOrder, type LookupPart, type LookupStatus } from "@/components/TraCuuLookup";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tra cứu đơn đặt",
  description: "Tra cứu tình trạng đơn đặt dịch vụ Tà Xùa bằng số điện thoại hoặc mã đơn.",
  alternates: { canonical: "/tra-cuu" },
};

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

function str(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

export default async function LookupPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = str(sp.q).trim();
  const digits = q.replace(/\D/g, "");
  const code = q.toUpperCase();

  // Tra theo SĐT (đủ 8+ số) hoặc theo mã đơn (TX-...). Tránh trả toàn bộ khi để trống.
  const bookings =
    q.length >= 4
      ? await prisma.bookingRequest.findMany({
          where: {
            OR: [
              ...(digits.length >= 8 ? [{ phone: digits }, { phone: { contains: digits } }] : []),
              { code },
            ],
          },
          orderBy: { createdAt: "desc" },
          take: 30,
          include: { service: { select: { slug: true, category: true } } },
        })
      : [];

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
      parts.push(
        // selectionLabel ghi "Combo: xe Nhà xe X (…)" → bỏ chữ "xe " thừa trước tên nhà xe.
        {
          k: "XE",
          name: comboLabel.slice(0, plusAt).trim().replace(/^xe\s+/i, ""),
          d: berths ? `Vé khứ hồi · ${cabinBerthsLabel(berths)}` : null,
          lines: berths ? cabinBerthLines(berths, busAmount) : undefined,
          price: busAmount,
        },
        // Phần phòng: bỏ đuôi "· xe nằm: …" (đã hiện ở phần vé xe).
        { k: "HS", name: comboLabel.slice(plusAt + 3).replace(/\s*·\s*xe nằm:.*$/i, "").trim(), d: null, price: roomAmount },
      );
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
      ? [berths.shared ? `${berths.shared} cabin đôi` : null, berths.solo ? `${berths.solo} cabin đơn` : null]
          .filter(Boolean)
          .join(" + ")
      : "";

    const payTone = b.paymentStatus === "PAID" ? "paid" : b.paymentStatus === "DEPOSITED" ? "part" : "unpaid";
    const payLabel =
      b.paymentStatus === "PAID"
        ? "Đã thanh toán"
        : b.paymentStatus === "DEPOSITED"
          ? `Đã cọc${collected ? " " + collected.toLocaleString("vi-VN") + "đ" : ""}`
          : "Chưa thanh toán";

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
        (berthsShort && (b.category === "CABIN" || b.category === "COMBO") ? ` (${berthsShort})` : ""),
      created: fmtD(b.createdAt),
      total,
      payLabel,
      payTone,
      name: b.customerName,
      phone: b.phone,
      note: b.note,
      parts,
      rebookHref,
      reviewHref: b.service?.slug ? svcHref : null,
    };
  });

  return <TraCuuLookup initialQ={q} orders={orders} phone={phone} zalo={zalo} />;
}
