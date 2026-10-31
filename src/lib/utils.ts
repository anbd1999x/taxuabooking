/** Nối className có điều kiện (gọn, không cần thư viện ngoài). */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
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
