/**
 * Cấu hình tĩnh của site. Thông tin liên hệ động (số điện thoại, Zalo…)
 * được lấy từ bảng SiteSettings trong DB, đây chỉ là giá trị mặc định/SEO.
 */
export const SITE = {
  name: "Tà Xùa Booking",
  url: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  description:
    "Đặt xe cabin, homestay, bungalow, thuê xe máy, taxi và combo du lịch Tà Xùa. Xem giá và tình trạng còn chỗ theo ngày, gửi yêu cầu đặt nhanh chóng.",
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
