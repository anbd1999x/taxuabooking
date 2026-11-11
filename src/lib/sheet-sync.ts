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
 * Đọc dữ liệu qua bảng HTML của từng tab để giữ Ô GỘP: khách đặt nhiều phòng /
 * nhiều đêm được chủ sheet gộp thành 1 ô "Đã đặt" → trải ra khoá đủ mọi phòng,
 * mọi đêm trong vùng gộp (CSV chỉ giữ giá trị ở ô đầu nên trước đây khoá sót).
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
  unknownValues?: string[]; // nội dung ô không nhận ra (khoá cho an toàn) — cần chủ sheet sửa/ghi rõ
  days: number;
  changes: number; // số ô (phòng × ngày) đổi trạng thái trong lần chạy này
  syncedTabs: string[]; // tên các tab (tháng) đã đồng bộ
  skippedTabs: string[]; // tab bỏ qua (không phải lịch, hoặc đã qua)
  error?: string;
}

/** Nguồn kích hoạt đồng bộ — ghi vào nhật ký SheetSyncLog. */
export type SheetSyncSource = "MANUAL" | "CRON" | "BOOKING";

export interface SheetTab {
  name: string;
  gid: string;
}

const SHEET_TAG = "SHEET";
/** Ngăn cách các ô nhãn của một hàng không khớp khi báo cho admin. */
const UNMATCHED_SEP = " / ";

// Nhãn hàng tiêu đề thường gặp (không phải tên phòng) → bỏ qua, không báo "không khớp".
const HEADER_LABELS = new Set([
  "ngay", "thu", "t", "date", "day", "weekday", "phong", "room", "rooms", "ten phong",
  "stt", "loai phong", "note", "ghi chu", "tong", "total", "so phong",
  "so phong ban", "ti le lap", // cột/hàng thống kê trong sheet của chủ nhà
]);

// Nhãn hàng/cột thống kê của chủ nhà ("SL phòng đã đặt", "Tổng số phòng đã đặt",
// "Tỉ lệ đặt phòng", "Công suất"...) — không phải tên phòng, bỏ qua không cảnh báo.
const STATS_LABEL_RE = /^(sl|so luong|tong|ti le|ty le|cong suat|doanh thu|so phong)\b/;
// Ô chỉ chứa số/phần trăm/tỉ số — hàng mà MỌI ô ngày đều kiểu này là hàng đếm/thống kê.
const NUMERIC_CELL_RE = /^[\d.,%/\s-]+$/;

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
    .replace(/([a-z])(\d)/g, "$1 $2") // tách chữ–số dính liền ("Vip3" ≡ "Vip 3")
    .replace(/(\d)([a-z])/g, "$1 $2")
    .replace(/\bp (\d+)\b/g, "phong $1") // sheet ghi tắt "P6" ≡ "Phòng 6" (chữ–số đã tách ở trên)
    .replace(/\b0+(\d)/g, "$1") // bỏ số 0 đứng đầu ("Đôi 01" ≡ "Đôi 1", "P06" ≡ "Phòng 6")
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

/**
 * Nhãn THỨ đứng ngay TRƯỚC ngày trong ô tiêu đề — một số sheet gộp cả thứ lẫn
 * ngày vào 1 ô ("Thứ Năm 1/10", "Chủ Nhật 4/10", "CN 4/10", "T5 1/10"). Lookahead
 * (?=…D/M…) bảo đảm chỉ bỏ nhãn khi SAU đó là ngày thật; cố ý KHÔNG khớp "Tháng
 * 1/2026" (nhãn tháng của bố cục khối-tháng) để không nuốt nhầm thành "1/2".
 */
const WEEKDAY_DATE_PREFIX =
  /^(?:(?:thứ|thu|chủ|chu)\s*[\p{L}2-7]*|cn|t\s*[2-7])[\s,.:-]+(?=\d{1,2}\s*[/.\-]\s*\d)/iu;

/** Nhận diện ô ngày (không suy năm). Hỗ trợ: D/M, D/M/YYYY, D-M, D.M, YYYY-MM-DD,
 *  kèm nhãn thứ ở đầu ("Thứ Năm 1/10"). Vô hại với ô không-ngày vì sau khi bỏ nhãn
 *  phần còn lại vẫn phải là NGÀY THUẦN mới được nhận. */
function parseDayMonth(raw: string): DayMonth | null {
  const s = raw.trim().replace(WEEKDAY_DATE_PREFIX, "").trim();
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
      // Năm vô lý (vd gõ nhầm "1/1/0227") → coi như không ghi năm, để suy theo
      // các ô cùng hàng / tháng hiện tại.
      if (y < 1990 || y > 2100) y = null;
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
  return classifyCell(raw).status;
}

/**
 * Như cellStatus, kèm cờ `known` = false khi ô có chữ LẠ (không khớp từ khoá nào)
 * — vẫn khoá "cho an toàn" nhưng được báo lại cho admin để bổ sung/sửa sheet.
 */
function classifyCell(raw: string): { status: RoomStatus; known: boolean } {
  const t = norm(raw);
  const ok = (status: RoomStatus) => ({ status, known: true });
  if (!t) return ok("AVAILABLE");
  // "Checkin" = khách ở đêm đó → kiểm tra TRƯỚC "checkout": ô đổi khách cùng ngày
  // ("Check out / Check in") vẫn có khách ở đêm đó, không được coi là trống.
  if (/check ?in/.test(t) || /(^| )in$/.test(t)) return ok("BOOKED");
  // Đánh dấu "x" / "X tên khách" = đã đặt (Chung Chinh) — trước đây vẫn khoá nhưng bị báo "ô không nhận ra".
  if (/^x( |$)/.test(t)) return ok("BOOKED");
  // "Checkout" = khách trả phòng buổi sáng → đêm đó phòng trống (chủ sheet cũng
  // không tính vào tỉ lệ đặt).
  if (/check ?out/.test(t) || t === "out") return ok("AVAILABLE");
  // Khách huỷ / ghi rõ còn phòng → trống (trước đây rơi vào nhánh "chữ lạ" = khoá).
  if (/\b(huy|cancel|cancelled|canceled)\b/.test(t) && !/chua huy/.test(t)) return ok("AVAILABLE");
  if (/^con( trong| phong)?$/.test(t)) return ok("AVAILABLE");
  // "Đã cọc" = đã đặt; "Chờ cọc" rơi xuống nhánh chờ bên dưới. "TOUR" = phòng giữ cho đoàn tour. "CTV" = cộng tác viên đã đặt (Tà Xùa Retreat).
  if (/(dat|chot|book|full|kin|het|day|sold)/.test(t) || /\bda coc\b/.test(t) || /\btour\b/.test(t) || /\bctv\b/.test(t)) return ok("BOOKED");
  if (/(cho|wait|hold|giu|pending)/.test(t)) return ok("PENDING");
  if (/(dong|close|khoa|lock|nghi|off|bao tri|khong ban|ngung ban|ngung)/.test(t)) return ok("CLOSED");
  // Chủ sheet ghi rõ còn trống (thay vì để ô trống).
  if (/\b(trong|available|avail|free|empty|ok)\b/.test(t)) return ok("AVAILABLE");
  // Ô có chữ lạ nhưng không trống → coi như không bán được (an toàn).
  return { status: "BOOKED", known: false };
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
 * Các link CSV cho một tab (gid), thử theo thứ tự — chỉ còn là DỰ PHÒNG khi
 * không đọc được bảng HTML (xem fetchTabGrid): CSV mất thông tin Ô GỘP (giá trị
 * chỉ nằm ở ô góc trên-trái, phần còn lại rỗng → app tưởng còn trống). Dùng
 * /export trước vì nó trả đúng giá trị hiển thị của từng ô; gviz tự đoán KIỂU
 * của cả cột và trả rỗng những ô lệch kiểu (vd ô ngày thật giữa cột chữ).
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
interface DateBlock {
  headerRow: number;
  dateCols: { col: number; date: Date }[];
}

/** Dựng cột→ngày từ các ô ngày của MỘT hàng tiêu đề (gán năm nhất quán cả hàng). */
function buildDateCols(
  cells: { col: number; dm: DayMonth }[],
  ref: Date,
): { dateCols: { col: number; date: Date }[]; sawYear: boolean } {
  // Năm neo = tháng của ô đầu (ưu tiên năm ghi rõ nếu có).
  const first = cells[0].dm;
  let year = first.y ?? yearForMonth(first.mo, ref);
  let prevMo = first.mo;
  let sawYear = false;

  const dateCols: { col: number; date: Date }[] = [];
  for (const { col, dm } of cells) {
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
  return { dateCols, sawYear };
}

/**
 * Dò MỌI khối ngày trong tab:
 * - Bố cục thường: 1 hàng tiêu đề ngày duy nhất (chọn hàng nhiều ô ngày nhất).
 * - Bố cục "khối tuần" lặp lại (mỗi tuần 1 hàng tiêu đề `2/11..8/11`, dưới là
 *   các hàng phòng, rồi lại tuần kế): nhận diện khi có ≥2 hàng tiêu đề CÙNG bộ
 *   cột; hàng tiêu đề khác bộ cột (bảng phụ bên cạnh) bị bỏ qua. Khối "mảnh"
 *   chỉ còn 1–2 ngày (tuần vắt đầu/cuối tháng) được nhận khi cột nằm trong bộ
 *   cột chung VÀ thứ-trong-tuần của ngày khớp đúng thứ của cột đó ở các khối đủ.
 */
function detectDateBlocks(rows: string[][], ref: Date): DateBlock[] {
  const candidates: { row: number; cells: { col: number; dm: DayMonth }[] }[] = [];
  for (let r = 0; r < rows.length; r++) {
    const cells: { col: number; dm: DayMonth }[] = [];
    for (let c = 0; c < rows[r].length; c++) {
      const dm = parseDayMonth(rows[r][c]);
      if (dm) cells.push({ col: c, dm });
    }
    if (cells.length > 0) candidates.push({ row: r, cells });
  }
  // Hàng tiêu đề ngày thật có ngày TĂNG DẦN theo cột (cách nhau ≤ số cột). Hàng thống
  // kê kiểu tỉ số "5/12", "3/12", "7/12" (≤12 phòng) cũng parse được thành ngày nhưng
  // lộn xộn → loại, tránh bị nhận làm khối ngày thứ 2 rồi gán ngày sai cho phòng.
  const strong = candidates.filter((c) => c.cells.length >= 3 && looksLikeDateHeader(c.cells, ref));
  if (strong.length === 0) return [];

  // Gom hàng tiêu đề theo "chữ ký" bộ cột.
  const bySig = new Map<string, typeof strong>();
  for (const c of strong) {
    const sig = c.cells.map((x) => x.col).join(",");
    const list = bySig.get(sig);
    if (list) list.push(c);
    else bySig.set(sig, [c]);
  }
  let group = [...bySig.values()].sort((a, b) => b.length - a.length)[0];
  if (group.length < 2) {
    // Không có bố cục lặp → hành vi cũ: 1 tiêu đề tốt nhất (nhiều ô ngày nhất).
    let best = strong[0];
    for (const c of strong) if (c.cells.length > best.cells.length) best = c;
    group = [best];
  }

  const blocks: DateBlock[] = [];
  for (const cand of group) {
    const { dateCols, sawYear } = buildDateCols(cand.cells, ref);
    if (dateCols.length < 3) continue;
    // Tab không ghi năm → năm chỉ là phỏng đoán theo tháng hiện tại. Nếu sheet có
    // hàng "thứ" thì đối chiếu thứ trong tuần để sửa lệch ±1 năm (vd tab "Tháng 4"
    // của năm đã qua bị đoán nhầm thành năm sau).
    if (!sawYear) applyWeekdayYearShift(rows, cand.row, dateCols);
    fillMissingDateCols(rows, cand.row, dateCols);
    blocks.push({ headerRow: cand.row, dateCols });
  }

  if (blocks.length >= 2) {
    // Thứ-trong-tuần của từng cột phải nhất quán giữa các khối đủ mới dám nhận khối mảnh.
    const colWd = new Map<number, number>();
    let consistent = true;
    for (const b of blocks) {
      for (const dc of b.dateCols) {
        const wd = dc.date.getUTCDay();
        const cur = colWd.get(dc.col);
        if (cur == null) colWd.set(dc.col, wd);
        else if (cur !== wd) consistent = false;
      }
    }
    if (consistent) {
      const used = new Set(blocks.map((b) => b.headerRow));
      for (const cand of candidates) {
        if (used.has(cand.row) || cand.cells.length >= 3) continue;
        const { dateCols } = buildDateCols(cand.cells, ref);
        if (dateCols.length === 0 || dateCols.length !== cand.cells.length) continue;
        if (dateCols.every((dc) => colWd.get(dc.col) === dc.date.getUTCDay())) {
          blocks.push({ headerRow: cand.row, dateCols });
        }
      }
    }
  }
  blocks.sort((a, b) => a.headerRow - b.headerRow);
  return blocks;
}

/** ≥80% cặp ô ngày kề nhau có ngày tăng và khoảng cách ngày ≤ khoảng cách cột. */
function looksLikeDateHeader(cells: { col: number; dm: DayMonth }[], ref: Date): boolean {
  const { dateCols } = buildDateCols(cells, ref);
  if (dateCols.length < 3) return false;
  let good = 0;
  for (let i = 1; i < dateCols.length; i++) {
    const dayDiff = Math.round((dateCols[i].date.getTime() - dateCols[i - 1].date.getTime()) / DAY_MS);
    const colDiff = dateCols[i].col - dateCols[i - 1].col;
    if (dayDiff > 0 && dayDiff <= colDiff) good++;
  }
  return good / (dateCols.length - 1) >= 0.8;
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

/** Nhãn tháng kiểu "Tháng 8", "Tháng 1/2026", "Tháng4/2026" → {mo, y|null}. */
function parseMonthLabel(raw: string): { mo: number; y: number | null } | null {
  const m = norm(raw).match(/^thang\s*(\d{1,2})(?:\s+(\d{2,4}))?$/);
  if (!m) return null;
  const mo = +m[1];
  if (mo < 1 || mo > 12) return null;
  let y: number | null = m[2] ? +m[2] : null;
  if (y != null && y < 100) y += 2000;
  return { mo, y };
}

/** Ô chỉ ghi SỐ NGÀY trần: "1", "17 ( m 1 tết)" → 1..31. */
function parseDayNumber(raw: string): number | null {
  const m = raw.trim().match(/^(\d{1,2})\b/);
  if (!m) return null;
  const d = +m[1];
  return d >= 1 && d <= 31 ? d : null;
}

/**
 * Suy năm cho khối tháng không ghi năm bằng hàng "thứ" CỦA CHÍNH KHỐI (1–2 hàng
 * ngay dưới hàng số ngày) — không quét cả tab, vì tab kiểu khối-tháng có nhiều
 * hàng thứ của các tháng khác dễ trùng khớp nhầm (vd Tháng 8 2025 và Tháng 8
 * 2026 cùng tab). Không có hàng thứ / không phân định được → dùng năm đoán.
 */
function inferYearByWeekday(
  rows: string[][],
  headerRow: number,
  mo: number,
  dayCells: { col: number; d: number }[],
  ref: Date,
): number {
  const guess = yearForMonth(mo, ref);
  for (let r = headerRow + 1; r <= Math.min(headerRow + 2, rows.length - 1); r++) {
    let found = false;
    for (const y of [guess, guess - 1, guess + 1]) {
      let match = 0;
      let wrong = 0;
      for (const { col, d } of dayCells) {
        const wd = parseWeekday(rows[r][col] ?? "");
        if (wd == null) continue;
        const date = safeDate(y, mo, d);
        if (!date) continue;
        found = true;
        if (date.getUTCDay() === wd) match++;
        else wrong++;
      }
      if (wrong === 0 && match >= 3) return y;
    }
    if (found) break; // có hàng thứ nhưng không năm nào khớp sạch → dùng guess
  }
  return guess;
}

/**
 * Bố cục "khối tháng" (vd Pao homestay): CẢ NĂM trong 1 tab, mỗi tháng là một
 * khối gồm hàng nhãn "Tháng 8"/"Tháng 1/2026" → hàng SỐ NGÀY trần "1,2,...,31"
 * (không có tháng nên parseDayMonth không nhận ra) → hàng thứ → các hàng phòng.
 * Nhận diện: ô đầu tiên của hàng là nhãn tháng, trong ≤3 hàng kế có hàng ≥10 số
 * 1..31 tăng dần. Năm lấy từ nhãn, thiếu thì suy bằng hàng thứ của khối.
 */
function detectMonthBlocks(rows: string[][], ref: Date): DateBlock[] {
  const blocks: DateBlock[] = [];
  const used = new Set<number>(); // hàng số-ngày đã nhận (tránh 2 nhãn trỏ cùng 1 hàng)
  for (let r = 0; r < rows.length; r++) {
    const label = rows[r].map((c) => c.trim()).find((c) => c);
    if (!label) continue;
    const ml = parseMonthLabel(label);
    if (!ml) continue;
    for (let hr = r + 1; hr <= Math.min(r + 3, rows.length - 1); hr++) {
      if (used.has(hr)) break;
      const dayCells: { col: number; d: number }[] = [];
      for (let c = 0; c < rows[hr].length; c++) {
        const d = parseDayNumber(rows[hr][c]);
        if (d != null) dayCells.push({ col: c, d });
      }
      if (dayCells.length < 10) continue;
      if (dayCells.some((dc, i) => i > 0 && dc.d <= dayCells[i - 1].d)) continue;
      const year = ml.y ?? inferYearByWeekday(rows, hr, ml.mo, dayCells, ref);
      const dateCols: { col: number; date: Date }[] = [];
      for (const { col, d } of dayCells) {
        const date = safeDate(year, ml.mo, d);
        if (date) dateCols.push({ col, date });
      }
      if (dateCols.length >= 3) {
        blocks.push({ headerRow: hr, dateCols });
        used.add(hr);
      }
      break; // mỗi nhãn tháng nhận tối đa 1 hàng số ngày
    }
  }
  return blocks;
}

/**
 * Dò hướng bảng: thử kiểu ngày-ngang trước, rồi bố cục khối-tháng, thất bại thì
 * xoay bảng rồi dò lại theo cùng thứ tự. DÒ trên lưới raw (ô gộp để trống như
 * CSV — giữ nguyên hành vi fillMissingDateCols/khớp tên phòng); trả kèm lưới
 * `data` (expanded, cùng hướng) để ĐỌC trạng thái ô.
 */
function detectLayout(
  grids: SheetGrids,
  ref: Date,
): { rows: string[][]; data: string[][]; blocks: DateBlock[] } | null {
  const sameGrid = grids.raw === grids.expanded; // fallback CSV: khỏi transpose 2 lần
  const direct = detectDateBlocks(grids.raw, ref);
  if (direct.length > 0) return { rows: grids.raw, data: grids.expanded, blocks: direct };
  const monthly = detectMonthBlocks(grids.raw, ref);
  if (monthly.length > 0) return { rows: grids.raw, data: grids.expanded, blocks: monthly };
  const flipped = transpose(grids.raw);
  const flippedData = sameGrid ? flipped : transpose(grids.expanded);
  const viaTranspose = detectDateBlocks(flipped, ref);
  if (viaTranspose.length > 0) return { rows: flipped, data: flippedData, blocks: viaTranspose };
  const monthlyT = detectMonthBlocks(flipped, ref);
  return monthlyT.length > 0 ? { rows: flipped, data: flippedData, blocks: monthlyT } : null;
}

/**
 * Bố cục "SỔ ĐẶT PHÒNG": mỗi hàng 1 booking (Mã/Tên phòng · Check-in · Check-out · Huỷ...).
 * Trả danh sách booking chưa huỷ (khoá các đêm [from, to)), hoặc null nếu tab không phải dạng này.
 */
type BookingLogRow = { label: string; from: Date; to: Date };
const MAX_BOOKING_NIGHTS = 60; // chặn dòng gõ nhầm năm/tháng làm khoá cả năm

function detectBookingLog(rows: string[][]): { bookings: BookingLogRow[]; rooms: string[] } | null {
  for (let h = 0; h < Math.min(rows.length, 10); h++) {
    const hdr = rows[h].map((c) => norm(c ?? ""));
    const find = (re: RegExp) => hdr.findIndex((c) => re.test(c));
    const cIn = find(/^(check ?in|ngay (den|nhan phong|nhan)|nhan phong)$/);
    const cOut = find(/^(check ?out|ngay (di|tra phong|tra)|tra phong)$/);
    const cRoom = find(/^(ma phong|ten phong|phong|room|ma can|can)$/);
    if (cIn < 0 || cOut < 0 || cRoom < 0) continue;
    const cCancel = find(/huy/);
    const cStatus = find(/^trang thai$/);
    const full = (raw: string): Date | null => {
      const dm = parseDayMonth(raw ?? "");
      return dm && dm.y ? safeDate(dm.y, dm.mo, dm.d) : null;
    };
    const bookings: BookingLogRow[] = [];
    const rooms = new Set<string>();
    for (const row of rows.slice(h + 1)) {
      const label = (row[cRoom] ?? "").trim();
      if (!label) continue;
      rooms.add(label);
      const from = full(row[cIn]);
      const to = full(row[cOut]);
      if (!from || !to || to <= from) continue;
      if ((to.getTime() - from.getTime()) / 86400000 > MAX_BOOKING_NIGHTS) continue;
      const cancel = cCancel >= 0 ? norm(row[cCancel] ?? "") : "";
      const status = cStatus >= 0 ? norm(row[cStatus] ?? "") : "";
      const cancelled = (/huy|cancel/.test(cancel) && !/chua huy|khong huy/.test(cancel)) || /\b(da huy|huy|cancel)/.test(status);
      if (!cancelled) bookings.push({ label, from, to });
    }
    return { bookings, rooms: [...rooms] };
  }
  return null;
}

/** names = tên phòng + các bí danh trong sheet (Room.sheetAlias). */
type RoomRef = { id: string; name: string; roomTypeId: string; names: string[] };
/** `checkout` = ô ghi thuần "Check out" (không kèm check in) — xem xử lý quy ước sau vòng tab. */
type SheetEntry = { room: RoomRef; date: Date; status: RoomStatus; checkout?: boolean };

/** Ô chỉ ghi "Check out" (không phải ô đổi khách "Check out / Check in"). */
function isPureCheckout(raw: string): boolean {
  const t = norm(raw);
  return (/check ?out/.test(t) || t === "out") && !/check ?in/.test(t) && !/(^| )in$/.test(t);
}

/**
 * Hai quy ước "Check out" trong sheet chủ nhà:
 * - Mặc định: ô ngày khách TRẢ phòng (buổi sáng) ⇒ đêm đó trống.
 * - "Ở xong": sau khi khách đi, chủ nhà đổi MỌI đêm khách đã ở thành "Check out" (vd Nhà của An)
 *   ⇒ nhận diện khi có phòng ghi "Check out" ở 2 NGÀY LIỀN NHAU (quy ước mặc định không thể có).
 * Sheet theo quy ước "ở xong": ô "Check out" của ngày ĐÃ QUA tính là ĐÃ ĐẶT (lịch quá khứ khớp
 * sheet). Ngày từ hôm nay trở đi giữ quy tắc cũ — không ảnh hưởng tình trạng bán.
 */
function applyCheckoutAsStay(entries: SheetEntry[], ref: Date): number {
  const days = new Map<string, Set<number>>();
  for (const e of entries) {
    if (!e.checkout) continue;
    let set = days.get(e.room.id);
    if (!set) days.set(e.room.id, (set = new Set()));
    set.add(e.date.getTime());
  }
  const DAY = 86_400_000;
  const stayStyle = [...days.values()].some((set) => [...set].some((t) => set.has(t + DAY)));
  if (!stayStyle) return 0;
  let n = 0;
  for (const e of entries) {
    if (e.checkout && e.date < ref && e.status === "AVAILABLE") {
      e.status = "BOOKED";
      n++;
    }
  }
  return n;
}

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
  const consider = (rm: RoomRef, matchLen: number) => {
    if (matchLen > bestLen) {
      best = rm;
      bestLen = matchLen;
      ambiguous = false;
    } else if (matchLen === bestLen && rm.id !== best?.id) {
      ambiguous = true;
    }
  };
  for (const rm of rooms) for (const rmName of rm.names) {
    const rn = norm(rmName);
    if (!rn) continue;
    // 1) Nhãn CHỨA tên phòng nguyên vẹn ("DON VIP Shan 1" ⊃ "Shan 1").
    if (padded.includes(` ${rn} `)) {
      consider(rm, rn.length);
      continue;
    }
    // 2) Lõi tên phòng = bỏ từ chung đứng đầu ("Phòng 201" → "201"; "Phòng Cộng
    //    Đồng" → "cong dong"). Nhãn khớp/chứa lõi ("201 (4ng) BỒN TẮM" ⊃ "201").
    //    Lõi số cần ≥3 chữ số, lõi chữ cần ≥4 ký tự — tránh dính cột số người.
    const core = rn.replace(/^(?:phong|can|nha|room|house)\s+/, "");
    if (core !== rn && (/^\d+$/.test(core) ? core.length >= 3 : core.length >= 4)) {
      if (n === core || padded.includes(` ${core} `)) {
        consider(rm, core.length);
        continue;
      }
    }
    // 3) Sheet ghi TẮT: tên phòng chứa nhãn ("Phòng Cộng Đồng" ⊃ "Cộng Đồng").
    //    Nhãn phải ≥4 ký tự; nhiều phòng cùng chứa (vd "Family") → ambiguous.
    if (n.length >= 4 && ` ${rn} `.includes(padded)) {
      consider(rm, n.length);
      continue;
    }
    // 4) Lỗi gõ sai đúng 1 ký tự ("Bulgalow gỗ" ≈ "Bungalow Gỗ") — chỉ cho tên
    //    không chứa chữ số (tránh "Samu 1" ≈ "Samu 2").
    if (fuzzyOneChar(n, rn)) consider(rm, rn.length);
  }
  return ambiguous ? null : best;
}

/** Hai chuỗi cùng độ dài (≥6), không có chữ số, khác nhau đúng 1 ký tự. */
function fuzzyOneChar(a: string, b: string): boolean {
  if (a.length !== b.length || a.length < 6) return false;
  if (/\d/.test(a) || /\d/.test(b)) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i] && ++diff > 1) return false;
  }
  return diff === 1;
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
 * Lưới ô của một tab, 2 phiên bản:
 * - raw: ô gộp chỉ giữ giá trị ở ô góc trên-trái (giống CSV) — dùng để DÒ BỐ CỤC
 *   (hàng tiêu đề ngày, tên phòng), giữ nguyên hành vi cũ như fillMissingDateCols.
 * - expanded: giá trị ô gộp được TRẢI RA toàn vùng gộp — dùng để ĐỌC TRẠNG THÁI,
 *   vì chủ sheet hay gộp ô "Đã đặt" ngang nhiều phòng (1 khách đặt nhiều phòng)
 *   hoặc dọc nhiều đêm; CSV làm mất thông tin này nên trước đây chỉ khoá 1 phòng.
 */
interface SheetGrids {
  raw: string[][];
  expanded: string[][];
}

/** Giải mã entity HTML thường gặp trong trang htmlview. */
function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, "&");
}

/** Nội dung text của một ô HTML: bỏ thẻ con (softmerge/div/a...), gộp khoảng trắng. */
function cellText(inner: string): string {
  return decodeEntities(
    inner.replace(/<br[^>]*>/gi, " ").replace(/<[^>]+>/g, ""),
  )
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Parse bảng HTML của MỘT tab (trang htmlview/sheet) thành lưới ô, trải ô gộp
 * theo đúng thuật toán bảng HTML: colspan chiếm cột kế bên, rowspan "gánh" xuống
 * các hàng dưới. Ô <th> (số thứ tự hàng/chữ cái cột) và ô freezebar bị bỏ qua.
 * Lưu ý: ô chữ-tràn-sang-ô-trống (class "softmerge") KHÔNG có colspan nên không
 * bị trải nhầm — chỉ ô gộp thật mới có colspan/rowspan.
 */
function parseHtmlGrid(html: string): SheetGrids | null {
  const tStart = html.indexOf("<table");
  if (tStart < 0) return null;
  const tEnd = html.indexOf("</table>", tStart);
  const table = (tEnd > tStart ? html.slice(tStart, tEnd) : html.slice(tStart))
    .replace(/<thead[\s\S]*?<\/thead>/i, "");

  const rawRows: string[][] = [];
  const expRows: string[][] = [];
  // carry[c] = ô gộp dọc từ hàng trên còn phủ xuống `left` hàng nữa tại cột c.
  const carry: ({ left: number; value: string } | null)[] = [];

  const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let tr: RegExpExecArray | null;
  while ((tr = trRe.exec(table))) {
    const cellRe = /<(td|th)\b([^>]*)>([\s\S]*?)<\/\1>/gi;
    const tds: { attrs: string; text: string }[] = [];
    let m: RegExpExecArray | null;
    while ((m = cellRe.exec(tr[1]))) {
      if (m[1].toLowerCase() !== "td") continue; // th = tiêu đề hàng/cột của trang
      const cls = m[2].match(/class="([^"]*)"/i)?.[1] ?? "";
      if (cls.includes("freezebar")) continue; // vạch cố định hàng/cột, không phải ô dữ liệu
      tds.push({ attrs: m[2], text: cellText(m[3]) });
    }
    const hasCarry = carry.some((c) => c && c.left > 0);
    if (tds.length === 0 && !hasCarry) continue; // hàng toàn <th> (tiêu đề cột) / hàng rỗng

    const raw: string[] = [];
    const exp: string[] = [];
    let col = 0;
    const takeCarry = () => {
      while (carry[col] && carry[col]!.left > 0) {
        raw[col] = "";
        exp[col] = carry[col]!.value;
        carry[col]!.left -= 1;
        col++;
      }
    };
    for (const cell of tds) {
      takeCarry();
      const cs = Math.max(1, +(cell.attrs.match(/colspan="?(\d+)/i)?.[1] ?? 1));
      const rs = Math.max(1, +(cell.attrs.match(/rowspan="?(\d+)/i)?.[1] ?? 1));
      for (let k = 0; k < cs; k++) {
        raw[col] = k === 0 ? cell.text : "";
        exp[col] = cell.text;
        carry[col] = rs > 1 ? { left: rs - 1, value: cell.text } : null;
        col++;
      }
    }
    // Ô gộp dọc còn "gánh" ở các cột sau ô cuối của hàng này.
    for (let c = col; c < carry.length; c++) {
      const cy = carry[c];
      if (cy && cy.left > 0) {
        raw[c] = "";
        exp[c] = cy.value;
        cy.left -= 1;
      }
    }
    rawRows.push(raw);
    expRows.push(exp);
  }
  if (rawRows.length === 0) return null;

  // Chuẩn hoá: lấp lỗ (cột hàng ngắn / sau ô gộp) thành "" cho cả 2 lưới.
  const width = Math.max(0, ...rawRows.map((r) => r.length), ...expRows.map((r) => r.length));
  for (const rows of [rawRows, expRows])
    for (const r of rows) for (let c = 0; c < width; c++) r[c] ??= "";
  return { raw: rawRows, expanded: expRows };
}

/** Tải bảng HTML của một tab (có thông tin ô gộp). Trả null nếu không đọc được. */
async function fetchTabHtml(id: string, gid: string): Promise<SheetGrids | null> {
  const url = `https://docs.google.com/spreadsheets/d/${id}/htmlview/sheet?headers=true&gid=${gid}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: ctrl.signal,
      headers: { "User-Agent": "Mozilla/5.0 TaXuaBooking sheet sync" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return parseHtmlGrid(await res.text());
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Lưới ô của một tab: ưu tiên bảng HTML (giữ được ô gộp), hỏng thì rơi về CSV
 * (ô gộp thành ô trống — ít nhất không tệ hơn hành vi cũ).
 */
async function fetchTabGrid(id: string, gid: string): Promise<SheetGrids | null> {
  const viaHtml = await fetchTabHtml(id, gid);
  if (viaHtml) return viaHtml;
  const csv = await fetchTabCsv(id, gid);
  return csv ? { raw: csv, expanded: csv } : null;
}

/**
 * Đồng bộ MỘT homestay từ sheet đã lưu ở Service.sheetUrl. Tự liệt kê MỌI tab
 * (mỗi tab 1 tháng) từ 1 link và đồng bộ lần lượt; tab không phải lịch hoặc đã
 * qua sẽ bị bỏ qua.
 */
/**
 * Nguồn lịch dạng API JSON của website homestay (vd https://thacmaytaxua.vn/api/calendar/all)
 * thay cho Google Sheet: `?month=&year=` → { success, calendar: [{ fullDateStr, rooms: {
 * <id>: { sheetName, name, isBooked } } }] }.
 */
export function isCalendarApiUrl(url: string): boolean {
  return /^https?:\/\/[^/]+\/api\/calendar\/all(?:[?#]|$)/i.test(url.trim());
}

const CALENDAR_API_MONTHS = 7; // tháng hiện tại + 6 tháng tới

type CalendarApiDay = {
  fullDateStr: string;
  rooms?: Record<string, { sheetName?: string; name?: string; isBooked?: boolean }>;
};

/** Tải lịch từng tháng (song song). days = null khi tháng đó tải lỗi. */
async function fetchCalendarApiMonths(
  url: string,
  ref: Date,
): Promise<{ label: string; days: CalendarApiDay[] | null }[]> {
  const base = new URL(url.trim());
  const months = Array.from({ length: CALENDAR_API_MONTHS }, (_, i) => {
    const d = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() + i, 1));
    return { mo: d.getUTCMonth() + 1, y: d.getUTCFullYear() };
  });
  return Promise.all(
    months.map(async ({ mo, y }) => {
      const label = `Tháng ${mo}/${y}`;
      const u = new URL(base);
      u.searchParams.set("month", String(mo));
      u.searchParams.set("year", String(y));
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 20000);
        const res = await fetch(u, {
          signal: ctrl.signal,
          headers: { "User-Agent": "Mozilla/5.0 TaXuaBooking calendar sync", Accept: "application/json" },
          cache: "no-store",
        });
        clearTimeout(timer);
        if (!res.ok) return { label, days: null };
        const j = (await res.json()) as { success?: boolean; calendar?: CalendarApiDay[] };
        if (j.success === false || !Array.isArray(j.calendar)) return { label, days: null };
        return { label, days: j.calendar };
      } catch {
        return { label, days: null };
      }
    }),
  );
}

export async function syncServiceSheet(
  serviceId: string,
  source: SheetSyncSource = "MANUAL",
): Promise<SheetSyncResult> {
  const base: SheetSyncResult = {
    serviceId,
    ok: false,
    summary: "",
    matchedRooms: 0,
    unmatchedRows: [],
    missingRooms: [],
    days: 0,
    changes: 0,
    syncedTabs: [],
    skippedTabs: [],
  };

  const service = await prisma.service.findUnique({
    where: { id: serviceId },
    select: {
      sheetUrl: true,
      roomTypes: {
        select: {
          id: true,
          rooms: { select: { id: true, name: true, roomTypeId: true, sheetAlias: true } },
        },
      },
    },
  });
  if (!service) return { ...base, error: "Không tìm thấy homestay." };
  if (!service.sheetUrl) return { ...base, error: "Chưa có link Google Sheet." };

  // Nguồn lịch: Google Sheet (mặc định) hoặc API lịch JSON của website homestay.
  const apiSource = isCalendarApiUrl(service.sheetUrl);
  const id = apiSource ? "" : extractSheetId(service.sheetUrl);
  if (id === null) return fail(serviceId, base, "Link Google Sheet không hợp lệ.", source);

  // Bảng tra phòng theo tên đã chuẩn hoá.
  const allRooms: RoomRef[] = service.roomTypes.flatMap((rt) =>
    rt.rooms.map((rm) => ({
      id: rm.id,
      name: rm.name,
      roomTypeId: rm.roomTypeId,
      names: [rm.name, ...(rm.sheetAlias ?? "").split(/[,;\n]/).map((x) => x.trim()).filter(Boolean)],
    })),
  );
  const roomByName = new Map<string, RoomRef>();
  for (const rm of allRooms) for (const n of rm.names) if (!roomByName.has(norm(n))) roomByName.set(norm(n), rm);

  const ref = today();

  try {
    // 1) Liệt kê mọi tab của spreadsheet. Không đọc được → chỉ dùng tab trong link.
    let tabs = apiSource ? [] : await listSheetTabs(id);
    if (!apiSource && tabs.length === 0) tabs = [{ name: "(trang tính)", gid: extractGid(service.sheetUrl) }];
    tabs = tabs.slice(0, 36); // chặn trường hợp bất thường

    const entries: SheetEntry[] = [];
    const matchedRoomIds = new Set<string>();
    const unmatched = new Set<string>();
    const unknownValues = new Set<string>(); // nội dung ô lạ (bị khoá "cho an toàn") để báo admin
    const syncedTabs: string[] = [];
    const skippedTabs: string[] = [];
    let anyCalendarTab = false; // có ít nhất 1 tab nhận diện được là lịch
    let fetchFailed = false; // có tab tải không được → KHÔNG dọn khoá cũ (tránh mở nhầm)

    // 2a) Nguồn API lịch: mỗi tháng = 1 "tab"; mỗi ngày × phòng → isBooked.
    if (apiSource) {
      for (const m of await fetchCalendarApiMonths(service.sheetUrl, ref)) {
        if (!m.days) {
          fetchFailed = true;
          skippedTabs.push(m.label);
          continue;
        }
        anyCalendarTab = true;
        let seen = false;
        for (const day of m.days) {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(day.fullDateStr ?? "")) continue;
          const date = parseDateOnly(day.fullDateStr);
          for (const rm of Object.values(day.rooms ?? {})) {
            const room =
              matchRoom(roomByName, allRooms, rm.sheetName ?? "") ?? matchRoom(roomByName, allRooms, rm.name ?? "");
            if (!room) {
              if (rm.isBooked && date >= ref) unmatched.add(rm.sheetName || rm.name || "?");
              continue;
            }
            seen = true;
            matchedRoomIds.add(room.id);
            entries.push({ room, date, status: rm.isBooked ? "BOOKED" : "AVAILABLE" });
          }
        }
        (seen ? syncedTabs : skippedTabs).push(m.label);
      }
    }

    // 2) Tải song song rồi duyệt từng tab (kết quả giữ đúng thứ tự tab).
    const tabGrids = await Promise.all(tabs.map((t) => fetchTabGrid(id, t.gid)));
    for (let ti = 0; ti < tabs.length; ti++) {
      const tab = tabs[ti];
      if (!tabGrids[ti]) fetchFailed = true; // tải lỗi (mạng/Google chặn) ≠ tab không phải lịch
      const detected = tabGrids[ti] ? detectLayout(tabGrids[ti]!, ref) : null;
      // Không phải lưới lịch → thử bố cục "sổ đặt phòng" (mỗi hàng 1 booking).
      const log = !detected && tabGrids[ti] ? detectBookingLog(tabGrids[ti]!.raw) : null;
      if (log) {
        anyCalendarTab = true;
        const logRooms = new Map<string, RoomRef>();
        for (const label of log.rooms) {
          const room = matchRoom(roomByName, allRooms, label);
          if (room) logRooms.set(room.id, room);
          else if (log.bookings.some((b) => b.label === label && b.to > ref)) unmatched.add(label);
        }
        if (logRooms.size === 0) {
          skippedTabs.push(tab.name);
          continue;
        }
        // Đêm có booking → BOOKED (đẩy trước để thắng khi khử trùng lặp)...
        const booked = new Set<string>();
        let minT = ref.getTime();
        let maxT = ref.getTime() + 180 * 86400000;
        for (const b of log.bookings) {
          const room = matchRoom(roomByName, allRooms, b.label);
          if (!room) continue;
          minT = Math.min(minT, b.from.getTime());
          maxT = Math.max(maxT, b.to.getTime());
          for (let t = b.from.getTime(); t < b.to.getTime(); t += 86400000) {
            const k = `${room.id}|${t}`;
            if (booked.has(k)) continue;
            booked.add(k);
            entries.push({ room, date: new Date(t), status: "BOOKED" });
          }
        }
        // ...còn lại trong khoảng phủ → AVAILABLE, để booking bị huỷ/xoá khỏi sổ tự mở phòng.
        for (const room of logRooms.values()) {
          matchedRoomIds.add(room.id);
          for (let t = minT; t <= maxT; t += 86400000) {
            if (!booked.has(`${room.id}|${t}`)) entries.push({ room, date: new Date(t), status: "AVAILABLE" });
          }
        }
        syncedTabs.push(tab.name);
        continue;
      }
      if (!detected) {
        skippedTabs.push(tab.name);
        continue;
      }
      const { rows, data, blocks } = detected;
      anyCalendarTab = true;

      // Bố cục 1 khối: quét MỌI hàng của tab (như cũ). Bố cục nhiều khối (lịch
      // kiểu tuần-per-khối): mỗi khối chỉ quét các hàng từ sau tiêu đề của nó
      // tới trước tiêu đề khối kế — mỗi phòng xuất hiện 1 lần trong mỗi khối.
      const multi = blocks.length > 1;
      const seenInTab = new Set<string>(); // phòng đã khớp trong tab (đếm syncedTabs)
      for (let bi = 0; bi < blocks.length; bi++) {
        const block = blocks[bi];
        // Đồng bộ TOÀN BỘ ngày trong sheet (cả quá khứ) để lịch tháng trong admin
        // khớp sheet trọn tháng, không chỉ từ hôm nay trở đi.
        const dateCols = block.dateCols;
        const firstDateCol = Math.min(...dateCols.map((d) => d.col));
        const rStart = multi ? block.headerRow + 1 : 0;
        const rEnd = multi ? (blocks[bi + 1]?.headerRow ?? rows.length) : rows.length;
        // Phòng → hàng được chọn trong khối. Hàng khớp CHÍNH XÁC tên phòng thắng hàng
        // khớp gần đúng (vd hàng nhãn nhóm "FAMILY" khớp nhầm "Family 1" nằm phía trên
        // hàng thật "Family 1") — trước đây hàng gặp trước thắng, hàng thật bị bỏ qua.
        const picked = new Map<string, { room: RoomRef; r: number; exact: boolean }>();
        for (let r = rStart; r < rEnd; r++) {
          if (r === block.headerRow) continue;
          const row = rows[r]; // nhãn/tên phòng đọc từ lưới raw (ô gộp = ô đầu, như cũ)
          const dataRow = data[r]; // trạng thái đọc từ lưới expanded (ô gộp trải toàn vùng)
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
          let exact = false;
          for (const cand of candidates) {
            room = matchRoom(roomByName, allRooms, cand);
            if (room) {
              exact = roomByName.get(norm(cand))?.id === room.id;
              break;
            }
          }
          if (!room) {
            // Nhãn tiêu đề/nhãn tháng (vd hàng thứ ghi "Tháng 7/2026" ở cột đầu) → bỏ qua êm.
            if (candidates.some((c) => HEADER_LABELS.has(norm(c)) || parseMonthLabel(c))) continue;
            // Hàng thống kê của chủ nhà: nhãn kiểu "SL/Tổng/Tỉ lệ..." hoặc mọi ô
            // trong vùng ngày chỉ chứa số/%/tỉ số ("12", "85%", "5/14") → bỏ qua êm.
            if (candidates.some((c) => STATS_LABEL_RE.test(norm(c)))) continue;
            const cells = dateCols.map((dc) => (dataRow[dc.col] ?? "").trim()).filter(Boolean);
            if (cells.length > 0 && cells.every((v) => NUMERIC_CELL_RE.test(v))) continue;
            // Banner gộp (vd tiêu đề "TÌNH TRẠNG PHÒNG 2026" colspan cả hàng): giá trị
            // ô gộp bị TRẢI ra mọi cột ngày nên trông như "đã đặt". Nhận diện khi mọi
            // ô ngày không rỗng đều trùng đúng nhãn hàng → bỏ qua êm, không cảnh báo.
            const label = norm(candidates[0]);
            if (cells.length > 0 && cells.every((v) => norm(v) === label)) continue;
            // Dòng chú thích nằm dưới tiêu đề tháng gộp ("THÁNG 11/2026" trải các cột ngày).
            if (cells.length > 0 && cells.every((v) => parseMonthLabel(v))) continue;
            // Chỉ cảnh báo khi hàng có booking từ HÔM NAY trở đi — phòng chỉ còn
            // trong tab tháng đã qua (đã ngừng bán) không ảnh hưởng gì.
            const hasBooking = dateCols.some(
              (dc) => dc.date >= ref && cellStatus(dataRow[dc.col] ?? "") !== "AVAILABLE",
            );
            // Báo ĐỦ các ô nhãn của hàng, tên phòng (cột trái) trước — trước đây chỉ báo ô sát vùng
            // ngày nên sheet có cột "View" hiện cảnh báo khó hiểu kiểu "Full 1 mặt kính".
            if (hasBooking) unmatched.add([...candidates].reverse().join(UNMATCHED_SEP));
            continue;
          }
          const prev = picked.get(room.id);
          if (!prev || (!prev.exact && exact)) picked.set(room.id, { room, r, exact });
        }
        for (const { room, r } of picked.values()) {
          seenInTab.add(room.id);
          matchedRoomIds.add(room.id);
          const dataRow = data[r];
          for (const dc of dateCols) {
            const raw = dataRow[dc.col] ?? "";
            const { status, known } = classifyCell(raw);
            if (!known && dc.date >= ref && unknownValues.size < 20) unknownValues.add(raw.trim());
            entries.push({ room, date: dc.date, status, ...(isPureCheckout(raw) ? { checkout: true } : {}) });
          }
        }
      }

      if (seenInTab.size > 0) syncedTabs.push(tab.name);
      else skippedTabs.push(tab.name);
    }

    if (entries.length === 0) {
      if (!anyCalendarTab)
        throw new Error("Không nhận diện được tab lịch nào trong sheet (thiếu hàng/cột ngày).");
      throw new Error("Không khớp được phòng nào. Hãy đảm bảo tên phòng trong sheet trùng tên phòng trong app.");
    }

    // Sheet ghi "Check out" cho cả các đêm khách đã ở ⇒ quá khứ tính là đã đặt.
    applyCheckoutAsStay(entries, ref);

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
    let reopens = 0; // số ô sheet mở lại thành Trống (xoá bản ghi cũ, không tạo mới)
    const deleteIds: string[] = [];
    const creates: { roomId: string; date: Date; status: RoomStatus; note: string }[] = [];
    // SHEET/API LÀ NGUỒN CHUẨN: ô nào sheet có phủ thì tình trạng theo sheet — kể cả khi hệ
    // thống đang báo kín do KHOÁ TAY của admin/chủ nhà hay bản ghi nạp cũ (trước đây các khoá
    // này bị "đóng băng": sheet trống mà web vẫn báo kín mãi). Chỉ giữ nguyên 2 loại:
    //  - đơn thật đã xác nhận trên web (bookingId) — gỡ là bán trùng phòng khách đã đặt;
    //  - khoá từ lịch OTA (note "OTA#...") — nguồn ngoài khác, sheet không biết.
    let overridden = 0; // số ô khoá tay/nạp cũ bị sheet ghi đè
    let bookingConflicts = 0; // đêm (từ hôm nay) sheet để trống nhưng đơn web đang giữ
    for (const { room, date, status } of deduped) {
      const dk = toDateKey(date);
      const existing = existingByKey.get(`${room.id}|${dk}`);
      const ownedBySheet = existing?.note === SHEET_TAG;
      if (existing?.bookingId != null) {
        if (status === "AVAILABLE" && date >= ref) bookingConflicts++;
        continue;
      }
      if (existing?.note?.startsWith("OTA#")) continue;

      if (status === "AVAILABLE") {
        // Sheet trống → mở lại mọi khoá không thuộc đơn thật/OTA.
        if (existing && existing.status !== "AVAILABLE") {
          deleteIds.push(existing.id);
          reopens++;
          if (!ownedBySheet) overridden++;
          mark(affectedTypes, room.roomTypeId, dk);
        }
      } else {
        if (existing) {
          if (ownedBySheet && existing.status === status) continue; // không đổi → bỏ qua
          // Bản ghi cũ (SHEET khác trạng thái / khoá tay / bản ghi có note lạ) → thay bằng của sheet.
          deleteIds.push(existing.id);
          if (!ownedBySheet && existing.status !== status) overridden++;
        }
        creates.push({ roomId: room.id, date, status, note: SHEET_TAG });
        mark(affectedTypes, room.roomTypeId, dk);
      }
    }

    // Dọn KHOÁ CŨ của sheet: ngày (từ hôm nay) của phòng ĐÃ KHỚP mà sheet không còn
    // phủ nữa (tab tháng bị xoá, hàng đổi vị trí...) → trước đây bị khoá vĩnh viễn.
    // Chỉ làm khi MỌI tab tải được, để lỗi mạng tạm thời không mở nhầm phòng.
    // Phòng không còn khớp hàng nào thì giữ nguyên (đã báo "thiếu phòng").
    if (!fetchFailed && matchedRoomIds.size > 0) {
      const stale = await prisma.roomDayStatus.findMany({
        where: { roomId: { in: [...matchedRoomIds] }, note: SHEET_TAG, bookingId: null, date: { gte: ref } },
        select: { id: true, roomId: true, date: true },
      });
      const roomType = new Map(allRooms.map((rm) => [rm.id, rm.roomTypeId]));
      for (const x of stale) {
        const dk = toDateKey(x.date);
        if (dedupedByKey.has(`${x.roomId}|${dk}`)) continue;
        deleteIds.push(x.id);
        reopens++;
        mark(affectedTypes, roomType.get(x.roomId)!, dk);
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

    // SHEET DÙNG CHUNG cho nhiều homestay (vd Cloud Forest + Sunset Clouds, Happy Town + Haus Meej):
    // dòng của home KIA không phải lỗi → bỏ khỏi cảnh báo "không khớp".
    if (unmatched.size > 0 && id) {
      const siblings = await prisma.service.findMany({
        where: { id: { not: serviceId }, sheetUrl: { contains: id } },
        select: { roomTypes: { select: { rooms: { select: { id: true, name: true, roomTypeId: true, sheetAlias: true } } } } },
      });
      const sibRooms: RoomRef[] = siblings.flatMap((sv) =>
        sv.roomTypes.flatMap((rt) =>
          rt.rooms.map((rm) => ({
            id: rm.id,
            name: rm.name,
            roomTypeId: rm.roomTypeId,
            names: [rm.name, ...(rm.sheetAlias ?? "").split(/[,;\n]/).map((x) => x.trim()).filter(Boolean)],
          })),
        ),
      );
      if (sibRooms.length > 0) {
        const sibByName = new Map<string, RoomRef>();
        for (const rm of sibRooms) for (const n of rm.names) if (!sibByName.has(norm(n))) sibByName.set(norm(n), rm);
        for (const label of [...unmatched]) {
          if (label.split(UNMATCHED_SEP).some((part) => matchRoom(sibByName, sibRooms, part))) unmatched.delete(label);
        }
      }
    }

    const missing = allRooms.filter((rm) => !matchedRoomIds.has(rm.id)).map((rm) => rm.name);
    const changes = creates.length + reopens;
    const summary = `${syncedTabs.length} tab · ${matchedRoomIds.size} phòng · ${totalDays} ngày đã đồng bộ`;
    await prisma.service.update({
      where: { id: serviceId },
      data: { sheetSyncedAt: new Date(), sheetSyncResult: summary },
    });

    // Nhật ký: chạy tay ghi mọi lần; cron chỉ ghi khi có thay đổi (tránh spam 5').
    if (source === "MANUAL" || changes > 0) {
      const warns =
        (unmatched.size ? ` · ⚠ ${unmatched.size} dòng không khớp` : "") +
        (missing.length ? ` · ⚠ thiếu ${missing.length} phòng` : "") +
        (unknownValues.size ? ` · ⚠ ô không nhận ra (đang khoá): ${[...unknownValues].slice(0, 5).map((v) => `"${v}"`).join(", ")}` : "") +
        (overridden ? ` · sheet ghi đè ${overridden} ô khoá tay` : "") +
        (bookingConflicts ? ` · ⚠ ${bookingConflicts} đêm sheet để trống nhưng đơn web đang giữ (chủ nhà chưa ghi sheet?)` : "");
      await prisma.sheetSyncLog
        .create({ data: { serviceId, ok: true, source, summary: summary + warns, changes } })
        .catch(() => {});
    }

    return {
      serviceId,
      ok: true,
      summary,
      matchedRooms: matchedRoomIds.size,
      unmatchedRows: [...unmatched],
      missingRooms: missing,
      unknownValues: [...unknownValues],
      days: totalDays,
      changes,
      syncedTabs,
      skippedTabs,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Lỗi không rõ";
    return fail(serviceId, base, msg, source);
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

async function fail(
  serviceId: string,
  base: SheetSyncResult,
  msg: string,
  source: SheetSyncSource,
): Promise<SheetSyncResult> {
  await prisma.service
    .update({ where: { id: serviceId }, data: { sheetSyncedAt: new Date(), sheetSyncResult: `Lỗi: ${msg}` } })
    .catch(() => {});
  // Nhật ký lỗi: cron/booking lỗi LẶP LẠI giống hệt lần ghi gần nhất thì bỏ qua (tránh spam).
  try {
    const summary = `Lỗi: ${msg}`;
    if (source !== "MANUAL") {
      const last = await prisma.sheetSyncLog.findFirst({
        where: { serviceId },
        orderBy: { createdAt: "desc" },
        select: { ok: true, summary: true },
      });
      if (last && !last.ok && last.summary === summary) return { ...base, error: msg };
    }
    await prisma.sheetSyncLog.create({ data: { serviceId, ok: false, source, summary, changes: 0 } });
  } catch {
    /* log lỗi không được phép làm hỏng kết quả đồng bộ */
  }
  return { ...base, error: msg };
}

/**
 * Đồng bộ MỘT homestay NGAY TRƯỚC KHI đặt (cho chắc ăn), nhưng BỎ QUA nếu vừa
 * đồng bộ xong trong `maxAgeMs` gần đây (mặc định 60s) để không cào Google liên
 * tục. Lỗi sync không chặn việc đặt — chỉ cố làm tươi tình trạng phòng.
 */
export async function ensureServiceSheetFresh(
  serviceId: string,
  maxAgeMs = 60_000,
): Promise<{ synced: boolean; skipped: boolean; reason?: string; changes?: number }> {
  const svc = await prisma.service.findUnique({
    where: { id: serviceId },
    select: { sheetUrl: true, sheetSyncedAt: true, contactOnly: true },
  });
  if (!svc || !svc.sheetUrl || svc.contactOnly) return { synced: false, skipped: true, reason: "no-sheet" };
  if (svc.sheetSyncedAt && Date.now() - svc.sheetSyncedAt.getTime() < maxAgeMs) {
    return { synced: false, skipped: true, reason: "fresh" };
  }
  const res = await syncServiceSheet(serviceId, "BOOKING");
  return { synced: true, skipped: false, changes: res.changes };
}

/** Đồng bộ TẤT CẢ homestay có link sheet (dùng cho cron). */
export async function syncAllSheets(source: SheetSyncSource = "CRON"): Promise<SheetSyncResult[]> {
  const services = await prisma.service.findMany({
    where: { sheetUrl: { not: null }, category: { in: ["HOMESTAY", "BUNGALOW"] } },
    select: { id: true },
  });
  const out: SheetSyncResult[] = [];
  for (const s of services) out.push(await syncServiceSheet(s.id, source));
  // Dọn nhật ký cũ hơn 30 ngày (giữ bảng gọn khi cron chạy dày).
  const cutoff = new Date(Date.now() - 30 * 86_400_000);
  await prisma.sheetSyncLog.deleteMany({ where: { createdAt: { lt: cutoff } } }).catch(() => {});
  return out;
}
