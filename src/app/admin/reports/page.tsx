import { prisma } from "@/lib/prisma";
import { parseDateOnly, addDays, toDateKey } from "@/lib/dates";
import { toNumber, formatPrice } from "@/lib/format";

export const dynamic = "force-dynamic";

function str(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}
function monthStartKey() {
  const n = new Date();
  return toDateKey(new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), 1)));
}

interface Agg {
  id: string;
  name: string;
  orders: number;
  total: number;
  paid: number;
  unpaid: number;
  comm: number; // tổng hoa hồng CTV (đã chốt)
  commPaid: number; // hoa hồng đã trả cho CTV
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const fromKey = str(sp.from) || monthStartKey();
  const toKey = str(sp.to) || toDateKey(new Date());
  const from = parseDateOnly(fromKey);
  const toExclusive = addDays(parseDateOnly(toKey), 1);

  const bookings = await prisma.bookingRequest.findMany({
    // Doanh thu chỉ tính đơn đã chốt (xác nhận / hoàn thành).
    where: { createdAt: { gte: from, lt: toExclusive }, status: { in: ["CONFIRMED", "COMPLETED"] } },
    select: {
      referencePrice: true,
      paymentStatus: true,
      ctvId: true,
      ctv: { select: { name: true } },
      commissionAmount: true,
      commissionPaid: true,
      service: { select: { ownerId: true, owner: { select: { name: true } } } },
    },
  });

  const byCtv = new Map<string, Agg>();
  const byProvider = new Map<string, Agg>();
  let gTotal = 0, gPaid = 0, gUnpaid = 0;

  let gComm = 0, gCommPaid = 0;

  for (const b of bookings) {
    const amt = toNumber(b.referencePrice) ?? 0;
    const paid = b.paymentStatus === "PAID";
    // Hoa hồng chỉ có khi đơn do CTV đặt.
    const comm = b.ctvId ? toNumber(b.commissionAmount) ?? 0 : 0;
    const commPaid = b.commissionPaid ? comm : 0;
    gTotal += amt; if (paid) gPaid += amt; else gUnpaid += amt;
    gComm += comm; gCommPaid += commPaid;

    const ck = b.ctvId ?? "_none";
    const cn = b.ctv?.name ?? "Khách tự đặt (không qua CTV)";
    const c = byCtv.get(ck) ?? { id: ck, name: cn, orders: 0, total: 0, paid: 0, unpaid: 0, comm: 0, commPaid: 0 };
    c.orders++; c.total += amt; if (paid) c.paid += amt; else c.unpaid += amt;
    c.comm += comm; c.commPaid += commPaid;
    byCtv.set(ck, c);

    const pk = b.service?.ownerId ?? "_none";
    const pn = b.service?.owner?.name ?? "Chưa gán chủ dịch vụ";
    const p = byProvider.get(pk) ?? { id: pk, name: pn, orders: 0, total: 0, paid: 0, unpaid: 0, comm: 0, commPaid: 0 };
    p.orders++; p.total += amt; if (paid) p.paid += amt; else p.unpaid += amt;
    p.comm += comm; p.commPaid += commPaid;
    byProvider.set(pk, p);
  }

  const ctvRows = [...byCtv.values()].sort((a, b) => b.total - a.total);
  const providerRows = [...byProvider.values()].sort((a, b) => b.total - a.total);

  return (
    <div>
      <h1 className="text-2xl font-bold text-ink">Thống kê & thanh toán</h1>
      <p className="mt-1 text-sm text-gray-500">Theo mốc thời gian: số đơn, tổng tiền, đã / chưa thanh toán (chỉ tính đơn đã xác nhận / hoàn thành).</p>

      <form className="mt-4 flex flex-wrap items-end gap-2" action="/admin/reports">
        <label className="block"><span className="text-xs font-medium text-gray-500">Từ ngày</span><input type="date" name="from" defaultValue={fromKey} className="mt-1 block rounded-xl border border-gray-200 px-3 py-2 text-sm" /></label>
        <label className="block"><span className="text-xs font-medium text-gray-500">Đến ngày</span><input type="date" name="to" defaultValue={toKey} className="mt-1 block rounded-xl border border-gray-200 px-3 py-2 text-sm" /></label>
        <button className="rounded-xl bg-forest-600 px-4 py-2 text-sm font-semibold text-white">Xem</button>
      </form>

      {/* Tổng */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Số đơn" value={String(bookings.length)} />
        <Stat label="Tổng tiền" value={formatPrice(gTotal)} />
        <Stat label="Đã thanh toán" value={formatPrice(gPaid)} tone="ok" />
        <Stat label="Chưa thanh toán" value={formatPrice(gUnpaid)} tone="warn" />
      </div>

      {/* Hoa hồng CTV */}
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Hoa hồng CTV (đã chốt)" value={formatPrice(gComm)} />
        <Stat label="HH đã trả CTV" value={formatPrice(gCommPaid)} tone="ok" />
        <Stat label="HH chưa trả CTV" value={formatPrice(gComm - gCommPaid)} tone="warn" />
      </div>

      <ReportTable title="Theo cộng tác viên (CTV)" col="CTV" rows={ctvRows} showCommission />
      <ReportTable title="Theo chủ dịch vụ (đối soát thanh toán)" col="Chủ dịch vụ" rows={providerRows} showCommission />
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "ok" | "warn" }) {
  return (
    <div className={`rounded-2xl p-4 shadow-sm ring-1 ${tone === "ok" ? "bg-forest-50 ring-forest-200" : tone === "warn" ? "bg-amber-50 ring-amber-200" : "bg-white ring-black/5"}`}>
      <p className="text-xl font-extrabold text-ink">{value}</p>
      <p className="mt-1 text-xs text-gray-500">{label}</p>
    </div>
  );
}

function ReportTable({ title, col, rows, showCommission = false }: { title: string; col: string; rows: Agg[]; showCommission?: boolean }) {
  const cols = showCommission ? 7 : 5;
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      <div className="mt-3 overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">{col}</th>
              <th className="px-4 py-3 text-center">Số đơn</th>
              <th className="px-4 py-3 text-right">Tổng tiền</th>
              <th className="px-4 py-3 text-right">Đã TT</th>
              <th className="px-4 py-3 text-right">Chưa TT</th>
              {showCommission && <th className="px-4 py-3 text-right">HH chốt</th>}
              {showCommission && <th className="px-4 py-3 text-right">HH chưa trả</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 ? (
              <tr><td colSpan={cols} className="py-8 text-center text-gray-500">Không có dữ liệu.</td></tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-ink">{r.name}</td>
                  <td className="px-4 py-3 text-center">{r.orders}</td>
                  <td className="px-4 py-3 text-right font-semibold">{formatPrice(r.total)}</td>
                  <td className="px-4 py-3 text-right text-forest-700">{formatPrice(r.paid)}</td>
                  <td className="px-4 py-3 text-right text-amber-700">{formatPrice(r.unpaid)}</td>
                  {showCommission && <td className="px-4 py-3 text-right font-semibold">{r.comm > 0 ? formatPrice(r.comm) : "—"}</td>}
                  {showCommission && <td className="px-4 py-3 text-right text-amber-700">{r.comm - r.commPaid > 0 ? formatPrice(r.comm - r.commPaid) : "—"}</td>}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
