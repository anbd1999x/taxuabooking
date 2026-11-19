/**
 * Quản lý phòng (chủ homestay) — logic THUẦN, dùng chung client + server (không I/O).
 * Theo mẫu claude.ai/design "Admin Quan ly Phong".
 *
 * Mô hình: một lượt ở (RoomStay) = 1 phòng × khoảng đêm [ci, co). Trạng thái SUY RA từ dữ liệu
 * (đã nhận / đã trả / đã thu) — chỉ lưu `state` khi huỷ / không đến / từ chối.
 * Đoàn nhiều phòng (groupId) dùng chung tiền: số đã thu của cả đoàn chia về từng phòng theo tỉ lệ bill.
 */
import { addDaysKey, diffDays, dowOf, vnNow } from "@/lib/fleet-core";

export { addDaysKey, diffDays, dowOf, vnNow };

export type StayStatus = "hold" | "deposit" | "arriving" | "inhouse" | "dueout" | "overdue" | "out" | "web" | "cancel" | "noshow" | "reject";
export type HkStatus = "clean" | "dirty" | "cleaning" | "maint";
export const HK_KEYS: HkStatus[] = ["clean", "dirty", "cleaning", "maint"];

export type StayPay = { id: string; at: string; amt: number; method: string; kind: string; by: string };
export type StayFee = { name: string; amt: number };
export type StayGuest = { name: string; cccd: string };

export type StayVM = {
  id: string;
  code: string;
  roomId: string;
  bookingId: string | null;
  bookingCode: string | null;
  /** Đơn combo của sàn (tiền phòng do sàn thu & điều phối). */
  combo: boolean;
  /** Ghi thu tiền ở lượt này được không (đơn sàn chưa cọc ⇒ không); lý do khi không. */
  payBlock: string;
  groupId: string | null;
  groupName: string | null;
  name: string;
  phone: string;
  guests: number;
  guestList: StayGuest[];
  ci: string;
  co: string;
  total: number;
  src: string;
  note: string;
  state: string | null;
  /** Giữ chỗ chưa cọc: hạn tự nhả (ISO) */
  holdUntil: string | null;
  /** "yyyy-mm-dd HH:MM" giờ VN */
  inAt: string | null;
  outAt: string | null;
  fees: StayFee[];
  pays: StayPay[];
  /** Chiết khấu sàn của phần phòng này (đơn sàn; lượt chủ tự tạo = 0). */
  comm: number;
};

/** Đơn của sàn đang chờ chủ nhà xác nhận còn phòng. */
export type WebOrderVM = {
  id: string;
  code: string;
  kind: string;
  name: string;
  phone: string;
  ci: string;
  co: string;
  guests: number;
  roomIds: string[];
  total: number;
  collected: number;
  createdAt: string;
  status: string;
  note: string;
};

export type HomeRoomVM = {
  id: string;
  name: string;
  typeId: string;
  cap: number;
  max: number;
  hk: HkStatus;
  /** Giá hiệu lực theo thứ, chỉ mục getUTCDay (0 = CN). */
  dow: number[];
  /** Giá ngày lễ của phòng (Room.holidayPrice; 0 = không có) — áp cho đêm nằm trong lịch lễ của admin. */
  hol: number;
};
export type HomeTypeVM = { id: string; name: string };
export type CloseVM = { id: string; roomIds: string[]; from: string; to: string; reason: string };
/** Ô bị khoá bởi nguồn khác (sheet / OTA / khoá tay ở lưới tình trạng) — gộp thành khoảng đêm [from, to). */
export type LockVM = { roomId: string; from: string; to: string; label: string };
export type ExpenseVM = { id: string; date: string; cat: string; amt: number; note: string };
export type SvcLogVM = { id: string; roomId: string; date: string; what: string; cost: number };
export type StaffVM = { id: string; name: string; username: string; phone: string | null; active: boolean };

export type HomeSvc = { name: string; price: number };
export type HomeConfig = {
  /** Giờ nhận / trả phòng chuẩn (giờ chẵn) */
  ci: number;
  co: number;
  early: number;
  late: number;
  /** Giữ chỗ chưa cọc (giờ) rồi tự nhả */
  hold: number;
  svcs: HomeSvc[];
  flags: Record<string, "vip" | "black">;
};

export const STAY_SOURCES = ["Gọi điện", "Vãng lai", "Zalo", "Facebook", "OTA", "CTV"] as const;
export const EXP_CATS = ["Điện nước", "Lương", "Vật tư", "Sửa chữa", "Khác"] as const;
export const CLOSE_REASONS = ["Bảo trì", "Chủ dùng", "Nghỉ lễ", "Khác"] as const;
export const PAY_METHODS = ["Tiền mặt", "Chuyển khoản"] as const;

export const DEFAULT_HOME_SVCS: HomeSvc[] = [
  { name: "Lẩu gà đen", price: 450000 },
  { name: "BBQ (người)", price: 120000 },
  { name: "Đốt lửa trại", price: 200000 },
  { name: "Nước · bia", price: 20000 },
  { name: "Giặt đồ", price: 50000 },
  { name: "Thuê áo ấm", price: 30000 },
];

const num = (v: unknown, d: number, min: number, max: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d;
};

/** Chuẩn hoá cấu hình (mặc định phí nhận sớm / trả muộn lấy theo mức chung của homestay). */
export function normalizeHomeConfig(raw: unknown, defaults: { early?: number | null; late?: number | null } = {}): HomeConfig {
  const r = (raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>;
  const svcs = Array.isArray(r.svcs)
    ? (r.svcs as unknown[])
        .map((x) => (x && typeof x === "object" ? (x as Record<string, unknown>) : null))
        .filter((x): x is Record<string, unknown> => !!x)
        .map((x) => ({ name: String(x.name ?? "").trim().slice(0, 40), price: num(x.price, 0, 0, 50_000_000) }))
        .filter((x) => x.name.length > 0)
        .slice(0, 30)
    : DEFAULT_HOME_SVCS;
  const flags: Record<string, "vip" | "black"> = {};
  if (r.flags && typeof r.flags === "object") {
    for (const [k, v] of Object.entries(r.flags as Record<string, unknown>)) {
      if (/^0\d{9}$/.test(k) && (v === "vip" || v === "black")) flags[k] = v;
    }
  }
  return {
    ci: num(r.ci, 14, 6, 20),
    co: num(r.co, 12, 6, 18),
    early: num(r.early, defaults.early ?? 100000, 0, 5_000_000),
    late: num(r.late, defaults.late ?? 100000, 0, 5_000_000),
    hold: num(r.hold, 6, 1, 72),
    // JSON cũ còn `hols` / `holPct` (phụ thu lễ riêng của Quản lý phòng, đã bỏ) ⇒ bỏ qua: giá lễ dùng lịch lễ chung + Room.holidayPrice.
    svcs,
    flags,
  };
}

export const hh = (h: number) => String(h).padStart(2, "0") + ":00";
export const normPhone = (p: string) => String(p || "").replace(/[\s.-]/g, "");

export const isLive = (x: { state: string | null }) => x.state !== "cancel" && x.state !== "noshow" && x.state !== "reject";
export const feesOf = (x: { fees: StayFee[] }) => x.fees.reduce((a, f) => a + f.amt, 0);
/**
 * Số chủ nhà phải thu của lượt ở. Đơn COMBO: tiền phòng do sàn thu & trả lại cho nhà ⇒ chủ nhà chỉ thu dịch vụ phát sinh / phụ thu
 * (dòng "Sàn thu hộ" không tính vào phần chủ nhà đã thu).
 */
export const billOf = (x: { total: number; fees: StayFee[]; combo?: boolean }) => (x.combo ? 0 : x.total) + feesOf(x);
export const rawPaid = (x: { pays: { amt: number; method?: string }[]; combo?: boolean }) =>
  x.pays.reduce((a, p) => a + (x.combo && p.method === "Sàn thu hộ" ? 0 : p.amt), 0);

/**
 * Số đã thu quy về lượt ở này. Lượt lẻ = tổng sổ thu của nó; lượt trong đoàn = tổng đã thu cả đoàn
 * chia theo tỉ lệ bill (đặt cọc một lần cho cả đoàn nhưng từng phòng vẫn thấy đúng phần còn thiếu).
 */
export function paidOf(x: StayVM, all: StayVM[]): number {
  if (!x.groupId || !isLive(x)) return rawPaid(x);
  const members = all.filter((y) => y.groupId === x.groupId);
  const g = members.filter(isLive);
  if (!g.some((y) => y.id === x.id)) return rawPaid(x);
  // Tiền cả đoàn tính cả phòng đã huỷ / không đến trong đoàn (cọc đoàn thường ghi ở phòng đầu — huỷ phòng đó không được làm mất cọc).
  const gPaid = members.reduce((a, y) => a + rawPaid(y), 0);
  // Phòng đã trả = đã quyết toán ⇒ nhận đủ phần bill của mình trước; phần còn lại mới chia cho phòng chưa trả.
  // (Chia đều theo tỉ lệ cho cả phòng đã trả làm phòng trả sau bị thu thiếu.)
  const out = g.filter((y) => !!y.outAt);
  const open = g.filter((y) => !y.outAt);
  const sumBill = (l: StayVM[]) => l.reduce((a, y) => a + billOf(y), 0);
  const outPool = open.length ? Math.min(gPaid, sumBill(out)) : gPaid;
  const share = (pool: number, l: StayVM[]) => {
    const b = sumBill(l);
    return Math.round(b > 0 ? (pool * billOf(x)) / b : pool / l.length);
  };
  return x.outAt ? share(outPool, out) : share(gPaid - outPool, open);
}

/** Trạng thái lượt ở tại (today, now). */
export function stayStatus(x: StayVM, all: StayVM[], today: string, now: string, cfg: HomeConfig): StayStatus {
  if (x.state === "cancel") return "cancel";
  if (x.state === "noshow") return "noshow";
  if (x.state === "reject") return "reject";
  if (x.outAt) return "out";
  if (x.inAt) {
    if (x.co < today || (x.co === today && now > hh(cfg.co))) return "overdue";
    if (x.co === today) return "dueout";
    return "inhouse";
  }
  // Chưa nhận phòng mà đã qua ngày trả (vd đơn cũ trước khi dùng Quản lý phòng) ⇒ coi như đã ở xong, không còn là "khách đến".
  if (x.ci <= today) return x.co <= today ? "out" : "arriving";
  return paidOf(x, all) > 0 ? "deposit" : "hold";
}

/**
 * Ngày lễ dạng danh sách khoá yyyy-mm-dd (lịch lễ CHUNG của admin ở /admin/popup — server dựng bằng
 * `holidayKeysBetween(getHolidays(), …)`, client nhận sẵn `HomeData.holKeys`).
 */
export type HolKeys = readonly string[];

/** Đêm `d` có tính giá lễ cho phòng này không (đêm trong lịch lễ VÀ phòng có giá lễ > 0). */
export const isHolNight = (room: Pick<HomeRoomVM, "hol">, d: string, hols: HolKeys) => room.hol > 0 && hols.includes(d);

/**
 * Giá một đêm — CÙNG quy tắc với trang khách (`priceForDay` + `roomPricing`): đêm ngày lễ + phòng có giá lễ
 * ⇒ giá lễ; ngược lại giá theo thứ ?? giá chiết khấu ?? giá thường (đã gộp sẵn trong `room.dow`).
 */
export function nightPrice(room: Pick<HomeRoomVM, "dow" | "hol">, d: string, hols: HolKeys): number {
  if (isHolNight(room, d, hols)) return room.hol;
  return room.dow[dowOf(d)] ?? 0;
}

export function stayPrice(room: Pick<HomeRoomVM, "dow" | "hol">, ci: string, co: string, hols: HolKeys): number {
  let t = 0;
  for (let d = ci; d < co; d = addDaysKey(d, 1)) t += nightPrice(room, d, hols);
  return t;
}

export type Quote = { nights: number; base: number; extra: number; over: number; cap: number; total: number; lines: { k: string; v: number | null }[]; hols: string[] };

/**
 * Báo giá đặt tay: tiền phòng từng phòng (giá lễ theo lịch chung) + phụ thu ở ghép (khách vượt tổng sức chứa
 * chuẩn × mức/người/đêm). `hols` của kết quả = các đêm có ít nhất một phòng tính giá lễ.
 */
export function quoteStay(rooms: HomeRoomVM[], ci: string, co: string, guests: number, holKeys: HolKeys, extraFee: number): Quote {
  const nights = Math.max(0, diffDays(ci, co));
  const cap = rooms.reduce((a, r) => a + r.cap, 0);
  const over = rooms.length ? Math.max(0, guests - cap) : 0;
  const lines: Quote["lines"] = rooms.map((r) => ({ k: `Phòng ${r.name} · ${nights} đêm`, v: stayPrice(r, ci, co, holKeys) }));
  const base = lines.reduce((a, l) => a + (l.v ?? 0), 0);
  const extra = over * extraFee * nights;
  if (extra) lines.push({ k: `Phụ thu ở ghép ${over} người × ${nights} đêm`, v: extra });
  const hols: string[] = [];
  for (let d = ci; d < co; d = addDaysKey(d, 1)) if (rooms.some((r) => isHolNight(r, d, holKeys))) hols.push(d);
  return { nights, base, extra, over, cap, total: base + extra, lines, hols };
}

/**
 * Tiền chủ nhà đã thu cần hỏi "Hoàn cọc / Giữ cọc" khi huỷ / ghi không đến lượt ở `selfId`.
 * Lượt trong đoàn mà đoàn còn phòng khác đang hiệu lực ⇒ 0 (tiền vẫn tính cho đoàn, xem `paidOf`).
 * Không tính dòng "Sàn thu hộ" (tiền sàn thu — chủ nhà không hoàn khoản đó).
 */
export function cancelMoney(selfId: string, members: { id: string; state: string | null; pays: { amt: number; method?: string }[] }[]): number {
  if (members.some((m) => m.id !== selfId && isLive(m))) return 0;
  return Math.max(0, Math.round(members.reduce((a, m) => a + m.pays.reduce((b, p) => b + (p.method === "Sàn thu hộ" ? 0 : p.amt), 0), 0)));
}

/** Chia tổng tiền (đã sửa tay hoặc theo báo giá) về từng phòng theo tỉ lệ giá, làm tròn 1.000đ, phòng cuối nhận phần lẻ. */
export function splitTotal(total: number, parts: number[]): number[] {
  const sum = parts.reduce((a, b) => a + b, 0);
  if (!parts.length) return [];
  let left = total;
  return parts.map((p, i) => {
    if (i === parts.length - 1) return left;
    const v = Math.round((sum > 0 ? (total * p) / sum : total / parts.length) / 1000) * 1000;
    left -= v;
    return v;
  });
}

/** Lượt ở có chiếm phòng trong khoảng đêm [ci, co) không (để kiểm tra trùng phía giao diện). */
export const overlaps = (aCi: string, aCo: string, bCi: string, bCo: string) => aCi < bCo && bCi < aCo;

/**
 * Phòng còn trống trọn [ci, co) không — theo dữ liệu đang có trên giao diện (lượt ở, đóng phòng,
 * khoá từ nguồn khác). Server kiểm tra lại bằng lịch RoomDayStatus trước khi ghi.
 */
export function roomFree(
  roomId: string,
  ci: string,
  co: string,
  d: { stays: StayVM[]; closes: CloseVM[]; locks: LockVM[] },
  exceptId?: string,
): boolean {
  if (ci >= co) return false;
  if (d.stays.some((x) => x.id !== exceptId && x.roomId === roomId && isLive(x) && overlaps(x.ci, x.co, ci, co))) return false;
  if (d.closes.some((c) => c.roomIds.includes(roomId) && c.from < co && ci <= c.to)) return false;
  return !d.locks.some((l) => l.roomId === roomId && overlaps(l.from, l.to, ci, co));
}

/** Mã lượt ở LT-XXXXX. */
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const stayCode = () => "LT-" + Array.from({ length: 5 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join("");
