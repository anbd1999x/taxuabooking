"use client";

import { useState } from "react";
import { CATEGORY_LIST } from "@/lib/constants";
import { DateField } from "@/components/DateField";
import { QtyInput } from "@/components/QtyInput";
import { useSearchNav } from "@/components/useSearchNav";
import { useT } from "@/components/i18n/I18nProvider";

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

// Các tỉnh đón khách đi Tà Xùa (fallback khi chưa khai bảng giá chặng — khớp trang xe cabin).
const FROMS = ["Hà Nội", "Bắc Ninh", "Bắc Giang", "Thái Nguyên", "Vĩnh Phúc", "Hưng Yên", "Hải Dương", "Hải Phòng", "Nam Định", "Ninh Bình", "Hà Nam", "Phú Thọ"];

export function HeroSearch({
  comboOrigins = [],
}: {
  /** Điểm xuất phát đã khai trong bảng giá chặng (server truyền xuống, cho tab Combo). */
  comboOrigins?: string[];
}) {
  const t = useT();
  const { pending, go } = useSearchNav();
  const [slug, setSlug] = useState(CATEGORY_LIST[0].slug);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [qty, setQty] = useState(2);
  const [pickup, setPickup] = useState("Hà Nội");
  const [origin, setOrigin] = useState("");

  // Điểm đón xe cabin: theo bảng giá chặng (chọn đâu cũng có giá đúng); chưa khai → FROMS.
  const pickupOpts = comboOrigins.length
    ? (comboOrigins.includes("Hà Nội") ? comboOrigins : ["Hà Nội", ...comboOrigins])
    : FROMS;

  const cat = CATEGORY_LIST.find((c) => c.slug === slug)!;
  const kind = cat.availabilityKind;
  const isTrip = kind === "trip";
  const isCombo = cat.key === "COMBO";
  const needsRange = kind === "stay" || kind === "rental";
  const showReturn = needsRange || isTrip; // xe cabin: cho chọn ngày về (tuỳ chọn)
  const fromLabel = isTrip || isCombo ? t("Ngày đi") : kind === "transport" ? t("Ngày") : needsRange ? t("Nhận") : t("Ngày");
  const toLabel = isTrip || isCombo ? t("Ngày về") : t("Trả");
  const qtyLabel = kind === "stay" ? t("Số khách") : kind === "rental" ? t("Số xe") : t("Số khách");

  function submit() {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to && showReturn) params.set("to", to);
    if (isTrip && pickup && pickup !== "Hà Nội") params.set("pickup", pickup);
    if (isCombo && qty !== 2) params.set("people", String(qty));
    if (isCombo && origin) params.set("origin", origin);
    if (cat.key === "HOMESTAY") params.set("people", String(qty)); // lọc phòng đủ chỗ cho đoàn
    const qs = params.toString();
    go(`/${slug}${qs ? `?${qs}` : ""}`);
  }

  const cell = "rounded-2xl bg-[oklch(0.965_0.01_150)] px-4 py-3 transition hover:bg-[oklch(0.94_0.02_150)]";

  return (
    <div className="rounded-[22px] bg-white p-2.5 shadow-[0_24px_60px_-20px_rgba(30,70,45,0.35)]">
      {/* Tabs danh mục */}
      <div className="flex gap-1 overflow-x-auto px-1 pb-2.5 pt-1">
        {CATEGORY_LIST.map((c) => (
          <button
            key={c.slug}
            type="button"
            onClick={() => setSlug(c.slug)}
            className={`flex-none rounded-full px-4 py-2 text-sm font-semibold transition ${
              c.slug === slug ? "bg-forest-700 text-white" : "text-gray-500 hover:bg-forest-50"
            }`}
          >
            {t(c.shortLabel)}
          </button>
        ))}
      </div>

      {/* Trường nhập */}
      <div className="grid gap-1.5 sm:grid-cols-[repeat(auto-fit,minmax(150px,1fr))]">
        {isTrip && (
          <label className={cell}>
            <span className="block text-xs font-medium text-gray-500">{t("Điểm đón")}</span>
            <select value={pickup} onChange={(e) => setPickup(e.target.value)} className="mt-0.5 w-full bg-transparent text-[15px] font-bold text-ink outline-none">
              {pickupOpts.map((f) => <option key={f} value={f}>{t(f)}</option>)}
            </select>
          </label>
        )}
        {isCombo && comboOrigins.length > 0 && (
          <label className={cell}>
            <span className="block text-xs font-medium text-gray-500">{t("Điểm xuất phát")}</span>
            <select value={origin} onChange={(e) => setOrigin(e.target.value)} className="mt-0.5 w-full bg-transparent text-[15px] font-bold text-ink outline-none">
              <option value="">{t("Chọn điểm đón")}</option>
              {comboOrigins.map((o) => <option key={o} value={o}>{t(o)}</option>)}
            </select>
          </label>
        )}
        <label className={cell}>
          <span className="block text-xs font-medium text-gray-500">{t(fromLabel)}</span>
          <DateField value={from} min={todayKey()} onChange={setFrom} className="mt-0.5 w-full bg-transparent text-[15px] font-bold text-ink outline-none" displayClassName="text-[15px] font-bold text-ink" ariaLabel={t(fromLabel)} />
        </label>
        {showReturn && (
          <label className={cell}>
            <span className="block text-xs font-medium text-gray-500">{t(toLabel)}{isTrip ? t(" (tuỳ chọn)") : ""}</span>
            <DateField value={to} min={from || todayKey()} onChange={setTo} className="mt-0.5 w-full bg-transparent text-[15px] font-bold text-ink outline-none" displayClassName="text-[15px] font-bold text-ink" ariaLabel={t(toLabel)} />
          </label>
        )}
        {!isTrip && (
          <label className={cell}>
            <span className="block text-xs font-medium text-gray-500">{t(qtyLabel)}</span>
            <QtyInput min={1} max={20} value={qty} onChange={setQty} className="mt-0.5 w-full bg-transparent text-[15px] font-bold text-ink outline-none" ariaLabel={t(qtyLabel)} />
          </label>
        )}
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="flex items-center justify-center gap-2 rounded-2xl bg-sunset-500 px-5 py-4 text-base font-bold text-white transition hover:bg-sunset-600 active:scale-[0.98] disabled:cursor-wait disabled:opacity-80"
        >
          {t("Xem chỗ trống")}{" "}<span>→</span>
        </button>
      </div>
    </div>
  );
}
