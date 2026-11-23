import "server-only";
import ExcelJS from "exceljs";
import { SITE } from "./site";
import type { PayLine, ServicePayRow, StatsDateBy } from "./stats";

/**
 * Báo cáo ĐỐI SOÁT THANH TOÁN cho MỘT dịch vụ (gửi đối tác) — file .xlsx đã định dạng:
 * tiêu đề + thông tin đối tác + khối tổng hợp (công thức trỏ về dòng tổng) + bảng từng đơn
 * + dòng tổng (SUM) + ghi chú + chỗ ký hai bên. In A4 ngang, vừa 1 trang bề ngang.
 */

const C = {
  brand: "FF164632", // forest-800
  head: "FF226E4B", // forest-600
  soft: "FFF0F9F3", // forest-50
  soft2: "FFDCF0E2", // forest-100
  zebra: "FFF8FAF9",
  line: "FFD9DED9",
  gray: "FF6B7280",
  ink: "FF1F2937",
  amber: "FFB45309",
  amberSoft: "FFFFF7E6",
  red: "FFB91C1C",
  green: "FF1B583D",
  white: "FFFFFFFF",
};

const MONEY = '#,##0" đ";-#,##0" đ";"–"';
const STATUS: Record<string, string> = {
  NEW: "Mới",
  CONTACTING: "Đang liên hệ",
  CONFIRMED: "Đã xác nhận",
  COMPLETED: "Hoàn thành",
  CANCELLED: "Đã huỷ",
};
const PAY: Record<string, string> = { UNPAID: "Chưa thanh toán", DEPOSITED: "Đã cọc", PAID: "Đã thanh toán" };

const dmy = (k: string) => `${k.slice(8, 10)}/${k.slice(5, 7)}/${k.slice(0, 4)}`;
const vnNow = () => {
  const d = new Date(Date.now() + 7 * 3_600_000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
};
const vnDate = (iso: string) => dmy(new Date(new Date(iso).getTime() + 7 * 3_600_000).toISOString().slice(0, 10));

/** Cột bảng chi tiết. */
const COLS: { key: string; title: string; width: number; money?: boolean; center?: boolean; wrap?: boolean }[] = [
  { key: "stt", title: "STT", width: 5, center: true },
  { key: "code", title: "Mã đơn", width: 13 },
  { key: "created", title: "Ngày đặt", width: 11, center: true },
  { key: "customer", title: "Khách hàng", width: 20, wrap: true },
  { key: "phone", title: "Số điện thoại", width: 13, center: true },
  { key: "detail", title: "Chi tiết dịch vụ", width: 44, wrap: true },
  { key: "pax", title: "Số lượng", width: 10, center: true },
  { key: "use", title: "Ngày sử dụng", width: 12, center: true },
  { key: "end", title: "Ngày kết thúc", width: 12, center: true },
  { key: "status", title: "Trạng thái", width: 13, center: true },
  { key: "collector", title: "Bên thu tiền khách", width: 13, center: true, wrap: true },
  { key: "total", title: "Tiền bán ra", width: 14, money: true },
  { key: "discount", title: "Chiết khấu sàn", width: 13, money: true },
  { key: "payable", title: "Phải thanh toán", width: 15, money: true },
  { key: "paid", title: "Sàn đã thanh toán", width: 15, money: true },
  { key: "remaining", title: "Còn phải thanh toán", width: 15, money: true },
];
const NCOL = COLS.length;
const colOf = (key: string) => COLS.findIndex((c) => c.key === key) + 1;
const letter = (n: number) => {
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
};

const thin = { style: "thin" as const, color: { argb: C.line } };
const box = { top: thin, left: thin, bottom: thin, right: thin };

export async function buildServicePayWorkbook(opts: {
  row: ServicePayRow;
  fromKey: string;
  toKey: string;
  by: StatsDateBy;
}): Promise<Buffer> {
  const { row, fromKey, toKey, by } = opts;
  const lines: PayLine[] = [...row.lines].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.code.localeCompare(b.code)); // ngày đặt tăng dần

  const wb = new ExcelJS.Workbook();
  wb.creator = SITE.name;
  wb.created = new Date();
  wb.title = `Đối soát thanh toán – ${row.name}`;

  const ws = wb.addWorksheet("Đối soát", {
    properties: { defaultRowHeight: 18 },
    views: [{ showGridLines: false }],
    pageSetup: {
      paperSize: 9, // A4
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      horizontalCentered: true,
      margins: { left: 0.3, right: 0.3, top: 0.45, bottom: 0.55, header: 0.2, footer: 0.25 },
    },
    headerFooter: {
      oddFooter: `&L&8${SITE.name} · Đối soát ${row.name}&R&8Trang &P / &N`,
    },
  });
  ws.columns = COLS.map((c) => ({ key: c.key, width: c.width }));
  const last = letter(NCOL);
  const font = (o: Partial<ExcelJS.Font> = {}): Partial<ExcelJS.Font> => ({ name: "Arial", size: 10, color: { argb: C.ink }, ...o });

  // ---------- Đầu trang: thương hiệu ----------
  ws.mergeCells(`A1:F1`);
  ws.getCell("A1").value = SITE.name.toUpperCase();
  ws.getCell("A1").font = font({ size: 15, bold: true, color: { argb: C.brand } });
  ws.mergeCells(`G1:${last}1`);
  ws.getCell("G1").value = `taxuabooking.com · Hotline/Zalo ${SITE.defaultPhone} · ${SITE.email}`;
  ws.getCell("G1").font = font({ size: 9, color: { argb: C.gray } });
  ws.getCell("G1").alignment = { horizontal: "right", vertical: "middle" };
  ws.mergeCells(`A2:${last}2`);
  ws.getCell("A2").value = `${SITE.legalName} · MST ${SITE.taxCode} · ${SITE.legalAddress}`;
  ws.getCell("A2").font = font({ size: 9, color: { argb: C.gray } });
  ws.getRow(1).height = 24;
  for (let c = 1; c <= NCOL; c++) ws.getCell(2, c).border = { bottom: { style: "medium", color: { argb: C.head } } };

  // ---------- Tiêu đề ----------
  ws.mergeCells(`A4:${last}4`);
  ws.getCell("A4").value = "BÁO CÁO ĐỐI SOÁT THANH TOÁN";
  ws.getCell("A4").font = font({ size: 18, bold: true, color: { argb: C.brand } });
  ws.getCell("A4").alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(4).height = 30;
  ws.mergeCells(`A5:${last}5`);
  ws.getCell("A5").value = `Kỳ đối soát: ${dmy(fromKey)} – ${dmy(toKey)} (theo ${by === "created" ? "ngày đặt đơn" : "ngày sử dụng dịch vụ"})`;
  ws.getCell("A5").font = font({ size: 11, italic: true, color: { argb: C.gray } });
  ws.getCell("A5").alignment = { horizontal: "center" };

  // ---------- Bảng chi tiết: vị trí cố định để khối tổng hợp trỏ công thức ----------
  const INFO_TOP = 7;
  const HEAD = 15; // dòng tiêu đề bảng
  const first = HEAD + 1;
  const lastData = HEAD + Math.max(1, lines.length);
  const totalRow = lastData + 1;
  const ref = (key: string) => `${letter(colOf(key))}${totalRow}`;

  // ---------- Khối thông tin đối tác (trái) ----------
  const info: [string, string][] = [
    ["Đối tác", row.name],
    ["Loại dịch vụ", row.kind],
    ["Chủ dịch vụ", row.owner ?? "—"],
    ["Số đơn đối soát", `${lines.length} đơn (đã xác nhận / hoàn thành)`],
    ["Ngày lập báo cáo", vnNow()],
  ];
  const sectionTitle = (r: number, from: string, to: string, text: string) => {
    ws.mergeCells(`${from}${r}:${to}${r}`);
    const c = ws.getCell(`${from}${r}`);
    c.value = text;
    c.font = font({ bold: true, color: { argb: C.white } });
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.head } };
    c.alignment = { vertical: "middle", indent: 1 };
    ws.getRow(r).height = 20;
  };
  sectionTitle(INFO_TOP, "A", "F", "THÔNG TIN ĐỐI TÁC");
  info.forEach(([k, v], i) => {
    const r = INFO_TOP + 1 + i;
    ws.mergeCells(`A${r}:C${r}`);
    ws.mergeCells(`D${r}:F${r}`);
    const kc = ws.getCell(`A${r}`);
    kc.value = k;
    kc.font = font({ color: { argb: C.gray } });
    kc.alignment = { indent: 1, vertical: "middle" };
    const vc = ws.getCell(`D${r}`);
    vc.value = v;
    vc.font = font({ bold: i === 0 });
    vc.alignment = { vertical: "middle", wrapText: true };
    for (let c = 1; c <= 6; c++) {
      ws.getCell(r, c).border = { bottom: thin };
      ws.getCell(r, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: i % 2 ? C.white : C.soft } };
    }
  });

  // ---------- Khối tổng hợp (phải) — công thức trỏ dòng TỔNG ----------
  const owes = lines.reduce((n, l) => n + l.providerOwes, 0);
  const sum = (f: (l: PayLine) => number) => lines.reduce((n, l) => n + f(l), 0);
  const summary: { k: string; f: string; v: number; strong?: boolean; warn?: boolean }[] = [
    { k: "Tổng tiền bán ra", f: ref("total"), v: sum((l) => l.total) },
    { k: "Chiết khấu sàn", f: ref("discount"), v: sum((l) => l.discount) },
    { k: "Phải thanh toán cho đối tác", f: ref("payable"), v: sum((l) => l.payable), strong: true },
    { k: "Sàn đã thanh toán", f: ref("paid"), v: sum((l) => l.paid) },
    { k: "CÒN PHẢI THANH TOÁN", f: ref("remaining"), v: sum((l) => l.remaining), strong: true, warn: true },
  ];
  const SL = letter(colOf("collector")); // nhãn: collector..discount
  const SLe = letter(colOf("discount"));
  const SV = letter(colOf("payable")); // giá trị: payable..remaining
  sectionTitle(INFO_TOP, SL, last, "TỔNG HỢP THANH TOÁN");
  summary.forEach((s, i) => {
    const r = INFO_TOP + 1 + i;
    ws.mergeCells(`${SL}${r}:${SLe}${r}`);
    ws.mergeCells(`${SV}${r}:${last}${r}`);
    const kc = ws.getCell(`${SL}${r}`);
    kc.value = s.k;
    kc.font = font({ bold: !!s.strong, color: { argb: s.strong ? C.ink : C.gray } });
    kc.alignment = { indent: 1, vertical: "middle" };
    const vc = ws.getCell(`${SV}${r}`);
    vc.value = { formula: s.f, result: s.v };
    vc.numFmt = MONEY;
    vc.font = font({ bold: !!s.strong, size: s.warn ? 12 : 10, color: { argb: s.warn ? (s.v > 0 ? C.amber : C.green) : C.ink } });
    vc.alignment = { horizontal: "right", vertical: "middle", indent: 1 };
    const bg = s.warn ? C.amberSoft : i % 2 ? C.white : C.soft;
    for (let c = colOf("collector"); c <= NCOL; c++) {
      ws.getCell(r, c).border = { bottom: thin };
      ws.getCell(r, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
    }
    if (s.warn) ws.getRow(r).height = 22;
  });
  if (owes > 0) {
    const r = INFO_TOP + 1 + summary.length;
    ws.mergeCells(`${SL}${r}:${last}${r}`);
    const c = ws.getCell(`${SL}${r}`);
    c.value = `* Đơn đối tác tự thu tiền khách: đối tác cần chuyển lại sàn ${owes.toLocaleString("vi-VN")} đ (phần chiết khấu).`;
    c.font = font({ size: 9, italic: true, color: { argb: C.red } });
    c.alignment = { wrapText: true, indent: 1 };
  }

  // ---------- Bảng chi tiết ----------
  ws.mergeCells(`A${HEAD - 1}:${last}${HEAD - 1}`);
  ws.getCell(`A${HEAD - 1}`).value = "CHI TIẾT TỪNG ĐƠN";
  ws.getCell(`A${HEAD - 1}`).font = font({ bold: true, size: 11, color: { argb: C.brand } });
  const hr = ws.getRow(HEAD);
  COLS.forEach((c, i) => {
    const cell = hr.getCell(i + 1);
    cell.value = c.title;
    cell.font = font({ bold: true, color: { argb: C.white }, size: 9.5 });
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.head } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = { top: thin, bottom: thin, left: { style: "thin", color: { argb: C.brand } }, right: { style: "thin", color: { argb: C.brand } } };
  });
  hr.height = 32;

  if (!lines.length) {
    ws.mergeCells(`A${first}:${last}${first}`);
    const c = ws.getCell(`A${first}`);
    c.value = "Không có đơn nào trong kỳ đối soát.";
    c.font = font({ italic: true, color: { argb: C.gray } });
    c.alignment = { horizontal: "center" };
  }
  lines.forEach((l, i) => {
    const r = ws.getRow(first + i);
    const detail = [l.combo ? `[Combo · phần ${l.side === "bus" ? "vé xe" : "phòng"}]` : "", l.detail, l.duration && !(l.combo && l.side === "bus") ? `(${l.duration})` : ""]
      .filter(Boolean)
      .join(" ");
    const values: Record<string, ExcelJS.CellValue> = {
      stt: i + 1,
      code: l.code,
      created: vnDate(l.createdAt),
      customer: l.customer,
      phone: l.phone,
      detail: detail || "—",
      pax: l.pax,
      use: dmy(l.useDate),
      end: l.endDate ? dmy(l.endDate) : "—",
      status: STATUS[l.status] ?? l.status,
      collector: l.collector === "PROVIDER" ? "Đối tác thu" : "Sàn thu",
      total: l.total,
      discount: l.discount,
      payable: l.payable,
      paid: l.paid,
      remaining: l.remaining,
    };
    COLS.forEach((c, j) => {
      const cell = r.getCell(j + 1);
      cell.value = values[c.key];
      cell.font = font({ size: 9.5 });
      cell.border = box;
      cell.alignment = {
        vertical: "top",
        horizontal: c.money ? "right" : c.center ? "center" : "left",
        wrapText: !!c.wrap,
      };
      if (c.money) cell.numFmt = MONEY;
      if (i % 2) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.zebra } };
    });
    r.getCell(colOf("code")).font = font({ size: 9.5, bold: true, color: { argb: C.brand } });
    r.getCell(colOf("payable")).font = font({ size: 9.5, bold: true });
    r.getCell(colOf("paid")).font = font({ size: 9.5, color: { argb: C.green } });
    r.getCell(colOf("remaining")).font = font({ size: 9.5, bold: true, color: { argb: l.remaining > 0 ? C.amber : C.green } });
    r.getCell(colOf("status")).font = font({ size: 9.5, color: { argb: l.status === "COMPLETED" ? C.green : C.ink } });
    if (l.collector === "PROVIDER") r.getCell(colOf("collector")).font = font({ size: 9.5, bold: true, color: { argb: C.amber } });
    // Ghi chú ô: tình trạng khách trả sàn
    r.getCell(colOf("status")).note = `Khách thanh toán: ${PAY[l.paymentStatus] ?? l.paymentStatus}`;
    // Ước lượng chiều cao theo độ dài mô tả (Excel không tự giãn dòng khi mở file).
    const wrapLines = Math.max(1, Math.ceil(detail.length / 44), Math.ceil(l.customer.length / 20));
    r.height = Math.max(18, wrapLines * 13.5 + 6);
  });

  // ---------- Dòng tổng ----------
  const tr = ws.getRow(totalRow);
  ws.mergeCells(`A${totalRow}:${letter(colOf("total") - 1)}${totalRow}`);
  tr.getCell(1).value = `TỔNG CỘNG (${lines.length} đơn)`;
  tr.getCell(1).alignment = { horizontal: "right", vertical: "middle", indent: 1 };
  for (let c = 1; c <= NCOL; c++) {
    const cell = tr.getCell(c);
    cell.font = font({ bold: true, color: { argb: C.brand } });
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.soft2 } };
    cell.border = { top: { style: "medium", color: { argb: C.head } }, bottom: { style: "medium", color: { argb: C.head } }, left: thin, right: thin };
  }
  for (const key of ["total", "discount", "payable", "paid", "remaining"] as const) {
    const L = letter(colOf(key));
    const cell = tr.getCell(colOf(key));
    cell.value = { formula: `SUM(${L}${first}:${L}${lastData})`, result: sum((l) => l[key]) };
    cell.numFmt = MONEY;
    cell.alignment = { horizontal: "right", vertical: "middle" };
  }
  tr.getCell(colOf("remaining")).font = font({ bold: true, color: { argb: C.amber } });
  tr.height = 24;

  // ---------- Ghi chú ----------
  let r = totalRow + 2;
  const notes = [
    "Ghi chú:",
    "• Chỉ tính đơn đã xác nhận / hoàn thành trong kỳ. Phải thanh toán = Tiền bán ra − Chiết khấu sàn (hoặc số đã thống nhất riêng cho đơn).",
    "• Đơn combo chỉ tính phần tiền của đối tác (tiền phòng cho homestay, tiền vé cho nhà xe).",
    "• \"Đối tác thu\": đối tác trực tiếp thu tiền khách — sàn không chuyển khoản, đối tác chuyển lại sàn phần chiết khấu.",
    "• Vui lòng đối chiếu và phản hồi trong 03 ngày làm việc kể từ ngày nhận báo cáo; quá hạn xem như hai bên thống nhất số liệu.",
  ];
  notes.forEach((t, i) => {
    ws.mergeCells(`A${r}:${last}${r}`);
    const c = ws.getCell(`A${r}`);
    c.value = t;
    c.font = font({ size: 9, bold: i === 0, italic: i > 0, color: { argb: i === 0 ? C.ink : C.gray } });
    r++;
  });

  // ---------- Ký xác nhận ----------
  r += 1;
  ws.mergeCells(`${SL}${r}:${last}${r}`);
  ws.getCell(`${SL}${r}`).value = `Ngày ${vnNow().slice(0, 2)} tháng ${vnNow().slice(3, 5)} năm ${vnNow().slice(6, 10)}`;
  ws.getCell(`${SL}${r}`).font = font({ italic: true, color: { argb: C.gray } });
  ws.getCell(`${SL}${r}`).alignment = { horizontal: "center" };
  r++;
  const sign = (from: string, to: string, title: string) => {
    ws.mergeCells(`${from}${r}:${to}${r}`);
    ws.getCell(`${from}${r}`).value = title;
    ws.getCell(`${from}${r}`).font = font({ bold: true });
    ws.getCell(`${from}${r}`).alignment = { horizontal: "center" };
    ws.mergeCells(`${from}${r + 1}:${to}${r + 1}`);
    ws.getCell(`${from}${r + 1}`).value = "(Ký, ghi rõ họ tên)";
    ws.getCell(`${from}${r + 1}`).font = font({ size: 9, italic: true, color: { argb: C.gray } });
    ws.getCell(`${from}${r + 1}`).alignment = { horizontal: "center" };
  };
  sign("B", "F", `ĐẠI DIỆN ${SITE.name.toUpperCase()}`);
  sign(SL, last, "ĐẠI DIỆN ĐỐI TÁC");

  // ---------- Lọc, in lặp tiêu đề bảng mỗi trang ----------
  if (lines.length) ws.autoFilter = { from: { row: HEAD, column: 1 }, to: { row: lastData, column: NCOL } };
  ws.pageSetup.printTitlesRow = `${HEAD}:${HEAD}`;
  ws.pageSetup.printArea = `A1:${last}${r + 5}`;

  return Buffer.from(await wb.xlsx.writeBuffer());
}
