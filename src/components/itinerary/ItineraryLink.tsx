"use client";

import Link from "@/components/Link";
import { useT } from "@/components/i18n/I18nProvider";

/** Tiền khách ĐANG CHỌN ở trang đặt — trang /lich-trinh dùng đúng số này thay cho bảng giá chung. */
export interface ItineraryCostLink {
  roomTotal: number | null; // tổng tiền phòng cả kỳ (gồm phụ thu ở ghép); null / 0 = chưa có giá ⇒ chỉ mở theo số ngày
  rooms: number; // số phòng đang chọn
  pax: number; // số khách
  /** Đặt combo: vé xe khứ hồi đang chọn (tổng cả đoàn). Không có = chỉ đặt phòng ⇒ tự túc xe, không tính tiền xe. */
  bus?: { transport: "cabin" | "limo"; total: number } | null;
  discount?: number; // giảm combo cả đoàn
}

/** Dựng URL /lich-trinh?ngay=…&phong=…&sophong=…&khach=…&xe=…&ve=…&giam=… */
export function itineraryHref(nights: number, cost?: ItineraryCostLink): string {
  const q = new URLSearchParams({ ngay: String(nights + 1) });
  if (cost && cost.roomTotal && cost.roomTotal > 0) {
    q.set("phong", String(Math.round(cost.roomTotal)));
    q.set("sophong", String(Math.max(1, cost.rooms)));
    q.set("khach", String(Math.max(1, cost.pax)));
    if (cost.bus) {
      q.set("xe", cost.bus.transport);
      q.set("ve", String(Math.round(cost.bus.total)));
      if (cost.discount) q.set("giam", String(Math.round(cost.discount)));
    } else q.set("xe", "none");
  }
  return `/lich-trinh?${q}`;
}

/**
 * Link "Tham khảo lịch trình & chi phí" đúng theo số đêm khách đang chọn (1 đêm → lịch trình 2 ngày 1 đêm…),
 * kèm tiền phòng / vé xe đang chọn để phần dự trù tính đúng (chỉ đặt phòng ⇒ không tính tiền xe).
 * Mở tab mới để khách không mất lựa chọn đang đặt dở.
 */
export function ItineraryLink({ nights, className, cost }: { nights: number; className?: string; cost?: ItineraryCostLink }) {
  const t = useT();
  if (!Number.isFinite(nights) || nights < 1) return null;
  const days = nights + 1;
  return (
    <Link
      href={itineraryHref(nights, cost)}
      target="_blank"
      className={
        className ??
        "flex items-center justify-center gap-1.5 text-center text-xs font-semibold text-forest-700 transition hover:text-forest-900"
      }
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M9 18l-6 3V6l6-3 6 3 6-3v15l-6 3-6-3z" />
        <path d="M9 3v15M15 6v15" />
      </svg>
      {t("Tham khảo lịch trình & chi phí {0} ngày {1} đêm →", [days, nights])}
    </Link>
  );
}
