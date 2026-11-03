// Metadata dùng chung cho trang Góp ý (/gop-y) công khai và trang quản trị
// (/admin/feedback). CHỈ dữ liệu thuần + hàm thuần — KHÔNG import server-only,
// để client component dùng lại được nhãn/màu.
import type { FeedbackStatus, FeedbackType } from "@prisma/client";

export interface FeedbackTypeMeta {
  key: FeedbackType;
  name: string; // nhãn đầy đủ (chọn khi gửi)
  short: string; // nhãn ngắn (badge trên bảng)
  desc: string; // mô tả dưới nút chọn
  ph: string; // placeholder gợi ý cho ô nội dung
  bg: string;
  fg: string;
}

export const FEEDBACK_TYPES: FeedbackTypeMeta[] = [
  {
    key: "IDEA",
    name: "Đề xuất tính năng",
    short: "Đề xuất",
    desc: "Muốn website có thêm gì",
    ph: 'VD: Mình muốn lọc homestay theo "cho mang thú cưng"…',
    bg: "#eef4ff",
    fg: "#2456c9",
  },
  {
    key: "BUG",
    name: "Báo lỗi",
    short: "Báo lỗi",
    desc: "Nút không bấm được, sai giá…",
    ph: "Lỗi ở trang nào, bạn bấm gì, thấy gì? Càng chi tiết càng dễ sửa.",
    bg: "#fdecec",
    fg: "#c62f2f",
  },
  {
    key: "SERVICE",
    name: "Dịch vụ & chuyến đi",
    short: "Dịch vụ",
    desc: "Xe, homestay, tài xế…",
    ph: "Kể lại trải nghiệm: dịch vụ nào, ngày nào, điều gì tốt hoặc chưa tốt.",
    bg: "#fff3e0",
    fg: "#c06a12",
  },
  {
    key: "OTHER",
    name: "Khác",
    short: "Khác",
    desc: "Hợp tác, câu hỏi…",
    ph: "Bạn muốn nói gì với tụi mình?",
    bg: "#f1f3f2",
    fg: "#55605a",
  },
];

export function feedbackType(key: FeedbackType): FeedbackTypeMeta {
  return FEEDBACK_TYPES.find((t) => t.key === key) ?? FEEDBACK_TYPES[0];
}

export interface FeedbackStatusMeta {
  key: FeedbackStatus;
  name: string;
  bg: string;
  fg: string;
}

export const FEEDBACK_STATUSES: FeedbackStatusMeta[] = [
  { key: "NEW", name: "Mới", bg: "#f1f3f2", fg: "#55605a" },
  { key: "REVIEW", name: "Đang xem xét", bg: "#fff3e0", fg: "#c06a12" },
  { key: "PLAN", name: "Đã lên kế hoạch", bg: "#eef4ff", fg: "#2456c9" },
  { key: "DONE", name: "Đã làm", bg: "#e4f5ea", fg: "#1b7a45" },
];

export function feedbackStatus(key: FeedbackStatus): FeedbackStatusMeta {
  return FEEDBACK_STATUSES.find((s) => s.key === key) ?? FEEDBACK_STATUSES[0];
}

// Chấm trải nghiệm web (mood): 1..5
export const FEEDBACK_MOODS = ["Rất tệ", "Chưa ổn", "Tạm được", "Tốt", "Tuyệt vời"];

// Chip trang / tính năng liên quan
export const FEEDBACK_AREAS = [
  "Trang chủ",
  "Tìm & lọc",
  "Combo",
  "Xe cabin",
  "Homestay",
  "Thuê xe máy",
  "Đặt dịch vụ",
  "Tra cứu đơn",
  "Trên điện thoại",
  "Tốc độ tải",
];

export const FEEDBACK_FAQS: { q: string; a: string }[] = [
  {
    q: "Góp ý của tôi có được đọc không?",
    a: "Có. Mọi góp ý đều được đội ngũ đọc và phân loại trong ngày. Nếu bạn để lại liên hệ, tụi mình sẽ phản hồi trong 1–2 ngày làm việc.",
  },
  {
    q: "Tôi báo lỗi về giá thì bao lâu được sửa?",
    a: "Lỗi liên quan tới giá và tình trạng phòng/xe được ưu tiên cao nhất, thường xử lý trong 24 giờ.",
  },
  {
    q: "Muốn hợp tác đăng dịch vụ (homestay, xe…) thì liên hệ ở đâu?",
    a: 'Chọn mục "Khác" trong form hoặc gọi hotline, tụi mình sẽ hướng dẫn đăng dịch vụ.',
  },
  {
    q: "Có thể góp ý ẩn danh không?",
    a: 'Được. Tích "Ẩn tên trên bảng góp ý" khi gửi — tên bạn sẽ hiển thị là "Ẩn danh".',
  },
];

/** "2 giờ trước", "3 ngày trước"… từ số phút. */
export function agoText(mins: number): string {
  if (mins < 1) return "Vừa xong";
  if (mins < 60) return `${mins} phút trước`;
  if (mins < 1440) return `${Math.round(mins / 60)} giờ trước`;
  return `${Math.round(mins / 1440)} ngày trước`;
}

// ---- Khối "Góp ý qua Facebook" (admin cấu hình, lưu trong SiteSetting) ----
export const FB_PROFILE_KEY = "gopyFbProfile";
export const FB_OWNER_KEY = "gopyFbOwner";
export const FB_POSTS_KEY = "gopyFbPosts";

export interface FbPost {
  title: string;
  text: string;
  image: string; // url ảnh (có thể rỗng)
  url: string; // link tới bài viết
  date: string; // "30/10/2026"
  stats: string; // "128 thích · 46 bình luận"
  cmtBy: string; // tên người bình luận nổi bật
  cmt: string; // nội dung bình luận nổi bật
  open: boolean; // true = đang nhận góp ý; false = đã tổng hợp
}

/** Parse JSON danh sách bài Facebook từ SiteSetting (an toàn, luôn trả mảng). */
export function parseFbPosts(raw: string | undefined | null): FbPost[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.map((p): FbPost => ({
      title: String(p?.title ?? ""),
      text: String(p?.text ?? ""),
      image: String(p?.image ?? ""),
      url: String(p?.url ?? ""),
      date: String(p?.date ?? ""),
      stats: String(p?.stats ?? ""),
      cmtBy: String(p?.cmtBy ?? ""),
      cmt: String(p?.cmt ?? ""),
      open: Boolean(p?.open),
    }));
  } catch {
    return [];
  }
}
