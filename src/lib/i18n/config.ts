/**
 * ĐA NGÔN NGỮ — cấu hình thuần (dùng được ở proxy/edge, server lẫn client).
 * Tiếng Việt là ngôn ngữ gốc, KHÔNG có tiền tố URL; bản dịch có tiền tố /en, /zh, /ko
 * (proxy rewrite về cùng route, gắn header `x-locale`).
 */
export const LOCALES = ["vi", "en", "zh", "ko"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "vi";
/** Các ngôn ngữ cần bản dịch (mọi thứ trừ tiếng Việt). */
export const TARGET_LOCALES = ["en", "zh", "ko"] as const;
export type TargetLocale = (typeof TARGET_LOCALES)[number];

export const LOCALE_HEADER = "x-locale";

/**
 * Trang khách CHỈ có tiếng Việt (dành cho chủ dịch vụ): canonical về bản vi, không khai hreflang,
 * sitemap chỉ liệt kê bản vi — tránh Google thấy 4 bản "en/zh/ko" trùng nội dung tiếng Việt.
 */
export const VI_ONLY_PATHS: readonly string[] = ["/hop-tac", "/hop-tac/xe-may"];

export const LOCALE_META: Record<Locale, { label: string; short: string; htmlLang: string; og: string; flag: string }> = {
  vi: { label: "Tiếng Việt", short: "VI", htmlLang: "vi", og: "vi_VN", flag: "🇻🇳" },
  en: { label: "English", short: "EN", htmlLang: "en", og: "en_US", flag: "🇬🇧" },
  zh: { label: "中文", short: "中文", htmlLang: "zh-CN", og: "zh_CN", flag: "🇨🇳" },
  ko: { label: "한국어", short: "한국어", htmlLang: "ko", og: "ko_KR", flag: "🇰🇷" },
};

export function isLocale(v: unknown): v is Locale {
  return typeof v === "string" && (LOCALES as readonly string[]).includes(v);
}

/** Tách tiền tố ngôn ngữ khỏi pathname: "/en/homestay" → { locale: "en", pathname: "/homestay" }. */
export function splitLocale(pathname: string): { locale: Locale; pathname: string } {
  const m = /^\/(en|zh|ko)(?=\/|$)/.exec(pathname);
  if (!m) return { locale: DEFAULT_LOCALE, pathname };
  return { locale: m[1] as Locale, pathname: pathname.slice(m[0].length) || "/" };
}

/**
 * Gắn tiền tố ngôn ngữ cho đường dẫn NỘI BỘ của trang khách ("/homestay" → "/en/homestay").
 * Giữ nguyên: link ngoài, anchor, tel/mailto, /admin, /api, file tĩnh (/uploads, /_next…).
 */
export function localePath(href: string, locale: Locale): string {
  if (locale === DEFAULT_LOCALE || !href.startsWith("/") || href.startsWith("//")) return href;
  if (/^\/(admin|api|uploads|_next|og)(\/|$|\?)/.test(href)) return href;
  const { pathname } = splitLocale(href.split(/[?#]/)[0]);
  const rest = href.slice(href.split(/[?#]/)[0].length);
  return `/${locale}${pathname === "/" ? "" : pathname}${rest}`;
}

/** Thay `{0}`, `{1}`… trong chuỗi bằng tham số. */
export type TVars = readonly (string | number | null | undefined)[];

export function interpolate(s: string, vars?: TVars): string {
  if (!vars || !vars.length) return s;
  return s.replace(/\{(\d+)\}/g, (m, i) => (vars[+i] !== undefined && vars[+i] !== null ? String(vars[+i]) : vars[+i] === null ? "" : m));
}

export type Dict = Record<string, string>;
/** Hàm dịch: khoá = chuỗi tiếng Việt gốc; thiếu bản dịch ⇒ trả nguyên tiếng Việt. */
export type TFunc = <K extends string | null | undefined>(key: K, vars?: TVars) => K extends string ? string : K;

/**
 * Bỏ mũi tên "→" ở CUỐI nhãn (vd "Xem cam kết uy tín →") cho giao diện gọn — làm ở đây để mọi nhãn + bản dịch
 * (khoá từ điển vẫn giữ "→") cùng được bỏ một chỗ. Mũi tên giữa câu ("Mới → Đã xác nhận") giữ nguyên.
 */
const noTailArrow = (s: string): string => (s.endsWith("→") ? s.replace(/\s*→$/, "") : s);

export const identityT = ((key: string | null | undefined, vars?: TVars) => (key ? noTailArrow(interpolate(key, vars)) : key)) as TFunc;

/**
 * Dựng hàm dịch: tra từ điển giao diện trước, rồi tới bản dịch nội dung admin nhập (DB).
 * Khoá trong từ điển đã được trim — khoảng trắng đầu/cuối của chuỗi gốc được giữ lại quanh bản dịch.
 */
const VI_CHARS = /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i;
const NUM = /\d+(?:[.,]\d+)?/g;

/**
 * Tra 1 chuỗi (đã trim) theo thứ tự:
 *  1. khớp nguyên văn;
 *  2. mẫu số: thay mọi số bằng {0},{1}… ("tầng 2" → khoá "tầng {0}") — 1 bản dịch dùng cho cả loạt;
 *  3. số thứ tự cuối ("Phòng đôi ban công 3" → dịch "Phòng đôi ban công" + " 3");
 *  4. tách theo " · ": dịch từng đoạn; đoạn không có chữ Việt (tên riêng, "Achu 104") giữ nguyên.
 */
function lookup(s: string, dict: Dict, content: Dict | undefined, depth = 0): string | undefined {
  const exact = dict[s] ?? content?.[s];
  if (exact !== undefined) return exact;
  const nums = s.match(NUM);
  if (nums) {
    let i = 0;
    const tpl = s.replace(NUM, () => `{${i++}}`);
    const hit = dict[tpl] ?? content?.[tpl];
    if (hit !== undefined) return interpolate(hit, nums);
    const m = /^(.*\S)\s+(\d+)$/.exec(s);
    const base = m && (dict[m[1]] ?? content?.[m[1]]);
    if (m && base !== undefined) return `${base} ${m[2]}`;
  }
  if (depth === 0 && s.includes(" · ")) {
    const parts = s.split(" · ").map((p) => p.trim());
    const out = parts.map((p) => lookup(p, dict, content, 1) ?? (VI_CHARS.test(p) ? undefined : p));
    if (out.every((x) => x !== undefined) && out.some((x, i) => x !== parts[i])) return out.join(" · ");
  }
  return undefined;
}

/**
 * Chuẩn hoá chuỗi gốc để TRA bản dịch: bỏ `\r` (xuống dòng kiểu Windows khi admin dán từ Word/Excel) + trim.
 * Nơi LƯU bản dịch (admin /admin/translations, scripts/i18n/import-content.mjs) đã đổi `\r\n` → `\n`;
 * trước đây nơi TRA không đổi ⇒ nội dung có `\r` không bao giờ khớp, trang hiện tiếng Việt dù đã dịch.
 */
export function normSource(s: string): string {
  return s.replace(/\r\n?/g, "\n").trim();
}

export function makeT(dict: Dict, content?: Dict): TFunc {
  return ((key: string | null | undefined, vars?: TVars) => {
    if (!key) return key;
    const core = key.trim();
    const norm = core.includes("\r") ? normSource(core) : core;
    let hit = lookup(norm, dict, content);
    // giữ khoảng trắng đầu/cuối của chuỗi gốc quanh bản dịch
    if (hit !== undefined && core !== key) hit = key.slice(0, key.indexOf(core)) + hit + key.slice(key.indexOf(core) + core.length);
    return noTailArrow(interpolate(hit ?? key, vars));
  }) as TFunc;
}
