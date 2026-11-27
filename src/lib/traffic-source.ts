/**
 * Phân loại NGUỒN VÀO của một phiên truy cập (thuần, không DB) — dùng ở /admin/visits.
 *
 * Thứ tự ưu tiên: tham số trên link vào (utm_source, gclid, fbclid, ttclid, zarsrc) → tên miền referrer
 * → trình duyệt trong app (UA: Facebook / Instagram / Threads "Barcelona" / TikTok / Zalo — các app này
 * thường xoá referrer) → "Seeding" (key `direct`: không có nguồn).
 *
 * Lưu ý: điều hướng trong site là SPA nên document.referrer giữ nguyên nguồn ngoài cho cả phiên; referrer là
 * chính site (tải lại trang, quay lại từ đăng nhập Google) thì coi như không có.
 */

export type SourceKey =
  | "google"
  | "search"
  | "facebook"
  | "threads"
  | "tiktok"
  | "instagram"
  | "zalo"
  | "youtube"
  | "ai"
  | "ads"
  | "referral"
  | "spam"
  | "direct";

export const SOURCES: Record<SourceKey, { label: string; icon: string; color: string }> = {
  google: { label: "Google tìm kiếm", icon: "🔎", color: "#4285F4" },
  search: { label: "Tìm kiếm khác (Bing, Cốc Cốc, Yahoo…)", icon: "🧭", color: "#0ea5e9" },
  ads: { label: "Quảng cáo Google", icon: "📣", color: "#f59e0b" },
  facebook: { label: "Facebook / Messenger", icon: "📘", color: "#1877F2" },
  threads: { label: "Threads", icon: "🧵", color: "#111827" },
  tiktok: { label: "TikTok", icon: "🎵", color: "#ee1d52" },
  instagram: { label: "Instagram", icon: "📸", color: "#c13584" },
  zalo: { label: "Zalo", icon: "💬", color: "#0068FF" },
  youtube: { label: "YouTube", icon: "▶️", color: "#ff0000" },
  ai: { label: "Trợ lý AI (ChatGPT, Gemini, Perplexity…)", icon: "🤖", color: "#10a37f" },
  referral: { label: "Link giới thiệu (website khác)", icon: "🔗", color: "#7c3aed" },
  spam: { label: "Spam / nguồn rác", icon: "🚫", color: "#dc2626" },
  direct: { label: "Seeding", icon: "⌨️", color: "#9ca3af" }, // không có nguồn (gõ thẳng / app giấu nguồn) — chủ dự án gọi là "Seeding"
};

/** Tên miền gửi "referral spam" hay gặp (công cụ SEO rác, bán traffic, trang cào dữ liệu). */
const SPAM_HOSTS = [
  "dataindex.pro",
  "semalt.com",
  "buttons-for-website.com",
  "best-seo-offer.com",
  "darodar.com",
  "ilovevitaly.com",
  "priceg.com",
  "hulfingtonpost.com",
  "econom.co",
  "trafficbot.life",
  "free-share-buttons.com",
  "seo-platform.com",
  "rank-checker.online",
  "site-auditor.online",
  "webwiki.com",
  "similarsites.com",
  "siteprice.org",
  "websiteoutlook.com",
  "statshow.com",
];
const SPAM_WORDS = /(^|[.-])(seo|traffic|backlink|buttons?|ranker|rank-?check|site-?audit|webstat|siteprice|casino|bet\d*|porn|xxx|sex|crypto|loan|viagra|free-?share)([.-]|$)/i;

const OWN_HOST = /(^|\.)taxuabooking\.(com|vn)$|^localhost(:\d+)?$|^127\.0\.0\.1(:\d+)?$|^(10|192\.168)\.[\d.]+(:\d+)?$/i;

function hostOf(url: string | null | undefined): string {
  if (!url) return "";
  const m = /^[a-z][a-z0-9+.-]*:\/\/([^/?#]+)/i.exec(url.trim());
  return m ? m[1].toLowerCase().replace(/^www\./, "") : "";
}

function paramsOf(path: string): URLSearchParams {
  const i = path.indexOf("?");
  try {
    return new URLSearchParams(i >= 0 ? path.slice(i + 1) : "");
  } catch {
    return new URLSearchParams();
  }
}

const has = (h: string, d: string) => h === d || h.endsWith("." + d);

/** Tên miền → nguồn (null = không nhận ra ⇒ link giới thiệu). */
function fromHost(h: string): SourceKey | null {
  if (!h) return null;
  if (SPAM_HOSTS.some((d) => has(h, d)) || SPAM_WORDS.test(h)) return "spam";
  if (/^accounts\.google\./.test(h)) return null; // quay lại từ đăng nhập Google ⇒ không phải nguồn
  if (/^(gemini|bard)\.google\./.test(h)) return "ai";
  if (/(^|\.)google\.[a-z.]+$/.test(h) || has(h, "googleadservices.com")) return h.includes("adservice") ? "ads" : "google";
  if (has(h, "bing.com") || has(h, "coccoc.com") || has(h, "yahoo.com") || has(h, "duckduckgo.com") || has(h, "search.brave.com") || has(h, "yandex.ru") || has(h, "yandex.com") || has(h, "naver.com") || has(h, "baidu.com") || has(h, "ecosia.org")) return "search";
  if (has(h, "threads.net") || has(h, "threads.com")) return "threads";
  if (has(h, "facebook.com") || has(h, "fb.com") || has(h, "fb.me") || has(h, "messenger.com")) return "facebook";
  if (has(h, "instagram.com")) return "instagram";
  if (has(h, "tiktok.com")) return "tiktok";
  if (has(h, "zalo.me") || has(h, "zaloapp.com") || has(h, "zalo.vn")) return "zalo";
  if (has(h, "youtube.com") || has(h, "youtu.be")) return "youtube";
  if (has(h, "chatgpt.com") || has(h, "openai.com") || has(h, "perplexity.ai") || has(h, "claude.ai") || has(h, "copilot.microsoft.com") || has(h, "you.com") || has(h, "deepseek.com")) return "ai";
  return null;
}

function fromUtm(src: string): SourceKey | null {
  const s = src.toLowerCase();
  if (!s) return null;
  if (/google/.test(s)) return "google";
  if (/threads/.test(s)) return "threads";
  if (/^(fb|facebook|messenger)|facebook/.test(s)) return "facebook";
  if (/^(ig|instagram)/.test(s)) return "instagram";
  if (/tiktok/.test(s)) return "tiktok";
  if (/zalo/.test(s)) return "zalo";
  if (/youtube/.test(s)) return "youtube";
  if (/chatgpt|openai|perplexity|gemini|claude|copilot/.test(s)) return "ai";
  if (/bing|coccoc|yahoo/.test(s)) return "search";
  return fromHost(s.includes(".") ? s : "") ?? "referral";
}

export interface SourceInfo {
  key: SourceKey;
  /** Tên miền referrer (đã bỏ www.) — rỗng nếu không có / là chính site. */
  host: string;
  /** Chi tiết thêm: "utm: zalo", "app Facebook"… */
  detail?: string;
}

export function classifySource(input: { referrer: string | null; path: string; userAgent: string | null }): SourceInfo {
  const p = paramsOf(input.path);
  let host = hostOf(input.referrer);
  if (OWN_HOST.test(host)) host = "";

  // 1. Tham số trên link vào.
  if (p.get("gclid") || p.get("gad_source") || p.get("gbraid") || p.get("wbraid")) return { key: "ads", host, detail: "gclid" };
  const utm = p.get("utm_source") ?? "";
  if (utm) return { key: fromUtm(utm) ?? "referral", host, detail: `utm: ${utm.slice(0, 40)}` };
  if (p.get("ttclid")) return { key: "tiktok", host, detail: "ttclid" };
  if (p.get("zarsrc")) return { key: "zalo", host, detail: "zarsrc" };

  // 2. Tên miền referrer.
  const byHost = fromHost(host);
  if (byHost) return { key: byHost, host };
  if (p.get("fbclid")) return { key: "facebook", host, detail: "fbclid" };

  // 3. Trình duyệt trong app (thường xoá referrer).
  const ua = input.userAgent ?? "";
  if (/Barcelona/i.test(ua)) return { key: "threads", host, detail: "app Threads" };
  if (/Instagram/i.test(ua)) return { key: "instagram", host, detail: "app Instagram" };
  if (/FBAN|FBAV|FB_IAB|FBIOS|Messenger/i.test(ua)) return { key: "facebook", host, detail: "app Facebook" };
  if (/musical_ly|Bytedance|TikTok|trill_/i.test(ua)) return { key: "tiktok", host, detail: "app TikTok" };
  if (/Zalo/i.test(ua)) return { key: "zalo", host, detail: "app Zalo" };

  if (host && !/^accounts\.google\./.test(host)) return { key: "referral", host };
  return { key: "direct", host: "" };
}

/** Một phiên = các lượt cách nhau không quá 30 phút (chuẩn GA). */
export const SESSION_GAP_MS = 30 * 60_000;
