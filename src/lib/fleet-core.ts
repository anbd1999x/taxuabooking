/**
 * Đội xe cho thuê — phần thuần (dùng được cả server lẫn client): kiểu dữ liệu, suy trạng thái
 * lượt thuê / xe theo ngày, kiểm tra xe rảnh, tính giá (cuối tuần / lễ / thuê dài / theo giờ),
 * tính phí phát sinh khi trả xe, chấm điểm để TỰ XẾP xe cho đơn mới.
 * Ngày là khoá "yyyy-mm-dd"; khoảng thuê tính TRỌN NGÀY [s, e] (gồm cả ngày nhận lẫn ngày trả).
 * Theo mẫu claude.ai/design "Admin Quan ly Xe may v2".
 */

export type FleetKind = "so" | "ga" | "con";
export type FleetCond = "good" | "ok" | "service";
export type FleetMode = "ready" | "maint" | "off";
/** Trạng thái hiển thị của một lượt thuê / một xe trong ngày. */
export type FleetStatus =
  | "ready" | "web" | "hold" | "deposit" | "due" | "renting" | "late" | "done" | "maint" | "off" | "cancel";

export const FLEET_KINDS: Record<FleetKind, string> = { so: "Xe số", ga: "Xe ga", con: "Côn tay / cào cào" };
export const FLEET_CONDS: Record<FleetCond, string> = { good: "Tốt", ok: "Bình thường", service: "Cần bảo dưỡng" };
export const FLEET_SOURCES = ["Web", "CTV", "Zalo", "Khách quen"] as const;
export const FUEL_LEVELS = ["E", "1/4", "1/2", "3/4", "Đầy"] as const;
export const FLEET_ACC = ["2 mũ bảo hiểm", "Áo mưa", "Khoá đĩa", "Giá đỡ điện thoại"] as const;
export const FLEET_DOCS = ["CCCD gốc", "Bằng lái", "Cọc tiền mặt 2tr", "Không giữ"] as const;
export const SERVICE_PRESETS = ["Thay nhớt", "Bảo dưỡng định kỳ", "Thay lốp", "Sửa phanh", "Thay ắc quy", "Sửa điện", "Khác"] as const;

export type FleetHand = { odo: number; fuel: string; acc: string[]; doc: string; photos: string[]; at: string; by: string };
export type FleetRet = { odo: number; fuel: string; at: string; by: string };
export type FleetFee = { k: string; amt: number };
export type FleetPay = { id: string; at: string; amt: number; method: string; kind: string; by: string };
export type FleetSvc = { id: string; d: string; what: string; cost: number; odo: number | null };

export type FleetVehicleVM = {
  id: string;
  name: string;
  plate: string;
  kind: FleetKind;
  color: string;
  year: number | null;
  odo: number;
  price: number;
  cond: FleetCond;
  mode: FleetMode;
  note: string;
  imageUrl: string | null;
  /** Ảnh + video của xe (phần tử đầu là bìa). */
  media: string[];
  rentalVehicleId: string | null;
  oilEvery: number;
  lastOil: number;
  insExp: string | null;
  svc: FleetSvc[];
};

export type FleetRentalVM = {
  id: string;
  code: string;
  vid: string;
  bookingId: string | null;
  bookingCode: string | null;
  name: string;
  phone: string;
  cccd: string;
  s: string;
  e: string;
  st: string;
  et: string;
  total: number;
  /** Tổng đã thu (cọc + thu thêm − hoàn). */
  deposit: number;
  place: string;
  src: string;
  note: string;
  cancelled: boolean;
  web: boolean;
  ctv: string;
  hand: FleetHand | null;
  ret: FleetRet | null;
  fees: FleetFee[];
  pays: FleetPay[];
};

/** Cấu hình đội xe (lưu JSON ở FleetConfig). Đơn vị U: "vnd" (đ/ngày) | "pct" (%). */
export type FleetConfig = {
  wk: number;
  hol: number;
  md3: number;
  md5: number;
  U: { wk: "vnd" | "pct"; hol: "vnd" | "pct"; md3: "vnd" | "pct"; md5: "vnd" | "pct" };
  hourly: Record<FleetKind, number>;
  late: number;
  fuel: number;
  far: number;
  holdH: number;
  ctv: number;
  oilCost: number;
  insCost: number;
  acc: Record<string, number>;
  hols: string[];
  black: Record<string, string>;
  staff: { name: string; phone: string; role: string }[];
  ctvPaid: Record<string, boolean>;
};

export const DEFAULT_FLEET_CONFIG: FleetConfig = {
  wk: 0,
  hol: 0,
  md3: 0,
  md5: 0,
  U: { wk: "vnd", hol: "vnd", md3: "vnd", md5: "vnd" },
  hourly: { so: 30000, ga: 40000, con: 50000 },
  late: 30000,
  fuel: 20000,
  far: 50000,
  holdH: 24,
  ctv: 10,
  oilCost: 120000,
  insCost: 66000,
  acc: { "2 mũ bảo hiểm": 300000, "Áo mưa": 50000, "Khoá đĩa": 200000, "Giá đỡ điện thoại": 100000 },
  hols: [],
  black: {},
  staff: [],
  ctvPaid: {},
};

/** Gộp cấu hình đã lưu với mặc định (bỏ giá trị sai kiểu). */
export function normalizeConfig(raw: unknown): FleetConfig {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<FleetConfig>;
  const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.round(v) : d);
  const unit = (v: unknown) => (v === "pct" ? "pct" : "vnd") as "vnd" | "pct";
  const D = DEFAULT_FLEET_CONFIG;
  const acc: Record<string, number> = { ...D.acc };
  for (const k of Object.keys(acc)) acc[k] = num(r.acc?.[k], acc[k]);
  return {
    wk: num(r.wk, D.wk),
    hol: num(r.hol, D.hol),
    md3: num(r.md3, D.md3),
    md5: num(r.md5, D.md5),
    U: { wk: unit(r.U?.wk), hol: unit(r.U?.hol), md3: unit(r.U?.md3), md5: unit(r.U?.md5) },
    hourly: { so: num(r.hourly?.so, D.hourly.so), ga: num(r.hourly?.ga, D.hourly.ga), con: num(r.hourly?.con, D.hourly.con) },
    late: num(r.late, D.late),
    fuel: num(r.fuel, D.fuel),
    far: num(r.far, D.far),
    holdH: num(r.holdH, D.holdH),
    ctv: Math.min(100, num(r.ctv, D.ctv)),
    oilCost: num(r.oilCost, D.oilCost),
    insCost: num(r.insCost, D.insCost),
    acc,
    hols: Array.isArray(r.hols) ? r.hols.filter((d) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)).slice(0, 100) : [],
    black: r.black && typeof r.black === "object" ? Object.fromEntries(Object.entries(r.black).filter(([k, v]) => /^0\d{9}$/.test(k) && typeof v === "string").map(([k, v]) => [k, String(v).slice(0, 200)])) : {},
    staff: Array.isArray(r.staff) ? r.staff.filter((x) => x && typeof x.name === "string").slice(0, 30).map((x) => ({ name: String(x.name).slice(0, 60), phone: String(x.phone ?? "").slice(0, 15), role: x.role === "Quản lý" || x.role === "Chủ cơ sở" ? x.role : "Nhân viên giao xe" })) : [],
    ctvPaid: r.ctvPaid && typeof r.ctvPaid === "object" ? Object.fromEntries(Object.entries(r.ctvPaid).map(([k, v]) => [k.slice(0, 80), !!v])) : {},
  };
}

const MS_DAY = 86_400_000;
const ms = (k: string) => Date.parse(`${k}T00:00:00Z`);
export const keyOf = (t: number) => new Date(t).toISOString().slice(0, 10);
export const addDaysKey = (k: string, n: number) => keyOf(ms(k) + n * MS_DAY);
export const diffDays = (a: string, b: string) => Math.round((ms(b) - ms(a)) / MS_DAY);
export const dowOf = (k: string) => new Date(`${k}T00:00:00Z`).getUTCDay();
export const tmin = (t: string) => {
  const [a, b] = String(t || "0:0").split(":").map(Number);
  return (a || 0) * 60 + (b || 0);
};
/** "Bây giờ" theo giờ Việt Nam: { today: yyyy-mm-dd, now: HH:MM }. */
export function vnNow(at = Date.now()): { today: string; now: string } {
  const iso = new Date(at + 7 * 3_600_000).toISOString();
  return { today: iso.slice(0, 10), now: iso.slice(11, 16) };
}

/** Trạng thái lượt thuê tại thời điểm (`today`, `now` HH:MM). */
export function rentalStatus(r: FleetRentalVM, today: string, now = "12:00"): FleetStatus {
  if (r.cancelled) return "cancel";
  if (r.web) return "web";
  if (r.ret) return "done";
  if (r.hand) return r.e < today || (r.e === today && r.et < now) ? "late" : "renting";
  if (r.e < today) return "done"; // đơn cũ chưa từng lập biên bản
  if (r.s <= today) return "due";
  return r.deposit > 0 ? "deposit" : "hold";
}

/** Ngày cuối thực sự chiếm xe (xe quá hạn vẫn đang bị giữ tới hôm nay). */
export function effEnd(r: FleetRentalVM, today: string, now = "12:00"): string {
  return rentalStatus(r, today, now) === "late" && r.e < today ? today : r.e;
}

/** Lượt thuê còn chiếm xe (chưa huỷ, chưa trả). */
export function rentalBlocks(r: FleetRentalVM, today: string, now = "12:00"): boolean {
  const st = rentalStatus(r, today, now);
  return st !== "cancel" && st !== "done";
}

/** Tình trạng một xe vào ngày `d`. */
export function vehicleStatusOn(
  v: FleetVehicleVM,
  d: string,
  rentals: FleetRentalVM[],
  today: string,
  now = "12:00",
): { key: FleetStatus; r?: FleetRentalVM } {
  if (v.mode === "off") return { key: "off" };
  const r = rentals.find((x) => x.vid === v.id && x.s <= d && d <= effEnd(x, today, now) && rentalStatus(x, today, now) !== "cancel");
  if (r) return { key: d < today ? "done" : rentalStatus(r, today, now), r };
  if (v.mode === "maint" && d >= today) return { key: "maint" };
  return { key: "ready" };
}

/** Xe rảnh (sẵn sàng + không vướng lượt thuê nào) trong khoảng [s, e]. */
export function isVehicleFree(
  v: FleetVehicleVM,
  s: string,
  e: string,
  rentals: FleetRentalVM[],
  today: string,
  ignoreRentalId?: string,
  now = "12:00",
): boolean {
  if (v.mode !== "ready") return false;
  return !rentals.some(
    (r) => r.vid === v.id && r.id !== ignoreRentalId && rentalBlocks(r, today, now) && r.s <= e && s <= effEnd(r, today, now),
  );
}

/** Điểm xếp xe (thấp = ưu tiên): xe tình trạng tốt → ít đơn trong tháng → ít km. */
export function vehicleScore(v: FleetVehicleVM, rentals: FleetRentalVM[], month: string): number {
  const condRank = v.cond === "good" ? 0 : v.cond === "ok" ? 1 : 3;
  const used = rentals.filter((r) => r.vid === v.id && r.s.slice(0, 7) === month && !r.cancelled).length;
  return condRank * 1000 + used * 10 + v.odo / 1e5;
}

/** Chọn tự động `qty` xe rảnh tốt nhất trong `pool` cho khoảng [s, e]. */
export function autoPick(
  pool: FleetVehicleVM[],
  s: string,
  e: string,
  qty: number,
  rentals: FleetRentalVM[],
  today: string,
): FleetVehicleVM[] {
  return pool
    .filter((v) => isVehicleFree(v, s, e, rentals, today))
    .sort((a, b) => vehicleScore(a, rentals, s.slice(0, 7)) - vehicleScore(b, rentals, s.slice(0, 7)))
    .slice(0, Math.max(0, qty));
}

/**
 * Báo giá một xe: cuối tuần (T7, CN) / ngày lễ cộng thêm, thuê từ 3 / 5 ngày giảm mỗi ngày;
 * thuê theo giờ trong ngày (tối đa bằng giá 1 ngày). Trả tổng + các dòng diễn giải.
 */
export function quoteRental(
  v: Pick<FleetVehicleVM, "price" | "kind">,
  s: string,
  e: string,
  st: string,
  et: string,
  hourly: boolean,
  P: FleetConfig,
): { t: number; n: string[] } {
  if (hourly && s === e) {
    const hr = Math.max(1, Math.ceil((tmin(et) - tmin(st)) / 60));
    const rate = P.hourly[v.kind] || 0;
    const raw = hr * rate;
    return { t: Math.min(raw, v.price), n: [`${hr} giờ × ${rate / 1000}k${raw > v.price ? " (tối đa bằng giá 1 ngày)" : ""}`] };
  }
  const n = diffDays(s, e) + 1;
  let t = 0, wk = 0, hol = 0;
  for (let i = 0; i < n; i++) {
    const d = addDaysKey(s, i), w = dowOf(d);
    let pr = v.price;
    if (P.hols.includes(d)) { pr = P.U.hol === "pct" ? pr * (1 + P.hol / 100) : pr + P.hol; if (P.hol) hol++; }
    else if (w === 0 || w === 6) { pr = P.U.wk === "pct" ? pr * (1 + P.wk / 100) : pr + P.wk; if (P.wk) wk++; }
    t += pr;
  }
  const dk = n >= 5 && P.md5 ? "md5" : n >= 3 && P.md3 ? "md3" : "";
  const disc = dk ? P[dk] : 0;
  t = Math.round((dk && P.U[dk] === "pct" ? t * (1 - disc / 100) : t - disc * n) / 1000) * 1000;
  const fmtU = (k: "wk" | "hol" | "md3" | "md5", val: number) => (P.U[k] === "pct" ? `${val}%` : `${val / 1000}k${k.startsWith("md") ? "/ngày" : ""}`);
  return {
    t: Math.max(0, t),
    n: [
      `${n} ngày`,
      wk ? `${wk} ngày cuối tuần +${fmtU("wk", P.wk)}` : "",
      hol ? `${hol} ngày lễ +${fmtU("hol", P.hol)}` : "",
      disc ? `thuê từ ${dk === "md5" ? 5 : 3} ngày −${fmtU(dk as "md3" | "md5", disc)}` : "",
    ].filter(Boolean),
  };
}

/** Phí phát sinh khi nhận lại xe: trả muộn, thiếu xăng, mất phụ kiện, hư hỏng. */
export function returnFees(
  r: FleetRentalVM,
  v: Pick<FleetVehicleVM, "price">,
  rf: { fuel: string; accBack: string[]; dmg: number; dmgNote: string },
  P: FleetConfig,
  today: string,
  now: string,
): FleetFee[] {
  const st = rentalStatus(r, today, now);
  const lateMin = st === "late" ? diffDays(r.e, today) * 1440 + tmin(now) - tmin(r.et) : 0;
  const lateH = Math.max(0, Math.ceil(lateMin / 60));
  const lateFee = lateH ? (lateH <= 5 ? lateH * P.late : Math.ceil(lateH / 24) * v.price) : 0;
  const fi = (f: string) => FUEL_LEVELS.indexOf(f as (typeof FUEL_LEVELS)[number]);
  const fuelGap = r.hand ? Math.max(0, fi(r.hand.fuel) - fi(rf.fuel || "Đầy")) : 0;
  const missing = (r.hand?.acc ?? []).filter((a) => !rf.accBack.includes(a));
  return [
    lateFee ? { k: `Trả muộn ${lateH} giờ`, amt: lateFee } : null,
    fuelGap ? { k: `Thiếu xăng ${fuelGap} vạch`, amt: fuelGap * P.fuel } : null,
    ...missing.map((a) => ({ k: `Mất ${a.toLowerCase()}`, amt: P.acc[a] || 0 })),
    rf.dmg > 0 ? { k: `Hư hỏng${rf.dmgNote ? ": " + rf.dmgNote : ""}`, amt: rf.dmg } : null,
  ].filter((x): x is FleetFee => !!x);
}

export const feeSum = (r: Pick<FleetRentalVM, "fees">) => r.fees.reduce((a, f) => a + f.amt, 0);

/** Biển số chuẩn hoá: viết hoa, bỏ khoảng trắng thừa. */
export function normPlate(p: string): string {
  return p.trim().toUpperCase().replace(/\s+/g, "");
}
