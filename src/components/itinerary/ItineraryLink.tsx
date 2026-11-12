import Link from "next/link";

/**
 * Link sang trang Lịch trình Tà Xùa đúng theo số đêm khách đang chọn (1 đêm → lịch trình 2 ngày 1 đêm…).
 * Trang /lich-trinh đọc ?ngay= để mở sẵn lịch trình có số ngày khớp (hoặc gần nhất). Mở tab mới để
 * khách không mất lựa chọn đang đặt dở.
 */
export function ItineraryLink({ nights, className }: { nights: number; className?: string }) {
  if (!Number.isFinite(nights) || nights < 1) return null;
  const days = nights + 1;
  return (
    <Link
      href={`/lich-trinh?ngay=${days}`}
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
      Xem lịch trình gợi ý {days} ngày {nights} đêm →
    </Link>
  );
}
