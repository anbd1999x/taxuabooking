// Tiện ích iCal (RFC 5545 tối giản) cho đồng bộ lịch phòng với OTA.
// Không phụ thuộc thư viện ngoài. Dùng cho API route (server).

/** yyyy-mm-dd → yyyymmdd */
function compact(dateKey: string): string {
  return dateKey.replace(/-/g, "");
}
/** Date (UTC) → yyyy-mm-dd */
function key(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}
function addDaysKey(dateKey: string, n: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  return key(new Date(Date.UTC(y, m - 1, d + n)));
}

/**
 * Dựng file .ics liệt kê các đêm bận. Gộp các đêm liền nhau thành 1 sự kiện
 * (DTSTART = đêm đầu, DTEND = đêm cuối + 1 — theo chuẩn check-out loại trừ).
 */
export function buildRoomIcs(opts: { calName: string; uidBase: string; busyNights: string[] }): string {
  const nights = [...new Set(opts.busyNights)].sort();
  const now = new Date();
  const stamp = `${compact(key(now))}T000000Z`;
  const ev: string[] = [];
  let i = 0;
  while (i < nights.length) {
    const start = nights[i];
    let end = start;
    while (i + 1 < nights.length && nights[i + 1] === addDaysKey(end, 1)) {
      end = nights[++i];
    }
    i++;
    const dtEnd = addDaysKey(end, 1); // check-out = đêm cuối + 1
    ev.push(
      "BEGIN:VEVENT",
      `UID:${opts.uidBase}-${compact(start)}@taxua`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${compact(start)}`,
      `DTEND;VALUE=DATE:${compact(dtEnd)}`,
      "SUMMARY:Đã đặt (Tà Xùa Booking)",
      "TRANSP:OPAQUE",
      "END:VEVENT",
    );
  }
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Ta Xua Booking//Room Calendar//VI",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${opts.calName}`,
    ...ev,
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}

/** Lấy ngày (yyyy-mm-dd) từ một giá trị DTSTART/DTEND của iCal. */
function parseIcsDate(val: string): string | null {
  const m = val.match(/(\d{4})(\d{2})(\d{2})/);
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

/**
 * Phân tích .ics → danh sách các ĐÊM bận (yyyy-mm-dd). Mỗi VEVENT chặn các đêm
 * [DTSTART, DTEND) (DTEND là ngày check-out, không tính). Hỗ trợ VALUE=DATE và DATE-TIME.
 */
export function parseIcsBusyNights(text: string): string[] {
  // Gỡ gấp dòng (folding): dòng bắt đầu bằng space/tab là nối tiếp dòng trước.
  const unfolded = text.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "");
  const lines = unfolded.split(/\r?\n/);
  const nights = new Set<string>();
  let dtStart: string | null = null;
  let dtEnd: string | null = null;
  let inEvent = false;
  for (const line of lines) {
    const up = line.toUpperCase();
    if (up.startsWith("BEGIN:VEVENT")) { inEvent = true; dtStart = null; dtEnd = null; continue; }
    if (up.startsWith("END:VEVENT")) {
      if (dtStart) {
        const end = dtEnd ?? addDaysKey(dtStart, 1);
        for (let d = dtStart; d < end; d = addDaysKey(d, 1)) {
          nights.add(d);
          if (nights.size > 2000) break; // chặn feed lỗi quá lớn
        }
      }
      inEvent = false;
      continue;
    }
    if (!inEvent) continue;
    if (up.startsWith("DTSTART")) dtStart = parseIcsDate(line.split(":").pop() ?? "");
    else if (up.startsWith("DTEND")) dtEnd = parseIcsDate(line.split(":").pop() ?? "");
  }
  return [...nights];
}
