/**
 * Cấu hình "Popup uy tín" (hiện khi khách mới vào web): bật/tắt + thông tin
 * 2 người đứng sau (tên, SĐT, Facebook, Zalo, avatar). Lưu dạng JSON trong
 * 1 key SiteSetting để sửa trong /admin/popup.
 */

export const TRUST_POPUP_KEY = "trustPopup";

export interface TrustPerson {
  name: string;
  phone: string;
  /** Link Facebook đầy đủ (https://facebook.com/...) */
  facebook: string;
  /** Link Zalo đầy đủ; để trống sẽ tự dựng từ SĐT (https://zalo.me/<sdt>) */
  zalo: string;
  /** URL ảnh đại diện (/uploads/...); để trống sẽ hiện chữ cái đầu */
  avatar: string;
}

export interface TrustPopupConfig {
  enabled: boolean;
  people: TrustPerson[];
  /** Danh sách "Cam kết 5 Không" (hiển thị dạng lưới đánh số). */
  fiveRules: string[];
}

/** Mặc định "Cam kết 5 Không" — khớp bản thiết kế. */
export const DEFAULT_FIVE_RULES = [
  "Không đội giá",
  "Không phụ thu ẩn",
  "Không bỏ khách giữa đường",
  "Không cọc mất trắng",
  "Không thái độ với khách",
];

function emptyPerson(name = "", phone = ""): TrustPerson {
  return { name, phone, facebook: "", zalo: "", avatar: "" };
}

/** Cấu hình mặc định (khi chưa lưu trong DB) — khớp bản thiết kế. */
export const DEFAULT_TRUST_POPUP: TrustPopupConfig = {
  enabled: true,
  people: [
    { name: "Bùi An", phone: "0397 943 155", facebook: "https://facebook.com/", zalo: "", avatar: "" },
    { name: "Tăng Linh", phone: "0900 000 000", facebook: "https://facebook.com/", zalo: "", avatar: "" },
  ],
  fiveRules: DEFAULT_FIVE_RULES,
};

/** Parse giá trị thô từ SiteSetting → cấu hình an toàn, luôn đúng 2 người. */
export function parseTrustPopup(raw?: string | null): TrustPopupConfig {
  if (!raw) return DEFAULT_TRUST_POPUP;
  try {
    const obj = JSON.parse(raw) as Partial<TrustPopupConfig>;
    const people = Array.isArray(obj.people) ? obj.people : [];
    const norm = [0, 1].map((i) => {
      const p = people[i] ?? {};
      const fallback = DEFAULT_TRUST_POPUP.people[i];
      return {
        name: String(p.name ?? "").trim() || fallback.name,
        phone: String(p.phone ?? "").trim() || fallback.phone,
        facebook: String(p.facebook ?? "").trim(),
        zalo: String(p.zalo ?? "").trim(),
        avatar: String(p.avatar ?? "").trim(),
      } satisfies TrustPerson;
    });
    const five = Array.isArray(obj.fiveRules)
      ? obj.fiveRules.map((r) => String(r ?? "").trim()).filter(Boolean)
      : [];
    return {
      enabled: obj.enabled !== false,
      people: norm,
      fiveRules: five.length ? five : DEFAULT_FIVE_RULES,
    };
  } catch {
    return DEFAULT_TRUST_POPUP;
  }
}

/** Link Zalo hiệu lực: ưu tiên link khai báo, thiếu thì dựng từ SĐT. */
export function zaloHref(p: TrustPerson): string {
  if (p.zalo) return p.zalo;
  const digits = p.phone.replace(/\D/g, "");
  return digits ? `https://zalo.me/${digits}` : "";
}

/** Link gọi điện (tel:) từ SĐT. */
export function telHref(p: TrustPerson): string {
  const digits = p.phone.replace(/[^\d+]/g, "");
  return digits ? `tel:${digits}` : "";
}

export { emptyPerson };
