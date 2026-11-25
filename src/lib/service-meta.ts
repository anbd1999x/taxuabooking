import { roomFromPrice } from "./availability";
import { isCommunalRoom } from "./occupancy";
import { toNumber } from "./format";
import type { TFunc } from "./i18n/config";

/**
 * Tiêu đề + mô tả tìm kiếm cho trang chi tiết dịch vụ (/homestay/<slug>, /thue-xe-may/<slug>, /taxi/<slug>,
 * /xe-om/<slug>, /xe-cabin/<slug>), dựng từ DỮ LIỆU THẬT (số phòng, tiện ích, giá "từ", loại xe, giá thuê)
 * thay vì phần tóm tắt chủ cơ sở tự viết (thường dài, có emoji, dấu câu lặp).
 * Người tìm gõ "<tên> tà xùa" ⇒ tiêu đề luôn bắt đầu bằng tên + "Tà Xùa". Mô tả ≤ 155 ký tự.
 * Thuần (không đọc DB), dùng được trong script kiểm tra.
 */

type Flags = { cloudView: boolean; hasBathtub: boolean; breakfast: boolean; heating: boolean; airCon: boolean };
type RoomLike = Parameters<typeof roomFromPrice>[0] & { name: string };
export interface ServiceMetaInput {
  category: string;
  title: string;
  summary: string;
  area: string | null;
  pool?: boolean;
  basePrice?: unknown;
  roomTypes?: (Flags & { name: string; rooms: RoomLike[] })[];
  rentalVehicles?: { vehicleType: string; pricePerDay: unknown }[];
  transport?: { vehicleType: string | null; fixedPrice: unknown; capacity: number | null } | null;
  transportRoutes?: { priceOneWay: unknown }[];
  cabinPriceRows?: { pickupPoint: string; price: unknown; ticketType: string }[];
}

const money = (n: number) => `${Math.round(n).toLocaleString("vi-VN")}đ`;
/** Bỏ emoji, ký tự trang trí, dấu câu lặp ("!." "…."), khoảng trắng thừa. */
export function cleanSummary(s: string): string {
  return s
    .replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, "")
    .replace(/\s+/g, " ")
    .replace(/([!?.…])\s*[.!]+/g, "$1")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim()
    .replace(/[\s.!…]+$/, "");
}
/** Ghép các câu cho tới khi chạm giới hạn; câu đầu dài quá thì cắt theo từ. */
function fit(parts: string[], max = 155): string {
  let out = "";
  for (const p of parts.filter(Boolean)) {
    const next = out ? `${out} ${p}` : p;
    if (next.length <= max) out = next;
    else if (!out) out = p.slice(0, max - 1).replace(/\s+\S*$/, "") + "…";
  }
  return out;
}
const withTx = (name: string, t: TFunc) => (/tà xùa|ta xua/i.test(name) ? name : t("{0} Tà Xùa", [name]));

export function serviceMeta(s: ServiceMetaInput, t: TFunc, summaryT: string = s.summary): { title: string; description: string } {
  const name = t(s.title.trim().replace(/\s+/g, " "));
  const nameHasTx = /tà xùa|ta xua/i.test(name);
  // Khu: bỏ phần sau dấu phẩy và trong ngoặc ("Bản Cáo A, Tà Xùa (KM18 ĐT112)" → "Bản Cáo A"); tên đã có "Tà Xùa" thì bỏ đuôi "Tà Xùa" của khu.
  let area0 = (s.area ?? "").split(",")[0].replace(/\(.*?\)/g, "").trim();
  if (nameHasTx) area0 = area0.replace(/\s*(xã\s+)?tà xùa$/i, "").trim();
  if (/^tà xùa$/i.test(area0)) area0 = "";
  const areaT = area0 ? t(area0) : "";
  /** "ở khu Đỉnh Gió" / "ở gần trung tâm Tà Xùa" / "ở bản Chung Trinh". */
  const where = !areaT ? "" : /^(gần|cách)\s/i.test(areaT) ? t("ở {0}", [areaT.charAt(0).toLowerCase() + areaT.slice(1)]) : /^(bản|thôn|xã)\s/i.test(areaT) ? t("ở {0}", [areaT.charAt(0).toLowerCase() + areaT.slice(1)]) : t("ở khu {0}", [areaT]);
  const area = areaT;
  const intro = cleanSummary(summaryT);

  if (s.category === "HOMESTAY" || s.category === "BUNGALOW") {
    const types = s.roomTypes ?? [];
    const rooms = types.flatMap((rt) => rt.rooms.map((r) => ({ r, rt })));
    const prices = rooms
      .filter(({ r, rt }) => !isCommunalRoom(rt.name, r.name))
      .map(({ r }) => roomFromPrice(r).price)
      .filter((p) => p > 0);
    const from = prices.length ? Math.min(...prices) : 0;
    const count = (k: keyof Flags) => types.filter((rt) => rt[k]).reduce((a, rt) => a + rt.rooms.length, 0);
    const feats = [
      count("cloudView") && t("view mây"),
      count("hasBathtub") && t("{0} phòng bồn tắm", [count("hasBathtub")]),
      count("breakfast") && t("có ăn sáng"),
      (count("heating") || count("airCon")) && t("có sưởi / điều hoà"),
      s.pool && t("bể bơi"),
    ].filter(Boolean) as string[];
    const kind = /homestay|homstay|bungalow|retreat|home|house|village|garden|stay/i.test(s.title) ? "" : " " + t("Homestay");
    const title = t("{0}{1}: giá phòng & lịch trống", [withTx(name, t), kind]);
    const facts = [
      where ? `${name} ${where}` : t("{0} ở Tà Xùa", [name]),
      rooms.length ? t("{0} phòng", [rooms.length]) : "",
      ...feats.slice(0, 3),
    ].filter(Boolean).join(", ");
    const priceLine = from ? t("Giá từ {0}/đêm.", [money(from)]) : "";
    return { title, description: fit([facts + ".", priceLine, t("Xem phòng trống theo ngày và đặt tại Tà Xùa Booking.")]) };
  }

  if (s.category === "MOTORBIKE") {
    const ps = (s.rentalVehicles ?? []).map((v) => toNumber(v.pricePerDay as never) ?? 0).filter((p) => p > 0);
    const from = ps.length ? Math.min(...ps) : toNumber(s.basePrice as never) ?? 0;
    const models = [...new Set((s.rentalVehicles ?? []).map((v) => v.vehicleType?.trim()).filter(Boolean))].slice(0, 3).join(", ");
    const title = nameHasTx
      ? (from ? t("{0}: thuê xe máy từ {1}/ngày", [name, money(from)]) : t("{0}: thuê xe máy", [name]))
      : (from ? t("{0}: thuê xe máy Tà Xùa từ {1}/ngày", [name, money(from)]) : t("{0}: thuê xe máy Tà Xùa", [name]));
    return { title, description: fit([intro + ".", models ? t("Xe: {0}.", [models]) : "", t("Chọn ngày nhận, trả để xem xe còn trống và đặt xe.")]) };
  }

  if (s.category === "TAXI") {
    const day = toNumber(s.transport?.fixedPrice as never) ?? toNumber(s.basePrice as never) ?? 0;
    const car = s.transport?.vehicleType?.trim();
    const title = day ? t("{0}: taxi Tà Xùa {1}/ngày", [name, money(day)]) : t("{0}: taxi Tà Xùa", [name]);
    const carLine = car && !intro.toLowerCase().includes(car.toLowerCase()) ? t("Xe {0}.", [car]) : "";
    return { title, description: fit([intro + ".", carLine, t("Xem giá thuê theo ngày, theo tuyến và đặt xe tại Tà Xùa Booking.")]) };
  }

  if (s.category === "XEOM") {
    const legs = (s.transportRoutes ?? []).map((r) => toNumber(r.priceOneWay as never) ?? 0).filter((p) => p > 0);
    const from = legs.length ? Math.min(...legs) : 0;
    const title = /xe ôm/i.test(name)
      ? (from ? t("{0}: chặng từ {1}", [withTx(name, t), money(from)]) : t("{0}: giá theo tuyến", [withTx(name, t)]))
      : (from ? t("{0}: xe ôm Tà Xùa, chặng từ {1}", [name, money(from)]) : t("{0}: xe ôm Tà Xùa", [name]));
    return { title, description: fit([intro + ".", t("Xem giá từng chặng và đặt xe tại Tà Xùa Booking.")]) };
  }

  if (s.category === "CABIN") {
    const hn = (s.cabinPriceRows ?? []).find((r) => /hà nội/i.test(r.pickupPoint) && r.ticketType === "ROUND_TRIP");
    const fare = toNumber(hn?.price as never) ?? toNumber(s.basePrice as never) ?? 0;
    const title = t("{0}: xe cabin Hà Nội – Tà Xùa", [name]);
    // Câu tóm tắt chủ xe viết thường quá chung ("vận hành chuyến Tà xùa") ⇒ dựng từ bảng giá: giá Hà Nội + số tỉnh đón.
    const provinces = new Set((s.cabinPriceRows ?? []).map((r) => r.pickupPoint.trim()).filter((p) => !/hà nội/i.test(p))).size;
    return {
      title,
      description: fit([
        t("{0} chạy xe cabin giường nằm Hà Nội – Tà Xùa hằng đêm.", [name]),
        fare ? t("Khứ hồi từ Hà Nội {0}.", [money(fare)]) : "",
        provinces ? t("Đón thêm {0} điểm ngoài Hà Nội.", [provinces]) : "",
        t("Xem giờ chạy, chỗ trống theo ngày và đặt vé."),
      ]),
    };
  }

  return { title: withTx(name, t), description: fit([intro + ".", t("Xem giá, tình trạng theo ngày và đặt tại Tà Xùa Booking.")]) };
}
