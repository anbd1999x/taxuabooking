import type { ComboHomeOption, ComboRoomOption } from "./combo";
import type { ComboQuoteRoom } from "./combo-pricing";

/**
 * Logic THUẦN của "Combo tự chọn" (không import server) — gom nhóm phòng, gợi ý rẻ nhất.
 * Tách khỏi giao diện để kiểm thử được (scripts/test-combo-custom.ts).
 */

/** Trần mỗi đơn — khớp comboBookingSchema (roomIds ≤ 20, tickets ≤ 40, people ≤ 30). */
export const CUSTOM_MAX_ROOMS = 20;
export const CUSTOM_MAX_TICKETS = 40;
export const CUSTOM_MAX_PEOPLE = 30;

/** Nhóm các phòng GIỐNG NHAU của một homestay (cùng hạng + giá + sức chứa) → 1 dòng có nút +/−. */
export interface CustomRoomGroup {
  key: string;
  rep: ComboRoomOption;
  rooms: ComboRoomOption[];
  cap: number;
  capMax: number;
  /** Tiền 1 phòng cả kỳ (giường cộng đồng: tiền 1 NGƯỜI cả kỳ). */
  unit: number;
  unitOld: number | null;
  communal: boolean;
}

/**
 * `each = true`: KHÔNG gộp — mỗi phòng trống là một dòng riêng (khách thấy & chọn đúng từng căn, xem đúng
 * ảnh căn đó). Mặc định gộp các phòng giống hệt nhau thành một dòng có số lượng.
 */
export function groupRooms(home: Pick<ComboHomeOption, "rooms">, each = false): CustomRoomGroup[] {
  const m = new Map<string, CustomRoomGroup>();
  for (const r of home.rooms) {
    const key = (each ? `${r.roomId}|` : "") + `${r.roomTypeId}|${r.roomCost}|${r.roomCostOld ?? ""}|${r.capacity}|${r.maxCapacity}|${r.noComboDiscount ? 1 : 0}|${r.communal ? 1 : 0}`;
    const g = m.get(key);
    if (g) g.rooms.push(r);
    else m.set(key, { key, rep: r, rooms: [r], cap: r.capacity, capMax: r.maxCapacity, unit: r.roomCost, unitOld: r.roomCostOld, communal: r.communal });
  }
  return [...m.values()].sort(
    (a, b) =>
      a.unit / Math.max(1, a.cap) - b.unit / Math.max(1, b.cap) ||
      a.unit - b.unit ||
      a.rep.roomName.localeCompare(b.rep.roomName, "vi", { numeric: true }),
  );
}

/** Số phòng đang chọn của một nhóm (kẹp trong [0, số phòng còn trống]). */
export function groupQty(g: CustomRoomGroup, sel: Record<string, number>): number {
  return Math.max(0, Math.min(g.rooms.length, Math.floor(sel[g.key] ?? 0) || 0));
}

/** Các phòng CỤ THỂ ứng với lựa chọn (lấy lần lượt từ đầu mỗi nhóm). */
export function pickedRooms(groups: CustomRoomGroup[], sel: Record<string, number>): ComboRoomOption[] {
  return groups.flatMap((g) => g.rooms.slice(0, groupQty(g, sel)));
}

/** Đổi phòng của trang tìm combo sang đầu vào `comboQuote`. */
export function toQuoteRoom(r: ComboRoomOption): ComboQuoteRoom {
  return { cost: r.roomCost, costOld: r.roomCostOld, capacity: r.capacity, maxCapacity: r.maxCapacity, communal: r.communal, noComboDiscount: r.noComboDiscount };
}

/**
 * Gợi ý RẺ NHẤT đủ chỗ cho `n` khách theo sức chứa CHUẨN (không ở ghép), tối đa CUSTOM_MAX_ROOMS phòng:
 * quy hoạch động 0/1 trên từng phòng, trạng thái = (số phòng đã lấy, số chỗ đã đủ). Hoà tiền ⇒ ít phòng hơn.
 * Không ghép đủ bằng phòng thường ⇒ thử giường cộng đồng (rẻ nhất/người). Không thể đủ chỗ ⇒ {}.
 */
export function cheapestPick(groups: CustomRoomGroup[], n: number): Record<string, number> {
  n = Math.floor(n);
  if (!(n > 0)) return {};
  const normal = groups.filter((g) => !g.communal);
  if (normal.length) {
    type S = { cost: number; pick: Record<string, number> };
    const K = CUSTOM_MAX_ROOMS;
    // dp[k][c] = rẻ nhất khi dùng đúng k phòng, đủ c chỗ (c kẹp ở n).
    let dp: (S | null)[][] = Array.from({ length: K + 1 }, () => Array.from({ length: n + 1 }, () => null));
    dp[0][0] = { cost: 0, pick: {} };
    for (const g of normal) {
      for (let i = 0; i < g.rooms.length; i++) {
        const next = dp.map((row) => row.slice());
        for (let k = 0; k < K; k++) {
          for (let c = 0; c < n; c++) {
            const s = dp[k][c];
            if (!s) continue;
            const nc = Math.min(n, c + g.cap);
            const cost = s.cost + g.unit;
            const cur = next[k + 1][nc];
            if (!cur || cost < cur.cost) next[k + 1][nc] = { cost, pick: { ...s.pick, [g.key]: (s.pick[g.key] ?? 0) + 1 } };
          }
        }
        dp = next;
      }
    }
    let best: S | null = null;
    for (let k = 1; k <= K; k++) {
      const s = dp[k][n];
      if (s && (!best || s.cost < best.cost)) best = s; // k tăng dần ⇒ hoà tiền giữ phương án ít phòng
    }
    if (best) return best.pick;
  }
  const dorm = groups.filter((g) => g.communal).sort((a, b) => a.unit - b.unit);
  const pick: Record<string, number> = {};
  let cap = 0;
  let used = 0;
  for (const g of dorm) {
    for (let i = 0; i < g.rooms.length && cap < n && used < CUSTOM_MAX_ROOMS; i++) {
      pick[g.key] = (pick[g.key] ?? 0) + 1;
      cap += g.cap;
      used++;
    }
  }
  return cap >= n ? pick : {};
}
