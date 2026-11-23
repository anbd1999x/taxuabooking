import { getSession } from "@/lib/auth";
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

export default async function ProviderStatsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  const sp = await searchParams;
  let fromKey = str(sp.from) ?? "";
  let toKey = str(sp.to) ?? "";
  if (!isValidDateKey(fromKey)) fromKey = monthStartKey();
  if (!isValidDateKey(toKey)) toKey = toDateKey(today());
  if (fromKey > toKey) [fromKey, toKey] = [toKey, fromKey];
  const by: StatsDateBy = str(sp.by) === "created" ? "created" : "use";

  // Chỉ thống kê trên các dịch vụ do chính chủ cơ sở này sở hữu.
  const stats = await computeStats(fromKey, toKey, session!.sub, by);

  return (
    <div>
      <h1 className="text-2xl font-bold text-ink">Thống kê</h1>
      <p className="mt-1 text-sm text-gray-500">
        Theo khoảng ngày (ngày sử dụng hoặc ngày tạo đơn): doanh thu, đã thu / còn thiếu của dịch vụ bạn quản lý, và chi tiết theo từng CTV.
      </p>
      <StatsView stats={stats} action="/admin/provider/thong-ke" fromKey={fromKey} toKey={toKey} by={by} />
    </div>
  );
}
