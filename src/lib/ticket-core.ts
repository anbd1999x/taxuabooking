/**
 * Module Vé & đặt bàn — phần THUẦN (không Prisma, không server-only): kiểu dữ liệu, sơ đồ ghế,
 * cấu hình địa điểm, và hàm tính dùng chung cho cả server lẫn giao diện quản trị.
 * Theo mẫu claude.ai/design "Ban ve - Quan tri" (project 4ec052fe…).
 */
import { addDaysKey, dowOf, vnNow } from "./fleet-core";

export { addDaysKey, dowOf, vnNow };

export type VenueKind = "GATE" | "SHOW" | "RESTAURANT";
export const VENUE_KINDS: Record<VenueKind, string> = { GATE: "Vé vào cổng", SHOW: "Show ca nhạc", RESTAURANT: "Nhà hàng" };

// ----------------------------- Sơ đồ ghế -----------------------------
export type CellType = "vip" | "norm" | "aisle" | "broken" | "empty";
export const CELL_TYPES: CellType[] = ["vip", "norm", "aisle", "broken", "empty"];
export interface SeatLayout {
  rows: number;
  cols: number;
  /** "r-c" → loại ô; ô không khai = ghế Thường. */
  cells: Record<string, CellType>;
}
/** Sơ đồ mặc định khi show mới tạo / chưa dựng: 15 hàng × 15 cột. */
export const DEFAULT_ROWS = 15;
export const DEFAULT_COLS = 15;
export const MAX_ROWS = 20;
export const MAX_COLS = 30;

export function normalizeLayout(raw: unknown): SeatLayout {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const rows = Math.min(MAX_ROWS, Math.max(1, Math.round(Number(o.rows)) || DEFAULT_ROWS));
  const cols = Math.min(MAX_COLS, Math.max(1, Math.round(Number(o.cols)) || DEFAULT_COLS));
  const cells: Record<string, CellType> = {};
  const src = (o.cells && typeof o.cells === "object" ? o.cells : {}) as Record<string, unknown>;
  for (const [k, v] of Object.entries(src)) {
    const m = /^(\d+)-(\d+)$/.exec(k);
    if (!m || +m[1] >= rows || +m[2] >= cols) continue;
    if (v !== "norm" && (CELL_TYPES as string[]).includes(String(v))) cells[k] = v as CellType;
  }
  return { rows, cols, cells };
}
export const cellType = (l: SeatLayout, r: number, c: number): CellType => l.cells[`${r}-${c}`] ?? "norm";
export const rowName = (r: number) => String.fromCharCode(65 + r);
/** Mã ghế theo hàng (chữ) + cột lưới (số): hàng 0 cột 6 → "A7". Ổn định khi tô lại lối đi. */
export const seatKey = (r: number, c: number) => rowName(r) + (c + 1);
export function parseSeatKey(key: string): { r: number; c: number } | null {
  const m = /^([A-T])(\d{1,2})$/.exec(key);
  return m ? { r: m[1].charCodeAt(0) - 65, c: +m[2] - 1 } : null;
}
/** Hạng của ghế (vip / norm); null = không phải ghế bán được. */
export function seatClassOf(l: SeatLayout, key: string): "vip" | "norm" | null {
  const p = parseSeatKey(key);
  if (!p || p.r >= l.rows || p.c >= l.cols) return null;
  const t = cellType(l, p.r, p.c);
  return t === "vip" || t === "norm" ? t : null;
}
/**
 * Tên hiển thị của một chỗ: ghế đơn = chính mã ô ("A7"); bàn = tiền tố theo hạng + số thứ tự đọc từ trái sang, trên xuống
 * (hạng VIP "P-01"…, hạng thường "S-01"…). Mã lưu trong DB vẫn là mã ô nên tô lại sơ đồ có thể làm đổi SỐ bàn hiển thị.
 */
export function seatName(l: SeatLayout, key: string, unit: SeatUnit): string {
  if (unit !== "table") return key;
  const p = parseSeatKey(key);
  const cls = seatClassOf(l, key);
  if (!p || !cls) return key;
  let n = 0;
  for (let r = 0; r <= p.r; r++) for (let c = 0; c < (r === p.r ? p.c + 1 : l.cols); c++) if (cellType(l, r, c) === cls) n++;
  return `${cls === "vip" ? "P" : "S"}-${String(n).padStart(2, "0")}`;
}
export function countCells(l: SeatLayout): Record<CellType, number> {
  const n: Record<CellType, number> = { vip: 0, norm: 0, aisle: 0, broken: 0, empty: 0 };
  for (let r = 0; r < l.rows; r++) for (let c = 0; c < l.cols; c++) n[cellType(l, r, c)]++;
  return n;
}

// ----------------------------- Cấu hình địa điểm -----------------------------
export type RestPolicy = "none" | "deposit" | "min";
export interface VenueConfig {
  /** GATE: quota vé mặc định mỗi ngày. */
  quota: number;
  /** SHOW: số phút giữ ghế chờ chuyển khoản. */
  holdMin: number;
  /** RESTAURANT: chính sách đặt món & cọc + số tiền cọc / tối thiểu mỗi bàn. */
  policy: RestPolicy;
  amount: number;
  slots: string[];
  floors: { name: string; sub: string }[];
  /** Giờ mở cửa hiển thị cho khách, VD "05:00 – 18:00". */
  hours: string;
  /** SHOW: nghệ sĩ / ban nhạc. */
  artist: string;
  /** Chính sách đổi / huỷ — mỗi phần tử một dòng. */
  notes: string[];
  /** Tài khoản nhận chuyển khoản (dựng mã VietQR): mã BIN ngân hàng + số tài khoản + tên chủ TK. */
  bankBin: string;
  bankAcc: string;
  bankHolder: string;
  /** RESTAURANT: một lượt đặt bàn giữ bàn bao nhiêu phút (bữa ăn) — đặt lúc S chặn bàn ở mọi khung giờ chồng lên [S, S + mealMin). */
  mealMin: number;
  /** SHOW: đơn vị chỗ ngồi trên sơ đồ — "seat" = ghế đơn (A7), "table" = BÀN 2–4 người (P-03 / S-12, kiểu show acoustic ngồi bàn). */
  seatUnit: SeatUnit;
}
export type SeatUnit = "seat" | "table";
/** "Ghế" / "Bàn" — chữ đứng trước tên chỗ. */
export const unitWord = (u: SeatUnit) => (u === "table" ? "Bàn" : "Ghế");
/** Dòng đơn là dòng chỗ ngồi theo sơ đồ ("Ghế VIP", "Bàn Premium") chứ không phải vé không số ghế. */
export const isSeatItem = (name: string) => /^(Ghế|Bàn) /.test(name);
/** Ngân hàng hỗ trợ dựng VietQR: [BIN napas, tên]. */
export const BANKS: [string, string][] = [
  ["970422", "MB Bank"], ["970436", "Vietcombank"], ["970415", "VietinBank"], ["970418", "BIDV"], ["970405", "Agribank"],
  ["970407", "Techcombank"], ["970416", "ACB"], ["970432", "VPBank"], ["970423", "TPBank"], ["970403", "Sacombank"],
];
export const bankName = (bin: string) => BANKS.find((b) => b[0] === bin)?.[1] ?? "";
/** Khách web: số vé / bàn tối đa mỗi đơn + số phút giữ ghế / bàn trong lúc điền thông tin + hạn chuyển cọc bàn. */
export const WEB_MAX: Record<VenueKind, number> = { GATE: 20, SHOW: 10, RESTAURANT: 8 };
export const DRAFT_HOLD_MIN = 10;
/**
 * Đơn khách web (vé cổng, vé show, đặt bàn) gửi xong mà chưa được xác nhận / chưa thu tiền trong ngần này phút ⇒ tự huỷ
 * và nhả ghế / bàn / quota (holdUntil = lúc gửi + WEB_CONFIRM_MIN, máy tự nhả hết hạn lo phần còn lại).
 * Đơn quản trị tạo tại quầy / điện thoại giữ cách cũ (giữ chỗ chờ thu = `holdMin` của địa điểm).
 */
export const WEB_CONFIRM_MIN = 30;
/** Nhà hàng: thời gian giữ bàn mặc định + giới hạn (phút). */
export const MEAL_MIN_DEFAULT = 120;
export const MEAL_MIN_RANGE: [number, number] = [30, 360];
export const DEFAULT_SLOTS = ["17:30", "18:00", "18:30", "19:00", "19:30", "20:00", "20:30"];
export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function normalizeConfig(raw: unknown): VenueConfig {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const num = (v: unknown, d: number, min: number, max: number) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) && v != null && v !== "" ? Math.min(max, Math.max(min, n)) : d;
  };
  const slots = Array.isArray(o.slots) ? [...new Set(o.slots.map(String).filter((s) => TIME_RE.test(s)))].sort().slice(0, 24) : [];
  const floors = Array.isArray(o.floors)
    ? o.floors
        .map((f) => {
          const x = (f ?? {}) as Record<string, unknown>;
          return { name: String(x.name ?? "").trim().slice(0, 40), sub: String(x.sub ?? "").trim().slice(0, 80) };
        })
        .filter((f) => f.name)
        .slice(0, 8)
    : [];
  const policy = o.policy === "deposit" || o.policy === "min" ? o.policy : "none";
  const txt = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const bankBin = BANKS.some((b) => b[0] === o.bankBin) ? String(o.bankBin) : "";
  return {
    seatUnit: o.seatUnit === "table" ? "table" : "seat",
    hours: txt(o.hours, 60),
    artist: txt(o.artist, 120),
    notes: Array.isArray(o.notes) ? o.notes.map((x) => txt(x, 200)).filter(Boolean).slice(0, 8) : [],
    bankBin,
    bankAcc: txt(o.bankAcc, 24).replace(/[^0-9A-Za-z]/g, ""),
    bankHolder: txt(o.bankHolder, 60).toUpperCase(),
    quota: num(o.quota, 150, 0, 100000),
    holdMin: num(o.holdMin, 15, 5, 24 * 60),
    mealMin: num(o.mealMin, MEAL_MIN_DEFAULT, MEAL_MIN_RANGE[0], MEAL_MIN_RANGE[1]),
    policy,
    amount: num(o.amount, policy === "min" ? 300000 : 100000, 0, 100_000_000),
    slots: slots.length ? slots : DEFAULT_SLOTS,
    floors: floors.length ? floors : [{ name: "Tầng 1", sub: "" }],
  };
}

export const money = (n: number) => n.toLocaleString("vi-VN") + "đ";

// ----------------------------- Giữ bàn theo thời lượng bữa ăn -----------------------------
/** Mốc phút tuyệt đối của (ngày "yyyy-mm-dd", giờ "HH:MM") — so được qua nửa đêm. */
export function slotAbsMin(date: string, time: string): number {
  const [hh, mm] = (time || "00:00").split(":").map(Number);
  return Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10)) / 60_000 + (hh || 0) * 60 + (mm || 0);
}
/**
 * Hai lượt đặt cùng một bàn có chồng giờ không: mỗi lượt chiếm [S, S + mealMin) ⇒ chồng khi |S1 − S2| < mealMin
 * (đối xứng: đặt 19:00 cũng chặn lượt 18:00 nếu 18:00 + mealMin > 19:00).
 */
export const mealOverlap = (aDate: string, aTime: string, bDate: string, bTime: string, mealMin: number) =>
  Math.abs(slotAbsMin(aDate, aTime) - slotAbsMin(bDate, bTime)) < mealMin;
/** "18:00 – 20:00" (giờ trả bàn dự kiến). */
export function mealRange(time: string, mealMin: number): string {
  const [hh, mm] = time.split(":").map(Number);
  const end = (hh * 60 + mm + mealMin) % (24 * 60);
  return `${time} – ${String(Math.floor(end / 60)).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`;
}

/** Câu khách sẽ thấy ở bước đặt bàn. */
export function policyPreview(c: Pick<VenueConfig, "policy" | "amount">): string {
  return c.policy === "none"
    ? "Giữ bàn miễn phí, quán gọi xác nhận. Món đặt trước trả tại quán."
    : c.policy === "deposit"
      ? `Quán thu cọc ${money(c.amount)}/bàn để giữ chỗ. Đặt món trước không bắt buộc.`
      : `Mỗi bàn cần đặt trước tối thiểu ${money(c.amount)} tiền món.`;
}

// ----------------------------- Dữ liệu giao diện -----------------------------
/** draft = khách web đang giữ chỗ trong lúc điền thông tin (chưa gửi đơn). */
export type OrderStatus = "draft" | "wait" | "ok" | "here" | "eat" | "done" | "cancel";
export interface TkTier { id: string; name: string; price: number; listPrice: number | null; seatClass: "vip" | "norm" | null; quota: number | null; active: boolean }
export interface TkMenu { id: string; name: string; group: string; price: number; active: boolean; /** ảnh của món, ảnh đầu là bìa */ images: string[] }
export interface TkTable { id: string; name: string; cap: number; zone: string; floor: number; round: boolean; active: boolean }
export interface TkSession { id: string; date: string; time: string; quota: number | null; status: "open" | "paused" }
export interface TkItem { kind: "ticket" | "food"; refId: string | null; name: string; price: number; qty: number; note: string }
export interface TkTicket { id: string; code: string; /** nội dung mã QR */ token: string; kind: "entry" | "food"; label: string; seatKey: string | null; usedAt: string | null; usedBy: string | null }
export interface TkOrder {
  id: string; code: string; token: string; sessionId: string;
  name: string; phone: string; guests: number; note: string; source: string;
  status: OrderStatus; ticketAmount: number; foodAmount: number; total: number; deposit: number; paid: number;
  payMethod: string | null; holdUntil: number | null; createdBy: string | null; createdAt: number;
  items: TkItem[]; seats: string[]; tickets: TkTicket[];
}
export interface TkVenue {
  id: string; kind: VenueKind; slug: string; name: string; area: string; description: string; coverImage: string | null; published: boolean;
  /** Quán tương ứng ở danh mục Nhà hàng / Cafe / Check-in (bảng Place) — trang quán hiện nút đặt bàn / mua vé khi đã mở bán. */
  placeId: string | null;
  config: VenueConfig; layout: SeatLayout; ownerId: string | null; ownerName: string;
}
export interface TkData {
  venue: TkVenue;
  tiers: TkTier[];
  menu: TkMenu[];
  tables: TkTable[];
  sessions: TkSession[];
  /** Đơn chưa huỷ của các suất từ hôm qua trở đi. */
  orders: TkOrder[];
  /** Ghế khoá tay (khách mời). */
  locks: { sessionId: string; key: string }[];
  today: string;
  now: number;
}
export interface TkVenueRef { id: string; kind: VenueKind; name: string }

/** Kết quả quét vé. */
export type ScanKind = "ok" | "used" | "wrong" | "food" | "none";
export interface ScanResult { kind: ScanKind; title: string; sub: string; ticketId?: string }

/** Số vé (không tính món) của đơn. */
export const ticketQty = (o: Pick<TkOrder, "items">) => o.items.reduce((a, i) => a + (i.kind === "ticket" ? i.qty : 0), 0);
export const foodItems = (o: Pick<TkOrder, "items">) => o.items.filter((i) => i.kind === "food");
/** "2× Người lớn · 1× Trẻ em · 2× Trà" */
export const itemsLine = (o: Pick<TkOrder, "items">) => o.items.map((i) => `${i.qty}× ${i.name}`).join(" · ");
/** Phần tiền còn phải thu của đơn (nhà hàng: tiền cọc; vé: tổng tiền). */
export const dueOf = (o: Pick<TkOrder, "total" | "deposit" | "paid">, kind: VenueKind) =>
  Math.max(0, (kind === "RESTAURANT" ? o.deposit : o.total) - o.paid);

// ----------------------------- VietQR -----------------------------
/** Chuỗi mã VietQR (EMVCo / napas247) chuyển khoản tới số tài khoản, kèm số tiền + nội dung. */
export function vietQrPayload(o: { bin: string; account: string; amount: number; memo: string }): string {
  const f = (id: string, v: string) => id + String(v.length).padStart(2, "0") + v;
  const acc = f("00", "A000000727") + f("01", f("00", o.bin) + f("01", o.account)) + f("02", "QRIBFTTA");
  const body = f("00", "01") + f("01", "12") + f("38", acc) + f("53", "704") + f("54", String(Math.round(o.amount))) + f("58", "VN") + f("62", f("08", o.memo.replace(/[^A-Za-z0-9 -]/g, "").slice(0, 25))) + "6304";
  return body + crc16(body);
}
/** CRC-16/CCITT-FALSE (đa thức 0x1021, khởi tạo 0xFFFF) dạng 4 ký tự hex hoa — chuẩn EMVCo. */
export function crc16(s: string): string {
  let crc = 0xffff;
  for (let i = 0; i < s.length; i++) {
    crc ^= s.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

// ----------------------------- Dữ liệu trang khách -----------------------------
export interface PubVenue {
  slug: string; kind: VenueKind; name: string; area: string; description: string; coverImage: string | null;
  hours: string; artist: string; notes: string[]; policy: RestPolicy; amount: number; slots: string[]; floors: { name: string; sub: string }[];
  /** Có tài khoản nhận chuyển khoản ⇒ đơn cần trả trước sẽ hiện VietQR + hạn giữ chỗ. */
  hasBank: boolean; holdMin: number; seatUnit: SeatUnit;
  /** RESTAURANT: số phút giữ bàn mỗi lượt đặt. */
  mealMin: number;
  layout: SeatLayout;
  tiers: { id: string; name: string; price: number; listPrice: number | null; seatClass: "vip" | "norm" | null; quota: number | null }[];
  menu: { id: string; name: string; group: string; price: number; desc: string; images: string[] }[];
  tables: { id: string; name: string; cap: number; zone: string; floor: number; round: boolean }[];
}
export interface PubShow { date: string; time: string; paused: boolean; taken: Record<string, "sold" | "held">; standLeft: Record<string, number | null>; free: number; total: number }
export interface PubAvail {
  today: string;
  /** 7 ngày tới. */
  days: string[];
  /** GATE: vé còn lại theo ngày. */
  gate: Record<string, { left: number; paused: boolean }>;
  /** SHOW: các suất sắp diễn. */
  shows: PubShow[];
  /** RESTAURANT: "ngày|giờ" (mọi khung giờ của 7 ngày) → id các bàn đã có khách chồng giờ (tính cả thời lượng bữa ăn). */
  rest: Record<string, string[]>;
}
export interface PubCard {
  slug: string; kind: VenueKind; name: string; area: string; hours: string; coverImage: string | null;
  /** Giá từ (GATE / SHOW) hoặc tiền cọc mỗi bàn (RESTAURANT, 0 = miễn phí). */
  from: number;
  /** Theo từng ngày: GATE { left } · SHOW { time, left } (null = không có suất) · RESTAURANT { time, left } bàn trống khung giờ chính. */
  days: Record<string, { time: string; left: number } | null>;
}
/** Giờ đã qua trong hôm nay (không nhận đặt nữa). */
export const slotPassed = (date: string, time: string, today: string, now: string) => date < today || (date === today && !!time && time <= now);
