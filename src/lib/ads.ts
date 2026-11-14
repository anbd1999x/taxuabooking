/**
 * Google Ads — báo LƯỢT CHUYỂN ĐỔI "Lượt gửi biểu mẫu khách hàng tiềm năng" khi khách gửi yêu cầu
 * đặt THÀNH CÔNG (homestay / cabin / combo / dịch vụ khác). Chạy ở trình duyệt, dùng `gtag` do thẻ
 * Google trong `src/app/layout.tsx` nạp (chỉ có ở production) — không có `gtag` thì bỏ qua.
 */
const LEAD_CONVERSION = "AW-18575295171/E3sHCMPXv7gdEMOFsplF";

export function trackLeadConversion(): void {
  if (typeof window === "undefined") return;
  try {
    const w = window as typeof window & { gtag?: (...args: unknown[]) => void };
    w.gtag?.("event", "conversion", { send_to: LEAD_CONVERSION, value: 1.0, currency: "VND" });
  } catch {
    /* đo lường lỗi không được làm hỏng luồng đặt */
  }
}
