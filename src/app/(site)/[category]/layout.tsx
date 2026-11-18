import { notFound } from "next/navigation";
import { categoryBySlug } from "@/lib/constants";

/**
 * Kiểm tra danh mục NGAY Ở LAYOUT (chạy trước mọi khung chờ <Suspense>): slug lạ (vd /abc) trả đúng
 * mã 404. KHÔNG thêm `loading.tsx` trong nhánh [category]: nó gửi mã 200 đi trước khi trang con kịp
 * gọi notFound() ⇒ Google coi là "soft 404". Khung chờ đặt bằng <Suspense> trong từng page.
 */
export default async function CategoryLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  if (!categoryBySlug(category)) notFound();
  return children;
}
