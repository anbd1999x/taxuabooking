import { CATEGORIES } from "./constants";

const STATIC_LABELS: Record<string, string> = {
  "/": "Trang chủ",
  "/combo": "Combo",
  "/gop-y": "Góp ý",
  "/lien-he": "Liên hệ",
  "/tra-cuu": "Tra cứu đơn",
  "/tai-khoan": "Tài khoản",
  "/lich-trinh": "Lịch trình",
  "/ban-do": "Bản đồ check-in",
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

// ======================= Diễn tả hành trình khách bằng câu (trang "Lượt truy cập") =======================

/** Tên thật theo slug (dịch vụ / địa điểm / bài viết / địa điểm vé) — trang quản trị tra DB rồi truyền vào. */
export interface TrackNames {
  services: Map<string, string>; // slug dịch vụ → tên
  places: Map<string, string>; // slug nhà hàng / cafe → tên
  articles: Map<string, string>; // slug bài viết → tiêu đề
  venues: Map<string, string>; // slug địa điểm vé → tên
}

const CAT_WORD: Record<string, string> = {
  "xe-cabin": "nhà xe cabin",
  homestay: "homestay",
  bungalow: "homestay",
  "thue-xe-may": "cửa hàng thuê xe máy",
  "xe-om": "dịch vụ xe ôm",
  taxi: "dịch vụ taxi",
  combo: "combo",
};
const CAT_LIST: Record<string, string> = {
  "xe-cabin": "Xem danh sách nhà xe cabin",
  homestay: "Xem danh sách homestay",
  bungalow: "Xem danh sách homestay",
  "thue-xe-may": "Xem danh sách thuê xe máy",
  "xe-om": "Xem dịch vụ xe ôm",
  taxi: "Xem dịch vụ taxi",
};
const LANG: Record<string, string> = { en: "tiếng Anh", zh: "tiếng Trung", ko: "tiếng Hàn" };
const AMEN: Record<string, string> = { cloudView: "view mây", bathtub: "bồn tắm", breakfast: "ăn sáng", airCon: "điều hòa", heating: "sưởi", pool: "hồ bơi", easyRoad: "đường dễ đi" };
const KIND: Record<string, string> = { single: "phòng đơn", double: "phòng đôi", dorm: "phòng tập thể" };
const HUB: Record<string, string> = { xe: "quản lý xe máy", home: "quản lý homestay", ticket: "bán vé & đặt bàn", qr: "gọi món QR" };

const dm = (k: string | null) => (k && /^\d{4}-\d{2}-\d{2}$/.test(k) ? `${k.slice(8, 10)}/${k.slice(5, 7)}` : "");
const k = (n: number) => (n >= 1000 ? `${Math.round(n / 1000).toLocaleString("vi-VN")}k` : String(n));
const nice = (slug: string) => decodeURIComponent(slug).replace(/-/g, " ");

/** Một dòng lượt xem trang ⇒ câu tiếng Việt, VD "Xem homestay Nhà Mây Si — nhận phòng 05/12 → trả 06/12 · 2 người lớn". */
export function describeView(pathRaw: string, names?: TrackNames): string {
  let u: URL;
  try {
    u = new URL(pathRaw, "http://x");
  } catch {
    return describePath(pathRaw);
  }
  let parts = u.pathname.split("/").filter(Boolean).map((p) => p.toLowerCase());
  let lang = "";
  if (parts[0] && LANG[parts[0]]) {
    lang = LANG[parts[0]];
    parts = parts.slice(1);
  }
  const q = u.searchParams;
  const p0 = parts[0] ?? "";
  const name = (map: Map<string, string> | undefined, slug: string) => map?.get(slug) ?? nice(slug);
  let base: string;
  if (!p0) base = "Vào trang chủ";
  else if (p0 === "combo") base = q.get("mode") === "tu-chon" ? "Xem Combo tự chọn" : q.get("from") ? "Tìm combo" : "Xem trang Combo";
  else if (CAT_WORD[p0] && parts.length === 1) base = CAT_LIST[p0] ?? `Xem ${CAT_WORD[p0]}`;
  else if (CAT_WORD[p0] && parts[2] === "phong") base = `Xem chi tiết một phòng của ${name(names?.services, parts[1])}`;
  else if (CAT_WORD[p0]) base = `Xem ${CAT_WORD[p0]} ${name(names?.services, parts[1])}`;
  else if (p0 === "kinh-nghiem") base = parts[1] ? `Đọc bài “${name(names?.articles, parts[1])}”` : "Xem danh sách bài kinh nghiệm";
  else if (p0 === "nha-hang") base = parts[1] ? `Xem nhà hàng ${name(names?.places, parts[1])}` : "Xem danh sách nhà hàng";
  else if (p0 === "cafe") base = parts[1] ? `Xem quán cafe ${name(names?.places, parts[1])}` : "Xem danh sách quán cafe";
  else if (p0 === "ve") base = parts[1] === "don" ? "Xem vé điện tử của đơn" : parts[1] ? `Xem đặt vé / đặt bàn tại ${name(names?.venues, parts[1])}` : "Xem trang Vé & đặt bàn";
  else if (p0 === "lich-trinh") base = q.get("ngay") ? `Xem lịch trình gợi ý ${q.get("ngay")} ngày` : "Xem lịch trình gợi ý";
  else if (p0 === "hop-tac") base = parts[1] === "dang-ky" ? "Xem trang đăng ký dùng miễn phí cho đối tác" : `Xem trang Tiện ích${q.get("m") && HUB[q.get("m")!] ? ` (${HUB[q.get("m")!]})` : ""}`;
  else if (p0 === "demo") base = "Dùng thử bản demo quản lý";
  else if (p0 === "tra-cuu") base = "Tra cứu đơn đã đặt";
  else if (p0 === "tai-khoan") base = "Vào trang tài khoản";
  else if (p0 === "ban-do") base = "Xem bản đồ điểm check-in";
  else if (p0 === "lien-he") base = "Xem trang liên hệ";
  else if (p0 === "gop-y") base = "Vào trang góp ý";
  else base = `Xem trang ${describePath(u.pathname)}`;

  // Chi tiết tìm kiếm trên URL
  const d: string[] = [];
  const from = dm(q.get("from"));
  const to = dm(q.get("to"));
  if (from || to) {
    if (p0 === "combo") d.push(`đi ${from || "?"} → về ${to || "?"}`);
    else if (p0 === "xe-cabin") d.push(to ? `đi ${from} · về ${to}` : `ngày đi ${from}`);
    else if (p0 === "thue-xe-may") d.push(`thuê ${from || "?"} → ${to || "?"}`);
    else d.push(`nhận phòng ${from || "?"} → trả ${to || "?"}`);
  }
  const people = Number(q.get("people") || q.get("adults") || 0);
  if (people > 0) d.push(`${people} người lớn`);
  const kids = (q.get("kids") ?? "").split("-").filter((x) => x !== "").length;
  if (kids) d.push(`${kids} trẻ em`);
  if (q.get("q")) d.push(`tìm “${q.get("q")}”`);
  if (q.get("origin")) d.push(`đón tại ${q.get("origin")}`);
  const price = q.get("price") ?? "";
  const pm = price.match(/^(lt|gt)(\d+)$/);
  if (pm) d.push(`giá ${pm[1] === "lt" ? "dưới" : "trên"} ${k(Number(pm[2]))}/khách`);
  const f = (q.get("f") ?? "").split(",").map((x) => AMEN[x]).filter(Boolean);
  if (f.length) d.push(`cần ${f.join(", ")}`);
  if (q.get("kind") && KIND[q.get("kind")!]) d.push(KIND[q.get("kind")!]);
  if (q.get("view") === "home") d.push("xem theo homestay");
  if (lang) d.push(`bản ${lang}`);
  return d.length ? `${base} — ${d.join(" · ")}` : base;
}

/** Biểu tượng + nhóm cho một dòng hành trình. */
export function actionTone(action: string): { icon: string; tone: "booking" | "contact" | "action" } {
  if (/^Gửi (yêu cầu|đơn)/.test(action)) return { icon: "✅", tone: "booking" };
  if (/gọi điện|Zalo|Messenger|Facebook/i.test(action)) return { icon: "📞", tone: "contact" };
  if (/Google Maps/i.test(action)) return { icon: "🗺️", tone: "action" };
  return { icon: "👆", tone: "action" };
}
