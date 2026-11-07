/**
 * Chạy 1 lần khi server Next.js khởi động (Node runtime). Dùng để bật BỘ HẸN GIỜ NỀN
 * trong app — không cần crontab trên VPS.
 *
 * Nhắc lịch đơn (Web Push: lên xe / xe về / nhận phòng thu tiền / checkout): mỗi 5 phút
 * kiểm tra các mốc đến hạn (src/lib/booking-reminders.ts). Nhiều bản app chạy song song
 * vẫn chỉ gửi 1 lần nhờ khoá PostgreSQL + bảng BookingReminder.
 *
 * Chỉ bật ở production (dev local đang trỏ DB production — không để máy dev bắn thông báo).
 * Tắt khẩn cấp: đặt env REMINDERS_DISABLED=1.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NODE_ENV !== "production" || process.env.REMINDERS_DISABLED === "1") return;

  const g = globalThis as typeof globalThis & { __taxuaReminderTimer?: ReturnType<typeof setInterval> };
  if (g.__taxuaReminderTimer) return; // đã bật (tránh bật trùng khi module nạp lại)

  const { runBookingRemindersLocked } = await import("./lib/booking-reminders");
  const tick = async () => {
    try {
      const res = await runBookingRemindersLocked();
      if (res && res.length) {
        console.log(
          "[reminders]",
          res.map((r) => `${r.kind}: ${r.bookings.length} đơn → ${r.sent} thiết bị`).join(" | "),
        );
      }
    } catch (err) {
      console.error("[reminders] lỗi", err);
    }
  };

  const EVERY_MS = 5 * 60_000;
  // Lượt đầu sau 1 phút (đợi app khởi động xong), rồi mỗi 5 phút.
  setTimeout(tick, 60_000);
  g.__taxuaReminderTimer = setInterval(tick, EVERY_MS);
}
