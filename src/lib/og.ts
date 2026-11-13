import type { Metadata } from "next";
import { SITE } from "@/lib/site";
import { isVideoUrl } from "@/lib/utils";

/** Kích thước ảnh xem trước chuẩn của Facebook / Zalo / Messenger / Telegram. */
export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

type OgImage = { url: string; width?: number; height?: number; alt?: string };

/**
 * Ảnh xem trước khi dán link vào mạng xã hội. Ảnh trong site (/uploads, /public) đi qua
 * route `/og` để cắt về 1200×630 JPEG nhẹ (ảnh gốc có thể là webp/avif hoặc quá nặng ⇒
 * Zalo/Messenger bỏ qua, chỉ hiện chữ). Ảnh ngoài site giữ nguyên URL. Thiếu ảnh ⇒ ảnh biển mây.
 */
export function ogImages(src?: string | null, alt = "Biển mây Tà Xùa"): OgImage[] {
  const s = (src ?? "").trim();
  if (/^https?:\/\//i.test(s)) return [{ url: s, alt }];
  const local = s.startsWith("/") && !isVideoUrl(s) ? s : "";
  return [{ url: local ? `/og?u=${encodeURIComponent(local)}` : "/og", width: OG_WIDTH, height: OG_HEIGHT, alt }];
}

/**
 * Khối openGraph đầy đủ cho 1 trang. Next KHÔNG gộp sâu openGraph với layout cha: trang chỉ
 * khai `title` sẽ thừa hưởng nguyên og:title của trang chủ ⇒ dán link nào cũng ra cùng 1 dòng chữ.
 */
export function ogBlock(o: {
  title: string;
  description: string;
  path: string;
  image?: string | null;
  alt?: string;
}): NonNullable<Metadata["openGraph"]> {
  return {
    type: "website",
    locale: "vi_VN",
    siteName: SITE.name,
    title: o.title,
    description: o.description,
    url: `${SITE.url.replace(/\/$/, "")}${o.path}`,
    images: ogImages(o.image, o.alt ?? o.title),
  };
}

/** Metadata gọn cho trang tĩnh: tiêu đề + mô tả + canonical + thẻ chia sẻ mạng xã hội. */
export function pageMeta(o: {
  title: string;
  description: string;
  path: string;
  image?: string | null;
  alt?: string;
}): Metadata {
  return {
    title: o.title,
    description: o.description,
    alternates: { canonical: o.path },
    openGraph: ogBlock(o),
  };
}
