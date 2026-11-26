import { SITE } from "@/lib/site";
import { formatPrice } from "@/lib/format";
import { getCabinCompare, getHomestayTable, getRentalBikes, getTaxiRoutes, getTransportPoints, getXeomRoutes, type HomestayTableRoom } from "@/lib/queries";
import { legFareFor, roundTripFareFor } from "@/lib/combo";
import { buildFareLegs, rangeOf, rangeText, vnToday } from "@/components/data/fares";

export const dynamic = "force-dynamic";

/**
 * /llms-full.txt — DỮ LIỆU ĐẦY ĐỦ dạng bảng markdown cho công cụ AI trích dẫn: giá từng phòng của từng homestay,
 * bảng giá chặng từng nhà xe cabin, giá chặng xe ôm / taxi, loại xe máy cho thuê. Bản tóm tắt ở /llms.txt.
 * Mọi con số đọc từ DB lúc tạo tệp; ô "—" = chủ cơ sở chưa khai. Tiếng Việt (ngôn ngữ gốc của dữ liệu).
 */
export async function GET() {
  const base = SITE.url.replace(/\/$/, "");
  const [homes, cabins, xeom, taxi, points, bikes] = await Promise.all([
    getHomestayTable().catch(() => []),
    getCabinCompare().catch(() => []),
    getXeomRoutes().catch(() => []),
    getTaxiRoutes().catch(() => []),
    getTransportPoints().catch(() => []),
    getRentalBikes(null, null).catch(() => []),
  ]);
  const today = vnToday();
  /** Ô bảng markdown: gọn 1 dòng, không để "|" phá cột. */
  const cell = (v: string | number | null | undefined) => (v == null || v === "" ? "—" : String(v).replace(/\s+/g, " ").replace(/\|/g, "/").trim() || "—");
  const money = (n: number | null | undefined) => (n != null && n > 0 ? formatPrice(n) : "—");
  const table = (head: string[], rows: (string | number | null | undefined)[][]) =>
    [`| ${head.join(" | ")} |`, `| ${head.map(() => "---").join(" | ")} |`, ...rows.map((r) => `| ${r.map(cell).join(" | ")} |`)].join("\n");

  // ----- Homestay: mỗi cơ sở một bảng phòng -----
  const weekday = (r: HomestayTableRoom) => (r.weekdayMin == null || r.weekdayMax == null ? "—" : rangeText([r.weekdayMin, r.weekdayMax]));
  const amen = (h: (typeof homes)[number]) =>
    [h.cloudView && "view mây", h.bathtub && "bồn tắm", h.airCon && "điều hòa", h.breakfast && "ăn sáng", h.heating && "đệm sưởi / máy sưởi"].filter(Boolean).join(", ");
  const homeBlocks = homes.map((h) => {
    const facts = [h.area ? `Khu vực: ${h.area}` : null, `${h.roomCount} phòng`, h.priceFrom != null ? `giá từ ${formatPrice(h.priceFrom)}/đêm` : null, amen(h) ? `tiện ích (theo hạng phòng): ${amen(h)}` : null]
      .filter(Boolean)
      .join("; ");
    const rooms = h.rooms.length
      ? table(
          ["Phòng", "Hạng phòng", "Sức chứa", "Thứ 2 đến thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật", "Ngày lễ"],
          h.rooms.map((r) => [r.name, r.typeName, r.maxCapacity ? `${r.capacity} (tối đa ${r.maxCapacity})` : r.capacity, weekday(r), money(r.fri), money(r.sat), money(r.sun), money(r.holiday)]),
        )
      : "Chưa khai phòng trên hệ thống.";
    return `### ${h.name}\n\n${base}/homestay/${h.slug}\n\n${facts}.\n\n${rooms}`;
  });

  // ----- Xe cabin: mỗi nhà xe một bảng giá chặng -----
  const norm = (x: string) => x.trim().toLowerCase().replace(/\s+/g, " ");
  const cabinBlocks = cabins.map((c) => {
    // Điểm xuất phát của khách: dòng "Chiều về" có thể nhập kiểu "Tà Xùa → <tỉnh>" (tỉnh nằm ở cột điểm đến).
    const origins = [
      ...new Map(
        c.fares
          .map((r) => (r.ticketType === "RETURN" && r.destination && /tà xùa/i.test(r.pickupPoint) ? r.destination : r.pickupPoint).trim())
          .filter(Boolean)
          .map((o) => [norm(o), o] as const),
      ).values(),
    ];
    const facts = [
      c.departTime ? `Chiều đi xuất phát ${c.departTime}${c.departPlace ? ` tại ${c.departPlace}` : ""}` : null,
      c.returnTime ? `chiều về rời Tà Xùa ${c.returnTime}` : null,
    ].filter(Boolean).join("; ");
    const fares = origins.length
      ? table(
          ["Điểm đón", "Khứ hồi / người", "Chiều đi / người", "Chiều về / người"],
          origins.map((o) => [o, money(roundTripFareFor(c.fares, o)), money(legFareFor(c.fares, o, "OUTBOUND")), money(legFareFor(c.fares, o, "RETURN"))]),
        )
      : "Chưa khai bảng giá chặng; giá hiện khi chọn ngày trên trang nhà xe.";
    return `### ${c.title}\n\n${base}/xe-cabin/${c.slug}\n\n${facts ? `${facts}.\n\n` : ""}${fares}`;
  });

  // ----- Xe ôm / taxi: giá chặng gộp mọi bác tài + giá nguyên ngày từng bác tài -----
  const xeomLegs = buildFareLegs(xeom, points);
  const taxiLegs = buildFareLegs(taxi, points);
  const xeomDrivers = table(
    ["Tài xế / dịch vụ", "Trang", "Nguyên ngày, 1 khách", "Nguyên ngày, 2 khách", "Số chặng có giá"],
    xeom.map((r) => [r.title, `${base}/xe-om/${r.slug}`, money(r.pricing.dayPrice), money(r.pricing.dayPriceTwo), r.pricing.legs.filter((l) => (l.oneWay ?? 0) > 0 || (l.twoPax ?? 0) > 0).length]),
  );
  const taxiDrivers = table(
    ["Xe / dịch vụ", "Trang", "Loại xe", "Nguyên ngày, cả xe", "Số chặng có giá"],
    taxi.map((r) => [r.title, `${base}/taxi/${r.slug}`, r.vehicleType, money(r.pricing.dayPrice), r.pricing.legs.filter((l) => (l.oneWay ?? 0) > 0).length]),
  );

  // ----- Xe máy -----
  const bikeRange = rangeOf(bikes.map((b) => b.pricePerDay));
  const bikeTable = table(
    ["Tiệm", "Trang", "Loại xe", "Giá thuê / ngày", "Giá niêm yết / ngày", "Số xe", "Phí giao nhận"],
    bikes.map((b) => [b.shopTitle, `${base}/thue-xe-may/${b.serviceSlug}`, b.name, money(b.pricePerDay), money(b.originalPrice), b.totalUnits, money(b.deliveryFee)]),
  );

  const body = `# ${SITE.name}: dữ liệu giá đầy đủ

> ${SITE.about}

Cập nhật ngày ${today} (giờ Việt Nam). Mọi con số trong tệp này đọc trực tiếp từ bảng giá chủ cơ sở niêm yết trên ${base} lúc tạo tệp; ô "—" là chủ cơ sở chưa khai. Giá có thể đổi theo mùa và dịp lễ; giá chính xác cho ngày cụ thể hiện trên trang khi chọn ngày. Bản tóm tắt: ${base}/llms.txt

## Homestay, bungalow tại Tà Xùa (${homes.length} cơ sở, ${homes.reduce((n, h) => n + h.roomCount, 0)} phòng)

Giá mỗi đêm của từng phòng theo thứ trong tuần (đêm tính theo ngày nhận phòng). Cột "Ngày lễ" là giá riêng cho đêm rơi vào lịch lễ, ô "—" là không có giá lễ riêng. Phòng cộng đồng (dorm) tính giá theo người. Đặt phòng: ${base}/homestay

${homeBlocks.join("\n\n")}

## Xe cabin Hà Nội – Tà Xùa (${cabins.length} nhà xe)

Giá vé một người theo điểm đón, từ bảng giá chặng đang áp cho từng nhà xe. Đặt vé: ${base}/xe-cabin

${cabinBlocks.join("\n\n")}

## Xe ôm tại Tà Xùa (${xeom.length} tài xế / dịch vụ)

Giá một chiều cho mỗi xe máy, dùng cho cả hai hướng của chặng. Nhiều tài xế cùng nhận một chặng thì ghi khoảng giá thấp nhất đến cao nhất. Đặt xe: ${base}/xe-om

${xeomLegs.length ? table(["Chặng", "1 khách / xe", "2 khách / xe", "Số tài xế nhận"], xeomLegs.map((l) => [`${l.a} ↔ ${l.b}`, rangeText(l.one), rangeText(l.two), l.drivers])) : "Chưa có chặng nào được khai giá."}

${xeom.length ? xeomDrivers : ""}

## Taxi tại Tà Xùa (${taxi.length} xe / dịch vụ)

Giá một chiều cho cả xe, dùng cho cả hai hướng của chặng. Đặt xe: ${base}/taxi

${taxiLegs.length ? table(["Chặng", "Giá một chiều / xe", "Loại xe nhận chặng", "Số xe nhận"], taxiLegs.map((l) => [`${l.a} ↔ ${l.b}`, rangeText(l.one), l.vehicles.join(", "), l.drivers])) : "Chưa có chặng nào được khai giá."}

${taxi.length ? taxiDrivers : ""}

## Thuê xe máy tại Tà Xùa (${bikes.length} loại xe)

${bikeRange ? `Giá thuê hiện ở mức ${rangeText(bikeRange)} một ngày. ` : ""}Đặt xe: ${base}/thue-xe-may

${bikes.length ? bikeTable : "Chưa có loại xe nào được đăng."}
`;

  return new Response(body.replace(/\n{3,}/g, "\n\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
