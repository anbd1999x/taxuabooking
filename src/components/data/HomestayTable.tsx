import Link from "@/components/Link";
import { getT } from "@/lib/i18n/server";
import { formatPrice } from "@/lib/format";
import type { HomestayTableRow } from "@/lib/queries";
import { vnToday } from "./fares";

/**
 * Bảng MỌI homestay đang đăng, dựng phía server: lưới thẻ phía trên chỉ dựng 24 thẻ đầu (cuộn mới nạp thêm)
 * nên đây là nơi Google và công cụ AI đọc được link + số liệu của từng nhà ngay trong HTML.
 * Số phòng, giá, tiện ích lấy thẳng từ DB lúc dựng trang; ô "—" = chưa có dữ liệu.
 */
export async function HomestayTable({ rows }: { rows: HomestayTableRow[] }) {
  if (!rows.length) return null;
  const t = await getT();
  const yes = t("Có");
  const flag = (v: boolean) => (v ? yes : "—");
  const title = t("Tất cả homestay tại Tà Xùa");
  return (
    <section aria-label={title} className="container-page pb-6 pt-2">
      <h2 className="text-lg font-extrabold tracking-[-0.02em] text-ink sm:text-xl">{title}</h2>
      <div className="md-table">
        <table>
          <caption className="sr-only">{t("Bảng so sánh {0} homestay tại Tà Xùa: khu vực, số phòng, giá từ mỗi đêm và tiện ích", [rows.length])}</caption>
          <thead>
            <tr>
              <th scope="col">{t("Homestay")}</th>
              <th scope="col">{t("Khu vực")}</th>
              <th scope="col">{t("Số phòng")}</th>
              <th scope="col">{t("Giá từ / đêm")}</th>
              <th scope="col">{t("View mây")}</th>
              <th scope="col">{t("Bồn tắm")}</th>
              <th scope="col">{t("Điều hòa")}</th>
              <th scope="col">{t("Ăn sáng")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((h) => (
              <tr key={h.slug}>
                <td>
                  <Link href={`/homestay/${h.slug}`} className="text-forest-700 hover:underline">{t(h.name)}</Link>
                </td>
                <td>{h.area ? t(h.area) : "—"}</td>
                <td>{h.roomCount > 0 ? h.roomCount : "—"}</td>
                <td>{h.priceFrom != null ? formatPrice(h.priceFrom) : "—"}</td>
                <td>{flag(h.cloudView)}</td>
                <td>{flag(h.bathtub)}</td>
                <td>{flag(h.airCon)}</td>
                <td>{flag(h.breakfast)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-500">
        {t("Giá cập nhật ngày {0}, theo bảng giá chủ cơ sở niêm yết.", [vnToday()])}{" "}
        {t("Giá từ là đêm rẻ nhất trong tuần của phòng rẻ nhất; tiện ích tính theo hạng phòng, ô trống là chưa có thông tin.")}
      </p>
    </section>
  );
}
