import { permanentRedirect } from "next/navigation";
import { lp } from "@/lib/i18n/server";

/**
 * Bungalow đã gộp vào homestay (danh mục BUNGALOW ẩn khỏi CATEGORY_LIST) ⇒ URL cũ /bungalow/... từng được
 * Google index / chia sẻ phải chuyển hẳn (308) sang /homestay/... để giữ tín hiệu xếp hạng, thay vì 404.
 * Thư mục tĩnh `bungalow` được ưu tiên hơn [category] nên không đụng layout kiểm danh mục.
 */
export default async function BungalowRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ rest?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { rest = [] } = await params;
  // Dịch vụ còn mang danh mục BUNGALOW cũng có URL chuẩn /homestay/<slug> (serviceCatSlug) ⇒ chuyển thẳng, không lặp vòng.
  const sp = await searchParams;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) for (const x of Array.isArray(v) ? v : v != null ? [v] : []) qs.append(k, x);
  const path = rest.length ? `/homestay/${rest.map(encodeURIComponent).join("/")}` : "/homestay";
  const q = qs.toString();
  permanentRedirect(await lp(q ? `${path}?${q}` : path));
}
