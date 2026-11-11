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

/** Mã yêu cầu đặt dịch vụ: TX-XXXXXX. */
export function generateBookingCode(): string {
  let s = "";
  for (let i = 0; i < 6; i++) {
    s += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return `TX-${s}`;
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
