import { CATEGORIES } from "./constants";

const STATIC_LABELS: Record<string, string> = {
  "/": "Trang chủ",
  "/combo": "Combo",
  "/gop-y": "Góp ý",
  "/lien-he": "Liên hệ",
  "/tra-cuu": "Tra cứu đơn",
  "/tai-khoan": "Tài khoản",
  "/lich-trinh": "Lịch trình",
  "/kinh-nghiem": "Kinh nghiệm",
  "/huong-dan": "Hướng dẫn đặt",
  "/nha-hang": "Nhà hàng",
  "/cafe": "Cafe",
  "/chinh-sach-bao-mat": "Chính sách bảo mật",
};

// slug danh mục -> nhãn (VD: xe-cabin -> Xe cabin)
const CATEGORY_SLUG_LABEL: Record<string, string> = Object.fromEntries(
  Object.values(CATEGORIES).map((c) => [c.slug, c.shortLabel ?? c.label]),
);

/** Đổi đường dẫn thành nhãn dễ đọc cho trang quản trị. */
export function describePath(pathRaw: string): string {
  const path = pathRaw.split("?")[0].replace(/\/+$/, "") || "/";
  if (STATIC_LABELS[path]) return STATIC_LABELS[path];

  const parts = path.split("/").filter(Boolean);
  const cat = parts[0] ? CATEGORY_SLUG_LABEL[parts[0]] : undefined;
  if (cat) {
    if (parts.length === 1) return cat;
    if (parts[2] === "phong") return `${cat} · phòng`;
    return `${cat}: ${decodeURIComponent(parts[1])}`;
  }
  if (parts[0] === "kinh-nghiem" && parts[1]) return `Bài viết: ${decodeURIComponent(parts[1])}`;
  if (parts[0] === "nha-hang" && parts[1]) return `Nhà hàng: ${decodeURIComponent(parts[1])}`;
  if (parts[0] === "cafe" && parts[1]) return `Cafe: ${decodeURIComponent(parts[1])}`;
  return path;
}

/** Tóm tắt thiết bị / trình duyệt từ User-Agent. */
export function deviceLabel(uaRaw: string | null | undefined): string {
  const u = uaRaw ?? "";
  if (!u) return "Không rõ";
  const tablet = /iPad|Tablet/i.test(u);
  const mobile = /Mobile|Android|iPhone|iPod/i.test(u);
  const dev = tablet ? "Máy tính bảng" : mobile ? "Điện thoại" : "Máy tính";
  const br = /Edg/i.test(u)
    ? "Edge"
    : /OPR|Opera/i.test(u)
      ? "Opera"
      : /SamsungBrowser/i.test(u)
        ? "Samsung"
        : /Chrome/i.test(u)
          ? "Chrome"
          : /Firefox/i.test(u)
            ? "Firefox"
            : /Safari/i.test(u)
              ? "Safari"
              : "";
  const os = /Windows/i.test(u)
    ? "Windows"
    : /Android/i.test(u)
      ? "Android"
      : /iPhone|iPad|iPod/i.test(u)
        ? "iOS"
        : /Mac OS X/i.test(u)
          ? "macOS"
          : /Linux/i.test(u)
            ? "Linux"
            : "";
  return [dev, br].filter(Boolean).join(" · ") + (os ? ` (${os})` : "");
}

/** Khu vực gọn: "Hà Nội, Việt Nam" hoặc theo dữ liệu có. */
export function regionLabel(geo: { country: string | null; region: string | null; city: string | null } | undefined): string {
  if (!geo) return "Đang tra cứu…";
  const parts = [geo.city, geo.region, geo.country].filter(Boolean);
  // bỏ trùng (region trùng city)
  const uniq = parts.filter((p, i) => parts.indexOf(p) === i);
  return uniq.length ? uniq.join(", ") : "Không rõ";
}
