import MotoPartnerLanding from "@/components/partner/MotoPartnerLanding";
import { i18nMeta } from "@/lib/i18n/meta";

/** Menu "Hợp tác" → giới thiệu phần mềm quản lý tiệm cho thuê xe máy (dành cho chủ tiệm, tiếng Việt). */
export const generateMetadata = () =>
  i18nMeta({
    title: "Phần mềm quản lý tiệm cho thuê xe máy",
    description:
      "Biết ngay xe nào rảnh, ai đang thuê, ai đã cọc. Tự xếp xe không trùng lịch, biên bản giao xe có ảnh, tự tính phí phát sinh, nhận đơn từ Tà Xùa Booking.",
    path: "/hop-tac/xe-may",
  });

export default function MotoPartnerPage() {
  return <MotoPartnerLanding />;
}
