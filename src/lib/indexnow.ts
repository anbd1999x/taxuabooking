import "server-only";
import { prisma } from "@/lib/prisma";
import { SITE } from "@/lib/site";

/**
 * IndexNow: báo ngay cho Bing (⇒ Yahoo, DuckDuckGo), Yandex, Seznam… khi trang đổi, khỏi chờ bot tự quay lại.
 * Khoá là công khai theo giao thức: file xác minh `public/<KEY>.txt` chứa đúng chuỗi khoá.
 * Google KHÔNG dùng IndexNow (Google vẫn đi theo sitemap / Search Console).
 */
export const INDEXNOW_KEY = "d213453e5778c61b6e7ab625ef660785";
const ENDPOINT = "https://api.indexnow.org/indexnow";
const PROD = "https://taxuabooking.com";
const CURSOR_KEY = "indexNowAt";

/** Gửi danh sách URL (cùng host). Chỉ chạy trên site thật — dev / máy khác bỏ qua. Trả số URL đã gửi. */
export async function submitIndexNow(urls: string[]): Promise<number> {
  const base = SITE.url.replace(/\/$/, "");
  if (base !== PROD) return 0;
  const list = [...new Set(urls.filter((u) => u.startsWith(base + "/") || u === base))];
  let sent = 0;
  for (let i = 0; i < list.length; i += 10_000) {
    const urlList = list.slice(i, i + 10_000);
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify({ host: new URL(base).host, key: INDEXNOW_KEY, keyLocation: `${base}/${INDEXNOW_KEY}.txt`, urlList }),
      signal: AbortSignal.timeout(20_000),
    });
    // 200 = đã nhận, 202 = đã nhận, đang kiểm khoá. Lỗi khác (400/403/422/429) ⇒ báo ra log.
    if (res.status !== 200 && res.status !== 202) throw new Error(`IndexNow ${res.status}: ${(await res.text()).slice(0, 200)}`);
    sent += urlList.length;
  }
  return sent;
}

/**
 * Gửi các URL trong sitemap có `lastModified` mới hơn lần gửi trước (bài viết, dịch vụ, địa điểm, vé — kể cả bài sửa thẳng trong DB).
 * Con trỏ SiteSetting `indexNowAt` (ms); cập nhật kiểu so-và-đổi ⇒ 2 bản app không gửi trùng.
 * Lần đầu chỉ đặt mốc (gửi toàn bộ sitemap bằng `scripts/seo/indexnow.mjs`).
 */
export async function pingChangedUrls(): Promise<number> {
  if (SITE.url.replace(/\/$/, "") !== PROD) return 0;
  const now = Date.now();
  const row = await prisma.siteSetting.findUnique({ where: { key: CURSOR_KEY } });
  if (!row) {
    await prisma.siteSetting.create({ data: { key: CURSOR_KEY, value: String(now) } }).catch(() => {});
    return 0;
  }
  const since = Number(row.value) || now;
  // Giành lượt: chỉ một bản app đổi được mốc từ giá trị cũ.
  const won = await prisma.siteSetting.updateMany({ where: { key: CURSOR_KEY, value: row.value }, data: { value: String(now) } });
  if (won.count !== 1) return 0;
  const { default: sitemap } = await import("@/app/sitemap");
  const urls = (await sitemap())
    .filter((e) => e.lastModified && new Date(e.lastModified).getTime() > since)
    .map((e) => e.url);
  if (!urls.length) return 0;
  try {
    return await submitIndexNow(urls);
  } catch (err) {
    // Gửi lỗi ⇒ trả mốc về để lượt sau gửi lại.
    await prisma.siteSetting.updateMany({ where: { key: CURSOR_KEY, value: String(now) }, data: { value: String(since) } });
    throw err;
  }
}
