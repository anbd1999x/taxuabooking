import type { Place } from "@prisma/client";
import type { Road } from "./road-distance";
import { fmtKm, inTaXua, isFree, placeImages, priceLabel, realAddress, tidy } from "./attractions";

type T = (s: string, vars?: readonly (string | number | null | undefined)[]) => string;
type P = Pick<Place, "name" | "area" | "address" | "hours" | "price" | "tip" | "coverImage" | "images" | "content">;

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").toLowerCase();

/** "<Tên> Tà Xùa" (tên đã có "Tà Xùa" thì giữ nguyên). */
export function nameWithTx(p: P, t: T): string {
  const name = tidy(t(p.name));
  // Điểm ngoài xã Tà Xùa (VD đồi Mâm Xôi ở Xím Vàng) không gắn đuôi "Tà Xùa"; tiêu đề nói "cách trung tâm Tà Xùa …".
  return !inTaXua(p) || /tà xùa|ta xua|塔萨|따쑤아/i.test(name) || /tà xùa/i.test(p.name) ? name : t("{0} Tà Xùa", [name]);
}

/** Khu có đáng ghi không: không trùng tên, không ghi "Trung tâm" cho điểm cách trung tâm > 5 km (dữ liệu khu cũ ghi chung). */
export function areaWorth(p: P, road: Road | null): boolean {
  const a = (p.area ?? "").trim();
  if (!a) return false;
  if (fold(p.name).includes(fold(a))) return false;
  if (/^trung tâm$/i.test(a)) return false; // trùng ý với "cách trung tâm …"
  return true;
}

/** "ở đâu" ngắn gọn: địa chỉ thật nếu có, không thì "khu <khu>"; rỗng nếu không có gì đáng ghi. */
export function whereText(p: P, road: Road | null, t: T): string {
  const addr = realAddress(p.address);
  if (addr) return t(addr);
  return areaWorth(p, road) ? t("khu {0}", [t(p.area)]) : "";
}

function pieces(p: P, road: Road | null, t: T, locale: string) {
  const price = priceLabel(p.price);
  return {
    dist: road ? (inTaXua(p) ? t("cách trung tâm {0} km", [fmtKm(road.km, locale)]) : t("cách trung tâm Tà Xùa {0} km", [fmtKm(road.km, locale)])) : null,
    route: t("đường đi"),
    // Trang có mục tương ứng (trường giờ / chi phí, hoặc mục "## Thời điểm đẹp" / "## Chi phí…" trong nội dung) mới nhắc.
    hours: p.hours?.trim() || /^##\s*thời điểm đẹp/im.test(p.content ?? "") ? t("giờ đẹp") : null,
    price: price
      ? isFree(p.price) ? t("miễn phí vé") : /vé/i.test(price) ? t("giá vé") : t("chi phí")
      : /^##\s*(chi phí|thời gian & chi phí)/im.test(p.content ?? "") ? t("chi phí") : null,
    // Điểm không phải chỗ ngắm (tiệm trà, xưởng nhuộm): nêu mục đặc thù có trong nội dung.
    extra: /^##\s*mẹo mua trà/im.test(p.content ?? "") ? t("mẹo mua trà") : /^##\s*trải nghiệm/im.test(p.content ?? "") ? t("trải nghiệm") : null,
  };
}
// Dấu ngăn liệt kê: tiếng Trung dùng "、".
const joiner = (locale: string) => (xs: (string | null)[]) => xs.filter(Boolean).join(locale === "zh" ? "、" : ", ");

/**
 * Tiêu đề (≤ 60), H1, mô tả (≤ 155) cho trang /diem-den/<slug> — dựng từ dữ liệu thật:
 * quãng đường xe chạy (cache), giờ đẹp, chi phí admin nhập. Thiếu mục nào thì câu chứa mục đó tự bỏ.
 */
export function attractionMeta(p: P, road: Road | null, t: T, locale: string) {
  const base = nameWithTx(p, t);
  const x = pieces(p, road, t, locale);
  const join = joiner(locale);
  // Mỗi tiêu đề nói ít nhất 2 điều người tìm muốn biết (khoảng cách / đường đi / giờ đẹp / vé…), không chỉ một con số.
  const sets = [[x.dist, x.hours, x.price], [x.route, x.hours, x.price], [x.route, x.extra, x.price], [x.dist, x.hours], [x.route, x.hours], [x.route, x.extra], [x.dist, x.price], [x.route, x.price]]
    .map((s) => s.filter((v): v is string => !!v))
    .filter((s) => s.length >= 2);
  sets.push(x.dist ? [x.dist, x.route] : [x.route], [x.route]);
  const area = /[(（]/.test(base) || !areaWorth(p, road) ? "" : locale === "zh" ? `（${t(p.area)}）` : ` (${t(p.area)})`;
  // Tên không gợi vị trí (VD "Panorama Coffee" ở Đỉnh Gió) ⇒ ưu tiên tiêu đề có khu, chấp nhận bớt dữ kiện.
  const bases = area ? [base + area, base] : [base];
  const title = bases.flatMap((b) => sets.map((s) => t("{0}: {1}", [b, join(s)]))).find((s) => s.length <= 60) ?? base;
  const tail = join([x.dist, x.route, x.hours, x.extra, x.price]);
  const h1 = t("{0}: {1}", [base + area, tail]);

  const name = tidy(t(p.name));
  const where = whereText(p, road, t);
  // Tên đã có "Tà Xùa" ⇒ nói "trung tâm xã" cho khỏi lặp.
  const center = /tà xùa/i.test(p.name) ? t("trung tâm xã") : t("trung tâm Tà Xùa");
  const s1 = road
    ? where
      ? t("{0} ở {1}, cách {2} {3} km đường xe máy, khoảng {4} phút.", [name, where, center, fmtKm(road.km, locale), road.min])
      : t("{0} cách {1} {2} km đường xe máy, khoảng {3} phút.", [name, center, fmtKm(road.km, locale), road.min])
    : where
      ? t("{0} ở {1}, xã Tà Xùa, Sơn La.", [name, where])
      : t("{0} ở xã Tà Xùa, Sơn La.", [name]);
  const parts = [
    s1,
    p.hours?.trim() ? t("Giờ đẹp {0}.", [p.hours.trim()]) : "",
    priceLabel(p.price) ? t("Chi phí: {0}.", [t(priceLabel(p.price))]) : "",
    p.tip?.trim() ? tidy(t(p.tip.trim())).replace(/\s*!+$/, ".").replace(/([^.?。！？])$/, "$1.") : "",
    placeImages(p).length ? t("Có ảnh thật, bản đồ, homestay gần nhất.") : "",
  ].filter(Boolean);
  let description = "";
  for (const s of parts) {
    const next = description ? `${description} ${s}` : s;
    if (next.length <= 155) description = next;
  }
  if (!description) description = s1.slice(0, 154).replace(/\s+\S*$/, "") + "…";
  return { title, h1, description };
}
