import { SOURCES, type SourceKey } from "@/lib/traffic-source";
import type { TrafficStats } from "@/lib/traffic-stats";

const pct = (n: number, d: number) => (d ? Math.round((n / d) * 1000) / 10 : 0);
const num = (n: number) => n.toLocaleString("vi-VN");

const dmyKey = (k: string) => k.split("-").reverse().join("/");

/** Khối "Nguồn truy cập" ở /admin/visits — bộ đếm CỘNG DỒN (TrafficDaily) theo nguồn vào. */
export function TrafficSources({
  stats,
  active,
  hrefFor,
  rangeLabel,
}: {
  stats: TrafficStats;
  active: SourceKey | null;
  hrefFor: (key: SourceKey | null) => string;
  rangeLabel: string;
}) {
  const max = Math.max(1, ...stats.rows.map((r) => r.sessions));
  return (
    <section className="flex flex-col gap-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-ink">
            Nguồn truy cập · {rangeLabel}
            <span className="ml-2 text-xs font-normal text-gray-400">
              {stats.since ? `từ ${dmyKey(stats.since)}` : stats.firstDay ? `cộng dồn từ ${dmyKey(stats.firstDay)} tới nay` : ""}
            </span>
          </h2>
        </div>
        <span className="text-sm text-gray-500">
          <b className="text-ink">{num(stats.total)}</b> phiên
          {stats.pending && <span className="ml-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">đang nạp lịch sử…</span>}
        </span>
      </div>

      {stats.rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-500">Chưa có dữ liệu trong khoảng này.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400">
                <th className="py-1.5 pr-2 font-semibold">Nguồn</th>
                <th className="w-[34%] py-1.5 pr-2 font-semibold">Phiên</th>
                <th className="py-1.5 pr-2 text-right font-semibold" title="Khách lần đầu tới website, đến từ nguồn này">Khách mới</th>
                <th className="py-1.5 pr-2 text-right font-semibold">Trang / phiên</th>
                <th className="py-1.5 pr-2 text-right font-semibold" title="Số khách gửi đơn trong khoảng, gán cho nguồn ĐẦU TIÊN đưa khách tới (kể cả khi quay lại sau mới đặt) — mỗi khách tính 1 lần">Khách gửi đơn</th>
                <th className="py-1.5 text-right font-semibold" title="Như trên, với gọi điện / Zalo / Messenger">Khách liên hệ</th>
              </tr>
            </thead>
            <tbody>
              {stats.rows.map((r) => {
                const s = SOURCES[r.key];
                const on = active === r.key;
                return (
                  <tr key={r.key} className={`border-t border-gray-100 ${on ? "bg-forest-50" : ""}`}>
                    <td className="py-2 pr-2">
                      <a href={hrefFor(on ? null : r.key)} className="flex items-center gap-2 font-semibold text-ink hover:text-forest-700">
                        <span>{s.label}</span>
                        {on && <span className="rounded-full bg-forest-600 px-1.5 py-0.5 text-[10px] font-bold text-white">đang lọc ×</span>}
                      </a>
                    </td>
                    <td className="py-2 pr-2">
                      <div className="flex items-center gap-2">
                        <div className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-gray-100">
                          <div className="h-full rounded-full" style={{ width: `${(r.sessions / max) * 100}%`, background: s.color }} />
                        </div>
                        <span className="w-[92px] flex-none whitespace-nowrap text-right tabular-nums">
                          <b className="text-ink">{num(r.sessions)}</b> <span className="text-xs text-gray-400">{pct(r.sessions, stats.total)}%</span>
                        </span>
                      </div>
                    </td>
                    <td className="py-2 pr-2 text-right tabular-nums">{num(r.visitors)}</td>
                    <td className="py-2 pr-2 text-right tabular-nums">{r.sessions ? (r.views / r.sessions).toFixed(1) : "—"}</td>
                    <td className="py-2 pr-2 text-right tabular-nums">
                      {r.booked ? (
                        <span className="font-bold text-forest-700">
                          {num(r.booked)}
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {r.contacted ? (
                        <span className="font-semibold text-sky-700">
                          {num(r.contacted)}
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {stats.spam.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2">
          {stats.spam.length > 0 && (
            <div className="rounded-xl bg-red-50/60 p-3 ring-1 ring-red-100">
              <div className="mb-2 text-xs font-bold text-red-700">Lượt vào từ trang rác (tool SEO / bán traffic, không phải khách thật) — bấm IP để chặn</div>
              <ul className="flex flex-col gap-1.5 text-sm">
                {stats.spam.map((r) => (
                  <li key={r.host}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate text-gray-700">{r.host}</span>
                      <b className="flex-none tabular-nums text-ink">{num(r.sessions)}</b>
                    </div>
                    {r.ips.length > 0 && (
                      <div className="mt-0.5 flex flex-wrap gap-x-2 text-xs">
                        {r.ips.map((ip) => (
                          <a key={ip} href={`/admin/ip-block?ip=${encodeURIComponent(ip)}`} className="font-mono text-red-600 hover:underline" title="Chặn IP này">
                            {ip}
                          </a>
                        ))}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
