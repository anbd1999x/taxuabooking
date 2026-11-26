/**
 * Cấu hình tĩnh của site. Thông tin liên hệ động (số điện thoại, Zalo…)
 * được lấy từ bảng SiteSettings trong DB, đây chỉ là giá trị mặc định/SEO.
 */
export const SITE = {
  name: "Tà Xùa Booking",
  url: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  /** CÂU MÔ TẢ THƯƠNG HIỆU CHUẨN — dùng nguyên văn ở JSON-LD, /llms.txt, trang giới thiệu (và Facebook, hồ sơ ngoài). Đừng viết câu khác. */
  about:
    "Tà Xùa Booking là nền tảng trung gian đặt dịch vụ du lịch tại Tà Xùa, chuyên cung cấp dịch vụ đặt homestay, xe cabin, thuê xe máy, xe ôm, taxi và combo du lịch. Nền tảng hỗ trợ tra cứu giá, tình trạng phòng và gửi yêu cầu đặt dịch vụ trực tuyến.",
  /** Bản rút gọn ≤155 ký tự của câu chuẩn — thẻ meta description mặc định, footer. */
  description:
    "Tà Xùa Booking là nền tảng trung gian đặt homestay, xe cabin, thuê xe máy, xe ôm, taxi và combo du lịch Tà Xùa. Tra giá, phòng trống, gửi yêu cầu đặt.",
  /** Thông tin pháp lý mặc định (SiteSettings `legalName` / `taxCode` / `legalAddress` ghi đè nếu có). */
  legalName: "Tà Xùa Booking (cá nhân kinh doanh)",
  taxCode: "042098000948",
  legalAddress: "Đậu Liêu, Hồng Lĩnh, Hà Tĩnh",
  /** Email liên hệ duy nhất hiển thị trên toàn web. */
  email: "lienhe@taxuabooking.com",
  defaultPhone: "0357452952",
  defaultZalo: "0357452952",
  /** Giờ hoạt động (có người hỗ trợ, xác nhận đơn) — giờ Việt Nam. */
  supportHours: "8:00–23:00",
  supportOpenHour: 8,
  supportCloseHour: 23,
} as const;

/** `@id` của thực thể tổ chức (TravelAgency) và website khai ở layout gốc — mọi JSON-LD khác chỉ THAM CHIẾU `{ "@id": ORG_ID }`, không nhúng lại cả khối. */
export const ORG_ID = `${SITE.url}/#organization`;
export const WEBSITE_ID = `${SITE.url}/#website`;
