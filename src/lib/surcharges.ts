/** Khoản phụ thu admin thêm vào đơn sau khi đặt (cột Json `BookingRequest.surcharges`). */
export interface BookingSurcharge {
  id: string;
  label: string;
  amount: number;
  /** Combo: phụ thu thuộc bên nào (room = homestay, bus = nhà xe). */
  side?: "room" | "bus";
}

/** Đọc danh sách phụ thu từ cột Json (bỏ phần tử hỏng). */
export function parseSurcharges(v: unknown): BookingSurcharge[] {
  if (!Array.isArray(v)) return [];
  return v.flatMap((x) => {
    if (!x || typeof x !== "object") return [];
    const o = x as Record<string, unknown>;
    const amount = Number(o.amount);
    if (typeof o.id !== "string" || !Number.isFinite(amount)) return [];
    const side = o.side === "room" || o.side === "bus" ? o.side : undefined;
    return [{ id: o.id, label: String(o.label ?? "Phụ thu"), amount, ...(side ? { side } : {}) }];
  });
}

/** Gợi ý nhanh tên khoản phụ thu. */
export const SURCHARGE_PRESETS = ["Thêm người", "Thêm giường phụ", "Trẻ em", "Ăn tối / BBQ", "Đón trả ngoài tuyến", "Lễ / cuối tuần"];
