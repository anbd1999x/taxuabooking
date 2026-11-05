import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { geoForIps } from "@/lib/visits";
import { regionLabel } from "@/lib/track-labels";
import { ActionForm } from "@/components/admin/ActionForm";
import { blockIp, unblockIp } from "./actions";

export const dynamic = "force-dynamic";

const fmtTime = (d: Date) =>
  new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 3600_000);
}

export default async function IpBlockPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const prefill = typeof sp.ip === "string" ? sp.ip : "";
  const since = daysAgo(7);

  const [blocked, topRaw] = await Promise.all([
    prisma.blockedIp.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.bookingRequest.groupBy({
      by: ["clientIp"],
      where: { clientIp: { not: null }, createdAt: { gte: since } },
      _count: { _all: true },
      orderBy: { _count: { clientIp: "desc" } },
      take: 20,
    }),
  ]);
  const top = topRaw.filter((t) => t.clientIp) as { clientIp: string; _count: { _all: number } }[];
  const blockedSet = new Set(blocked.map((b) => b.ip));

  const allIps = [...new Set([...blocked.map((b) => b.ip), ...top.map((t) => t.clientIp)])];
  const [geo, counts, recent] = await Promise.all([
    geoForIps(allIps),
    allIps.length
      ? prisma.bookingRequest.groupBy({ by: ["clientIp"], where: { clientIp: { in: allIps } }, _count: { _all: true } })
      : Promise.resolve([]),
    top.length
      ? prisma.bookingRequest.findMany({
          where: { clientIp: { in: top.map((t) => t.clientIp) }, createdAt: { gte: since } },
          orderBy: { createdAt: "desc" },
          select: { id: true, code: true, clientIp: true, customerName: true, phone: true, status: true },
          take: 200,
        })
      : Promise.resolve([]),
  ]);
  const totalBy = new Map(counts.map((c) => [c.clientIp, c._count._all]));

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-xl font-bold text-ink sm:text-2xl">Chặn IP</h1>
        <p className="mt-1 text-sm text-gray-500">
          IP bị chặn sẽ <b>không vào được website</b> và <b>không gửi được đơn</b> (có hiệu lực trong khoảng 30 giây).
          Khu quản trị không bị ảnh hưởng.
        </p>
      </header>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-900">
        <b>Lưu ý:</b> khu vực (Hà Nội, TP.HCM…) suy ra từ IP chỉ là <b>vị trí đăng ký của nhà mạng</b>, không phải
        vị trí thật của người dùng. Mạng di động (4G/5G) thường dùng chung 1 IP cho rất nhiều người và IP đổi liên tục —
        chặn IP 4G có thể chặn nhầm khách thật, và kẻ spam đổi mạng là có IP mới. Nên chặn khi thấy <b>nhiều đơn rác
        từ cùng 1 IP</b>.
      </div>

      {/* Thêm IP */}
      <ActionForm action={blockIp} success="Đã chặn IP" className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 sm:flex-row sm:items-end">
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-sm font-medium text-gray-600">Địa chỉ IP</span>
          <input name="ip" defaultValue={prefill} required placeholder="VD: 113.185.42.10" className="rounded-xl border border-gray-200 px-3 py-2 font-mono text-sm" />
        </label>
        <label className="flex flex-[2] flex-col gap-1">
          <span className="text-sm font-medium text-gray-600">Lý do (tuỳ chọn)</span>
          <input name="reason" placeholder="VD: spam đơn ảo" className="rounded-xl border border-gray-200 px-3 py-2 text-sm" />
        </label>
        <button className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-red-700">Chặn IP</button>
      </ActionForm>

      {/* Danh sách đang chặn */}
      <section className="rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
        <div className="border-b border-gray-100 px-4 py-3 font-bold text-ink">Đang chặn ({blocked.length})</div>
        {blocked.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-gray-500">Chưa chặn IP nào.</div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {blocked.map((b) => {
              const g = geo.get(b.ip);
              return (
                <li key={b.ip} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-mono font-bold text-ink">{b.ip}</div>
                    <div className="text-xs text-gray-500">
                      📍 {regionLabel(g)}{g?.isp ? ` · ${g.isp}` : ""} · {totalBy.get(b.ip) ?? 0} đơn
                    </div>
                    <div className="text-xs text-gray-500">
                      {b.reason ? <>Lý do: <span className="text-gray-700">{b.reason}</span> · </> : null}
                      {fmtTime(b.createdAt)}{b.createdBy ? ` · bởi ${b.createdBy}` : ""}
                    </div>
                  </div>
                  <form action={unblockIp}>
                    <input type="hidden" name="ip" value={b.ip} />
                    <button className="rounded-xl border border-gray-200 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">Bỏ chặn</button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* IP gửi nhiều đơn */}
      <section className="rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
        <div className="border-b border-gray-100 px-4 py-3">
          <div className="font-bold text-ink">IP gửi nhiều đơn nhất (7 ngày)</div>
          <div className="text-xs text-gray-500">Chỉ có dữ liệu cho đơn gửi từ khi bật tính năng này.</div>
        </div>
        {top.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-gray-500">Chưa có dữ liệu.</div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {top.map((t) => {
              const g = geo.get(t.clientIp);
              const orders = recent.filter((r) => r.clientIp === t.clientIp).slice(0, 6);
              const isBlocked = blockedSet.has(t.clientIp);
              return (
                <li key={t.clientIp} className="flex flex-wrap items-start gap-x-4 gap-y-2 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-bold text-ink">{t.clientIp}</span>
                      <span className="rounded-full bg-sunset-50 px-2 py-0.5 text-xs font-bold text-sunset-700">{t._count._all} đơn</span>
                      {isBlocked && <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">Đã chặn</span>}
                    </div>
                    <div className="text-xs text-gray-500">📍 {regionLabel(g)}{g?.isp ? ` · ${g.isp}` : ""}</div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {orders.map((o) => (
                        <Link key={o.id} href={`/admin/bookings/${o.id}`} className="rounded-lg bg-gray-50 px-2 py-1 text-xs text-gray-700 ring-1 ring-gray-200 hover:bg-gray-100">
                          {o.code} · {o.customerName} · {o.phone}
                        </Link>
                      ))}
                    </div>
                  </div>
                  {!isBlocked && (
                    <ActionForm action={blockIp} success="Đã chặn IP">
                      <input type="hidden" name="ip" value={t.clientIp} />
                      <input type="hidden" name="reason" value={`Gửi ${t._count._all} đơn/7 ngày`} />
                      <button className="rounded-xl bg-red-600 px-3 py-1.5 text-sm font-bold text-white hover:bg-red-700">Chặn</button>
                    </ActionForm>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
