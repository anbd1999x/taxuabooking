import MotoPartnerLanding from "@/components/partner/MotoPartnerLanding";
import { pageMeta } from "@/lib/og";

/** Menu "Hợp tác" → giới thiệu phần mềm quản lý tiệm cho thuê xe máy (dành cho chủ tiệm, tiếng Việt). */
// Trang CHỈ tiếng Việt ⇒ canonical luôn về bản vi, không khai hreflang en/zh/ko.
export const generateMetadata = () =>
  pageMeta({
    title: "Phần mềm quản lý tiệm cho thuê xe máy",
    description:
      "Biết ngay xe nào rảnh, ai đang thuê, ai đã cọc. Tự xếp xe không trùng lịch, biên bản giao xe có ảnh, tự tính phí phát sinh, nhận đơn từ Tà Xùa Booking.",
    path: "/hop-tac/xe-may",
    // Ảnh xem trước khi gửi link Zalo/Facebook (1200×630, dựng từ ảnh thiết kế xe-vang).
    image: "/hop-tac/og-xe-may.jpg",
    alt: "Phần mềm quản lý tiệm cho thuê xe máy - Tà Xùa Booking",
  });

export default function MotoPartnerPage() {
  return <MotoPartnerLanding />;
}
