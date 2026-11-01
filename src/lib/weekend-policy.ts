import type { WeekendPolicy } from "@prisma/client";
import { addDays, toDateKey } from "./dates";

/**
 * Cấu hình cụm đêm cuối tuần phải đặt cùng nhau.
 * weekdays theo getUTCDay(): CN=0, T6=5, T7=6. Các đêm liệt kê theo thứ tự lịch (liền kề).
 */
const BLOCKS: Record<Exclude<WeekendPolicy, "NONE">, { weekdays: number[]; label: string }> = {
  FRI_SAT: { weekdays: [5, 6], label: "T6 + T7" },
  SAT_SUN: { weekdays: [6, 0], label: "T7 + CN" },
  FRI_SUN: { weekdays: [5, 6, 0], label: "T6 + T7 + CN" },
};

export function weekendPolicyLabel(policy: WeekendPolicy): string {
  if (policy === "NONE") return "Bán lẻ từng đêm";
  return `Chỉ bán nguyên cụm ${BLOCKS[policy].label}`;
}

/**
 * Kiểm tra một kỳ lưu trú có vi phạm chính sách bán cuối tuần theo cụm không.
 * Quy tắc: nếu kỳ có BẤT KỲ đêm nào thuộc cụm thì phải có ĐỦ các đêm còn lại của
 * cùng cụm đó (cùng một cuối tuần). Thiếu ⇒ trả về thông báo lỗi; hợp lệ ⇒ null.
 *
 * @param nights mảng Date, mỗi phần tử là NGÀY BẮT ĐẦU của một đêm (check-in..check-out-1).
 */
export function checkWeekendPolicy(policy: WeekendPolicy, nights: Date[]): string | null {
  if (policy === "NONE" || nights.length === 0) return null;
  const block = BLOCKS[policy];
  const have = new Set(nights.map((d) => toDateKey(d)));

  for (const d of nights) {
    const pos = block.weekdays.indexOf(d.getUTCDay());
    if (pos === -1) continue; // đêm này không thuộc cụm
    // Mốc đầu cụm (anchor) = lùi lại `pos` ngày; các đêm bắt buộc = anchor..anchor+len-1.
    const anchor = addDays(d, -pos);
    for (let i = 0; i < block.weekdays.length; i++) {
      if (!have.has(toDateKey(addDays(anchor, i)))) {
        return `Homestay này cuối tuần chỉ nhận đặt nguyên cụm ${block.label} — vui lòng chọn đủ các đêm ${block.label} (không bán lẻ).`;
      }
    }
  }
  return null;
}
