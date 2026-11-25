import "server-only";
import type { Place } from "@prisma/client";

type T = (s: string, vars?: readonly (string | number | null | undefined)[]) => string;

/**
 * Tiêu đề + mô tả tìm kiếm cho trang chi tiết quán (/cafe/<slug>, /nha-hang/<slug>).
 * Người tìm thường gõ "<tên quán> tà xùa" ⇒ tiêu đề bắt đầu bằng đúng cụm đó.
 * Mô tả = câu giới thiệu của quán + dữ kiện có thật (khu, giờ mở, giá), cắt ≤ 155 ký tự theo câu.
 */
export function placeMeta(p: Pick<Place, "name" | "area" | "desc" | "hours" | "price" | "kind">, t: T) {
  const name = t(p.name.trim());
  const withTx = /tà xùa|ta xua/i.test(p.name) ? name : t("{0} Tà Xùa", [name]);
  const kind = p.kind === "CAFE" ? t("quán cà phê") : t("nhà hàng");
  const area = p.area?.trim() ? t(p.area.trim()) : "";
  const title = area ? t("{0}: {1} khu {2}", [withTx, kind, area]) : t("{0}: {1}", [withTx, kind]);

  const intro = (p.desc ? t(p.desc) : "").trim().replace(/\s+/g, " ").replace(/[.\s]+$/, "");
  const facts: string[] = [];
  if (area && !intro.toLowerCase().includes(area.toLowerCase())) facts.push(t("Khu {0}", [area]));
  if (p.hours?.trim()) facts.push(t("mở {0}", [p.hours.trim()]));
  const price = p.price?.trim();
  if (price && /\d/.test(price)) facts.push(/^\d+$/.test(price) ? t("giá từ {0}đ", [Number(price).toLocaleString("vi-VN")]) : t(price).replace(/^\p{Lu}/u, (ch) => ch.toLowerCase()));
  const tail = facts.length ? facts.join(", ") + ". " : "";
  const cta = t("Xem ảnh, bản đồ và đánh giá.");

  const parts = [intro ? intro + "." : t("{0} ở Tà Xùa.", [name]), tail + cta];
  let description = parts.join(" ").replace(/\s+/g, " ").trim();
  if (description.length > 155) {
    // Ưu tiên giữ dữ kiện: cắt bớt câu giới thiệu theo từ.
    const room = 155 - (tail + cta).length - 2;
    const cut = room < 30 ? "" : intro.length > room ? intro.slice(0, room).replace(/\s+\S*$/, "") + "…" : intro + ".";
    description = `${cut} ${tail}${cta}`.replace(/\s+/g, " ").trim();
  }
  return { title, description };
}
