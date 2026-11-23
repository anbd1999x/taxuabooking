import { computeStats, type StatsDateBy } from "@/lib/stats";
import { isValidDateKey, toDateKey, today } from "@/lib/dates";
import { StatsView } from "@/components/admin/StatsView";

export const dynamic = "force-dynamic";

function str(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}
// Mặc định: từ đầu tháng đến hôm nay THEO GIỜ VIỆT NAM.
function monthStartKey() {
  return `${toDateKey(today()).slice(0, 7)}-01`;
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  let fromKey = str(sp.from) ?? "";
  let toKey = str(sp.to) ?? "";
  if (!isValidDateKey(fromKey)) fromKey = monthStartKey();
  if (!isValidDateKey(toKey)) toKey = toDateKey(today());
  if (fromKey > toKey) [fromKey, toKey] = [toKey, fromKey];
  const by: StatsDateBy = str(sp.by) === "created" ? "created" : "use";

  const stats = await computeStats(fromKey, toKey, null, by);

  return (
    <div>
      <h1 className="text-2xl font-bold text-ink">Thống kê & thanh toán</h1>
      <p className="mt-1 text-sm text-gray-500">
        Theo khoảng ngày (ngày sử dụng hoặc ngày tạo đơn): doanh thu, đã thu / còn thiếu, hoa hồng — tổng và theo từng CTV, từng chủ dịch vụ. Doanh thu tính đơn đã giữ phòng/hoàn thành.
      </p>
      <StatsView stats={stats} action="/admin/reports" fromKey={fromKey} toKey={toKey} by={by} showProviders />
    </div>
  );
}
