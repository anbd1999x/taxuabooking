import "server-only";
import { prisma } from "./prisma";
import { parseDateOnly, toDateKey, today } from "./dates";
import { syncRoomTypeAvailability } from "./room-availability";
import type { RoomStatus } from "@prisma/client";

/**
 * Đồng bộ LỊCH PHÒNG của một homestay từ Google Sheet công khai.
 *
 * Mỗi homestay có 1 link sheet riêng, nhưng BỐ TRÍ CỘT mỗi sheet một khác, nên
 * parser tự dò: tìm hàng chứa nhiều "ngày" nhất làm hàng tiêu đề ngày, rồi so
 * khớp tên phòng (ô chữ bên trái vùng ngày) với các Room đã tạo trong app. Hàng
 * không khớp phòng nào (THỨ, tiêu đề thừa...) tự bị bỏ qua. Ô trống = còn trống.
 *
 * Nguồn này gắn note = "SHEET": không đè đơn đặt thật trong app (có bookingId),
 * không đè khoá của nguồn khác (OTA#...) hay khoá thủ công của admin; khi ô trống
 * chỉ tự mở lại những ngày do chính sheet khoá trước đó.
 */

export interface SheetSyncResult {
  serviceId: string;
  ok: boolean;
  summary: string; // "9 tab · 12 phòng · 270 ngày đã đồng bộ"
  matchedRooms: number;
  unmatchedRows: string[]; // nhãn hàng trong sheet không khớp phòng nào
  missingRooms: string[]; // phòng trong app không thấy trong sheet
  days: number;
  syncedTabs: string[]; // tên các tab (tháng) đã đồng bộ
  skippedTabs: string[]; // tab bỏ qua (không phải lịch, hoặc đã qua)
  error?: string;
}

export interface SheetTab {
  name: string;
  gid: string;
}

const SHEET_TAG = "SHEET";

// Nhãn hàng tiêu đề thường gặp (không phải tên phòng) → bỏ qua, không báo "không khớp".
const HEADER_LABELS = new Set([
  "ngay", "thu", "date", "day", "weekday", "phong", "room", "rooms", "ten phong",
  "stt", "loai phong", "note", "ghi chu", "tong", "total",
]);

/**
 * Bỏ dấu + thường hoá + bỏ ký tự không phải chữ/số để so khớp tên phòng linh hoạt
 * ("Phòng 3 ( không view )" ≡ "Phòng 3 (không view)").
 */
function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "") // bỏ dấu tiếng Việt (mọi combining mark)
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Tách một dòng CSV (hỗ trợ ô có dấu "," trong ngoặc kép, và "" escape). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      pushField();
    } else if (c === "\n") {
      pushRow();
    } else if (c === "\r") {
      // bỏ qua, chờ \n
    } else {
      field += c;
    }
  }
  // dòng cuối (nếu còn)
  if (field.length > 0 || row.length > 0) pushRow();
  return rows;
}

interface DayMonth {
  d: number;
  mo: number;
  y: number | null; // năm nếu ô ghi rõ, ngược lại null (suy sau, 1 lần/tab)
}

/** Nhận diện ô ngày (không suy năm). Hỗ trợ: D/M, D/M/YYYY, D-M, D.M, YYYY-MM-DD. */
function parseDayMonth(raw: string): DayMonth | null {
  const s = raw.trim();
  if (!s) return null;

  // YYYY-MM-DD (gviz có thể trả dạng này)
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) {
    const [, y, mo, d] = m;
    if (+mo < 1 || +mo > 12 || +d < 1 || +d > 31) return null;
    return { d: +d, mo: +mo, y: +y };
  }

  // D/M, D/M/YYYY, D-M-YYYY, D.M...
  m = s.match(/^(\d{1,2})[/.\-](\d{1,2})(?:[/.\-](\d{2,4}))?$/);
  if (m) {
    const d = +m[1];
    const mo = +m[2];
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    let y: number | null = null;
    if (m[3]) {
      y = +m[3];
      if (y < 100) y += 2000;
    }
    return { d, mo, y };
  }
  return null;
}

function safeDate(y: number, mo: number, d: number): Date | null {
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
  return date;
}

/**
 * Suy năm cho MỘT tháng (tab) không ghi năm: mặc định năm hiện tại; nếu tháng
 * lùi quá 6 tháng so với hiện tại thì là năm sau, vượt quá 6 tháng về tương lai
 * thì là năm trước. Nhờ vậy cả tab (cùng 1 tháng) dùng chung 1 năm, không bị
 * lệch giữa đầu và cuối tháng.
 */
function yearForMonth(mo: number, ref: Date): number {
  const cy = ref.getUTCFullYear();
  const cm = ref.getUTCMonth() + 1;
  if (mo < cm - 6) return cy + 1;
  if (mo > cm + 6) return cy - 1;
  return cy;
}

/** Phân loại trạng thái từ nội dung ô. Ô trống = AVAILABLE. */
function cellStatus(raw: string): RoomStatus {
  const t = norm(raw);
  if (!t) return "AVAILABLE";
  // "Checkout" = khách trả phòng buổi sáng → đêm đó phòng trống (chủ sheet cũng
  // không tính vào tỉ lệ đặt). "Checkin" = khách ở đêm đó.
  if (/check ?out/.test(t) || t === "out") return "AVAILABLE";
  if (/check ?in/.test(t) || t === "in") return "BOOKED";
  if (/(dat|chot|book|full|kin|het|day|sold)/.test(t)) return "BOOKED";
  if (/(cho|wait|hold|giu|pending)/.test(t)) return "PENDING";
  if (/(dong|close|khoa|nghi|off|bao tri)/.test(t)) return "CLOSED";
  // Chủ sheet ghi rõ còn trống (thay vì để ô trống).
  if (/\b(trong|available|avail|free|empty|ok)\b/.test(t)) return "AVAILABLE";
  // Ô có chữ lạ nhưng không trống → coi như không bán được (an toàn).
  return "BOOKED";
}

/** Thứ trong tuần từ ô "Thứ 2"/"Thứ Hai"/"CN"/"Chủ nhật"... (0 = CN, như getUTCDay). */
function parseWeekday(raw: string): number | null {
  const t = norm(raw);
  if (!t) return null;
  if (/^(cn\b|chu nhat)/.test(t)) return 0;
  const bare = t.match(/^([2-7])$/); // hàng thứ ghi trần "2".."7" (CN riêng)
  if (bare) return +bare[1] - 1;
  const m = t.match(/^(?:thu|t) ?(\d|hai|ba|tu|nam|sau|bay)\b/);
  if (!m) return null;
  const words: Record<string, number> = { hai: 1, ba: 2, tu: 3, nam: 4, sau: 5, bay: 6 };
  if (m[1] in words) return words[m[1]];
  const n = +m[1];
  return n >= 2 && n <= 7 ? n - 1 : null;
}

const DAY_MS = 86_400_000;

/**
 * Bù những cột ngày bị bỏ trống trong hàng tiêu đề (chủ sheet gộp ô / quên điền
 * — vd hàng 1/11 chỉ ghi "chủ nhật" + trạng thái, không ghi ngày):
 * - Khe GIỮA 2 ngày đã nhận diện: số cột trống khớp đúng số ngày thiếu → điền tuần tự.
 * - Mép TRƯỚC/SAU vùng ngày: chỉ điền khi ô tiêu đề trống VÀ hàng "thứ" xác nhận
 *   đúng thứ của ngày suy ra (tránh nuốt nhầm cột nhãn như tên phòng/"Thứ").
 * Sửa trực tiếp mảng dateCols (thêm phần tử + sắp lại theo cột).
 */
function fillMissingDateCols(
  rows: string[][],
  headerRow: number,
  dateCols: { col: number; date: Date }[],
): void {
  if (dateCols.length === 0) return;
  // Hàng ghi thứ = hàng khớp đúng thứ của ≥3 ngày đã nhận diện và không sai ngày nào.
  let wdRow = -1;
  for (let r = 0; r < rows.length && wdRow < 0; r++) {
    if (r === headerRow) continue;
    let match = 0;
    let wrong = 0;
    for (const dc of dateCols) {
      const wd = parseWeekday(rows[r][dc.col] ?? "");
      if (wd == null) continue;
      if (wd === dc.date.getUTCDay()) match++;
      else wrong++;
    }
    if (match >= 3 && wrong === 0) wdRow = r;
  }
  const width = Math.max(0, ...rows.map((r) => r.length));
  const headerCellEmpty = (c: number) => !(rows[headerRow][c] ?? "").trim();
  const wdConfirms = (c: number, d: Date) =>
    wdRow >= 0 && parseWeekday(rows[wdRow][c] ?? "") === d.getUTCDay();

  const added: { col: number; date: Date }[] = [];
  for (let i = 1; i < dateCols.length; i++) {
    const a = dateCols[i - 1];
    const b = dateCols[i];
    const colDiff = b.col - a.col;
    const dayDiff = Math.round((b.date.getTime() - a.date.getTime()) / DAY_MS);
    if (colDiff > 1 && colDiff === dayDiff) {
      for (let k = 1; k < colDiff; k++) {
        added.push({ col: a.col + k, date: new Date(a.date.getTime() + k * DAY_MS) });
      }
    }
  }
  const first = dateCols[0];
  for (let c = first.col - 1, step = 1; c >= 0; c--, step++) {
    const d = new Date(first.date.getTime() - step * DAY_MS);
    if (!headerCellEmpty(c) || !wdConfirms(c, d)) break;
    added.push({ col: c, date: d });
  }
  const last = dateCols[dateCols.length - 1];
  for (let c = last.col + 1, step = 1; c < width; c++, step++) {
    const d = new Date(last.date.getTime() + step * DAY_MS);
    if (!headerCellEmpty(c) || !wdConfirms(c, d)) break;
    added.push({ col: c, date: d });
  }
  if (added.length) {
    dateCols.push(...added);
    dateCols.sort((x, y) => x.col - y.col);
  }
}

/** Trích spreadsheetId từ bất kỳ URL Google Sheet nào. */
export function extractSheetId(url: string): string | null {
  const m = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : null;
}

/** Trích gid trong URL (tab cụ thể), mặc định "0". */
function extractGid(url: string): string {
  const m = url.match(/[#&?]gid=(\d+)/);
  return m ? m[1] : "0";
}

/**
 * Các link CSV cho một tab (gid), thử theo thứ tự. Dùng /export trước vì nó trả
 * đúng giá trị hiển thị của từng ô; gviz chỉ là dự phòng — gviz tự đoán KIỂU của
 * cả cột và trả rỗng những ô lệch kiểu (vd ô ngày thật giữa cột chữ → mất ngày),
 * đồng thời tự nối các ô gộp vào tiêu đề.
 */
function csvUrlsFor(id: string, gid: string): string[] {
  return [
    `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`,
    `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&gid=${gid}`,
  ];
}

/** Kiểm tra URL có phải Google Sheet hợp lệ không (dùng cho validate form). */
export function sheetCsvUrl(url: string): string | null {
  const id = extractSheetId(url);
  return id ? csvUrlsFor(id, extractGid(url))[0] : null;
}

/**
 * Liệt kê MỌI tab (trang tính) của spreadsheet công khai bằng cách đọc trang
 * htmlview — trang này nhúng sẵn danh sách {name, gid} cho mọi tab. Mỗi homestay
 * dán 1 link là tự lấy được tất cả tháng. Trả [] nếu không đọc được.
 */
export async function listSheetTabs(id: string): Promise<SheetTab[]> {
  const url = `https://docs.google.com/spreadsheets/d/${id}/htmlview`;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20000);
    const res = await fetch(url, {
      redirect: "follow",
      signal: ctrl.signal,
      headers: { "User-Agent": "Mozilla/5.0 TaXuaBooking sheet sync" },
      cache: "no-store",
    });
    clearTimeout(timer);
    if (!res.ok) return [];
    const html = await res.text();
    const tabs: SheetTab[] = [];
    const seen = new Set<string>();
    // Mẫu nhúng: {name: "Tháng 11", pageUrl: "...gid=523366018", gid: "523366018", ...}
    const re = /\{name:\s*"((?:[^"\\]|\\.)*)"[^}]*?gid:\s*"(\d+)"/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html))) {
      const name = m[1].replace(/\\(.)/g, "$1").trim();
      const gid = m[2];
      if (!seen.has(gid)) {
        seen.add(gid);
        tabs.push({ name, gid });
      }
    }
    return tabs;
  } catch {
    return [];
  }
}

/**
 * Dò bố trí: tìm hàng tiêu đề ngày (nhiều ô là ngày nhất) → map cột→ngày.
 * Năm được gán NHẤT QUÁN cho cả hàng: neo theo tháng của ô đầu rồi tăng năm khi
 * tháng tụt xuống (Dec→Jan). Trả null nếu không tìm được đủ ngày.
 */
function detectDateColumns(
  rows: string[][],
  ref: Date,
): { headerRow: number; dateCols: { col: number; date: Date }[] } | null {
  // Chọn hàng có nhiều ô ngày nhất.
  let bestRow = -1;
  let bestCells: { col: number; dm: DayMonth }[] = [];
  for (let r = 0; r < rows.length; r++) {
    const cells: { col: number; dm: DayMonth }[] = [];
    for (let c = 0; c < rows[r].length; c++) {
      const dm = parseDayMonth(rows[r][c]);
      if (dm) cells.push({ col: c, dm });
    }
    if (cells.length >= 3 && cells.length > bestCells.length) {
      bestRow = r;
      bestCells = cells;
    }
  }
  if (bestRow < 0) return null;

  // Năm neo = tháng của ô đầu (ưu tiên năm ghi rõ nếu có).
  const first = bestCells[0].dm;
  let year = first.y ?? yearForMonth(first.mo, ref);
  let prevMo = first.mo;
  let sawYear = false;

  const dateCols: { col: number; date: Date }[] = [];
  for (const { col, dm } of bestCells) {
    if (dm.y != null) {
      year = dm.y;
      sawYear = true;
    } else if (dm.mo < prevMo) {
      year += 1; // vắt sang năm mới (vd Dec → Jan)
    }
    prevMo = dm.mo;
    const date = safeDate(year, dm.mo, dm.d);
    if (date) dateCols.push({ col, date });
  }
  if (dateCols.length < 3) return null;
  // Tab không ghi năm → năm chỉ là phỏng đoán theo tháng hiện tại. Nếu sheet có
  // hàng "thứ" thì đối chiếu thứ trong tuần để sửa lệch ±1 năm (vd tab "Tháng 4"
  // của năm đã qua bị đoán nhầm thành năm sau).
  if (!sawYear) applyWeekdayYearShift(rows, bestRow, dateCols);
  fillMissingDateCols(rows, bestRow, dateCols);
  return { headerRow: bestRow, dateCols };
}

/**
 * Chọn độ lệch năm (-1/0/+1) khớp hàng "thứ" nhất rồi áp vào dateCols. Chỉ nhận
 * khi có hàng khớp ≥3 ô thứ và không sai ô nào; hoà thì giữ nguyên (lệch 0).
 */
function applyWeekdayYearShift(
  rows: string[][],
  headerRow: number,
  dateCols: { col: number; date: Date }[],
): void {
  let best = 0;
  let bestScore = 0;
  for (const shift of [0, -1, 1]) {
    let score = 0; // số ô thứ khớp tốt nhất trong một hàng (hàng có ô sai = loại)
    for (let r = 0; r < rows.length; r++) {
      if (r === headerRow) continue;
      let match = 0;
      let wrong = 0;
      for (const dc of dateCols) {
        const wd = parseWeekday(rows[r][dc.col] ?? "");
        if (wd == null) continue;
        const d = shift === 0 ? dc.date : safeDate(dc.date.getUTCFullYear() + shift, dc.date.getUTCMonth() + 1, dc.date.getUTCDate());
        if (!d) continue;
        if (d.getUTCDay() === wd) match++;
        else wrong++;
      }
      if (wrong === 0 && match > score) score = match;
    }
    if (score > bestScore) {
      bestScore = score;
      best = shift;
    }
  }
  if (best === 0 || bestScore < 3) return;
  for (const dc of dateCols) {
    const shifted = safeDate(dc.date.getUTCFullYear() + best, dc.date.getUTCMonth() + 1, dc.date.getUTCDate());
    if (shifted) dc.date = shifted;
  }
}

/** Xoay bảng (hàng↔cột) — hỗ trợ sheet kiểu ngày dọc cột A, tên phòng ngang hàng đầu. */
function transpose(rows: string[][]): string[][] {
  const width = Math.max(0, ...rows.map((r) => r.length));
  const out: string[][] = [];
  for (let c = 0; c < width; c++) out.push(rows.map((r) => r[c] ?? ""));
  return out;
}

/** Dò hướng bảng: thử kiểu ngày-ngang trước, thất bại thì xoay bảng rồi dò lại. */
function detectLayout(
  rows: string[][],
  ref: Date,
): { rows: string[][]; headerRow: number; dateCols: { col: number; date: Date }[] } | null {
  const direct = detectDateColumns(rows, ref);
  if (direct) return { rows, ...direct };
  const flipped = transpose(rows);
  const viaTranspose = detectDateColumns(flipped, ref);
  return viaTranspose ? { rows: flipped, ...viaTranspose } : null;
}

type RoomRef = { id: string; name: string; roomTypeId: string };
type SheetEntry = { room: RoomRef; date: Date; status: RoomStatus };

/**
 * Khớp một nhãn trong sheet với phòng trong app. Thử khớp chính xác trước; nếu
 * không được thì chấp nhận nhãn CHỨA tên phòng như một cụm từ nguyên vẹn (có
 * ranh giới từ) — xử lý ô gộp kiểu "CHILLOUT VILLAGE PHÒNG ĐÔI Rustic 4" hay
 * "Shan 1 (có máy chiếu)". Nhiều phòng cùng khớp (độ dài bằng nhau) → bỏ qua
 * cho an toàn; tên dài hơn thắng ("Phòng 1 VIP" thắng "Phòng 1").
 */
function matchRoom(
  roomByName: Map<string, RoomRef>,
  rooms: RoomRef[],
  label: string,
): RoomRef | null {
  const n = norm(label);
  if (!n) return null;
  const exact = roomByName.get(n);
  if (exact) return exact;
  let best: RoomRef | null = null;
  let bestLen = 0;
  let ambiguous = false;
  const padded = ` ${n} `;
  for (const rm of rooms) {
    const rn = norm(rm.name);
    if (!rn || !padded.includes(` ${rn} `)) continue;
    if (rn.length > bestLen) {
      best = rm;
      bestLen = rn.length;
      ambiguous = false;
    } else if (rn.length === bestLen && rm.id !== best?.id) {
      ambiguous = true;
    }
  }
  return ambiguous ? null : best;
}

/** Tải CSV của một tab (gid). Trả null nếu không phải CSV (sheet chưa công khai / lỗi). */
async function fetchTabCsv(id: string, gid: string): Promise<string[][] | null> {
  for (const url of csvUrlsFor(id, gid)) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20000);
    try {
      const res = await fetch(url, {
        redirect: "follow",
        signal: ctrl.signal,
        headers: { "User-Agent": "TaXuaBooking/1.0 sheet sync" },
        cache: "no-store",
      });
      if (!res.ok) continue;
      const text = await res.text();
      if (/^<!DOCTYPE html/i.test(text.trimStart())) continue; // trang đăng nhập = chưa công khai
      return parseCsv(text);
    } catch {
      // thử link kế tiếp
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}

/**
 * Đồng bộ MỘT homestay từ sheet đã lưu ở Service.sheetUrl. Tự liệt kê MỌI tab
 * (mỗi tab 1 tháng) từ 1 link và đồng bộ lần lượt; tab không phải lịch hoặc đã
 * qua sẽ bị bỏ qua.
 */
export async function syncServiceSheet(serviceId: string): Promise<SheetSyncResult> {
  const base: SheetSyncResult = {
    serviceId,
    ok: false,
    summary: "",
    matchedRooms: 0,
    unmatchedRows: [],
    missingRooms: [],
    days: 0,
    syncedTabs: [],
    skippedTabs: [],
  };

  const service = await prisma.service.findUnique({
    where: { id: serviceId },
    select: {
      sheetUrl: true,
      roomTypes: {
        select: { id: true, rooms: { select: { id: true, name: true, roomTypeId: true } } },
      },
    },
  });
  if (!service) return { ...base, error: "Không tìm thấy homestay." };
  if (!service.sheetUrl) return { ...base, error: "Chưa có link Google Sheet." };

  const id = extractSheetId(service.sheetUrl);
  if (!id) return fail(serviceId, base, "Link Google Sheet không hợp lệ.");

  // Bảng tra phòng theo tên đã chuẩn hoá.
  const allRooms = service.roomTypes.flatMap((rt) => rt.rooms);
  const roomByName = new Map<string, RoomRef>();
  for (const rm of allRooms) roomByName.set(norm(rm.name), rm);

  const ref = today();

  try {
    // 1) Liệt kê mọi tab của spreadsheet. Không đọc được → chỉ dùng tab trong link.
    let tabs = await listSheetTabs(id);
    if (tabs.length === 0) tabs = [{ name: "(trang tính)", gid: extractGid(service.sheetUrl) }];
    tabs = tabs.slice(0, 36); // chặn trường hợp bất thường

    const entries: SheetEntry[] = [];
    const matchedRoomIds = new Set<string>();
    const unmatched = new Set<string>();
    const syncedTabs: string[] = [];
    const skippedTabs: string[] = [];
    let anyCalendarTab = false; // có ít nhất 1 tab nhận diện được là lịch

    // 2) Tải song song rồi duyệt từng tab (kết quả giữ đúng thứ tự tab).
    const tabRows = await Promise.all(tabs.map((t) => fetchTabCsv(id, t.gid)));
    for (let ti = 0; ti < tabs.length; ti++) {
      const tab = tabs[ti];
      const detected = tabRows[ti] ? detectLayout(tabRows[ti]!, ref) : null;
      if (!detected) {
        skippedTabs.push(tab.name);
        continue;
      }
      const { rows, headerRow, dateCols } = detected;
      const firstDateCol = Math.min(...dateCols.map((d) => d.col));
      // Đồng bộ TOÀN BỘ ngày trong sheet (cả quá khứ) để lịch tháng trong admin
      // khớp sheet trọn tháng, không chỉ từ hôm nay trở đi.
      const futureCols = dateCols;
      anyCalendarTab = true;

      let matchedInTab = 0;
      const seenInTab = new Set<string>();
      for (let r = 0; r < rows.length; r++) {
        if (r === headerRow) continue;
        const row = rows[r];
        // Ứng viên tên phòng = MỌI ô chữ bên trái vùng ngày, duyệt từ phải sang
        // trái (tên phòng thường nằm sát vùng ngày; bên trái có thể là tên
        // homestay / nhãn nhóm do ô gộp tách ra nhiều ô).
        const candidates: string[] = [];
        for (let c = Math.max(1, firstDateCol) - 1; c >= 0; c--) {
          const v = (row[c] ?? "").trim();
          if (v) candidates.push(v);
        }
        if (candidates.length === 0) continue;
        let room: RoomRef | null = null;
        for (const cand of candidates) {
          room = matchRoom(roomByName, allRooms, cand);
          if (room) break;
        }
        if (!room) {
          if (candidates.some((c) => HEADER_LABELS.has(norm(c)))) continue;
          const hasBooking = futureCols.some((dc) => cellStatus(row[dc.col] ?? "") !== "AVAILABLE");
          if (hasBooking) unmatched.add(candidates[0]);
          continue;
        }
        if (seenInTab.has(room.id)) continue;
        seenInTab.add(room.id);
        matchedRoomIds.add(room.id);
        matchedInTab++;
        for (const dc of futureCols) {
          entries.push({ room, date: dc.date, status: cellStatus(row[dc.col] ?? "") });
        }
      }

      if (matchedInTab > 0) syncedTabs.push(tab.name);
      else skippedTabs.push(tab.name);
    }

    if (entries.length === 0) {
      if (!anyCalendarTab)
        throw new Error("Không nhận diện được tab lịch nào trong sheet (thiếu hàng/cột ngày).");
      throw new Error("Không khớp được phòng nào. Hãy đảm bảo tên phòng trong sheet trùng tên phòng trong app.");
    }

    // Khử trùng lặp (tab trùng tháng): mỗi (phòng, ngày) lấy giá trị ở tab xuất hiện trước.
    const dedupedByKey = new Map<string, SheetEntry>();
    for (const e of entries) {
      const k = `${e.room.id}|${toDateKey(e.date)}`;
      if (!dedupedByKey.has(k)) dedupedByKey.set(k, e);
    }
    const deduped = [...dedupedByKey.values()];
    const totalDays = new Set(deduped.map((e) => toDateKey(e.date))).size;

    // 3) Ghi dữ liệu dạng BATCH (1 lần đọc + deleteMany + createMany) để không
    //    vượt timeout transaction khi sheet lớn. Vẫn bảo vệ đơn thật + nguồn khác.
    // Đọc bản ghi hiện có trong đúng khoảng ngày sheet phủ (gồm cả quá khứ).
    const times = deduped.map((e) => e.date.getTime());
    const rangeFrom = new Date(Math.min(...times));
    const rangeTo = new Date(Math.max(...times));
    const existingList = await prisma.roomDayStatus.findMany({
      where: { roomId: { in: [...matchedRoomIds] }, date: { gte: rangeFrom, lte: rangeTo } },
      select: { id: true, roomId: true, date: true, status: true, note: true, bookingId: true },
    });
    const existingByKey = new Map(existingList.map((x) => [`${x.roomId}|${toDateKey(x.date)}`, x]));

    const affectedTypes = new Map<string, Set<string>>(); // roomTypeId -> dateKeys
    const deleteIds: string[] = [];
    const creates: { roomId: string; date: Date; status: RoomStatus; note: string }[] = [];
    for (const { room, date, status } of deduped) {
      const dk = toDateKey(date);
      const existing = existingByKey.get(`${room.id}|${dk}`);
      // Không đụng: đơn thật (bookingId), bản ghi của nguồn khác (OTA#..., note admin)
      // hoặc khoá thủ công admin (status != AVAILABLE, không do sheet tạo).
      const ownedBySheet = existing?.note === SHEET_TAG;
      const isForeign =
        existing &&
        !ownedBySheet &&
        (existing.bookingId != null || existing.note != null || existing.status !== "AVAILABLE");
      if (isForeign) continue;

      if (status === "AVAILABLE") {
        // Ô trống: chỉ mở lại ngày do chính sheet đã khoá trước đó.
        if (ownedBySheet && existing) {
          deleteIds.push(existing.id);
          mark(affectedTypes, room.roomTypeId, dk);
        }
      } else {
        if (existing) {
          if (ownedBySheet && existing.status === status) continue; // không đổi → bỏ qua
          deleteIds.push(existing.id); // bản ghi SHEET cũ / bản ghi AVAILABLE tự do → thay mới
        }
        creates.push({ roomId: room.id, date, status, note: SHEET_TAG });
        mark(affectedTypes, room.roomTypeId, dk);
      }
    }

    await prisma.$transaction([
      prisma.roomDayStatus.deleteMany({ where: { id: { in: deleteIds } } }),
      // skipDuplicates: nếu một đơn thật vừa chiếm (roomId, date) giữa lúc đọc và ghi
      // thì bản ghi của sheet bị bỏ qua, đơn thật được giữ nguyên.
      prisma.roomDayStatus.createMany({ data: creates, skipDuplicates: true }),
    ]);

    // 4) Cập nhật lại số phòng trống (RoomAvailability) cho các ngày bị ảnh hưởng.
    for (const [rtId, keys] of affectedTypes) {
      for (const dk of keys) await syncRoomTypeAvailability(rtId, parseDateOnly(dk));
    }

    const missing = allRooms.filter((rm) => !matchedRoomIds.has(rm.id)).map((rm) => rm.name);
    const summary = `${syncedTabs.length} tab · ${matchedRoomIds.size} phòng · ${totalDays} ngày đã đồng bộ`;
    await prisma.service.update({
      where: { id: serviceId },
      data: { sheetSyncedAt: new Date(), sheetSyncResult: summary },
    });

    return {
      serviceId,
      ok: true,
      summary,
      matchedRooms: matchedRoomIds.size,
      unmatchedRows: [...unmatched],
      missingRooms: missing,
      days: totalDays,
      syncedTabs,
      skippedTabs,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Lỗi không rõ";
    return fail(serviceId, base, msg);
  }
}

function mark(map: Map<string, Set<string>>, rtId: string, dk: string) {
  let set = map.get(rtId);
  if (!set) {
    set = new Set();
    map.set(rtId, set);
  }
  set.add(dk);
}

async function fail(serviceId: string, base: SheetSyncResult, msg: string): Promise<SheetSyncResult> {
  await prisma.service
    .update({ where: { id: serviceId }, data: { sheetSyncedAt: new Date(), sheetSyncResult: `Lỗi: ${msg}` } })
    .catch(() => {});
  return { ...base, error: msg };
}

/** Đồng bộ TẤT CẢ homestay có link sheet (dùng cho cron). */
export async function syncAllSheets(): Promise<SheetSyncResult[]> {
  const services = await prisma.service.findMany({
    where: { sheetUrl: { not: null }, category: { in: ["HOMESTAY", "BUNGALOW"] } },
    select: { id: true },
  });
  const out: SheetSyncResult[] = [];
  for (const s of services) out.push(await syncServiceSheet(s.id));
  return out;
}
