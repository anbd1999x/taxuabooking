import { ARTICLE_TOPICS } from "@/lib/constants";

/**
 * TRANG HUB CHỦ ĐỀ bài kinh nghiệm: /kinh-nghiem/chu-de/<topic> (thay cho /kinh-nghiem?topic=… cũ, nay 308 về đây).
 * Mỗi chủ đề trong ARTICLE_TOPICS có H1 / tiêu đề / mô tả theo cách người tìm gõ (chuỗi tiếng Việt = khoá từ điển,
 * bản en/zh/ko ở src/lib/i18n/dict). Câu dữ kiện trong đoạn giới thiệu dựng ở trang từ DB, không viết số tay ở đây.
 * Ràng buộc: title ≤ 60 ký tự, description ≤ 155 ký tự (xem docs/seo-geo.md).
 */
export type ArticleTopicKey = (typeof ARTICLE_TOPICS)[number]["key"];

export interface ArticleHub {
  h1: string;
  title: string;
  description: string;
  /** Câu mở đầu đoạn giới thiệu (không số liệu). */
  lead: string;
  /** Trang dịch vụ / công cụ liên quan để đi tiếp (đường dẫn gốc tiếng Việt + nhãn = khoá từ điển). */
  links: { href: string; label: string }[];
}

export const ARTICLE_HUBS: Record<ArticleTopicKey, ArticleHub> = {
  "diem-den": {
    h1: "Điểm đến Tà Xùa: điểm check-in và trải nghiệm",
    title: "Điểm check-in Tà Xùa: sống lưng khủng long, mỏm cá heo",
    description:
      "Điểm đến Tà Xùa: sống lưng khủng long, mỏm cá heo, Đỉnh Gió, bản Háng Đồng, săn mây, trekking. Đường đi, giá vé và giờ đẹp của từng điểm.",
    lead: "Các bài về điểm check-in, cung săn mây và trải nghiệm ở Tà Xùa: đường đi, giá vé, giờ đẹp và nên gom điểm nào vào cùng một buổi.",
    links: [
      { href: "/ban-do", label: "Bản đồ Tà Xùa" },
      { href: "/xe-om", label: "Xe ôm Tà Xùa" },
      { href: "/thue-xe-may", label: "Thuê xe máy Tà Xùa" },
    ],
  },
  "lich-trinh": {
    h1: "Lịch trình du lịch Tà Xùa và chi phí",
    title: "Lịch trình Tà Xùa: 2N1Đ, 3N2Đ, theo tháng và chi phí",
    description:
      "Lịch trình Tà Xùa 2 ngày 1 đêm, 3 ngày 2 đêm, gợi ý từng tháng, đi cùng gia đình hay một mình, kèm chi phí từng khoản theo giá xe và phòng đang bán.",
    lead: "Lịch trình theo giờ cho chuyến 2 ngày 1 đêm, 3 ngày 2 đêm, gợi ý từng tháng trong năm và cách tính chi phí cho từng nhóm khách.",
    links: [
      { href: "/lich-trinh", label: "Lịch trình & chi phí đi Tà Xùa" },
      { href: "/combo", label: "Combo xe cabin + homestay" },
    ],
  },
  "di-chuyen": {
    h1: "Kinh nghiệm di chuyển đi Tà Xùa",
    title: "Di chuyển đi Tà Xùa: xe cabin, xe máy, xe ôm, ô tô",
    description:
      "Cách đi Tà Xùa từ Hà Nội và các tỉnh: so sánh nhà xe cabin, điểm đón, giá vé, thuê xe máy, xe ôm, taxi và tự lái ô tô qua đèo.",
    lead: "Hướng dẫn đi Tà Xùa từ Hà Nội và từng tỉnh, so sánh nhà xe cabin, điểm đón, cách lên homestay và đi lại giữa các điểm check-in.",
    links: [
      { href: "/xe-cabin", label: "Xe cabin Hà Nội – Tà Xùa" },
      { href: "/xe-om", label: "Xe ôm Tà Xùa" },
      { href: "/taxi", label: "Taxi Tà Xùa" },
      { href: "/thue-xe-may", label: "Thuê xe máy Tà Xùa" },
    ],
  },
  "an-uong": {
    h1: "Ăn gì ở Tà Xùa: món ngon, quán ăn và đặc sản",
    title: "Ăn gì ở Tà Xùa: món ngon, quán ăn, đặc sản mua về",
    description:
      "Ăn gì ở Tà Xùa: đặc sản nên thử, nhà hàng và quán cà phê theo khu, ăn sáng sau săn mây, BBQ buổi tối, trà Shan Tuyết và táo mèo làm quà.",
    lead: "Các bài về món ăn, quán ăn và đặc sản Tà Xùa: nên thử món gì, ăn ở khu nào, giá bao nhiêu và mua gì về làm quà.",
    links: [
      { href: "/nha-hang", label: "Nhà hàng, quán ăn Tà Xùa" },
      { href: "/cafe", label: "Quán cafe Tà Xùa" },
    ],
  },
  "cam-nang": {
    h1: "Cẩm nang du lịch Tà Xùa: mẹo và lưu ý",
    title: "Cẩm nang du lịch Tà Xùa: mùa đẹp, chỗ ở, mẹo đi lần đầu",
    description:
      "Cẩm nang du lịch Tà Xùa: mùa nào đẹp, ở khu nào, đặt phòng ra sao, chuẩn bị gì, săn mây, an toàn, sóng điện thoại và sai lầm khi đi lần đầu.",
    lead: "Những điều nên biết trước chuyến đi: Tà Xùa ở đâu, mùa nào có mây, nên ở khu nào, chuẩn bị đồ gì và lưu ý an toàn.",
    links: [
      { href: "/homestay", label: "Homestay Tà Xùa" },
      { href: "/xe-cabin", label: "Xe cabin Hà Nội – Tà Xùa" },
      { href: "/huong-dan", label: "Hướng dẫn đặt dịch vụ" },
    ],
  },
  "review-homestay": {
    h1: "Review homestay Tà Xùa",
    title: "Review homestay Tà Xùa: đánh giá chi tiết từng nhà",
    description:
      "Review từng homestay, bungalow ở Tà Xùa: vị trí, hạng phòng, giá ngày thường và cuối tuần, view mây, ưu nhược điểm. Dựa trên bảng giá đang mở bán.",
    lead: "Review từng homestay, bungalow ở Tà Xùa: vị trí, hạng phòng, giá ngày thường và cuối tuần, view mây, ưu nhược điểm.",
    links: [
      { href: "/homestay", label: "Homestay Tà Xùa" },
      { href: "/combo", label: "Combo xe cabin + homestay" },
    ],
  },
};

export const isArticleTopic = (v: unknown): v is ArticleTopicKey => typeof v === "string" && ARTICLE_TOPICS.some((t) => t.key === v);

/** Đường dẫn gốc (tiếng Việt) của trang hub một chủ đề. */
export const articleHubPath = (topic: string) => `/kinh-nghiem/chu-de/${topic}`;
