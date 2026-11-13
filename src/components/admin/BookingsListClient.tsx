"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import type { BookingStatus } from "@prisma/client";
import { showToast } from "./Toast";
import { PaymentRecordForm, NoteForm } from "./BookingDetailClient";
import { bulkDeleteBookings, bulkUpdateBookingStatus } from "@/app/admin/bookings/actions";
import BookingsCalendar from "./BookingsCalendar";

export type BookingsView = "list" | "month" | "agenda" | "year";
const VIEWS: [BookingsView, string][] = [
  ["list", "Danh sách"],
  ["month", "Tháng"],
  ["agenda", "Theo ngày"],
  ["year", "Cả năm"],
];

/** Một dòng đơn đã được server dựng sẵn (chỉ dữ liệu thuần, không Decimal/Date). */
export interface BookingRow {
  id: string;
  code: string;
  name: string;
  phone: string;
  cat: string; // ServiceCategory
  catLabel: string;
  title: string;
  chips: string[];
  useDate: string; // yyyy-mm-dd
  endDate: string | null;
  qty: number;
  /** Số khách (dịch vụ không tính theo khách thì = số lượng) — cộng dồn ở chế độ lịch. */
  pax: number;
  paxLabel: string;
  price: number | null;
  collected: number;
  pay: "none" | "dep" | "full";
  status: BookingStatus;
  ctvName: string | null;
  createdAt: string; // ISO
  note: string | null;
}

export const ST: Record<BookingStatus, { name: string; dot: string; bd: string; bg: string; fg: string }> = {
  NEW: { name: "Mới", dot: "bg-sky-500", bd: "border-sky-300", bg: "bg-sky-50", fg: "text-sky-700" },
  CONTACTING: { name: "Đang liên hệ", dot: "bg-amber-500", bd: "border-amber-300", bg: "bg-amber-50", fg: "text-amber-700" },
  CONFIRMED: { name: "Đã xác nhận", dot: "bg-forest-500", bd: "border-forest-300", bg: "bg-forest-50", fg: "text-forest-700" },
  COMPLETED: { name: "Hoàn thành", dot: "bg-forest-800", bd: "border-gray-300", bg: "bg-gray-100", fg: "text-gray-700" },
  CANCELLED: { name: "Đã huỷ", dot: "bg-red-500", bd: "border-red-300", bg: "bg-red-50", fg: "text-red-600" },
};
const ST_LIST = Object.keys(ST) as BookingStatus[];

export const CAT_BADGE: Record<string, [string, string]> = {
  COMBO: ["CB", "bg-sky-100 text-sky-700"],
  CABIN: ["XE", "bg-sky-100 text-sky-700"],
  HOMESTAY: ["HS", "bg-forest-100 text-forest-700"],
  BUNGALOW: ["HS", "bg-forest-100 text-forest-700"],
  MOTORBIKE: ["XM", "bg-amber-100 text-amber-700"],
  TAXI: ["TX", "bg-yellow-100 text-yellow-700"],
  XEOM: ["XO", "bg-yellow-100 text-yellow-700"],
};

export const CAT_OPTIONS: [string, string][] = [
  ["COMBO", "Combo"],
  ["CABIN", "Xe cabin"],
  ["HOMESTAY", "Homestay"],
  ["MOTORBIKE", "Thuê xe máy"],
  ["TAXI", "Taxi"],
  ["XEOM", "Xe ôm"],
];

const RANGES: [string, string][] = [
  ["all", "Tất cả"],
  ["today", "Hôm nay"],
  ["tmr", "Ngày mai"],
  ["7", "7 ngày tới"],
  ["past", "Đã qua"],
];

const K = (n: number) => n.toLocaleString("vi-VN") + "đ";
const fmtDM = (ds: string) => `${ds.slice(8, 10)}/${ds.slice(5, 7)}`;

/** Số ngày từ hôm nay (theo giờ máy admin) tới ngày dùng. */
function daysTo(ds: string) {
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const d = Date.UTC(Number(ds.slice(0, 4)), Number(ds.slice(5, 7)) - 1, Number(ds.slice(8, 10)));
  return Math.round((d - today) / 864e5);
}
const minsAgo = (iso: string) => Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 6e4));
const agoText = (m: number) =>
  m < 60 ? `${m} phút trước` : m < 1440 ? `${Math.round(m / 60)} giờ trước` : `${Math.round(m / 1440)} ngày trước`;

/** Đơn "cần gấp": mới quá 30 phút chưa ai đụng, hoặc đi trong 48h mà chưa xác nhận. */
function isUrgent(r: BookingRow) {
  const dt = daysTo(r.useDate);
  return (
    (r.status === "NEW" && minsAgo(r.createdAt) > 30) ||
    ((r.status === "NEW" || r.status === "CONTACTING") && dt >= 0 && dt <= 2)
  );
}

export default function BookingsListClient({
  rows: all,
  totalInDb,
  filterLabel = null,
  calRows,
  todayKey,
  nowMs,
  initialView = "list",
}: {
  rows: BookingRow[];
  totalInDb: number;
  /** Đơn cho chế độ lịch (Tháng / Theo ngày / Cả năm) — lấy theo NGÀY DÙNG, không giới hạn 400 đơn mới nhất. */
  calRows: BookingRow[];
  /** Hôm nay yyyy-mm-dd (giờ VN) + thời điểm dựng trang — để lịch tính "cần gấp" khớp server/client. */
  todayKey: string;
  nowMs: number;
  initialView?: BookingsView;
  /** Đang lọc phía server (vd theo chủ dịch vụ từ trang Thống kê) — hiện dải thông báo + nút bỏ lọc. */
  filterLabel?: string | null;
}) {
  const [q, setQ] = useState("");
  const [st, setSt] = useState<"all" | BookingStatus>("all");
  const [cat, setCat] = useState("all");
  const [pay, setPay] = useState("all");
  const [src, setSrc] = useState("all");
  const [range, setRange] = useState("all");
  const [sort, setSort] = useState("new");
  const [urgentOnly, setUrgentOnly] = useState(false);
  const [sel, setSel] = useState<Record<string, boolean>>({});
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [view, setViewState] = useState<BookingsView>(initialView);

  /** Đổi chế độ xem + ghi vào URL (?view=) để tải lại / gửi link vẫn giữ. */
  function setView(v: BookingsView) {
    setViewState(v);
    const sp = new URLSearchParams(window.location.search);
    if (v === "list") sp.delete("view");
    else sp.set("view", v);
    const qs = sp.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }

  function setStatus(ids: string[], status: BookingStatus, clearSelection = false) {
    if (status === "CANCELLED" && !confirm(`Huỷ ${ids.length > 1 ? ids.length + " đơn" : "đơn này"}?`)) return;
    startTransition(async () => {
      const send = (force: boolean) => {
        const fd = new FormData();
        fd.set("ids", JSON.stringify(ids));
        fd.set("status", status);
        if (force) fd.set("force", "1");
        return bulkUpdateBookingStatus({}, fd);
      };
      let res = await send(false);
      // Phòng của đơn đang bị khoá: hiện cảnh báo tình trạng hiện tại, đồng ý thì ghi đè.
      if (res.needConfirm) {
        if (!confirm(res.error || "Phòng đang bị khoá. Vẫn ghi đè?")) return;
        res = await send(true);
      }
      if (res.ok) {
        showToast(res.message || "Đã cập nhật", "ok");
        if (clearSelection) setSel({});
      } else showToast(res.error || "Có lỗi xảy ra", "error");
    });
  }

  function deleteRows(ids: string[]) {
    const label = ids.length > 1 ? `${ids.length} đơn đã chọn` : "đơn này";
    if (!confirm(`Xoá hẳn ${label}? Không thể hoàn tác — đơn biến mất khỏi mọi báo cáo; tồn kho đang giữ sẽ được trả lại. (Đơn khách huỷ thì nên chuyển "Đã huỷ" thay vì xoá.)`)) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set("ids", JSON.stringify(ids));
      const res = await bulkDeleteBookings({}, fd);
      if (res.ok) {
        showToast(res.message || "Đã xoá", "ok");
        setSel({});
        setDrawerId(null);
      } else showToast(res.error || "Có lỗi xảy ra", "error");
    });
  }

  const payKey = (r: BookingRow) => r.pay;
  const inRange = (r: BookingRow) => {
    if (range === "all") return true;
    const dt = daysTo(r.useDate);
    if (range === "today") return dt === 0;
    if (range === "tmr") return dt === 1;
    if (range === "7") return dt >= 0 && dt <= 7;
    return dt < 0; // past
  };

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filtered = all.filter(
      (r) =>
        // "Tất cả" ẩn đơn đã huỷ (xem ở ô "Đã huỷ"); đang tìm kiếm thì vẫn hiện để tra cứu.
        (st === "all" ? r.status !== "CANCELLED" || !!needle : r.status === st) &&
        (cat === "all" || (cat === "HOMESTAY" ? r.cat === "HOMESTAY" || r.cat === "BUNGALOW" : r.cat === cat)) &&
        (pay === "all" || payKey(r) === pay) &&
        (src === "all" || (src === "ctv" ? !!r.ctvName : !r.ctvName)) &&
        inRange(r) &&
        (!urgentOnly || isUrgent(r)) &&
        (!needle || `${r.code} ${r.name} ${r.phone} ${r.title}`.toLowerCase().includes(needle)),
    );
    filtered.sort((a, b) => {
      if (sort === "soon") return a.useDate.localeCompare(b.useDate);
      if (sort === "big") return (b.price ?? 0) - (a.price ?? 0);
      if (sort === "wait") {
        const act = (x: BookingRow) => (x.status === "NEW" || x.status === "CONTACTING" ? 1 : 0);
        return act(b) - act(a) || a.createdAt.localeCompare(b.createdAt);
      }
      return b.createdAt.localeCompare(a.createdAt);
    });
    return filtered;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, q, st, cat, pay, src, range, sort, urgentOnly]);

  const n = (k: BookingStatus) => all.filter((r) => r.status === k).length;
  const nUrg = all.filter(isUrgent).length;
  const selIds = Object.keys(sel).filter((k) => sel[k]);
  const hasFilter = st !== "all" || cat !== "all" || pay !== "all" || src !== "all" || range !== "all" || urgentOnly || !!q.trim();
  const clearFilter = () => {
    setQ(""); setSt("all"); setCat("all"); setPay("all"); setSrc("all"); setRange("all"); setUrgentOnly(false);
  };
  const allSel = list.length > 0 && list.every((r) => sel[r.id]);

  function exportCsv() {
    const head = ["Mã", "Khách", "SĐT", "Dịch vụ", "Chi tiết", "Ngày dùng", "Ngày trả", "SL", "Giá", "Đã thu", "Thanh toán", "Trạng thái", "Nguồn", "Gửi lúc"];
    const lines = list.map((r) =>
      [
        r.code, r.name, r.phone, r.catLabel, r.title, r.useDate, r.endDate ?? "", r.qty,
        r.price ?? "", r.collected,
        r.pay === "full" ? "Đã thu đủ" : r.pay === "dep" ? "Đã cọc" : "Chưa thu",
        ST[r.status].name,
        r.ctvName ? `CTV ${r.ctvName}` : "Web",
        new Date(r.createdAt).toLocaleString("vi-VN"),
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(","),
    );
    const blob = new Blob(["﻿" + [head.join(","), ...lines].join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `yeu-cau-dat-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    showToast(`Đã xuất ${list.length} đơn ra file Excel (CSV)`, "ok");
  }

  const dx = drawerId ? (all.find((r) => r.id === drawerId) ?? calRows.find((r) => r.id === drawerId)) : null;
  const gridCols = "lg:grid-cols-[32px_minmax(0,1fr)_minmax(0,1.9fr)_115px_110px_125px_130px_118px]";

  const tiles: { k: string; v: number; key: "urgent" | BookingStatus; dot: string; sub?: string; subC?: string }[] = [
    { k: "Cần gấp", v: nUrg, key: "urgent", dot: "bg-sunset-500", sub: nUrg ? "xử lý ngay" : "", subC: "text-sunset-600" },
    { k: "Mới", v: n("NEW"), key: "NEW", dot: ST.NEW.dot },
    { k: "Đang liên hệ", v: n("CONTACTING"), key: "CONTACTING", dot: ST.CONTACTING.dot },
    {
      k: "Đã xác nhận", v: n("CONFIRMED"), key: "CONFIRMED", dot: ST.CONFIRMED.dot,
      sub: `${all.filter((r) => r.status === "CONFIRMED" && r.collected === 0).length} chưa cọc`, subC: "text-amber-600",
    },
    { k: "Hoàn thành", v: n("COMPLETED"), key: "COMPLETED", dot: ST.COMPLETED.dot },
    { k: "Đã huỷ", v: n("CANCELLED"), key: "CANCELLED", dot: ST.CANCELLED.dot },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* Tiêu đề + hành động */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">Yêu cầu đặt dịch vụ</h1>
          <p className="mt-1 text-sm text-gray-500" suppressHydrationWarning>
            {totalInDb} đơn · {n("NEW")} mới chưa xử lý · {nUrg} cần gấp
          </p>
        </div>
        {/* max-w-full + min-w-0: màn rất hẹp (≤360px) thanh chọn chế độ tự cuộn trong khung, không đẩy rộng trang. */}
        <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">
          <div className="inline-flex max-w-full gap-1 overflow-x-auto rounded-[14px] bg-gray-200/70 p-1">
            {VIEWS.map(([k, name]) => (
              <button
                key={k}
                type="button"
                onClick={() => setView(k)}
                className={`whitespace-nowrap rounded-[11px] px-2.5 py-2 text-[13px] font-extrabold transition sm:px-3 sm:text-sm ${
                  view === k ? "bg-white text-forest-800 shadow-sm" : "text-gray-600 hover:text-ink"
                }`}
              >
                {name}
              </button>
            ))}
          </div>
          {view === "list" && (
            <button
              type="button"
              onClick={exportCsv}
              className="whitespace-nowrap rounded-full border-[1.5px] border-gray-200 bg-white px-4 py-2.5 text-sm font-bold text-ink hover:bg-gray-50"
            >
              Xuất Excel
            </button>
          )}
          <Link
            href="/admin/bookings/new"
            title="Nhập đơn khách gọi/nhắn trực tiếp: chọn dịch vụ, trạng thái, tiền cọc"
            className="whitespace-nowrap rounded-full bg-sunset-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-sunset-600"
          >
            + Tạo đơn hộ khách
          </Link>
        </div>
      </div>

      {filterLabel && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-forest-50 px-4 py-3 text-sm ring-1 ring-forest-200">
          <span className="font-semibold text-forest-800">Đang lọc · {filterLabel}</span>
          <Link href="/admin/bookings" className="rounded-full bg-white px-3 py-1 text-xs font-bold text-ink ring-1 ring-black/10 hover:bg-gray-50">
            ✕ Bỏ lọc
          </Link>
        </div>
      )}

      {view !== "list" ? (
        <BookingsCalendar
          rows={calRows}
          view={view}
          onView={setView}
          todayKey={todayKey}
          nowMs={nowMs}
          onStatus={(ids, status) => setStatus(ids, status)}
          onOpen={setDrawerId}
        />
      ) : (
      <>
      {/* Thẻ trạng thái */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6">
        {tiles.map((t) => {
          const active = t.key === "urgent" ? urgentOnly : st === t.key;
          return (
            <button
              key={t.k}
              type="button"
              onClick={() =>
                t.key === "urgent"
                  ? (setUrgentOnly(!urgentOnly), setSt("all"))
                  : (setSt(st === t.key ? "all" : (t.key as BookingStatus)), setUrgentOnly(false))
              }
              className={`flex flex-col gap-1 rounded-2xl border-[1.5px] bg-white px-3.5 py-3 text-left transition hover:border-forest-300 ${
                active ? "border-forest-700" : "border-gray-200"
              }`}
            >
              <span className="flex items-center gap-1.5 whitespace-nowrap text-xs font-bold text-gray-500">
                <span className={`h-2 w-2 flex-none rounded-full ${t.dot}`} />
                {t.k}
              </span>
              <span className="flex items-baseline gap-1.5" suppressHydrationWarning>
                <span className="text-2xl font-extrabold tracking-tight text-ink">{t.v}</span>
                {t.sub ? <span className={`whitespace-nowrap text-xs font-semibold ${t.subC}`}>{t.sub}</span> : null}
              </span>
            </button>
          );
        })}
      </div>

      {/* Bộ lọc */}
      <div className="flex flex-col gap-2.5 rounded-2xl border border-gray-100 bg-white p-3.5 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm mã đơn, tên khách, số điện thoại, dịch vụ…"
            className="min-w-[220px] flex-1 rounded-xl border-[1.5px] border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm"
          />
          <select value={cat} onChange={(e) => setCat(e.target.value)} className="rounded-xl border-[1.5px] border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold">
            <option value="all">Mọi dịch vụ</option>
            {CAT_OPTIONS.map(([v, label]) => (
              <option key={v} value={v}>{label}</option>
            ))}
          </select>
          <select value={pay} onChange={(e) => setPay(e.target.value)} className="rounded-xl border-[1.5px] border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold">
            <option value="all">Mọi thanh toán</option>
            <option value="none">Chưa thu</option>
            <option value="dep">Đã cọc</option>
            <option value="full">Đã thu đủ</option>
          </select>
          <select value={src} onChange={(e) => setSrc(e.target.value)} className="rounded-xl border-[1.5px] border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold">
            <option value="all">Mọi nguồn</option>
            <option value="web">Khách tự đặt</option>
            <option value="ctv">Qua CTV</option>
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value)} className="rounded-xl border-[1.5px] border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold">
            <option value="new">Mới gửi trước</option>
            <option value="soon">Sắp đi trước</option>
            <option value="big">Giá trị cao</option>
            <option value="wait">Chờ lâu nhất</option>
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs font-bold text-gray-500">Ngày dùng</span>
          {RANGES.map(([k, name]) => (
            <button
              key={k}
              type="button"
              onClick={() => setRange(k)}
              className={`whitespace-nowrap rounded-full border-[1.5px] px-3 py-1.5 text-[13px] font-semibold transition ${
                range === k ? "border-forest-700 bg-forest-700 text-white" : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              {name}
            </button>
          ))}
          <label className="ml-1.5 flex cursor-pointer items-center gap-1.5 text-[13px] font-semibold text-ink">
            <input
              type="checkbox"
              checked={urgentOnly}
              onChange={(e) => setUrgentOnly(e.target.checked)}
              className="h-[15px] w-[15px] accent-forest-700"
            />
            Chỉ đơn cần xử lý gấp
          </label>
          {hasFilter && (
            <button type="button" onClick={clearFilter} className="ml-auto whitespace-nowrap px-2 py-1.5 text-[13px] font-bold text-red-600 hover:text-red-700">
              Xoá bộ lọc ✕
            </button>
          )}
        </div>
      </div>

      {/* Thanh thao tác hàng loạt */}
      {selIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-forest-800 px-3.5 py-2.5 text-sm font-semibold text-white">
          <span>Đã chọn {selIds.length} đơn</span>
          <span className="flex-1" />
          <button type="button" onClick={() => setStatus(selIds, "CONTACTING", true)} className="rounded-full bg-white/15 px-3 py-1.5 hover:bg-white/25">→ Đang liên hệ</button>
          <button type="button" onClick={() => setStatus(selIds, "CONFIRMED", true)} className="rounded-full bg-white/15 px-3 py-1.5 hover:bg-white/25">→ Đã xác nhận</button>
          <button type="button" onClick={() => setStatus(selIds, "COMPLETED", true)} className="rounded-full bg-white/15 px-3 py-1.5 hover:bg-white/25">→ Hoàn thành</button>
          <button type="button" onClick={() => setStatus(selIds, "CANCELLED", true)} className="rounded-full bg-red-600 px-3 py-1.5 hover:bg-red-700">Huỷ</button>
          <button type="button" onClick={() => deleteRows(selIds)} title="Xoá hẳn khỏi hệ thống (không thể hoàn tác)" className="rounded-full bg-white/15 px-3 py-1.5 text-red-200 hover:bg-red-700 hover:text-white">Xoá hẳn</button>
          <button type="button" onClick={() => setSel({})} className="px-2 py-1.5 opacity-80 hover:opacity-100">Bỏ chọn</button>
        </div>
      )}

      {/* Bảng đơn */}
      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className={`hidden items-center gap-3 border-b border-gray-100 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-gray-500 lg:grid ${gridCols}`}>
          <input type="checkbox" checked={allSel} onChange={() => {
            const on = !allSel;
            const next: Record<string, boolean> = {};
            if (on) list.forEach((r) => (next[r.id] = true));
            setSel(next);
          }} className="h-4 w-4 accent-forest-700" />
          <span>Mã · khách</span><span>Dịch vụ</span><span>Ngày dùng</span>
          <span className="text-right">Giá</span><span>Thanh toán</span><span>Trạng thái</span><span />
        </div>

        {list.map((r) => {
          const stMeta = ST[r.status];
          const [catK, catTone] = CAT_BADGE[r.cat] ?? ["DV", "bg-gray-100 text-gray-600"];
          const dt = daysTo(r.useDate);
          const soon = dt < 0 ? "Đã qua" : dt === 0 ? "Hôm nay" : dt === 1 ? "Ngày mai" : `Còn ${dt} ngày`;
          const soonHot = dt >= 0 && dt <= 2 && r.status !== "COMPLETED" && r.status !== "CANCELLED";
          const m = minsAgo(r.createdAt);
          const urg = isUrgent(r);
          const payText = r.pay === "full" ? "Đã thu đủ" : r.pay === "dep" ? `Cọc ${K(r.collected)}` : "Chưa thu";
          const payTone = r.pay === "full" ? "text-forest-700 bg-forest-500" : r.pay === "dep" ? "text-amber-600 bg-amber-500" : "text-gray-500 bg-gray-400";
          const payPct = r.price ? Math.min(100, Math.round((r.collected / r.price) * 100)) : 0;
          const phoneDigits = r.phone.replace(/\D/g, "");
          return (
            <div
              key={r.id}
              className={`grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-3 border-b border-gray-50 py-3 pl-3 pr-4 transition hover:bg-forest-50/40 lg:px-4 ${gridCols} border-l-[3px] ${
                urg ? "border-l-sunset-500" : "border-l-transparent"
              } ${sel[r.id] ? "bg-forest-50/70" : "bg-white"}`}
              suppressHydrationWarning
            >
              <input
                type="checkbox"
                checked={!!sel[r.id]}
                onChange={() => setSel({ ...sel, [r.id]: !sel[r.id] })}
                className="h-4 w-4 accent-forest-700"
              />
              <Link href={`/admin/bookings/${r.id}`} className="min-w-0 overflow-hidden">
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="font-mono text-[13px] font-extrabold tracking-tight text-ink">{r.code}</span>
                  <span
                    title={r.ctvName ? `Đặt qua cộng tác viên ${r.ctvName}` : "Khách tự đặt trên website"}
                    className={`whitespace-nowrap rounded-md px-1.5 py-0.5 text-[10px] font-extrabold ${
                      r.ctvName ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {r.ctvName ?? "Web"}
                  </span>
                </span>
                <span className="mt-0.5 block truncate text-[13px] font-semibold text-ink">
                  {r.name} · <span className="font-medium text-gray-500">{r.phone}</span>
                </span>
                <span className={`mt-0.5 block whitespace-nowrap text-[11px] ${r.status === "NEW" && m > 30 ? "font-semibold text-sunset-600" : "text-gray-400"}`} suppressHydrationWarning>
                  Gửi {agoText(m)}
                </span>
                {/* Mobile: các cột Dịch vụ/Ngày/Giá/Thanh toán/Trạng thái bị ẩn → tóm tắt gọn ngay dưới để xem luôn. */}
                <span className="mt-1.5 flex flex-wrap items-center gap-1.5 lg:hidden">
                  <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-bold ${stMeta.bd} ${stMeta.bg} ${stMeta.fg}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${stMeta.dot}`} />
                    {stMeta.name}
                  </span>
                  <span className={`inline-flex items-center gap-1 whitespace-nowrap text-[11px] font-bold ${payTone.split(" ")[0]}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${payTone.split(" ")[1]}`} />
                    {payText}
                  </span>
                </span>
                <span className="mt-1 flex min-w-0 items-center gap-1.5 text-[12px] lg:hidden">
                  <span className={`flex-none rounded px-1 py-px text-[10px] font-extrabold ${catTone}`}>{catK}</span>
                  <span className="truncate font-semibold text-gray-700">{r.title}</span>
                </span>
                <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12px] lg:hidden" suppressHydrationWarning>
                  <span className="font-bold text-ink">
                    {r.endDate && r.endDate !== r.useDate ? `${fmtDM(r.useDate)} → ${fmtDM(r.endDate)}` : fmtDM(r.useDate)}
                  </span>
                  <span className={soonHot ? "font-semibold text-sunset-600" : "text-gray-500"}>{soon}</span>
                  <span className="font-extrabold text-ink">{r.price != null ? K(r.price) : ""}</span>
                </span>
              </Link>
              <Link href={`/admin/bookings/${r.id}`} className="hidden min-w-0 overflow-hidden lg:block">
                <span className="flex min-w-0 items-start gap-1.5">
                  <span className={`mt-0.5 flex-none rounded-md px-1.5 py-0.5 text-[10px] font-extrabold ${catTone}`}>{catK}</span>
                  <span className="line-clamp-2 min-w-0 break-words text-sm font-bold leading-snug text-ink">{r.title}</span>
                </span>
                {r.chips.length > 0 && (
                  <span className="mt-1 flex flex-wrap gap-1">
                    {r.chips.slice(0, 3).map((c, i) => (
                      <span key={i} className="max-w-full truncate rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600">{c}</span>
                    ))}
                  </span>
                )}
              </Link>
              <div className="hidden min-w-0 overflow-hidden lg:block">
                <div className="text-[13px] font-bold leading-snug text-ink">
                  {r.endDate && r.endDate !== r.useDate ? `${fmtDM(r.useDate)} → ${fmtDM(r.endDate)}` : `${fmtDM(r.useDate)}/${r.useDate.slice(0, 4)}`}
                </div>
                <div className={`mt-0.5 text-xs ${soonHot ? "font-semibold text-sunset-600" : "text-gray-500"}`} suppressHydrationWarning>{soon}</div>
              </div>
              <div className="hidden min-w-0 overflow-hidden text-right lg:block">
                <div className="text-sm font-extrabold leading-snug text-ink">{r.price != null ? K(r.price) : "—"}</div>
                <div className="text-[11px] text-gray-500">{r.paxLabel}</div>
              </div>
              <div className="hidden min-w-0 overflow-hidden lg:block">
                <div className={`flex items-start gap-1.5 text-xs font-bold leading-snug ${payTone.split(" ")[0]}`}>
                  <span className={`mt-1 h-[7px] w-[7px] flex-none rounded-full ${payTone.split(" ")[1]}`} />
                  <span className="min-w-0 break-words">{payText}</span>
                </div>
                <div className="mt-1.5 h-1 max-w-[110px] overflow-hidden rounded-full bg-gray-100">
                  <div className="h-full rounded-full bg-forest-500" style={{ width: `${payPct}%` }} />
                </div>
              </div>
              <select
                value={r.status}
                onChange={(e) => setStatus([r.id], e.target.value as BookingStatus)}
                className={`hidden max-w-full rounded-full border-[1.5px] px-2 py-1.5 text-xs font-bold lg:block ${stMeta.bd} ${stMeta.bg} ${stMeta.fg}`}
              >
                {ST_LIST.map((k) => (
                  <option key={k} value={k}>{ST[k].name}</option>
                ))}
              </select>
              <div className="flex flex-wrap justify-end gap-1">
                <a
                  href={`tel:${phoneDigits}`}
                  title="Gọi khách"
                  className="whitespace-nowrap rounded-full border-[1.5px] border-gray-200 px-2.5 py-1.5 text-[13px] font-bold text-ink hover:bg-gray-50"
                >
                  Gọi
                </a>
                <button
                  type="button"
                  onClick={() => setDrawerId(r.id)}
                  className="whitespace-nowrap rounded-full bg-forest-800 px-3 py-1.5 text-[13px] font-bold text-white hover:bg-forest-700"
                >
                  Xử lý
                </button>
              </div>
            </div>
          );
        })}

        {list.length === 0 && (
          <div className="px-4 py-10 text-center text-sm text-gray-500">
            Không có đơn nào khớp bộ lọc.{" "}
            <button type="button" onClick={clearFilter} className="font-bold text-forest-700 hover:underline">Xoá bộ lọc</button>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-[12.5px] text-gray-500">
          <span>Hiện {list.length} / {all.length} đơn</span>
          <span className="hidden sm:block">Dòng viền cam bên trái = cần xử lý gấp (đơn mới quá 30 phút hoặc đi trong 48h chưa xác nhận)</span>
        </div>
      </div>

      </>
      )}

      {/* Drawer xử lý nhanh */}
      {dx && (
        <>
          <div onClick={() => setDrawerId(null)} className="fixed inset-0 z-40 bg-slate-900/40 animate-[fadeIn_.2s_ease]" />
          <div className="fixed bottom-0 right-0 top-0 z-50 flex w-[min(520px,100vw)] flex-col bg-gray-50 shadow-2xl animate-[slideIn_.3s_cubic-bezier(.2,.7,.2,1)]">
            <div className="flex items-center gap-3 border-b border-gray-100 bg-white px-5 py-3.5">
              <button
                type="button"
                onClick={() => setDrawerId(null)}
                className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-gray-100 text-lg hover:bg-gray-200"
              >
                ✕
              </button>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-gray-500">Xử lý nhanh</div>
                <div className="font-mono text-[17px] font-extrabold text-ink">{dx.code}</div>
              </div>
              <Link
                href={`/admin/bookings/${dx.id}`}
                className="whitespace-nowrap rounded-full border-[1.5px] border-gray-200 bg-white px-3 py-2 text-[13px] font-bold text-ink hover:bg-gray-50"
              >
                Mở trang đầy đủ ↗
              </Link>
            </div>
            <div className="flex flex-1 flex-col gap-3.5 overflow-y-auto p-5">
              <div className="flex flex-wrap gap-2">
                <a
                  href={`tel:${dx.phone.replace(/\D/g, "")}`}
                  className="flex-1 whitespace-nowrap rounded-full bg-forest-800 px-4 py-3 text-center text-sm font-extrabold text-white hover:bg-forest-700"
                >
                  Gọi {dx.name}
                </a>
                <a
                  href={`https://zalo.me/${dx.phone.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 whitespace-nowrap rounded-full bg-sunset-500 px-4 py-3 text-center text-sm font-extrabold text-white hover:bg-sunset-600"
                >
                  Zalo
                </a>
              </div>

              <div className="flex flex-col gap-2 rounded-2xl border border-gray-100 bg-white px-4 py-3.5">
                <div className="text-[15px] font-extrabold text-ink">{dx.catLabel} · {dx.title}</div>
                {[
                  ["Khách", `${dx.name} · ${dx.phone}`],
                  ["Ngày dùng", dx.endDate && dx.endDate !== dx.useDate ? `${fmtDM(dx.useDate)} → ${fmtDM(dx.endDate)}/${dx.useDate.slice(0, 4)}` : `${fmtDM(dx.useDate)}/${dx.useDate.slice(0, 4)}`],
                  ["Số lượng", dx.paxLabel],
                  ...(dx.chips.length ? [["Chi tiết", dx.chips.join(" · ")]] : []),
                  ["Nguồn", dx.ctvName ? `Qua CTV ${dx.ctvName}` : "Khách tự đặt trên website"],
                  ...(dx.note ? [["Khách ghi chú", dx.note]] : []),
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3 text-[13px]">
                    <span className="whitespace-nowrap text-gray-500">{k}</span>
                    <b className="text-right text-ink">{v}</b>
                  </div>
                ))}
                <div className="flex justify-between gap-3 border-t border-dashed border-gray-200 pt-2 text-sm">
                  <span className="text-gray-500">Tổng</span>
                  <b className="text-base text-sunset-600">{dx.price != null ? K(dx.price) : "Chờ xác nhận giá"}</b>
                </div>
              </div>

              <div className="flex flex-col gap-2 rounded-2xl border border-gray-100 bg-white px-4 py-3.5">
                <div className="text-xs font-bold text-gray-500">Chuyển trạng thái</div>
                <div className="flex flex-wrap gap-1.5">
                  {ST_LIST.map((k) => {
                    const on = dx.status === k;
                    const meta = ST[k];
                    return (
                      <button
                        key={k}
                        type="button"
                        onClick={() => !on && setStatus([dx.id], k)}
                        className={`whitespace-nowrap rounded-full border-[1.5px] px-3 py-2 text-[13px] font-bold transition ${
                          on ? `${meta.bd} ${meta.bg} ${meta.fg}` : "border-gray-200 bg-white text-ink hover:bg-gray-50"
                        }`}
                      >
                        {meta.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-col gap-2 rounded-2xl border border-gray-100 bg-white px-4 py-3.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-bold text-gray-500">Thanh toán</div>
                  <span className={`text-xs font-bold ${dx.pay === "full" ? "text-forest-700" : dx.pay === "dep" ? "text-amber-600" : "text-gray-500"}`}>
                    {dx.pay === "full" ? "Đã thu đủ" : `Đã thu ${K(dx.collected)}${dx.price != null ? ` / ${K(dx.price)}` : ""}`}
                  </span>
                </div>
                <PaymentRecordForm id={dx.id} price={dx.price} collected={dx.collected} />
              </div>

              <div className="flex flex-col gap-2 rounded-2xl border border-gray-100 bg-white px-4 py-3.5">
                <div className="text-xs font-bold text-gray-500">Ghi chú nội bộ</div>
                <NoteForm id={dx.id} />
                <p className="text-[11px] text-gray-400">Ghi chú lưu vào nhật ký xử lý — xem đầy đủ ở trang chi tiết đơn.</p>
              </div>

              <div className="flex items-center justify-between gap-3 rounded-2xl border border-red-100 bg-red-50/60 px-4 py-3.5">
                <div className="min-w-0">
                  <div className="text-xs font-bold text-red-600">Xoá hẳn đơn</div>
                  <p className="mt-0.5 text-[11px] leading-snug text-gray-500">Dành cho đơn rác/trùng/test. Khách huỷ thì chuyển “Đã huỷ” để còn thống kê.</p>
                </div>
                <button
                  type="button"
                  onClick={() => deleteRows([dx.id])}
                  className="whitespace-nowrap rounded-full border-[1.5px] border-red-300 bg-white px-3.5 py-2 text-[13px] font-bold text-red-600 hover:bg-red-600 hover:text-white"
                >
                  Xoá đơn {dx.code}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
