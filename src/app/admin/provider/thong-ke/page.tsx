import { getSession } from "@/lib/auth";
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

export default async function ProviderStatsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  const sp = await searchParams;
  const fromKey = str(sp.from) || monthStartKey();
  const toKey = str(sp.to) || toDateKey(new Date());
  parseDateOnly(fromKey);
  parseDateOnly(toKey);

  // Chỉ thống kê trên các dịch vụ do chính chủ cơ sở này sở hữu.
  const stats = await computeStats(fromKey, toKey, session!.sub);

  return (
    <div>
      <h1 className="text-2xl font-bold text-ink">Thống kê</h1>
      <p className="mt-1 text-sm text-gray-500">
        Theo mốc thời gian (ngày tạo đơn): doanh thu, đã thu / còn thiếu của dịch vụ bạn quản lý, và chi tiết theo từng CTV.
      </p>
      <StatsView stats={stats} action="/admin/provider/thong-ke" fromKey={fromKey} toKey={toKey} />
    </div>
  );
}
