"use client";

import { dmy } from "@/lib/date-format";
import { useEffect, useMemo, useState } from "react";
import type { BookingStatus } from "@prisma/client";
import { EditBookingPopup } from "./EditBookingPopup";
import { ST, CAT_BADGE, CAT_OPTIONS, type BookingRow } from "./BookingsListClient";

/**
 * Chế độ TỔNG QUAN của trang Yêu cầu đặt: xem đơn theo lịch.
 *  - month  : lịch tháng (mỗi ô = các đơn trong ngày) + panel chi tiết ngày đang chọn
 *  - agenda : danh sách theo từng ngày đến trong tháng
 *  - year   : 12 tháng dạng heatmap (đậm = nhiều đơn), bấm ngày để mở lịch tháng
 * Chỉ nhận dữ liệu thuần đã dựng ở server; đổi trạng thái / mở "Xử lý" gọi ngược lên trang cha.
 */
export type CalendarView = "month" | "agenda" | "year";

const WD_SHORT = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
const WD_LONG = ["Chủ nhật", "Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy"];
const STATUS_ORDER: BookingStatus[] = ["NEW", "CONTACTING", "CONFIRMED", "COMPLETED", "CANCELLED"];
/** Nền ô lịch tháng theo số đơn (nhạt → đậm dần). */
const CELL_HEAT = ["#ffffff", "oklch(0.975 0.015 155)", "oklch(0.955 0.03 155)", "oklch(0.93 0.045 155)", "oklch(0.9 0.06 155)"];
/** Thang màu heatmap cả năm. */
const YEAR_HEAT = ["oklch(0.955 0.006 160)", "oklch(0.9 0.05 155)", "oklch(0.8 0.09 155)", "oklch(0.65 0.11 155)", "oklch(0.48 0.1 158)"];

const pad = (n: number) => String(n).padStart(2, "0");
const keyOf = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10);
const utc = (k: string) => Date.UTC(Number(k.slice(0, 4)), Number(k.slice(5, 7)) - 1, Number(k.slice(8, 10)));
const diffDays = (a: string, b: string) => Math.round((utc(b) - utc(a)) / 864e5);
const weekday = (k: string) => new Date(utc(k)).getUTCDay();
const dm = (k: string) => dmy(k); // dd/mm/yyyy
const money = (n: number) => n.toLocaleString("vi-VN") + "đ";
const short = (n: number) =>
  n >= 1e6 ? (n / 1e6).toFixed(1).replace(".", ",").replace(",0", "") + "tr" : Math.round(n / 1000) + "k";
const cellHeat = (n: number) => CELL_HEAT[n === 0 ? 0 : n === 1 ? 1 : n <= 3 ? 2 : n <= 5 ? 3 : 4];
const yearLevel = (n: number) => (n === 0 ? 0 : n === 1 ? 1 : n <= 2 ? 2 : n <= 4 ? 3 : 4);

export default function BookingsCalendar({
  rows,
  view,
  onView,
  todayKey,
  nowMs,
  onStatus,
  onOpen,
}: {
  rows: BookingRow[];
  view: CalendarView;
  onView: (v: CalendarView) => void;
  /** Hôm nay (yyyy-mm-dd, giờ Việt Nam) — dựng ở server để khớp khi hydrate. */
  todayKey: string;
  nowMs: number;
  onStatus: (ids: string[], status: BookingStatus) => void;
  onOpen: (id: string) => void;
}) {
  const [y, setY] = useState(Number(todayKey.slice(0, 4)));
  const [m, setM] = useState(Number(todayKey.slice(5, 7)) - 1);
  const [sel, setSel] = useState(todayKey);
  const [mode, setMode] = useState<"arrive" | "active">("arrive");
  const [cat, setCat] = useState("all");
  const [st, setSt] = useState<"all" | BookingStatus>("all");
  const [showCancel, setShowCancel] = useState(false);

  const endOf = (r: BookingRow) => r.endDate ?? r.useDate;
  /** Cần gấp: đơn mới quá 30 phút chưa xử lý, hoặc đi trong 48h mà chưa xác nhận. */
  const urgent = (r: BookingRow) => {
    const dd = diffDays(todayKey, r.useDate);
    return (
      (r.status === "NEW" && nowMs - new Date(r.createdAt).getTime() > 30 * 6e4) ||
      ((r.status === "NEW" || r.status === "CONTACTING") && dd >= 0 && dd <= 2)
    );
  };

  const base = useMemo(
    () => rows.filter((r) => cat === "all" || (cat === "HOMESTAY" ? r.cat === "HOMESTAY" || r.cat === "BUNGALOW" : r.cat === cat)),
    [rows, cat],
  );
  const F = useMemo(
    () => base.filter((r) => (st !== "all" ? r.status === st : showCancel || r.status !== "CANCELLED")),
    [base, st, showCancel],
  );

  // Màn hẹp (lịch tháng cuộn ngang): đưa cột của ngày đang chọn vào giữa khung nhìn.
  useEffect(() => {
    if (view !== "month") return;
    const box = document.getElementById("bk-month-scroll");
    if (!box || box.scrollWidth <= box.clientWidth) return;
    const col = (weekday(sel) + 6) % 7;
    const cellW = box.scrollWidth / 7;
    box.scrollTo({ left: col * cellW - (box.clientWidth - cellW) / 2, behavior: "smooth" });
  }, [view, sel, y, m]);

  function pickDay(k: string) {
    setSel(k);
    setY(Number(k.slice(0, 4)));
    setM(Number(k.slice(5, 7)) - 1);
    // Màn hẹp: panel ngày nằm dưới lịch → cuộn tới.
    if (typeof window !== "undefined" && !window.matchMedia("(min-width: 1536px)").matches) {
      setTimeout(() => document.getElementById("bk-day-panel")?.scrollIntoView({ behavior: "smooth", block: "start" }), 40);
    }
  }
  function shift(n: number) {
    if (view === "year") return setY(y + n);
    const d = new Date(Date.UTC(y, m + n, 1));
    setY(d.getUTCFullYear());
    setM(d.getUTCMonth());
  }
  function goToday() {
    setY(Number(todayKey.slice(0, 4)));
    setM(Number(todayKey.slice(5, 7)) - 1);
    setSel(todayKey);
  }

  const ym = `${y}-${pad(m + 1)}`;
  const dim = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();

  // ── Số liệu tháng (theo ngày đến) / năm ──
  const inMonth = base.filter((r) => r.useDate.slice(0, 7) === ym);
  const live = inMonth.filter((r) => r.status !== "CANCELLED");
  const need = inMonth.filter((r) => urgent(r) || r.status === "NEW").length;
  const noDep = live.filter((r) => r.collected === 0 && r.status !== "COMPLETED").length;
  const yearRows = F.filter((r) => r.useDate.slice(0, 4) === String(y) && r.status !== "CANCELLED");
  const sum = (l: BookingRow[], f: (r: BookingRow) => number) => l.reduce((a, r) => a + f(r), 0);

  const stats: { k: string; v: string | number; dot: string; sub?: string; subC?: string }[] =
    view === "year"
      ? [
          { k: "Đơn trong năm", v: yearRows.length, dot: "bg-forest-800" },
          { k: "Doanh thu tạm tính", v: short(sum(yearRows, (r) => r.price ?? 0)), dot: "bg-forest-500" },
          { k: "Khách", v: sum(yearRows, (r) => r.pax), dot: "bg-sky-500" },
        ]
      : [
          {
            k: "Đơn trong tháng", v: live.length, dot: "bg-forest-800",
            sub: inMonth.length - live.length ? `${inMonth.length - live.length} huỷ` : "", subC: "text-red-600",
          },
          { k: "Khách", v: sum(live, (r) => r.pax), dot: "bg-sky-500" },
          { k: "Doanh thu tạm tính", v: short(sum(live, (r) => r.price ?? 0)), dot: "bg-forest-500" },
          {
            k: "Đã thu", v: short(sum(live, (r) => r.collected)), dot: "bg-forest-500",
            sub: noDep ? `${noDep} đơn chưa cọc` : "", subC: "text-amber-600",
          },
          { k: "Cần xử lý", v: need, dot: "bg-sunset-500", sub: need ? "xử lý ngay" : "", subC: "text-sunset-600" },
        ];

  // ── Thẻ đơn (dùng ở panel ngày + chế độ Theo ngày) ──
  const card = (r: BookingRow) => {
    const meta = ST[r.status];
    const [catK, catTone] = CAT_BADGE[r.cat] ?? ["DV", "bg-gray-100 text-gray-600"];
    const urg = urgent(r);
    const e = endOf(r);
    const left = diffDays(todayKey, r.useDate);
    const chips = [
      e !== r.useDate ? `${dm(r.useDate)} → ${dm(e)}` : dm(r.useDate),
      ...r.chips.slice(0, 2),
      left > 0 ? `Còn ${left} ngày` : left === 0 ? "Hôm nay" : "Đã qua",
    ];
    const cancelled = r.status === "CANCELLED";
    const payText = cancelled ? "Đã huỷ" : r.pay === "full" ? "Đã thu đủ" : r.collected > 0 ? `Cọc ${money(r.collected)}` : r.pay === "dep" ? "Đã cọc" : "Chưa cọc";
    const payTone =
      !cancelled && r.pay === "full" ? "text-forest-700 bg-forest-500" : !cancelled && r.pay === "dep" ? "text-amber-600 bg-amber-500" : "text-red-600 bg-red-500";
    const payPct = r.price ? Math.min(100, Math.round((r.collected / r.price) * 100)) : 0;
    return (
      <div
        key={r.id}
        className={`flex min-w-0 animate-[fadeIn_.2s_ease_both] flex-col gap-2 rounded-2xl border bg-white px-3.5 py-3 ${urg ? "border-sunset-300" : "border-gray-200"}`}
      >
        {/* Bấm vào phần thông tin đơn → mở ngăn xử lý nhanh NGAY TẠI trang (không chuyển sang trang chi tiết). */}
        <button
          type="button"
          onClick={() => onOpen(r.id)}
          title={`Xem & xử lý đơn ${r.code} ngay tại đây`}
          className="-m-1 flex items-start gap-2.5 rounded-xl p-1 text-left transition hover:bg-forest-50/60"
        >
          <span className={`flex h-[30px] w-[30px] flex-none items-center justify-center rounded-[9px] text-[11px] font-extrabold ${catTone}`}>{catK}</span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-mono text-xs font-bold text-gray-600">{r.code}</span>
              <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-bold ${r.ctvName ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-600"}`}>
                {r.ctvName ?? "Web"}
              </span>
              {urg && <span className="rounded-md bg-sunset-100 px-1.5 py-0.5 text-[11px] font-extrabold text-sunset-600">Cần gấp</span>}
            </div>
            <div className="mt-0.5 text-[15px] font-extrabold leading-snug text-ink">
              {r.name} <span className="font-semibold text-gray-500">· {r.phone}</span>
            </div>
            <div className="mt-0.5 truncate text-[13px] font-semibold text-gray-700">{r.title}</div>
          </div>
          <div className="flex-none text-right">
            <div className="text-[15px] font-extrabold text-ink">{r.price != null ? money(r.price) : "—"}</div>
            <div className="text-xs text-gray-500">{r.paxLabel}</div>
          </div>
        </button>
        <div className="flex flex-wrap gap-1.5">
          {chips.map((c, i) => (
            <span key={i} className="max-w-full truncate rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-700">{c}</span>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className={`flex items-center gap-1.5 whitespace-nowrap text-[13px] font-bold ${payTone.split(" ")[0]}`}>
            <span className={`h-[7px] w-[7px] rounded-full ${payTone.split(" ")[1]}`} />
            {payText}
          </span>
          <div className="h-1 min-w-[30px] flex-1 overflow-hidden rounded-full bg-gray-100">
            <div className="h-full bg-forest-500" style={{ width: `${payPct}%` }} />
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <select
            value={r.status}
            onChange={(ev) => onStatus([r.id], ev.target.value as BookingStatus)}
            className={`min-w-0 flex-1 rounded-full border-[1.5px] px-2.5 py-2 text-[13px] font-bold ${meta.bd} ${meta.bg} ${meta.fg}`}
          >
            {STATUS_ORDER.map((k) => (
              <option key={k} value={k}>{ST[k].name}</option>
            ))}
          </select>
          <a
            href={`tel:${r.phone.replace(/\D/g, "")}`}
            className="whitespace-nowrap rounded-full border-[1.5px] border-gray-200 bg-white px-3.5 py-2 text-[13px] font-bold text-ink hover:bg-gray-50"
          >
            Gọi
          </a>
          <EditBookingPopup
            bookingId={r.id}
            title="Sửa đơn ngay tại đây (popup)"
            className="whitespace-nowrap rounded-full border-[1.5px] border-forest-700 bg-white px-3 py-2 text-[13px] font-bold text-forest-700 hover:bg-forest-50 disabled:opacity-60"
          >
            ✎ Sửa
          </EditBookingPopup>
          <button
            type="button"
            onClick={() => onOpen(r.id)}
            className="whitespace-nowrap rounded-full bg-forest-800 px-3.5 py-2 text-[13px] font-extrabold text-white hover:bg-forest-700"
          >
            Xử lý
          </button>
        </div>
      </div>
    );
  };

  // ── Lịch tháng ──
  function renderMonth() {
    const off = (new Date(Date.UTC(y, m, 1)).getUTCDay() + 6) % 7;
    const weeks = Math.ceil((off + dim) / 7);
    const cells = Array.from({ length: weeks * 7 }, (_, i) => keyOf(y, m, 1 - off + i));

    const arr = F.filter((r) => r.useDate === sel);
    const stay = F.filter((r) => r.useDate < sel && sel < endOf(r));
    const lv = F.filter((r) => endOf(r) === sel && r.useDate !== sel);
    const groups: [string, string, BookingRow[]][] = (
      [
        ["Nhận phòng / khởi hành", "bg-forest-500", arr],
        ["Đang ở / đang dùng", "bg-sky-500", stay],
        ["Trả phòng / về", "bg-amber-500", lv],
      ] as [string, string, BookingRow[]][]
    ).filter((g) => g[2].length);

    return (
      // grid-cols-[minmax(0,1fr)]: cột không được nở theo nội dung (chip dài không xuống dòng trong thẻ
      // đơn từng làm cả trang rộng quá màn hình điện thoại → không xem / không cuộn được).
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-3.5 2xl:grid-cols-[minmax(0,1fr)_400px]">
        {/* Điện thoại (< md): ô THU GỌN vừa bề ngang màn hình (ngày + số đơn + chấm trạng thái), bấm ngày
            để xem đơn ở panel bên dưới. Từ md trở lên: ô đầy đủ (tên khách, số khách, doanh thu), thiếu chỗ thì cuộn ngang. */}
        <div id="bk-month-scroll" className="min-w-0 overflow-x-auto overscroll-x-contain rounded-[20px] border border-gray-200 bg-white p-1.5 md:p-3.5">
         <div className="md:min-w-[760px]">
          <div className="mb-1 grid grid-cols-7 gap-1 md:mb-1.5 md:gap-1.5">
            {WD_SHORT.map((n) => (
              <div key={n} className={`py-1 text-center text-xs font-extrabold tracking-wide ${n === "CN" ? "text-red-600" : "text-gray-500"}`}>{n}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1 md:gap-1.5">
            {cells.map((k) => {
              const inM = k.slice(0, 7) === ym;
              const list = F.filter((r) => (mode === "arrive" ? r.useDate === k : r.useDate === k || (r.useDate < k && k < endOf(r))));
              const isT = k === todayKey;
              const isS = k === sel;
              const guests = sum(list, (r) => r.pax);
              const rev = sum(list.filter((r) => r.useDate === k && r.status !== "CANCELLED"), (r) => r.price ?? 0);
              return (
                // div (không phải button) để lồng được link từng đơn bên trong ô.
                <div
                  key={k}
                  role="button"
                  tabIndex={0}
                  onClick={() => pickDay(k)}
                  onKeyDown={(ev) => {
                    if (ev.target === ev.currentTarget && (ev.key === "Enter" || ev.key === " ")) {
                      ev.preventDefault();
                      pickDay(k);
                    }
                  }}
                  style={{ background: isS ? "oklch(0.97 0.03 70)" : cellHeat(list.length) }}
                  className={`flex min-h-[64px] min-w-0 cursor-pointer flex-col gap-1 rounded-[10px] border-[1.5px] p-1 text-left transition-colors hover:border-forest-400 md:min-h-[112px] md:rounded-xl md:p-[7px] 2xl:min-h-[124px] ${
                    isS ? "border-forest-800" : isT ? "border-sunset-500" : "border-gray-200"
                  } ${inM ? "" : "opacity-40"}`}
                >
                  <div className="flex w-full items-center justify-between gap-0.5">
                    <span
                      className={`relative flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full text-[13px] font-extrabold ${
                        isT ? "bg-sunset-500 text-white" : weekday(k) === 0 ? "text-red-600" : "text-ink"
                      }`}
                    >
                      {Number(k.slice(8, 10))}
                      {list.some(urgent) && (
                        <span className="absolute -right-0.5 -top-px h-2 w-2 rounded-full border-[1.5px] border-white bg-sunset-500" />
                      )}
                    </span>
                    {list.length > 0 && (
                      <span className="hidden whitespace-nowrap text-[11px] font-extrabold text-forest-700 md:inline">
                        {list.length}
                        {" đơn"}
                      </span>
                    )}
                  </div>
                  {/* Điện thoại: số đơn + chấm màu theo trạng thái từng đơn */}
                  {list.length > 0 && (
                    <div className="flex w-full min-w-0 flex-col gap-1 md:hidden">
                      <span className="truncate text-[10px] font-extrabold leading-none text-forest-700">{list.length}<span className="max-[359px]:hidden"> đơn</span></span>
                      <span className="flex flex-wrap gap-[3px]">
                        {list.slice(0, 5).map((r) => (
                          <span key={r.id} className={`h-1.5 w-1.5 rounded-full ${ST[r.status].dot}`} />
                        ))}
                      </span>
                    </div>
                  )}
                  <div className="hidden w-full min-w-0 flex-col gap-[3px] md:flex">
                    {list.slice(0, 3).map((r, i) => {
                      const meta = ST[r.status];
                      const cont = r.useDate !== k;
                      return (
                        <button
                          type="button"
                          key={r.id}
                          onClick={(ev) => {
                            ev.stopPropagation();
                            onOpen(r.id);
                          }}
                          title={`${r.code} · ${r.name} · ${meta.name} — bấm để xử lý đơn ngay tại đây`}
                          className={`min-w-0 items-center gap-1 rounded-md px-1.5 py-[3px] text-[11px] font-bold hover:ring-1 hover:ring-current ${meta.bg} ${meta.fg} ${cont ? "opacity-60" : ""} ${
                            i === 2 ? "hidden 2xl:flex" : "flex"
                          }`}
                        >
                          <span className={`h-1.5 w-1.5 flex-none rounded-full ${meta.dot}`} />
                          <span className="flex-none text-[10px] font-extrabold opacity-75">{(CAT_BADGE[r.cat] ?? ["DV"])[0]}</span>
                          <span className="truncate">{(cont ? "↳ " : "") + r.name.trim().split(/\s+/).slice(-2).join(" ")}</span>
                        </button>
                      );
                    })}
                    {list.length > 2 && (
                      <span className={`pl-0.5 text-[11px] font-extrabold text-forest-600 ${list.length === 3 ? "2xl:hidden" : ""}`}>
                        +<span className="2xl:hidden">{list.length - 2}</span>
                        <span className="hidden 2xl:inline">{list.length - 3}</span> đơn
                      </span>
                    )}
                  </div>
                  <div className="flex-1" />
                  {list.length > 0 && (
                    <div className="hidden w-full truncate text-[11px] font-semibold text-gray-500 md:block">
                      {guests} khách{rev ? ` · ${short(rev)}` : ""}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
         </div>
        </div>

        {/* Panel ngày đang chọn */}
        <aside
          id="bk-day-panel"
          // Thanh trên của khu quản trị dính ở top (cao 64px) → chừa 80px để không bị che.
          className="flex min-w-0 scroll-mt-20 flex-col gap-3.5 rounded-[20px] border border-gray-200 bg-gray-50 p-4 2xl:sticky 2xl:top-20 2xl:max-h-[calc(100vh-96px)] 2xl:overflow-y-auto"
        >
          <div className="flex items-start justify-between gap-2.5">
            <div>
              <div className="text-xs font-extrabold uppercase tracking-widest text-forest-600">{WD_LONG[weekday(sel)]}</div>
              <div className="text-[22px] font-extrabold tracking-tight text-ink">
                {Number(sel.slice(8, 10))} tháng {Number(sel.slice(5, 7))}, {sel.slice(0, 4)}
              </div>
            </div>
            {sel === todayKey && <span className="rounded-full bg-sunset-500 px-2.5 py-1 text-xs font-extrabold text-white">Hôm nay</span>}
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {[
              [arr.length, "Nhận / đi"],
              [stay.length, "Đang ở"],
              [lv.length, "Trả / về"],
            ].map(([v, k]) => (
              <div key={k} className="rounded-xl border border-gray-200 bg-white px-2.5 py-2">
                <div className="text-xl font-extrabold text-ink">{v}</div>
                <div className="text-xs font-semibold text-gray-500">{k}</div>
              </div>
            ))}
          </div>
          {groups.length === 0 && (
            <div className="rounded-2xl border-[1.5px] border-dashed border-gray-300 px-3.5 py-6 text-center text-sm text-gray-500">
              Không có đơn nào trong ngày này.
            </div>
          )}
          {groups.map(([title, dot, l]) => (
            <div key={title} className="flex flex-col gap-2">
              <div className="flex items-center gap-2 text-[13px] font-extrabold text-gray-700">
                <span className={`h-2 w-2 rounded-sm ${dot}`} />
                {title} <span className="text-gray-400">{l.length}</span>
              </div>
              {l.map(card)}
            </div>
          ))}
        </aside>
      </div>
    );
  }

  // ── Theo ngày ──
  function renderAgenda() {
    const days: { k: string; l: BookingRow[] }[] = [];
    for (let d = 1; d <= dim; d++) {
      const k = keyOf(y, m, d);
      const l = F.filter((r) => r.useDate === k);
      if (l.length) days.push({ k, l });
    }
    return (
      <div className="flex flex-col gap-[18px]">
        {days.length === 0 && (
          <div className="rounded-[20px] border-[1.5px] border-dashed border-gray-300 bg-white px-5 py-10 text-center text-[15px] text-gray-500">
            Tháng này chưa có đơn phù hợp bộ lọc.
          </div>
        )}
        {days.map(({ k, l }) => {
          const isT = k === todayKey;
          return (
            <section key={k} className="grid grid-cols-[minmax(0,1fr)] items-start gap-3.5 lg:grid-cols-[150px_minmax(0,1fr)]">
              <button
                type="button"
                onClick={() => {
                  setSel(k);
                  onView("month");
                }}
                title="Mở ngày này trên lịch tháng"
                className={`flex flex-row flex-wrap items-baseline gap-x-3 gap-y-1 rounded-2xl px-3.5 py-3 text-left lg:sticky lg:top-20 lg:flex-col ${
                  isT ? "bg-sunset-500 text-white" : "border border-gray-200 bg-white text-ink"
                }`}
              >
                <span className="text-xs font-extrabold uppercase tracking-widest opacity-80">{WD_LONG[weekday(k)]}</span>
                <span className="text-[26px] font-extrabold leading-none tracking-tight">{dm(k)}</span>
                <span className="text-[13px] font-bold opacity-85">
                  {l.length} đơn · {sum(l, (r) => r.pax)} khách
                </span>
              </button>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,340px),1fr))] gap-2.5">{l.map(card)}</div>
            </section>
          );
        })}
      </div>
    );
  }

  // ── Cả năm ──
  function renderYear() {
    const counts: Record<string, number> = {};
    F.forEach((r) => (counts[r.useDate] = (counts[r.useDate] || 0) + 1));
    return (
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-gray-500">
          Ít
          {YEAR_HEAT.map((c) => (
            <span key={c} className="h-3.5 w-3.5 rounded" style={{ background: c }} />
          ))}
          Nhiều đơn · bấm một ngày để mở lịch tháng
        </div>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,250px),1fr))] gap-3">
          {Array.from({ length: 12 }, (_, mi) => {
            const mk = `${y}-${pad(mi + 1)}`;
            const off = (new Date(Date.UTC(y, mi, 1)).getUTCDay() + 6) % 7;
            const n = new Date(Date.UTC(y, mi + 1, 0)).getUTCDate();
            const ml = F.filter((r) => r.useDate.slice(0, 7) === mk && r.status !== "CANCELLED");
            return (
              <div
                key={mk}
                className={`flex flex-col gap-2 rounded-[18px] border-[1.5px] bg-white p-3.5 ${mk === todayKey.slice(0, 7) ? "border-sunset-500" : "border-gray-200"}`}
              >
                <button
                  type="button"
                  onClick={() => {
                    setM(mi);
                    onView("month");
                  }}
                  className="flex items-baseline justify-between gap-2 text-left"
                >
                  <span className="text-base font-extrabold text-ink">Tháng {mi + 1}</span>
                  <span className="whitespace-nowrap text-xs font-bold text-gray-500">
                    {ml.length ? `${ml.length} đơn · ${short(sum(ml, (r) => r.price ?? 0))}` : "Chưa có đơn"}
                  </span>
                </button>
                <div className="grid grid-cols-7 gap-[3px]">
                  {WD_SHORT.map((d) => (
                    <span key={d} className="text-center text-[10px] font-extrabold text-gray-400">{d}</span>
                  ))}
                  {Array.from({ length: off }, (_, i) => (
                    <span key={`o${i}`} />
                  ))}
                  {Array.from({ length: n }, (_, di) => {
                    const k = keyOf(y, mi, di + 1);
                    const c = counts[k] || 0;
                    const L = yearLevel(c);
                    return (
                      <button
                        key={k}
                        type="button"
                        title={`${dm(k)} · ${c} đơn`}
                        onClick={() => {
                          setM(mi);
                          setSel(k);
                          onView("month");
                        }}
                        style={{ background: YEAR_HEAT[L], boxShadow: k === todayKey ? "0 0 0 2px var(--color-sunset-500)" : undefined }}
                        className={`flex aspect-square items-center justify-center rounded-[5px] text-[10px] font-bold ${L >= 3 ? "text-white" : "text-gray-700"}`}
                      >
                        {di + 1}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const navBtn = "flex h-[38px] w-[38px] items-center justify-center rounded-full border-[1.5px] border-gray-200 text-lg font-extrabold text-ink hover:bg-gray-50";

  return (
    <div className="flex min-w-0 flex-col gap-3.5">
      {/* Thanh điều hướng kỳ + bộ lọc */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-gray-200 bg-white px-3.5 py-3">
        <div className="flex min-w-0 max-w-full flex-wrap items-center gap-1.5">
          <button type="button" onClick={() => shift(-1)} title="Trước" className={navBtn}>‹</button>
          <div className="min-w-[104px] whitespace-nowrap text-center text-[17px] font-extrabold tracking-tight text-ink sm:min-w-[170px] sm:text-[19px]">
            {view === "year" ? `Năm ${y}` : `Tháng ${m + 1}, ${y}`}
          </div>
          <button type="button" onClick={() => shift(1)} title="Sau" className={navBtn}>›</button>
          <button
            type="button"
            onClick={goToday}
            className="ml-1 whitespace-nowrap rounded-full bg-forest-50 px-3.5 py-2 text-[13px] font-extrabold text-forest-700 hover:bg-forest-100"
          >
            Hôm nay
          </button>
        </div>
        <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2.5">
          {view === "month" && (
            <div className="flex min-w-0 max-w-full flex-wrap items-center gap-1.5 text-[13px] font-bold text-gray-500">
              Hiện đơn
              <div className="inline-flex max-w-full gap-[3px] overflow-x-auto rounded-[10px] bg-gray-100 p-[3px]">
                {(
                  [
                    ["arrive", "Theo ngày đến", "Mỗi đơn chỉ hiện ở ngày nhận phòng / khởi hành"],
                    ["active", "Mọi ngày đang dùng", "Đơn hiện ở tất cả các ngày khách đang ở / đang đi"],
                  ] as const
                ).map(([k, name, tip]) => (
                  <button
                    key={k}
                    type="button"
                    title={tip}
                    onClick={() => setMode(k)}
                    className={`whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[13px] font-bold ${
                      mode === k ? "bg-white text-forest-800 shadow-sm" : "text-gray-500"
                    }`}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
          )}
          <select
            value={cat}
            onChange={(e) => setCat(e.target.value)}
            className="rounded-xl border-[1.5px] border-gray-200 bg-white px-3 py-2 text-sm font-bold"
          >
            <option value="all">Mọi dịch vụ</option>
            {CAT_OPTIONS.map(([v, label]) => (
              <option key={v} value={v}>{label}</option>
            ))}
          </select>
          <label className="flex cursor-pointer items-center gap-1.5 whitespace-nowrap text-sm font-semibold text-ink">
            <input type="checkbox" checked={showCancel} onChange={() => setShowCancel(!showCancel)} className="h-4 w-4 accent-forest-700" />
            Hiện đơn huỷ
          </label>
        </div>
      </div>

      {/* Số liệu kỳ */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,150px),1fr))] gap-2.5">
        {stats.map((s) => (
          <div key={s.k} className="rounded-2xl border border-gray-200 bg-white px-4 py-3">
            <div className="flex items-center gap-1.5 text-[13px] font-bold text-gray-500">
              <span className={`h-2 w-2 rounded-full ${s.dot}`} />
              {s.k}
            </div>
            <div className="mt-0.5 text-2xl font-extrabold tracking-tight text-ink">
              {s.v} {s.sub ? <span className={`text-xs font-bold ${s.subC}`}>{s.sub}</span> : null}
            </div>
          </div>
        ))}
      </div>

      {/* Lọc trạng thái (số đếm theo tháng đang xem) */}
      <div className="flex flex-wrap items-center gap-1.5">
        {(["all", ...STATUS_ORDER] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setSt(k)}
            className={`flex items-center gap-1.5 whitespace-nowrap rounded-full border-[1.5px] px-3 py-1.5 text-[13px] font-bold text-ink ${
              st === k ? "border-forest-800 bg-forest-50" : "border-gray-200 bg-white hover:bg-gray-50"
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${k === "all" ? "bg-forest-800" : ST[k].dot}`} />
            {k === "all" ? "Tất cả" : ST[k].name}
            <span className="opacity-60">{k === "all" ? inMonth.length : inMonth.filter((r) => r.status === k).length}</span>
          </button>
        ))}
        <span className="ml-1.5 flex items-center gap-1.5 whitespace-nowrap text-xs font-bold text-sunset-600">
          <span className="h-2 w-2 rounded-full bg-sunset-500 ring-[3px] ring-sunset-500/20" />
          Ngày có đơn cần xử lý gấp
        </span>
      </div>

      {view === "month" ? renderMonth() : view === "agenda" ? renderAgenda() : renderYear()}
    </div>
  );
}
