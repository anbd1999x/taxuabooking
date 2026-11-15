"use client";

import { useMemo, useState } from "react";
import type { DashBooking } from "@/lib/dashboard-stats";
import { dmy } from "@/lib/date-format";

/**
 * Khối biểu đồ kinh doanh trên trang Tổng quan admin.
 * Dữ liệu: toàn bộ đơn rút gọn (server) → client gom theo Ngày / Tuần / Tháng / Năm (giờ Việt Nam, theo NGÀY TẠO ĐƠN).
 * Doanh thu = giá trị đơn ĐÃ CHỐT (Đã xác nhận + Hoàn thành), cùng quy ước với /admin/reports.
 */

type Gran = "day" | "week" | "month" | "year";
const GRAN: { key: Gran; label: string; n: number; unit: string }[] = [
  { key: "day", label: "Ngày", n: 30, unit: "30 ngày" },
  { key: "week", label: "Tuần", n: 12, unit: "12 tuần" },
  { key: "month", label: "Tháng", n: 12, unit: "12 tháng" },
  { key: "year", label: "Năm", n: 5, unit: "5 năm" },
];

// Màu: 1 chuỗi = màu thương hiệu; trạng thái = bảng màu trạng thái (luôn kèm chú thích chữ).
const C_MAIN = "#226e4b"; // forest-600
const STATUS = [
  { key: "done", label: "Hoàn thành", color: "#0ca30c" },
  { key: "conf", label: "Đã xác nhận", color: "#2a78d6" },
  { key: "proc", label: "Đang xử lý", color: "#fab219" },
  { key: "canc", label: "Đã huỷ", color: "#d03b3b" },
] as const;
type SKey = (typeof STATUS)[number]["key"];

const VN = 7 * 3600_000;
const DAY = 86400_000;
const isChot = (s: DashBooking["s"]) => s === "CONFIRMED" || s === "COMPLETED";
const sKey = (s: DashBooking["s"]): SKey =>
  s === "COMPLETED" ? "done" : s === "CONFIRMED" ? "conf" : s === "CANCELLED" ? "canc" : "proc";

const pad = (n: number) => String(n).padStart(2, "0");
const keyOfMs = (ms: number) => new Date(ms).toISOString().slice(0, 10); // ms đã dời sang giờ VN

/** Mốc bắt đầu kỳ (ms, đã dời giờ VN) chứa thời điểm `vn`. */
function periodStart(vn: number, g: Gran): number {
  const d = new Date(vn);
  const day = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  if (g === "day") return day;
  if (g === "week") return day - ((d.getUTCDay() + 6) % 7) * DAY; // thứ Hai
  if (g === "month") return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
  return Date.UTC(d.getUTCFullYear(), 0, 1);
}
function shift(start: number, g: Gran, k: number): number {
  const d = new Date(start);
  if (g === "day") return start + k * DAY;
  if (g === "week") return start + k * 7 * DAY;
  if (g === "month") return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + k, 1);
  return Date.UTC(d.getUTCFullYear() + k, 0, 1);
}
function shortLabel(start: number, g: Gran): string {
  const d = new Date(start);
  if (g === "year") return String(d.getUTCFullYear());
  if (g === "month") return `T${d.getUTCMonth() + 1}/${String(d.getUTCFullYear()).slice(2)}`;
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}`;
}
function longLabel(start: number, g: Gran): string {
  const d = new Date(start);
  if (g === "year") return `Năm ${d.getUTCFullYear()}`;
  if (g === "month") return `Tháng ${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
  if (g === "week") return `Tuần ${dmy(keyOfMs(start))} – ${dmy(keyOfMs(start + 6 * DAY))}`;
  return dmy(keyOfMs(start));
}

const fmtVnd = (n: number) => `${Math.round(n).toLocaleString("vi-VN")}đ`;
function fmtShort(n: number): string {
  if (n >= 1e9) return `${+(n / 1e9).toFixed(1)} tỷ`;
  if (n >= 1e6) return `${+(n / 1e6).toFixed(1)}tr`;
  if (n >= 1e3) return `${Math.round(n / 1e3)}k`;
  return String(Math.round(n));
}
const pct = (a: number, b: number) => (b > 0 ? (a / b) * 100 : 0);

/** Trục Y "đẹp": max & các vạch chia (1/2/5 × 10^k). */
function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0, 1];
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const top = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= top + step / 2; v += step) ticks.push(v);
  return ticks;
}

interface Bucket {
  start: number;
  orders: number; // đơn tạo trong kỳ (mọi trạng thái)
  revenue: number; // doanh thu đơn đã chốt
  chot: number; // số đơn đã chốt
  byStatus: Record<SKey, number>;
}

function emptyBucket(start: number): Bucket {
  return { start, orders: 0, revenue: 0, chot: 0, byStatus: { done: 0, conf: 0, proc: 0, canc: 0 } };
}

export function DashboardCharts({ bookings, now }: { bookings: DashBooking[]; now: number }) {
  const [gran, setGran] = useState<Gran>("day");
  const [statusMode, setStatusMode] = useState<"count" | "pct">("count");
  const g = GRAN.find((x) => x.key === gran)!;

  const data = useMemo(() => {
    const cur = periodStart(now + VN, gran);
    const first = shift(cur, gran, -(g.n - 1));
    const prevFirst = shift(first, gran, -g.n);
    const buckets: Bucket[] = Array.from({ length: g.n }, (_, i) => emptyBucket(shift(first, gran, i)));
    const idx = new Map(buckets.map((b, i) => [b.start, i]));
    const prev = emptyBucket(prevFirst);
    const inRange: DashBooking[] = [];

    for (const b of bookings) {
      const vn = b.t + VN;
      const ps = periodStart(vn, gran);
      const add = (bk: Bucket) => {
        bk.orders += 1;
        bk.byStatus[sKey(b.s)] += 1;
        if (isChot(b.s)) {
          bk.revenue += b.p;
          bk.chot += 1;
        }
      };
      const i = idx.get(ps);
      if (i !== undefined) {
        add(buckets[i]);
        inRange.push(b);
      } else if (vn >= prevFirst && vn < first) add(prev);
    }

    const sum = buckets.reduce((a, b) => {
      a.orders += b.orders;
      a.revenue += b.revenue;
      a.chot += b.chot;
      for (const s of STATUS) a.byStatus[s.key] += b.byStatus[s.key];
      return a;
    }, emptyBucket(first));

    // Doanh thu theo loại & top dịch vụ (đơn đã chốt trong kỳ đang xem)
    const byCat = new Map<string, { rev: number; n: number }>();
    const bySvc = new Map<string, { rev: number; n: number }>();
    let ctvRev = 0;
    let ctvN = 0;
    for (const b of inRange) {
      if (!isChot(b.s)) continue;
      const c = byCat.get(b.c) ?? { rev: 0, n: 0 };
      c.rev += b.p;
      c.n += 1;
      byCat.set(b.c, c);
      const v = bySvc.get(b.v) ?? { rev: 0, n: 0 };
      v.rev += b.p;
      v.n += 1;
      bySvc.set(b.v, v);
      if (b.ctv) {
        ctvRev += b.p;
        ctvN += 1;
      }
    }
    const toRows = (m: Map<string, { rev: number; n: number }>) =>
      [...m.entries()].map(([label, x]) => ({ label, value: x.rev, n: x.n })).sort((a, b) => b.value - a.value);

    return {
      buckets,
      sum,
      prev,
      byCat: toRows(byCat),
      bySvc: toRows(bySvc).slice(0, 8),
      ctv: { rev: ctvRev, n: ctvN },
      rangeLabel: `${longLabel(first, gran === "week" ? "day" : gran)} → ${longLabel(cur, gran === "week" ? "day" : gran)}`,
    };
  }, [bookings, gran, g.n, now]);

  // Lịch khách đi 30 ngày tới (theo ngày sử dụng) — không phụ thuộc bộ lọc kỳ.
  const upcoming = useMemo(() => {
    const today = periodStart(now + VN, "day");
    const days = Array.from({ length: 30 }, (_, i) => ({ start: today + i * DAY, conf: 0, proc: 0 }));
    const idx = new Map(days.map((d, i) => [keyOfMs(d.start), i]));
    for (const b of bookings) {
      if (b.s === "CANCELLED") continue;
      const i = idx.get(b.u);
      if (i === undefined) continue;
      if (isChot(b.s)) days[i].conf += 1;
      else days[i].proc += 1;
    }
    return days;
  }, [bookings, now]);

  const { sum, prev } = data;
  const avg = sum.chot ? sum.revenue / sum.chot : 0;
  const prevAvg = prev.chot ? prev.revenue / prev.chot : 0;
  const kpis = [
    { label: "Doanh thu (đơn đã chốt)", value: fmtVnd(sum.revenue), delta: delta(sum.revenue, prev.revenue) },
    { label: "Đơn đã chốt", value: String(sum.chot), sub: `/ ${sum.orders} đơn tạo`, delta: delta(sum.chot, prev.chot) },
    { label: "Giá trị TB / đơn", value: fmtVnd(avg), delta: delta(avg, prevAvg) },
    {
      label: "Tỉ lệ hoàn thành",
      value: `${pct(sum.byStatus.done, sum.orders).toFixed(0)}%`,
      sub: `${sum.byStatus.done} đơn`,
      delta: ptDelta(pct(sum.byStatus.done, sum.orders), pct(prev.byStatus.done, prev.orders), prev.orders),
    },
    {
      label: "Tỉ lệ huỷ",
      value: `${pct(sum.byStatus.canc, sum.orders).toFixed(0)}%`,
      sub: `${sum.byStatus.canc} đơn`,
      delta: ptDelta(pct(sum.byStatus.canc, sum.orders), pct(prev.byStatus.canc, prev.orders), prev.orders),
      invert: true,
    },
  ];

  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink">Thống kê kinh doanh</h2>
          <p className="text-xs text-gray-500">
            {g.unit} gần nhất · {data.rangeLabel} · so với {g.unit} trước đó
          </p>
        </div>
        <Seg options={GRAN.map((x) => ({ key: x.key, label: x.label }))} value={gran} onChange={(k) => setGran(k as Gran)} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-5">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
            <p className="text-xs text-gray-500">{k.label}</p>
            <p className="mt-1 text-xl font-extrabold text-ink tabular-nums">
              {k.value} {k.sub && <span className="text-xs font-medium text-gray-400">{k.sub}</span>}
            </p>
            <Delta d={k.delta} invert={k.invert} />
          </div>
        ))}
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <Card title="Doanh thu" hint="Giá trị đơn đã chốt, theo ngày tạo đơn">
          <ColumnChart
            labels={data.buckets.map((b) => shortLabel(b.start, gran))}
            titles={data.buckets.map((b) => longLabel(b.start, gran))}
            series={[{ key: "rev", label: "Doanh thu", color: C_MAIN }]}
            values={data.buckets.map((b) => ({ rev: b.revenue }))}
            fmtAxis={fmtShort}
            extra={(i) => `${data.buckets[i].chot} đơn đã chốt`}
            fmtValue={fmtVnd}
          />
        </Card>

        <Card
          title="Đơn hàng theo trạng thái"
          hint="Mọi đơn tạo trong kỳ — nhìn tỉ lệ hoàn thành / huỷ"
          right={
            <Seg
              small
              options={[
                { key: "count", label: "Số đơn" },
                { key: "pct", label: "Tỉ lệ %" },
              ]}
              value={statusMode}
              onChange={(k) => setStatusMode(k as "count" | "pct")}
            />
          }
        >
          <ColumnChart
            labels={data.buckets.map((b) => shortLabel(b.start, gran))}
            titles={data.buckets.map((b) => longLabel(b.start, gran))}
            series={STATUS.map((s) => ({ key: s.key, label: s.label, color: s.color }))}
            values={data.buckets.map((b) =>
              statusMode === "pct"
                ? Object.fromEntries(STATUS.map((s) => [s.key, pct(b.byStatus[s.key], b.orders)]))
                : { ...b.byStatus },
            )}
            fixedMax={statusMode === "pct" ? 100 : undefined}
            fmtAxis={(v) => (statusMode === "pct" ? `${v}%` : String(v))}
            fmtValue={(v) => (statusMode === "pct" ? `${v.toFixed(0)}%` : `${v} đơn`)}
            extra={(i) => `Tổng ${data.buckets[i].orders} đơn`}
            legend
          />
        </Card>

        <Card title="Doanh thu theo loại dịch vụ" hint={`Đơn đã chốt · ${g.unit} gần nhất`}>
          <BarList rows={data.byCat} fmt={fmtVnd} total={sum.revenue} />
          {sum.revenue > 0 && (
            <p className="mt-3 border-t border-gray-100 pt-3 text-xs text-gray-500">
              Qua CTV: <b className="text-ink">{fmtVnd(data.ctv.rev)}</b> ({pct(data.ctv.rev, sum.revenue).toFixed(0)}%, {data.ctv.n} đơn) ·
              Khách tự đặt: <b className="text-ink">{fmtVnd(sum.revenue - data.ctv.rev)}</b>
            </p>
          )}
        </Card>

        <Card title="Top dịch vụ theo doanh thu" hint={`8 dịch vụ cao nhất · ${g.unit} gần nhất`}>
          <BarList rows={data.bySvc} fmt={fmtVnd} total={sum.revenue} />
        </Card>

        <Card
          className="lg:col-span-2"
          title="Lịch khách đi 30 ngày tới"
          hint="Số đơn theo ngày sử dụng (ngày đi / nhận phòng / nhận xe), không tính đơn huỷ — để chuẩn bị điều phối"
        >
          <ColumnChart
            labels={upcoming.map((d) => shortLabel(d.start, "day"))}
            titles={upcoming.map((d) => {
              const k = keyOfMs(d.start);
              return `${["CN", "T2", "T3", "T4", "T5", "T6", "T7"][new Date(d.start).getUTCDay()]}, ${dmy(k)}`;
            })}
            series={[
              { key: "conf", label: "Đã chốt", color: "#2a78d6" },
              { key: "proc", label: "Chưa xác nhận", color: "#fab219" },
            ]}
            values={upcoming.map((d) => ({ conf: d.conf, proc: d.proc }))}
            fmtAxis={(v) => String(v)}
            fmtValue={(v) => `${v} đơn`}
            legend
            height={160}
          />
        </Card>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

type DeltaV = { text: string; up: boolean } | null;
function delta(cur: number, prev: number): DeltaV {
  if (prev <= 0) return cur > 0 ? { text: "mới", up: true } : null;
  const d = ((cur - prev) / prev) * 100;
  return { text: `${d >= 0 ? "+" : ""}${d.toFixed(0)}%`, up: d >= 0 };
}
function ptDelta(cur: number, prev: number, prevN: number): DeltaV {
  if (prevN <= 0) return null;
  const d = cur - prev;
  return { text: `${d >= 0 ? "+" : ""}${d.toFixed(0)} điểm %`, up: d >= 0 };
}
function Delta({ d, invert }: { d: DeltaV; invert?: boolean }) {
  if (!d) return <p className="mt-1 text-xs text-gray-400">chưa có kỳ trước</p>;
  const good = invert ? !d.up : d.up;
  return (
    <p className={`mt-1 text-xs font-semibold ${good ? "text-forest-700" : "text-red-600"}`}>
      {d.up ? "▲" : "▼"} {d.text} <span className="font-normal text-gray-400">so với kỳ trước</span>
    </p>
  );
}

function Seg({
  options,
  value,
  onChange,
  small,
}: {
  options: { key: string; label: string }[];
  value: string;
  onChange: (k: string) => void;
  small?: boolean;
}) {
  return (
    <div className="inline-flex shrink-0 rounded-xl bg-gray-100 p-1">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChange(o.key)}
          className={`whitespace-nowrap rounded-lg font-semibold transition ${small ? "px-2.5 py-1 text-xs" : "px-3.5 py-1.5 text-sm"} ${
            value === o.key ? "bg-white text-forest-700 shadow-sm" : "text-gray-500 hover:text-ink"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Card({
  title,
  hint,
  right,
  children,
  className = "",
}: {
  title: string;
  hint?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`min-w-0 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 ${className}`}>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-ink">{title}</h3>
          {hint && <p className="text-xs text-gray-500">{hint}</p>}
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

/** Cột (đơn hoặc chồng) bằng HTML — co giãn theo bề rộng, tooltip khi rê/chạm. */
function ColumnChart({
  labels,
  titles,
  series,
  values,
  fmtAxis,
  fmtValue,
  extra,
  fixedMax,
  legend,
  height = 200,
}: {
  labels: string[];
  titles: string[];
  series: { key: string; label: string; color: string }[];
  values: Record<string, number>[];
  fmtAxis: (v: number) => string;
  fmtValue: (v: number) => string;
  extra?: (i: number) => string;
  fixedMax?: number;
  legend?: boolean;
  height?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const totals = values.map((v) => series.reduce((a, s) => a + (v[s.key] ?? 0), 0));
  const ticks = fixedMax ? [0, 25, 50, 75, 100] : niceTicks(Math.max(...totals, 0));
  const top = ticks[ticks.length - 1] || 1;
  const n = labels.length;
  const every = n > 20 ? 5 : n > 12 ? 2 : 1; // thưa nhãn trục X khi nhiều cột
  const empty = totals.every((t) => t === 0);

  return (
    <div>
      {legend && (
        <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
          {series.map((s) => (
            <span key={s.key} className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        {/* Trục Y */}
        <div className="relative w-10 shrink-0 text-right text-[10px] tabular-nums text-gray-400" style={{ height }}>
          {ticks.map((t) => (
            <span key={t} className="absolute right-0 -translate-y-1/2" style={{ top: `${(1 - t / top) * 100}%` }}>
              {fmtAxis(t)}
            </span>
          ))}
        </div>
        <div className="relative min-w-0 flex-1">
          <div className="relative" style={{ height }} onMouseLeave={() => setHover(null)}>
            {ticks.map((t) => (
              <div
                key={t}
                className={`absolute inset-x-0 border-t ${t === 0 ? "border-gray-300" : "border-gray-100"}`}
                style={{ top: `${(1 - t / top) * 100}%` }}
              />
            ))}
            {empty && (
              <p className="absolute inset-0 flex items-center justify-center text-sm text-gray-400">Chưa có dữ liệu trong kỳ</p>
            )}
            <div className="absolute inset-0 flex items-end">
              {values.map((v, i) => (
                <div
                  key={i}
                  className={`flex h-full flex-1 cursor-default items-end justify-center ${hover === i ? "bg-gray-100/70" : ""}`}
                  onMouseEnter={() => setHover(i)}
                  onClick={() => setHover(hover === i ? null : i)}
                >
                  <div
                    className="flex w-[64%] max-w-9 flex-col-reverse gap-[2px] overflow-hidden rounded-t"
                    style={{ height: `${(totals[i] / top) * 100}%` }}
                  >
                    {series.map((s) =>
                      v[s.key] ? (
                        <div key={s.key} style={{ flexGrow: v[s.key], flexBasis: 0, background: s.color, minHeight: 1 }} />
                      ) : null,
                    )}
                  </div>
                </div>
              ))}
            </div>
            {hover !== null && (
              <div
                className="pointer-events-none absolute top-0 z-10 w-max max-w-[220px] rounded-xl bg-white px-3 py-2 text-xs shadow-lg ring-1 ring-black/10"
                style={
                  hover / n > 0.6
                    ? { right: `${(1 - (hover + 0.5) / n) * 100}%`, marginRight: 8 }
                    : { left: `${((hover + 0.5) / n) * 100}%`, marginLeft: 8 }
                }
              >
                <p className="font-semibold text-ink">{titles[hover]}</p>
                {series.map((s) => (
                  <p key={s.key} className="mt-0.5 flex items-center gap-1.5 text-gray-600">
                    <span className="h-2 w-2 rounded-sm" style={{ background: s.color }} />
                    {series.length > 1 && <span>{s.label}:</span>}
                    <b className="text-ink tabular-nums">{fmtValue(values[hover][s.key] ?? 0)}</b>
                  </p>
                ))}
                {extra && <p className="mt-1 text-gray-400">{extra(hover)}</p>}
              </div>
            )}
          </div>
          {/* Trục X */}
          <div className="mt-1 flex h-4 text-[10px] text-gray-400">
            {labels.map((l, i) => (
              <span key={i} className="relative flex-1">
                {(n - 1 - i) % every === 0 && (
                  <span className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap">{l}</span>
                )}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Thanh ngang có nhãn — xếp hạng (loại dịch vụ, top dịch vụ). */
function BarList({ rows, fmt, total }: { rows: { label: string; value: number; n: number }[]; fmt: (v: number) => string; total: number }) {
  if (!rows.length) return <p className="py-8 text-center text-sm text-gray-400">Chưa có đơn đã chốt trong kỳ</p>;
  const max = rows[0].value || 1;
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.label} title={`${r.label}: ${fmt(r.value)} · ${r.n} đơn`}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate text-gray-700">{r.label}</span>
            <span className="shrink-0 tabular-nums text-ink">
              <b>{fmt(r.value)}</b>{" "}
              <span className="text-xs text-gray-400">
                {pct(r.value, total).toFixed(0)}% · {r.n} đơn
              </span>
            </span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-gray-100">
            <div className="h-2 rounded-full" style={{ width: `${(r.value / max) * 100}%`, background: C_MAIN }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
