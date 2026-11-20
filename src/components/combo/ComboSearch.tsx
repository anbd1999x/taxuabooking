"use client";

import { dmy, wdShort } from "@/lib/date-format";
import { useState, type ReactNode } from "react";
import { DateField } from "@/components/DateField";
import { QtyInput } from "@/components/QtyInput";
import { useSearchNav } from "@/components/useSearchNav";
import { useT } from "@/components/i18n/I18nProvider";

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
/** "2026-12-14" → "14/12/2026" (chuẩn dd/mm/yyyy toàn hệ thống). */
function fmtD(key: string): string {
  return dmy(key);
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

export const ROOM_KIND_OPTIONS: { key: string; label: string }[] = [
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

/** Nhóm trường có số thứ tự tròn (theo thiết kế Combo v3: 1 HÀNH TRÌNH · 2 ĐOÀN KHÁCH · 3 NGÂN SÁCH). */
function Group({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex items-center gap-2 text-xs font-extrabold tracking-[0.08em] text-[oklch(0.45_0.06_158)]">
        <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-forest-700 text-[11px] text-white">{n}</span>
        {title}
      </div>
      {children}
    </div>
  );
}

/**
 * Ô tìm combo — theo thiết kế "Combo v3" (claude.ai/design): 3 nhóm trường đánh số + dải lịch trình
 * (Lên xe → Nhận phòng → Xe về · N đêm homestay) + nút "Tìm combo →". Bộ lọc loại phòng / tiện ích của
 * combo gợi ý nằm ở cột lọc bên trái danh sách kết quả (ComboResults); riêng chế độ tự chọn vẫn lọc ở đây.
 */
export function ComboSearch({
  initialFrom = "",
  initialTo = "",
  initialPeople = 2,
  initialKids = [],
  initialPrice = "",
  initialFilters = [],
  initialKind = "all",
  initialOrigin = "",
  origins = [],
  mode = "",
}: {
  /** Chế độ đang xem ("tu-chon" = combo tự chọn) — giữ nguyên khi tìm lại. */
  mode?: string;
  initialFrom?: string;
  initialTo?: string;
  initialPeople?: number;
  /** Tuổi từng trẻ (link cũ không có → mảng rỗng). */
  initialKids?: number[];
  initialPrice?: string;
  initialFilters?: string[];
  initialKind?: string;
  initialOrigin?: string;
  /** Điểm xuất phát đã khai trong bảng giá chặng (server truyền xuống). */
  origins?: string[];
}) {
  const t = useT();
  const { pending, go } = useSearchNav();
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [origin, setOrigin] = useState(initialOrigin);
  const [people, setPeople] = useState(initialPeople); // người lớn
  const [childAges, setChildAges] = useState<number[]>(initialKids); // tuổi từng trẻ
  const [price, setPrice] = useState(initialPrice);
  const [filters, setFilters] = useState<Set<string>>(new Set(initialFilters));
  const [kind, setKind] = useState(initialKind);
  // Combo tự chọn: bộ lọc Loại phòng / Tiện ích nằm trong ô tìm, mặc định THU GỌN.
  const custom = mode === "tu-chon";
  const [showFilters, setShowFilters] = useState(false);
  const activeCount = filters.size + (kind && kind !== "all" ? 1 : 0);

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
    if (childAges.length) p.set("kids", childAges.join("-"));
    if (origin) p.set("origin", origin);
    if (price) p.set("price", price);
    if (filters.size) p.set("f", [...filters].join(","));
    if (kind && kind !== "all") p.set("kind", kind);
    if (mode) p.set("mode", mode);
    go(`/combo?${p.toString()}`);
  }

  // Ô nhập theo thiết kế v3: nền xám xanh nhạt, bo 14px, nhãn 12px, giá trị 16px đậm.
  const cell = "flex min-w-0 flex-col gap-[3px] rounded-[14px] border-[1.5px] border-transparent bg-[oklch(0.965_0.008_180)] px-3.5 py-2.5";
  const lab = "whitespace-nowrap text-xs font-semibold text-[oklch(0.48_0.02_160)]";
  const inp = "w-full min-w-0 border-0 bg-transparent p-0 text-base font-bold text-ink outline-none";
  const chip = (on: boolean) =>
    `whitespace-nowrap rounded-full border px-[13px] py-[7px] text-[13px] font-semibold transition ${
      on ? "border-forest-600 bg-forest-50 text-forest-700" : "border-gray-200 bg-white text-gray-500 hover:border-forest-300"
    }`;

  // ----- Lịch trình: xe chạy ĐÊM ngày đi → sáng hôm sau nhận phòng → ngày về xe chạy về -----
  const bothDates = KEY_RE.test(from) && KEY_RE.test(to);
  const checkIn = KEY_RE.test(from) ? addD(from, 1) : "";
  const nights = bothDates ? diffDays(checkIn, to) : null; // số đêm ở homestay
  // Gợi ý sửa khi chọn sai (thường do khách chọn ngày đi = ngày muốn nhận phòng).
  const suggFrom = KEY_RE.test(from) ? addD(from, -1) : "";
  const suggTo = bothDates && to > from ? to : KEY_RE.test(from) ? addD(from, 1) : "";
  const canQuickFix = suggFrom >= todayKey();
  const dateErr = nights != null && nights <= 0;
  const dayLabel = (prefix: string, key: string) => `${prefix ? t(prefix) + " " : ""}${t(wdShort(key))} ${fmtD(key)}`;
  const plan: { k: string; v: string }[] =
    nights != null && !dateErr
      ? [
          { k: t("Lên xe"), v: dayLabel("Tối", from) },
          { k: t("Nhận phòng"), v: dayLabel("Sáng", checkIn) },
          { k: t("Xe về"), v: dayLabel("", to) },
        ]
      : [];

  const stepBtn = "flex h-7 w-7 flex-none items-center justify-center rounded-[9px] font-extrabold transition";

  return (
    <div className="flex flex-col gap-3.5 rounded-[24px] bg-white p-3.5 text-ink shadow-[0_24px_60px_-28px_oklch(0.2_0.05_200_/.55)] sm:p-[18px]">
      <div className="grid gap-3.5 sm:gap-[18px] min-[1100px]:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,.62fr)]">
        {/* 1 · HÀNH TRÌNH */}
        <Group n={1} title={t("HÀNH TRÌNH")}>
          <div className={`grid grid-cols-2 gap-2 ${origins.length > 0 ? "sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)]" : ""}`}>
            {origins.length > 0 && (
              <label className={`${cell} col-span-2 sm:col-span-1`}>
                <span className={lab}>{t("Điểm đón")}</span>
                <select value={origin} onChange={(e) => setOrigin(e.target.value)} className={inp} style={{ color: origin ? undefined : "oklch(0.55 0.02 160)" }}>
                  <option value="">{t("Chọn điểm đón")}</option>
                  {origins.map((o) => (
                    <option key={o} value={o}>{t(o)}</option>
                  ))}
                  {origin && !origins.includes(origin) && <option value={origin}>{t(origin)}</option>}
                </select>
              </label>
            )}
            <label className={cell}>
              <span className={lab}>{t("Ngày đi (lên xe)")}</span>
              <DateField value={from} min={todayKey()} onChange={setFrom} className={inp} displayClassName="text-base font-bold text-ink" ariaLabel={t("Ngày đi")} />
            </label>
            <label className={cell}>
              <span className={lab}>{t("Ngày về (xe chạy)")}</span>
              <DateField value={to} min={from || todayKey()} onChange={setTo} className={inp} displayClassName="text-base font-bold text-ink" ariaLabel={t("Ngày về")} />
            </label>
          </div>
        </Group>

        {/* 2 · ĐOÀN KHÁCH */}
        <Group n={2} title={t("ĐOÀN KHÁCH")}>
          <div className="grid grid-cols-2 gap-2">
            <div className={cell}>
              <span className={lab}>{t("Người lớn")}</span>
              <span className="flex items-center justify-between gap-1.5">
                <button type="button" aria-label={t("Giảm người lớn")} onClick={() => setPeople(Math.max(1, people - 1))} className={`${stepBtn} border border-[oklch(0.9_0.01_160)] bg-white text-ink hover:bg-forest-50`}>
                  −
                </button>
                <QtyInput
                  min={1}
                  max={20}
                  value={people}
                  onChange={setPeople}
                  className="w-9 border-0 bg-transparent p-0 text-center text-[17px] font-extrabold text-ink outline-none"
                  ariaLabel={t("Người lớn")}
                />
                <button type="button" aria-label={t("Tăng người lớn")} onClick={() => setPeople(Math.min(20, people + 1))} className={`${stepBtn} bg-forest-700 text-white hover:bg-forest-800`}>
                  +
                </button>
              </span>
            </div>
            <div className={cell}>
              <span className={lab}>{t("Trẻ em")}</span>
              <select
                value={childAges.length}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  setChildAges((arr) => Array.from({ length: n }, (_, i) => arr[i] ?? 6));
                }}
                className={inp}
              >
                {Array.from({ length: 11 }, (_, i) => i).map((n) => (
                  <option key={n} value={n}>{n === 0 ? t("Không có") : t("{0} bé", [n])}</option>
                ))}
              </select>
            </div>
          </div>
          {childAges.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 px-1 text-xs font-semibold text-[oklch(0.48_0.02_160)]">
              {t("Tuổi từng bé:")}
              {childAges.map((age, i) => (
                <input
                  key={i}
                  type="number"
                  min={0}
                  max={17}
                  value={age}
                  aria-label={t("Tuổi bé {0}", [i + 1])}
                  onChange={(e) => {
                    const v = Math.max(0, Math.min(17, parseInt(e.target.value || "0", 10) || 0));
                    setChildAges((arr) => arr.map((x, j) => (j === i ? v : x)));
                  }}
                  className="w-12 rounded-lg border border-[oklch(0.9_0.01_160)] bg-white px-1 py-1 text-center text-xs font-bold text-ink outline-none focus:border-forest-500"
                />
              ))}
            </div>
          )}
        </Group>

        {/* 3 · NGÂN SÁCH / KHÁCH */}
        <Group n={3} title={t("NGÂN SÁCH / KHÁCH")}>
          <label className={cell}>
            <span className={lab}>{t("Giá mong muốn")}</span>
            <select value={price} onChange={(e) => setPrice(e.target.value)} className={inp}>
              {PRICE_OPTIONS.map(([v, n]) => (
                <option key={v} value={v}>{t(n)}</option>
              ))}
            </select>
          </label>
        </Group>
      </div>

      {/* Combo tự chọn: bộ lọc loại phòng / tiện ích (thu gọn) — combo gợi ý lọc ở cột trái kết quả. */}
      {custom && (
        <>
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            aria-expanded={showFilters}
            aria-controls="combo-filters"
            className="flex items-center justify-between gap-3 rounded-[12px] border-t border-[oklch(0.94_0.006_160)] px-1.5 pb-1 pt-3 text-left"
          >
            <span className="flex min-w-0 items-center gap-2 text-[13px] font-bold text-[oklch(0.35_0.03_160)]">
              {t("Bộ lọc: loại phòng, tiện ích")}
              {activeCount > 0 && <span className="rounded-full bg-forest-600 px-2 py-0.5 text-[11px] font-extrabold text-white">{activeCount}</span>}
            </span>
            <span className={`flex h-7 w-7 flex-none items-center justify-center rounded-full bg-[oklch(0.955_0.012_200)] text-sm font-extrabold text-ink transition-transform duration-300 ${showFilters ? "rotate-180" : ""}`}>⌄</span>
          </button>
          <div
            id="combo-filters"
            className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${showFilters ? "grid-rows-[1fr] opacity-100" : "-mt-3.5 grid-rows-[0fr] opacity-0"}`}
            aria-hidden={!showFilters}
            inert={!showFilters}
          >
            <div className="overflow-hidden">
              <div className="grid items-center gap-x-4 gap-y-2.5 px-1.5 pb-0.5" style={{ gridTemplateColumns: "auto minmax(0,1fr)" }}>
                <span className="whitespace-nowrap text-[13px] font-bold text-[oklch(0.45_0.02_160)]">{t("Loại phòng")}</span>
                <div className="flex flex-wrap gap-1.5">
                  {ROOM_KIND_OPTIONS.map((o) => (
                    <button key={o.key} type="button" onClick={() => setKind(o.key)} className={chip(kind === o.key)}>
                      {t(o.label)}
                    </button>
                  ))}
                </div>
                <span className="whitespace-nowrap text-[13px] font-bold text-[oklch(0.45_0.02_160)]">{t("Tiện ích")}</span>
                <div className="flex flex-wrap gap-1.5">
                  {COMBO_FILTER_OPTIONS.map((o) => (
                    <button key={o.key} type="button" onClick={() => toggle(o.key)} className={chip(filters.has(o.key))}>
                      {t(o.icon)} {t(o.label)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Dải lịch trình + nút tìm */}
      <div className="grid items-center gap-3 border-t border-[oklch(0.94_0.006_160)] pt-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        {plan.length > 0 ? (
          <div className="flex min-w-0 items-center overflow-x-auto [scrollbar-width:none]">
            {plan.map((p, i) => (
              <div key={p.k} className="flex flex-none items-center">
                <div className="flex flex-col gap-px rounded-xl bg-[oklch(0.965_0.008_180)] px-3 py-1.5">
                  <span className="whitespace-nowrap text-[11px] font-bold text-[oklch(0.5_0.02_160)]">{p.k}</span>
                  <b className="whitespace-nowrap text-sm">{p.v}</b>
                </div>
                {i < plan.length - 1 && (
                  <span className="mx-0.5 h-0.5 w-7 flex-none" style={{ background: "repeating-linear-gradient(90deg, oklch(0.75 0.02 160) 0 4px, transparent 4px 7px)" }} />
                )}
              </div>
            ))}
            <span className="ml-2.5 flex-none whitespace-nowrap rounded-full bg-[oklch(0.95_0.04_155)] px-2.5 py-1 text-xs font-extrabold text-[oklch(0.36_0.1_155)]">
              {t("{0} đêm homestay", [nights!])}
            </span>
          </div>
        ) : (
          <div className="text-[13px] leading-relaxed text-[oklch(0.42_0.03_220)]">
            <b className="text-ink">{t("Ngày đi là đêm bạn lên xe")}</b>{" "}
            {t("— xe chạy xuyên đêm, sáng hôm sau mới tới Tà Xùa nhận phòng. VD: nhận phòng ngày 15, trả ngày 16 → chọn Ngày đi 14 · Ngày về 16")}
          </div>
        )}
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="whitespace-nowrap rounded-2xl bg-sunset-500 px-7 py-[15px] text-center text-base font-extrabold text-white transition hover:bg-sunset-600 active:scale-[0.99] disabled:cursor-wait disabled:opacity-80"
        >
          {t("Tìm combo →")}
        </button>
      </div>

      {dateErr && (
        <div className="flex flex-wrap items-center gap-2 text-[13px] font-bold text-[oklch(0.55_0.19_28)]">
          <span>{t("Chọn vậy chưa có đêm nghỉ nào — muốn nhận phòng {0} hãy chọn Ngày đi {1} · Ngày về {2}", [fmtD(from), fmtD(suggFrom), fmtD(suggTo)])}</span>
          {canQuickFix && (
            <button
              type="button"
              onClick={() => { setFrom(suggFrom); setTo(suggTo); }}
              className="rounded-full bg-red-600 px-3 py-1 text-xs font-bold text-white hover:bg-red-700"
            >
              {t("Sửa giúp tôi →")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
