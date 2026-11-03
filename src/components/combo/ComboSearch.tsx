"use client";

import { useState } from "react";
import { DateField } from "@/components/DateField";
import { QtyInput } from "@/components/QtyInput";
import { useSearchNav } from "@/components/useSearchNav";

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

const KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
/** Cộng n ngày vào key yyyy-mm-dd. */
function addD(key: string, n: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}
/** "2026-12-14" → "14/12" cho dễ đọc. */
function fmtD(key: string): string {
  const [, m, d] = key.split("-");
  return `${d}/${m}`;
}
/** Số đêm giữa 2 key (b − a). */
function diffDays(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
}

export const COMBO_FILTER_OPTIONS: { key: string; label: string; icon: string }[] = [
  { key: "cloudView", label: "View săn mây", icon: "⛅" },
  { key: "bathtub", label: "Bồn tắm", icon: "🛁" },
  { key: "breakfast", label: "Ăn sáng", icon: "🍳" },
  { key: "airCon", label: "Điều hòa", icon: "❄️" },
  { key: "heating", label: "Đêm sưởi", icon: "🔥" },
  { key: "pool", label: "Hồ bơi", icon: "🏊" },
  { key: "easyRoad", label: "Đường dễ đi", icon: "🛣️" },
];

const ROOM_KIND_OPTIONS: { key: string; label: string }[] = [
  { key: "all", label: "Mọi loại phòng" },
  { key: "single", label: "Phòng đơn" },
  { key: "double", label: "Phòng đôi" },
  { key: "dorm", label: "Phòng tập thể" },
];

/** Mức giá mỗi khách: "ltX" = dưới X, "gtX" = trên X; "" = không lọc. */
const PRICE_OPTIONS: [string, string][] = [
  ["", "Mọi mức giá"],
  ["lt800000", "Dưới 800k"],
  ["lt900000", "Dưới 900k"],
  ["lt1000000", "Dưới 1.000k"],
  ["lt1100000", "Dưới 1.100k"],
  ["lt1200000", "Dưới 1.200k"],
  ["lt1500000", "Dưới 1.500k"],
  ["lt2000000", "Dưới 2.000k"],
  ["gt2000000", "Trên 2.000k"],
];

export function ComboSearch({
  initialFrom = "",
  initialTo = "",
  initialPeople = 2,
  initialPrice = "",
  initialFilters = [],
  initialKind = "all",
  initialOrigin = "",
  origins = [],
}: {
  initialFrom?: string;
  initialTo?: string;
  initialPeople?: number;
  initialPrice?: string;
  initialFilters?: string[];
  initialKind?: string;
  initialOrigin?: string;
  /** Điểm xuất phát đã khai trong bảng giá chặng (server truyền xuống). */
  origins?: string[];
}) {
  const { pending, go } = useSearchNav();
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [origin, setOrigin] = useState(initialOrigin);
  const [people, setPeople] = useState(initialPeople);
  const [price, setPrice] = useState(initialPrice);
  const [filters, setFilters] = useState<Set<string>>(new Set(initialFilters));
  const [kind, setKind] = useState(initialKind);

  function toggle(key: string) {
    setFilters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function submit() {
    const p = new URLSearchParams();
    p.set("from", from || todayKey());
    p.set("to", to || "");
    p.set("people", String(Math.max(1, people)));
    if (origin) p.set("origin", origin);
    if (price) p.set("price", price);
    if (filters.size) p.set("f", [...filters].join(","));
    if (kind && kind !== "all") p.set("kind", kind);
    go(`/combo?${p.toString()}`);
  }

  // Theo thiết kế Combo v2: ô nhập nền xám nhạt bo 14px, nhãn 12px.
  const cell = "flex min-w-0 flex-col gap-0.5 rounded-[14px] bg-[oklch(0.965_0.01_200)] px-3.5 py-2.5";
  const lab = "whitespace-nowrap text-xs font-semibold text-[oklch(0.48_0.02_160)]";
  const inp = "w-full min-w-0 border-0 bg-transparent p-0 pt-0.5 text-[15px] font-bold text-ink outline-none";
  const chip = (on: boolean) =>
    `whitespace-nowrap rounded-full border px-[13px] py-[7px] text-[13px] font-semibold transition ${
      on ? "border-forest-600 bg-forest-50 text-forest-700" : "border-gray-200 bg-white text-gray-500 hover:border-forest-300"
    }`;

  // ----- Ghi chú ngày cho dễ hiểu: xe chạy ĐÊM ngày đi → sáng hôm sau nhận phòng -----
  // VD khách muốn nhận phòng 15, trả 16 thì phải chọn Ngày đi 14, Ngày về 16.
  const bothDates = KEY_RE.test(from) && KEY_RE.test(to);
  const checkIn = KEY_RE.test(from) ? addD(from, 1) : "";
  const nights = bothDates ? diffDays(checkIn, to) : null; // số đêm ở homestay
  // Gợi ý sửa khi chọn sai (thường do khách chọn ngày đi = ngày muốn nhận phòng).
  const suggFrom = KEY_RE.test(from) ? addD(from, -1) : "";
  const suggTo = bothDates && to > from ? to : KEY_RE.test(from) ? addD(from, 1) : "";
  const canQuickFix = suggFrom >= todayKey();
  const dateErr = nights != null && nights <= 0;

  return (
    <div
      className="flex flex-col gap-3 rounded-[22px] border border-white/80 p-3 shadow-[0_24px_60px_-24px_oklch(0.25_0.06_220_/.45)]"
      style={{ background: "oklch(1 0 0 / .92)", backdropFilter: "blur(14px)" }}
    >
      <div className="grid gap-1.5" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,170px),1fr))" }}>
        {origins.length > 0 && (
          <label className={cell}>
            <span className={lab}>Điểm xuất phát</span>
            <select value={origin} onChange={(e) => setOrigin(e.target.value)} className={inp}>
              <option value="">Chọn điểm đón</option>
              {origins.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
              {origin && !origins.includes(origin) && <option value={origin}>{origin}</option>}
            </select>
          </label>
        )}
        <label className={cell}>
          <span className={lab}>Ngày đi (lên xe)</span>
          <DateField value={from} min={todayKey()} onChange={setFrom} className={inp} displayClassName="text-[15px] font-bold text-ink" ariaLabel="Ngày đi" />
        </label>
        <label className={cell}>
          <span className={lab}>Ngày về (xe chạy về)</span>
          <DateField value={to} min={from || todayKey()} onChange={setTo} className={inp} displayClassName="text-[15px] font-bold text-ink" ariaLabel="Ngày về" />
        </label>
        <div className={cell}>
          <span className={lab}>Số người</span>
          <div className="flex items-center gap-2.5 pt-0.5">
            <button
              type="button"
              aria-label="Giảm số người"
              onClick={() => setPeople(Math.max(1, people - 1))}
              className="flex h-[26px] w-[26px] flex-none items-center justify-center rounded-lg bg-white font-bold text-ink shadow-sm transition hover:bg-forest-50"
            >
              −
            </button>
            <QtyInput
              min={1}
              max={20}
              value={people}
              onChange={setPeople}
              className="w-10 border-0 bg-transparent p-0 text-center text-[15px] font-extrabold text-ink outline-none"
              ariaLabel="Số người"
            />
            <button
              type="button"
              aria-label="Tăng số người"
              onClick={() => setPeople(Math.min(20, people + 1))}
              className="flex h-[26px] w-[26px] flex-none items-center justify-center rounded-lg bg-white font-bold text-ink shadow-sm transition hover:bg-forest-50"
            >
              +
            </button>
          </div>
        </div>
        <label className={cell}>
          <span className={lab}>Giá mong muốn / khách</span>
          <select value={price} onChange={(e) => setPrice(e.target.value)} className={inp}>
            {PRICE_OPTIONS.map(([v, n]) => (
              <option key={v} value={v}>{n}</option>
            ))}
          </select>
        </label>
      </div>

      {/* Dòng lịch trình gọn (chấm cam) — lỗi ngày hiện đỏ kèm nút sửa nhanh */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-1.5 text-[13px] leading-relaxed text-[oklch(0.42_0.03_220)]">
        <span className="h-1.5 w-1.5 flex-none rounded-full bg-sunset-500" />
        {nights != null && !dateErr ? (
          <span>
            Lên xe <b className="text-ink">tối {fmtD(from)}</b> → nhận phòng <b className="text-ink">sáng {fmtD(checkIn)}</b> → trả phòng
            &amp; xe chạy về <b className="text-ink">ngày {fmtD(to)}</b> · <b className="text-ink">{nights} đêm homestay</b>
          </span>
        ) : (
          <span>
            <b className="text-ink">Ngày đi là đêm bạn lên xe</b> — xe chạy xuyên đêm, sáng hôm sau mới tới Tà Xùa nhận phòng.
            VD: nhận phòng ngày 15, trả ngày 16 → chọn Ngày đi 14 · Ngày về 16
          </span>
        )}
        {dateErr && (
          <span className="font-bold text-[oklch(0.55_0.19_28)]">
            · Chọn vậy chưa có đêm nghỉ nào — muốn nhận phòng {fmtD(from)} hãy chọn Ngày đi {fmtD(suggFrom)} · Ngày về {fmtD(suggTo)}
          </span>
        )}
        {dateErr && canQuickFix && (
          <button
            type="button"
            onClick={() => { setFrom(suggFrom); setTo(suggTo); }}
            className="rounded-full bg-red-600 px-3 py-1 text-xs font-bold text-white hover:bg-red-700"
          >
            Sửa giúp tôi →
          </button>
        )}
      </div>

      <div className="mx-1 h-px bg-[oklch(0.92_0.01_200)]" />

      {/* Bộ lọc: nhãn trái + chip phải (theo thiết kế) */}
      <div className="grid items-center gap-x-4 gap-y-2.5 px-1.5" style={{ gridTemplateColumns: "auto minmax(0,1fr)" }}>
        <span className="whitespace-nowrap text-[13px] font-bold text-[oklch(0.45_0.02_160)]">Loại phòng</span>
        <div className="flex flex-wrap gap-1.5">
          {ROOM_KIND_OPTIONS.map((o) => (
            <button key={o.key} type="button" onClick={() => setKind(o.key)} className={chip(kind === o.key)}>
              {o.label}
            </button>
          ))}
        </div>
        <span className="whitespace-nowrap text-[13px] font-bold text-[oklch(0.45_0.02_160)]">Tiện ích</span>
        <div className="flex flex-wrap gap-1.5">
          {COMBO_FILTER_OPTIONS.map((o) => (
            <button key={o.key} type="button" onClick={() => toggle(o.key)} className={chip(filters.has(o.key))}>
              {o.icon} {o.label}
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={submit}
        disabled={pending}
        className="flex w-full items-center justify-center gap-2 rounded-[14px] bg-sunset-500 px-6 py-3.5 text-base font-extrabold text-white transition hover:bg-sunset-600 active:scale-[0.99] disabled:cursor-wait disabled:opacity-80"
      >
        Tìm combo khớp giá <span>→</span>
      </button>
    </div>
  );
}
