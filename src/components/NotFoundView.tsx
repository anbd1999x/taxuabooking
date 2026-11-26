import Link from "@/components/Link";
import { getT } from "@/lib/i18n/server";

/**
 * Nội dung trang 404 (mã trạng thái vẫn là 404 — do notFound() / route không khớp quyết định).
 * Trước đây là trang mặc định tiếng Anh của Next, không có link nội bộ nào: khách và bot tới URL cũ bị cụt đường.
 */
export async function NotFoundView() {
  const t = await getT();
  const links: [string, string][] = [
    ["/homestay", t("Homestay")],
    ["/xe-cabin", t("Xe cabin")],
    ["/combo", t("Combo")],
    ["/kinh-nghiem", t("Kinh nghiệm Tà Xùa")],
    ["/tra-cuu", t("Tra cứu đơn")],
  ];
  return (
    <div className="container-page flex flex-col items-center py-16 text-center">
      <div className="text-sm font-extrabold uppercase tracking-[.14em] text-sunset-600">404</div>
      <h1 className="mt-2 text-2xl font-extrabold text-ink sm:text-3xl">{t("Không tìm thấy trang này")}</h1>
      <p className="mt-2 max-w-md text-gray-600">{t("Trang có thể đã đổi địa chỉ hoặc dịch vụ không còn đăng. Bạn xem các mục dưới đây nhé.")}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Link href="/" className="rounded-full bg-forest-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-forest-800">
          {t("Về trang chủ")}
        </Link>
        {links.map(([href, label]) => (
          <Link key={href} href={href} className="rounded-full border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">
            {label}
          </Link>
        ))}
      </div>
    </div>
  );
}
