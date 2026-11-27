import { SITE } from "@/lib/site";
import { prisma } from "@/lib/prisma";
import { formatPrice, formatDate } from "@/lib/format";
import { ARTICLE_TOPICS } from "@/lib/constants";
import { ARTICLE_HUBS, articleHubPath } from "@/lib/article-hubs";
import { getCabinCompare, getHomestayTable, getRentalBikes, getTaxiRoutes, getTransportPoints, getXeomRoutes, type HomestayTableRoom } from "@/lib/queries";
import { legFareFor, roundTripFareFor } from "@/lib/combo";
import { buildFareLegs, rangeOf, rangeText, vnToday } from "@/components/data/fares";

export const dynamic = "force-dynamic";

/** Bài nguồn của lịch mùa (bảng 12 tháng) — trích nguyên văn từ nội dung bài đang đăng, không viết số tay ở đây. */
const SEASON_SLUG = "ta-xua-mua-nao-dep-nhat";
/** Số điểm check-in làm cột ở bảng homestay × điểm: ưu tiên các điểm săn mây chính (khớp tên), thiếu thì điểm có nhiều số liệu nhất. */
const ROAD_COLS = 5;
const ROAD_MAIN = [/sống lưng khủng long/i, /mỏm cá heo/i, /cây cô đơn/i, /thác mây/i, /thảo nguyên/i];

/**
 * QUÃNG ĐƯỜNG XE CHẠY THẬT homestay → điểm check-in: đọc bảng RoadDistance (cache của popup "Xung quanh có gì?"),
 * CHỈ lấy cặp có chữ ký toạ độ khớp toạ độ hiện tại (đổi toạ độ ⇒ số cũ bị bỏ). Không gọi dịch vụ ngoài ở đây.
 */
async function roadData() {
  const [homes, spots] = await Promise.all([
    prisma.service.findMany({
      where: { published: true, category: { in: ["HOMESTAY", "BUNGALOW"] }, lat: { not: null }, lng: { not: null } },
      orderBy: { title: "asc" },
      select: { id: true, slug: true, title: true, lat: true, lng: true, distanceKm: true },
    }),
    prisma.place.findMany({
      where: { published: true, kind: "CHECKIN", lat: { not: null }, lng: { not: null } },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, lat: true, lng: true },
    }),
  ]);
  const rows = homes.length && spots.length
    ? await prisma.roadDistance.findMany({
        where: { serviceId: { in: homes.map((h) => h.id) }, placeId: { in: spots.map((s) => s.id) } },
        select: { serviceId: true, placeId: true, sig: true, km: true, minutes: true, source: true },
      })
    : [];
  const homeById = new Map(homes.map((h) => [h.id, h]));
  const spotById = new Map(spots.map((s) => [s.id, s]));
  const valid = rows.filter((r) => {
    const h = homeById.get(r.serviceId);
    const s = spotById.get(r.placeId);
    return h && s && r.sig === `${h.lat},${h.lng}>${s.lat},${s.lng}` && r.km > 0;
  });
  return { homes, spots, valid };
}

/** Lịch mùa: phần "Tóm tắt nhanh" + bảng 12 tháng của bài mùa đẹp, và tóm tắt từng bài "Tà Xùa tháng N" (đều lấy từ DB). */
async function seasonData() {
  const [main, months] = await Promise.all([
    prisma.article.findFirst({ where: { slug: SEASON_SLUG, published: true }, select: { slug: true, title: true, content: true, updatedAt: true } }),
    prisma.article.findMany({ where: { published: true, slug: { startsWith: "ta-xua-thang-" } }, select: { slug: true, title: true, excerpt: true, updatedAt: true } }),
  ]);
  const plain = (s: string) => s.replace(/\*\*/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").trim();
  let bullets: string[] = [];
  let table: string[] = [];
  if (main) {
    const lines = main.content.replace(/\r\n/g, "\n").split("\n");
    const i = lines.findIndex((l) => /^\*\*Tóm tắt nhanh:?\*\*/i.test(l.trim()));
    if (i >= 0) {
      for (let j = i + 1; j < lines.length; j++) {
        const l = lines[j].trim();
        if (!l) { if (bullets.length) break; continue; }
        if (!l.startsWith("- ")) break;
        bullets.push(`- ${plain(l.slice(2))}`);
      }
    }
    const t = lines.findIndex((l) => /^\|\s*Tháng\s*\|/.test(l.trim()));
    if (t >= 0) {
      for (let j = t; j < lines.length && lines[j].trim().startsWith("|"); j++) table.push(plain(lines[j].trim()));
      if (table.length < 3) table = [];
    }
  }
  const monthNo = (slug: string) => Number(slug.replace("ta-xua-thang-", "")) || 99;
  months.sort((a, b) => monthNo(a.slug) - monthNo(b.slug));
  return { main, bullets, table, months: months.filter((m) => monthNo(m.slug) <= 12) };
}

/**
 * /llms-full.txt — DỮ LIỆU ĐẦY ĐỦ dạng bảng markdown cho công cụ AI trích dẫn: giá từng phòng của từng homestay,
 * bảng giá chặng từng nhà xe cabin, giá chặng xe ôm / taxi, loại xe máy cho thuê, quãng đường xe chạy homestay ↔ điểm check-in
 * (RoadDistance, dẫn đường OpenStreetMap), lịch mùa trích từ bài đang đăng và link trang hub chủ đề. Bản tóm tắt ở /llms.txt.
 * Mọi con số đọc từ DB lúc tạo tệp; ô "—" = chủ cơ sở chưa khai. Tiếng Việt (ngôn ngữ gốc của dữ liệu).
 */
export async function GET() {
  const base = SITE.url.replace(/\/$/, "");
  const [homes, cabins, xeom, taxi, points, bikes, road, season] = await Promise.all([
    getHomestayTable().catch(() => []),
    getCabinCompare().catch(() => []),
    getXeomRoutes().catch(() => []),
    getTaxiRoutes().catch(() => []),
    getTransportPoints().catch(() => []),
    getRentalBikes(null, null).catch(() => []),
    roadData().catch(() => null),
    seasonData().catch(() => null),
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

  // ----- Quãng đường xe chạy thật homestay ↔ điểm check-in (cache RoadDistance, dẫn đường trên OpenStreetMap) -----
  const kmTxt = (km: number) => (km < 0.05 ? "dưới 0,1 km" : `${km.toLocaleString("vi-VN", { maximumFractionDigits: 1 })} km`);
  const spotName = (n: string) => n.replace(/\(\s+/g, "(").replace(/\s+\)/g, ")").replace(/\s+/g, " ").trim();
  let roadSection = "";
  if (road && road.valid.length) {
    const { homes: rh, spots, valid } = road;
    const pair = new Map(valid.map((r) => [`${r.serviceId}|${r.placeId}`, r]));
    const homeById = new Map(rh.map((h) => [h.id, h]));
    const bySpot = spots
      .map((s) => ({ s, list: valid.filter((r) => r.placeId === s.id).sort((a, b) => a.km - b.km) }))
      .filter((x) => x.list.length);
    const spotTable = table(
      ["Điểm check-in", "Homestay gần nhất", "Quãng đường", "Thời gian xe máy", "Số homestay trong 5 km đường xe"],
      bySpot.map(({ s, list }) => [spotName(s.name), homeById.get(list[0].serviceId)?.title, kmTxt(list[0].km), `${list[0].minutes} phút`, list.filter((x) => x.km <= 5).length]),
    );
    const rank = (n: string) => { const i = ROAD_MAIN.findIndex((re) => re.test(n)); return i < 0 ? ROAD_MAIN.length : i; };
    const cols = [...bySpot].sort((a, b) => rank(a.s.name) - rank(b.s.name) || b.list.length - a.list.length).slice(0, ROAD_COLS).map((x) => x.s);
    const homeRows = rh.filter((h) => cols.some((c) => pair.has(`${h.id}|${c.id}`)));
    const homeTable = table(
      ["Homestay", "Cách trung tâm (chủ nhà khai)", ...cols.map((c) => spotName(c.name))],
      homeRows.map((h) => [
        `[${h.title}](${base}/homestay/${h.slug})`,
        h.distanceKm == null ? null : h.distanceKm === 0 ? "ở trung tâm" : kmTxt(h.distanceKm),
        ...cols.map((c) => {
          const r = pair.get(`${h.id}|${c.id}`);
          return r ? `${kmTxt(r.km)}, ${r.minutes} phút` : null;
        }),
      ]),
    );
    const usesOsrm = valid.some((r) => r.source === "osrm");
    roadSection = `## Quãng đường xe chạy giữa homestay và điểm check-in

Quãng đường ĐƯỜNG BỘ (không phải đường chim bay) từ toạ độ từng homestay tới toạ độ từng điểm check-in đang đăng trên ${base}, tính bằng dịch vụ dẫn đường trên dữ liệu OpenStreetMap: Valhalla (máy chủ FOSSGIS, chế độ xe máy)${usesOsrm ? "; một số cặp dùng OSRM (chế độ ô tô, thời gian nhân 1,5 cho xe máy đường núi)" : ""}. Thời gian là ước tính của dịch vụ dẫn đường; đoạn đi bộ cuối tới điểm ngắm không tính. ${valid.length} cặp homestay × điểm có số liệu hợp lệ (${rh.length} homestay có toạ độ, ${spots.length} điểm check-in). Ô "—" = chưa có số liệu. Cột "Cách trung tâm" do chủ nhà tự khai, không phải số dẫn đường. Bản đồ: ${base}/ban-do, trang từng điểm đến: ${base}/diem-den

### Mỗi điểm check-in: homestay gần nhất theo đường xe

${spotTable}

### Từ từng homestay tới ${cols.length} điểm săn mây, check-in chính (quãng đường, thời gian xe máy)

${homeTable}`;
  }

  // ----- Lịch mùa: trích nguyên văn bảng 12 tháng của bài đang đăng + tóm tắt từng bài theo tháng -----
  let seasonSection = "";
  if (season && (season.table.length || season.months.length)) {
    const src = season.main ? `[${season.main.title}](${base}/kinh-nghiem/${season.main.slug}), cập nhật ${formatDate(season.main.updatedAt)}` : null;
    seasonSection = `## Lịch mùa Tà Xùa: mây, lúa chín, hoa, sương muối

Trích từ bài cẩm nang đang đăng trên ${base}${src ? ` (${src})` : ""}. Cột "Mây" là mức thường gặp theo mùa; thời tiết từng năm xê dịch, không phải cam kết cho một ngày cụ thể. Thời tiết theo tháng: ${base}/thoi-tiet-ta-xua

${season.bullets.join("\n")}

${season.table.join("\n")}

${season.months.length ? `### Bài riêng từng tháng\n\n${season.months.map((m) => `- [${m.title}](${base}/kinh-nghiem/${m.slug})${m.excerpt ? `: ${m.excerpt.replace(/\s+/g, " ").trim()}` : ""}`).join("\n")}` : ""}`;
  }

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

${roadSection}

${seasonSection}

## Cẩm nang theo chủ đề

${ARTICLE_TOPICS.map((t) => `- [${ARTICLE_HUBS[t.key].h1}](${base}${articleHubPath(t.key)})`).join("\n")}
`;

  return new Response(body.replace(/\n{3,}/g, "\n\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
