import { SITE } from "@/lib/site";
import { getLocale } from "@/lib/i18n/server";
import { localePath } from "@/lib/i18n/config";

/**
 * Dữ liệu có cấu trúc `ItemList` cho trang DANH SÁCH (homestay, nhà xe, bài viết, quán ăn…): nói rõ với Google và
 * công cụ AI rằng trang này liệt kê những mục nào, theo thứ tự nào, kèm link từng mục. Danh sách hiển thị phần lớn
 * do client dựng dần (lưới thẻ chỉ dựng 24 thẻ đầu) nên khối này là nguồn đọc được ngay trong HTML.
 * `path` = đường dẫn GỐC tiếng Việt (vd "/homestay/nha-ben-suoi"); URL tự thêm tiền tố ngôn ngữ đang xem.
 */
export async function ItemListLd({ name, items, max = 60 }: { name: string; items: { name: string; path: string; image?: string | null }[]; max?: number }) {
  if (!items.length) return null;
  const locale = await getLocale();
  const base = SITE.url.replace(/\/$/, "");
  const abs = (u: string) => (/^https?:\/\//i.test(u) ? u : `${base}${u}`);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    numberOfItems: items.length,
    itemListElement: items.slice(0, max).map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      url: `${base}${localePath(it.path, locale)}`,
      ...(it.image ? { image: abs(it.image) } : {}),
    })),
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />;
}
