import "server-only";
import type { BookingRequest, BookingStatus, ServiceCategory } from "@prisma/client";
import { prisma } from "./prisma";
import { pushToAdmins } from "./push";
import { addDays, parseDateOnly } from "./dates";
import { toNumber, formatPrice } from "./format";

/**
 * NHẮC LỊCH ĐƠN qua Web Push tới admin, theo giờ Việt Nam.
 *
 * Xe cabin (đặt xe riêng):
 *   - 09:00 ngày đi   → hôm nay có khách đặt xe đi
 *   - 21:00 ngày đi   → khách lên xe tối nay
 *   - 11:00 ngày về   → hôm nay có khách đặt xe về
 * Combo (xe đêm + homestay; ngày đi = đêm lên xe = nhận phòng − 1):
 *   - 09:00 ngày đi        → hôm nay khách combo lên xe
 *   - 21:00 ngày đi        → khách combo chuẩn bị lên xe
 *   - 12:00 ngày nhận phòng (trưa hôm sau) → khách tới homestay, nhắc THU TIỀN còn thiếu
 *   - 11:00 ngày trả phòng → khách checkout, chuẩn bị lên xe về
 *
 * Cron gọi mỗi 15 phút; mỗi mốc được gửi trong cửa sổ [giờ mốc, giờ mốc + 3h) — lỡ cron
 * vài lần vẫn bắn bù, quá 3h thì bỏ (tránh nhắc "sáng nay" lúc nửa đêm). Mỗi (đơn, mốc)
 * chỉ gửi 1 lần nhờ bảng `BookingReminder`. Gộp mọi đơn cùng mốc vào 1 thông báo.
 */

const VN_OFFSET_MS = 7 * 3_600_000;
const WINDOW_HOURS = 3;
/** Đơn còn hiệu lực (chưa huỷ / chưa hoàn tất) mới nhắc. */
const ACTIVE: BookingStatus[] = ["NEW", "CONTACTING", "CONFIRMED"];

type Field = "useDate" | "endDate";

interface Slot {
  kind: string;
  category: ServiceCategory;
  hour: number;
  /** Ngày của mốc = (trường ngày của đơn) + offset ngày. */
  field: Field;
  offset: number;
  title: (n: number) => string;
  /** Có thu tiền → hiện số tiền còn thiếu trên từng dòng. */
  showDue?: boolean;
  /** Dòng giờ xe của chiều nào (để hiện giờ khởi hành). */
  leg?: "out" | "ret";
}

export const REMINDER_SLOTS: Slot[] = [
  { kind: "CABIN_DEP_AM", category: "CABIN", hour: 9, field: "useDate", offset: 0, leg: "out", title: (n) => `🚌 Hôm nay có ${n} đơn khách đặt xe đi` },
  { kind: "CABIN_DEP_PM", category: "CABIN", hour: 21, field: "useDate", offset: 0, leg: "out", title: (n) => `🌙 Tối nay ${n} đơn khách lên xe`, showDue: true },
  { kind: "CABIN_RET_AM", category: "CABIN", hour: 11, field: "endDate", offset: 0, leg: "ret", title: (n) => `🚌 Hôm nay có ${n} đơn khách đặt xe về` },
  { kind: "COMBO_DEP_AM", category: "COMBO", hour: 9, field: "useDate", offset: -1, leg: "out", title: (n) => `🧳 Hôm nay ${n} đơn combo lên xe` },
  { kind: "COMBO_DEP_PM", category: "COMBO", hour: 21, field: "useDate", offset: -1, leg: "out", title: (n) => `🌙 ${n} đơn combo chuẩn bị lên xe tối nay` },
  { kind: "COMBO_CHECKIN_PAY", category: "COMBO", hour: 12, field: "useDate", offset: 0, title: (n) => `💰 ${n} đơn combo nhận phòng hôm nay — nhớ thu tiền`, showDue: true },
  { kind: "COMBO_CHECKOUT", category: "COMBO", hour: 11, field: "endDate", offset: 0, leg: "ret", title: (n) => `🏡 ${n} đơn combo checkout hôm nay — chuẩn bị lên xe về`, showDue: true },
];

export interface ReminderResult {
  kind: string;
  date: string;
  bookings: string[];
  title: string;
  body: string;
  sent: number | null; // null = dry-run
}

/** Chạy các mốc nhắc đến hạn tại thời điểm `now`. `dry` = chỉ xem trước, không gửi/không ghi. */
export async function runBookingReminders(now = new Date(), dry = false): Promise<ReminderResult[]> {
  const vn = new Date(now.getTime() + VN_OFFSET_MS);
  const todayKey = vn.toISOString().slice(0, 10);
  const hour = vn.getUTCHours();
  const today = parseDateOnly(todayKey);
  const out: ReminderResult[] = [];

  for (const slot of REMINDER_SLOTS) {
    if (hour < slot.hour || hour >= slot.hour + WINDOW_HOURS) continue;

    // Ngày mốc = hôm nay ⇒ trường ngày của đơn = hôm nay − offset.
    const fieldDate = addDays(today, -slot.offset);
    const candidates = await prisma.bookingRequest.findMany({
      where: { category: slot.category, status: { in: ACTIVE }, [slot.field]: fieldDate },
      orderBy: { createdAt: "asc" },
    });
    if (candidates.length === 0) continue;

    const done = await prisma.bookingReminder.findMany({
      where: { kind: slot.kind, bookingId: { in: candidates.map((b) => b.id) } },
      select: { bookingId: true },
    });
    const doneIds = new Set(done.map((d) => d.bookingId));
    const due = candidates.filter((b) => !doneIds.has(b.id));
    if (due.length === 0) continue;

    const times = await departureTimes(due, slot.leg);
    const lines = due.map((b) => line(b, times.get(b.id), slot.showDue));
    const MAX = 6;
    const body =
      lines.slice(0, MAX).join("\n") + (lines.length > MAX ? `\n… và ${lines.length - MAX} đơn khác` : "");
    const title = slot.title(due.length);
    const url = due.length === 1 ? `/admin/bookings/${due[0].id}` : "/admin/bookings";

    let sent: number | null = null;
    if (!dry) {
      sent = await pushToAdmins({ title, body, url });
      // Chỉ đánh dấu đã nhắc khi có thiết bị nhận — chưa ai bật thông báo thì lần cron sau thử lại.
      if (sent > 0) {
        await prisma.bookingReminder.createMany({
          data: due.map((b) => ({ bookingId: b.id, kind: slot.kind })),
          skipDuplicates: true,
        });
      }
    }
    out.push({ kind: slot.kind, date: todayKey, bookings: due.map((b) => b.code), title, body, sent });
  }

  // Dọn nhật ký nhắc cũ (> 60 ngày).
  if (!dry) {
    await prisma.bookingReminder.deleteMany({ where: { sentAt: { lt: new Date(now.getTime() - 60 * 86_400_000) } } });
  }
  return out;
}

/** Giờ khởi hành chuyến đi / về của từng đơn (từ CabinTrip). */
async function departureTimes(bookings: BookingRequest[], leg?: "out" | "ret"): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!leg) return map;
  const tripOf = (b: BookingRequest) => (leg === "out" ? b.cabinTripId : b.cabinReturnTripId);
  const ids = [...new Set(bookings.map(tripOf).filter((x): x is string => Boolean(x)))];
  if (ids.length === 0) return map;
  const trips = await prisma.cabinTrip.findMany({
    where: { id: { in: ids } },
    select: { id: true, departureTime: true, operatorName: true, departureDate: true },
  });
  const byId = new Map(trips.map((t) => [t.id, t]));
  for (const b of bookings) {
    const t = byId.get(tripOf(b) ?? "");
    if (t) map.set(b.id, `${t.departureTime}${t.operatorName ? ` ${t.operatorName}` : ""}`);
  }
  return map;
}

function line(b: BookingRequest, time: string | undefined, showDue?: boolean): string {
  const total = toNumber(b.referencePrice);
  const paid = toNumber(b.amountCollected) ?? 0;
  const due = total != null ? Math.max(0, total - paid) : null;
  const pax = b.adults ?? b.quantity;
  const parts = [
    `${b.customerName} ${b.phone}`,
    `${pax} khách`,
    time ? `xe ${time}` : null,
    b.category === "COMBO" ? b.serviceTitle.replace(/^Combo Tà Xùa:\s*/, "") : null,
    showDue ? (due == null ? "chưa có giá" : due > 0 ? `còn thu ${formatPrice(due)}` : "đã thu đủ") : null,
  ];
  return "• " + parts.filter(Boolean).join(" · ");
}

/** Khoá PostgreSQL riêng cho nhắc lịch (số bất kỳ, cố định). */
const REMINDER_LOCK_KEY = 74_210_611;

/**
 * Chạy nhắc lịch với KHOÁ toàn cục (pg_try_advisory_xact_lock): production chạy nhiều bản
 * app song song, mỗi bản đều có bộ hẹn giờ — chỉ bản lấy được khoá mới gửi, các bản còn
 * lại bỏ lượt này (tránh 1 thông báo bắn 2 lần). Khoá tự nhả khi transaction kết thúc.
 * Trả về null nếu bản khác đang chạy.
 */
export async function runBookingRemindersLocked(now = new Date()): Promise<ReminderResult[] | null> {
  return prisma.$transaction(
    async (tx) => {
      const rows = await tx.$queryRaw<{ locked: boolean }[]>`SELECT pg_try_advisory_xact_lock(${REMINDER_LOCK_KEY}) AS locked`;
      if (!rows[0]?.locked) return null;
      return runBookingReminders(now, false);
    },
    { timeout: 120_000, maxWait: 10_000 },
  );
}
