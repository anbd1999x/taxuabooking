import type {
  ServiceCategory,
  AvailabilityStatus,
  BookingStatus,
} from "@prisma/client";

/** Loại hình "lịch theo ngày" của từng danh mục — quyết định UI đặt dịch vụ. */
export type AvailabilityKind = "stay" | "trip" | "rental" | "transport";

export interface CategoryMeta {
  key: ServiceCategory;
  slug: string;
  label: string;
  shortLabel: string;
  tagline: string;
  availabilityKind: AvailabilityKind;
  priceUnit: string;
}

export const CATEGORIES: Record<ServiceCategory, CategoryMeta> = {
  CABIN: {
    key: "CABIN",
    slug: "xe-cabin",
    label: "Xe cabin đi Tà Xùa",
    shortLabel: "Xe cabin",
    tagline: "Xe giường nằm cabin đời mới, đón tận nơi",
    availabilityKind: "trip",
    priceUnit: "/vé",
  },
  HOMESTAY: {
    key: "HOMESTAY",
    slug: "homestay",
    label: "Homestay & Bungalow Tà Xùa",
    shortLabel: "Homestay",
    tagline: "Homestay & bungalow view săn mây",
    availabilityKind: "stay",
    priceUnit: "/đêm",
  },
  BUNGALOW: {
    key: "BUNGALOW",
    slug: "bungalow",
    label: "Bungalow Tà Xùa",
    shortLabel: "Bungalow",
    tagline: "Phòng riêng giữa biển mây",
    availabilityKind: "stay",
    priceUnit: "/đêm",
  },
  MOTORBIKE: {
    key: "MOTORBIKE",
    slug: "thue-xe-may",
    label: "Thuê xe máy Tà Xùa",
    shortLabel: "Thuê xe máy",
    tagline: "Xe bền, khỏe, leo đèo tốt",
    availabilityKind: "rental",
    priceUnit: "/ngày",
  },
  XEOM: {
    key: "XEOM",
    slug: "xe-om",
    label: "Xe ôm Tà Xùa",
    shortLabel: "Xe ôm",
    tagline: "Tài xế bản địa, thông thạo đường",
    availabilityKind: "transport",
    priceUnit: "",
  },
  TAXI: {
    key: "TAXI",
    slug: "taxi",
    label: "Taxi Tà Xùa",
    shortLabel: "Taxi",
    tagline: "Xe 4-7 chỗ, đưa đón theo tuyến",
    availabilityKind: "transport",
    priceUnit: "",
  },
  COMBO: {
    key: "COMBO",
    slug: "combo",
    label: "Combo du lịch Tà Xùa",
    shortLabel: "Combo",
    tagline: "Trọn gói xe + phòng + trải nghiệm",
    availabilityKind: "stay",
    priceUnit: "/combo",
  },
};

/** Danh sách danh mục theo thứ tự hiển thị. (Bungalow đã gộp vào Homestay.) */
export const CATEGORY_LIST: CategoryMeta[] = [
  CATEGORIES.COMBO,
  CATEGORIES.CABIN,
  CATEGORIES.HOMESTAY,
  CATEGORIES.MOTORBIKE,
  CATEGORIES.XEOM,
  CATEGORIES.TAXI,
];

/** Chủ đề bài viết kinh nghiệm (lọc ở /kinh-nghiem + gợi ý bài cùng chủ đề). */
export const ARTICLE_TOPICS = [
  { key: "diem-den", label: "Điểm đến & trải nghiệm" },
  { key: "lich-trinh", label: "Lịch trình & chi phí" },
  { key: "di-chuyen", label: "Di chuyển" },
  { key: "an-uong", label: "Ăn uống & đặc sản" },
  { key: "cam-nang", label: "Cẩm nang & mẹo" },
] as const;

export function articleTopicLabel(key: string | null | undefined): string | null {
  return ARTICLE_TOPICS.find((t) => t.key === key)?.label ?? null;
}

/** Khu vực chuẩn cho homestay/bungalow (dropdown trong admin).
 *  Khoảng cách tới trung tâm nhập riêng ở ô "Cách trung tâm (km)" (Service.distanceKm). */
export const AREA_OPTIONS = [
  "Trung tâm Tà Xùa",
  "Đỉnh Gió",
  "Khe Cải",
  "Sống lưng khủng long",
  "Mống Vàng",
];

export function categoryBySlug(slug: string): CategoryMeta | undefined {
  return CATEGORY_LIST.find((c) => c.slug === slug);
}

/** Nhãn + màu cho tình trạng còn chỗ. */
export const AVAILABILITY_META: Record<
  AvailabilityStatus,
  { label: string; tone: "ok" | "warn" | "danger" | "muted" | "info" }
> = {
  AVAILABLE: { label: "Còn chỗ", tone: "ok" },
  LIMITED: { label: "Còn ít chỗ", tone: "warn" },
  SOLD_OUT: { label: "Hết chỗ", tone: "danger" },
  NOT_UPDATED: { label: "Chưa cập nhật", tone: "muted" },
  PENDING_CONFIRM: { label: "Chờ xác nhận", tone: "info" },
};

/** Nhãn trạng thái yêu cầu đặt. */
export const BOOKING_STATUS_META: Record<
  BookingStatus,
  { label: string; tone: "ok" | "warn" | "danger" | "muted" | "info" }
> = {
  NEW: { label: "Mới", tone: "info" },
  CONTACTING: { label: "Đang liên hệ", tone: "warn" },
  CONFIRMED: { label: "Đã xác nhận", tone: "ok" },
  COMPLETED: { label: "Đã hoàn thành", tone: "muted" },
  CANCELLED: { label: "Đã hủy", tone: "danger" },
};

export const BOOKING_STATUS_LIST: BookingStatus[] = [
  "NEW",
  "CONTACTING",
  "CONFIRMED",
  "COMPLETED",
  "CANCELLED",
];
