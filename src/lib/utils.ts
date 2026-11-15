/** Nối className có điều kiện (gọn, không cần thư viện ngoài). */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/** URL trỏ tới tệp video (theo đuôi tệp) — dùng cho danh sách ảnh/video lưu chung một cột. */
export function isVideoUrl(url: string): boolean {
  return /\.(mp4|m4v|webm|mov|mkv|avi)(?:[?#].*)?$/i.test(url);
}

/** Tạo slug thân thiện URL từ tiếng Việt (bỏ dấu). */
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // bỏ dấu
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // bỏ ký tự dễ nhầm

/** Tiền tố mã đơn theo loại dịch vụ: TX-<loại>-XXXXX. */
const BOOKING_CODE_PREFIX: Record<string, string> = {
  COMBO: "CB", // combo xe cabin + homestay
  CABIN: "XC", // xe cabin
  HOMESTAY: "HT",
  BUNGALOW: "HT", // bungalow đã gộp vào homestay
  MOTORBIKE: "XM", // thuê xe máy
  TAXI: "TX",
  XEOM: "XO",
};

/**
 * Mã yêu cầu đặt dịch vụ: TX-<loại>-XXXXX, vd TX-CB-7K2QM (combo), TX-HT-…, TX-XC-… (xe cabin),
 * TX-XM-… (xe máy), TX-TX-… (taxi), TX-XO-… (xe ôm). Loại lạ ⇒ TX-XXXXX.
 * Đơn cũ giữ mã cũ dạng TX-XXXXXX (tra cứu vẫn khớp nguyên văn).
 */
export function generateBookingCode(category?: string | null): string {
  let s = "";
  for (let i = 0; i < 5; i++) {
    s += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  const prefix = category ? BOOKING_CODE_PREFIX[category] : undefined;
  return prefix ? `TX-${prefix}-${s}` : `TX-${s}`;
}

/**
 * Chuẩn hoá link Facebook khách nhập tay: thêm https:// nếu thiếu, bỏ khoảng trắng.
 * Rỗng ⇒ null; không phải URL hợp lệ ⇒ undefined (để báo lỗi).
 */
export function normalizeFacebookUrl(input: string | null | undefined): string | null | undefined {
  const s = (input ?? "").trim();
  if (!s) return null;
  const withProto = /^https?:\/\//i.test(s) ? s : `https://${s.replace(/^\/+/, "")}`;
  try {
    const u = new URL(withProto);
    if (!u.hostname.includes(".") || withProto.length > 500) return undefined;
    return u.toString();
  } catch {
    return undefined;
  }
}
