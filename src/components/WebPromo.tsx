"use client";

import { useT } from "@/components/i18n/I18nProvider";

const vnd = (n: number) => new Intl.NumberFormat("vi-VN").format(Math.round(n)) + "đ";

/**
 * Một dòng "nhãn ........ giá" trong bảng tạm tính. `label` truyền chuỗi ĐÃ dịch (tr("…") ở chỗ gọi).
 * `promo` = dòng giảm giá (chữ xanh, có dấu −); amount ≤ 0 ở dòng giảm ⇒ không hiện.
 */
export function PriceLine({
  label,
  amount,
  promo,
  strong,
  className = "text-[13px]",
}: {
  label: string;
  amount: number;
  promo?: boolean;
  strong?: boolean;
  className?: string;
}) {
  const tr = useT();
  if (promo && amount <= 0) return null;
  return (
    <div className={`flex items-start justify-between gap-2 ${className}`}>
      <span className={`min-w-0 ${promo ? "font-semibold text-forest-700" : strong ? "font-bold text-ink" : "text-gray-600"}`}>{label}</span>
      <span className={`whitespace-nowrap font-bold ${promo ? "text-forest-700" : "text-ink"}`}>
        {promo ? "− " : ""}
        {tr(vnd(amount))}
      </span>
    </div>
  );
}
