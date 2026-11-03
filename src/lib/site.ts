/**
 * Cấu hình tĩnh của site. Thông tin liên hệ động (số điện thoại, Zalo…)
 * được lấy từ bảng SiteSettings trong DB, đây chỉ là giá trị mặc định/SEO.
 */
export const SITE = {
  name: "Tà Xùa Booking",
  url: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  description:
    "Đặt xe cabin, homestay, bungalow, thuê xe máy, taxi và combo du lịch Tà Xùa. Xem giá và tình trạng còn chỗ theo ngày, gửi yêu cầu đặt nhanh chóng.",
  defaultPhone: "0357452952",
  defaultZalo: "0357452952",
} as const;
