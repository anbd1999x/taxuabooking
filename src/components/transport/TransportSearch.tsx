"use client";

import { useMemo, useState } from "react";
import { DateField } from "@/components/DateField";
import type { TFunc } from "@/lib/i18n/config";
import { useT } from "@/components/i18n/I18nProvider";
import { quoteTransport, lowestPrice, minDrivers, effectiveCapacity, type TransportMode, type TransportPointDTO, type TransportPricing } from "@/lib/transport-legs";

/**
 * Ô tìm kiếm của trang danh sách taxi / xe ôm: chọn CHẶNG (điểm đón → điểm đến, 1 chiều) hoặc THUÊ NGUYÊN NGÀY,
 * ngày đi, số người và số tài xế (xe ôm: tối đa 2 người / tài xế) / số xe (taxi). Mỗi thẻ bác tài được báo giá
 * theo lựa chọn này (xem quoteTransport); chặng bác tài chưa khai ⇒ "nhắn tin báo giá".
 */
export function useTransportSearch(bike: boolean) {
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [mode, setMode] = useState<TransportMode>("DAY"); // mặc định thuê nguyên ngày
  const [people, setPeopleRaw] = useState(bike ? 1 : 2);
  const [drivers, setDriversRaw] = useState(1);
  const [day, setDay] = useState("");
  const maxDrivers = (p: number) => (bike ? p : Math.max(1, p));
  // Xe ôm: số tài xế ∈ [⌈người/2⌉, người]. Taxi: số xe ∈ [1, người].
  const clampDrivers = (d: number, p: number) => Math.min(maxDrivers(p), Math.max(bike ? minDrivers(true, 2, p) : 1, d));
  const setPeople = (p: number) => {
    const np = Math.min(bike ? 20 : 40, Math.max(1, p));
    setPeopleRaw(np);
    setDriversRaw((d) => clampDrivers(d, np));
  };
  const setDrivers = (d: number) => setDriversRaw(clampDrivers(d, people));
  // Đang "tìm": chặng đã đủ 2 điểm, hoặc nguyên ngày mà khách đã chỉnh gì đó (điểm / số người / số tài xế).
  const active = mode === "LEG" ? Boolean(fromId && toId) : Boolean(fromId || toId) || people !== (bike ? 1 : 2) || drivers !== 1;
  const key = `${mode}|${fromId}|${toId}|${people}|${drivers}`;
  const detailTail = (() => {
    const p = new URLSearchParams();
    if (day) p.set("from", day);
    if (fromId) p.set("dpt", fromId);
    if (toId) p.set("dst", toId);
    p.set("tm", mode);
    p.set("pax", String(people));
    p.set("drv", String(drivers));
    return `?${p.toString()}`;
  })();
  return { bike, fromId, setFromId, toId, setToId, mode, setMode, people, setPeople, drivers, setDrivers, day, setDay, active, key, detailTail };
}
export type TransportSearchState = ReturnType<typeof useTransportSearch>;

/** Gắn giá theo lựa chọn tìm kiếm vào một thẻ bác tài (giữ nguyên thẻ nếu thiếu dữ liệu giá). */
export function withQuote<T extends { price: number | null; priceNote: string | null; pricing?: TransportPricing | null }>(
  card: T,
  ts: TransportSearchState,
  tr: TFunc,
): T {
  const p = card.pricing;
  if (!p) return card;
  // Chưa chọn chặng: thẻ hiện GIÁ THUÊ NGUYÊN NGÀY admin nhập (/ngày); bác tài chưa có giá ngày ⇒ giá chặng thấp nhất.
  if (!ts.active) {
    const day = p.dayPrice != null && p.dayPrice > 0 ? p.dayPrice : null;
    return { ...card, price: day ?? lowestPrice(p) ?? card.price, priceNote: card.priceNote };
  }
  const q = quoteTransport(p, { mode: ts.mode, fromId: ts.fromId, toId: ts.toId, people: ts.people, drivers: ts.drivers });
  const unit = p.bike ? tr("tài xế") : tr("xe");
  if (q.error) return { ...card, price: null, priceNote: tr(q.error) };
  if (q.total == null) return { ...card, price: null, priceNote: ts.mode === "LEG" ? tr("Chặng này chưa có giá sẵn — nhắn tin báo giá") : tr("Chưa có giá nguyên ngày — nhắn tin báo giá") };
  const how = p.bike && q.twos > 0 ? tr("{0} người · {1} {2} ({3} xe chở 2)", [ts.people, ts.drivers, unit, q.twos]) : tr("{0} người · {1} {2}", [ts.people, ts.drivers, unit]);
  return { ...card, price: q.total, priceNote: `${how}${q.leg?.note ? ` · ${tr(q.leg.note)}` : ""}` };
}

export function TransportSearchPanel({
  ts,
  points,
  wide,
  cell,
  inp,
  accent,
  onSearch,
}: {
  ts: TransportSearchState;
  points: TransportPointDTO[];
  wide: boolean;
  cell: string;
  inp: string;
  accent: string;
  onSearch: () => void;
}) {
  const tr = useT();
  const unit = ts.bike ? tr("Số tài xế") : tr("Số xe");
  const hint = useMemo(() => {
    if (!ts.bike) return tr("Giá taxi tính theo xe. Chọn đủ số xe cho đoàn (xe 4 chỗ / 7 chỗ tuỳ bác tài).");
    const cap = effectiveCapacity(true, 2);
    return tr("Mỗi xe máy chở tối đa {0} người kèm 1 tài xế.", [cap]);
  }, [ts.bike, tr]);
  const stepper = (val: number, set: (n: number) => void) => (
    <div className="flex items-center gap-2.5 pt-0.5">
      <button type="button" onClick={() => set(val - 1)} className="flex h-7 w-7 items-center justify-center rounded-lg bg-white font-bold">−</button>
      <span className="min-w-[14px] text-center text-[15px] font-extrabold">{val}</span>
      <button type="button" onClick={() => set(val + 1)} className="flex h-7 w-7 items-center justify-center rounded-lg bg-white font-bold">+</button>
    </div>
  );
  const select = (val: string, set: (v: string) => void, placeholder: string) => (
    <select value={val} onChange={(e) => set(e.target.value)} className={`${inp} w-full cursor-pointer`}>
      <option value="">{placeholder}</option>
      {points.map((p) => (
        <option key={p.id} value={p.id}>{tr(p.name)}</option>
      ))}
    </select>
  );
  const leg = ts.mode === "LEG";
  return (
    <>
      <div className="flex flex-wrap items-center justify-end gap-2 px-0.5">
        <div className="inline-flex gap-[3px] rounded-full bg-[oklch(0.95_0.01_200)] p-[3px]">
          {([["DAY", tr("Thuê nguyên ngày")], ["LEG", tr("Chặng 1 chiều")]] as const).map(([k, n]) => (
            <button
              key={k}
              type="button"
              onClick={() => ts.setMode(k)}
              className="rounded-full px-3 py-1.5 text-[13px] font-bold transition"
              style={{ background: ts.mode === k ? "white" : "transparent", color: ts.mode === k ? accent : "oklch(0.42 0.02 160)", boxShadow: ts.mode === k ? "0 1px 3px oklch(0 0 0 / .1)" : "none" }}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-1.5" style={{ gridTemplateColumns: wide ? "1.2fr 1.2fr 1fr 130px 130px auto" : "repeat(auto-fit,minmax(min(100%,150px),1fr))" }}>
        <label className={cell}>
          <span className="text-xs font-semibold text-gray-500">{tr("Điểm đón")}</span>
          {select(ts.fromId, ts.setFromId, tr("Chọn điểm đón"))}
        </label>
        <label className={cell}>
          <span className="text-xs font-semibold text-gray-500">{leg ? tr("Điểm đến") : tr("Điểm muốn đến")}</span>
          {select(ts.toId, ts.setToId, leg ? tr("Chọn điểm đến") : tr("Không bắt buộc"))}
        </label>
        <label className={cell}>
          <span className="text-xs font-semibold text-gray-500">{tr("Ngày")}</span>
          <DateField value={ts.day} onChange={ts.setDay} className={inp} displayClassName="text-[15px] font-semibold text-ink" ariaLabel={tr("Ngày")} />
        </label>
        <div className={cell}>
          <span className="text-xs font-semibold text-gray-500">{tr("Số người")}</span>
          {stepper(ts.people, ts.setPeople)}
        </div>
        <div className={cell}>
          <span className="text-xs font-semibold text-gray-500">{unit}</span>
          {stepper(ts.drivers, ts.setDrivers)}
        </div>
        <button type="button" onClick={onSearch} className="flex items-center justify-center gap-2 whitespace-nowrap rounded-[14px] px-6 py-3.5 text-base font-extrabold text-white transition hover:bg-sunset-500" style={{ background: "oklch(0.68 0.18 45)" }}>
          {tr("Tìm")} →
        </button>
      </div>
      <div className="px-1.5 pb-1 text-[13px] font-semibold" style={{ color: "oklch(0.45 0.1 155)" }}>
        {ts.fromId && ts.toId && ts.fromId === ts.toId ? tr("Điểm đón và điểm đến phải khác nhau.") : hint}{" "}
        {tr("Điểm không có trong danh sách: nhắn tin để được báo giá.")}
      </div>
    </>
  );
}
