import Link from "next/link";
import { formatPrice } from "@/lib/format";
import type { ServicePayRow, StatRow, StatsResult } from "@/lib/stats";
import { StatsRangeFilter } from "./StatsRangeFilter";

/**
 * Bảng thống kê dùng chung cho admin & chủ dịch vụ.
 * Hiển thị: tổng quan + bảng theo CTV (+ bảng theo chủ dịch vụ cho admin).
 */
export function StatsView({
  stats,
  action,
  fromKey,
  toKey,
  showProviders = false,
}: {
  stats: StatsResult;
  action: string; // URL form GET (trang hiện tại)
  fromKey: string;
  toKey: string;
  showProviders?: boolean;
}) {
  const t = stats.totals;
  return (
    <div>
      {/* Bộ lọc thời gian */}
      <StatsRangeFilter key={`${fromKey}|${toKey}`} action={action} fromKey={fromKey} toKey={toKey} />
      <p className="mt-2 text-xs text-gray-500">
        Đang xem: {dmy(fromKey)} → {dmy(toKey)} (theo ngày tạo đơn)
      </p>

      {/* Tổng quan */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Tổng đơn" value={String(t.orders)} sub={`${t.completed} hoàn thành`} />
        <Stat
          label={t.discount > 0 ? "Thực nhận (sau chiết khấu)" : "Doanh thu (đã chốt)"}
          value={formatPrice(t.revenue)}
          sub={t.discount > 0 ? `đã trừ chiết khấu ${formatPrice(t.discount)}` : undefined}
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

      {showProviders && <ServicePayTable rows={stats.byService} />}

      <StatTable title="Theo cộng tác viên (CTV)" col="CTV" rows={stats.byCtv} />
      {showProviders && (
        <StatTable
          title="Theo chủ dịch vụ"
          col="Chủ dịch vụ"
          rows={stats.byProvider}
          showPlatform
          ordersHref={(r) =>
            `/admin/bookings?${new URLSearchParams({ owner: r.id, from: fromKey, to: toKey }).toString()}`
          }
        />
      )}
    </div>
  );
}

const dmy = (k: string) => `${k.slice(8, 10)}/${k.slice(5, 7)}/${k.slice(0, 4)}`;

/** Thanh toán của sàn cho TỪNG DỊCH VỤ: tổng tiền / đã thanh toán / còn chưa thanh toán. */
function ServicePayTable({ rows }: { rows: ServicePayRow[] }) {
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
      </p>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="Phải thanh toán cho dịch vụ" value={formatPrice(payable)} sub={`tổng bán ra ${formatPrice(sum((r) => r.total))}`} />
        <Stat label="Đã thanh toán" value={formatPrice(paid)} tone="ok" />
        <Stat label="Còn chưa thanh toán" value={formatPrice(remaining)} tone="warn" />
      </div>
      <div className="mt-3 overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
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
              <tr><td colSpan={7} className="py-8 text-center text-gray-500">Không có dữ liệu.</td></tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-3 py-3">
                    <span className="font-medium text-ink">{r.name}</span>
                    <span className="ml-2 whitespace-nowrap rounded-md bg-gray-100 px-1.5 py-0.5 text-[11px] font-bold text-gray-600">{r.kind}</span>
                  </td>
                  <td className="px-3 py-3 text-center">{r.orders}</td>
                  <td className="px-3 py-3 text-right font-semibold">{formatPrice(r.total)}</td>
                  <td className="px-3 py-3 text-right text-gray-500">{r.discount > 0 ? formatPrice(r.discount) : "—"}</td>
                  <td className="px-3 py-3 text-right font-semibold">{formatPrice(r.payable)}</td>
                  <td className="px-3 py-3 text-right text-forest-700">{formatPrice(r.paid)}</td>
                  <td className={`px-3 py-3 text-right font-semibold ${r.remaining > 0 ? "text-amber-700" : "text-forest-700"}`}>
                    {formatPrice(r.remaining)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot className="bg-gray-50 font-bold text-ink">
              <tr>
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

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "ok" | "warn" }) {
  return (
    <div className={`rounded-2xl p-4 shadow-sm ring-1 ${tone === "ok" ? "bg-forest-50 ring-forest-200" : tone === "warn" ? "bg-amber-50 ring-amber-200" : "bg-white ring-black/5"}`}>
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
  ordersHref,
}: {
  title: string;
  col: string;
  rows: StatRow[];
  showPlatform?: boolean;
  /** Có thì số ở cột "Đơn" là link tới danh sách đơn đã lọc. */
  ordersHref?: (r: StatRow) => string;
}) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      <div className="mt-3 overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
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
              <tr><td colSpan={showPlatform ? 9 : 8} className="py-8 text-center text-gray-500">Không có dữ liệu.</td></tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-3 py-3 font-medium text-ink">{r.name}</td>
                  <td className="px-3 py-3 text-center">
                    {ordersHref && r.orders > 0 ? (
                      <Link
                        href={ordersHref(r)}
                        title="Xem các đơn này ở trang Yêu cầu đặt"
                        className="font-semibold text-forest-700 underline decoration-dotted underline-offset-2 hover:text-forest-800"
                      >
                        {r.orders}
                      </Link>
                    ) : (
                      r.orders
                    )}
                  </td>
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
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
