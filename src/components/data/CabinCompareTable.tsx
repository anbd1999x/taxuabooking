import Link from "@/components/Link";
import { getT } from "@/lib/i18n/server";
import { formatPrice } from "@/lib/format";
import { legFareFor, roundTripFareFor } from "@/lib/combo";
import type { CabinCompareRow } from "@/lib/queries";
import { vnToday } from "./fares";

/** Điểm đón mặc định của bảng so sánh (cùng mặc định với trang đặt vé). */
export const CABIN_BASE_PICKUP = "Hà Nội";

/** Giá vé từ Hà Nội của một nhà xe theo bảng giá chặng đang áp (cùng hàm tính với trang đặt vé và combo). */
export function cabinBaseFares(r: CabinCompareRow) {
  return {
    round: roundTripFareFor(r.fares, CABIN_BASE_PICKUP),
    out: legFareFor(r.fares, CABIN_BASE_PICKUP, "OUTBOUND"),
    ret: legFareFor(r.fares, CABIN_BASE_PICKUP, "RETURN"),
  };
}

/**
 * Bảng so sánh các nhà xe cabin đang đăng, dựng phía server. Giờ + nơi lên xe = mốc đầu của lộ trình nhà xe khai;
 * giá = bảng giá chặng của TỪNG nhà xe (chưa có bảng riêng thì bảng chung). Ô "—" = nhà xe chưa khai.
 */
export async function CabinCompareTable({ rows }: { rows: CabinCompareRow[] }) {
  if (!rows.length) return null;
  const t = await getT();
  const money = (n: number | null) => (n != null ? formatPrice(n) : "—");
  const title = t("So sánh nhà xe cabin Hà Nội – Tà Xùa");
  return (
    <section aria-label={title} className="container-page pb-6 pt-2">
      <h2 className="text-lg font-extrabold tracking-[-0.02em] text-ink sm:text-xl">{title}</h2>
      <div className="md-table">
        <table>
          <caption className="sr-only">{t("Bảng so sánh {0} nhà xe cabin đi Tà Xùa: giờ xuất phát, điểm lên xe và giá vé từ Hà Nội", [rows.length])}</caption>
          <thead>
            <tr>
              <th scope="col">{t("Nhà xe")}</th>
              <th scope="col">{t("Giờ xuất phát chiều đi")}</th>
              <th scope="col">{t("Điểm lên xe đầu tuyến")}</th>
              <th scope="col">{t("Giờ rời Tà Xùa chiều về")}</th>
              <th scope="col">{t("Vé khứ hồi từ Hà Nội")}</th>
              <th scope="col">{t("Vé chiều đi")}</th>
              <th scope="col">{t("Vé chiều về")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const f = cabinBaseFares(r);
              return (
                <tr key={r.slug}>
                  <td>
                    <Link href={`/xe-cabin/${r.slug}`} className="text-forest-700 hover:underline">{t(r.title)}</Link>
                  </td>
                  <td>{r.departTime ?? "—"}</td>
                  <td>{r.departPlace ? t(r.departPlace) : "—"}</td>
                  <td>{r.returnTime ?? "—"}</td>
                  <td>{money(f.round)}</td>
                  <td>{money(f.out)}</td>
                  <td>{money(f.ret)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-500">
        {t("Giá cập nhật ngày {0}, theo bảng giá chủ cơ sở niêm yết.", [vnToday()])}{" "}
        {t("Giá vé là giá một người đón tại Hà Nội; giờ và điểm lên xe là mốc đầu trong lộ trình nhà xe công bố.")}
      </p>
    </section>
  );
}
