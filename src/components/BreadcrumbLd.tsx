import { SITE } from "@/lib/site";
import { getLocale } from "@/lib/i18n/server";
import { localePath } from "@/lib/i18n/config";

/**
 * Dữ liệu có cấu trúc `BreadcrumbList`: đường dẫn phân cấp của trang (Trang chủ › Mục › Trang hiện tại).
 * `path` = đường dẫn GỐC tiếng Việt (vd "/nha-hang/quan-a"); URL tự thêm tiền tố ngôn ngữ đang xem.
 * Phần tử đầu là Trang chủ (`/`) — bản tiếng Việt ra đúng `SITE.url`, KHÔNG có dấu `/` cuối.
 * `name` truyền vào đã dịch sẵn (lấy bằng `t()` từ chữ đang hiển thị trên trang).
 */
export async function BreadcrumbLd({ items }: { items: { name: string; path: string }[] }) {
  const list = items.filter((it) => it.name && it.path);
  if (list.length < 2) return null;
  const locale = await getLocale();
  const base = SITE.url.replace(/\/$/, "");
  const urlOf = (path: string) => {
    const p = localePath(path, locale);
    return p === "/" ? base : `${base}${p}`;
  };
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: list.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: urlOf(it.path),
    })),
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />;
}
