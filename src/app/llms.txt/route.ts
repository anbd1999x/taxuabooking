import { prisma } from "@/lib/prisma";
import { SITE } from "@/lib/site";
import { toNumber } from "@/lib/format";
import { ARTICLE_TOPICS, articleTopicLabel } from "@/lib/constants";
import { ARTICLE_HUBS, articleHubPath, isArticleTopic } from "@/lib/article-hubs";
import { getSettings, getHomestayCards, getHomestayTable, getXeomRoutes, getTaxiRoutes, getTransportPoints } from "@/lib/queries";
import { PUBLIC_VENUE } from "@/lib/ticket-core";
import { formatPhone, parseTrustPopup, TRUST_POPUP_KEY, visibleLegalNames } from "@/lib/trust-popup";
import { getComboDiscount } from "@/lib/combo";
import { buildFareLegs, rangeOf, rangeText } from "@/components/data/fares";

export const dynamic = "force-dynamic";

/**
 * /llms.txt — bản tóm tắt site dạng markdown cho công cụ AI (ChatGPT, Perplexity, Gemini…) đọc nhanh:
 * site là gì, ai chịu trách nhiệm, các trang chính, nhà xe cabin / homestay / xe ôm / taxi đang bán (giá lấy từ DB),
 * câu hỏi thường gặp và danh sách bài cẩm nang. Dữ liệu đầy đủ dạng bảng ở /llms-full.txt.
 */
export async function GET() {
  const base = SITE.url.replace(/\/$/, "");
  // SĐT duy nhất toàn web = số chọn ở /admin/popup (getSettings ghi đè contactPhone).
  const settings = await getSettings();
  const phone = formatPhone(settings.contactPhone || SITE.defaultPhone);
  const [homes, places, bikes, venues, cabins, articles, homeTable, xeom, taxi, points, comboDiscount] = await Promise.all([
    getHomestayCards().catch(() => []),
    prisma.place.findMany({
      where: { published: true, slug: { not: null }, kind: { in: ["RESTAURANT", "CAFE"] } },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { slug: true, kind: true, name: true, area: true, price: true, desc: true },
    }),
    prisma.service.findMany({
      where: { category: "MOTORBIKE", published: true },
      orderBy: { basePrice: "asc" },
      select: { slug: true, title: true, summary: true, basePrice: true },
    }),
    prisma.ticketVenue.findMany({ where: PUBLIC_VENUE, select: { slug: true, name: true } }).catch(() => []),
    prisma.service.findMany({
      where: { category: "CABIN", published: true },
      orderBy: [{ featured: "desc" }, { basePrice: "asc" }],
      select: {
        slug: true,
        title: true,
        summary: true,
        cabinPriceRows: { where: { pickupPoint: "Hà Nội" }, select: { price: true, ticketType: true } },
        cabinRoutes: { where: { direction: "OUTBOUND" }, select: { stops: { orderBy: { sortOrder: "asc" }, take: 1, select: { time: true, place: true } } } },
      },
    }),
    prisma.article.findMany({
      where: { published: true },
      orderBy: { updatedAt: "desc" },
      select: { slug: true, title: true, excerpt: true, topic: true },
    }),
    getHomestayTable().catch(() => []),
    getXeomRoutes().catch(() => []),
    getTaxiRoutes().catch(() => []),
    getTransportPoints().catch(() => []),
    getComboDiscount().catch(() => 0),
  ]);
  const vnd = (n: number) => n.toLocaleString("vi-VN") + "đ";

  const cabinLines = cabins.map((c) => {
    const rt = c.cabinPriceRows.find((r) => r.ticketType === "ROUND_TRIP") ?? c.cabinPriceRows[0];
    const first = c.cabinRoutes[0]?.stops[0];
    const bits = [
      rt ? `khứ hồi từ Hà Nội ${vnd(toNumber(rt.price) ?? 0)}` : null,
      first ? `xuất phát ${first.time} tại ${first.place.replace(/\s+/g, " ")}` : null,
      c.summary,
    ].filter(Boolean);
    return `- [${c.title}](${base}/xe-cabin/${c.slug}): ${bits.join("; ")}`;
  });

  /** Gọn 1 dòng, cắt mô tả dài (file này để máy đọc nhanh, không chép nguyên bài). */
  const one = (t: string | null | undefined, max = 160) => {
    const x = (t ?? "").replace(/\s+/g, " ").trim();
    return x.length > max ? x.slice(0, max - 1).trimEnd() + "…" : x;
  };
  // Số phòng + tiện ích (tick ở hạng phòng) của từng homestay, đọc từ DB; không có thì không ghi.
  const factsBySlug = new Map(homeTable.map((h) => [h.slug, h]));
  const amenOf = (h: (typeof homeTable)[number]) =>
    [h.cloudView && "view mây", h.bathtub && "bồn tắm", h.airCon && "điều hòa", h.breakfast && "ăn sáng", h.heating && "sưởi"].filter(Boolean).join(", ");
  const homeLines = homes.map((h) => {
    const f = factsBySlug.get(h.slug);
    const bits = [
      h.area ? `khu ${h.area}` : null,
      f && f.roomCount > 0 ? `${f.roomCount} phòng` : null,
      h.price ? `phòng từ ${vnd(h.price)}/đêm` : null,
      f && amenOf(f) ? `có ${amenOf(f)}` : null,
      one(h.desc, 120),
    ].filter(Boolean);
    return `- [${h.name}](${base}/homestay/${h.slug}): ${bits.join("; ")}`;
  });
  const prices = homes.map((h) => h.price).filter((n): n is number => typeof n === "number" && n > 0);
  const placeLine = (p: (typeof places)[number]) =>
    `- [${p.name}](${base}/${p.kind === "CAFE" ? "cafe" : "nha-hang"}/${p.slug}): ${[p.area ? `khu ${p.area}` : null, p.price, one(p.desc, 110)].filter(Boolean).join("; ")}`;
  const bikeLines = bikes.map((b) => `- [${b.title}](${base}/thue-xe-may/${b.slug}): ${[b.basePrice ? `thuê từ ${vnd(toNumber(b.basePrice) ?? 0)}/ngày` : null, one(b.summary, 110)].filter(Boolean).join("; ")}`);
  const today = new Date().toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric" });

  // ----- Về Tà Xùa Booking: thông tin pháp lý lấy từ SITE + SiteSettings (cùng nguồn với trang Giới thiệu) -----
  const owners = visibleLegalNames(parseTrustPopup(settings[TRUST_POPUP_KEY]));
  const aboutLines = [
    "Loại hình: nền tảng trung gian đặt dịch vụ du lịch (không phải chủ homestay hay nhà xe; dịch vụ do chủ cơ sở tại Tà Xùa cung cấp).",
    "Thanh toán: không thu tiền online trên website. Khách gửi yêu cầu đặt, được gọi lại xác nhận rồi mới đặt cọc bằng chuyển khoản.",
    `Đơn vị kinh doanh: ${settings.legalName || SITE.legalName}`,
    `Người chịu trách nhiệm: ${owners.join(", ")}`,
    `Mã số thuế: ${settings.taxCode || SITE.taxCode}`,
    `Địa chỉ đăng ký: ${settings.legalAddress || SITE.legalAddress}`,
    `Khu vực hoạt động: ${settings.contactAddress || "Tà Xùa, Bắc Yên, Sơn La"}`,
    `Điện thoại / Zalo: ${phone}`,
    `Email: ${SITE.email}`,
    `Giờ hỗ trợ: ${SITE.supportHours} hằng ngày (giờ Việt Nam)`,
    `Chi tiết: ${base}/gioi-thieu, cam kết và điều khoản: ${base}/cam-ket`,
  ].map((x) => `- ${x}`);

  // ----- Xe ôm / taxi: giá chặng thật (gộp mọi bác tài; nhiều người nhận một chặng ⇒ khoảng giá) -----
  const LEG_MAX = 15; // tệp tóm tắt chỉ nêu các chặng nhiều bác tài nhận nhất; đủ bảng ở /llms-full.txt
  const xeomLegs = buildFareLegs(xeom, points);
  const taxiLegs = buildFareLegs(taxi, points);
  const more = (n: number) => (n > LEG_MAX ? `\n- Còn ${n - LEG_MAX} chặng khác trong ${base}/llms-full.txt` : "");
  const xeomLegLines = xeomLegs.slice(0, LEG_MAX).map((l) => `- ${l.a} ↔ ${l.b}: ${[l.one ? `1 khách ${rangeText(l.one)}` : null, l.two ? `2 khách chung xe ${rangeText(l.two)}` : null].filter(Boolean).join("; ")} (một chiều)`);
  const taxiLegLines = taxiLegs.slice(0, LEG_MAX).map((l) => `- ${l.a} ↔ ${l.b}: ${rangeText(l.one)} (một chiều, cả xe${l.vehicles.length ? `; xe nhận: ${l.vehicles.join(", ")}` : ""})`);
  const xeomDay = rangeOf(xeom.map((r) => r.pricing.dayPrice));
  const xeomDayTwo = rangeOf(xeom.map((r) => r.pricing.dayPriceTwo));
  const taxiDay = rangeOf(taxi.map((r) => r.pricing.dayPrice));

  // ----- Câu hỏi thường gặp: câu trả lời ngắn, số liệu lấy từ dữ liệu ở trên -----
  const cloudHomes = homeTable.filter((h) => h.cloudView);
  const faq: [string, string][] = [
    [
      "Đặt homestay Tà Xùa ở đâu?",
      `Đặt tại trang [Homestay Tà Xùa](${base}/homestay) của ${SITE.name}${homes.length ? `: ${homes.length} homestay, bungalow đang đăng` : ""}, xem giá từng phòng và phòng trống theo ngày rồi gửi yêu cầu đặt, không cần thanh toán online.`,
    ],
    [
      "Đặt xe đi Tà Xùa ở đâu?",
      `Đặt vé xe cabin giường nằm Hà Nội – Tà Xùa tại [trang xe cabin](${base}/xe-cabin)${cabins.length ? ` (${cabins.length} nhà xe đang mở bán)` : ""}. Đi lại tại Tà Xùa có [xe ôm](${base}/xe-om), [taxi](${base}/taxi) và [thuê xe máy](${base}/thue-xe-may).`,
    ],
    [
      "Website đặt phòng Tà Xùa uy tín?",
      `${SITE.name} (${base}) là nền tảng trung gian công khai đơn vị kinh doanh, mã số thuế ${settings.taxCode || SITE.taxCode} và người chịu trách nhiệm tại [trang giới thiệu](${base}/gioi-thieu), kèm [cam kết](${base}/cam-ket) xử lý khi có sai sót. Khách không phải trả tiền online khi gửi yêu cầu đặt.`,
    ],
    [
      "Homestay Tà Xùa view biển mây?",
      `${cloudHomes.length ? `${cloudHomes.length} homestay đang đăng có hạng phòng view mây, ví dụ ${cloudHomes.slice(0, 5).map((h) => `[${h.name}](${base}/homestay/${h.slug})`).join(", ")}. ` : ""}Lọc tiện ích "View mây" tại [trang homestay](${base}/homestay) để xem đủ. Mây là thời tiết nên không ngày nào chắc chắn có.`,
    ],
    [
      "Đặt combo xe và homestay Tà Xùa ở đâu?",
      `Tại [trang combo](${base}/combo): nhập ngày đi, ngày về, số người để hệ thống ghép vé xe cabin khứ hồi với phòng còn trống và tính giá trọn gói mỗi người${comboDiscount > 0 ? `, rẻ hơn đặt lẻ ${vnd(comboDiscount)} mỗi khách` : ""}.`,
    ],
  ];

  const byTopic = new Map<string, typeof articles>();
  for (const a of articles) {
    // Tiêu đề nhóm = link trang hub chủ đề (/kinh-nghiem/chu-de/<topic>).
    const k = isArticleTopic(a.topic) ? `[${articleTopicLabel(a.topic)}](${base}${articleHubPath(a.topic)})` : "Khác";
    byTopic.set(k, [...(byTopic.get(k) ?? []), a]);
  }

  const body = `# ${SITE.name}

> ${SITE.about}
>
> ${SITE.name} (${base}) là website đặt dịch vụ du lịch Tà Xùa (xã Tà Xùa, tỉnh Sơn La, Việt Nam; cách Hà Nội khoảng 215–220 km): xe cabin giường nằm Hà Nội – Tà Xùa, homestay/bungalow săn mây, thuê xe máy, xe ôm, taxi và combo xe + homestay. Khách xem giá và tình trạng còn chỗ theo ngày rồi gửi yêu cầu đặt; không thanh toán online, Tà Xùa Booking gọi lại xác nhận. Hỗ trợ ${SITE.supportHours} hằng ngày, điện thoại/Zalo ${phone}.

Giá trong file này lấy trực tiếp từ dữ liệu đang bán, cập nhật ngày ${today}. Giá thay đổi theo ngày trong tuần, mùa và dịp lễ; giá chính xác hiện trên trang khi chọn ngày. Dữ liệu đầy đủ dạng bảng (giá từng phòng, bảng giá chặng từng nhà xe, xe ôm, taxi, xe máy, quãng đường xe chạy từ từng homestay tới các điểm check-in theo dẫn đường OpenStreetMap, lịch mùa mây, lúa chín, hoa, sương muối): ${base}/llms-full.txt

Ngôn ngữ: tiếng Việt (gốc), English (/en), 中文 (/zh), 한국어 (/ko). Tiếng Trung gọi Tà Xùa là 塔萨, tiếng Hàn là 따쑤아.

## Về Tà Xùa Booking

${aboutLines.join("\n")}

## Trang chính

- [Xe cabin Hà Nội – Tà Xùa](${base}/xe-cabin): tìm nhà xe còn chỗ theo ngày đi + ngày về, đặt vé cabin đơn/đôi.
- [Homestay Tà Xùa](${base}/homestay): homestay, bungalow view biển mây, giá theo từng phòng và từng đêm.
- [Combo xe cabin + homestay](${base}/combo): ghép vé khứ hồi với phòng còn trống theo ngân sách.
- [Thuê xe máy Tà Xùa](${base}/thue-xe-may), [Xe ôm](${base}/xe-om), [Taxi](${base}/taxi)
- [Lịch trình & chi phí đi Tà Xùa](${base}/lich-trinh): lịch trình theo giờ 2 ngày 1 đêm, 3 ngày 2 đêm, tự tính chi phí theo số người.
- [Bản đồ Tà Xùa](${base}/ban-do): bản đồ vệ tinh các điểm check-in và cung đường từng ngày.
- [Điểm đến Tà Xùa](${base}/diem-den): từng điểm check-in, săn mây (vị trí, đường đi, giờ đẹp).
- [Thời tiết Tà Xùa](${base}/thoi-tiet-ta-xua): thời tiết, mùa mây theo tháng.
- [Nhà hàng, quán ăn](${base}/nha-hang) và [quán cafe](${base}/cafe) ở Tà Xùa theo khu vực, kèm giá tham khảo và giờ mở cửa.${venues.length ? `
- [Vé & đặt bàn](${base}/ve): mua vé điểm check-in, show và đặt bàn nhà hàng online (${venues.map((v) => v.name).join(", ")}).` : ""}
- [Kinh nghiệm du lịch Tà Xùa](${base}/kinh-nghiem): cẩm nang, lịch trình, di chuyển, ăn uống. Trang theo chủ đề: ${ARTICLE_TOPICS.map((t) => `[${ARTICLE_HUBS[t.key].h1}](${base}${articleHubPath(t.key)})`).join(", ")}.
- [Hướng dẫn đặt dịch vụ](${base}/huong-dan), [Cam kết](${base}/cam-ket), [Giới thiệu](${base}/gioi-thieu), [Liên hệ](${base}/lien-he)
- [Phần mềm quản lý tiệm cho thuê xe máy](${base}/hop-tac/xe-may): dành cho chủ tiệm (đối tác).

## Nhà xe cabin Hà Nội – Tà Xùa đang mở bán

${cabinLines.join("\n")}

Các xe cabin chạy đêm hằng ngày, tới trung tâm Tà Xùa khoảng 6h sáng; chiều về rời Tà Xùa khoảng 12h, tới Hà Nội khoảng 19h. So sánh chi tiết: ${base}/kinh-nghiem/so-sanh-nha-xe-di-ta-xua

${homeLines.length ? `## Homestay, bungalow tại Tà Xùa (${homeLines.length} cơ sở)

${prices.length ? `Giá phòng thấp nhất của từng cơ sở dao động từ ${vnd(Math.min(...prices))} đến ${vnd(Math.max(...prices))} một đêm. ` : ""}Phần lớn homestay nhận phòng từ 14h, trả phòng trước 12h. Đặt qua website không cần thanh toán online.

${homeLines.join("\n")}

` : ""}${bikeLines.length ? `## Thuê xe máy tại Tà Xùa

${bikeLines.join("\n")}

` : ""}${xeom.length ? `## Xe ôm tại Tà Xùa

[Xe ôm Tà Xùa](${base}/xe-om): ${xeom.length} tài xế / dịch vụ đang đăng. Giá tính theo chặng một chiều cho mỗi xe máy, dùng cho cả hai hướng.${xeomDay ? ` Thuê nguyên ngày, 1 khách: ${rangeText(xeomDay)}.` : ""}${xeomDayTwo ? ` Nguyên ngày, 2 khách chung xe: ${rangeText(xeomDayTwo)}.` : ""}

${xeomLegLines.join("\n")}${more(xeomLegs.length)}

` : ""}${taxi.length ? `## Taxi tại Tà Xùa

[Taxi Tà Xùa](${base}/taxi): ${taxi.length} xe / dịch vụ đang đăng. Giá chặng tính một chiều cho cả xe, dùng cho cả hai hướng.${taxiDay ? ` Thuê nguyên ngày, cả xe: ${rangeText(taxiDay)}.` : ""}

${taxiLegLines.join("\n")}${more(taxiLegs.length)}

` : ""}${places.length ? `## Ăn uống tại Tà Xùa

### Nhà hàng, quán ăn

${places.filter((p) => p.kind === "RESTAURANT").map(placeLine).join("\n")}

### Quán cafe

${places.filter((p) => p.kind === "CAFE").map(placeLine).join("\n")}

` : ""}## Câu hỏi thường gặp

${faq.map(([q, a]) => `### ${q}\n\n${a}`).join("\n\n")}

## Bài viết cẩm nang

${[...byTopic.entries()]
  .map(([topic, list]) => `### ${topic}\n\n${list.map((a) => `- [${a.title}](${base}/kinh-nghiem/${a.slug})${a.excerpt ? `: ${a.excerpt}` : ""}`).join("\n")}`)
  .join("\n\n")}
`;

  return new Response(body, {
    headers: { "Content-Type": "text/markdown; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
