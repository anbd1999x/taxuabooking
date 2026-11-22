/**
 * Trang /lich-trinh (lịch trình & chi phí Tà Xùa) — kiểu dữ liệu + cấu hình mặc định + tính chi phí.
 * Module THUẦN (client lẫn server đều import được). Đọc/ghi DB ở `itinerary-store.ts`.
 *
 * Cấu hình lưu ở `SiteSetting` key "itinerary" (JSON), sửa ở /admin/itinerary.
 * Mọi địa điểm (điểm check-in / cafe / quán ăn) đều là bản ghi `Place` thật
 * (kind CHECKIN / CAFE / RESTAURANT, quản lý ở /admin/places) — lịch trình chỉ trỏ tới bằng id.
 *
 * Chi phí (theo claude.ai/design `Lich trinh Chi phi Ta Xua.dc.html`): mỗi điểm dừng có giá + đơn vị
 * (mỗi người / mỗi xe máy / cả đoàn) + nhóm (ăn uống / vé & check-in / xe máy & xăng), hoặc "trong combo"
 * (xe + phòng + ăn sáng) / "miễn phí"; điểm gộp nhiều nơi (cung đường) dùng `subs`.
 * Phần combo = giá xe khứ hồi × số người + giá phòng (trong tuần / cuối tuần) × số phòng × số đêm.
 */

export type StopKind = "checkin" | "cafe" | "food" | "move";
export type FeaturedKey = "checkin" | "cafe" | "food";
export type Transport = "cabin" | "limo";
/** pp = mỗi người, bike = mỗi xe máy (2 người/xe), group = cả đoàn */
export type CostUnit = "pp" | "bike" | "group";
/** an = ăn uống, ve = vé & check-in, xm = xe máy & xăng; "" = tự suy theo loại địa điểm */
export type CostCat = "" | "an" | "ve" | "xm";
/** "" = khách tự trả (theo `cost`), combo = đã có trong combo, free = không mất tiền */
export type Incl = "" | "combo" | "free";

export interface ItSub {
  name: string;
  cost: number;
  unit: CostUnit;
  note: string; // VD "vé vào 25k"
}
export interface ItStop {
  time: string; // HH:MM
  /** giờ kết thúc (khung giờ "07h – 10h"); "" = không có */
  end: string;
  /** id bản ghi Place; null = điểm tự nhập (di chuyển, nghỉ ngơi...) */
  placeId: string | null;
  /** tên hiển thị khi không gắn Place (hoặc Place đã bị ẩn/xoá) */
  name: string;
  /** tên hoạt động, VD "Ăn nướng" (địa điểm hiện dòng nhỏ bên dưới); "" = dùng tên địa điểm */
  title: string;
  note: string;
  cost: number; // đ / đơn vị
  unit: CostUnit;
  cat: CostCat;
  incl: Incl;
  subs: ItSub[];
}
export interface ItDay {
  /** nhãn ngày, VD "Đêm 0"; "" = "Ngày N" */
  label: string;
  title: string;
  stops: ItStop[];
}
export interface ItPlan {
  id: string;
  name: string; // tên ngắn trên tab, VD "2N1Đ" — các lịch trình cùng tên = cùng thời lượng, khác cách đi
  sub: string; // mô tả ngắn
  published: boolean;
  transport: Transport;
  nights: number; // số đêm ngủ homestay (tính tiền phòng)
  days: ItDay[];
}
export interface ItTransport {
  name: string; // "cabin đêm" — thẻ hiện "Combo cabin đêm + phòng"
  when: string; // "Đi 21h30 tối hôm trước · sáng sớm tới Tà Xùa"
  tags: string[];
}
export interface ItCost {
  /** hạng cabin (giá khứ hồi / người); hạng đầu là mặc định */
  cabinTiers: { name: string; price: number }[];
  limoPrice: number; // khứ hồi / người
  roomWd: number; // giá phòng / đêm trong tuần
  roomWe: number; // giá phòng / đêm cuối tuần
  perRoom: number; // số người / phòng
  perBike: number; // số người / xe máy
  transports: Record<Transport, ItTransport>;
  note: string; // ghi chú cuối lịch trình
}
export interface ItineraryConfig {
  plans: ItPlan[];
  /** Địa điểm nổi bật ở mục "Nên ghé" (id Place, theo thứ tự hiển thị). Rỗng = hiện tất cả đang hiển thị. */
  featured: Record<FeaturedKey, string[]>;
  /** Lưu ý chuẩn bị. */
  prep: string[];
  cost: ItCost;
}

export const ITINERARY_KEY = "itinerary";

export const PLACE_KIND_TO_STOP: Record<string, FeaturedKey> = { CHECKIN: "checkin", CAFE: "cafe", RESTAURANT: "food" };

export const UNIT_LABEL: Record<CostUnit, string> = { pp: "mỗi người", bike: "mỗi xe máy", group: "cả đoàn" };
export const CAT_LABEL: Record<Exclude<CostCat, "">, string> = { an: "Ăn uống", ve: "Vé & check-in", xm: "Xe máy & xăng" };

export const DEFAULT_PREP = [
  "Áo ấm dày, áo mưa mỏng, giày bám tốt",
  "Tiền mặt, nhiều quán chưa nhận chuyển khoản",
  "Theo dõi dự báo mây trước 1–2 ngày",
  "Không tự lái lên sống lưng khi trời mưa",
];

export const DEFAULT_COST: ItCost = {
  cabinTiers: [
    { name: "Tiêu chuẩn", price: 500000 },
    { name: "Cabin đôi cao cấp", price: 650000 },
  ],
  limoPrice: 700000,
  roomWd: 400000,
  roomWe: 600000,
  perRoom: 2,
  perBike: 2,
  transports: {
    cabin: { name: "cabin đêm", when: "Đi 21h30 tối hôm trước · sáng sớm tới Tà Xùa", tags: ["Săn mây ngay sáng đầu", "Tiết kiệm 1 ngày phép", "Cabin đôi riêng tư"] },
    limo: { name: "limousine sáng", when: "Đi 6h30 sáng · khoảng 12h30 tới Tà Xùa", tags: ["Ngủ đủ giấc ở nhà", "Tới kịp hoàng hôn", "Hợp gia đình, người lớn tuổi"] },
  },
  note: "Giá phòng tính từ 400k/đêm (trong tuần), 600k/đêm (cuối tuần), phòng 2 người. Ăn uống, vé là giá tham khảo tại thời điểm cập nhật. Giá chính thức là giá chốt bill qua Zalo.",
};

// ── Lịch trình mặc định (theo bản thiết kế) — trỏ tới Place bằng SLUG, đổi sang id lúc nạp ────────────
type SeedStop = Omit<ItStop, "placeId"> & { slug?: string };
const S = (time: string, end: string, title: string, name: string, note: string, o: Partial<SeedStop> = {}): SeedStop => ({
  time, end, title, name, note, cost: 0, unit: "pp", cat: "", incl: "", subs: [], ...o,
});
const inCombo = (time: string, title: string, name: string, note: string, incl: Incl = "combo") => S(time, "", title, name, note, { incl });
const sub = (name: string, cost: number, unit: CostUnit, note: string): ItSub => ({ name, cost, unit, note });

function seedPlans(): (Omit<ItPlan, "days"> & { days: { label: string; title: string; stops: SeedStop[] }[] })[] {
  const plans = [];
  for (const three of [false, true]) {
    for (const tr of ["cabin", "limo"] as Transport[]) {
      const cab = tr === "cabin";
      const bikeDays = cab ? (three ? 2.5 : 1.5) : three ? 2 : 1;
      const gas = cab ? (three ? 100000 : 60000) : three ? 80000 : 50000;
      const bike = (t: string) => [
        S(t, "", "Nhận xe máy (xe số Wave)", "VP xe trung tâm xã", `200k/xe/ngày, đặt kèm combo còn 180k. Thuê ${String(bikeDays).replace(".", ",")} ngày, 2 người 1 xe.`, { cost: 180000 * bikeDays, unit: "bike", cat: "xm" }),
        S(t, "", "Đổ xăng", "Cây xăng trung tâm", "", { cost: gas, unit: "bike", cat: "xm" }),
      ];
      const cung = (t: string, e: string) => S(t, e, "Cung Thảo Nguyên, đi từ xa về gần", "Cung đường săn mây", "", {
        cat: "ve",
        subs: [sub("Lán cô đơn", 0, "pp", ""), sub("Cây cô đơn", 25000, "pp", "vé vào 25k"), sub("Mỏm cá heo", 5000, "bike", "gửi xe 5k"), sub("Thảo Nguyên", 79000, "pp", "đã kèm nước")],
      });
      const sunsetFarm = (t: string, e: string) => S(t, e, "Hoàng hôn đồi cỏ hồng", "Tà Xùa Farm", "Chưa bán vé vào, gọi nước ủng hộ quán.", { cost: 55000, cat: "ve" });
      const bbq = (t: string) => S(t, "", "Ăn nướng", "Bếp nhà Táo", "Cách home khoảng 100m.", { cost: 250000, cat: "an" });
      const milky = (t: string) => S(t, "", "Cafe đốt lửa, săn Milky Way", "Trạm Mây cafe", "Gọi 1 nước/người.", { cost: 55000, cat: "an", slug: "tram-may-ta-xua-2" });
      const lau = (t: string) => S(t, "", "Ăn lẩu tại home", "Homestay", "Set lẩu 400k + nước cho 2 người.", { cost: 220000, cat: "an" });
      const cloud = (t: string) => inCombo(t, "Săn mây, ăn sáng tại home", "Homestay", "Bữa sáng đã có trong combo.");
      const hmn = (t: string, e: string) => S(t, e, "", "Hồ Mắt Ngọc", "Vé vào 30k. Đường có đoạn sỏi và dốc, không quen xe số thì đi cẩn thận.", { cost: 30000, cat: "ve", slug: "ho-mat-ngoc" });
      const amei = (t: string, e: string) => S(t, e, "Đồi cỏ hồng đối diện Amei Hill", "Khe Cải", "Vé vào 25k.", { cost: 25000, cat: "ve", slug: "amei-hill" });
      const khen = (t: string) => S(t, "", "Khèn Tà Xùa, ăn kem check-in", "Khèn Tà Xùa", "Đi bộ từ home ra khoảng 200m.", { cost: 30000, cat: "ve" });
      const thao = (t: string) => S(t, "", "Trà sữa Shan tuyết", "Thảo cafe", "Quán cafe đầu tiên ở Tà Xùa.", { cost: 60000, cat: "an", slug: "thao-coffee-ta-xua" });
      const bepcui = (t: string) => S(t, "", "Ăn trưa cơm món", "Bếp Củi · trung tâm", "80k/người.", { cost: 80000, cat: "an" });
      const bua = (t: string, e: string) => S(t, e, "", "Thôn Bụa A", "Chưa bán vé vào, gọi nước ủng hộ (giảm 10% bill khi đi combo).", { cost: 50000, cat: "ve" });
      const thaoCD = (t: string, e: string) => S(t, e, "Ăn trưa Thảo cô đơn", "Thảo cô đơn", "View tựa sông Nho Quế. 150k/người cơm món + đồ uống, nên đặt trước.", { cost: 150000, cat: "an" });
      const muaMay = (t: string, title: string, cost: number, note: string) => S(t, "", title, "Quán cô Mùa Máy", note, { cost, cat: "an" });
      const back = (t: string, at: string) => [
        inCombo(t, cab ? "Lên xe cabin về Hà Nội" : "Trả xe máy, lên limousine về", "VP xe trung tâm xã", ""),
        inCombo(at, "Về tới Hà Nội, kết thúc hành trình", "", "", "free"),
      ];
      const checkout = (t: string) => inCombo(t, "Trả phòng, trả xe máy", "VP xe", "VP xe cách home khoảng 1km.", "free");

      let days: { label: string; title: string; stops: SeedStop[] }[];
      if (cab) {
        days = [
          { label: "Đêm 0", title: "Lên xe cabin, ngủ một giấc", stops: [inCombo("21:30", "Xe cabin đôi đón tại Hà Nội", "Big C Thăng Long", "Ngủ trên xe, sáng sớm tới Tà Xùa.")] },
          { label: "Ngày 1", title: "Thôn Bụa A & cung Thảo Nguyên", stops: [inCombo("05:30", "Tới VP xe ở trung tâm xã", "VP xe", "Vệ sinh cá nhân, thay đồ. Nhà xe chuyển hành lý về home trước.", "free"), ...bike("06:00"), muaMay("06:30", "Ăn sáng bún cô Mùa Máy", 35000, "Ngay cổng chào Tà Xùa."), bua("07:00", "10:00"), thaoCD("11:00", "12:00"), inCombo("13:00", "Nhận phòng, nghỉ trưa", "Homestay", "Phòng 2 người view mây."), cung("15:00", "18:00"), lau("20:00")] },
        ];
        if (three) days.push({ label: "Ngày 2", title: "Hồ Mắt Ngọc, Khèn & Milky Way", stops: [cloud("06:00"), hmn("08:30", "10:30"), muaMay("11:30", "Ăn trưa cơm cô Mùa Máy", 60000, "Quán bình dân, món địa phương."), khen("14:00"), sunsetFarm("16:30", "18:00"), bbq("19:30"), milky("21:00")] });
        days.push({
          label: three ? "Ngày 3" : "Ngày 2",
          title: "Đồi cỏ hồng & về Hà Nội",
          stops: three
            ? [cloud("06:00"), amei("08:30", ""), thao("10:00"), bepcui("11:00"), checkout("11:45"), ...back("12:30", "19:30")]
            : [cloud("06:00"), amei("08:30", "10:30"), bepcui("11:00"), checkout("11:45"), ...back("12:30", "19:30")],
        });
      } else {
        days = [
          {
            label: "Ngày 1",
            title: "Tới trưa, Cây cô đơn & hoàng hôn",
            stops: [
              inCombo("06:30", "Limousine đón tại Hà Nội", "Royal City", "Đi khoảng 5–6 tiếng, dừng nghỉ 1 lần."),
              ...bike("12:30"),
              bepcui("13:00"),
              inCombo("13:45", "Nhận phòng", "Homestay", "Phòng săn mây 2 người, kính view hoàng hôn."),
              S("14:30", "16:30", "Cung Mỏm Cá Heo → Cây cô đơn", "Cung đường săn mây", "", { cat: "ve", subs: [sub("Cây cô đơn", 25000, "pp", "vé vào 25k"), sub("Lán cô đơn", 0, "pp", ""), sub("Mỏm cá heo", 5000, "bike", "gửi xe 5k")] }),
              sunsetFarm("17:00", "18:00"),
              bbq("19:30"),
              milky("21:00"),
            ],
          },
        ];
        if (three) days.push({ label: "Ngày 2", title: "Thôn Bụa A & Thảo Nguyên", stops: [cloud("06:00"), bua("07:00", "10:00"), thaoCD("11:00", "12:00"), inCombo("13:30", "Về home nghỉ trưa", "Homestay", "", "free"), S("15:00", "18:00", "Thảo Nguyên, ngắm hoàng hôn", "Thảo Nguyên", "Vé 79k đã kèm nước.", { cost: 79000, cat: "ve", slug: "thao-nguyen-ta-xua" }), lau("20:00")] });
        days.push({
          label: three ? "Ngày 3" : "Ngày 2",
          title: three ? "Hồ Mắt Ngọc, Khèn & về" : "Hồ Mắt Ngọc & về Hà Nội",
          stops: three
            ? [cloud("06:00"), hmn("08:00", "10:00"), khen("10:30"), muaMay("11:15", "Trả phòng, ăn trưa bún phở cô Mùa Máy", 40000, "Quán bình dân, ngon."), thao("12:00"), ...back("12:30", "18:30")]
            : [cloud("06:30"), hmn("08:30", "10:30"), muaMay("11:00", "Trả phòng, ăn trưa bún phở cô Mùa Máy", 40000, "Quán bình dân, ngon."), thao("11:45"), ...back("12:30", "18:30")],
        });
      }
      const name = three ? "3N2Đ" : "2N1Đ";
      plans.push({
        id: `${three ? "3n2d" : "2n1d"}-${tr}`,
        name,
        sub: cab
          ? three ? "Xe cabin đêm, 2 đêm homestay: thêm một ngày thong thả với Hồ Mắt Ngọc, Khèn và Milky Way." : "Xe cabin đêm, săn mây ngay sáng đầu tiên, về tối hôm sau."
          : three ? "Limousine sáng, 2 đêm homestay: đủ cả Thôn Bụa A, Thảo Nguyên và Hồ Mắt Ngọc." : "Limousine sáng, tới trưa, kịp hoàng hôn và Milky Way.",
        published: true,
        transport: tr,
        nights: three ? 2 : 1,
        days,
      });
    }
  }
  return plans;
}

/** Dựng cấu hình mặc định, đổi slug → id theo danh sách Place hiện có. */
export function buildDefaultConfig(places: { id: string; slug: string | null }[]): ItineraryConfig {
  const idBySlug = new Map(places.filter((p) => p.slug).map((p) => [p.slug as string, p.id]));
  return {
    plans: seedPlans().map((p) => ({
      ...p,
      days: p.days.map((d) => ({
        ...d,
        stops: d.stops.map(({ slug, ...s }) => ({ ...s, placeId: (slug && idBySlug.get(slug)) || null })),
      })),
    })),
    featured: { checkin: [], cafe: [], food: [] },
    prep: [...DEFAULT_PREP],
    cost: JSON.parse(JSON.stringify(DEFAULT_COST)) as ItCost,
  };
}

// ── Làm sạch dữ liệu ──────────────────────────────────────────────────────────
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const money = (v: unknown, max = 50_000_000) => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v.replace(/[^\d]/g, "")) : 0;
  return Number.isFinite(n) && n > 0 ? Math.min(max, Math.round(n)) : 0;
};
const hhmm = (v: unknown) => {
  const t = str(v, 5);
  return /^\d{1,2}:\d{2}$/.test(t) ? t.padStart(5, "0") : "";
};
const oneOf = <T extends string>(v: unknown, list: readonly T[], dflt: T): T => (list.includes(v as T) ? (v as T) : dflt);
const idList = (v: unknown) =>
  Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === "string" && x.length > 0 && x.length <= 64))].slice(0, 60) : [];
const UNITS = ["pp", "bike", "group"] as const;

function sanitizeCost(raw: unknown): ItCost {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const d = DEFAULT_COST;
  const tiers = Array.isArray(r.cabinTiers)
    ? r.cabinTiers.slice(0, 4).flatMap((t) => {
        const o = (t && typeof t === "object" ? t : {}) as Record<string, unknown>;
        const price = money(o.price);
        return price ? [{ name: str(o.name, 40) || "Cabin", price }] : [];
      })
    : [];
  const tp = (r.transports && typeof r.transports === "object" ? r.transports : {}) as Record<string, unknown>;
  const transport = (k: Transport): ItTransport => {
    const o = (tp[k] && typeof tp[k] === "object" ? tp[k] : {}) as Record<string, unknown>;
    const tags = Array.isArray(o.tags) ? o.tags.map((x) => str(x, 40)).filter(Boolean).slice(0, 5) : d.transports[k].tags;
    return { name: str(o.name, 40) || d.transports[k].name, when: typeof o.when === "string" ? str(o.when, 100) : d.transports[k].when, tags };
  };
  const pos = (v: unknown, dflt: number) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) && n >= 1 && n <= 10 ? n : dflt;
  };
  return {
    cabinTiers: tiers.length ? tiers : d.cabinTiers.map((t) => ({ ...t })),
    limoPrice: "limoPrice" in r ? money(r.limoPrice) : d.limoPrice,
    roomWd: "roomWd" in r ? money(r.roomWd) : d.roomWd,
    roomWe: "roomWe" in r ? money(r.roomWe) : d.roomWe,
    perRoom: pos(r.perRoom, d.perRoom),
    perBike: pos(r.perBike, d.perBike),
    transports: { cabin: transport("cabin"), limo: transport("limo") },
    note: typeof r.note === "string" ? str(r.note, 400) : d.note,
  };
}

/** Làm sạch cấu hình (từ DB hoặc từ form admin) về đúng khuôn; trả null nếu không dùng được.
 *  Cấu hình cũ (chưa có chi phí) vẫn đọc được: giá = 0, cách đi = cabin, số đêm = số ngày − 1. */
export function sanitizeConfig(raw: unknown): ItineraryConfig | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (!Array.isArray(r.plans)) return null;
  const plans: ItPlan[] = [];
  for (const [i, p0] of r.plans.slice(0, 12).entries()) {
    if (!p0 || typeof p0 !== "object") continue;
    const p = p0 as Record<string, unknown>;
    const days: ItDay[] = [];
    for (const d0 of Array.isArray(p.days) ? p.days.slice(0, 10) : []) {
      if (!d0 || typeof d0 !== "object") continue;
      const d = d0 as Record<string, unknown>;
      const stops: ItStop[] = [];
      for (const s0 of Array.isArray(d.stops) ? d.stops.slice(0, 24) : []) {
        if (!s0 || typeof s0 !== "object") continue;
        const s = s0 as Record<string, unknown>;
        const subs: ItSub[] = Array.isArray(s.subs)
          ? s.subs.slice(0, 10).flatMap((x) => {
              const o = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
              const name = str(o.name, 60);
              return name ? [{ name, cost: money(o.cost), unit: oneOf(o.unit, UNITS, "pp"), note: str(o.note, 60) }] : [];
            })
          : [];
        stops.push({
          time: hhmm(s.time),
          end: hhmm(s.end),
          placeId: str(s.placeId, 64) || null,
          name: str(s.name, 80),
          title: str(s.title, 80),
          note: str(s.note, 240),
          cost: money(s.cost),
          unit: oneOf(s.unit, UNITS, "pp"),
          cat: oneOf(s.cat, ["", "an", "ve", "xm"] as const, ""),
          incl: oneOf(s.incl, ["", "combo", "free"] as const, ""),
          subs,
        });
      }
      days.push({ label: str(d.label, 20), title: str(d.title, 80), stops });
    }
    const nights = Math.round(Number(p.nights));
    plans.push({
      id: str(p.id, 40) || `lt${i}`,
      name: str(p.name, 20),
      sub: str(p.sub, 200),
      published: p.published !== false,
      transport: oneOf(p.transport, ["cabin", "limo"] as const, "cabin"),
      nights: Number.isFinite(nights) && nights >= 0 && nights <= 10 ? nights : Math.max(0, days.length - 1),
      days,
    });
  }
  const f = (r.featured && typeof r.featured === "object" ? r.featured : {}) as Record<string, unknown>;
  const prep = Array.isArray(r.prep) ? r.prep.map((x) => str(x, 120)).filter(Boolean).slice(0, 8) : [...DEFAULT_PREP];
  return { plans, featured: { checkin: idList(f.checkin), cafe: idList(f.cafe), food: idList(f.food) }, prep, cost: sanitizeCost(r.cost) };
}

// ── Tính chi phí (dùng chung trang khách + xem trước ở admin) ─────────────────
export interface CostOpts {
  pax: number;
  weekend: boolean;
  cabinPrice: number; // giá hạng cabin đang chọn
  skip: Record<string, boolean>; // khoá `${di}-${si}` hoặc `${di}-${si}-${xi}` = khách đã bỏ mục
  /** Theo lựa chọn khách đang đặt (link từ trang homestay / combo): tiền CỐ ĐỊNH, không tính theo bảng giá chung. */
  override?: CostOverride | null;
}
export interface CostOverride {
  roomTotal: number; // tổng tiền phòng cả kỳ của các phòng đang chọn (gồm phụ thu ở ghép)
  rooms: number; // số phòng đang chọn
  /** tổng tiền vé xe cả đoàn; null = chỉ đặt phòng (tự túc xe); undefined = theo bảng giá chung (cách đi khác vé đang chọn) */
  busTotal?: number | null;
  discount: number; // giảm combo cả đoàn
}
export interface CostInput {
  transport: Transport;
  nights: number;
  days: { stops: { cost: number; unit: CostUnit; cat: Exclude<CostCat, "">; incl: Incl; subs: ItSub[] }[] }[];
}
export function costMult(unit: CostUnit, pax: number, perBike: number): number {
  return unit === "bike" ? Math.ceil(pax / Math.max(1, perBike)) : unit === "pp" ? pax : 1;
}
/** Tổng chi phí của một lịch trình theo nhóm (combo / xe máy / ăn uống / vé). */
export function planCost(plan: CostInput, cost: ItCost, o: CostOpts) {
  const pax = Math.max(1, o.pax);
  const ov = o.override ?? null;
  const rooms = ov ? Math.max(1, ov.rooms) : Math.ceil(pax / Math.max(1, cost.perRoom));
  const bikes = Math.ceil(pax / Math.max(1, cost.perBike));
  const noBus = !!ov && ov.busTotal === null;
  const fixedBus = !!ov && ov.busTotal !== undefined;
  const std = plan.transport === "cabin" ? o.cabinPrice : cost.limoPrice;
  const xe = fixedBus ? (ov!.busTotal ?? 0) : std * pax;
  const trPrice = fixedBus ? Math.round(xe / pax) : std; // vé / người
  const phong = ov ? ov.roomTotal : (o.weekend ? cost.roomWe : cost.roomWd) * plan.nights * rooms;
  const room = ov ? Math.round(phong / Math.max(1, rooms * Math.max(1, plan.nights))) : o.weekend ? cost.roomWe : cost.roomWd; // phòng / đêm
  const discount = ov ? Math.min(ov.discount, xe + phong) : 0;
  const cat = { combo: xe + phong - discount, xm: 0, an: 0, ve: 0 };
  let skipped = 0;
  let nSkip = 0;
  plan.days.forEach((d, di) =>
    d.stops.forEach((s, si) => {
      if (s.incl) return;
      const items = s.subs.length ? s.subs.map((x, xi) => ({ k: `${di}-${si}-${xi}`, v: x.cost * costMult(x.unit, pax, cost.perBike) })) : [{ k: `${di}-${si}`, v: s.cost * costMult(s.unit, pax, cost.perBike) }];
      for (const it of items) {
        if (o.skip[it.k]) {
          skipped += it.v;
          if (it.v) nSkip++;
        } else cat[s.cat] += it.v;
      }
    }),
  );
  return { cat, total: cat.combo + cat.xm + cat.an + cat.ve, skipped, nSkip, xe, phong, trPrice, room, rooms, bikes, noBus, fixedBus, discount, fixed: !!ov };
}

/** Giờ hiển thị kiểu "06h30" / "07h". */
export function hLabel(t: string): string {
  if (!/^\d{2}:\d{2}$/.test(t)) return t;
  return t.slice(3) === "00" ? `${t.slice(0, 2)}h` : `${t.slice(0, 2)}h${t.slice(3)}`;
}
