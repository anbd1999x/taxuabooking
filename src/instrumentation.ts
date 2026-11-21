/**
 * Chạy 1 lần khi server Next.js khởi động (Node runtime). Dùng để bật BỘ HẸN GIỜ NỀN
 * trong app — không cần crontab trên VPS.
 *
 * Nhắc lịch đơn (Web Push: lên xe / xe về / nhận phòng thu tiền / checkout): mỗi 5 phút
 * kiểm tra các mốc đến hạn (src/lib/booking-reminders.ts). Nhiều bản app chạy song song
 * vẫn chỉ gửi 1 lần nhờ khoá PostgreSQL + bảng BookingReminder.
 *
 * Cùng nhịp 5 phút: tự huỷ đơn "Mới/Đang liên hệ" quá 6 giờ chưa ghi nhận thanh toán.
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
  const { cancelExpiredUnpaidBookingsLocked } = await import("./lib/booking-auto-cancel");
  const BILL_CLEANUP_MS = 6 * 60 * 60_000;
  let lastBillCleanup = 0; // 0 ⇒ lượt đầu (sau 1 phút) dọn luôn
  const ROAD_WARM_MS = 30 * 60_000;
  let lastRoadWarm = 0;
  const IMG_INDEX_MS = 10 * 60_000;
  let lastImgIndex = 0;
  const tick = async () => {
    // Tự huỷ đơn chờ quá 6 giờ chưa ghi nhận thanh toán (src/lib/booking-auto-cancel.ts).
    try {
      const cancelled = await cancelExpiredUnpaidBookingsLocked();
      if (cancelled && cancelled.length) console.log("[auto-cancel] quá hạn thanh toán:", cancelled.join(", "));
      // Đơn xe máy / combo có xe máy vừa bị tự huỷ ⇒ nhả xe trong đội xe ngay.
      if (cancelled && cancelled.length) {
        const { prisma } = await import("./lib/prisma");
        const { syncFleetForBooking } = await import("./lib/fleet");
        const ids = await prisma.bookingRequest.findMany({ where: { code: { in: cancelled } }, select: { id: true } });
        for (const b of ids) await syncFleetForBooking(b.id).catch(() => {});
        // Đơn homestay / combo chủ nhà đã "xác nhận còn phòng" mà bị tự huỷ ⇒ nhả ô giữ hộ ở Quản lý phòng.
        const { syncStaysForBooking } = await import("./lib/stay");
        for (const b of ids) await syncStaysForBooking(b.id).catch(() => {});
      }
    } catch (err) {
      console.error("[auto-cancel] lỗi", err);
    }
    // Đội xe: tự nhả xe của lượt thuê tạo tay quá hạn chưa cọc (Cài đặt → "Tự nhả xe nếu chưa cọc sau").
    try {
      const { releaseExpiredHolds } = await import("./lib/fleet");
      const n = await releaseExpiredHolds();
      if (n) console.log("[fleet] tự nhả xe chưa cọc:", n);
    } catch (err) {
      console.error("[fleet] lỗi nhả xe", err);
    }
    // Quản lý phòng: tự nhả giữ chỗ chưa cọc quá hạn (Cài đặt → "Giữ chỗ chưa cọc").
    try {
      const { releaseExpiredStayHolds } = await import("./lib/stay");
      const n = await releaseExpiredStayHolds();
      if (n) console.log("[stay] tự nhả giữ chỗ chưa cọc:", n);
    } catch (err) {
      console.error("[stay] lỗi nhả giữ chỗ", err);
    }
    // Vé & đặt bàn: đơn chờ thu tiền quá hạn giữ chỗ ⇒ huỷ + nhả ghế / bàn.
    try {
      const { releaseExpiredTicketHolds } = await import("./lib/ticket");
      const n = await releaseExpiredTicketHolds();
      if (n) console.log("[ticket] tự huỷ đơn hết hạn giữ chỗ:", n);
    } catch (err) {
      console.error("[ticket] lỗi nhả chỗ", err);
    }
    // Gọi món QR: xoá ảnh bill chuyển khoản cũ hơn 30 ngày — chạy thưa (6 giờ/lần) theo nhịp 5 phút này.
    if (Date.now() - lastBillCleanup >= BILL_CLEANUP_MS) {
      lastBillCleanup = Date.now();
      try {
        const { cleanupOldDineProofs } = await import("./lib/dine-proof");
        const n = await cleanupOldDineProofs();
        if (n) console.log("[dine] xoá ảnh bill cũ:", n);
      } catch (err) {
        console.error("[dine] lỗi xoá ảnh bill", err);
      }
    }
    // Popup "Xung quanh có gì?": tính sẵn quãng đường xe chạy (homestay → điểm) 30 phút/lần, không chặn nhịp này.
    // Mốc SiteSetting `roadWarmAt` để 2 bản app không cùng chạy.
    if (Date.now() - lastRoadWarm >= ROAD_WARM_MS) {
      lastRoadWarm = Date.now();
      void (async () => {
        try {
          const { prisma } = await import("./lib/prisma");
          const row = await prisma.siteSetting.findUnique({ where: { key: "roadWarmAt" } });
          if (row && Date.now() - Number(row.value) < ROAD_WARM_MS - 60_000) return;
          await prisma.siteSetting.upsert({ where: { key: "roadWarmAt" }, create: { key: "roadWarmAt", value: String(Date.now()) }, update: { value: String(Date.now()) } });
          const { warmRoadCache } = await import("./lib/road-distance");
          await warmRoadCache({ routes: 150, log: (m) => console.log(m) });
        } catch (err) {
          console.error("[road-cache] lỗi", err);
        }
      })();
    }
    // Tìm homestay theo ảnh: tính vector CLIP cho ảnh homestay mới đăng (container embedder), 10 phút/lần.
    // Mốc SiteSetting `imgIndexAt` để 2 bản app không cùng chạy. Embedder không chạy ⇒ bỏ qua êm.
    if (Date.now() - lastImgIndex >= IMG_INDEX_MS) {
      lastImgIndex = Date.now();
      void (async () => {
        try {
          const { prisma } = await import("./lib/prisma");
          const row = await prisma.siteSetting.findUnique({ where: { key: "imgIndexAt" } });
          if (row && Date.now() - Number(row.value) < IMG_INDEX_MS - 60_000) return;
          await prisma.siteSetting.upsert({ where: { key: "imgIndexAt" }, create: { key: "imgIndexAt", value: String(Date.now()) }, update: { value: String(Date.now()) } });
          const { indexImageEmbeddings } = await import("./lib/image-search");
          await indexImageEmbeddings({ limit: 400, log: (m) => console.log(m) });
        } catch (err) {
          console.error("[img-index] lỗi", err);
        }
      })();
    }
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
