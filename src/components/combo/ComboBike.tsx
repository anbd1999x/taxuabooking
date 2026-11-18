"use client";

import { wdDmy } from "@/lib/date-format";
import { useMemo, useState } from "react";
import { COMBO_MOTORBIKES, comboMotorbike, comboMotorbikeCost, comboMotorbikeDays, comboMotorbikeValid, type ComboBikeKey } from "@/lib/combo-pricing";
import { RENTAL_HOURS, RENTAL_DEFAULT_HOUR, rentalDaysLabel } from "@/lib/rental-days";
import { useT } from "@/components/i18n/I18nProvider";

/**
 * Tuỳ chọn THÊM THUÊ XE MÁY khi đặt combo — dùng chung cho "Combo gợi ý" (ComboResults) và
 * "Combo tự chọn" (ComboCustom) để hai chế độ luôn có cùng lựa chọn, cùng cách tính.
 * Xe máy là dịch vụ đi kèm TÍNH RIÊNG: không cộng vào bill combo (server tính lại giá tham khảo).
 */

function vnd(n: number): string {
  return new Intl.NumberFormat("vi-VN").format(Math.round(n)) + "đ";
}

/** Các khoá yyyy-mm-dd từ `from` tới `to` (gồm cả hai đầu). */
export function dayKeysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  const end = Date.parse(`${to}T00:00:00Z`);
  for (let t = Date.parse(`${from}T00:00:00Z`); Number.isFinite(t) && t <= end && out.length < 60; t += 86_400_000) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out.length ? out : [from];
}

/** `people` = số khách tính phí (trần số xe); `checkIn`/`checkOut` = khoảng lưu trú (yyyy-mm-dd). */
export function useComboBike({ people, nights, checkIn, checkOut }: { people: number; nights: number; checkIn: string; checkOut: string }) {
  const tr = useT();
  // Tuỳ chọn thêm xe máy (chọn loại: Wave 170k / PG1 270k mỗi xe mỗi ngày) — MẶC ĐỊNH KHÔNG TICK. Số ngày thuê = số đêm.
  const [withBike, setWithBike] = useState(false);
  const [bikeType, setBikeType] = useState<ComboBikeKey>(COMBO_MOTORBIKES[0].key);
  const bike = comboMotorbike(bikeType);
  const [bikeQty, setBikeQty] = useState(Math.max(1, Math.ceil(people / 2)));
  const bikes = withBike ? Math.min(bikeQty, people) : 0;
  // Ngày nhận / trả xe: chọn trong khoảng lưu trú [check-in, check-out] (mặc định cả kỳ) — VD ở 3 ngày nhưng chỉ thuê 2 ngày.
  const stayDays = useMemo(() => dayKeysBetween(checkIn, checkOut), [checkIn, checkOut]);
  const [bikeFrom, setBikeFrom] = useState(checkIn);
  const [bikeTo, setBikeTo] = useState(checkOut);
  // Giờ nhận / giờ trả xe: số ngày thuê quy đổi theo mốc 24 giờ (mặc định 06:00 – 06:00 = đúng số ngày lịch).
  const [bikePickup, setBikePickup] = useState(RENTAL_DEFAULT_HOUR);
  const [bikeReturn, setBikeReturn] = useState(RENTAL_DEFAULT_HOUR);
  const bikeGap = Math.max(0, stayDays.indexOf(bikeTo) - stayDays.indexOf(bikeFrom));
  const bikeTimeOk = comboMotorbikeValid(bikeGap, bikePickup, bikeReturn);
  const bikeDays = comboMotorbikeDays(nights, bikePickup, bikeReturn, bikeGap);
  const bikeCost = comboMotorbikeCost(bikes, nights, bikeType, bikePickup, bikeReturn, bikeGap);
  const bikeWhenFrom = `${bikePickup} ${wdDmy(bikeFrom, tr)}`;
  const bikeWhenTo = `${bikeReturn} ${wdDmy(bikeTo, tr)}`;
  // Đổi ngày mà thành thuê TRONG NGÀY (nhận = trả) với giờ trả ≤ giờ nhận (vd mặc định 06:00–06:00)
  // ⇒ tự đẩy giờ trả lên mốc sau giờ nhận để khỏi báo lỗi ngay.
  function fixSameDay(from: string, to: string) {
    if (from === to && bikeReturn <= bikePickup) {
      setBikeReturn(RENTAL_HOURS.find((h) => h > bikePickup) ?? RENTAL_HOURS[RENTAL_HOURS.length - 1]);
    }
  }
  function pickBikeFrom(k: string) {
    const to = bikeTo < k ? k : bikeTo;
    setBikeFrom(k);
    setBikeTo(to);
    fixSameDay(k, to);
  }
  function pickBikeTo(k: string) {
    setBikeTo(k);
    fixSameDay(bikeFrom, k);
  }
  return { people, withBike, setWithBike, bikeType, setBikeType, bike, bikes, setBikeQty, stayDays, bikeFrom, bikeTo, bikePickup, setBikePickup, bikeReturn, setBikeReturn, bikeTimeOk, bikeDays, bikeCost, bikeWhenFrom, bikeWhenTo, pickBikeFrom, pickBikeTo };
}
export type ComboBikeState = ReturnType<typeof useComboBike>;

/** Các trường xe máy gửi lên /api/combo/book (không thuê ⇒ motorbikes = 0, còn lại null). */
export function comboBikePayload(s: ComboBikeState) {
  const on = s.bikes > 0;
  return {
    motorbikes: s.bikes,
    motorbikeType: on ? s.bikeType : null,
    motorbikePickup: on ? s.bikePickup : null,
    motorbikeReturn: on ? s.bikeReturn : null,
    motorbikePickupDate: on ? s.bikeFrom : null,
    motorbikeReturnDate: on ? s.bikeTo : null,
  };
}

/** Khối tóm tắt xe máy đã chọn (ẩn khi không thuê). */
export function ComboBikeSummary({ state }: { state: ComboBikeState }) {
  const tr = useT();
  const { bike, bikes, bikeDays, bikeCost, bikeWhenFrom, bikeWhenTo } = state;
  return (
    <>
          {bikes > 0 && (
            <div className="flex flex-col gap-1 rounded-xl border border-dashed border-sunset-300 bg-sunset-50 p-3.5 text-[13px]">
              <div className="flex items-start justify-between gap-3">
                <span className="min-w-0 font-bold text-ink">{tr("🏍️ Thuê xe máy")}{" "}<span className="block font-semibold text-gray-500 sm:inline">{tr("(dịch vụ kèm · tính riêng)")}</span></span>
                <span className="flex-none text-right font-extrabold text-ink"><span className="block text-[11px] font-semibold text-gray-500">{tr("Giá tham khảo")}</span>{tr(vnd(bikeCost))}</span>
              </div>
              <div className="text-xs text-gray-600">{tr("{0} · {1} xe × {2} × {3} · nhận {4}, trả {5}", [tr(bike.name), bikes, rentalDaysLabel(bikeDays, tr), tr(vnd(bike.perDay)), bikeWhenFrom, bikeWhenTo])}</div>
              <div className="text-xs font-semibold leading-relaxed text-sunset-700">{tr("Không tính vào bill combo ở trên — thanh toán trực tiếp khi giao xe.")}</div>
            </div>
          )}
    </>
  );
}

/** Ô tick "Thêm thuê xe máy" + chọn loại xe, ngày/giờ nhận trả, số xe. */
export function ComboBikePicker({ state }: { state: ComboBikeState }) {
  const tr = useT();
  const { people, withBike, setWithBike, bikeType, setBikeType, bike, bikes, setBikeQty, stayDays, bikeFrom, bikeTo, bikePickup, setBikePickup, bikeReturn, setBikeReturn, bikeTimeOk, bikeDays, bikeCost, pickBikeFrom, pickBikeTo } = state;
  return (
        <div className="flex flex-col gap-2.5 rounded-xl border border-gray-200 p-3.5">
          <label className="flex cursor-pointer items-start gap-2.5">
            <input type="checkbox" checked={withBike} onChange={(e) => setWithBike(e.target.checked)} className="mt-0.5 h-[18px] w-[18px] flex-none accent-forest-600" />
            <span className="min-w-0">
              <span className="block text-sm font-bold text-ink">{tr("🏍️ Thêm thuê xe máy")}</span>
              {/* Giá từng loại xe luôn hiện; phần mô tả & điều kiện chỉ hiện khi đã tick. */}
              <span className="block text-xs text-gray-500"><b className="text-forest-700">{COMBO_MOTORBIKES.map((b) => tr("{0} {1}/ngày", [b.name, vnd(b.perDay)])).join(" · ")}</b>{withBike && tr(" · nhận xe tại Tà Xùa, tự đi săn mây & các điểm check-in")}</span>
              {withBike && <span className="mt-0.5 block text-xs font-semibold text-sunset-700">{tr("Dịch vụ đi kèm, tính riêng — không cộng vào bill combo, thanh toán khi giao xe. Số tiền hiển thị chỉ là giá tham khảo, chưa phải giá cuối; giá chính thức tính theo giờ sử dụng xe thực tế.")}</span>}
            </span>
          </label>
          {withBike && (
            <div className="flex flex-col gap-2 border-t border-dashed border-gray-200 pt-2.5">
              <div className="text-sm font-bold text-ink">{tr("Chọn loại xe")}</div>
              <div className="grid grid-cols-2 gap-2">
                {COMBO_MOTORBIKES.map((b) => {
                  const on = bikeType === b.key;
                  return (
                    <button
                      key={b.key}
                      type="button"
                      onClick={() => setBikeType(b.key)}
                      aria-pressed={on}
                      className={`flex flex-col items-start rounded-xl border-[1.5px] px-3 py-2 text-left transition ${on ? "border-forest-600 bg-forest-50" : "border-gray-200 bg-white hover:border-forest-300"}`}
                    >
                      <span className="text-sm font-bold text-ink">{tr(b.name)}</span>
                      <span className={`text-xs font-semibold ${on ? "text-forest-700" : "text-gray-500"}`}>{tr("{0}/ngày", [tr(vnd(b.perDay))])}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {withBike && (
            <div className="flex flex-col gap-2 border-t border-dashed border-gray-200 pt-2.5">
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-semibold text-gray-600">{tr("Ngày nhận xe")}</span>
                  <select value={bikeFrom} onChange={(e) => pickBikeFrom(e.target.value)} aria-label={tr("Ngày nhận xe")} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-forest-500">
                    {stayDays.map((k) => <option key={k} value={k}>{wdDmy(k, tr)}</option>)}
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-semibold text-gray-600">{tr("Ngày trả xe")}</span>
                  <select value={bikeTo} onChange={(e) => pickBikeTo(e.target.value)} aria-label={tr("Ngày trả xe")} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-forest-500">
                    {stayDays.filter((k) => k >= bikeFrom).map((k) => <option key={k} value={k}>{wdDmy(k, tr)}</option>)}
                  </select>
                </label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {([
                  [tr("Giờ nhận xe"), bikePickup, setBikePickup],
                  [tr("Giờ trả xe"), bikeReturn, setBikeReturn],
                ] as const).map(([label, value, set]) => (
                  <label key={label} className="flex flex-col gap-1">
                    <span className="text-xs font-semibold text-gray-600">{tr(label)}</span>
                    <select value={value} onChange={(e) => set(e.target.value)} aria-label={tr(label)} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-forest-500">
                      {RENTAL_HOURS.map((h) => <option key={h} value={h}>{tr(h)}</option>)}
                    </select>
                  </label>
                ))}
              </div>
              <p className="text-[11px] leading-relaxed text-gray-500">
                {bikeTimeOk ? <>{tr("Thuê trong khoảng lưu trú, không bắt buộc cả kỳ —")}{" "}<b className="text-ink">{tr("tính {0}", [rentalDaysLabel(bikeDays, tr)])}</b></> : <b className="text-red-600">{tr("Trả xe trong ngày nhận thì giờ trả phải sau giờ nhận xe.")}</b>}{tr(". Mỗi 24 giờ kể từ giờ nhận = 1 ngày; trả trễ tới 6 giờ tính thêm nửa ngày, trễ hơn 6 giờ tính thêm 1 ngày.")}
              </p>
            </div>
          )}
          {withBike && (
            <div className="flex items-center justify-between gap-3 border-t border-dashed border-gray-200 pt-2.5">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-ink">{tr("Số xe")}</div>
                <div className="text-xs text-gray-500">{bikes} xe × {rentalDaysLabel(bikeDays, tr)} × {tr(vnd(bike.perDay))} ≈ <b className="whitespace-nowrap text-sunset-600">{tr(vnd(bikeCost))}</b> <span className="whitespace-nowrap">{tr("(tham khảo)")}</span></div>
              </div>
              <div className="flex flex-none items-center gap-2.5">
                <button type="button" onClick={() => setBikeQty((q) => Math.max(1, Math.min(q, people) - 1))} disabled={bikes <= 1} className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 text-lg font-bold text-ink disabled:opacity-40">−</button>
                <span className="w-5 text-center text-base font-extrabold text-ink">{bikes}</span>
                <button type="button" onClick={() => setBikeQty((q) => Math.min(people, q + 1))} disabled={bikes >= people} className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 text-lg font-bold text-ink disabled:opacity-40">+</button>
              </div>
            </div>
          )}
        </div>
  );
}

/** Ghi chú xe máy ở màn "đã gửi yêu cầu" (ẩn khi không thuê). */
export function ComboBikeDoneNote({ state }: { state: ComboBikeState }) {
  const tr = useT();
  const { bike, bikes, bikeDays, bikeCost, bikeWhenFrom, bikeWhenTo } = state;
  return (
    <>
      {bikes > 0 && (
        <div className="rounded-xl border border-dashed border-sunset-300 bg-sunset-50 p-3.5 text-[13px] leading-relaxed text-gray-700">
          🏍️ <b className="text-ink">{tr("Thuê xe máy {0}: {1} xe × {2} (nhận {3}, trả {4}) ≈ {5}", [tr(bike.name), bikes, rentalDaysLabel(bikeDays, tr), bikeWhenFrom, bikeWhenTo, tr(vnd(bikeCost))])}</b> — <b>{tr("giá tham khảo, chưa phải giá cuối")}</b>{tr(". Dịch vụ đi kèm, tính riêng, không nằm trong bill combo; giá chính thức tính theo giờ sử dụng xe thực tế, thanh toán trực tiếp khi giao xe.")}
        </div>
      )}
    </>
  );
}
