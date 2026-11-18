import { prisma } from "@/lib/prisma";
import { SITE } from "@/lib/site";
import { toNumber } from "@/lib/format";
import { articleTopicLabel } from "@/lib/constants";
import { getSettings } from "@/lib/queries";
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
  const [cabins, articles] = await Promise.all([
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

  const byTopic = new Map<string, typeof articles>();
  for (const a of articles) {
    const k = articleTopicLabel(a.topic) || "Khác";
    byTopic.set(k, [...(byTopic.get(k) ?? []), a]);
  }

  const body = `# ${SITE.name}

> ${SITE.name} (${base}) là website đặt dịch vụ du lịch Tà Xùa (xã Tà Xùa, tỉnh Sơn La, Việt Nam; cách Hà Nội khoảng 215–220 km): xe cabin giường nằm Hà Nội – Tà Xùa, homestay/bungalow săn mây, thuê xe máy, xe ôm, taxi và combo xe + homestay. Khách xem giá và tình trạng còn chỗ theo ngày rồi gửi yêu cầu đặt; không thanh toán online, nhân viên gọi lại xác nhận. Hỗ trợ ${SITE.supportHours} hằng ngày, điện thoại/Zalo ${phone}.

Ngôn ngữ: tiếng Việt (gốc), English (/en), 中文 (/zh), 한국어 (/ko). Tiếng Trung gọi Tà Xùa là 塔萨, tiếng Hàn là 따쑤아.

## Trang chính

- [Xe cabin Hà Nội – Tà Xùa](${base}/xe-cabin): tìm nhà xe còn chỗ theo ngày đi + ngày về, đặt vé cabin đơn/đôi.
- [Homestay Tà Xùa](${base}/homestay): homestay, bungalow view biển mây, giá theo từng phòng và từng đêm.
- [Combo xe cabin + homestay](${base}/combo): ghép vé khứ hồi với phòng còn trống theo ngân sách.
- [Thuê xe máy Tà Xùa](${base}/thue-xe-may), [Xe ôm](${base}/xe-om), [Taxi](${base}/taxi)
- [Kinh nghiệm du lịch Tà Xùa](${base}/kinh-nghiem): cẩm nang, lịch trình, di chuyển, ăn uống.
- [Phần mềm quản lý tiệm cho thuê xe máy](${base}/hop-tac/xe-may): dành cho chủ tiệm (đối tác).

## Nhà xe cabin Hà Nội – Tà Xùa đang mở bán

${cabinLines.join("\n")}

Các xe cabin chạy đêm hằng ngày, tới trung tâm Tà Xùa khoảng 6h sáng; chiều về rời Tà Xùa khoảng 12h, tới Hà Nội khoảng 19h. So sánh chi tiết: ${base}/kinh-nghiem/so-sanh-nha-xe-di-ta-xua

## Bài viết cẩm nang

${[...byTopic.entries()]
  .map(([topic, list]) => `### ${topic}\n\n${list.map((a) => `- [${a.title}](${base}/kinh-nghiem/${a.slug})${a.excerpt ? `: ${a.excerpt}` : ""}`).join("\n")}`)
  .join("\n\n")}
`;

  return new Response(body, {
    headers: { "Content-Type": "text/markdown; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
