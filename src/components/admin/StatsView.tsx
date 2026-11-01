import { formatPrice } from "@/lib/format";
import type { StatRow, StatsResult } from "@/lib/stats";

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
      <form className="mt-4 flex flex-wrap items-end gap-2" action={action}>
        <label className="block"><span className="text-xs font-medium text-gray-500">Từ ngày</span><input type="date" name="from" defaultValue={fromKey} className="mt-1 block rounded-xl border border-gray-200 px-3 py-2 text-sm" /></label>
        <label className="block"><span className="text-xs font-medium text-gray-500">Đến ngày</span><input type="date" name="to" defaultValue={toKey} className="mt-1 block rounded-xl border border-gray-200 px-3 py-2 text-sm" /></label>
        <button className="rounded-xl bg-forest-600 px-4 py-2 text-sm font-semibold text-white">Xem</button>
      </form>

      {/* Tổng quan */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Tổng đơn" value={String(t.orders)} sub={`${t.completed} hoàn thành`} />
        <Stat label="Doanh thu (đã chốt)" value={formatPrice(t.revenue)} />
        <Stat label="Đã thu" value={formatPrice(t.collected)} tone="ok" />
        <Stat label="Còn thiếu" value={formatPrice(t.outstanding)} tone="warn" sub={`${t.awaiting} đơn chờ TT`} />
      </div>

      <StatTable title="Theo cộng tác viên (CTV)" col="CTV" rows={stats.byCtv} />
      {showProviders && <StatTable title="Theo chủ dịch vụ" col="Chủ dịch vụ" rows={stats.byProvider} />}
    </div>
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

function StatTable({ title, col, rows }: { title: string; col: string; rows: StatRow[] }) {
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
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 ? (
              <tr><td colSpan={8} className="py-8 text-center text-gray-500">Không có dữ liệu.</td></tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-3 py-3 font-medium text-ink">{r.name}</td>
                  <td className="px-3 py-3 text-center">{r.orders}</td>
                  <td className="px-3 py-3 text-center text-forest-700">{r.completed}</td>
                  <td className="px-3 py-3 text-center text-amber-700">{r.awaiting}</td>
                  <td className="px-3 py-3 text-right font-semibold">{formatPrice(r.revenue)}</td>
                  <td className="px-3 py-3 text-right text-forest-700">{formatPrice(r.collected)}</td>
                  <td className="px-3 py-3 text-right text-amber-700">{formatPrice(r.outstanding)}</td>
                  <td className="px-3 py-3 text-right">{r.commissionUnpaid > 0 ? formatPrice(r.commissionUnpaid) : "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
