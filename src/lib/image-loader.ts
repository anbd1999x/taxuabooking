/**
 * Loader của next/image (khai ở next.config.ts → images.loaderFile). File thuần, chạy cả server lẫn trình duyệt.
 *
 * Ảnh trong site (/uploads, /public) đi qua route `/thumb` để thu nhỏ đúng bề rộng khung hình + đổi sang WebP:
 * ảnh gốc admin tải lên có tấm 1–4 MB mà thẻ danh sách chỉ rộng ~400px. Ảnh Unsplash tự đổi tham số `w`.
 * Nguồn khác (pexels, blob:, data:, GIF động, URL có sẵn query) giữ nguyên.
 */

/** Các bề rộng được phép — phải khớp `deviceSizes` + `imageSizes` trong next.config.ts. Route /thumb từ chối số khác. */
export const THUMB_WIDTHS = [96, 160, 256, 384, 480, 640, 828, 1080, 1440, 1920];

const LOCAL_IMG = /^\/(?!_next\/|thumb\b|og\b|api\/)[^?#]+\.(jpe?g|png|webp|avif)$/i;

/** URL ảnh đã thu nhỏ về bề rộng `width` (làm tròn LÊN mức gần nhất trong THUMB_WIDTHS). Dùng được cho thẻ <img> thường. */
export function thumbUrl(src: string, width: number): string {
  if (!LOCAL_IMG.test(src)) return src;
  const w = THUMB_WIDTHS.find((x) => x >= width) ?? THUMB_WIDTHS[THUMB_WIDTHS.length - 1];
  return `/thumb?u=${encodeURIComponent(src)}&w=${w}`;
}

export default function imageLoader({ src, width }: { src: string; width: number; quality?: number }): string {
  if (LOCAL_IMG.test(src)) return thumbUrl(src, width);
  // Unsplash: đổi `w` (và `h` theo đúng tỉ lệ đang cắt) ngay trên URL của họ.
  if (/^https:\/\/images\.unsplash\.com\//i.test(src)) {
    try {
      const u = new URL(src);
      const w0 = Number(u.searchParams.get("w"));
      const h0 = Number(u.searchParams.get("h"));
      if (w0 > 0 && width >= w0) return src; // không phóng to hơn bản đã khai
      if (w0 > 0 && h0 > 0) u.searchParams.set("h", String(Math.round((h0 * width) / w0)));
      u.searchParams.set("w", String(width));
      if (!u.searchParams.has("q")) u.searchParams.set("q", "75");
      if (!u.searchParams.has("auto") && !u.searchParams.has("fm")) u.searchParams.set("auto", "format");
      return u.toString();
    } catch {
      return src;
    }
  }
  return src;
}
