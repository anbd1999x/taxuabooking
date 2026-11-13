import { notFound } from "next/navigation";
import { categoryBySlug } from "@/lib/constants";

/**
 * Kiểm tra danh mục NGAY Ở LAYOUT (chạy trước khung chờ `loading.tsx`): slug lạ (vd /abc) trả đúng
 * mã 404. Nếu chỉ gọi notFound() trong page thì khung chờ đã gửi mã 200 đi trước ⇒ Google coi là
 * "soft 404".
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
