"use client";

import { wdDmy } from "@/lib/date-format";
import { STAY_CHECKIN_TIME, STAY_CHECKOUT_TIME } from "@/lib/combo-pricing";
import { useT } from "@/components/i18n/I18nProvider";

/**
 * Lịch trình đầy đủ của một combo trong bảng tổng (bill) — dùng chung cho Combo gợi ý và Combo tự chọn:
 * ngày giờ LÊN XE chiều đi · NHẬN PHÒNG · TRẢ PHÒNG · XE VỀ. Giờ nhận/trả phòng là giờ chuẩn ghi trong
 * tin nhắn xác nhận (homestay có quy định riêng thì báo thêm khi chốt đơn).
 */
export function ComboSchedule({
  fromKey,
  toKey,
  checkIn,
  checkOut,
  nights,
  outTime,
  retTime,
  origin,
  className = "",
}: {
  /** Ngày đi (đêm lên xe) / ngày về (xe chạy về), yyyy-mm-dd. */
  fromKey: string;
  toKey: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  /** Giờ xe chạy chiều đi / chiều về của nhà xe đang chọn (chưa chọn xe ⇒ null). */
  outTime: string | null;
  retTime: string | null;
  origin: string | null;
  className?: string;
}) {
  const t = useT();
  const at = (time: string | null, key: string) => `${time ? `${time} · ` : ""}${wdDmy(key, t)}`;
  const rows: [string, string, string | null][] = [
    [t("Lên xe (chiều đi)"), at(outTime, fromKey), origin ? t("Đón tại {0}", [t(origin)]) : null],
    [t("Nhận phòng"), `${t("từ {0}", [STAY_CHECKIN_TIME])} · ${wdDmy(checkIn, t)}`, null],
    [t("Trả phòng"), `${t("trước {0}", [STAY_CHECKOUT_TIME])} · ${wdDmy(checkOut, t)}`, t("{0} đêm", [nights])],
    [t("Xe về (chiều về)"), at(retTime, toKey), null],
  ];
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {rows.map(([k, v, sub]) => (
        <div key={k} className="flex justify-between gap-3">
          <span className="flex-none text-gray-500">{k}</span>
          <span className="text-right font-bold text-ink">
            {v}
            {sub && <span className="block text-xs font-semibold text-gray-500">{sub}</span>}
          </span>
        </div>
      ))}
    </div>
  );
}
