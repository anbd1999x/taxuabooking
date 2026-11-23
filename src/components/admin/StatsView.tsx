"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { formatPrice } from "@/lib/format";
import { dmy as dmyKey, vnDateTime } from "@/lib/date-format";
import type { PayLine, ServicePayRow, StatRow, StatsResult, StatsDateBy } from "@/lib/stats";
import { StatsRangeFilter } from "./StatsRangeFilter";
import { STT_TH, STT_TD } from "@/components/admin/Stt";

/**
 * Bảng thống kê dùng chung cho admin & chủ dịch vụ.
 * Hiển thị: tổng quan + bảng theo CTV (+ bảng thanh toán từng dịch vụ & theo chủ dịch vụ cho admin —
 * bấm vào dòng để xem từng đơn).
 */
export function StatsView({
  stats,
  action,
  fromKey,
  toKey,
  by = "use",
  showProviders = false,
}: {
  stats: StatsResult;
  action: string; // URL trang hiện tại
  fromKey: string;
  toKey: string;
  by?: StatsDateBy;
  showProviders?: boolean;
}) {
  const t = stats.totals;
  return (
    <div>
      {/* Bộ lọc thời gian */}
      <StatsRangeFilter key={`${fromKey}|${toKey}|${by}`} action={action} fromKey={fromKey} toKey={toKey} by={by} />
      <p className="mt-2 text-xs text-gray-500">
        Đang xem: {dmy(fromKey)} → {dmy(toKey)} (theo {by === "created" ? "ngày tạo đơn" : "ngày sử dụng"})
      </p>

      {/* Tổng quan */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Tổng đơn" value={String(t.orders)} sub={`${t.completed} hoàn thành`} />
        <Stat
          label={t.discount > 0 ? "Thực nhận (sau chiết khấu)" : "Doanh thu (đã chốt)"}
          value={formatPrice(t.revenue)}
          strike={t.discount > 0 && t.listTotal > t.revenue ? formatPrice(t.listTotal) : undefined}
          sub={t.discount > 0 ? `giá bán ${formatPrice(t.revenue + t.discount)} − chiết khấu ${formatPrice(t.discount)}` : undefined}
        />
        <Stat label="Đã thu" value={formatPrice(t.collected)} tone="ok" />
        <Stat label="Còn thiếu" value={formatPrice(t.outstanding)} tone="warn" sub={`${t.awaiting} đơn chờ TT`} />
      </div>

      {/* Doanh thu SÀN (chỉ admin): chiết khấu nhà xe + homestay − hoa hồng CTV. */}
      {showProviders && (
        <section className="mt-6">
          <h2 className="text-lg font-semibold text-ink">Doanh thu sàn (chiết khấu)</h2>
          <p className="mt-0.5 text-xs text-gray-500">
            Đơn đã chốt (giữ chỗ / hoàn thành). Home: chiết khấu theo phòng/đêm · Nhà xe: chiết khấu theo khách/chiều (cài ở trang sửa nhà xe).
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Stat label="Chiết khấu homestay" value={formatPrice(t.homeDiscount)} />
            <Stat label="Chiết khấu nhà xe" value={formatPrice(t.busDiscount)} />
            <Stat label="Tổng chiết khấu thu về" value={formatPrice(t.homeDiscount + t.busDiscount)} tone="ok" />
            <Stat
              label="Hoa hồng CTV"
              value={formatPrice(t.commission)}
              sub={t.commissionUnpaid > 0 ? `chưa trả ${formatPrice(t.commissionUnpaid)}` : undefined}
            />
            <Stat
              label="Lợi nhuận sàn"
              value={formatPrice(t.platformProfit)}
              sub="= chiết khấu − hoa hồng CTV"
              tone={t.platformProfit >= 0 ? "ok" : "warn"}
            />
          </div>
        </section>
      )}

      {showProviders && <ServicePayTable rows={stats.byService} exportQuery={{ from: fromKey, to: toKey, by }} />}

      <StatTable title="Theo cộng tác viên (CTV)" col="CTV" rows={stats.byCtv} />
      {showProviders && <StatTable title="Theo chủ dịch vụ" col="Chủ dịch vụ" rows={stats.byProvider} showPlatform />}
    </div>
  );
}

const dmy = (k: string) => `${k.slice(8, 10)}/${k.slice(5, 7)}/${k.slice(0, 4)}`;

const STATUS: Record<string, [string, string]> = {
  NEW: ["Mới", "bg-sky-50 text-sky-700"],
  CONTACTING: ["Đang liên hệ", "bg-sky-50 text-sky-700"],
  CONFIRMED: ["Đã xác nhận", "bg-forest-50 text-forest-700"],
  COMPLETED: ["Hoàn thành", "bg-forest-100 text-forest-800"],
  CANCELLED: ["Đã huỷ", "bg-red-50 text-red-700"],
};

function Chevron({ open }: { open: boolean }) {
  return (
    <span aria-hidden className={`mr-1.5 inline-block text-gray-400 transition-transform ${open ? "rotate-90" : ""}`}>
      ▸
    </span>
  );
}

/** Danh sách đơn của một dòng (dịch vụ / chủ dịch vụ) — mỗi đơn bấm sang trang chi tiết. */
function OrderLines({ lines, mode }: { lines: PayLine[]; mode: "pay" | "provider" }) {
  if (!lines.length) return <p className="px-4 py-4 text-sm text-gray-500">Không có đơn.</p>;
  const showService = mode === "provider" && new Set(lines.map((l) => l.service)).size > 1;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead className="text-left text-[11px] uppercase text-gray-500">
          <tr>
            <th className="px-3 py-2">Mã đơn</th>
            <th className="px-3 py-2">Khách</th>
            {showService && <th className="px-3 py-2">Dịch vụ</th>}
            <th className="px-3 py-2">Ngày sử dụng</th>
            <th className="px-3 py-2">Trạng thái</th>
            <th className="px-3 py-2 text-right">Tiền bán</th>
            {mode === "provider" && <th className="px-3 py-2 text-right">Khách đã trả</th>}
            <th className="px-3 py-2 text-right">CK sàn</th>
            <th className="px-3 py-2 text-right">Phải TT</th>
            <th className="px-3 py-2 text-right">Đã TT</th>
            <th className="px-3 py-2 text-right">Còn</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {lines.map((l) => {
            const st = STATUS[l.status] ?? [l.status, "bg-gray-100 text-gray-600"];
            return (
              <tr key={`${l.id}:${l.side}`} className="hover:bg-white">
                <td className="whitespace-nowrap px-3 py-2">
                  <Link
                    href={`/admin/bookings/${l.id}`}
                    target="_blank"
                    className="font-semibold text-forest-700 underline decoration-dotted underline-offset-2 hover:text-forest-800"
                    title={`Tạo lúc ${vnDateTime(l.createdAt)} — mở chi tiết đơn`}
                  >
                    {l.code}
                  </Link>
                  {l.combo && (
                    <span className="ml-1.5 rounded bg-amber-50 px-1 py-0.5 text-[10px] font-bold text-amber-700">
                      Combo · {l.side === "bus" ? "vé xe" : "phòng"}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2">{l.customer}</td>
                {showService && <td className="px-3 py-2 text-gray-600">{l.service}</td>}
                <td className="whitespace-nowrap px-3 py-2">
                  {dmyKey(l.useDate)}
                  {l.endDate && l.endDate !== l.useDate ? ` → ${dmyKey(l.endDate)}` : ""}
                </td>
                <td className="px-3 py-2">
                  <span className={`whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-bold ${st[1]}`}>{st[0]}</span>
                </td>
                <td className="px-3 py-2 text-right font-semibold">{formatPrice(l.total)}</td>
                {mode === "provider" && <td className="px-3 py-2 text-right text-forest-700">{formatPrice(l.collected)}</td>}
                <td className="px-3 py-2 text-right text-gray-500">{l.discount ? formatPrice(l.discount) : "—"}</td>
                <td className="px-3 py-2 text-right font-semibold">{formatPrice(l.payable)}</td>
                <td className="px-3 py-2 text-right text-forest-700">{l.paid ? formatPrice(l.paid) : "—"}</td>
                <td className={`px-3 py-2 text-right font-semibold ${l.remaining > 0 ? "text-amber-700" : "text-forest-700"}`}>
                  {formatPrice(l.remaining)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function useToggle() {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  return [open, toggle] as const;
}

/** Thanh toán của sàn cho TỪNG DỊCH VỤ: tổng tiền / đã thanh toán / còn chưa thanh toán. */
function ServicePayTable({ rows, exportQuery }: { rows: ServicePayRow[]; exportQuery: { from: string; to: string; by: StatsDateBy } }) {
  const [open, toggle] = useToggle();
  const exportHref = (id: string) =>
    `/api/admin/reports/export?${new URLSearchParams({ service: id, from: exportQuery.from, to: exportQuery.to, by: exportQuery.by }).toString()}`;
  const sum = (f: (r: ServicePayRow) => number) => rows.reduce((n, r) => n + f(r), 0);
  const payable = sum((r) => r.payable);
  const paid = sum((r) => r.paid);
  const remaining = sum((r) => r.remaining);
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold text-ink">Thanh toán cho từng dịch vụ</h2>
      <p className="mt-0.5 text-xs text-gray-500">
        Đơn đã chốt (giữ chỗ / hoàn thành). Phải thanh toán = tổng tiền bán ra − chiết khấu sàn. Số “đã thanh toán” ghi ở mục
        “Đã thanh toán cho nhà cung cấp” trong trang chi tiết từng đơn; đơn combo tách riêng phần homestay và phần nhà xe.
        <b className="text-gray-600"> Bấm vào từng dòng để xem các đơn.</b>
      </p>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="Phải thanh toán cho dịch vụ" value={formatPrice(payable)} sub={`tổng bán ra ${formatPrice(sum((r) => r.total))}`} />
        <Stat label="Đã thanh toán" value={formatPrice(paid)} tone="ok" />
        <Stat label="Còn chưa thanh toán" value={formatPrice(remaining)} tone="warn" />
      </div>
      <ExportBar rows={rows} hrefFor={exportHref} />
      <div className="mt-3 overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className={STT_TH}>STT</th>
              <th className="px-3 py-3">Dịch vụ</th>
              <th className="px-3 py-3 text-center">Đơn</th>
              <th className="px-3 py-3 text-right">Tổng tiền</th>
              <th className="px-3 py-3 text-right">CK sàn</th>
              <th className="px-3 py-3 text-right">Phải thanh toán</th>
              <th className="px-3 py-3 text-right">Đã thanh toán</th>
              <th className="px-3 py-3 text-right">Còn chưa thanh toán</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 ? (
              <tr><td colSpan={8} className="py-8 text-center text-gray-500">Không có dữ liệu.</td></tr>
            ) : (
              rows.map((r, i) => {
                const isOpen = open.has(r.id);
                return (
                  <Fragment key={r.id}>
                    <tr
                      onClick={() => toggle(r.id)}
                      aria-expanded={isOpen}
                      className={`cursor-pointer select-none ${isOpen ? "bg-forest-50/60" : "hover:bg-gray-50"}`}
                    >
                      <td className={STT_TD}>{i + 1}</td>
                      <td className="px-3 py-3">
                        <Chevron open={isOpen} />
                        <span className="font-medium text-ink">{r.name}</span>
                        <span className="ml-2 whitespace-nowrap rounded-md bg-gray-100 px-1.5 py-0.5 text-[11px] font-bold text-gray-600">{r.kind}</span>
                      </td>
                      <td className="px-3 py-3 text-center font-semibold text-forest-700">{r.orders}</td>
                      <td className="px-3 py-3 text-right font-semibold">{formatPrice(r.total)}</td>
                      <td className="px-3 py-3 text-right text-gray-500">{r.discount > 0 ? formatPrice(r.discount) : "—"}</td>
                      <td className="px-3 py-3 text-right font-semibold">{formatPrice(r.payable)}</td>
                      <td className="px-3 py-3 text-right text-forest-700">{formatPrice(r.paid)}</td>
                      <td className={`px-3 py-3 text-right font-semibold ${r.remaining > 0 ? "text-amber-700" : "text-forest-700"}`}>
                        {formatPrice(r.remaining)}
                      </td>
                    </tr>
                    {isOpen && (
                      <tr>
                        <td colSpan={8} className="bg-gray-50/80 p-0">
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 px-3 py-2">
                            <span className="text-xs text-gray-500">{r.lines.length} đơn đã chốt của <b className="text-ink">{r.name}</b></span>
                            <a
                              href={exportHref(r.id)}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-forest-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-forest-700"
                            >
                              ⬇ Xuất Excel đối soát
                            </a>
                          </div>
                          <OrderLines lines={r.lines} mode="pay" />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot className="bg-gray-50 font-bold text-ink">
              <tr>
                <td />
                <td className="px-3 py-3">Tổng</td>
                <td className="px-3 py-3 text-center">{sum((r) => r.orders)}</td>
                <td className="px-3 py-3 text-right">{formatPrice(sum((r) => r.total))}</td>
                <td className="px-3 py-3 text-right">{formatPrice(sum((r) => r.discount))}</td>
                <td className="px-3 py-3 text-right">{formatPrice(payable)}</td>
                <td className="px-3 py-3 text-right text-forest-700">{formatPrice(paid)}</td>
                <td className="px-3 py-3 text-right text-amber-700">{formatPrice(remaining)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </section>
  );
}

/** Chọn MỘT dịch vụ rồi tải báo cáo đối soát Excel (gửi đối tác) theo khoảng ngày đang xem. */
function ExportBar({ rows, hrefFor }: { rows: ServicePayRow[]; hrefFor: (id: string) => string }) {
  const [sel, setSel] = useState("");
  const sorted = [...rows].sort((a, b) => a.name.localeCompare(b.name, "vi"));
  return (
    <div className="mt-3 flex flex-wrap items-end gap-2 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-black/5">
      <label className="block min-w-0 flex-1 sm:max-w-md">
        <span className="text-xs font-medium text-gray-500">Xuất báo cáo đối soát Excel cho dịch vụ</span>
        <select
          value={sel}
          onChange={(e) => setSel(e.target.value)}
          className="mt-1 block w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold"
        >
          <option value="">— Chọn dịch vụ —</option>
          {sorted.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name} · {r.kind} · {r.orders} đơn
            </option>
          ))}
        </select>
      </label>
      {sel ? (
        <a
          href={hrefFor(sel)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-forest-600 px-4 py-2 text-sm font-bold text-white hover:bg-forest-700"
        >
          ⬇ Xuất Excel
        </a>
      ) : (
        <span className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-xl bg-gray-200 px-4 py-2 text-sm font-bold text-gray-500">
          ⬇ Xuất Excel
        </span>
      )}
      <p className="w-full text-[11px] text-gray-400">
        File gồm thông tin đối tác, tổng hợp thanh toán, chi tiết từng đơn, ghi chú và chỗ ký hai bên — theo khoảng ngày đang chọn ở trên.
      </p>
    </div>
  );
}

/** `strike` = tiền gốc (trước chiết khấu), hiện gạch ngang phía trên số chính. */
function Stat({ label, value, sub, tone, strike }: { label: string; value: string; sub?: string; tone?: "ok" | "warn"; strike?: string }) {
  return (
    <div className={`rounded-2xl p-4 shadow-sm ring-1 ${tone === "ok" ? "bg-forest-50 ring-forest-200" : tone === "warn" ? "bg-amber-50 ring-amber-200" : "bg-white ring-black/5"}`}>
      {strike && <p className="text-sm font-semibold leading-none text-gray-400 line-through">{strike}</p>}
      <p className="text-xl font-extrabold text-ink">{value}</p>
      <p className="mt-1 text-xs text-gray-500">{label}</p>
      {sub && <p className="mt-0.5 text-[11px] text-gray-400">{sub}</p>}
    </div>
  );
}

function StatTable({
  title,
  col,
  rows,
  showPlatform = false,
}: {
  title: string;
  col: string;
  rows: (StatRow & { lines?: PayLine[] })[];
  showPlatform?: boolean;
}) {
  const [open, toggle] = useToggle();
  const cols = showPlatform ? 10 : 9;
  const expandable = rows.some((r) => r.lines);
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      {expandable && <p className="mt-0.5 text-xs text-gray-500">Bấm vào từng dòng để xem các đơn của chủ dịch vụ đó.</p>}
      <div className="mt-3 overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className={STT_TH}>STT</th>
              <th className="px-3 py-3">{col}</th>
              <th className="px-3 py-3 text-center">Đơn</th>
              <th className="px-3 py-3 text-center">Hoàn thành</th>
              <th className="px-3 py-3 text-center">Chờ TT</th>
              <th className="px-3 py-3 text-right">Doanh thu</th>
              <th className="px-3 py-3 text-right">Đã thu</th>
              <th className="px-3 py-3 text-right">Còn thiếu</th>
              <th className="px-3 py-3 text-right">HH chưa trả</th>
              {showPlatform && <th className="px-3 py-3 text-right">CK cho sàn</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 ? (
              <tr><td colSpan={cols} className="py-8 text-center text-gray-500">Không có dữ liệu.</td></tr>
            ) : (
              rows.map((r, i) => {
                const canOpen = !!r.lines;
                const isOpen = canOpen && open.has(r.id);
                return (
                  <Fragment key={r.id}>
                    <tr
                      onClick={canOpen ? () => toggle(r.id) : undefined}
                      aria-expanded={canOpen ? isOpen : undefined}
                      className={canOpen ? `cursor-pointer select-none ${isOpen ? "bg-forest-50/60" : "hover:bg-gray-50"}` : "hover:bg-gray-50"}
                    >
                      <td className={STT_TD}>{i + 1}</td>
                      <td className="px-3 py-3 font-medium text-ink">
                        {canOpen && <Chevron open={isOpen} />}
                        {r.name}
                      </td>
                      <td className={`px-3 py-3 text-center ${canOpen ? "font-semibold text-forest-700" : ""}`}>{r.orders}</td>
                      <td className="px-3 py-3 text-center text-forest-700">{r.completed}</td>
                      <td className="px-3 py-3 text-center text-amber-700">{r.awaiting}</td>
                      <td className="px-3 py-3 text-right font-semibold">{formatPrice(r.revenue)}</td>
                      <td className="px-3 py-3 text-right text-forest-700">{formatPrice(r.collected)}</td>
                      <td className="px-3 py-3 text-right text-amber-700">{formatPrice(r.outstanding)}</td>
                      <td className="px-3 py-3 text-right">{r.commissionUnpaid > 0 ? formatPrice(r.commissionUnpaid) : "—"}</td>
                      {showPlatform && (
                        <td className="px-3 py-3 text-right font-semibold text-forest-700">
                          {r.homeDiscount + r.busDiscount > 0 ? formatPrice(r.homeDiscount + r.busDiscount) : "—"}
                        </td>
                      )}
                    </tr>
                    {isOpen && (
                      <tr>
                        <td colSpan={cols} className="bg-gray-50/80 p-0">
                          <OrderLines lines={r.lines!} mode="provider" />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
