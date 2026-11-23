import { rentalOriginalTotal } from "./rental-days";
import { rentalListPriceMap } from "./rental-list-price";
import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { parseDateOnly, addDays, toDateKey } from "./dates";
import { toNumber } from "./format";
import { bookingBusSeats, comboSideCollected } from "./combo-pricing";
import { bookingPax, durationLabel, isRentalCategory } from "./occupancy";
import { resolveBusCommissions, resolveRoomCommissions } from "./provider-commission";
import { effectiveDiscounts, supplierPayouts } from "./supplier-payout";
import { CATEGORIES } from "./constants";

/** Một dòng thống kê (tổng, theo CTV, hoặc theo chủ dịch vụ). */
export interface StatRow {
  id: string;
  name: string;
  orders: number; // tổng đơn (trừ đơn huỷ)
  completed: number; // đơn hoàn thành
  awaiting: number; // đơn chưa thanh toán đủ (còn nợ)
  revenue: number; // doanh thu = giá trị đơn đã chốt (giữ phòng/hoàn thành)
  collected: number; // đã thu
  outstanding: number; // còn thiếu (doanh thu − đã thu)
  commission: number; // hoa hồng CTV (đơn đã chốt)
  commissionUnpaid: number; // hoa hồng chưa trả CTV
  discount: number; // tổng chiết khấu đã trừ khỏi doanh thu (phạm vi chủ dịch vụ)
  listTotal: number; // tổng TIỀN GỐC (giá gạch admin cấu hình; không có thì giá bán) của đơn đã chốt
  // ---- Doanh thu SÀN (admin) — chỉ đơn đã chốt ----
  homeDiscount: number; // chiết khấu homestay cho sàn (theo phòng/đêm)
  busDiscount: number; // chiết khấu nhà xe cho sàn (theo khách/chiều)
  platformProfit: number; // lợi nhuận sàn = homeDiscount + busDiscount − hoa hồng CTV
}

/** Thanh toán của SÀN cho một dịch vụ (homestay / nhà xe / …) — chỉ đơn đã chốt. */
export interface ServicePayRow {
  id: string;
  name: string;
  kind: string; // Homestay / Nhà xe / …
  orders: number;
  total: number; // tổng tiền bán ra phần của dịch vụ
  discount: number; // chiết khấu để lại cho sàn
  payable: number; // phải thanh toán = total − discount
  paid: number; // sàn đã thanh toán
  remaining: number; // còn chưa thanh toán
  owner: string | null; // tên chủ dịch vụ
  lines: PayLine[]; // từng đơn (bấm vào dòng để xem)
}

/** Một đơn trong phần chi tiết của bảng thanh toán / bảng theo chủ dịch vụ (tính theo BÊN của dịch vụ đó). */
export interface PayLine {
  id: string;
  code: string;
  customer: string;
  service: string; // tên dịch vụ (bảng theo chủ có thể gồm nhiều dịch vụ)
  side: "room" | "bus";
  combo: boolean;
  status: string;
  useDate: string; // yyyy-mm-dd
  endDate: string | null;
  createdAt: string; // ISO
  total: number; // tiền bán ra phần của bên này
  discount: number;
  payable: number;
  paid: number; // sàn đã trả
  remaining: number;
  collected: number; // tiền khách đã trả phần của bên này
  // ---- chi tiết cho báo cáo xuất Excel ----
  phone: string;
  detail: string; // mô tả lựa chọn (phòng / chuyến / xe…)
  pax: string; // "2 khách" / "1 xe"…
  duration: string | null; // "2 đêm" / "2 ngày thuê"
  collector: "PLATFORM" | "PROVIDER"; // ai thu tiền khách
  providerOwes: number; // chủ dịch vụ phải chuyển lại sàn (khi tự thu / giữ tiền)
  paymentStatus: string; // UNPAID / DEPOSITED / PAID (khách trả sàn)
}

/** Lọc theo NGÀY SỬ DỤNG (nhận phòng / đi / thuê) hay NGÀY TẠO ĐƠN (giờ Việt Nam). */
export type StatsDateBy = "use" | "created";

export interface StatsResult {
  totals: StatRow;
  byCtv: StatRow[];
  byProvider: (StatRow & { lines: PayLine[] })[]; // rỗng khi xem ở phạm vi một chủ dịch vụ
  byService: ServicePayRow[]; // rỗng khi xem ở phạm vi một chủ dịch vụ
}

function emptyRow(id: string, name: string): StatRow {
  return {
    id, name, orders: 0, completed: 0, awaiting: 0, revenue: 0, collected: 0, outstanding: 0,
    commission: 0, commissionUnpaid: 0, discount: 0, listTotal: 0, homeDiscount: 0, busDiscount: 0, platformProfit: 0,
  };
}

type Bk = {
  status: string;
  paymentStatus: string;
  referencePrice: unknown;
  amountCollected: unknown;
  ctvId: string | null;
  commissionAmount: unknown;
  commissionPaid: boolean;
  roomCommission: unknown; // chiết khấu từng căn (trừ khỏi doanh thu khi xem ở phạm vi chủ dịch vụ)
  busCommission: unknown; // chiết khấu nhà xe (trừ khỏi doanh thu nhà xe ở phạm vi chủ dịch vụ)
  originalTotal?: number | null; // tiền gốc (giá gạch) của đơn — xe máy: giá gốc/ngày × số xe × số ngày
};

/**
 * Đơn COMBO nhìn từ MỘT BÊN: doanh thu = phần tiền của bên đó (home = tiền
 * phòng, nhà xe = tiền vé); coi là đã thu đủ khi khách thanh toán đủ; hoa hồng
 * CTV chỉ tính cho phía homestay.
 */
function comboSideView(
  b: Bk & { roomAmount: unknown; busAmount: unknown },
  side: "home" | "bus",
): Bk {
  const amount = toNumber((side === "home" ? b.roomAmount : b.busAmount) as never) ?? 0;
  return {
    status: b.status,
    paymentStatus: b.paymentStatus,
    referencePrice: amount,
    // Đã cọc ⇒ bên này nhận 50% phần tiền của mình; thanh toán đủ ⇒ nhận đủ.
    amountCollected: comboSideCollected(b.paymentStatus, toNumber(b.amountCollected as never), amount),
    ctvId: side === "home" ? b.ctvId : null,
    commissionAmount: side === "home" ? b.commissionAmount : null,
    commissionPaid: b.commissionPaid,
    // Chiết khấu từng căn chỉ thuộc phần tiền phòng (phía homestay); vé xe không có.
    roomCommission: side === "home" ? b.roomCommission : null,
    // Chiết khấu nhà xe chỉ thuộc phần tiền vé (phía nhà xe).
    busCommission: side === "bus" ? b.busCommission : null,
  };
}

/**
 * net = true (phạm vi một chủ dịch vụ): doanh thu / đã thu / còn thiếu tính theo
 * TIỀN THỰC NHẬN = tiền bán ra − chiết khấu từng căn. net = false (admin tổng): giữ gross.
 */
function accumulate(row: StatRow, b: Bk, net = false) {
  if (b.status === "CANCELLED") return; // đơn huỷ không tính
  const gross = toNumber(b.referencePrice as never) ?? 0;
  const homeDisc = toNumber(b.roomCommission as never) ?? 0;
  const busDisc = toNumber(b.busCommission as never) ?? 0;
  const discount = net ? homeDisc + busDisc : 0;
  const price = Math.max(0, gross - discount); // thực nhận của đơn
  const rawCollected = toNumber(b.amountCollected as never) ?? 0;
  // Tiền đã thu quy về thực nhận: không vượt quá tiền thực nhận của đơn.
  const collected = net ? Math.min(rawCollected, price) : rawCollected;
  const isChot = b.status === "CONFIRMED" || b.status === "COMPLETED";

  row.orders += 1;
  if (b.status === "COMPLETED") row.completed += 1;
  if (b.paymentStatus !== "PAID") row.awaiting += 1;
  row.collected += collected;
  if (isChot) {
    row.revenue += price;
    row.discount += discount;
    row.listTotal += b.originalTotal ?? gross;
    row.outstanding += Math.max(0, price - collected);
    row.homeDiscount += homeDisc;
    row.busDiscount += busDisc;
    row.platformProfit += homeDisc + busDisc;
    if (b.ctvId) {
      const comm = toNumber(b.commissionAmount as never) ?? 0;
      row.commission += comm;
      row.platformProfit -= comm;
      if (!b.commissionPaid) row.commissionUnpaid += comm;
    }
  }
}

/**
 * Id các đơn THUỘC một chủ dịch vụ: đơn của dịch vụ họ sở hữu + đơn (vd COMBO gắn serviceId homestay) đi qua
 * CHUYẾN cabin của nhà xe họ. Lọc hẳn trong DB bằng subquery (BookingRequest.cabinTripId không có relation
 * Prisma) — không nạp toàn bộ id CabinTrip rồi IN(...) như trước (danh sách chuyến lớn dần theo ngày).
 * Kết quả sắp createdAt giảm dần; `limit` để lấy N đơn mới nhất.
 */
export async function ownerBookingIds(
  ownerId: string,
  opts: { from?: Date; toExclusive?: Date; useFrom?: Date; useTo?: Date; statuses?: string[]; limit?: number } = {},
): Promise<string[]> {
  const trips = Prisma.sql`SELECT t.id FROM "CabinTrip" t JOIN "Service" s ON s.id = t."serviceId" WHERE s."ownerId" = ${ownerId} AND s."category" = 'CABIN'`;
  const conds: Prisma.Sql[] = [
    Prisma.sql`(b."serviceId" IN (SELECT id FROM "Service" WHERE "ownerId" = ${ownerId}) OR b."cabinTripId" IN (${trips}) OR b."cabinReturnTripId" IN (${trips}))`,
  ];
  if (opts.from) conds.push(Prisma.sql`b."createdAt" >= ${opts.from}`);
  if (opts.toExclusive) conds.push(Prisma.sql`b."createdAt" < ${opts.toExclusive}`);
  if (opts.useFrom) conds.push(Prisma.sql`b."useDate" >= ${opts.useFrom}`);
  if (opts.useTo) conds.push(Prisma.sql`b."useDate" <= ${opts.useTo}`);
  if (opts.statuses?.length) conds.push(Prisma.sql`b."status"::text IN (${Prisma.join(opts.statuses)})`);
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT b.id FROM "BookingRequest" b
    WHERE ${Prisma.join(conds, " AND ")}
    ORDER BY b."createdAt" DESC
    ${opts.limit ? Prisma.sql`LIMIT ${opts.limit}` : Prisma.empty}`;
  return rows.map((r) => r.id);
}

/** Lệch múi giờ Việt Nam: ngày tạo đơn tính theo giờ VN (createdAt lưu UTC). */
const VN_OFFSET_MS = 7 * 3_600_000;

/** Điều kiện ngày của thống kê (dùng chung với trang Yêu cầu đặt khi bấm xem đơn). */
export function statsDateWhere(fromKey: string, toKey: string, by: StatsDateBy): Prisma.BookingRequestWhereInput {
  const from = parseDateOnly(fromKey);
  const to = parseDateOnly(toKey);
  if (by === "use") return { useDate: { gte: from, lte: to } };
  // 00:00 giờ VN = 17:00 UTC hôm trước.
  return { createdAt: { gte: new Date(from.getTime() - VN_OFFSET_MS), lt: new Date(addDays(to, 1).getTime() - VN_OFFSET_MS) } };
}

/**
 * Thống kê theo mốc thời gian — `by` = "use" (ngày sử dụng, mặc định) hoặc "created" (ngày tạo đơn, giờ VN).
 * ownerId != null ⇒ phạm vi một chủ dịch vụ (chỉ đơn của dịch vụ họ sở hữu, không trả bảng theo chủ).
 */
export async function computeStats(
  fromKey: string,
  toKey: string,
  ownerId?: string | null,
  by: StatsDateBy = "use",
): Promise<StatsResult> {
  const dateWhere = statsDateWhere(fromKey, toKey, by);
  const created = dateWhere.createdAt as { gte: Date; lt: Date } | undefined;

  // Nhà xe: đơn COMBO gắn serviceId homestay nhưng đi qua CHUYẾN của nhà xe ⇒ lọc phạm vi chủ trong DB.
  const ownerIds = ownerId
    ? await ownerBookingIds(
        ownerId,
        created
          ? { from: created.gte, toExclusive: created.lt }
          : { useFrom: parseDateOnly(fromKey), useTo: parseDateOnly(toKey) },
      )
    : null;

  const bookings = await prisma.bookingRequest.findMany({
    where: {
      ...dateWhere,
      ...(ownerIds ? { id: { in: ownerIds } } : {}),
    },
    orderBy: { useDate: "asc" },
    select: {
      id: true,
      code: true,
      customerName: true,
      phone: true,
      selectionLabel: true,
      adults: true,
      childrenAges: true,
      createdAt: true,
      category: true,
      status: true,
      paymentStatus: true,
      referencePrice: true,
      roomAmount: true,
      busAmount: true,
      cabinTripId: true,
      amountCollected: true,
      ctvId: true,
      ctv: { select: { name: true } },
      commissionAmount: true,
      commissionPaid: true,
      roomCommission: true,
      busCommission: true,
      cabinReturnTripId: true,
      quantity: true,
      // Thuê xe máy: cần để tính bù chiết khấu cho sàn (đ/xe/ngày) ở đơn chưa có snapshot.
      serviceId: true,
      nights: true,
      rentalDays: true,
      rentalVehicleId: true,
      seatsSingle: true,
      seatsDouble: true,
      cabinShared: true,
      cabinSolo: true,
      roomId: true,
      roomIds: true,
      useDate: true,
      endDate: true,
      serviceTitle: true,
      paidToRoom: true,
      paidToBus: true,
      payableRoomOverride: true,
      payableBusOverride: true,
      surcharges: true, // tiền chủ dịch vụ thu thêm (chịu chiết khấu cùng tỉ lệ)
      collector: true,
      service: { select: { id: true, title: true, category: true, ownerId: true, originalPrice: true, owner: { select: { name: true } } } },
    },
  });

  // Thay chiết khấu home / nhà xe bằng giá trị hiệu lực (snapshot, hoặc tính bù cho đơn
  // cũ chưa có snapshot) — để tiền thực nhận của chủ dịch vụ & doanh thu sàn đúng ngay.
  const [roomDisc, busDisc, listPrices] = await Promise.all([resolveRoomCommissions(bookings), resolveBusCommissions(bookings), rentalListPriceMap(bookings)]);
  // Chiết khấu GỐC (chưa gồm phần thu thêm) cho supplierPayouts — hàm đó tự cộng phần thu thêm,
  // truyền số hiệu lực vào sẽ bị trừ 2 lần.
  const rawDisc = new Map<string, { room: number; bus: number }>();
  for (const b of bookings) {
    rawDisc.set(b.id, { room: roomDisc.get(b.id) ?? 0, bus: busDisc.get(b.id) ?? 0 });
    // Admin sửa tay số phải trả ⇒ chiết khấu hiệu lực = bán ra − số sửa tay (khớp báo cáo thanh toán).
    const eff = effectiveDiscounts(b, roomDisc.get(b.id) ?? 0, busDisc.get(b.id) ?? 0);
    (b as { roomCommission: unknown }).roomCommission = eff.room;
    (b as { busCommission: unknown }).busCommission = eff.bus;
    (b as { originalTotal?: number | null }).originalTotal = rentalOriginalTotal(b, listPrices.get(b.rentalVehicleId ?? ""));
  }

  // Chủ nhà xe của các đơn combo (tra theo chuyến đi) — cho bảng theo chủ dịch vụ.
  const comboTripIds = [
    ...new Set(bookings.filter((b) => b.category === "COMBO" && b.cabinTripId).map((b) => b.cabinTripId!)),
  ];
  const tripOwner = new Map<string, { id: string; name: string }>();
  const tripService = new Map<string, { id: string; title: string }>(); // nhà xe chạy chuyến (combo)
  if (!ownerId && comboTripIds.length) {
    const trips = await prisma.cabinTrip.findMany({
      where: { id: { in: comboTripIds } },
      select: { id: true, service: { select: { id: true, title: true, ownerId: true, owner: { select: { name: true } } } } },
    });
    for (const t of trips) {
      tripOwner.set(t.id, {
        id: t.service.ownerId ?? "_none",
        name: t.service.owner?.name ?? "Chưa gán chủ dịch vụ",
      });
      tripService.set(t.id, { id: t.service.id, title: t.service.title });
    }
  }
  const byService = new Map<string, ServicePayRow>();

  const totals = emptyRow("_all", "Tổng");
  const byCtv = new Map<string, StatRow>();
  const byProvider = new Map<string, StatRow & { lines: PayLine[] }>();
  const provRow = (id: string, name: string) => {
    const r = byProvider.get(id) ?? { ...emptyRow(id, name), lines: [] };
    byProvider.set(id, r);
    return r;
  };

  // Phạm vi một chủ dịch vụ ⇒ tính theo tiền THỰC NHẬN (trừ chiết khấu từng căn).
  const net = !!ownerId;

  for (const b of bookings) {
    const isCombo = b.category === "COMBO";
    // Phạm vi MỘT chủ dịch vụ: đơn combo chỉ tính PHẦN TIỀN của bên đó.
    const scoped =
      ownerId && isCombo ? comboSideView(b, b.service?.ownerId === ownerId ? "home" : "bus") : b;

    accumulate(totals, scoped, net);

    const ck = b.ctvId ?? "_none";
    const cn = b.ctv?.name ?? "Khách tự đặt (không qua CTV)";
    const crow = byCtv.get(ck) ?? emptyRow(ck, cn);
    accumulate(crow, scoped, net);
    byCtv.set(ck, crow);

    if (ownerId) continue;

    // Tiền từng bên của đơn (combo = homestay + nhà xe).
    const raw = rawDisc.get(b.id) ?? { room: 0, bus: 0 };
    const sides = supplierPayouts(b, raw.room, raw.bus);
    const isChot = b.status === "CONFIRMED" || b.status === "COMPLETED";

    for (const s of sides) {
      const comboBus = isCombo && s.side === "bus";
      const svc = comboBus
        ? (b.cabinTripId ? tripService.get(b.cabinTripId) : undefined)
        : b.service
          ? { id: b.service.id, title: b.service.title }
          : undefined;
      const svcName = svc?.title ?? (comboBus ? "Nhà xe (chưa gán chuyến)" : `${b.serviceTitle} (đã xoá bài đăng)`);
      const line: PayLine = {
        id: b.id,
        code: b.code,
        customer: b.customerName,
        service: svcName,
        side: s.side,
        combo: isCombo,
        status: b.status,
        useDate: toDateKey(b.useDate),
        endDate: b.endDate ? toDateKey(b.endDate) : null,
        createdAt: b.createdAt.toISOString(),
        total: s.gross,
        discount: s.discount,
        payable: s.payable,
        paid: s.paid,
        remaining: s.remaining,
        collected: isCombo
          ? comboSideCollected(b.paymentStatus, toNumber(b.amountCollected), s.gross)
          : toNumber(b.amountCollected) ?? 0,
        phone: b.phone,
        detail: b.selectionLabel ?? "",
        pax: isRentalCategory(b.category)
          ? `${b.quantity} xe`
          : comboBus
            ? `${bookingBusSeats(b)} vé`
            : ["HOMESTAY", "BUNGALOW", "COMBO", "CABIN"].includes(b.category)
              ? `${bookingPax(b)} khách`
              : `SL ${b.quantity}`,
        duration: durationLabel(b),
        collector: s.collector,
        providerOwes: s.providerOwes,
        paymentStatus: b.paymentStatus,
      };

      // Thanh toán cho từng dịch vụ: chỉ đơn đã chốt.
      if (isChot) {
        const key = svc?.id ?? (comboBus ? "_bus" : `_t:${b.serviceTitle}`);
        const row =
          byService.get(key) ??
          {
            id: key,
            name: svcName,
            kind: s.side === "bus" ? "Nhà xe" : isCombo ? "Homestay" : CATEGORIES[b.service?.category ?? b.category].shortLabel,
            orders: 0, total: 0, discount: 0, payable: 0, paid: 0, remaining: 0, lines: [],
            owner: comboBus
              ? (b.cabinTripId ? tripOwner.get(b.cabinTripId)?.name ?? null : null)
              : b.service?.owner?.name ?? null,
          };
        row.orders += 1;
        row.total += s.gross;
        row.discount += s.discount;
        row.payable += s.payable;
        row.paid += s.paid;
        row.remaining += s.remaining;
        row.lines.push(line);
        byService.set(key, row);
      }

      // Theo chủ dịch vụ: combo chia đôi bill — tiền phòng về chủ homestay, tiền vé về chủ nhà xe.
      if (b.status === "CANCELLED") continue;
      const owner = comboBus
        ? (b.cabinTripId && tripOwner.get(b.cabinTripId)) || { id: "_none", name: "Chưa gán chủ dịch vụ" }
        : { id: b.service?.ownerId ?? "_none", name: b.service?.owner?.name ?? "Chưa gán chủ dịch vụ" };
      const prow = provRow(owner.id, owner.name);
      accumulate(prow, isCombo ? comboSideView(b, comboBus ? "bus" : "home") : b);
      prow.lines.push(line);
    }
    // Combo chưa gán chuyến & chưa có tiền vé: vẫn đếm phần nhà xe vào "Chưa gán chủ" như trước.
    if (isCombo && b.status !== "CANCELLED" && !sides.some((x) => x.side === "bus")) {
      accumulate(provRow("_none", "Chưa gán chủ dịch vụ"), comboSideView(b, "bus"));
    }
  }

  const sortByRevenue = (a: StatRow, b: StatRow) => b.revenue - a.revenue;
  return {
    totals,
    byCtv: [...byCtv.values()].sort(sortByRevenue),
    byProvider: [...byProvider.values()].sort(sortByRevenue),
    byService: [...byService.values()].sort((a, b) => b.remaining - a.remaining || b.total - a.total),
  };
}
