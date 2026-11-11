/**
 * Trang /lich-trinh (lịch trình gợi ý Tà Xùa) — kiểu dữ liệu + cấu hình mặc định.
 * Module THUẦN (client lẫn server đều import được). Đọc/ghi DB ở `itinerary-store.ts`.
 *
 * Cấu hình lưu ở `SiteSetting` key "itinerary" (JSON), sửa ở /admin/itinerary.
 * Mọi địa điểm (điểm check-in / cafe / quán ăn) đều là bản ghi `Place` thật
 * (kind CHECKIN / CAFE / RESTAURANT, quản lý ở /admin/places) — lịch trình chỉ trỏ tới bằng id.
 */

export type StopKind = "checkin" | "cafe" | "food" | "move";
export type FeaturedKey = "checkin" | "cafe" | "food";

export interface ItStop {
  time: string; // HH:MM
  /** id bản ghi Place; null = điểm tự nhập (di chuyển, nghỉ ngơi...) */
  placeId: string | null;
  /** tên hiển thị khi không gắn Place (hoặc Place đã bị ẩn/xoá) */
  name: string;
  note: string;
}
export interface ItDay {
  title: string;
  stops: ItStop[];
}
export interface ItPlan {
  id: string;
  name: string; // tên ngắn trên tab, VD "2N1Đ"
  sub: string; // mô tả ngắn
  published: boolean;
  days: ItDay[];
}
export interface ItineraryConfig {
  plans: ItPlan[];
  /** Địa điểm nổi bật ở mục "Nên ghé" (id Place, theo thứ tự hiển thị). Rỗng = hiện tất cả đang hiển thị. */
  featured: Record<FeaturedKey, string[]>;
  /** Lưu ý chuẩn bị (cột bên phải). */
  prep: string[];
}

export const ITINERARY_KEY = "itinerary";

export const PLACE_KIND_TO_STOP: Record<string, FeaturedKey> = { CHECKIN: "checkin", CAFE: "cafe", RESTAURANT: "food" };

export const DEFAULT_PREP = [
  "Áo ấm dày, áo mưa mỏng, giày bám tốt",
  "Tiền mặt, nhiều quán chưa nhận chuyển khoản",
  "Theo dõi dự báo mây trước 1–2 ngày",
  "Không tự lái lên sống lưng khi trời mưa",
];

/** Lịch trình mặc định — trỏ tới Place bằng SLUG (đổi sang id lúc nạp, xem `buildDefaultConfig`). */
type SeedStop = [time: string, slug: string | null, name: string, note: string];
const SEED: { id: string; name: string; sub: string; days: { title: string; stops: SeedStop[] }[] }[] = [
  {
    id: "2n1d",
    name: "2N1Đ",
    sub: "Xe cabin đêm thứ 6, về chiều chủ nhật. Hợp người đi lần đầu, ít thời gian.",
    days: [
      {
        title: "Săn mây & cung Háng Đồng",
        stops: [
          ["04:30", null, "Tới Bắc Yên", "Xe cabin đến nơi, trung chuyển lên Tà Xùa."],
          ["05:30", "dinh-gio", "Đỉnh Gió", "Ngắm bình minh, đợi mây lên."],
          ["06:30", "panorama-coffee", "Cafe view mây Đỉnh Gió", "Đồ uống nóng, chụp ảnh ban công mây."],
          ["07:30", "cay-co-don", "Cây cô đơn", "Chụp ảnh khi mây còn dày."],
          ["08:30", "thao-coffee-ta-xua", "Ăn sáng ở trung tâm", "Ăn sáng, nhận phòng, ngủ bù."],
          ["14:30", "mom-ca-heo", "Mỏm cá heo", "Xe ôm bản địa đưa ra Háng Đồng."],
          ["15:30", "song-lung-khung-long", "Sống lưng khủng long", "Đi bộ sống lưng, ngắm hoàng hôn."],
          ["18:30", "nha-hang-a-phu-tinh-hoa-am-thuc-ta-xua", "Ăn tối lẩu gà đen", "Gà đen, đặc sản Tây Bắc ấm bụng, ngủ sớm."],
        ],
      },
      {
        title: "Đồi chè & về Hà Nội",
        stops: [
          ["05:45", "thao-nguyen-ta-xua", "Thảo nguyên Tà Xùa", "Săn mây sớm lần 2."],
          ["08:00", "doi-che-co-thu-ban-be", "Đồi chè cổ thụ Bản Bẹ", "Dạo đồi chè, mua chè làm quà."],
          ["09:30", "tiem-ca-phe-hoang-hon", "Cafe Khe Cải", "Ngồi cafe ngắm thung lũng lần cuối."],
          ["10:30", "bep-an-xuan-thi-ta-xua", "Ăn trưa ở trung tâm", "Trả phòng, ăn trưa cơm phần."],
          ["12:00", null, "Xe đón chiều về", "Đón tại Tà Xùa, 13:20 qua Bắc Yên, ~19:00 về Hà Nội."],
        ],
      },
    ],
  },
  {
    id: "3n2d",
    name: "3N2Đ",
    sub: "Thêm một ngày thong thả: bản Mông, thảo nguyên, săn mây 3 lần.",
    days: [
      {
        title: "Săn mây trung tâm",
        stops: [
          ["04:30", null, "Tới Bắc Yên", "Xe cabin đến, lên Tà Xùa."],
          ["05:30", "cay-co-don", "Cây cô đơn", "Bình minh ở Cây cô đơn."],
          ["08:00", "thao-coffee-ta-xua", "Ăn sáng ở trung tâm", "Ăn sáng, nhận phòng, nghỉ."],
          ["15:00", "panorama-coffee", "Cafe view mây Đỉnh Gió", "Cafe chiều Đỉnh Gió."],
          ["17:30", "thao-nguyen-ta-xua", "Thảo nguyên Tà Xùa", "Hoàng hôn trên thảo nguyên."],
          ["19:30", "nha-h-mong", "Cafe tối ở trung tâm", "Chỗ ngồi ấm cho buổi tối lạnh."],
        ],
      },
      {
        title: "Cung Háng Đồng & bản Mông",
        stops: [
          ["05:30", "mom-ca-heo", "Mỏm cá heo", "Mây sớm ở Mỏm cá heo."],
          ["07:30", "song-lung-khung-long", "Sống lưng khủng long", "Chinh phục sống lưng khủng long."],
          ["09:30", "ca-phe-ban-song-lung-khung-long", "Cafe cung Háng Đồng", "Nghỉ chân, ăn nhẹ."],
          ["11:30", "nha-hang-a-phu-tinh-hoa-am-thuc-ta-xua", "Ăn trưa lẩu gà đen", "Ăn trưa đặc sản, nghỉ."],
          ["15:00", "ban-mong-vai", "Bản Mống Vài", "Dạo bản Mống Vài."],
          ["18:30", "tiem-nuong-canh-cam", "Đồ nướng buổi tối", "Đồ nướng buổi tối."],
        ],
      },
      {
        title: "Đồi chè & về",
        stops: [
          ["06:00", "dinh-gio", "Đỉnh Gió", "Săn mây lần cuối."],
          ["08:00", "doi-che-co-thu-ban-be", "Đồi chè cổ thụ Bản Bẹ", "Đồi chè cổ thụ Bản Bẹ."],
          ["09:30", "tiem-ca-phe-hoang-hon", "Cafe Khe Cải", "Cafe nhẹ, mua quà."],
          ["10:30", "bep-an-xuan-thi-ta-xua", "Ăn trưa ở trung tâm", "Trả phòng, ăn trưa."],
          ["12:00", null, "Xe đón chiều về", "Đón tại Tà Xùa, ~19:00 về Hà Nội."],
        ],
      },
    ],
  },
];

/** Dựng cấu hình mặc định, đổi slug → id theo danh sách Place hiện có. */
export function buildDefaultConfig(places: { id: string; slug: string | null }[]): ItineraryConfig {
  const idBySlug = new Map(places.filter((p) => p.slug).map((p) => [p.slug as string, p.id]));
  return {
    plans: SEED.map((p) => ({
      id: p.id,
      name: p.name,
      sub: p.sub,
      published: true,
      days: p.days.map((d) => ({
        title: d.title,
        stops: d.stops.map(([time, slug, name, note]) => ({ time, placeId: (slug && idBySlug.get(slug)) || null, name, note })),
      })),
    })),
    featured: { checkin: [], cafe: [], food: [] },
    prep: [...DEFAULT_PREP],
  };
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const idList = (v: unknown) =>
  Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === "string" && x.length > 0 && x.length <= 64))].slice(0, 60) : [];

/** Làm sạch cấu hình (từ DB hoặc từ form admin) về đúng khuôn; trả null nếu không dùng được. */
export function sanitizeConfig(raw: unknown): ItineraryConfig | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (!Array.isArray(r.plans)) return null;
  const plans: ItPlan[] = [];
  for (const [i, p0] of r.plans.slice(0, 8).entries()) {
    if (!p0 || typeof p0 !== "object") continue;
    const p = p0 as Record<string, unknown>;
    const days: ItDay[] = [];
    for (const d0 of Array.isArray(p.days) ? p.days.slice(0, 10) : []) {
      if (!d0 || typeof d0 !== "object") continue;
      const d = d0 as Record<string, unknown>;
      const stops: ItStop[] = [];
      for (const s0 of Array.isArray(d.stops) ? d.stops.slice(0, 20) : []) {
        if (!s0 || typeof s0 !== "object") continue;
        const s = s0 as Record<string, unknown>;
        const time = str(s.time, 5);
        stops.push({
          time: /^\d{1,2}:\d{2}$/.test(time) ? time.padStart(5, "0") : "",
          placeId: str(s.placeId, 64) || null,
          name: str(s.name, 80),
          note: str(s.note, 200),
        });
      }
      days.push({ title: str(d.title, 80), stops });
    }
    plans.push({ id: str(p.id, 40) || `lt${i}`, name: str(p.name, 20), sub: str(p.sub, 200), published: p.published !== false, days });
  }
  const f = (r.featured && typeof r.featured === "object" ? r.featured : {}) as Record<string, unknown>;
  const prep = Array.isArray(r.prep) ? r.prep.map((x) => str(x, 120)).filter(Boolean).slice(0, 8) : [...DEFAULT_PREP];
  return { plans, featured: { checkin: idList(f.checkin), cafe: idList(f.cafe), food: idList(f.food) }, prep };
}
