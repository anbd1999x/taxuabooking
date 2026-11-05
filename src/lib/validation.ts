import { z } from "zod";
import { normalizeVnPhone, vnPhoneError } from "./phone";

// BUNGALOW đã gỡ khỏi danh mục chọn được (gộp vào HOMESTAY) — dữ liệu cũ đã migrate.
const SERVICE_CATEGORIES = [
  "CABIN",
  "HOMESTAY",
  "MOTORBIKE",
  "XEOM",
  "TAXI",
  "COMBO",
] as const;

/**
 * SĐT khách khi đặt: số di động VN thật (đầu số nhà mạng, chặn số dãy/lặp) — xem phone.ts.
 * Lưu dạng chuẩn hoá 0xxxxxxxxx (bỏ khoảng trắng, +84 → 0) để tra cứu/khớp tài khoản.
 */
const phoneField = z
  .string()
  .trim()
  .superRefine((v, ctx) => {
    const e = vnPhoneError(v);
    if (e) ctx.addIssue({ code: z.ZodIssueCode.custom, message: e });
  })
  .transform(normalizeVnPhone);
const dateKeyRegex = /^\d{4}-\d{2}-\d{2}$/;

/** Dữ liệu khách gửi khi đặt dịch vụ. */
export const bookingInputSchema = z
  .object({
    serviceId: z.string().min(1, "Thiếu dịch vụ."),
    useDate: z.string().regex(dateKeyRegex, "Ngày không hợp lệ."),
    endDate: z.string().regex(dateKeyRegex).optional().nullable(),
    quantity: z.coerce.number().int().min(1, "Số lượng tối thiểu là 1.").max(50),
    // Homestay: tách người lớn / trẻ em (tuổi) để tính phụ thu + hiện bill chính xác.
    adults: z.coerce.number().int().min(1).max(50).optional(),
    childrenAges: z.array(z.coerce.number().int().min(0).max(17)).max(20).optional(),
    roomTypeId: z.string().optional().nullable(),
    roomId: z.string().optional().nullable(),
    cabinTripId: z.string().optional().nullable(),
    rentalVehicleId: z.string().optional().nullable(),
    customerName: z
      .string()
      .trim()
      .min(2, "Vui lòng nhập họ tên.")
      .max(120),
    phone: phoneField,
    note: z.string().trim().max(1000).optional().nullable(),
  })
  .refine(
    (d) => !d.endDate || d.endDate > d.useDate,
    { message: "Ngày trả phải sau ngày nhận.", path: ["endDate"] },
  );

export type BookingInput = z.infer<typeof bookingInputSchema>;

/** Dữ liệu khách gửi khi đặt vé xe cabin (khứ hồi, vé đơn/đôi). */
export const cabinBookingSchema = z
  .object({
    serviceId: z.string().min(1, "Thiếu nhà xe."),
    outboundTripId: z.string().min(1, "Chưa chọn chuyến đi."),
    returnTripId: z.string().optional().nullable(),
    // Điểm xuất phát (tỉnh) để tra giá theo bảng giá chặng; trống = Hà Nội.
    origin: z.string().trim().max(120).optional().nullable(),
    // Cabin đôi: số buồng NẰM CHUNG (2 người/buồng) + số buồng NẰM RIÊNG (1 người/buồng).
    shared: z.coerce.number().int().min(0).max(20).default(0),
    solo: z.coerce.number().int().min(0).max(20).default(0),
    // Số khách thực tế (trống = suy ra từ cách xếp buồng).
    people: z.coerce.number().int().min(1).max(40).optional().nullable(),
    pickup: z.string().trim().max(200).optional().nullable(),
    drop: z.string().trim().max(200).optional().nullable(),
    customerName: z.string().trim().min(2, "Vui lòng nhập họ tên.").max(120),
    phone: phoneField,
    note: z.string().trim().max(1000).optional().nullable(),
  })
  .refine((d) => d.shared + d.solo >= 1, {
    message: "Vui lòng chọn ít nhất 1 cabin.",
    path: ["shared"],
  });
export type CabinBookingInput = z.infer<typeof cabinBookingSchema>;

/** Schema đặt combo (xe cabin khứ hồi + phòng homestay). */
export const comboBookingSchema = z
  .object({
    fromKey: z.string().regex(dateKeyRegex, "Ngày đi không hợp lệ."),
    toKey: z.string().regex(dateKeyRegex, "Ngày về không hợp lệ."),
    // Phương án ghép NHIỀU phòng gửi roomIds; client cũ gửi roomId đơn.
    roomId: z.string().min(1).optional().nullable(),
    roomIds: z.array(z.string().min(1)).max(10).optional().nullable(),
    outboundTripId: z.string().min(1, "Thiếu chuyến đi."),
    returnTripId: z.string().min(1, "Thiếu chuyến về."),
    origin: z.string().trim().max(120).optional().nullable(),
    // `people` = số khách TÍNH PHÍ (người lớn + trẻ từ ngưỡng miễn phí của home đã chọn).
    people: z.coerce.number().int().min(1).max(30),
    // Người lớn + tuổi từng trẻ (để lưu đơn + dựng nhãn; server tính lại số tính phí theo ngưỡng của home).
    adults: z.coerce.number().int().min(1).max(30).optional(),
    childrenAges: z.array(z.coerce.number().int().min(0).max(17)).max(20).optional(),
    // Chỗ nằm xe cabin: số cabin đơn (1 người/buồng, nằm riêng) + số cabin đôi (2 người/buồng, ghép).
    // 0/0 = client cũ → server tự xếp mặc định (tối đa ghép đôi).
    cabinSingle: z.coerce.number().int().min(0).max(30).default(0),
    cabinDouble: z.coerce.number().int().min(0).max(30).default(0),
    customerName: z.string().trim().min(2, "Vui lòng nhập họ tên.").max(120),
    phone: phoneField,
    note: z.string().trim().max(1000).optional().nullable(),
  })
  .refine((d) => (d.roomIds?.length ?? 0) > 0 || Boolean(d.roomId), {
    message: "Thiếu phòng.",
    path: ["roomIds"],
  })
  .refine((d) => d.cabinSingle + d.cabinDouble === 0 || d.cabinSingle + d.cabinDouble * 2 >= d.people, {
    message: "Chỗ nằm trên xe chưa đủ cho cả đoàn.",
    path: ["cabinSingle"],
  });
export type ComboBookingInput = z.infer<typeof comboBookingSchema>;

/** Schema tạo/sửa bài đăng dịch vụ (admin). */
export const serviceInputSchema = z.object({
  category: z.enum(SERVICE_CATEGORIES),
  title: z.string().trim().min(3, "Tên dịch vụ tối thiểu 3 ký tự.").max(200),
  slug: z.string().trim().max(200).optional(),
  summary: z.string().trim().min(5, "Vui lòng nhập mô tả ngắn.").max(500, "Mô tả ngắn tối đa 500 ký tự (dùng ô Mô tả cho nội dung dài)."),
  description: z.string().trim().min(5, "Vui lòng nhập mô tả.").max(5000, "Mô tả tối đa 5000 ký tự."),
  area: z.string().trim().max(200).optional().nullable(),
  distanceKm: z.coerce.number().min(0).max(999).optional().nullable(),
  mapUrl: z.string().trim().max(500).optional().nullable(),
  policy: z.string().trim().max(3000).optional().nullable(),
  basePrice: z.coerce.number().int().min(0).optional().nullable(),
  originalPrice: z.coerce.number().int().min(0).optional().nullable(),
  priceUnit: z.string().trim().max(30).optional().nullable(),
  contactName: z.string().trim().max(120).optional().nullable(),
  contactPhone: z.string().trim().max(30).optional().nullable(),
  contactZalo: z.string().trim().max(30).optional().nullable(),
  featured: z.coerce.boolean().optional(),
  published: z.coerce.boolean().optional(),
  easyRoad: z.coerce.boolean().optional(),
  pool: z.coerce.boolean().optional(),
  contactOnly: z.coerce.boolean().optional(),
  ownerId: z.string().optional().nullable(),
  ctvCommission: z.coerce.number().int().min(0).optional().nullable(),
  roomCommission: z.coerce.number().int().min(0).optional().nullable(),
  weekendPolicy: z.enum(["NONE", "FRI_SAT", "SAT_SUN", "FRI_SUN", "SAT_PAIRED"]).optional(),
  priorityOrder: z.coerce.number().int().optional().nullable(),
  childFreeUnderAge: z.coerce.number().int().min(0).max(18).optional().nullable(),
  // Phụ thu CHUNG cho cả homestay.
  extraPersonFee: z.coerce.number().int().min(0).optional().nullable(),
  earlyCheckinFee: z.coerce.number().int().min(0).optional().nullable(),
  lateCheckoutFee: z.coerce.number().int().min(0).optional().nullable(),
});

export type ServiceInput = z.infer<typeof serviceInputSchema>;

/** Cập nhật lịch giá & tình trạng theo khoảng ngày (admin). */
export const availabilityBulkSchema = z.object({
  targetType: z.enum(["ROOM", "RENTAL"]),
  targetId: z.string().min(1), // id cụ thể hoặc "__ALL__"
  serviceId: z.string().optional(), // bắt buộc khi targetId = "__ALL__"
  startDate: z.string().regex(dateKeyRegex),
  endDate: z.string().regex(dateKeyRegex),
  status: z
    .enum(["AVAILABLE", "LIMITED", "SOLD_OUT", "NOT_UPDATED", "PENDING_CONFIRM"])
    .optional(),
  availableUnits: z.coerce.number().int().min(0).optional(),
  priceOverride: z.coerce.number().int().min(0).optional().nullable(),
  weekdaysOnly: z.coerce.boolean().optional(),
  weekendsOnly: z.coerce.boolean().optional(),
});

export type AvailabilityBulkInput = z.infer<typeof availabilityBulkSchema>;

export const loginSchema = z.object({
  username: z.string().trim().min(1, "Nhập tên đăng nhập."),
  password: z.string().min(1, "Nhập mật khẩu."),
});

export const bookingStatusSchema = z.object({
  id: z.string().min(1),
  status: z.enum([
    "NEW",
    "CONTACTING",
    "CONFIRMED",
    "COMPLETED",
    "CANCELLED",
  ]),
  adminNote: z.string().trim().max(1000).optional().nullable(),
});
