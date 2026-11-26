import { prisma } from "@/lib/prisma";
import { SITE } from "@/lib/site";
import { toNumber } from "@/lib/format";
import { articleTopicLabel } from "@/lib/constants";
import { getSettings, getHomestayCards } from "@/lib/queries";
import { PUBLIC_VENUE } from "@/lib/ticket-core";
import { formatPhone } from "@/lib/trust-popup";

export const dynamic = "force-dynamic";

/**
 * /llms.txt — bản tóm tắt site dạng markdown cho công cụ AI (ChatGPT, Perplexity, Gemini…) đọc nhanh:
 * site là gì, các trang chính, nhà xe cabin đang bán (giá lấy từ DB) và danh sách bài cẩm nang.
 */
export async function GET() {
  const base = SITE.url.replace(/\/$/, "");
  // SĐT duy nhất toàn web = số chọn ở /admin/popup (getSettings ghi đè contactPhone).
  const settings = await getSettings();
  const phone = formatPhone(settings.contactPhone || SITE.defaultPhone);
  const [homes, places, bikes, venues, cabins, articles] = await Promise.all([
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
  const homeLines = homes.map((h) => {
    const bits = [h.area ? `khu ${h.area}` : null, h.price ? `phòng từ ${vnd(h.price)}/đêm` : null, one(h.desc, 120)].filter(Boolean);
    return `- [${h.name}](${base}/homestay/${h.slug}): ${bits.join("; ")}`;
  });
  const prices = homes.map((h) => h.price).filter((n): n is number => typeof n === "number" && n > 0);
  const placeLine = (p: (typeof places)[number]) =>
    `- [${p.name}](${base}/${p.kind === "CAFE" ? "cafe" : "nha-hang"}/${p.slug}): ${[p.area ? `khu ${p.area}` : null, p.price, one(p.desc, 110)].filter(Boolean).join("; ")}`;
  const bikeLines = bikes.map((b) => `- [${b.title}](${base}/thue-xe-may/${b.slug}): ${[b.basePrice ? `thuê từ ${vnd(toNumber(b.basePrice) ?? 0)}/ngày` : null, one(b.summary, 110)].filter(Boolean).join("; ")}`);
  const today = new Date().toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric" });

  const byTopic = new Map<string, typeof articles>();
  for (const a of articles) {
    const k = articleTopicLabel(a.topic) || "Khác";
    byTopic.set(k, [...(byTopic.get(k) ?? []), a]);
  }

  const body = `# ${SITE.name}

> ${SITE.name} (${base}) là website đặt dịch vụ du lịch Tà Xùa (xã Tà Xùa, tỉnh Sơn La, Việt Nam; cách Hà Nội khoảng 215–220 km): xe cabin giường nằm Hà Nội – Tà Xùa, homestay/bungalow săn mây, thuê xe máy, xe ôm, taxi và combo xe + homestay. Khách xem giá và tình trạng còn chỗ theo ngày rồi gửi yêu cầu đặt; không thanh toán online, Tà Xùa Booking gọi lại xác nhận. Hỗ trợ ${SITE.supportHours} hằng ngày, điện thoại/Zalo ${phone}.

Giá trong file này lấy trực tiếp từ dữ liệu đang bán, cập nhật ngày ${today}. Giá thay đổi theo ngày trong tuần, mùa và dịp lễ — giá chính xác hiện trên trang khi chọn ngày.

Ngôn ngữ: tiếng Việt (gốc), English (/en), 中文 (/zh), 한국어 (/ko). Tiếng Trung gọi Tà Xùa là 塔萨, tiếng Hàn là 따쑤아.

## Trang chính

- [Xe cabin Hà Nội – Tà Xùa](${base}/xe-cabin): tìm nhà xe còn chỗ theo ngày đi + ngày về, đặt vé cabin đơn/đôi.
- [Homestay Tà Xùa](${base}/homestay): homestay, bungalow view biển mây, giá theo từng phòng và từng đêm.
- [Combo xe cabin + homestay](${base}/combo): ghép vé khứ hồi với phòng còn trống theo ngân sách.
- [Thuê xe máy Tà Xùa](${base}/thue-xe-may), [Xe ôm](${base}/xe-om), [Taxi](${base}/taxi)
- [Lịch trình & chi phí đi Tà Xùa](${base}/lich-trinh): lịch trình theo giờ 2 ngày 1 đêm, 3 ngày 2 đêm, tự tính chi phí theo số người.
- [Bản đồ Tà Xùa](${base}/ban-do): bản đồ vệ tinh các điểm check-in và cung đường từng ngày.
- [Nhà hàng, quán ăn](${base}/nha-hang) và [quán cafe](${base}/cafe) ở Tà Xùa theo khu vực, kèm giá tham khảo và giờ mở cửa.${venues.length ? `
- [Vé & đặt bàn](${base}/ve): mua vé điểm check-in, show và đặt bàn nhà hàng online (${venues.map((v) => v.name).join(", ")}).` : ""}
- [Kinh nghiệm du lịch Tà Xùa](${base}/kinh-nghiem): cẩm nang, lịch trình, di chuyển, ăn uống.
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

` : ""}${places.length ? `## Ăn uống tại Tà Xùa

### Nhà hàng, quán ăn

${places.filter((p) => p.kind === "RESTAURANT").map(placeLine).join("\n")}

### Quán cafe

${places.filter((p) => p.kind === "CAFE").map(placeLine).join("\n")}

` : ""}## Bài viết cẩm nang

${[...byTopic.entries()]
  .map(([topic, list]) => `### ${topic}\n\n${list.map((a) => `- [${a.title}](${base}/kinh-nghiem/${a.slug})${a.excerpt ? `: ${a.excerpt}` : ""}`).join("\n")}`)
  .join("\n\n")}
`;

  return new Response(body, {
    headers: { "Content-Type": "text/markdown; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
