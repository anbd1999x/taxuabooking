import { computeStats } from "@/lib/stats";
import { parseDateOnly, toDateKey } from "@/lib/dates";
import { StatsView } from "@/components/admin/StatsView";

export const dynamic = "force-dynamic";

function str(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}
function monthStartKey() {
  const n = new Date();
  return toDateKey(new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), 1)));
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const fromKey = str(sp.from) || monthStartKey();
  const toKey = str(sp.to) || toDateKey(new Date());
  // chuẩn hoá (chặn ngày lỗi)
  parseDateOnly(fromKey);
  parseDateOnly(toKey);

  const stats = await computeStats(fromKey, toKey);

  return (
    <div>
      <h1 className="text-2xl font-bold text-ink">Thống kê & thanh toán</h1>
      <p className="mt-1 text-sm text-gray-500">
        Theo mốc thời gian (ngày tạo đơn): doanh thu, đã thu / còn thiếu, hoa hồng — tổng và theo từng CTV, từng chủ dịch vụ. Doanh thu tính đơn đã giữ phòng/hoàn thành.
      </p>
      <StatsView stats={stats} action="/admin/reports" fromKey={fromKey} toKey={toKey} showProviders />
    </div>
  );
}
