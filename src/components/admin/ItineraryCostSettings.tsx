"use client";

import type { ItCost, Transport } from "@/lib/itinerary";

/** Mục "Bảng giá xe & phòng" ở /admin/itinerary: giá dùng tính phần combo trên trang /lich-trinh. */

const INPUT = "min-w-0 rounded-[10px] border-[1.5px] border-gray-200 bg-white px-2.5 py-2 text-sm focus:border-forest-500 focus:outline-none";
const ICON_BTN = "flex h-[30px] w-[28px] flex-none items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-30";
const CARD = "flex flex-col gap-2.5 rounded-[18px] border border-gray-200 bg-white p-4";
const LBL = "flex flex-col gap-1 text-xs font-bold text-gray-500";

export function MoneyInput({ value, onChange, className = "" }: { value: number; onChange: (n: number) => void; className?: string }) {
  return (
    <div className={`relative ${className}`}>
      <input
        value={value ? value.toLocaleString("vi-VN") : ""}
        inputMode="numeric"
        placeholder="0"
        onChange={(e) => onChange(Math.min(50_000_000, Number(e.target.value.replace(/\D/g, "")) || 0))}
        className={`${INPUT} w-full pr-6 text-right font-bold`}
      />
      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">đ</span>
    </div>
  );
}

export function ItineraryCostSettings({ cost, onChange }: { cost: ItCost; onChange: (fn: (c: ItCost) => void) => void }) {
  const small = (v: number, set: (n: number) => void) => (
    <input type="number" min={1} max={10} value={v} onChange={(e) => set(Math.max(1, Math.min(10, Math.round(Number(e.target.value) || 1))))} className={`${INPUT} w-20 font-bold`} />
  );
  return (
    <>
      <p className="text-[13px] text-gray-500">
        Phần <b>“Trong combo”</b> trên trang lịch trình = giá xe khứ hồi × số người + giá phòng × số phòng × số đêm. Giá từng điểm (ăn uống, vé, xe máy) nhập ở mục <b>Lịch trình &amp; giá từng điểm</b>.
      </p>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className={CARD}>
          <div className="text-[15px] font-extrabold text-ink">Xe khứ hồi / người</div>
          <div className="text-xs font-bold text-gray-500">Hạng cabin (hạng đầu tiên là mặc định)</div>
          {cost.cabinTiers.map((t, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <input value={t.name} maxLength={40} onChange={(e) => onChange((c) => { c.cabinTiers[i].name = e.target.value; })} placeholder="Tên hạng, VD: Tiêu chuẩn" className={`${INPUT} flex-1`} />
              <MoneyInput value={t.price} onChange={(n) => onChange((c) => { c.cabinTiers[i].price = n; })} className="w-[130px]" />
              <button type="button" disabled={cost.cabinTiers.length <= 1} onClick={() => onChange((c) => { c.cabinTiers.splice(i, 1); })} className={`${ICON_BTN} font-extrabold !text-red-600`}>✕</button>
            </div>
          ))}
          {cost.cabinTiers.length < 4 && (
            <button type="button" onClick={() => onChange((c) => { c.cabinTiers.push({ name: "", price: 0 }); })} className="self-start whitespace-nowrap rounded-full border-[1.5px] border-dashed border-gray-300 px-3 py-1.5 text-[13px] font-bold text-gray-700 hover:bg-gray-50">
              + Thêm hạng cabin
            </button>
          )}
          <label className={LBL}>Limousine khứ hồi / người
            <MoneyInput value={cost.limoPrice} onChange={(n) => onChange((c) => { c.limoPrice = n; })} className="w-[160px]" />
          </label>
        </div>

        <div className={CARD}>
          <div className="text-[15px] font-extrabold text-ink">Phòng homestay / đêm</div>
          <div className="flex flex-wrap gap-3">
            <label className={LBL}>Trong tuần
              <MoneyInput value={cost.roomWd} onChange={(n) => onChange((c) => { c.roomWd = n; })} className="w-[150px]" />
            </label>
            <label className={LBL}>Cuối tuần
              <MoneyInput value={cost.roomWe} onChange={(n) => onChange((c) => { c.roomWe = n; })} className="w-[150px]" />
            </label>
          </div>
          <div className="flex flex-wrap gap-3">
            <label className={LBL}>Số người / phòng{small(cost.perRoom, (n) => onChange((c) => { c.perRoom = n; }))}</label>
            <label className={LBL}>Số người / xe máy{small(cost.perBike, (n) => onChange((c) => { c.perBike = n; }))}</label>
          </div>
          <p className="text-xs text-gray-500">Số xe máy dùng để nhân các mục tính “mỗi xe máy” (thuê xe, xăng, gửi xe).</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {(["cabin", "limo"] as Transport[]).map((k) => {
          const t = cost.transports[k];
          return (
            <div key={k} className={CARD}>
              <div className="text-[15px] font-extrabold text-ink">Thẻ cách đi: {k === "cabin" ? "xe cabin" : "limousine"}</div>
              <label className={LBL}>Tên hiển thị
                <input value={t.name} maxLength={40} onChange={(e) => onChange((c) => { c.transports[k].name = e.target.value; })} className={`${INPUT} font-semibold`} />
              </label>
              <label className={LBL}>Giờ đi / tới
                <input value={t.when} maxLength={100} onChange={(e) => onChange((c) => { c.transports[k].when = e.target.value; })} className={INPUT} />
              </label>
              <label className={LBL}>Điểm nổi bật (mỗi dòng một ý, tối đa 5)
                <textarea
                  value={t.tags.join("\n")}
                  rows={3}
                  onChange={(e) => onChange((c) => { c.transports[k].tags = e.target.value.split("\n").map((x) => x.slice(0, 40)).slice(0, 5); })}
                  className={`${INPUT} resize-y`}
                />
              </label>
            </div>
          );
        })}
      </div>

      <div className={CARD}>
        <label className={LBL}>Ghi chú cuối lịch trình (giá tham khảo…)
          <textarea value={cost.note} maxLength={400} rows={2} onChange={(e) => onChange((c) => { c.note = e.target.value; })} className={`${INPUT} resize-y`} />
        </label>
      </div>
    </>
  );
}
