import "server-only";
import type { Place } from "@prisma/client";

type T = (s: string, vars?: readonly (string | number | null | undefined)[]) => string;
type PlaceMetaInput = Pick<Place, "name" | "area" | "desc" | "hours" | "price" | "kind" | "tags" | "content" | "booking">;

const TITLE_MAX = 60;
const DESC_MAX = 155;
const TX = /tà xùa|ta xua|塔萨|따쑤아/i;
/** Từ chỉ loại quán — tên có dạng "<Tên riêng> – Nhà hàng & Cafe" thì người tìm chỉ gõ phần tên riêng. */
const GENERIC = /^(nhà hàng|quán|cafe|café|cà phê|coffee|tiệm|bar|homestay)$/i;
const DESCRIPTOR = /nhà hàng|cafe|café|cà phê|coffee|homestay|ẩm thực|tinh hoa|bar\b/i;

/**
 * Tên ngắn người hay gõ: "Nhà Hàng A Phủ – Tinh Hoa Ẩm Thực Tà Xùa" → "Nhà Hàng A Phủ",
 * "Lili Mountain – Tiệm cà phê Tử Tế" → "Lili Mountain". Giữ nguyên khi phần trước dấu gạch chỉ là từ chung
 * ("Nhà Hàng – Coffee Gió Bản") hoặc phần sau không phải lời mô tả loại quán ("Vua Lẩu – Nướng").
 */
function shortName(name: string, translated: string): string {
  const parts = name.split(/\s+[–-]\s+/);
  if (parts.length < 2) return translated;
  const head = parts[0].trim();
  if (head.split(/\s+/).length < 2 || GENERIC.test(head) || !DESCRIPTOR.test(parts.slice(1).join(" "))) return translated;
  const tParts = translated.split(/\s+[–-]\s+/);
  return tParts.length >= 2 ? tParts[0].trim() : translated;
}

/** "Từ 249.000đ" / "40000" → "249.000đ"; giá không có số ("Miễn phí", "Liên hệ") → "". */
function priceFrom(price: string | null | undefined): string {
  const s = price?.trim() ?? "";
  if (/^\d+$/.test(s)) return `${Number(s).toLocaleString("vi-VN")}đ`;
  const m = s.match(/(\d{1,3}(?:[.,]\d{3})+|\d+)\s*(k|đ|vnđ|vnd)?/i);
  if (!m) return "";
  if (/^k$/i.test(m[2] ?? "")) return `${Number(m[1].replace(/[.,]/g, "")).toLocaleString("vi-VN")}.000đ`;
  return `${m[1].replace(/,/g, ".")}đ`;
}

/** Ghép các cụm theo thứ tự ưu tiên tới khi chạm giới hạn ký tự. */
function fill(head: string, parts: string[], max: number, sep = ", "): string {
  let out = "";
  for (const p of parts.filter(Boolean)) {
    const next = out ? out + sep + p : p;
    if (`${head}: ${next}`.length <= max) out = next;
  }
  return out ? `${head}: ${out}` : head;
}

/**
 * Tiêu đề + mô tả tìm kiếm cho trang chi tiết quán (/cafe/<slug>, /nha-hang/<slug>).
 * Người tìm gõ "<tên quán> tà xùa" rồi thêm "menu", "giá", "giờ mở cửa", "view" ⇒ tiêu đề bắt đầu bằng
 * "<tên ngắn> Tà Xùa:" rồi tới đúng những thứ TRANG ĐANG HIỆN (món trong phần giới thiệu, giá, giờ mở cửa,
 * nhãn view). Thiếu dữ liệu thì không nhắc tới. Tiêu đề ≤ 60 ký tự (dài hơn 44 ⇒ trang dùng `absolute`).
 * Mô tả = tên + khu + câu giới thiệu + dữ kiện có thật (giá, giờ mở, đặt bàn), ≤ 155 ký tự.
 */
export function placeMeta(p: PlaceMetaInput, t: T) {
  // "Nhà hàng Hang Chú – Tà Xùa" → "Nhà hàng Hang Chú Tà Xùa".
  const clean = (s: string) => s.trim().replace(/\s+/g, " ").replace(/\s+[–-]\s+(tà xùa)$/i, " $1");
  const name = shortName(clean(p.name), clean(t(p.name.trim().replace(/\s+/g, " "))));
  const withTx = TX.test(name) ? name : t("{0} Tà Xùa", [name]);
  const isCafe = p.kind === "CAFE";
  const tags = (p.tags ?? "").toLowerCase();
  const text = `${p.desc ?? ""} ${p.content ?? ""} ${p.tags ?? ""}`.toLowerCase();
  const area = p.area?.trim() ? t(p.area.trim()) : "";
  const price = priceFrom(p.price);
  const hours = p.hours?.trim() ?? "";

  // Nhãn view lấy theo thẻ đặc điểm (hiện ở mục "Điểm nổi bật" của trang).
  const views: string[] = [];
  if (/săn mây|view mây/.test(tags)) views.push(t("view mây"));
  else if (/view núi/.test(tags)) views.push(t("view núi"));
  if (/hoàng hôn/.test(tags)) views.push(t("ngắm hoàng hôn"));
  const viewPart = views.join(", ");

  const parts: string[] = [];
  if (isCafe) {
    if (viewPart) parts.push(viewPart);
    if (price) parts.push(t("đồ uống từ {0}", [price]));
    else if (/menu|đồ uống|cà phê|trà|nước ép|cocktail/.test(text)) parts.push(t("đồ uống"));
    if (/có đồ ăn|cơm/.test(tags)) parts.push(t("có đồ ăn"));
    if (hours) parts.push(t("giờ mở cửa"));
  } else {
    // Món đặc trưng theo thẻ: "menu đồ nướng", "set món"…
    const spec = /set món/.test(tags) ? t("set món") : /lẩu/.test(tags) ? t("menu lẩu nướng") : /nướng/.test(tags) ? t("menu đồ nướng") : /đặc sản/.test(tags) ? t("menu đặc sản") : "";
    const hasDishes = spec || /thực đơn|menu|món|lẩu|nướng|gà|cá suối/.test(text);
    if (hasDishes) parts.push(spec || t("menu"));
    if (price) parts.push(t("giá từ {0}", [price]));
    if (hours) parts.push(t("giờ mở cửa"));
    if (viewPart) parts.push(viewPart);
    if (/nhóm đông/.test(tags)) parts.push(t("nhận đoàn"));
  }
  // Ít dữ kiện thì thêm loại quán + khu để tiêu đề vẫn đủ nghĩa.
  if (parts.length < 2 && area) parts.push(isCafe ? t("quán cà phê khu {0}", [area]) : t("nhà hàng khu {0}", [area]));
  const title = fill(withTx, parts, TITLE_MAX);

  // Mô tả: "<Tên> ở khu <khu>, Tà Xùa. <giới thiệu>. Giá…, mở…, đặt bàn…. Xem ảnh…"
  const intro = (p.desc ? t(p.desc) : "").trim().replace(/\s+/g, " ").replace(/[.。．!！\s]+$/u, "");
  const lead = !area
    ? TX.test(name) ? `${name}.` : t("{0} ở Tà Xùa.", [name])
    : TX.test(name) ? t("{0} ở khu {1}.", [name, area]) : t("{0} ở khu {1}, Tà Xùa.", [name, area]);
  const facts: string[] = [];
  if (price) facts.push(isCafe ? t("Đồ uống từ {0}", [price]) : t("Giá từ {0}", [price]));
  if (hours) facts.push(t("mở {0}", [hours]));
  if (p.booking === "call") facts.push(t("nhận đặt bàn trước"));
  else if (p.booking === "group") facts.push(t("nhận đặt bàn nhóm từ 6 người"));
  const factStr = facts.length ? facts.join(", ").replace(/^\p{Ll}/u, (ch) => ch.toUpperCase()) + "." : "";
  const cta = isCafe ? t("Xem ảnh view, bản đồ, đánh giá.") : t("Xem ảnh món, bản đồ, đánh giá.");

  const fixed = [lead, factStr, cta].filter(Boolean).join(" ");
  let description: string;
  if (!intro) description = fixed;
  else {
    const room = DESC_MAX - fixed.length - 1;
    // Dài quá thì cắt ở ranh giới vế câu (; — , :) để câu còn trọn ý; vế còn lại quá ngắn thì bỏ hẳn.
    let introCut = "";
    if (intro.length + 1 <= room) introCut = intro + ".";
    else {
      const head = intro.slice(0, room);
      const cut = Math.max(head.lastIndexOf(";"), head.lastIndexOf(" —"), head.lastIndexOf(" –"), head.lastIndexOf(","), head.lastIndexOf(":"));
      if (cut >= 20) introCut = head.slice(0, cut).trim() + ".";
      else if (room >= 40) introCut = head.slice(0, room - 1).replace(/[\s,;:]+\S*$/, "") + "…";
      // Vế đầu chỉ nhắc lại vị trí ("Tọa lạc tại bản Khe Cải, Tà Xùa") thì bỏ, phần dẫn đã có khu.
      if (introCut.length < 45 && area && introCut.toLowerCase().includes(area.toLowerCase())) introCut = "";
    }
    description = [lead, introCut, factStr, cta].filter(Boolean).join(" ");
  }
  if (description.length > DESC_MAX) description = [lead, factStr, cta].filter(Boolean).join(" ").slice(0, DESC_MAX);
  // Còn chỗ thì thêm các thẻ đặc điểm (đúng như mục "Điểm nổi bật" trên trang).
  const tagList = (p.tags ?? "").split(",").map((x) => x.trim()).filter((x) => x && !/^gợi ý$|giá niêm yết/i.test(x)).map((x) => t(x).toLowerCase());
  for (let n = tagList.length; n > 0; n--) {
    const extra = t("Nổi bật: {0}.", [tagList.slice(0, n).join(", ")]);
    const withTags = description.replace(cta, `${extra} ${cta}`);
    if (description.length < 135 && withTags.length <= DESC_MAX) { description = withTags; break; }
  }
  return { title, description };
}
