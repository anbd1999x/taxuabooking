import { getT } from "@/lib/i18n/server";
import type { TransportPointDTO, TransportPricing } from "@/lib/transport-legs";
import { buildFareLegs, rangeOf, rangeText, vnToday } from "./fares";

/** Số dòng tối đa của bảng (chặng nhiều bác tài nhận nhất đứng trước); phần còn lại báo bằng một câu. */
const MAX_ROWS = 30;

/**
 * Bảng giá theo chặng của xe ôm / taxi, dựng phía server từ giá từng bác tài khai (một chiều, dùng cho cả hai hướng).
 * Nhiều bác tài cùng nhận một chặng ⇒ hiện khoảng giá thấp nhất – cao nhất. Ô "—" = chưa ai khai mức đó.
 */
export async function RouteFareTable({
  kind,
  routes,
  points,
}: {
  kind: "XEOM" | "TAXI";
  routes: { pricing: TransportPricing; vehicleType?: string | null }[];
  points: TransportPointDTO[];
}) {
  const t = await getT();
  const bike = kind === "XEOM";
  const legs = buildFareLegs(routes, points);
  const day = rangeOf(routes.map((r) => r.pricing.dayPrice));
  const dayTwo = bike ? rangeOf(routes.map((r) => r.pricing.dayPriceTwo)) : null;
  if (!legs.length) return null; // chưa có chặng nào ⇒ không hiện tiêu đề "bảng giá theo chặng" trống
  const shown = legs.slice(0, MAX_ROWS);
  const rest = legs.length - shown.length;
  const title = bike ? t("Bảng giá xe ôm Tà Xùa theo chặng") : t("Bảng giá taxi Tà Xùa theo chặng");
  return (
    <section aria-label={title} className="container-page pb-6 pt-2">
      <h2 className="text-lg font-extrabold tracking-[-0.02em] text-ink sm:text-xl">{title}</h2>
      {shown.length > 0 && (
        <div className="md-table">
          <table>
            <caption className="sr-only">
              {bike
                ? t("Giá xe ôm một chiều của {0} chặng tại Tà Xùa, cho 1 khách và 2 khách đi chung xe", [shown.length])
                : t("Giá taxi một chiều của {0} chặng tại Tà Xùa, tính theo xe", [shown.length])}
            </caption>
            <thead>
              <tr>
                <th scope="col">{t("Chặng")}</th>
                {bike ? (
                  <>
                    <th scope="col">{t("1 khách / xe")}</th>
                    <th scope="col">{t("2 khách / xe")}</th>
                    <th scope="col">{t("Số tài xế nhận")}</th>
                  </>
                ) : (
                  <>
                    <th scope="col">{t("Giá một chiều / xe")}</th>
                    <th scope="col">{t("Loại xe nhận chặng")}</th>
                    <th scope="col">{t("Số xe nhận")}</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {shown.map((l) => (
                <tr key={`${l.a}|${l.b}`}>
                  <td>{t(l.a)} ↔ {t(l.b)}</td>
                  {bike ? (
                    <>
                      <td>{rangeText(l.one)}</td>
                      <td>{rangeText(l.two)}</td>
                    </>
                  ) : (
                    <>
                      <td>{rangeText(l.one)}</td>
                      <td>{l.vehicles.length ? l.vehicles.map((v) => t(v)).join(", ") : "—"}</td>
                    </>
                  )}
                  <td>{l.drivers}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className={`text-xs text-gray-500${shown.length ? "" : " mt-2"}`}>
        {t("Giá cập nhật ngày {0}, theo bảng giá chủ cơ sở niêm yết.", [vnToday()])}{" "}
        {shown.length > 0 && (bike ? t("Giá một chiều cho mỗi xe máy, dùng cho cả hai hướng của chặng.") : t("Giá một chiều cho cả xe, dùng cho cả hai hướng của chặng."))}
        {rest > 0 && <>{" "}{t("Còn {0} chặng khác: chọn điểm đón và điểm đến ở ô tìm kiếm phía trên để xem giá.", [rest])}</>}
        {day && <>{" "}{bike ? t("Thuê xe ôm nguyên ngày, 1 khách: {0}.", [rangeText(day)]) : t("Thuê taxi nguyên ngày, cả xe: {0}.", [rangeText(day)])}</>}
        {dayTwo && <>{" "}{t("Thuê xe ôm nguyên ngày, 2 khách chung xe: {0}.", [rangeText(dayTwo)])}</>}
      </p>
    </section>
  );
}
